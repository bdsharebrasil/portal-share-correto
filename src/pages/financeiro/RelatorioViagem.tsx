import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, FileText, Edit, AlertCircle, RotateCcw, FolderOpen, Send, Folder } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { downloadPDF, previewPDFForPrint } from '@/lib/travelReportPDF';
import type { TravelReport as PDFTravelReport, TravelExpense } from '@/lib/travelReportPDF';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type TravelReport = {
  id?: string;
  report_number: string;
  client_id: string;
  client: string;
  aircraft_id: string;
  aircraft_registration: string;
  crew_member_id: string;
  crew_member_name: string;
  crew_member_id2: string;
  crew_member_name2: string;
  crew_member_source?: 'crew' | 'crew_members';
  client_partner?: string;
  route: string;
  start_date: string;
  end_date: string;
  days_count: number;
  observations: string;
  expenses: any[];
  total_amount: number;
  total_fuel: number;
  total_lodging: number;
  total_food: number;
  total_transport: number;
  total_other: number;
  total_crew: number;
  total_crew1: number;
  total_crew2: number;
  total_client: number;
  total_sharebrasil: number;
  status: 'Rascunho' | 'Finalizado' | 'Enviado';
  pdf_url?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
};


const normalizeStatus = (status: string): TravelReport['status'] => {
  const validStatuses: TravelReport['status'][] = ['Rascunho', 'Finalizado', 'Enviado'];
  return validStatuses.includes(status as TravelReport['status']) ? (status as TravelReport['status']) : 'Rascunho';
};

import { draftStorage } from '@/lib/travelReportDraft';
import type { TravelReportDraft } from '@/lib/travelReportDraft';
import { calculateReportTotals, Expense, extractPayerTotals, getValidExpenses } from '@/lib/travelReportUtils';
import { PartnerSelectModal } from '@/components/diario/PartnerSelectModal';
import { ReceiptViewer } from '@/components/financeiro/ReceiptViewer';
import { TravelReportForm } from '@/components/travel/TravelReportForm';

