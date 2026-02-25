import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ControlledSelect, SelectItem as ControlledSelectItem } from '@/components/ui/controlled-select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Send, Upload, Eye, FileText, ArrowLeft, Edit, AlertCircle, AlertTriangle, RotateCcw, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useClientes } from '@/hooks/useClientes';
import { useAeronaves } from '@/hooks/useAeronaves';
import { useTripulantes } from '@/hooks/useTripulantes';
import { cn } from '@/lib/utils';
import { downloadPDF, previewPDFForPrint } from '@/lib/travelReportPDF';
import type { TravelReport as PDFTravelReport, TravelExpense } from '@/lib/travelReportPDF';
import { draftStorage } from '@/lib/travelReportDraft';
import type { TravelReportDraft } from '@/lib/travelReportDraft';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { calculateReportTotals, enrichReportWithCorrectTotals, extractPayerTotals, getValidExpenses } from '@/lib/travelReportUtils';
import { PartnerSelectModal } from '@/components/diario/PartnerSelectModal';
import { ReceiptViewer } from '@/components/financeiro/ReceiptViewer';
import { TravelReportForm } from '@/components/travel/TravelReportForm';

const EXPENSE_CATEGORIES = ['Combustível', 'Hospedagem', 'Alimentação', 'Transporte', 'Outros'];
const REPORT_STATUSES = ['Rascunho', 'Finalizado', 'Enviado'];

interface Expense {
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  receipt_url?: string;
  id?: string;
}

interface TravelReport {
  id?: string;
  report_number: string;
  client_id: string;
  client: string;
  partner_name: string;
  aircraft_id: string;
  aircraft_registration: string;
  crew_member_id: string;
  crew_member_name: string;
  crew_member_name_2: string;
  route: string;
  start_date: string;
  end_date: string;
  days_count: number;
  observations: string;
  expenses: Expense[];
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
  pdf_url?: string;
  status: 'Rascunho' | 'Finalizado' | 'Enviado';
}

