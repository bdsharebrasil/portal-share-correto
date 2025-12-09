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
    try {
      toast.info('📤 Enviando comprovante...');
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
      toast.success('✓ Comprovante enviado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(`❌ Erro ao fazer upload: ${error?.message || 'Tente novamente'}`);
    } finally {
      setUploadingIndex(null);
    }
  };

  const saveReport = async (newStatus: TravelReport['status']) => {
    if (!currentReport) return;

    if (isEditing && currentReport.status !== 'Rascunho') {
      toast.error('⚠️ Não é possível editar relatórios que já foram finalizados. Apenas rascunhos podem ser editados.');
      return;
    }

    // Validações obrigatórias
    if (!currentReport.client_id && (!currentReport.client || currentReport.client.trim() === '')) {
      toast.error('⚠️ Preencha o campo obrigatório: Cliente (selecione uma opção ou digite um nome)');
      return;
    }

    if (!currentReport.aircraft_id && (!currentReport.aircraft_registration || currentReport.aircraft_registration.trim() === '')) {
      toast.error('⚠️ Preencha o campo obrigatório: Aeronave (selecione uma opção ou digite uma matrícula)');
      return;
    }

    if (!currentReport.route || currentReport.route.trim() === '') {
      toast.error('⚠️ Preencha o campo obrigatório: Trecho (Ex: SBPF-SBGR)');
      return;
    }

    if (!currentReport.crew_member_id && (!currentReport.crew_member_name || currentReport.crew_member_name.trim() === '')) {
      toast.error('⚠️ Preencha o campo obrigatório: Tripulante 1 (selecione uma opção ou digite um nome)');
      return;
    }

    // Validação de datas
    if (!currentReport.start_date || !currentReport.end_date) {
      toast.error('⚠️ Preencha as datas de início e fim da viagem');
      return;
    }

    if (new Date(currentReport.start_date) > new Date(currentReport.end_date)) {
      toast.error('⚠️ A data final deve ser igual ou posterior à data inicial');
      return;
    }

    // Validação de despesas para status Finalizado
    if (newStatus !== 'Rascunho') {
      const validExpenses = currentReport.expenses.filter(e => e.category && e.amount > 0);
      if (validExpenses.length === 0) {
        toast.error('⚠️ Adicione pelo menos uma despesa válida para finalizar o relatório');
        return;
      }
    }

    setIsSaving(true);
    const isUpdate = !!currentReport.id;

    // Validação do dias
    const days = calculateDays(currentReport.start_date, currentReport.end_date);
    if (days < 1) {
      toast.error('⚠️ Erro ao calcular a duração da viagem. Verifique as datas.');
      setIsSaving(false);
      return;
    }

    try {
      const validExpenses = getValidExpenses(currentReport.expenses);

      let reportNumber = currentReport.report_number;
      if (!isUpdate && (reportNumber.includes('XXX') || reportNumber.startsWith('R-'))) {
        reportNumber = await generateReportNumber(currentReport.client);
      }

      // SEMPRE recalcular todos os totais a partir das despesas para garantir precisão
      // Isto é crítico: mesmo se o relatório foi visualizado (não editado),
      // os totais serão sempre corretos quando finalizado
      const recalculatedTotals = calculateReportTotals(validExpenses);
      const totalAmount = recalculatedTotals.total_amount;

      const reportDataToSave = {
        report_number: reportNumber,
        client_id: currentReport.client_id || null,
        client: currentReport.client,
        aircraft_id: currentReport.aircraft_id || null,
        aircraft_registration: currentReport.aircraft_registration,
        crew_member_id: currentReport.crew_member_id || null,
        crew_member_name: currentReport.crew_member_name,
        crew_member_name_2: currentReport.crew_member_name_2 || null,
        route: currentReport.route,
        start_date: currentReport.start_date,
        end_date: currentReport.end_date,
        days_count: days,
        observations: currentReport.observations || null,
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
          .eq('id', currentReport.id)
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
      // Regras:
      // - Conciliação CLIENTE = total Share + total tripulantes (valor que o cliente deve reembolsar)
      // - Conciliação TRIPULANTE 1 = valor que tripulante 1 pagou (para reembolso)
      // - Conciliação TRIPULANTE 2 = valor que tripulante 2 pagou (para reembolso)
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
          if (totalClientOwes > 0 && currentReport.client_id) {
            const { data: existingClientPayment } = await supabase
              .from('bank_reconciliations')
              .select('id')
              .eq('reference_id', savedReport.id)
              .eq('type', 'cliente')
              .maybeSingle();

            if (!existingClientPayment) {
              reconciliationsToInsert.push({
                type: 'cliente',
                client_id: currentReport.client_id,
                aircraft_id: currentReport.aircraft_id || null,
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
          if (totalCrew1 > 0 && currentReport.crew_member_id) {
            // Buscar o user_id do crew_member para usar como receiver_id
            const { data: crewMember } = await supabase
              .from('crew_members')
              .select('user_id')
              .eq('id', currentReport.crew_member_id)
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
                aircraft_id: currentReport.aircraft_id || null,
                amount: totalCrew1,
                status: 'pendente',
                category: 'relatório_viagem',
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - REEMBOLSO TRIPULANTE 1 (${currentReport.crew_member_name.toUpperCase()})`,
                date: today,
                created_by: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          // 3. Criar conciliação para TRIPULANTE 2 (se houver)
          if (totalCrew2 > 0 && currentReport.crew_member_name_2) {
            // Buscar o crew_member pelo nome e depois pegar o user_id
            const { data: secondCrew } = await supabase
              .from('crew_members')
              .select('id, user_id')
              .eq('full_name', currentReport.crew_member_name_2)
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
                aircraft_id: currentReport.aircraft_id || null,
                amount: totalCrew2,
                status: 'pendente',
                category: 'relatório_viagem',
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - REEMBOLSO TRIPULANTE 2 (${currentReport.crew_member_name_2.toUpperCase()})`,
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
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <Button variant="outline" onClick={() => {
                if (draftStorage.hasDraft()) {
                  if (window.confirm('Deseja descartar as alterações não salvas?')) {
                    draftStorage.clearDraft();
                    setHasSavedDraft(false);
                    setIsCreating(false);
                  }
                } else {
                  setIsCreating(false);
                }
              }}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Histórico
              </Button>
              <h2 className="text-xl font-bold flex-1 text-center">{isEditing ? 'Editar Relatório' : 'Novo Relatório'}</h2>
              <div className="flex space-x-2">
                <Button
                  onClick={() => saveReport('Rascunho')}
                  disabled={isSaving}
                  variant="outline"
                  title="Salvar no banco de dados como rascunho"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Atualizar Rascunho' : 'Salvar Rascunho'}
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <Alert className="border-yellow-600/50 bg-yellow-950/50">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <AlertTitle className="text-yellow-500 font-semibold">Regras para Lançamento de Despesas:</AlertTitle>
                <AlertDescription className="text-yellow-100/80 mt-2 space-y-2">
                  <ul className="list-disc list-inside space-y-1">
                    <li>É obrigatório anexar o comprovante de pagamento (recibo ou nota fiscal) para cada despesa.</li>
                    <li>Cupons de crédito não são aceitos como comprovante de pagamento.</li>
                    <li>Não serão reembolsadas despesas com bebidas alcoólicas.</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>Informações da Viagem</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <AutocompleteInput
                        label={`Cliente * ${isLoadingClientes ? '⏳ Carregando...' : ''}`}
                        value={currentReport?.client || ''}
                        onChange={(value) => {
                          setCurrentReport(prev => prev ? { ...prev, client: value, client_id: '' } : null);
                          if (!isEditing) {
                            draftStorage.saveDraft({ ...currentReport, client: value, client_id: '' } as TravelReportDraft);
                          }
                        }}
                        options={clientes.map(c => ({
                          id: c.id,
                          label: c.company_name
                        }))}
                        placeholder="Digite o nome do cliente ou selecione"
                        isLoading={isLoadingClientes}
                        onSelect={(option) => {
                          const selectedClient = clientes.find(c => c.id === option.id);
                          if (selectedClient) {
                            const updated = { ...currentReport, client_id: option.id, client: selectedClient.company_name };
                            setCurrentReport(updated);
                            if (!isEditing) {
                              draftStorage.saveDraft(updated as TravelReportDraft);
                            }
                            generateReportNumber(selectedClient.company_name).then(newNumber => {
                              if (!isEditing) {
                                setCurrentReport(prev => prev ? { ...prev, report_number: newNumber } : null);
                              }
                            });
                          }
                        }}
                      />
                      {!currentReport?.client_id && currentReport?.client && (
                        <p className="text-xs text-yellow-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Entrada manual
                        </p>
                      )}
                      {currentReport?.client_id && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          ✓ Cliente selecionado
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <AutocompleteInput
                        label={`Aeronave * ${isLoadingAeronaves ? '⏳ Carregando...' : ''}`}
                        value={currentReport?.aircraft_registration || ''}
                        onChange={(value) => {
                          setCurrentReport(prev => prev ? { ...prev, aircraft_registration: value, aircraft_id: '' } : null);
                          if (!isEditing) {
                            draftStorage.saveDraft({ ...currentReport, aircraft_registration: value, aircraft_id: '' } as TravelReportDraft);
                          }
                        }}
                        options={aeronaves.map(a => ({
                          id: a.id,
                          label: `${a.registration} - ${a.model || ''}`
                        }))}
                        placeholder="Digite a matrícula ou selecione"
                        isLoading={isLoadingAeronaves}
                        onSelect={(option) => {
                          const selectedAircraft = aeronaves.find(a => a.id === option.id);
                          if (selectedAircraft) {
                            const updated = { ...currentReport, aircraft_id: option.id, aircraft_registration: selectedAircraft.registration };
                            setCurrentReport(updated);
                            if (!isEditing) {
                              draftStorage.saveDraft(updated as TravelReportDraft);
                            }
                          }
                        }}
                      />
                      {!currentReport?.aircraft_id && currentReport?.aircraft_registration && (
                        <p className="text-xs text-yellow-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Entrada manual
                        </p>
                      )}
                      {currentReport?.aircraft_id && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          ✓ Aeronave selecionada
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <AutocompleteInput
                        label={`Tripulante 1 * ${isLoadingTripulantes ? '⏳ Carregando...' : ''}`}
                        value={currentReport?.crew_member_name || ''}
                        onChange={(value) => {
                          setCurrentReport(prev => prev ? { ...prev, crew_member_name: value, crew_member_id: '' } : null);
                          if (!isEditing) {
                            draftStorage.saveDraft({ ...currentReport, crew_member_name: value, crew_member_id: '' } as TravelReportDraft);
                          }
                        }}
                        options={tripulantes.map(t => ({
                          id: t.id,
                          label: t.full_name
                        }))}
                        placeholder="Digite o nome ou selecione"
                        isLoading={isLoadingTripulantes}
                        onSelect={(option) => {
                          const selectedCrew = tripulantes.find(t => t.id === option.id);
                          if (selectedCrew) {
                            const updated = { ...currentReport, crew_member_id: option.id, crew_member_name: selectedCrew.full_name };
                            setCurrentReport(updated);
                            if (!isEditing) {
                              draftStorage.saveDraft(updated as TravelReportDraft);
                            }
                          }
                        }}
                      />
                      {!currentReport?.crew_member_id && currentReport?.crew_member_name && (
                        <p className="text-xs text-yellow-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Entrada manual
                        </p>
                      )}
                      {currentReport?.crew_member_id && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          ✓ Tripulante selecionado
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 flex items-end">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="showSecondCrew"
                          checked={showSecondCrew || !!currentReport?.crew_member_name_2}
                          onCheckedChange={(checked) => setShowSecondCrew(!!checked)}
                        />
                        <Label htmlFor="showSecondCrew" className="cursor-pointer">
                          Adicionar Segundo Tripulante
                        </Label>
                      </div>
                    </div>

                    {(showSecondCrew || currentReport?.crew_member_name_2) && (
                      <div className="space-y-2">
                        <AutocompleteInput
                          label="Tripulante 2"
                          value={currentReport?.crew_member_name_2 || ''}
                          onChange={(value) => handleInputChange('crew_member_name_2', value)}
                          options={tripulantes.map(t => ({
                            id: t.id,
                            label: t.full_name
                          }))}
                          placeholder="Digite o nome ou selecione"
                          isLoading={isLoadingTripulantes}
                          onSelect={(option) => {
                            const selectedCrew = tripulantes.find(t => t.id === option.id);
                            if (selectedCrew) {
                              handleInputChange('crew_member_name_2', selectedCrew.full_name);
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Digite manualmente ou selecione uma opção
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Trecho (Ex: SBPF-SBGR) *</Label>
                      <Input
                        value={currentReport?.route || ''}
                        onChange={(e) => handleInputChange('route', e.target.value)}
                        placeholder="Trecho"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Data Início *</Label>
                      <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                            {currentReport?.start_date
                              ? format(new Date(currentReport.start_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                              : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                          <CalendarComponent
                            mode="single"
                            selected={currentReport?.start_date ? new Date(currentReport.start_date + 'T00:00:00') : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const formattedDate = `${year}-${month}-${day}`;

                                handleInputChange('start_date', formattedDate);
                                if (currentReport?.end_date && new Date(formattedDate) > new Date(currentReport.end_date)) {
                                  handleInputChange('end_date', formattedDate);
                                }
                                setStartDateOpen(false);
                              }
                            }}
                            disabled={(date) => date > new Date()}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Data Fim *</Label>
                      <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                            {currentReport?.end_date
                              ? format(new Date(currentReport.end_date + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })
                              : "Selecione a data"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" side="bottom" sideOffset={4}>
                          <CalendarComponent
                            mode="single"
                            selected={currentReport?.end_date ? new Date(currentReport.end_date + 'T00:00:00') : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const formattedDate = `${year}-${month}-${day}`;

                                if (currentReport?.start_date && new Date(formattedDate) < new Date(currentReport.start_date)) {
                                  toast.error('A data final deve ser igual ou posterior à data inicial');
                                  return;
                                }

                                handleInputChange('end_date', formattedDate);
                                setEndDateOpen(false);
                              }
                            }}
                            disabled={(date) => date > new Date() || (currentReport?.start_date ? date < new Date(currentReport.start_date) : false)}
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {currentReport.start_date && currentReport.end_date && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-green-600 font-semibold mt-2 p-2 bg-green-50 rounded">
                          ✓ Duração da Viagem: <strong>{calculateDays(currentReport.start_date, currentReport.end_date)} dia(s)</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Observações</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={currentReport?.observations || ''}
                    onChange={(e) => handleInputChange('observations', e.target.value)}
                    className="h-32"
                    placeholder="Adicione observações importantes sobre a viagem ou despesas..."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Despesas da Viagem</CardTitle>
                  <Button onClick={addExpense} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Despesa
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentReport?.expenses?.map((expense, index) => (
                    <div key={expense.id || index} className="border p-4 rounded-lg shadow-sm relative">
                      <h3 className="text-md font-medium mb-3">Item de Despesa #{index + 1}</h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Categoria *</Label>
                          <ControlledSelect
                            value={expense.category}
                            onValueChange={(value) => handleExpenseChange(index, 'category', value)}
                            placeholder="Selecione"
                          >
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <ControlledSelectItem key={cat} value={cat}>
                                {cat}
                              </ControlledSelectItem>
                            ))}
                          </ControlledSelect>
                        </div>

                        <div className="space-y-2">
                          <Label>Valor (R$) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={expense.amount}
                            onChange={(e) => handleExpenseChange(index, 'amount', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Pago Por *</Label>
                          <ControlledSelect
                            value={expense.paid_by}
                            onValueChange={(value) => handleExpenseChange(index, 'paid_by', value)}
                            placeholder="Selecione"
                          >
                            <ControlledSelectItem value="Tripulante 1">
                              {currentReport?.crew_member_name ? `Tripulante 1 (${currentReport.crew_member_name})` : 'Tripulante 1'}
                            </ControlledSelectItem>
                            {(showSecondCrew || currentReport?.crew_member_name_2) && (
                              <ControlledSelectItem value="Tripulante 2">
                                {currentReport?.crew_member_name_2 ? `Tripulante 2 (${currentReport.crew_member_name_2})` : 'Tripulante 2'}
                              </ControlledSelectItem>
                            )}
                            <ControlledSelectItem value="Cliente">Cliente</ControlledSelectItem>
                            <ControlledSelectItem value="ShareBrasil">ShareBrasil</ControlledSelectItem>
                          </ControlledSelect>
                        </div>

                        <div className="space-y-2">
                          <Label>Comprovante</Label>
                          <div className="flex items-center space-x-2">
                            <label htmlFor={`receipt-upload-${index}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center space-x-2 px-3 py-2 border rounded-md hover:bg-accent transition-colors">
                                {uploadingIndex === index ? (
                                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                                ) : expense.receipt_url ? (
                                  <FileText className="h-5 w-5 text-green-600" />
                                ) : (
                                  <Upload className="h-5 w-5 text-muted-foreground" />
                                )}
                                <span className="text-sm truncate">
                                  {expense.receipt_url ? 'Comprovante Anexado' : 'Fazer Upload'}
                                </span>
                              </div>
                            </label>
                            <input
                              id={`receipt-upload-${index}`}
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => handleFileUpload(index, e.target.files?.[0])}
                              disabled={uploadingIndex !== null}
                            />
                            {expense.receipt_url && (
                              <a
                                href={expense.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-full hover:bg-accent"
                                title="Ver Comprovante"
                              >
                                <Eye className="h-5 w-5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <Label>Descrição Detalhada</Label>
                        <Input
                          value={expense.description}
                          onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                          placeholder="Breve descrição da despesa"
                        />
                      </div>

                      {currentReport.expenses.length > 0 && (
                        <button
                          onClick={() => removeExpense(index)}
                          className="absolute top-4 right-4 text-destructive hover:text-destructive/80 p-1 rounded-full"
                          title="Remover Despesa"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Button
                onClick={() => saveReport('Finalizado')}
                disabled={isSaving}
                title="Finalizar o relatório"
                className="w-full md:w-auto"
                size="lg"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSaving ? 'Salvando...' : 'FINALIZAR RELATORIO'}
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Por Pagador (R$)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                      <div className="flex justify-between text-sm">
                        <span>{currentReport.crew_member_name ? `Tripulante 1 (${currentReport.crew_member_name}):` : 'Tripulante 1:'}</span>
                        <span className="font-medium">R$ {(currentReport.total_crew1 || 0).toFixed(2)}</span>
                      </div>
                      {(showSecondCrew || currentReport.crew_member_name_2) && (
                        <div className="flex justify-between text-sm">
                          <span>{currentReport.crew_member_name_2 ? `Tripulante 2 (${currentReport.crew_member_name_2}):` : 'Tripulante 2:'}</span>
                          <span className="font-medium">R$ {(currentReport.total_crew2 || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span>Cliente:</span>
                        <span className="font-medium">R$ {currentReport.total_client.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>ShareBrasil:</span>
                        <span className="font-medium">R$ {currentReport.total_sharebrasil.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>TOTAL:</span>
                        <span className="text-green-600">R$ {currentReport.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Por Categoria (R$)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 p-3 border rounded-md bg-muted/50">
                      <div className="flex justify-between text-sm">
                        <span>Combustível:</span>
                        <span className="font-medium">R$ {currentReport.total_fuel.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Hospedagem:</span>
                        <span className="font-medium">R$ {currentReport.total_lodging.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Alimentação:</span>
                        <span className="font-medium">R$ {currentReport.total_food.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Transporte:</span>
                        <span className="font-medium">R$ {currentReport.total_transport.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Outros:</span>
                        <span className="font-medium">R$ {currentReport.total_other.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>TOTAL:</span>
                        <span className="text-green-600">R$ {currentReport.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