export default function RelatorioViagem() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = (location.state as any) || {};

  const [activeTab, setActiveTab] = useState<'criar' | 'historico' | 'relatorios'>('relatorios');
  const [reports, setReports] = useState<TravelReport[]>([]);
  const [currentReport, setCurrentReport] = useState<TravelReport | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [clientPartners, setClientPartners] = useState<any[]>([]);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [receiptViewerUrl, setReceiptViewerUrl] = useState('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendReportTarget, setSendReportTarget] = useState<TravelReport | null>(null);
  const [sendDueDate, setSendDueDate] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedReportIdToLoad, setSelectedReportIdToLoad] = useState<string | null>(
    navigationState.selectedReportId || null
  );

  // ✅ FIX: useEffect inicial para carregar relatórios e verificar rascunho salvo
  useEffect(() => {
    loadReports();
    const hasDraft = draftStorage.hasDraft();
    setHasSavedDraft(hasDraft);
  }, []);

  // ✅ FIX: Carregar e abrir relatório selecionado quando navegado do RelatorioMensal
  useEffect(() => {
    if (selectedReportIdToLoad && reports.length > 0) {
      const report = reports.find(r => r.id === selectedReportIdToLoad);
      if (report) {
        editReport(selectedReportIdToLoad);
        setSelectedReportIdToLoad(null); // Limpar para evitar re-trigger
      }
    }
  }, [selectedReportIdToLoad, reports]);

  // ✅ FIX: Auto-save do rascunho a cada 30 segundos
  useEffect(() => {
    if (!isCreating || !currentReport || isEditing) return;

    const autoSaveInterval = setInterval(() => {
      draftStorage.saveDraft(currentReport as unknown as TravelReportDraft);
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [currentReport, isCreating, isEditing]);

  // Separar relatórios: Rascunhos no Histórico, Finalizados nas Pastas
  const reportsWithClient = useMemo(() => 
    reports.filter(r => r.client && r.client.trim() && (r.status === 'Finalizado' || r.status === 'Enviado')), 
    [reports]
  );
  const reportsWithoutClient = useMemo(() => 
    reports.filter(r => r.status === 'Rascunho'), 
    [reports]
  );

  const discardDraft = () => {
    draftStorage.clearDraft();
    setHasSavedDraft(false);
    toast.info('Rascunho descartado');
  };

  const handleSendReport = async () => {
    if (!sendReportTarget?.id || !sendDueDate) {
      toast.error('Informe o prazo de vencimento');
      return;
    }
    setIsSending(true);
    try {
      // Update report status to Enviado
      const { error: updateError } = await supabase
        .from('travel_expense_reports')
        .update({ status: 'Enviado', updated_at: new Date().toISOString() })
        .eq('id', sendReportTarget.id);

      if (updateError) throw updateError;

      // Update bank_reconciliations linked to this report with status 'enviado' and due_date
      const { error: reconcError } = await supabase
        .from('bank_reconciliations')
        .update({ 
          status: 'enviado', 
          due_date: sendDueDate,
          updated_at: new Date().toISOString()
        } as any)
        .eq('reference_id', sendReportTarget.id)
        .eq('reference_type', 'travel_report');

      if (reconcError) {
        console.error('Erro ao atualizar conciliação:', reconcError);
      }

      toast.success('✓ Relatório enviado ao cliente com sucesso!');
      setSendDialogOpen(false);
      setSendReportTarget(null);
      setSendDueDate('');
      loadReports();
    } catch (error: any) {
      console.error('Erro ao enviar relatório:', error);
      toast.error(`❌ Erro ao enviar: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('travel_expense_reports')
      .select(`
        *,
        client_id_rel:client_id(company_name),
        partner_id_rel:client_partner(name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('❌ Erro ao carregar relatórios');
      return;
    }

    const reportsWithDefaults = (data || []).map((r: any) => {
      const expenses = (() => {
        try {
          if (typeof r.expenses === 'string') {
            return JSON.parse(r.expenses);
          }
          return r.expenses || [];
        } catch {
          return [];
        }
      })();

      const clientName = r.client_partner && r.partner_id_rel?.name
        ? r.partner_id_rel.name
        : r.client_id_rel?.company_name || '';

      return {
        ...r,
        client: clientName,
        expenses: expenses,
        status: normalizeStatus(r.status)
      };
    });
    setReports(reportsWithDefaults as TravelReport[]);
  };

  const loadReportDetails = async (reportId: string) => {
    const { data: reportData, error: reportError } = await supabase
      .from('travel_expense_reports')
      .select(`
        *,
        client_id_rel:client_id(company_name),
        partner_id_rel:client_partner(name)
      `)
      .eq('id', reportId)
      .single();

    if (reportError || !reportData) throw reportError;

    const rData = reportData as any;

    const expenses = (() => {
      try {
        if (typeof rData.expenses === 'string') {
          return JSON.parse(rData.expenses);
        }
        return rData.expenses || [];
      } catch {
        return [];
      }
    })();

    const clientName = rData.client_partner && rData.partner_id_rel?.name
      ? rData.partner_id_rel.name
      : rData.client_id_rel?.company_name || '';

    return {
      ...rData,
      client: clientName,
      expenses: expenses as Expense[],
      status: normalizeStatus(rData.status)
    } as TravelReport;
  };

  const generateReportNumber = async (clientName: string): Promise<string> => {
    if (!clientName || clientName.trim() === '') {
      return `REL-XXX-0001/${new Date().getFullYear().toString().slice(-2)}`;
    }

    const year = new Date().getFullYear();
    const yearShort = year.toString().slice(-2);

    const getClientInitials = (name: string): string => {
      // Remover espaços e accents, pegar as 3 primeiras letras
      const cleanName = name
        .trim()
        .replace(/\s+/g, '') // Remove todos os espaços
        .toUpperCase();
      
      // Pegar os primeiros 3 caracteres alfabéticos
      const letters = cleanName.replace(/[^A-Z]/g, '').substring(0, 3);
      
      // Completar com 'X' se tiver menos de 3 caracteres
      return letters.padEnd(3, 'X');
    };

    const clientInitials = getClientInitials(clientName);

    // ✅ FIX: Melhorar geração de números com verificação robusta
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      // Buscar todos os relatórios deste cliente para encontrar o próximo número
      const { data: existingReports } = await supabase
        .from('travel_expense_reports')
        .select('report_number')
        .ilike('report_number', `REL-${clientInitials}%`)
        .order('report_number', { ascending: false });

      let nextNumber = 1;
      
      if (existingReports && existingReports.length > 0) {
        // Extrair o maior número entre todos os relatórios
        let maxNumber = 0;
        for (const report of existingReports) {
          // Regex padrão: REL-GAS-001/26
          const match = report.report_number.match(/REL-[A-Z]{3}-(\d+)\/\d{2}/);
          if (match && match[1]) {
            const num = parseInt(match[1]);
            if (num > maxNumber) maxNumber = num;
          }
        }
        nextNumber = maxNumber + 1;
      }

      const candidateReportNumber = `REL-${clientInitials}-${String(nextNumber).padStart(3, '0')}/${yearShort}`;
      
      // ✅ Verificar se o número candidato já existe
      const { data: checkExists } = await supabase
        .from('travel_expense_reports')
        .select('id')
        .eq('report_number', candidateReportNumber)
        .maybeSingle();
      
      if (!checkExists) {
        return candidateReportNumber;
      }
      
      // Se o número já existe, tentar novamente
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Fallback: se não conseguir após tentativas, gerar com timestamp
    // Garante número único sem usar string aleatória
    const timestamp = Date.now().toString().slice(-3);
    return `REL-${clientInitials}-${timestamp}/${yearShort}`;
  };

  const createNewReport = () => {
    const newReport: TravelReport = {
      report_number: `REL-XXX-0001/${new Date().getFullYear().toString().slice(-2)}`,
      client_id: '',
      client: '',
      aircraft_id: '',
      aircraft_registration: '',
      crew_member_id: '',
      crew_member_name: '',
      crew_member_id2: '',
      crew_member_name2: '',
      route: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      days_count: 1,
      observations: '',
      expenses: [{ category: '', description: '', amount: 0, paid_by: '' }],
      total_amount: 0,
      total_fuel: 0,
      total_lodging: 0,
      total_food: 0,
      total_transport: 0,
      total_other: 0,
      total_crew: 0,
      total_crew1: 0,
      total_crew2: 0,
      total_client: 0,
      total_sharebrasil: 0,
      status: 'Rascunho',
    };
    setCurrentReport(newReport);
    draftStorage.saveDraft(newReport as unknown as TravelReportDraft);
    setIsCreating(true);
    setIsEditing(false);
    setActiveTab('criar');
  };

  const editReport = async (reportId: string) => {
    try {
      const reportDetails = await loadReportDetails(reportId);
      setCurrentReport(reportDetails);
      setIsCreating(true);
      setIsEditing(true);
      setActiveTab('criar');
    } catch (error) {
      console.error('Erro ao carregar relatório para edição:', error);
      toast.error('❌ Não foi possível carregar os detalhes do relatório.');
    }
  };

  const deleteReport = async (reportId?: string) => {
    if (!reportId || !window.confirm('⚠ Tem certeza que deseja excluir este relatório e todas as suas despesas? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await (supabase as any).from('expense_items').delete().eq('report_id', reportId);

      const { error } = await supabase
        .from('travel_expense_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      toast.success('✓ Relatório excluído com sucesso!');
      loadReports();
    } catch (error) {
      console.error('Erro ao excluir relatório:', error);
      toast.error('❌ Erro ao excluir o relatório.');
    }
  };

  const handleViewPDF = async (reportId: string) => {
    try {
      const reportWithDetails = await loadReportDetails(reportId);
      const correctedTotals = calculateReportTotals(reportWithDetails.expenses || []);
      const pdfReport: PDFTravelReport = {
        numero: reportWithDetails.report_number,
        cliente_nome: reportWithDetails.client,
        aeronave: reportWithDetails.aircraft_registration,
        tripulante: reportWithDetails.crew_member_name,
        tripulante2: reportWithDetails.crew_member_name2,
        trecho: reportWithDetails.route,
        destino: reportWithDetails.route,
        data_inicio: reportWithDetails.start_date,
        data_fim: reportWithDetails.end_date,
        observacoes: reportWithDetails.observations,
        despesas: (reportWithDetails.expenses || []).map(e => ({
          categoria: e.category,
          descricao: e.description,
          valor: e.amount,
          pago_por: e.paid_by,
          data: (e as any).expense_date || '',
          comprovante_url: e.receipt_url
        })) as TravelExpense[],
        total_combustivel: correctedTotals.total_fuel,
        total_hospedagem: correctedTotals.total_lodging,
        total_alimentacao: correctedTotals.total_food,
        total_transporte: correctedTotals.total_transport,
        total_outros: correctedTotals.total_other,
        total_tripulante: correctedTotals.total_crew,
        total_tripulante1: correctedTotals.total_crew1,
        total_tripulante2: correctedTotals.total_crew2,
        total_cliente: correctedTotals.total_client,
        total_sharebrasil: correctedTotals.total_sharebrasil,
        valor_total: correctedTotals.total_amount
      };

      // Use report creator's name instead of current user
      let userName = 'Usuário';
      const reportCreatedBy = reportWithDetails.created_by;
      if (reportCreatedBy) {
        const { data: creatorProfile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', reportCreatedBy)
          .single();
        if (creatorProfile?.full_name) userName = creatorProfile.full_name;
      } else {
        // Fallback to current user if created_by is null (old reports)
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          if (profile?.full_name) userName = profile.full_name;
        }
      }
      await previewPDFForPrint(pdfReport, userName);
    } catch (error) {
      console.error('Erro ao visualizar PDF:', error);
      toast.error('Erro ao visualizar relatório');
    }
  };

  const saveReport = async (newStatus: TravelReport['status'], reportToSave?: TravelReport) => {
    const reportData = reportToSave || currentReport;
    if (!reportData) return;

    // Quando vindo do TravelReportForm, o report já tem o novo status.
    // Verificar edição usando o status original (no DB) ou se é update com status não-rascunho
    if (isEditing && reportData.id) {
      // Buscar status original no banco para verificação correta
      const originalReport = reports.find(r => r.id === reportData.id);
      const originalStatus = originalReport?.status || 'Rascunho';
      if (originalStatus !== 'Rascunho' && newStatus === 'Finalizado') {
        toast.error('⚠️ Não é possível finalizar relatórios que já foram finalizados. Apenas rascunhos podem ser editados.');
        return;
      }
    }

    setIsSaving(true);
    const isUpdate = !!reportData.id;

    try {
      const validExpenses = getValidExpenses(reportData.expenses);

      let reportNumber = reportData.report_number;
      if (!isUpdate) {
        // Sempre gerar novo número para inserts para evitar conflito de chave única
        reportNumber = await generateReportNumber(reportData.client);
      }

      const recalculatedTotals = calculateReportTotals(validExpenses);
      const totalAmount = recalculatedTotals.total_amount;
      const days = reportData.days_count;

      let crew_member_id_value = null;
      let crew_value = null;

      if (reportData.crew_member_id) {
        if (reportData.crew_member_source === 'crew') {
          crew_value = reportData.crew_member_id;
        } else {
          crew_member_id_value = reportData.crew_member_id;
        }
      }

      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();

      const reportDataToSave: any = {
        report_number: reportNumber,
        client_id: reportData.client_id || null,
        client_partner: reportData.client_partner || null,
        aircraft_id: reportData.aircraft_id || null,
        aircraft_registration: reportData.aircraft_registration,
        crew_member_id: crew_member_id_value,
        crew: crew_value,
        crew_member_name: reportData.crew_member_name,
        crew_member_name2: reportData.crew_member_name2 || null,
        crew_member_id2: reportData.crew_member_id2 || null,
        route: reportData.route,
        start_date: reportData.start_date,
        end_date: reportData.end_date,
        days_count: days,
        observations: reportData.observations || null,
        expenses: JSON.stringify(validExpenses),
        total_amount: totalAmount,
        total_fuel: recalculatedTotals.total_fuel,
        total_lodging: recalculatedTotals.total_lodging,
        total_food: recalculatedTotals.total_food,
        total_transport: recalculatedTotals.total_transport,
        total_other: recalculatedTotals.total_other,
        total_crew: recalculatedTotals.total_crew,
        total_client: recalculatedTotals.total_client,
        total_sharebrasil: recalculatedTotals.total_sharebrasil,
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // Only set created_by on new inserts
      if (!isUpdate && user?.id) {
        reportDataToSave.created_by = user.id;
      }

      let savedReport: any;

      if (isUpdate) {
        const { data, error } = await supabase
          .from('travel_expense_reports')
          .update(reportDataToSave)
          .eq('id', reportData.id)
          .select()
          .single();
        if (error) throw error;
        savedReport = data;
      } else {
        let insertError: any = null;
        let insertAttempts = 0;
        const maxInsertAttempts = 10;

        while (insertAttempts < maxInsertAttempts) {
          const { data, error } = await supabase
            .from('travel_expense_reports')
            .insert([reportDataToSave])
            .select()
            .single();

          if (error) {
            // Se o erro for de constraint única no report_number, tentar com um novo número
            if (error.code === '23505' && error.message?.includes('report_number')) {
              insertAttempts++;
              if (insertAttempts < maxInsertAttempts) {
                // Regenerar o número e tentar novamente
                const newReportNumber = await generateReportNumber(reportData.client);
                reportDataToSave.report_number = newReportNumber;
                // Pequeno delay para evitar race conditions
                await new Promise(resolve => setTimeout(resolve, 100 * insertAttempts));
                continue;
              }
            }
            insertError = error;
            break;
          }

          savedReport = data;
          insertError = null;
          break;
        }

        if (insertError) throw insertError;
      }

      try {
        if (isUpdate) {
          await supabase
            .from('travel_report_attachments')
            .delete()
            .eq('travel_report_id', savedReport.id);
        }

        const attachmentsToInsert = validExpenses
          .map((expense, index) => {
            if (!expense.receipt_url) return null;

            const urlParts = expense.receipt_url.split('/');
            const fileName = urlParts[urlParts.length - 1] || 'comprovante';
            const filePath = `receipts/${fileName}`;

            let fileType = 'application/octet-stream';
            if (expense.receipt_url.includes('.pdf')) fileType = 'application/pdf';
            else if (expense.receipt_url.includes('.jpg') || expense.receipt_url.includes('.jpeg')) fileType = 'image/jpeg';
            else if (expense.receipt_url.includes('.png')) fileType = 'image/png';
            else if (expense.receipt_url.includes('.gif')) fileType = 'image/gif';
            else if (expense.receipt_url.includes('.webp')) fileType = 'image/webp';

            return {
              travel_report_id: savedReport.id,
              expense_index: index,
              file_name: fileName,
              file_path: filePath,
              file_url: expense.receipt_url,
              file_type: fileType,
              file_size: null,
            } as any;
          })
          .filter((item) => item !== null);

        if (attachmentsToInsert.length > 0) {
          const { error: attachmentError } = await supabase
            .from('travel_report_attachments')
            .insert(attachmentsToInsert);

          if (attachmentError) {
            console.error('❌ Erro ao salvar attachments:', attachmentError);
          }
        }
      } catch (attachmentError: any) {
        console.error('❌ Erro ao processar attachments:', attachmentError);
      }

      if (newStatus === 'Finalizado' || newStatus === 'Enviado') {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const today = new Date().toISOString().split('T')[0];
          const reconciliationsToInsert: any[] = [];

          const payerTotals = extractPayerTotals(validExpenses);
          const totalCrew1 = payerTotals.totalCrew1;
          const totalCrew2 = payerTotals.totalCrew2;
          const totalSharebrasil = payerTotals.totalSharebrasil;
          const totalClientOwes = totalSharebrasil + totalCrew1 + totalCrew2;

          if (totalClientOwes > 0 && reportData.client_id) {
            const { data: existingClientPayment } = await supabase
              .from('bank_reconciliations')
              .select('id')
              .eq('reference_id', savedReport.id)
              .eq('type', 'cliente')
              .maybeSingle();

            if (!existingClientPayment) {
              reconciliationsToInsert.push({
                type: 'cliente',
                client_id: reportData.client_id,
                aircraft_id: reportData.aircraft_id || null,
                amount: totalClientOwes,
                status: 'pendente',
                category: 'relatório_viagem',
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - A RECEBER DO CLIENTE`,
                date: today,
                criado_por: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          if (totalCrew1 > 0 && reportData.crew_member_id) {
            const { data: crewMember } = await supabase
              .from('crew_members')
              .select('user_id')
              .eq('id', reportData.crew_member_id)
              .maybeSingle();

            const receiverId = crewMember?.user_id || null;

            const { data: existingCrewPayment } = await supabase
              .from('bank_reconciliations')
              .select('id')
              .eq('reference_id', savedReport.id)
              .eq('type', 'colaborador')
              .ilike('description', '%TRIPULANTE 1%')
              .maybeSingle();

            if (!existingCrewPayment) {
              reconciliationsToInsert.push({
                type: 'colaborador',
                receiver_id: receiverId,
                aircraft_id: reportData.aircraft_id || null,
                amount: totalCrew1,
                status: 'pendente',
                category: 'relatório_viagem',
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - REEMBOLSO TRIPULANTE 1 (${reportData.crew_member_name.toUpperCase()})`,
                date: today,
                criado_por: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          if (totalCrew2 > 0 && reportData.crew_member_name2) {
            const { data: secondCrew } = await supabase
              .from('crew_members')
              .select('id, user_id')
              .eq('full_name', reportData.crew_member_name2)
              .maybeSingle();

            const receiverId = secondCrew?.user_id || null;

            const { data: existingCrewPayment2 } = await supabase
              .from('bank_reconciliations')
              .select('id')
              .eq('reference_id', savedReport.id)
              .eq('type', 'colaborador')
              .ilike('description', '%TRIPULANTE 2%')
              .maybeSingle();

            if (!existingCrewPayment2) {
              reconciliationsToInsert.push({
                type: 'colaborador',
                receiver_id: receiverId,
                aircraft_id: reportData.aircraft_id || null,
                amount: totalCrew2,
                status: 'pendente',
                category: 'relatório_viagem',
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - REEMBOLSO TRIPULANTE 2 (${reportData.crew_member_name2.toUpperCase()})`,
                date: today,
                criado_por: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          if (reconciliationsToInsert.length > 0) {
            const { error: paymentError } = await supabase
              .from('bank_reconciliations')
              .insert(reconciliationsToInsert);

            if (paymentError) {
              console.error('Erro ao registrar conciliações:', paymentError);
            }
          }

          try {
            const pdfData: PDFTravelReport = {
              numero: savedReport.report_number,
              cliente_nome: reportData.client,
              aeronave: reportData.aircraft_registration,
              tripulante: reportData.crew_member_name,
              tripulante2: reportData.crew_member_name2,
              trecho: reportData.route,
              destino: reportData.route,
              data_inicio: reportData.start_date,
              data_fim: reportData.end_date,
              observacoes: reportData.observations,
              despesas: validExpenses.map(e => ({
                categoria: e.category,
                descricao: e.description,
                valor: e.amount,
                pago_por: e.paid_by,
                data: (e as any).expense_date || '',
                comprovante_url: e.receipt_url
              })) as TravelExpense[],
              total_combustivel: recalculatedTotals.total_fuel,
              total_hospedagem: recalculatedTotals.total_lodging,
              total_alimentacao: recalculatedTotals.total_food,
              total_transporte: recalculatedTotals.total_transport,
              total_outros: recalculatedTotals.total_other,
              total_tripulante: recalculatedTotals.total_crew,
              total_tripulante1: recalculatedTotals.total_crew1,
              total_tripulante2: recalculatedTotals.total_crew2,
              total_cliente: recalculatedTotals.total_client,
              total_sharebrasil: recalculatedTotals.total_sharebrasil,
              valor_total: recalculatedTotals.total_amount
            };

            // Get creator name for PDF
            let pdfUserName = 'Usuário';
            if (user?.id) {
              const { data: creatorProfile } = await supabase
                .from('user_profiles')
                .select('full_name')
                .eq('id', user.id)
                .single();
              if (creatorProfile?.full_name) pdfUserName = creatorProfile.full_name;
            }

            const { generatePDF } = await import('@/lib/travelReportPDF');
            const pdfBlob = await generatePDF(pdfData, pdfUserName);

            const pdfFileName = `${savedReport.report_number.replace(/\//g, '-')}-${Date.now()}.pdf`;
            const pdfPath = `reports/${pdfFileName}`;

            const { error: pdfUploadError } = await supabase.storage
              .from('travel-reports')
              .upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });

            if (!pdfUploadError) {
              const { data: { publicUrl: pdfUrl } } = supabase.storage
                .from('travel-reports')
                .getPublicUrl(pdfPath);

              await supabase
                .from('travel_expense_reports')
                .update({ pdf_url: pdfUrl })
                .eq('id', savedReport.id);

              // PDF gerado com sucesso - URL será copiada automaticamente
              navigator.clipboard.writeText(pdfUrl).catch(err => {
                console.warn('Não foi possível copiar URL automaticamente:', err);
              });
            }
          } catch (pdfError: any) {
            console.error('Erro ao gerar/salvar PDF:', pdfError);
            toast.warning(`⚠️ Erro ao gerar PDF: ${pdfError?.message || 'Tente novamente'}`);
          }
        }
      }

      const statusLabel = newStatus === 'Finalizado' ? 'finalizado' : newStatus === 'Enviado' ? 'enviado' : 'salvo como rascunho';
      const steps = [`Relatório ${statusLabel} com sucesso`];
      if (newStatus === 'Finalizado' || newStatus === 'Enviado') {
        steps.push('Conciliações financeiras registradas');
        steps.push('PDF gerado');
      }
      toast.success(`✅ ${steps.join(' · ')}`);
      draftStorage.clearDraft();
      setHasSavedDraft(false);

      // Sempre fechar o formulário quando o relatório for finalizado ou enviado
      if (newStatus === 'Finalizado' || newStatus === 'Enviado') {
        setIsCreating(false);
        setCurrentReport(null);
        setActiveTab('relatorios'); // Voltar para a aba de relatórios
      } else {
        // Se foi um INSERT bem-sucedido (novo relatório), atualizar currentReport com o novo ID
        // para evitar erro de constraint única se o usuário tentar editar novamente
        if (!isUpdate && savedReport?.id) {
          setCurrentReport(prev => prev ? { ...prev, id: savedReport.id } : null);
        } else {
          setIsCreating(false);
          setCurrentReport(null);
        }
      }

      loadReports();
    } catch (error: any) {
      console.error('Erro ao salvar relatório:', error);
      const errorMessage = error.message || 'Erro desconhecido';
      const errorDetails = error.details || error.hint || '';
      const fullErrorMsg = errorDetails ? `${errorMessage} - ${errorDetails}` : errorMessage;
      toast.error(`❌ Erro ao salvar: ${fullErrorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const statusBadgeColors: Record<TravelReport['status'], string> = {
    'Rascunho': 'bg-amber-100/80 text-amber-800 ring-amber-200',
    'Finalizado': 'bg-blue-100/80 text-blue-800 ring-blue-200',
    'Enviado': 'bg-green-100/80 text-green-800 ring-green-200',
  };

  const statusBorderColors: Record<TravelReport['status'], string> = {
    'Rascunho': 'border-l-4 border-l-amber-400',
    'Finalizado': 'border-l-4 border-l-blue-400',
    'Enviado': 'border-l-4 border-l-green-400',
  };

  // Cyan Folder Icon SVG
  const CyanFolderIcon = () => (
    <svg viewBox="0 0 120 100" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Folder tab */}
      <path d="M10 25 L10 15 Q10 8 17 8 L42 8 Q46 8 48 12 L54 22 Q56 25 60 25 Z" fill="#06b6d4" opacity="0.9" />
      {/* Folder body */}
      <rect x="6" y="25" width="108" height="68" rx="8" fill="#06b6d4" />
    </svg>
  );

  const renderReportCard = (report: TravelReport) => (
    <div
      key={report.id}
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 hover:border-border group",
        statusBorderColors[report.status]
      )}
    >
      <div className="mb-3 sm:mb-0 min-w-[240px] flex-1">
        <div className="flex items-start gap-3 mb-2">
          <FileText className="h-5 w-5 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-base">{report.report_number}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("inline-block text-xs font-bold px-3 py-1 rounded-full ring-1", statusBadgeColors[report.status])}>
                {report.status}
              </span>
              {report.status === 'Finalizado' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSendReportTarget(report);
                    setSendDueDate('');
                    setSendDialogOpen(true);
                  }}
                  className="h-6 px-2 text-xs gap-1 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Send className="h-3 w-3" />
                  Enviar
                </Button>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          {report.client}
          <span className="text-xs text-muted-foreground/70 ml-1">({report.aircraft_registration})</span>
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {format(parseISO(report.start_date), "dd MMM", { locale: ptBR })} a {format(parseISO(report.end_date), "dd MMM yyyy", { locale: ptBR })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
        <div className="text-right">
          <p className="text-xs text-muted-foreground/70 font-medium">Total</p>
          <p className="font-bold text-lg text-green-600 font-mono">
            R$ {report.total_amount.toFixed(2).replace('.', ',')}
          </p>
        </div>
        <div className="flex gap-1 ml-auto sm:ml-0">
          {report.status === 'Rascunho' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editReport(report.id!)}
              title="Editar Relatório"
              className="rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewPDF(report.id!)}
            title="Visualizar Relatório"
            className="rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteReport(report.id)}
            title="Excluir Relatório"
            className="rounded-lg transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {!isCreating ? (
          <>
            {hasSavedDraft && (
              <Card className="border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-100/50">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 animate-pulse" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-amber-900 text-base">Rascunho salvo automaticamente</h3>
                        <p className="text-sm text-amber-700/80 mt-1 leading-relaxed">
                          Você tem um relatório anterior em rascunho. Deseja continuar editando?
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={discardDraft}
                        className="text-amber-600 hover:bg-amber-100/50 hover:text-amber-700 rounded-lg transition-all duration-200"
                      >
                        Descartar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const draft = draftStorage.getDraft();
                          if (draft) {
                            setCurrentReport(draft as unknown as TravelReport);
                            setIsCreating(true);
                            setIsEditing(false);
                            setActiveTab('criar');
                            toast.success('✓ Rascunho restaurado com sucesso!');
                          }
                        }}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restaurar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-md rounded-xl border-border/50">
              <CardHeader className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <CardTitle className="text-2xl font-bold text-foreground">Relatório de Despesa de Viagem</CardTitle>
                </div>

                {/* Tabs Navigation */}
                <div className="flex gap-2 border-b border-border">
                  <Button
                    onClick={() => setActiveTab('criar')}
                    variant={activeTab === 'criar' ? 'default' : 'ghost'}
                    className={cn(
                      'px-4 py-2 rounded-none border-b-2 font-medium transition-all',
                      activeTab === 'criar'
                        ? 'border-b-primary text-primary bg-primary/5'
                        : 'border-b-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Novo
                  </Button>
                  <Button
                    onClick={() => setActiveTab('historico')}
                    variant={activeTab === 'historico' ? 'default' : 'ghost'}
                    className={cn(
                      'px-4 py-2 rounded-none border-b-2 font-medium transition-all',
                      activeTab === 'historico'
                        ? 'border-b-primary text-primary bg-primary/5'
                        : 'border-b-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Rascunhos ({reportsWithoutClient.length})
                  </Button>
                  <Button
                    onClick={() => setActiveTab('relatorios')}
                    variant={activeTab === 'relatorios' ? 'default' : 'ghost'}
                    className={cn(
                      'px-4 py-2 rounded-none border-b-2 font-medium transition-all',
                      activeTab === 'relatorios'
                        ? 'border-b-primary text-primary bg-primary/5'
                        : 'border-b-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Relatórios Finalizados ({reportsWithClient.length})
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {/* Tab: Criar Novo */}
                {activeTab === 'criar' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Criar Novo Relatório</h3>
                    <p className="text-muted-foreground mb-6">Preencha os dados do relatório de despesa de viagem abaixo.</p>
                    <div className="flex">
                      <Button
                        onClick={createNewReport}
                        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Iniciar Novo Relatório
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tab: Rascunhos */}
                {activeTab === 'historico' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Rascunhos</h3>
                    {reportsWithoutClient.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-center text-muted-foreground font-medium">Nenhum rascunho</p>
                        <p className="text-center text-muted-foreground text-sm">Crie um novo relatório para começar</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reportsWithoutClient.map(report => renderReportCard(report))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Relatórios Finalizados */}
                {activeTab === 'relatorios' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Pastas de Clientes</h3>
                    {reportsWithClient.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-center text-muted-foreground font-medium">Nenhum relatório finalizado</p>
                        <p className="text-center text-muted-foreground text-sm">Finalize um rascunho para vê-lo aqui</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                        {Object.entries(
                          reportsWithClient.reduce((acc, report) => {
                            const key = report.client || 'Sem Cliente';
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(report);
                            return acc;
                          }, {} as Record<string, TravelReport[]>)
                        ).map(([clientName, group]) => {
                          // Get client_id and client_partner from first report in group
                          const clientId = group[0]?.client_id;
                          const clientPartner = group[0]?.client_partner;

                          return (
                            <button
                              key={clientName}
                              onClick={() => {
                                if (clientId) {
                                  navigate(`/financeiro/relatorios-cliente/${clientId}`, { state: { clientName, clientPartner } });
                                }
                              }}
                              className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200 cursor-pointer"
                            >
                              <div className="w-24 h-20 relative group-hover:scale-105 transition-transform duration-200">
                                <CyanFolderIcon />
                              </div>
                              <div className="text-center w-full">
                                <p className="text-sm font-semibold text-foreground truncate">{clientName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {group.length} {group.length === 1 ? 'relatório' : 'relatórios'}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : currentReport && (
          <TravelReportForm
            report={currentReport}
            onSave={async (report, status) => {
              // Manter o ID se já existir, caso contrário usar o report como está
              const reportToSave = {
                ...report,
                // Se não tem ID, deixar vazio para que o saveReport gere
                id: report.id || undefined
              };
              setCurrentReport(reportToSave);
              await saveReport(status, reportToSave);
            }}
            onCancel={() => {
              if (draftStorage.hasDraft()) {
                if (window.confirm('Deseja descartar as alterações não salvas?')) {
                  draftStorage.clearDraft();
                  setHasSavedDraft(false);
                  setIsCreating(false);
                }
              } else {
                setIsCreating(false);
              }
            }}
            onAutoSave={(report) => {
              if (!isEditing) {
                draftStorage.saveDraft(report);
              }
            }}
            showPartnerModal={() => setShowPartnerModal(true)}
            onReceiptView={(url) => {
              setReceiptViewerUrl(url);
              setReceiptViewerOpen(true);
            }}
          />
        )}
      </div>

      <PartnerSelectModal
        open={showPartnerModal}
        onOpenChange={setShowPartnerModal}
        clientName={currentReport?.client || ''}
        partners={clientPartners}
        selectedPartner={currentReport?.client || null}
        onSelectPartner={(partnerName) => {
          const partner = clientPartners.find(p => p.name === partnerName);
          if (partner) {
            setCurrentReport(prev => prev ? { ...prev, client_partner: partner.id, client: partner.name } : null);
            if (currentReport && !isEditing) {
              draftStorage.saveDraft({ ...currentReport, client_partner: partner.id, client: partner.name } as unknown as TravelReportDraft);
            }
          }
        }}
      />

      <ReceiptViewer
        open={receiptViewerOpen}
        onOpenChange={setReceiptViewerOpen}
        url={receiptViewerUrl}
        title="Comprovante Anexado"
      />
      {/* Send Report Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-500" />
              Enviar Relatório ao Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Relatório</p>
              <p className="font-semibold text-foreground">{sendReportTarget?.report_number}</p>
              <p className="text-xs text-muted-foreground">{sendReportTarget?.client}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Total: <span className="font-bold text-foreground">R$ {sendReportTarget?.total_amount.toFixed(2).replace('.', ',')}</span>
              </p>
            </div>
            <div>
              <Label htmlFor="due-date">Prazo de Vencimento</Label>
              <Input
                id="due-date"
                type="date"
                value={sendDueDate}
                onChange={(e) => setSendDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendReport}
              disabled={!sendDueDate || isSending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isSending ? 'Enviando...' : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
