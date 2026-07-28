// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, Trash2, Eye, FileText, Edit, AlertCircle,
  RotateCcw, FolderOpen, Send, Link as LinkIcon, Copy, CheckCircle2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { previewPDFForPrint, generatePDF } from '@/lib/travelReportPDF';
import type { TravelReport as PDFTravelReport, TravelExpense } from '@/lib/travelReportPDF';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PastasRelatorios } from '@/components/RelatorioDespesaViagem/PastasRelatorios';
import { SearchInput } from '@/components/RelatorioDespesaViagem/SearchInput';


// ---------------------------------------------------------------------------
// Tipo — espelha exatamente as colunas de travel_expense_reports
// ---------------------------------------------------------------------------
type TravelReport = {
  id?: string;
  numero_relatorio: string;

  // FKs
  clientes_id: string;
  socios_id?: string | null;
  aeronave_id: string;
  matricula_aeronave: string;         // coluna real: matricula_aeronave
  tripulacao_id: string;              // FK → tripulacao.id (crew 1)
  nome_tripulante: string;            // coluna real: nome_tripulante
  tripulante_id2?: string | null;     // FK → membros_tripulacao.id (crew 2)
  nome_tripulante_2?: string | null;  // coluna real: nome_tripulante_2

  rota: string;
  data_inicio: string;
  data_fim: string;
  dias_count: number;
  observacoes: string;

  // despesas salvas como JSON text na coluna `despesas`
  expenses: any[];

  // Totais — nomes exatos das colunas
  total_valor: number;
  total_combustivel: number;
  total_hospedagem: number;
  total_alimentacao: number;
  total_transporte: number;
  total_outros: number;
  total_tripulacao: number;
  total_trip: number;
  total_trip2: number;
  total_clientes: number;
  total_sharebrasil: number;

  status: 'Rascunho' | 'Ag. Conferência' | 'Enviado' | 'Assinado' | 'Finalizado';
  pdf_url?: string;
  pdf_path?: string;
  approval_token?: string;
  requires_client_approval?: boolean;
  crew_approval_status?: 'pending' | 'approved' | 'rejected';
  client_approval_status?: 'pending' | 'approved' | 'rejected';
  generated_by_user_id?: string;
  created_at?: string;
  updated_at?: string;
  criado_por?: string;

  // helper de exibição
  client?: string;
  criado_por_display?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const normalizeStatus = (status: string): TravelReport['status'] => {
  const valid: TravelReport['status'][] = ['Rascunho', 'Ag. Conferência', 'Enviado', 'Assinado', 'Finalizado'];
  return valid.includes(status as TravelReport['status'])
    ? (status as TravelReport['status'])
    : 'Rascunho';
};

const fmt = (val = 0) => `R$ ${val.toFixed(2).replace('.', ',')}`;

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { draftStorage } from '@/lib/travelReportDraft';
import type { TravelReportDraft } from '@/lib/travelReportDraft';
import {
  calculateReportTotals,
  type Expense,
  extractPayerTotals,
  getValidExpenses,
} from '@/lib/travelReportUtils';
import { PartnerSelectModal } from '@/components/diario/DiarioBordoDetalhes/components/PartnerSelectModal';
import { ReceiptViewer } from '@/components/dashboard/financeiro/recibos/ReceiptViewer';
import { TravelReportForm } from '@/components/RelatorioDespesaViagem/TravelReportForm';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function RelatorioViagem() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = (location.state as any) || {};

  const [activeTab, setActiveTab] = useState<'criar' | 'historico' | 'relatorios'>('relatorios');
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [reports, setReports] = useState<TravelReport[]>([]);
  const [currentReport, setCurrentReport] = useState<TravelReport | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackfillingPdf, setIsBackfillingPdf] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [clientPartners, setClientPartners] = useState<any[]>([]);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [receiptViewerUrl, setReceiptViewerUrl] = useState('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendReportTarget, setSendReportTarget] = useState<TravelReport | null>(null);
  const [sendDueDate, setSendDueDate] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [requireClientApproval, setRequireClientApproval] = useState(false);
  const [approvalLinkOpen, setApprovalLinkOpen] = useState(false);
  const [approvalLinkData, setApprovalLinkData] = useState<{ url: string; numero: string; tripulante: string; cliente?: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedReportIdToLoad, setSelectedReportIdToLoad] = useState<string | null>(
    navigationState.selectedReportId || null,
  );

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------
  useEffect(() => {
    loadReports();
    setHasSavedDraft(draftStorage.hasDraft());
  }, []);

  useEffect(() => {
    if (selectedReportIdToLoad && reports.length > 0) {
      const found = reports.find(r => r.id === selectedReportIdToLoad);
      if (found) {
        editReport(selectedReportIdToLoad);
        setSelectedReportIdToLoad(null);
      }
    }
  }, [selectedReportIdToLoad, reports]);

  useEffect(() => {
    if (!isCreating || !currentReport || isEditing) return;
    const interval = setInterval(() => {
      draftStorage.saveDraft(currentReport as unknown as TravelReportDraft);
    }, 30_000);
    return () => clearInterval(interval);
  }, [currentReport, isCreating, isEditing]);

  // -------------------------------------------------------------------------
  // Derived lists
  // -------------------------------------------------------------------------
  const reportsWithClient = useMemo(
    () => reports.filter(r => r.client?.trim() && (r.status === 'Finalizado' || r.status === 'Enviado')),
    [reports],
  );
  const reportsWithoutClient = useMemo(
    () => reports.filter(r => r.status === 'Rascunho'),
    [reports],
  );
  const filteredDraftReports = useMemo(() => {
    const searchLower = draftSearchQuery.toLowerCase();
    return reportsWithoutClient.filter((report) =>
      report.numero_relatorio.toLowerCase().includes(searchLower) ||
      report.matricula_aeronave.toLowerCase().includes(searchLower) ||
      report.data_inicio.includes(draftSearchQuery) ||
      report.data_fim.includes(draftSearchQuery) ||
      report.total_valor.toString().includes(draftSearchQuery) ||
      report.status.toLowerCase().includes(searchLower),
    );
  }, [reportsWithoutClient, draftSearchQuery]);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const loadReports = async () => {
    const { data, error } = await supabase
      .from('travel_expense_reports')
      .select(`*`)
      .order('created_at', { ascending: false });

    if (error) { toast.error('❌ Erro ao carregar relatórios'); return; }

    // Buscar nomes dos clientes separadamente
    const clientIds = new Set((data || []).map(r => r.clientes_id).filter(Boolean));
    const socioIds = new Set((data || []).map(r => r.socios_id).filter(Boolean));

    let clientMap: Record<string, string> = {};
    let socioMap: Record<string, string> = {};

    if (clientIds.size > 0) {
      const { data: clients } = await supabase
        .from('clientes')
        .select('id, razao_social')
        .in('id', Array.from(clientIds));

      if (clients) {
        clientMap = Object.fromEntries(clients.map(c => [c.id, c.razao_social]));
      }
    }

    if (socioIds.size > 0) {
      const { data: socios } = await supabase
        .from('socios')
        .select('id, nome')
        .in('id', Array.from(socioIds));

      if (socios) {
        socioMap = Object.fromEntries(socios.map(s => [s.id, s.nome]));
      }
    }

    const mapped = (data || []).map((r: any) => {
      const expenses = (() => {
        try { return typeof r.despesas === 'string' ? JSON.parse(r.despesas) : r.despesas || []; }
        catch { return []; }
      })();

      const clientName = r.socios_id && socioMap[r.socios_id]
        ? socioMap[r.socios_id]
        : clientMap[r.clientes_id] || '';

      return {
        ...r,
        client: clientName,
        expenses,
        status: normalizeStatus(r.status),
      } as TravelReport;
    });

    setReports(mapped);
  };

  const loadReportDetails = async (reportId: string): Promise<TravelReport> => {
    const { data, error } = await supabase
      .from('travel_expense_reports')
      .select(`*`)
      .eq('id', reportId)
      .single();

    if (error || !data) throw error;
    const r = data as any;

    const expenses = (() => {
      try { return typeof r.despesas === 'string' ? JSON.parse(r.despesas) : r.despesas || []; }
      catch { return []; }
    })();

    let clientName = '';

    if (r.socios_id) {
      const { data: socio } = await supabase
        .from('socios')
        .select('nome')
        .eq('id', r.socios_id)
        .single();
      if (socio) clientName = socio.nome;
    } else if (r.clientes_id) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('razao_social')
        .eq('id', r.clientes_id)
        .single();
      if (cliente) clientName = cliente.razao_social;
    }

    return {
      ...r,
      client: clientName,
      expenses: expenses as Expense[],
      status: normalizeStatus(r.status),
    } as TravelReport;
  };

  const buildPdfPayload = (report: any, clientName: string): PDFTravelReport => {
    const despesas = (() => {
      try { return typeof report.despesas === 'string' ? JSON.parse(report.despesas) : report.despesas || []; }
      catch { return []; }
    })();

    return {
      numero: report.numero_relatorio,
      cliente_nome: clientName,
      aeronave: report.matricula_aeronave || '',
      tripulante: report.nome_tripulante || '',
      tripulante2: report.nome_tripulante_2 || '',
      trecho: report.rota || '',
      destino: report.rota || '',
      data_inicio: report.data_inicio || new Date().toISOString().split('T')[0],
      data_fim: report.data_fim || new Date().toISOString().split('T')[0],
      observacoes: report.observacoes || '',
      despesas: (despesas || []).map((e: any) => ({
        categoria: e.category || e.categoria || '',
        descricao: e.description || e.descricao || '',
        valor: Number(e.amount ?? e.valor ?? 0),
        pago_por: e.paid_by || e.pago_por || '',
        data: e.expense_date || e.data || '',
        comprovante_url: e.receipt_url || e.comprovante_url || null,
      })) as TravelExpense[],
      total_combustivel: Number(report.total_combustivel || 0),
      total_hospedagem: Number(report.total_hospedagem || 0),
      total_alimentacao: Number(report.total_alimentacao || 0),
      total_transporte: Number(report.total_transporte || 0),
      total_outros: Number(report.total_outros || 0),
      total_tripulante: Number(report.total_tripulacao || 0),
      total_tripulante1: Number(report.total_trip || 0),
      total_tripulante2: Number(report.total_trip2 || 0),
      total_cliente: Number(report.total_clientes || 0),
      total_sharebrasil: Number(report.total_sharebrasil || 0),
      valor_total: Number(report.total_valor || 0),
    };
  };

  const getReportClientName = async (report: any) => {
    if (report.socios_id) {
      const { data: socio } = await supabase.from('socios').select('nome').eq('id', report.socios_id).single();
      return socio?.nome || 'Cliente';
    }
    if (report.clientes_id) {
      const { data: cliente } = await supabase.from('clientes').select('razao_social').eq('id', report.clientes_id).single();
      return cliente?.razao_social || 'Cliente';
    }
    return 'Cliente';
  };

  const ensureReportPdf = async (report: any) => {
    if (report.pdf_url) return null;

    const clientName = await getReportClientName(report);
    const pdfData = buildPdfPayload(report, clientName);
    const pdfBlob = await generatePDF(pdfData, clientName);

    const matriculaSafe = (report.matricula_aeronave || 'SEM-MATRICULA').replace(/[^A-Z0-9-]/gi, '');
    const numeroSafe = String(report.numero_relatorio || 'REL').replace(/[\/\s]/g, '-');
    const clientFolderPath = `${report.clientes_id}/.keep`;
    const pdfPath = `${report.clientes_id}/${matriculaSafe}/${numeroSafe}-${Date.now()}.pdf`;

    try {
      const emptyBlob = new Blob([''], { type: 'text/plain' });
      await supabase.storage.from('travel-reports').upload(clientFolderPath, emptyBlob, { upsert: true });
    } catch (folderErr) {
      console.warn('⚠️ Aviso ao criar pasta do cliente:', folderErr);
    }

    const { error: uploadErr } = await supabase.storage.from('travel-reports').upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: publicUrlData } = supabase.storage.from('travel-reports').getPublicUrl(pdfPath);
    if (!publicUrlData?.publicUrl) throw new Error('Não foi possível obter publicUrl do storage');

    const { error: updateError } = await supabase.from('travel_expense_reports').update({ pdf_url: publicUrlData.publicUrl, pdf_path: pdfPath }).eq('id', report.id);
    if (updateError) throw updateError;

    return report.id;
  };

  const backfillMissingPdf = async () => {
    setIsBackfillingPdf(true);
    try {
      const { data: reportsToFill, error } = await supabase
        .from('travel_expense_reports')
        .select('*')
        .or('pdf_url.is.null,pdf_url.eq.')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!reportsToFill || reportsToFill.length === 0) {
        toast.success('Nenhum relatório encontrado sem PDF.');
        return;
      }

      let filledCount = 0;
      let failedCount = 0;

      for (const report of reportsToFill) {
        try {
          await ensureReportPdf(report);
          filledCount += 1;
        } catch (error: any) {
          console.warn(`Falha ao preencher PDF para relatório ${report.numero_relatorio}:`, error);
          failedCount += 1;
        }
      }

      toast.success(`Backfill concluído: ${filledCount} relatório(s) atualizado(s), ${failedCount} falha(s).`);
      await loadReports();
    } catch (error: any) {
      console.error('Erro no backfill de PDFs:', error);
      toast.error(`Erro ao preencher PDFs ausentes: ${error?.message || 'verifique o console'}`);
    } finally {
      setIsBackfillingPdf(false);
    }
  };

  // -------------------------------------------------------------------------
  // Geração de número de relatório
  // -------------------------------------------------------------------------
  // Delegado ao utilitário (travelReportUtils) que agora considera a aeronave
  // Mantido este wrapper para compatibilidade com a página
  const generateReportNumber = async (clientName: string, aeronaveId?: string): Promise<string> => {
    const { generateReportNumber: generateNumber } = await import('@/lib/travelReportUtils');
    return generateNumber(clientName, aeronaveId);
  };

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------
  const createNewReport = () => {
    const newReport: TravelReport = {
      numero_relatorio: `REL-XXX-0001/${new Date().getFullYear().toString().slice(-2)}`,
      clientes_id: '',
      socios_id: null,
      aeronave_id: '',
      matricula_aeronave: '',
      tripulacao_id: '',
      nome_tripulante: '',
      tripulante_id2: null,
      nome_tripulante_2: null,
      rota: '',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date().toISOString().split('T')[0],
      dias_count: 1,
      observacoes: '',
      expenses: [{ category: '', description: '', amount: 0, paid_by: '' }],
      total_valor: 0,
      total_combustivel: 0,
      total_hospedagem: 0,
      total_alimentacao: 0,
      total_transporte: 0,
      total_outros: 0,
      total_tripulacao: 0,
      total_trip: 0,
      total_trip2: 0,
      total_clientes: 0,
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
      const details = await loadReportDetails(reportId);
      setCurrentReport(details);
      setIsCreating(true);
      setIsEditing(true);
      setActiveTab('criar');
    } catch {
      toast.error('❌ Não foi possível carregar os detalhes do relatório.');
    }
  };

  const deleteReport = async (reportId?: string) => {
    if (!reportId) return;
    
    // Verificar se é um rascunho
    const report = reports.find(r => r.id === reportId);
    if (!report) {
      toast.error('Relatório não encontrado');
      return;
    }

    // Apenas rascunhos podem ser deletados
    if (report.status !== 'Rascunho') {
      toast.error(
        '❌ Apenas relatórios em "Rascunho" podem ser deletados. Relatórios em qualquer outro status permanecem no histórico e não podem ser removidos.'
      );
      return;
    }

    if (!window.confirm('⚠ Tem certeza que deseja excluir este RASCUNHO? Esta ação não pode ser desfeita.')) return;
    
    try {
      const { error } = await supabase
        .from('travel_expense_reports')
        .delete()
        .eq('id', reportId)
        .eq('status', 'Rascunho'); // Segurança adicional: só deleta se for realmente rascunho
      
      if (error) throw error;
      toast.success('✓ Rascunho deletado com sucesso!');
      loadReports();
    } catch {
      toast.error('❌ Erro ao excluir o rascunho.');
    }
  };

  // -------------------------------------------------------------------------
  // PDF preview
  // -------------------------------------------------------------------------
  const handleViewPDF = async (reportId: string) => {
    try {
      const r = await loadReportDetails(reportId);
      const totals = calculateReportTotals(r.expenses || []);

      const pdfReport: PDFTravelReport = {
        numero: r.numero_relatorio,
        cliente_nome: r.client || '',
        aeronave: r.matricula_aeronave,
        tripulante: r.nome_tripulante,
        tripulante2: r.nome_tripulante_2 || '',
        trecho: r.rota,
        destino: r.rota,
        data_inicio: r.data_inicio,
        data_fim: r.data_fim,
        observacoes: r.observacoes,
        despesas: (r.expenses || []).map(e => ({
          categoria: e.category,
          descricao: e.description,
          valor: e.amount,
          pago_por: e.paid_by,
          data: e.expense_date || '',
          comprovante_url: e.receipt_url,
        })) as TravelExpense[],
        total_combustivel: totals.total_fuel,
        total_hospedagem: totals.total_lodging,
        total_alimentacao: totals.total_food,
        total_transporte: totals.total_transport,
        total_outros: totals.total_other,
        total_tripulante: totals.total_crew,
        total_tripulante1: totals.total_crew1,
        total_tripulante2: totals.total_crew2,
        total_cliente: totals.total_client,
        total_sharebrasil: totals.total_sharebrasil,
        valor_total: totals.total_amount,
      };

      let userName = 'Usuário';
      if (r.criado_por) {
        const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', r.criado_por).single();
        if (profile?.full_name) userName = profile.full_name;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', user.id).single();
          if (profile?.full_name) userName = profile.full_name;
        }
      }

      await previewPDFForPrint(pdfReport, userName);
    } catch (error) {
      console.error('Erro ao visualizar PDF:', error);
      toast.error('Erro ao visualizar relatório');
    }
  };

  // -------------------------------------------------------------------------
  // Save — payload alinhado com colunas reais do schema
  // -------------------------------------------------------------------------
  const saveReport = async (newStatus: TravelReport['status'], reportToSave?: TravelReport) => {
    const reportData = reportToSave || currentReport;
    if (!reportData) return;

    // Validação de campos obrigatórios
    if (!reportData.clientes_id?.trim()) {
      toast.error('⚠️ Selecione um cliente');
      return;
    }
    if (!reportData.aeronave_id?.trim()) {
      toast.error('⚠️ Selecione uma aeronave');
      return;
    }
    if (!reportData.matricula_aeronave?.trim()) {
      toast.error('⚠️ Matrícula da aeronave não preenchida');
      return;
    }
    if (!reportData.tripulacao_id?.trim()) {
      toast.error('⚠️ Selecione um tripulante');
      return;
    }

    if (isEditing && reportData.id) {
      const original = reports.find(r => r.id === reportData.id);
      if (original?.status !== 'Rascunho' && newStatus === 'Finalizado') {
        toast.error('⚠️ Não é possível finalizar relatórios que já foram finalizados.');
        return;
      }
    }

    setIsSaving(true);
    const isUpdate = !!reportData.id;

    try {
      const validExpenses = getValidExpenses(reportData.expenses);
      const totals = calculateReportTotals(validExpenses);

      let reportNumber = reportData.numero_relatorio;
      if (!isUpdate) {
        let clientCode = '';
        
        // Se tem sócio cliente, busca codigo_cliente da tabela socios
        if (reportData.socios_id) {
          const { data: partner } = await supabase
            .from('socios')
            .select('codigo_cliente')
            .eq('id', reportData.socios_id)
            .single();
          clientCode = partner?.codigo_cliente || '';
        }
        
        // Se não conseguiu do sócio, busca da tabela clientes
        if (!clientCode) {
          const { data: client } = await supabase
            .from('clientes')
            .select('codigo_cliente')
            .eq('id', reportData.clientes_id)
            .single();
          clientCode = client?.codigo_cliente || '';
        }
        
        reportNumber = await generateReportNumber(clientCode, reportData.matricula_aeronave);
      }

      const { data: { user } } = await supabase.auth.getUser();

      // FIX: payload usa exatamente os nomes de colunas do schema
      const payload: any = {
        numero_relatorio: reportNumber,
        clientes_id: reportData.clientes_id,
        socios_id: reportData.socios_id || null,
        aeronave_id: reportData.aeronave_id,
        matricula_aeronave: reportData.matricula_aeronave || null,
        tripulacao_id: reportData.tripulacao_id,
        nome_tripulante: reportData.nome_tripulante,
        tripulante_id2: reportData.tripulante_id2 || null,
        nome_tripulante_2: reportData.nome_tripulante_2 || null,
        rota: reportData.rota,
        data_inicio: reportData.data_inicio,
        data_fim: reportData.data_fim,
        dias_count: reportData.dias_count,
        observacoes: reportData.observacoes || null,
        // FIX: salvar como `despesas` (nome real da coluna)
        despesas: JSON.stringify(validExpenses),
        total_valor: totals.total_amount,
        total_combustivel: totals.total_fuel,
        total_hospedagem: totals.total_lodging,
        total_alimentacao: totals.total_food,
        total_transporte: totals.total_transport,
        total_outros: totals.total_other,
        total_tripulacao: totals.total_crew,
        total_trip: totals.total_crew1,
        total_trip2: totals.total_crew2,
        total_clientes: totals.total_client,
        total_sharebrasil: totals.total_sharebrasil,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Ao finalizar/enviar: marcar aprovação pendente do tripulante e (opcional) cliente
      if (newStatus === 'Finalizado' || newStatus === 'Enviado') {
        payload.crew_approval_status = 'pending';
        payload.requires_client_approval = !!requireClientApproval;
        if (requireClientApproval) payload.client_approval_status = 'pending';
        if (user?.id) payload.generated_by_user_id = user.id;
      }

      if (!isUpdate && user?.id) payload.criado_por = user.id;

      let savedReport: any;

      if (isUpdate) {
        const { data, error } = await supabase
          .from('travel_expense_reports')
          .update(payload)
          .eq('id', reportData.id)
          .select()
          .single();
        if (error) throw error;
        savedReport = data;
      } else {
        let insertError: any = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          const { data, error } = await supabase
            .from('travel_expense_reports')
            .insert([payload])
            .select()
            .single();

          if (!error) { savedReport = data; insertError = null; break; }

          if (error.code === '23505' && error.message?.includes('numero_relatorio')) {
            payload.numero_relatorio = await generateReportNumber(reportData.client || '', reportData.matricula_aeronave);
            await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
            insertError = error;
          } else {
            insertError = error; break;
          }
        }
        if (insertError) throw insertError;
      }

      // --- Attachments ---
      // FIX: usar nomes de colunas reais da tabela travel_report_attachments
      // colunas reais: nome_arquivo, caminho_arquivo, url_arquivo, tipo_arquivo, file_size
      try {
        if (isUpdate) {
          await supabase.from('travel_report_attachments').delete().eq('travel_report_id', savedReport.id);
        }

        const attachments = validExpenses
          .map((e, i) => {
            if (!e.receipt_url) return null;
            const parts = e.receipt_url.split('/');
            const fileName = parts[parts.length - 1] || 'comprovante';
            let fileType = 'application/octet-stream';
            if (e.receipt_url.includes('.pdf')) fileType = 'application/pdf';
            else if (/\.(jpe?g)/.test(e.receipt_url)) fileType = 'image/jpeg';
            else if (e.receipt_url.includes('.png')) fileType = 'image/png';
            else if (e.receipt_url.includes('.webp')) fileType = 'image/webp';
            return {
              travel_report_id: savedReport.id,
              expense_index: i,
              nome_arquivo: fileName,                    // FIX: era file_name
              caminho_arquivo: `receipts/${fileName}`,   // FIX: era file_path
              url_arquivo: e.receipt_url,                // FIX: era file_url
              tipo_arquivo: fileType,                    // FIX: era file_type
              file_size: null,
            } as any;
          })
          .filter(Boolean);

        if (attachments.length > 0) {
          const { error } = await supabase.from('travel_report_attachments').insert(attachments);
          if (error) console.error('❌ Erro ao salvar attachments:', error);
        }
      } catch (e) { console.error('❌ Erro ao processar attachments:', e); }

      // --- Conciliações + PDF (apenas ao finalizar) ---
      if ((newStatus === 'Finalizado' || newStatus === 'Enviado') && user) {
        const today = new Date().toISOString().split('T')[0];
        const payerTotals = extractPayerTotals(validExpenses);
        const { totalCrew1, totalCrew2, totalSharebrasil } = payerTotals;
        const totalClientOwes = totalSharebrasil + totalCrew1 + totalCrew2;
        const reconcToInsert: any[] = [];

        // Cliente
        if (totalClientOwes > 0 && reportData.clientes_id) {
          const { data: existing } = await supabase
            .from('conciliacoes_bancarias').select('id')
            .eq('descricao', `RELATORIO DE VIAGEM - ${savedReport.numero_relatorio} - A RECEBER DO CLIENTE`).maybeSingle();
          if (!existing) {
            reconcToInsert.push({
              tipo: 'cliente',
              clientes_id: reportData.clientes_id,
              socio_id: reportData.socios_id || null,
              aeronave_id: reportData.aeronave_id || null,
              valor: totalClientOwes,
              status: 'pendente',
              categoria: 'relatório_viagem',
              descricao: `RELATORIO DE VIAGEM - ${savedReport.numero_relatorio} - A RECEBER DO CLIENTE`,
              data: today,
              criado_por: user.id,
            });
          }
        }

        // Tripulante 1
        if (totalCrew1 > 0 && reportData.tripulacao_id) {
          const { data: existing } = await supabase
            .from('conciliacoes_bancarias').select('id')
            .ilike('descricao', '%TRIPULANTE 1%').eq('tipo', 'colaborador').maybeSingle();

          if (!existing) {
            reconcToInsert.push({
              tipo: 'colaborador',
              aeronave_id: reportData.aeronave_id || null,
              valor: totalCrew1,
              status: 'pendente',
              categoria: 'relatório_viagem',
              descricao: `RELATORIO DE VIAGEM - ${savedReport.numero_relatorio} - REEMBOLSO TRIPULANTE 1 (${reportData.nome_tripulante.toUpperCase()})`,
              data: today,
              criado_por: user.id,
            });
          }
        }

        // Tripulante 2
        if (totalCrew2 > 0 && reportData.nome_tripulante_2) {
          const { data: existing } = await supabase
            .from('conciliacoes_bancarias').select('id')
            .ilike('descricao', '%TRIPULANTE 2%').eq('tipo', 'colaborador').maybeSingle();

          if (!existing) {
            reconcToInsert.push({
              tipo: 'colaborador',
              aeronave_id: reportData.aeronave_id || null,
              valor: totalCrew2,
              status: 'pendente',
              categoria: 'relatório_viagem',
              descricao: `RELATORIO DE VIAGEM - ${savedReport.numero_relatorio} - REEMBOLSO TRIPULANTE 2 (${reportData.nome_tripulante_2.toUpperCase()})`,
              data: today,
              criado_por: user.id,
            });
          }
        }

        if (reconcToInsert.length > 0) {
          const { error } = await supabase.from('conciliacoes_bancarias').insert(reconcToInsert);
          if (error) console.error('Erro ao registrar conciliações:', error);
        }

        // --- Sincronização financeira: contas_areceber + contas_apagar + movimentacoes ---
        try {
          const { syncTravelReportToFinance } = await import('@/lib/travelReportFinanceSync');
          const syncResult = await syncTravelReportToFinance({
            reportId: savedReport.id,
            numeroRelatorio: savedReport.numero_relatorio,
            clientesId: reportData.clientes_id!,
            clienteNome: reportData.client || '',
            clienteCnpj: (reportData as any).cliente_cnpj || null,
            aeronaveId: reportData.aeronave_id || null,
            matriculaAeronave: reportData.matricula_aeronave || null,
            tripulacaoId: reportData.tripulacao_id || null,
            nomeTripulante: reportData.nome_tripulante || null,
            tripulanteId2: reportData.tripulante_id2 || null,
            nomeTripulante2: reportData.nome_tripulante_2 || null,
            totalCrew1,
            totalCrew2,
            totalSharebrasil,
            dataReferencia: today,
            prazoVencimentoDias: 30,
            userId: user.id,
          });
          if (syncResult.errors.length) {
            console.warn('⚠️ Sync financeiro com avisos:', syncResult.errors);
            toast.warning(`Sync financeiro: ${syncResult.errors.length} aviso(s) — verifique o console`);
          } else {
            const partes = [
              syncResult.contasAreceberCriado ? '1 conta a receber' : null,
              syncResult.contasApagarCriadas ? `${syncResult.contasApagarCriadas} conta(s) a pagar` : null,
              syncResult.movimentacoesCriadas ? `${syncResult.movimentacoesCriadas} movimentação(ões)` : null,
            ].filter(Boolean).join(', ');
            if (partes) toast.success(`✓ Financeiro sincronizado: ${partes}`);
          }
        } catch (syncErr: any) {
          console.error('❌ Erro na sincronização financeira:', syncErr);
          toast.error(`Erro ao sincronizar com financeiro: ${syncErr?.message || 'tente novamente'}`);
        }

        // Gerar PDF
        try {
          let pdfUserName = 'Usuário';
          const { data: creatorProfile } = await supabase
            .from('user_profiles').select('full_name').eq('id', user.id).single();
          if (creatorProfile?.full_name) pdfUserName = creatorProfile.full_name;

          const pdfData: PDFTravelReport = {
            numero: savedReport.numero_relatorio,
            cliente_nome: reportData.client || '',
            aeronave: reportData.matricula_aeronave,
            tripulante: reportData.nome_tripulante,
            tripulante2: reportData.nome_tripulante_2 || '',
            trecho: reportData.rota,
            destino: reportData.rota,
            data_inicio: reportData.data_inicio,
            data_fim: reportData.data_fim,
            observacoes: reportData.observacoes,
            despesas: validExpenses.map(e => ({
              categoria: e.category,
              descricao: e.description,
              valor: e.amount,
              pago_por: e.paid_by,
              data: e.expense_date || '',
              comprovante_url: e.receipt_url,
            })) as TravelExpense[],
            total_combustivel: totals.total_fuel,
            total_hospedagem: totals.total_lodging,
            total_alimentacao: totals.total_food,
            total_transporte: totals.total_transport,
            total_outros: totals.total_other,
            total_tripulante: totals.total_crew,
            total_tripulante1: totals.total_crew1,
            total_tripulante2: totals.total_crew2,
            total_cliente: totals.total_client,
            total_sharebrasil: totals.total_sharebrasil,
            valor_total: totals.total_amount,
          };

          const { generatePDF } = await import('@/lib/travelReportPDF');
          const pdfBlob = await generatePDF(pdfData, pdfUserName);

          // Estrutura: {cliente_id}/{matricula}/{numero}.pdf
          const matriculaSafe = (reportData.matricula_aeronave || 'SEM-MATRICULA').replace(/[^A-Z0-9-]/gi, '');
          const numeroSafe = savedReport.numero_relatorio.replace(/[\/\s]/g, '-');
          const clientFolderPath = `${reportData.clientes_id}/.keep`;
          const pdfPath = `${reportData.clientes_id}/${matriculaSafe}/${numeroSafe}-${Date.now()}.pdf`;

          // IMPORTANTE: Criar a pasta do cliente primeiro (se não existir)
          // Isso garante que a estrutura de diretórios existe para subpastas por aeronave
          try {
            const emptyBlob = new Blob([''], { type: 'text/plain' });
            await supabase.storage
              .from('travel-reports')
              .upload(clientFolderPath, emptyBlob, { upsert: true });
            console.log('✓ Pasta do cliente garantida');
          } catch (folderErr) {
            console.warn('⚠️ Aviso ao criar pasta do cliente:', folderErr);
            // Não falha o processo - continua mesmo se falhar a criação
          }

          // Agora fazer upload do PDF
          const { error: uploadErr } = await supabase.storage
            .from('travel-reports')
            .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });

          if (uploadErr) {
            throw new Error(`Erro ao salvar PDF no storage: ${uploadErr.message}`);
          }

          const { data: { publicUrl } } = supabase.storage.from('travel-reports').getPublicUrl(pdfPath);
          await supabase.from('travel_expense_reports').update({
            pdf_url: publicUrl,
            pdf_path: pdfPath,
          } as any).eq('id', savedReport.id);
          savedReport.pdf_path = pdfPath;

          toast.success('✓ PDF gerado e salvo com sucesso');
        } catch (pdfErr: any) {
          console.error('❌ Erro ao gerar/salvar PDF:', pdfErr);
          toast.error(`❌ Erro ao gerar PDF: ${pdfErr?.message || 'Tente novamente'}`);
          // Não retornar - deixar o relatório ser criado mesmo sem PDF
        }

        // Mostrar dialog com link de aprovação (token gerado pelo banco)
        try {
          const { data: refreshed } = await supabase
            .from('travel_expense_reports')
            .select('approval_token, numero_relatorio, nome_tripulante, tripulacao_id')
            .eq('id', savedReport.id)
            .single();
          if (refreshed?.approval_token) {
            const approvalUrl = `${window.location.origin}/#/aprovar-relatorio/${refreshed.approval_token}`;
            setApprovalLinkData({
              url: approvalUrl,
              numero: refreshed.numero_relatorio,
              tripulante: refreshed.nome_tripulante,
              cliente: requireClientApproval ? reportData.client : undefined,
            });
            setApprovalLinkOpen(true);

            // Enviar notificação para o tripulante
            if (refreshed.tripulacao_id) {
              try {
                // Buscar user_id do membro da tripulação
                const { data: crewMember } = await supabase
                  .from('membros_tripulacao')
                  .select('user_id')
                  .eq('id', refreshed.tripulacao_id)
                  .single();

                if (crewMember?.user_id) {
                  const { error: notifError } = await supabase.from('notifications').insert({
                    user_id: crewMember.user_id,
                    title: 'Novo Relatório de Viagem para Aprovação',
                    message: `O relatório nº ${refreshed.numero_relatorio} foi gerado e aguarda sua aprovação. Clique para revisar.`,
                    type: 'info',
                    read: false,
                  });
                  if (notifError) console.error('Erro ao enviar notificação:', notifError);
                }
              } catch (notifErr) {
                console.error('Erro ao enviar notificação:', notifErr);
              }
            }
          }
        } catch (e) {
          console.warn('Não foi possível obter token de aprovação', e);
        }
      }

      const label = newStatus === 'Finalizado' ? 'finalizado' : newStatus === 'Enviado' ? 'enviado' : 'salvo como rascunho';
      const steps = [`Relatório ${label} com sucesso`];
      if (newStatus === 'Finalizado' || newStatus === 'Enviado') {
        steps.push('Conciliações financeiras registradas', 'PDF gerado');
      }
      toast.success(`✅ ${steps.join(' · ')}`);
      draftStorage.clearDraft();
      setHasSavedDraft(false);

      if (newStatus === 'Finalizado' || newStatus === 'Enviado') {
        setIsCreating(false);
        setCurrentReport(null);
        setActiveTab('relatorios');
      } else if (!isUpdate && savedReport?.id) {
        setCurrentReport(prev => prev ? { ...prev, id: savedReport.id } : null);
      } else {
        setIsCreating(false);
        setCurrentReport(null);
      }

      loadReports();
    } catch (error: any) {
      console.error('Erro ao salvar relatório:', error);
      toast.error(`❌ Erro ao salvar: ${error.message}${error.details ? ` - ${error.details}` : ''}`);
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Envio ao Cliente
  // -------------------------------------------------------------------------
  const handleSendReport = async () => {
    if (!sendReportTarget?.id || !sendDueDate) {
      toast.error('Informe o prazo de vencimento');
      return;
    }
    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // 1. Atualizar status do relatório para "Enviado"
      const { error: reportError } = await supabase
        .from('travel_expense_reports')
        .update({ status: 'Enviado', updated_at: new Date().toISOString() })
        .eq('id', sendReportTarget.id);
      if (reportError) throw reportError;

      // 2. Inserir/Atualizar registro em conciliacoes_bancarias
      const reconciliationData = {
        tipo: 'cliente',
        data: new Date().toISOString().split('T')[0],
        descricao: `Relatório de Viagem ${sendReportTarget.numero_relatorio}`,
        valor: sendReportTarget.total_valor || 0,
        status: 'enviado',
        clientes_id: sendReportTarget.clientes_id,
        aeronave_id: sendReportTarget.aeronave_id,
        prazo_pagamento: sendDueDate,
        tipo_referencia: 'travel_expense_report',
        referencia_id: sendReportTarget.id,
        tipo_documento: 'despesa_viagem',
        criado_por: user.id,
        criado_em: new Date().toISOString(),
      };

      const { error: reconcError } = await supabase
        .from('conciliacoes_bancarias')
        .insert([reconciliationData]);
      if (reconcError) throw reconcError;

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

  // -------------------------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------------------------
  const statusBadgeColors: Record<TravelReport['status'], string> = {
    Rascunho: 'bg-amber-100/80 text-amber-800 ring-amber-200',
    Finalizado: 'bg-blue-100/80 text-blue-800 ring-blue-200',
    Enviado: 'bg-green-100/80 text-green-800 ring-green-200',
  };
  const statusBorderColors: Record<TravelReport['status'], string> = {
    Rascunho: 'border-l-4 border-l-amber-400',
    Finalizado: 'border-l-4 border-l-blue-400',
    Enviado: 'border-l-4 border-l-green-400',
  };

  const renderReportCard = (report: TravelReport) => (
    <div
      key={report.id}
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 hover:border-border group',
        statusBorderColors[report.status],
      )}
    >
      <div className="mb-3 sm:mb-0 min-w-[240px] flex-1">
        <div className="flex items-start gap-3 mb-2">
          <FileText className="h-5 w-5 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-foreground text-base">{report.numero_relatorio}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('inline-block text-xs font-bold px-3 py-1 rounded-full ring-1', statusBadgeColors[report.status])}>
                {report.status}
              </span>
              {report.status === 'Finalizado' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    setSendReportTarget(report);
                    setSendDueDate('');
                    setSendDialogOpen(true);
                  }}
                  className="h-6 px-2 text-xs gap-1 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Send className="h-3 w-3" /> Enviar
                </Button>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-medium">
          {report.client}
          <span className="text-xs text-muted-foreground/70 ml-1">({report.matricula_aeronave})</span>
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {format(parseISO(report.data_inicio), 'dd MMM', { locale: ptBR })} a{' '}
          {format(parseISO(report.data_fim), 'dd MMM yyyy', { locale: ptBR })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
        <div className="text-right">
          <p className="text-xs text-muted-foreground/70 font-medium">Total</p>
          <p className="font-bold text-lg text-green-600 font-mono">{fmt(report.total_valor)}</p>
        </div>
        <div className="flex gap-1 ml-auto sm:ml-0">
          {report.status === 'Rascunho' && (
            <Button
              variant="ghost" size="sm"
              onClick={() => editReport(report.id!)}
              title="Editar Relatório"
              className="rounded-lg hover:bg-primary/10 hover:text-primary"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost" size="sm"
            onClick={() => handleViewPDF(report.id!)}
            title="Visualizar PDF"
            className="rounded-lg hover:bg-primary/10 hover:text-primary"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => deleteReport(report.id)}
            title="Excluir Relatório"
            className="rounded-lg hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Layout>
      <div className="p-6 space-y-6">
        {!isCreating ? (
          <>
            {/* Banner de rascunho salvo */}
            {hasSavedDraft && (
              <Card className="border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-100/50">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-bold text-amber-900 text-base">Rascunho salvo automaticamente</h3>
                        <p className="text-sm text-amber-700/80 mt-1">
                          Você tem um relatório anterior em rascunho. Deseja continuar editando?
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { draftStorage.clearDraft(); setHasSavedDraft(false); toast.info('Rascunho descartado'); }}
                        className="text-amber-600 hover:bg-amber-100/50 rounded-lg"
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
                            toast.success('✓ Rascunho restaurado!');
                          }
                        }}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" /> Restaurar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-md rounded-xl border-border/50">
              <CardHeader className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <CardTitle className="text-2xl font-bold">Relatório de Despesa de Viagem</CardTitle>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 border-b border-border">
                  {(['criar', 'historico', 'relatorios'] as const).map(tab => {
                    const labels: Record<typeof tab, { icon: React.ReactNode; label: string }> = {
                      criar: { icon: <Plus className="h-4 w-4 mr-2" />, label: 'Criar Novo' },
                      historico: { icon: <FileText className="h-4 w-4 mr-2" />, label: `Rascunhos (${reportsWithoutClient.length})` },
                      relatorios: { icon: <FolderOpen className="h-4 w-4 mr-2" />, label: `Relatórios Finalizados (${reportsWithClient.length})` },
                    };
                    return (
                      <Button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        variant={activeTab === tab ? 'default' : 'ghost'}
                        className={cn(
                          'px-4 py-2 rounded-none border-b-2 font-medium transition-all',
                          activeTab === tab
                            ? 'border-b-primary text-primary bg-primary/5'
                            : 'border-b-transparent text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {labels[tab].icon}{labels[tab].label}
                      </Button>
                    );
                  })}
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {/* Criar */}
                {activeTab === 'criar' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Criar Novo Relatório</h3>
                    <p className="text-muted-foreground mb-6">Preencha os dados do relatório de despesa de viagem abaixo.</p>
                    <Button
                      onClick={createNewReport}
                      className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 text-white rounded-lg"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Iniciar Novo Relatório
                    </Button>
                  </div>
                )}

                {/* Rascunhos */}
                {activeTab === 'historico' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Rascunhos</h3>
                    <div className="flex justify-center mb-6">
                      <SearchInput
                        value={draftSearchQuery}
                        onChange={setDraftSearchQuery}
                        placeholder="Buscar rascunhos por número, data ou valor..."
                      />
                    </div>
                    {filteredDraftReports.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-muted-foreground font-medium">Nenhum rascunho encontrado</p>
                        <p className="text-muted-foreground text-sm">Tente outro termo de busca</p>
                      </div>
                    ) : (
                      <div className="space-y-3">{filteredDraftReports.map(renderReportCard)}</div>
                    )}
                  </div>
                )}

                {/* Finalizados — pastas por cliente */}
                {activeTab === 'relatorios' && (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <h3 className="text-lg font-semibold">Pastas de Clientes</h3>
                      
                    </div>
                    {reportsWithClient.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-muted-foreground font-medium">Nenhum relatório finalizado</p>
                        <p className="text-muted-foreground text-sm">Finalize um rascunho para vê-lo aqui</p>
                      </div>
                    ) : (
                      <PastasRelatorios
                        reports={reportsWithClient.map(r => ({
                          id: r.id,
                          report_number: r.numero_relatorio,
                          client: r.client || 'Sem Cliente',
                          aircraft_registration: r.matricula_aeronave,
                          start_date: r.data_inicio,
                          end_date: r.data_fim,
                          total_amount: r.total_valor,
                          status: r.status,
                          clientes_id: r.clientes_id,
                          criado_por: r.criado_por,
                          numero_relatorio_modificado_por: r.criado_por,
                          numero_relatorio_modificado_em: r.updated_at,
                          crew_approval_status: (r as any).crew_approval_status ?? null,
                        }))}
                        onView={handleViewPDF}
                        onEdit={editReport}
                        onDelete={deleteReport}
                        onSend={async (report, type) => {
                          const fullReport = reportsWithClient.find(r => r.id === report.id);
                          if (!fullReport) return;

                          // Enviar ao Tripulante: gera link de assinatura
                          if (type === 'conferencia') {
                            try {
                              const { data: refreshed } = await supabase
                                .from('travel_expense_reports')
                                .select('approval_token, numero_relatorio, nome_tripulante, tripulacao_id')
                                .eq('id', fullReport.id)
                                .single();
                              if (refreshed?.approval_token) {
                                const approvalUrl = `${window.location.origin}/#/aprovar-relatorio/${refreshed.approval_token}`;
                                setApprovalLinkData({
                                  url: approvalUrl,
                                  numero: refreshed.numero_relatorio,
                                  tripulante: refreshed.nome_tripulante,
                                });
                                setApprovalLinkOpen(true);
                                toast.success('✓ Link de assinatura gerado!');
                              }
                            } catch (err) {
                              console.error('Erro ao gerar link:', err);
                              toast.error('Erro ao gerar link de assinatura');
                            }
                          }
                          // Enviar ao Cliente: abre dialog com prazo de vencimento
                          else if (type === 'cliente') {
                            setSendReportTarget(fullReport);
                            setSendDueDate('');
                            setSendDialogOpen(true);
                          }
                        }}
                        onEditReportNumber={async (reportId, newNumber) => {
                          try {
                            const { error } = await supabase
                              .from('travel_expense_reports')
                              .update({
                                numero_relatorio: newNumber,
                                updated_at: new Date().toISOString(),
                              })
                              .eq('id', reportId);

                            if (error) throw error;

                            toast.success('Número do relatório atualizado com sucesso!');
                            // Recarregar os relatórios
                            await loadReports();
                          } catch (err) {
                            console.error('Erro ao atualizar número:', err);
                            toast.error('Erro ao atualizar número do relatório');
                          }
                        }}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : currentReport && (
          <>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="require-client" className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Exigir aprovação do cliente
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Quando ativo, o cliente também receberá um link para aprovar o relatório (login no portal do cliente).
                  </p>
                </div>
                <Switch
                  id="require-client"
                  checked={requireClientApproval}
                  onCheckedChange={setRequireClientApproval}
                />
              </CardContent>
            </Card>
            <TravelReportForm
              report={currentReport}
              onSave={async (report, status) => {
                const toSave = { ...report, id: report.id || undefined };
                setCurrentReport(toSave);
                await saveReport(status, toSave);
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
              onAutoSave={report => { if (!isEditing) draftStorage.saveDraft(report); }}
              showPartnerModal={() => setShowPartnerModal(true)}
              onReceiptView={url => { setReceiptViewerUrl(url); setReceiptViewerOpen(true); }}
            />
          </>
        )}
      </div>

      {/* Modal de sócio */}
      <PartnerSelectModal
        open={showPartnerModal}
        onOpenChange={setShowPartnerModal}
        clientName={currentReport?.client || ''}
        partners={clientPartners}
        selectedPartner={currentReport?.client || null}
        onSelectPartner={partnerName => {
          const partner = clientPartners.find(p => p.nome === partnerName);
          if (partner) {
            setCurrentReport(prev => prev
              ? { ...prev, socios_id: partner.id, client: partner.nome }
              : null,
            );
            if (currentReport && !isEditing) {
              draftStorage.saveDraft({
                ...currentReport,
                socios_id: partner.id,
                client: partner.nome,
              } as unknown as TravelReportDraft);
            }
          }
        }}
      />

      {/* Visualizador de comprovante */}
      <ReceiptViewer
        open={receiptViewerOpen}
        onOpenChange={setReceiptViewerOpen}
        url={receiptViewerUrl}
        title="Comprovante Anexado"
      />

      {/* Dialog de envio ao cliente */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md bg-slate-900 border border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Send className="h-5 w-5 text-cyan-400" />
              Enviar Relatório ao Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="rounded-lg bg-slate-800/50 p-4 border border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Relatório</p>
              <p className="font-mono font-semibold text-white text-lg">{sendReportTarget?.numero_relatorio}</p>
              <p className="text-xs text-slate-400 mt-1">{sendReportTarget?.client}</p>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2">
                Total: <span className="font-bold text-white text-base">{fmt(sendReportTarget?.total_valor)}</span>
              </p>
            </div>

            <div>
              <Label htmlFor="due-date" className="text-slate-300 text-sm font-medium">Prazo de Vencimento</Label>
              <Input
                id="due-date"
                type="date"
                value={sendDueDate}
                onChange={e => setSendDueDate(e.target.value)}
                className="mt-2 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendReport}
              disabled={!sendDueDate || isSending}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white gap-2 font-medium"
            >
              {isSending ? 'Enviando...' : <><Send className="h-4 w-4" /> Enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog do link de aprovação */}
      <Dialog open={approvalLinkOpen} onOpenChange={setApprovalLinkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-primary" />
              Link de aprovação gerado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-semibold">{approvalLinkData?.numero}</p>
              <p className="text-muted-foreground text-xs mt-1">
                Tripulante: <strong>{approvalLinkData?.tripulante}</strong>
                {approvalLinkData?.cliente && <> · Cliente: <strong>{approvalLinkData.cliente}</strong></>}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Link para aprovação</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={approvalLinkData?.url || ''} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  onClick={() => {
                    if (approvalLinkData?.url) {
                      navigator.clipboard.writeText(approvalLinkData.url);
                      setLinkCopied(true);
                      toast.success('Link copiado!');
                      setTimeout(() => setLinkCopied(false), 2500);
                    }
                  }}
                  className="gap-1 shrink-0"
                >
                  {linkCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {linkCopied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                O tripulante também encontrará este relatório em <strong>Meu Perfil → Aprovações Pendentes</strong>.
                {approvalLinkData?.cliente && <> O cliente verá no portal dele.</>}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setApprovalLinkOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}