export default function RelatorioViagem() {
  const { clientes, isLoadingClientes } = useClientes();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();
  const { tripulantes, isLoadingTripulantes } = useTripulantes();

  const [reports, setReports] = useState<TravelReport[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [currentReport, setCurrentReport] = useState<TravelReport | null>(null);
  const [showSecondCrew, setShowSecondCrew] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'Todos' | TravelReport['status']>('Todos');
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [clientPartners, setClientPartners] = useState<{name: string; cpf?: string; index: number}[]>([]);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [receiptViewerUrl, setReceiptViewerUrl] = useState<string>('');

  const fetchClientPartners = async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_partners')
      .select('name, cpf')
      .eq('client_id', clientId)
      .order('name');
    if (error || !data || data.length === 0) {
      setClientPartners([]);
      return [];
    }
    const partners = data.map((p, i) => ({ name: p.name, cpf: p.cpf || undefined, index: i }));
    setClientPartners(partners);
    return partners;
  };

  useEffect(() => {
    loadReports();
    checkForSavedDraft();
  }, []);

  // Auto-salvamento de rascunho a cada 30 segundos
  useEffect(() => {
    if (!isCreating || !currentReport) return;

    const autoSaveInterval = setInterval(() => {
      if (currentReport && !isEditing) {
        draftStorage.saveDraft(currentReport as TravelReportDraft);
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [currentReport, isCreating, isEditing]);

  const checkForSavedDraft = () => {
    const hasDraft = draftStorage.hasDraft();
    setHasSavedDraft(hasDraft);
  };

  const loadSavedDraft = () => {
    const draft = draftStorage.getDraft();
    if (draft) {
      setCurrentReport(draft as TravelReport);
      setIsCreating(true);
      setIsEditing(false);
      setShowSecondCrew(!!draft.crew_member_name_2);
      toast.success('✓ Rascunho restaurado com sucesso!');
    }
  };

  const discardDraft = () => {
    draftStorage.clearDraft();
    setHasSavedDraft(false);
    toast.info('Rascunho descartado');
  };

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('travel_expense_reports')
      .select('*')
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

      return {
        ...r,
        expenses: expenses,
        status: r.status || 'Rascunho'
      };
    });
    setReports(reportsWithDefaults as TravelReport[]);
  };

  const loadReportDetails = async (reportId: string) => {
    const { data: reportData, error: reportError } = await supabase
      .from('travel_expense_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !reportData) throw reportError;

    const expenses = (() => {
      try {
        if (typeof reportData.expenses === 'string') {
          return JSON.parse(reportData.expenses);
        }
        return reportData.expenses || [];
      } catch {
        return [];
      }
    })();

    return {
      ...reportData,
      expenses: expenses as Expense[],
      status: (reportData as any).status || 'Rascunho'
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
      partner_name: '',
      aircraft_id: '',
      aircraft_registration: '',
      crew_member_id: '',
      crew_member_name: '',
      crew_member_name_2: '',
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
    draftStorage.saveDraft(newReport as TravelReportDraft);
    setIsCreating(true);
    setIsEditing(false);
    setShowSecondCrew(false);
  };

  const editReport = async (reportId: string) => {
    try {
      toast.info('⏳ Carregando detalhes do relatório...');
      const reportDetails = await loadReportDetails(reportId);
      setCurrentReport(reportDetails);
      setIsCreating(true);
      setIsEditing(true);
      setShowSecondCrew(!!reportDetails.crew_member_name_2);
      calculateTotals(reportDetails.expenses, reportDetails);
      toast.success('✓ Relatório carregado com sucesso');
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
      toast.info('🗑️ Excluindo relatório...');
      await supabase.from('expense_items').delete().eq('report_id', reportId);

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

  const downloadReportPdf = async (report: TravelReport) => {
    try {
      // Validação básica antes de gerar PDF
      if (!report.client || !report.aircraft_registration || !report.crew_member_name) {
        toast.error('⚠️ Dados incompletos para gerar o PDF. Verifique o relatório.');
        return;
      }

      // IMPORTANTE: Recalcular os totais a partir das despesas
      // Isto garante que o PDF sempre terá os valores CORRETOS
      const correctedTotals = calculateReportTotals(report.expenses || []);

      const pdfReport: PDFTravelReport = {
        numero: report.report_number,
        cliente_nome: report.client,
        aeronave: report.aircraft_registration,
        tripulante: report.crew_member_name,
        tripulante2: report.crew_member_name_2,
        trecho: report.route,
        destino: report.route,
        data_inicio: report.start_date,
        data_fim: report.end_date,
        observacoes: report.observations,
        despesas: (report.expenses || []).map(e => ({
          categoria: e.category,
          descricao: e.description,
          valor: e.amount,
          pago_por: e.paid_by,
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

      await downloadPDF(pdfReport);
      toast.success('✓ PDF baixado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast.error(`❌ Erro ao gerar PDF: ${error?.message || 'Tente novamente'}`);
    }
  };

  const handleInputChange = async (field: keyof TravelReport, value: any) => {
    if (!currentReport) return;
    const updated = { ...currentReport, [field]: value };

    if (field === 'client' && value && !isEditing) {
      const newReportNumber = await generateReportNumber(value);
      updated.report_number = newReportNumber;
    }

    setCurrentReport(updated);
    if (!isEditing) {
      draftStorage.saveDraft(updated as TravelReportDraft);
    }
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  };

  const calculateTotals = (expenses: Expense[], report: TravelReport | null = currentReport) => {
    if (!report) return;

    // Sempre recalcula os totais a partir das despesas
    const totals = calculateReportTotals(expenses);

    setCurrentReport(prev => prev ? ({ ...prev, ...totals }) : null);
  };

  const handleExpenseChange = (index: number, field: keyof Expense, value: any) => {
    if (!currentReport) return;
    const newExpenses = [...currentReport.expenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setCurrentReport({ ...currentReport, expenses: newExpenses });
    calculateTotals(newExpenses);
  };

  const addExpense = () => {
    if (!currentReport) return;
    setCurrentReport({
      ...currentReport,
      expenses: [...currentReport.expenses, { category: '', description: '', amount: 0, paid_by: '' }]
    });
  };

  const removeExpense = (index: number) => {
    if (!currentReport) return;
    const newExpenses = currentReport.expenses.filter((_, i) => i !== index);
    setCurrentReport({ ...currentReport, expenses: newExpenses });
    calculateTotals(newExpenses);
  };

  const handleFileUpload = async (index: number, file?: File) => {
    if (!file || !currentReport) return;

    // Validação de tamanho (máximo 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('❌ Arquivo muito grande. Máximo 5MB permitido.');
      return;
    }

    // Validação de tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('❌ Tipo de arquivo não permitido. Use: JPG, PNG, WebP ou PDF.');
      return;
    }

    setUploadingIndex(index);
    const toastId = toast.loading('📤 Enviando comprovante...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('travel-reports')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('travel-reports')
        .getPublicUrl(filePath);

      handleExpenseChange(index, 'receipt_url', publicUrl);
      toast.success('✓ Comprovante enviado com sucesso!', { id: toastId });
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(`❌ Erro ao fazer upload: ${error?.message || 'Tente novamente'}`, { id: toastId });
    } finally {
      setUploadingIndex(null);
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

      // SEMPRE recalcular todos os totais a partir das despesas para garantir precisão
      const recalculatedTotals = calculateReportTotals(validExpenses);
      const totalAmount = recalculatedTotals.total_amount;
      const days = reportData.days_count;

      const reportDataToSave = {
        report_number: reportNumber,
        client_id: reportData.client_id || null,
        client: reportData.partner_name || reportData.client,
        partner_name: reportData.partner_name || null,
        aircraft_id: reportData.aircraft_id || null,
        aircraft_registration: reportData.aircraft_registration,
        crew_member_id: reportData.crew_member_id || null,
        crew_member_name: reportData.crew_member_name,
        crew_member_name_2: reportData.crew_member_name_2 || null,
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

      let savedReport;

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

      // Criar conciliações bancárias quando o relatório for finalizado
      if (newStatus !== 'Rascunho') {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const today = new Date().toISOString().split('T')[0];
          const reconciliationsToInsert: any[] = [];

          // Recalcular totais a partir das despesas
          const payerTotals = extractPayerTotals(validExpenses);
          const totalCrew1 = payerTotals.totalCrew1;
          const totalCrew2 = payerTotals.totalCrew2;
          const totalSharebrasil = payerTotals.totalSharebrasil;

          // Valor que o cliente deve = ShareBrasil + Tripulantes (tudo que não foi pago pelo cliente)
          const totalClientOwes = totalSharebrasil + totalCrew1 + totalCrew2;

          console.log('Totais para conciliação:', {
            total_amount: recalculatedTotals.total_amount,
            total_client: recalculatedTotals.total_client,
            total_sharebrasil: totalSharebrasil,
            totalCrew1,
            totalCrew2,
            totalClientOwes
          });

          // 1. Criar conciliação para CLIENTE (valor que Share+Tripulantes pagaram)
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
                created_by: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          // 2. Criar conciliação para TRIPULANTE 1 (valor que ele pagou e precisa ser reembolsado)
          if (totalCrew1 > 0 && reportData.crew_member_id) {
            // Buscar o user_id do crew_member para usar como receiver_id
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
                created_by: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          // 3. Criar conciliação para TRIPULANTE 2 (se houver)
          if (totalCrew2 > 0 && reportData.crew_member_name_2) {
            // Buscar o crew_member pelo nome e depois pegar o user_id
            const { data: secondCrew } = await supabase
              .from('crew_members')
              .select('id, user_id')
              .eq('full_name', reportData.crew_member_name_2)
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
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - REEMBOLSO TRIPULANTE 2 (${reportData.crew_member_name_2.toUpperCase()})`,
                date: today,
                created_by: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          // Inserir todas as conciliações
          if (reconciliationsToInsert.length > 0) {
            console.log('Inserindo conciliações:', reconciliationsToInsert);
            const { error: paymentError } = await supabase
              .from('bank_reconciliations')
              .insert(reconciliationsToInsert);

            if (paymentError) {
              console.error('Erro ao registrar conciliações:', paymentError);
              toast.warning('⚠️ Relatório salvo, mas houve erro ao criar conciliações bancárias');
            } else {
              toast.success(`✓ ${reconciliationsToInsert.length} conciliação(ões) bancária(s) criada(s)`);
            }
          }
        }
      }

      const messageStatus = newStatus === 'Rascunho' ? 'Rascunho' : newStatus === 'Finalizado' ? 'Finalizado' : 'Enviado';
      toast.success(isUpdate ? `✓ Relatório atualizado para: ${messageStatus}` : `✓ Relatório criado com status: ${messageStatus}`);
      draftStorage.clearDraft();
      setHasSavedDraft(false);
      setIsCreating(false);
      setCurrentReport(null);
      loadReports();
    } catch (error: any) {
      console.error('Erro ao salvar relatório:', error);
      console.error('Detalhes do erro:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: error
      });

      const errorMessage = error.message || 'Erro desconhecido';
      const errorDetails = error.details || error.hint || '';
      const fullErrorMsg = errorDetails ? `${errorMessage} - ${errorDetails}` : errorMessage;

      toast.error(`❌ Erro ao salvar: ${fullErrorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredReports = useMemo(() => {
    if (activeStatusFilter === 'Todos') {
      return reports;
    }
    return reports.filter(report => report.status === activeStatusFilter);
  }, [reports, activeStatusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { 'Todos': reports.length };
    REPORT_STATUSES.forEach(status => {
      counts[status as TravelReport['status']] = reports.filter(r => r.status === status).length;
    });
    return counts;
  }, [reports]);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {!isCreating ? (
          <>
            {hasSavedDraft && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-yellow-900">Você tem um rascunho salvo</h3>
                        <p className="text-sm text-yellow-800 mt-1">Deseja continuar editando o relatório anterior?</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" onClick={discardDraft} className="border-yellow-600 text-yellow-600 hover:bg-yellow-100">
                        Descartar
                      </Button>
                      <Button size="sm" onClick={loadSavedDraft} className="bg-yellow-600 hover:bg-yellow-700">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restaurar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between">
                <div>
                  <CardTitle>Histórico de Relatórios de Viagem</CardTitle>
                  {reports.length === 0 && <p className="text-sm text-muted-foreground mt-1">Carregando relatórios...</p>}
                </div>
                <div className="mt-4 md:mt-0 flex space-x-2">
                  <Button onClick={createNewReport}>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Relatório
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {['Todos', ...REPORT_STATUSES].map(status => (
                    <Button
                      key={status}
                      variant={activeStatusFilter === status ? "default" : "outline"}
                      onClick={() => setActiveStatusFilter(status as 'Todos' | TravelReport['status'])}
                      className="text-sm"
                    >
                      {status}{' '}
                      <span className="ml-2 px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                        {status === 'Todos' ? statusCounts.Todos : statusCounts[status as TravelReport['status']]}
                      </span>
                    </Button>
                  ))}
                </div>

                {filteredReports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum relatório encontrado na pasta {activeStatusFilter}.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredReports.map((report) => (
                      <div
                        key={report.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg shadow-sm hover:bg-accent/50 transition-colors"
                      >
                        <div className="mb-2 sm:mb-0 min-w-[200px]">
                          <p className="font-medium flex items-center">
                            {report.report_number}
                            <span className={`ml-3 text-xs font-bold px-2 py-0.5 rounded-full ${report.status === 'Rascunho' ? 'bg-yellow-100 text-yellow-800' :
                                report.status === 'Finalizado' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                              }`}>
                              {report.status}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {report.client} ({report.aircraft_registration})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(report.start_date).toLocaleDateString()} a{' '}
                            {new Date(report.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center space-x-2 mt-2 sm:mt-0">
                          <p className="font-bold text-lg text-green-600 min-w-[100px] text-right">
                            R$ {report.total_amount.toFixed(2)}
                          </p>
                          {report.status === 'Rascunho' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                if (report.status !== 'Rascunho') {
                                  toast.error(`Não é permitido editar relatórios com status "${report.status}". Apenas rascunhos podem ser editados.`);
                                  return;
                                }
                                editReport(report.id!);
                              }}
                              title="Editar Relatório"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const reportWithDetails = await loadReportDetails(report.id!);

                                // IMPORTANTE: Recalcular os totais a partir das despesas
                                // Isto garante que mesmo se o relatório foi salvo com totais errados,
                                // a visualização mostrará os valores CORRETOS
                                const correctedTotals = calculateReportTotals(reportWithDetails.expenses || []);

                                const pdfReport: PDFTravelReport = {
                                  numero: reportWithDetails.report_number,
                                  cliente_nome: reportWithDetails.client,
                                  aeronave: reportWithDetails.aircraft_registration,
                                  tripulante: reportWithDetails.crew_member_name,
                                  tripulante2: reportWithDetails.crew_member_name_2,
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
                            }}
                            title="Visualizar Relatório"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteReport(report.id)}
                            title="Excluir Relatório"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : currentReport && (
          <>
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

          </>
        )}
      </div>
      <PartnerSelectModal
        open={showPartnerModal}
        onOpenChange={setShowPartnerModal}
        clientName={currentReport?.client || ''}
        partners={clientPartners}
        selectedPartner={currentReport?.partner_name || null}
        onSelectPartner={(partnerName) => {
          setCurrentReport(prev => prev ? { ...prev, partner_name: partnerName } : null);
          if (currentReport && !isEditing) {
            draftStorage.saveDraft({ ...currentReport, partner_name: partnerName } as TravelReportDraft);
          }
        }}
      />
      <ReceiptViewer
        open={receiptViewerOpen}
        onOpenChange={setReceiptViewerOpen}
        url={receiptViewerUrl}
        title="Comprovante Anexado"
      />
    </Layout>
  );
}
