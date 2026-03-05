import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, FileText, Edit, AlertCircle, RotateCcw, FolderOpen, Send } from 'lucide-react';
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
  updated_at?: string;
};

const REPORT_STATUSES = ['Rascunho', 'Finalizado', 'Enviado'] as const;

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
  const [activeStatusFilter, setActiveStatusFilter] = useState<'Todos' | TravelReport['status']>('Todos');
  const [reports, setReports] = useState<TravelReport[]>([]);
  const [currentReport, setCurrentReport] = useState<TravelReport | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [openClientGroups, setOpenClientGroups] = useState<Record<string, boolean>>({});
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [clientPartners, setClientPartners] = useState<any[]>([]);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [receiptViewerUrl, setReceiptViewerUrl] = useState('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendReportTarget, setSendReportTarget] = useState<TravelReport | null>(null);
  const [sendDueDate, setSendDueDate] = useState('');
  const [isSending, setIsSending] = useState(false);

  // ✅ FIX: useEffect inicial para carregar relatórios e verificar rascunho salvo
  useEffect(() => {
    loadReports();
    const hasDraft = draftStorage.hasDraft();
    setHasSavedDraft(hasDraft);
  }, []);

  // ✅ FIX: Auto-save do rascunho a cada 30 segundos
  useEffect(() => {
    if (!isCreating || !currentReport || isEditing) return;

    const autoSaveInterval = setInterval(() => {
      draftStorage.saveDraft(currentReport as unknown as TravelReportDraft);
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [currentReport, isCreating, isEditing]);

  const filteredReports = useMemo(() => {
    if (activeStatusFilter === 'Todos') {
      return reports;
    }
    return reports.filter(report => report.status === activeStatusFilter);
  }, [reports, activeStatusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Todos': reports.length };
    REPORT_STATUSES.forEach(status => {
      counts[status] = reports.filter(r => r.status === status).length;
    });
    return counts;
  }, [reports]);

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
      const words = name.trim().split(/\s+/);
      return words
        .map(w => w.charAt(0).toUpperCase())
        .join('')
        .substring(0, 3)
        .padEnd(3, 'X');
    };

    const clientInitials = getClientInitials(clientName);

    const { data: existingReports } = await supabase
      .from('travel_expense_reports')
      .select('report_number')
      .ilike('report_number', `REL-${clientInitials}-%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (existingReports && existingReports.length > 0) {
      const lastNumber = existingReports[0].report_number;
      const match = lastNumber.match(/REL-[A-Z]{3}-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    return `REL-${clientInitials}-${String(nextNumber).padStart(3, '0')}/${yearShort}`;
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
  };

  const editReport = async (reportId: string) => {
    try {
      const reportDetails = await loadReportDetails(reportId);
      setCurrentReport(reportDetails);
      setIsCreating(true);
      setIsEditing(true);
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
      const { data: { user } } = await supabase.auth.getUser();
      let userName = 'Usuário';
      if (user?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        if (profile?.full_name) userName = profile.full_name;
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

    if (isEditing && reportData.status !== 'Rascunho') {
      toast.error('⚠️ Não é possível editar relatórios que já foram finalizados. Apenas rascunhos podem ser editados.');
      return;
    }

    setIsSaving(true);
    const isUpdate = !!reportData.id;

    try {
      const validExpenses = getValidExpenses(reportData.expenses);

      let reportNumber = reportData.report_number;
      if (!isUpdate && (reportNumber.includes('XXX') || reportNumber.startsWith('R-'))) {
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

      const reportDataToSave = {
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
        const { data, error } = await supabase
          .from('travel_expense_reports')
          .insert([reportDataToSave])
          .select()
          .single();
        if (error) throw error;
        savedReport = data;
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

            const { generatePDF } = await import('@/lib/travelReportPDF');
            const pdfBlob = await generatePDF(pdfData);

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

              toast.success(`✅ PDF gerado! URL copiada para a área de transferência`, {
                action: {
                  label: 'Copiar novamente',
                  onClick: () => {
                    navigator.clipboard.writeText(pdfUrl);
                    toast.success('URL copiada!');
                  }
                }
              });
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

      toast.success('✓ Relatório salvo com sucesso!');
      draftStorage.clearDraft();
      setHasSavedDraft(false);
      setIsCreating(false);
      setCurrentReport(null);
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

  const renderReportList = () => {
    if (filteredReports.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-center text-muted-foreground font-medium">Nenhum relatório encontrado</p>
          <p className="text-center text-muted-foreground text-sm">na pasta {activeStatusFilter}</p>
        </div>
      );
    }

    if (activeStatusFilter === 'Finalizado') {
      const grouped: Record<string, TravelReport[]> = {};
      filteredReports.forEach(r => {
        const key = r.client || 'Sem Cliente';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
      });

      return (
        <div className="space-y-3">
          {Object.entries(grouped).map(([clientName, group]) => {
            if (group.length <= 1) {
              const report = group[0];
              return report ? renderReportCard(report) : null;
            }

            const open = !!openClientGroups[clientName];
            return (
              <div key={clientName} className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{clientName}</div>
                      <div className="text-sm text-muted-foreground">
                        {group.length} {group.length === 1 ? 'relatório' : 'relatórios'}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenClientGroups(prev => ({ ...prev, [clientName]: !prev[clientName] }))}
                  >
                    {open ? 'Fechar' : 'Abrir'}
                  </Button>
                </div>
                {open && (
                  <div className="space-y-2 mt-2">
                    {group.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-3 rounded-md border border-border/40 hover:bg-accent"
                      >
                        <div>
                          <div className="font-medium text-foreground">{report.report_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(parseISO(report.start_date), 'dd MMM yyyy', { locale: ptBR })} • R$ {report.total_amount.toFixed(2).replace('.', ',')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {report.status === 'Finalizado' && (
                            <Button variant="ghost" size="sm" onClick={() => {
                              setSendReportTarget(report);
                              setSendDueDate('');
                              setSendDialogOpen(true);
                            }} title="Enviar ao Cliente" className="text-emerald-400 hover:bg-emerald-500/10">
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {report.status === 'Rascunho' && (
                            <Button variant="ghost" size="sm" onClick={() => editReport(report.id!)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleViewPDF(report.id!)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteReport(report.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filteredReports.map((report) => renderReportCard(report))}
      </div>
    );
  };

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
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6">
                <div>
                  <CardTitle className="text-2xl font-bold text-foreground">Histórico de Relatórios</CardTitle>
                  {reports.length === 0 && (
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Carregando relatórios...</p>
                  )}
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <Button
                    onClick={createNewReport}
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] w-full md:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Relatório
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="flex flex-wrap gap-3 mb-6">
                  {(['Todos', ...REPORT_STATUSES] as const).map(status => {
                    const isActive = activeStatusFilter === status;
                    const statusColors: Record<string, { bg: string; activeBg: string; activeText: string }> = {
                      'Todos': { bg: 'bg-slate-700/10 text-slate-200', activeBg: 'bg-slate-700', activeText: 'text-white' },
                      'Rascunho': { bg: 'bg-amber-800/10 text-amber-300', activeBg: 'bg-amber-600', activeText: 'text-white' },
                      'Finalizado': { bg: 'bg-blue-800/10 text-blue-300', activeBg: 'bg-gradient-to-r from-blue-600 to-cyan-500', activeText: 'text-white' },
                      'Enviado': { bg: 'bg-green-800/10 text-green-300', activeBg: 'bg-gradient-to-r from-emerald-600 to-green-500', activeText: 'text-white' }
                    };
                    const colors = statusColors[status] || statusColors['Todos'];

                    return (
                      <Button
                        key={status}
                        onClick={() => setActiveStatusFilter(status as 'Todos' | TravelReport['status'])}
                        className={cn(
                          'rounded-full px-4 py-2 h-auto transition-all duration-200 font-medium text-sm flex items-center gap-2',
                          isActive
                            ? `${colors.activeBg} ${colors.activeText} shadow-sm ring-2 ring-offset-2 ring-white/10`
                            : `${colors.bg} hover:brightness-105 active:scale-[0.98]`
                        )}
                      >
                        <span>{status}</span>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-semibold',
                          isActive ? 'bg-white/20' : 'bg-white/5'
                        )}>
                          {status === 'Todos' ? statusCounts['Todos'] : statusCounts[status]}
                        </span>
                      </Button>
                    );
                  })}
                </div>

                {renderReportList()}
              </CardContent>
            </Card>
          </>
        ) : currentReport && (
          <TravelReportForm
            report={currentReport}
            onSave={async (report, status) => {
              setCurrentReport(report);
              await saveReport(status, report);
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
