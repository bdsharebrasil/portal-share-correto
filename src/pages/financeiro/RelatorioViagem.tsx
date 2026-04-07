import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Plus, Trash2, Eye, FileText, Edit, AlertCircle,
  RotateCcw, FolderOpen, Send,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { previewPDFForPrint } from '@/lib/travelReportPDF';
import type { TravelReport as PDFTravelReport, TravelExpense } from '@/lib/travelReportPDF';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------
// Tipo — espelha exatamente as colunas de travel_expense_reports
// ---------------------------------------------------------------------------
type TravelReport = {
  id?: string;
  numero_relatorio: string;

  // FKs
  clientes_id: string;
  socios_cliente_id?: string | null;
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

  status: 'Rascunho' | 'Finalizado' | 'Enviado';
  url_pdf?: string;
  created_at?: string;
  updated_at?: string;
  criado_por?: string;

  // helper de exibição
  client?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const normalizeStatus = (status: string): TravelReport['status'] => {
  const valid: TravelReport['status'][] = ['Rascunho', 'Finalizado', 'Enviado'];
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
import { PartnerSelectModal } from '@/components/diario/PartnerSelectModal';
import { ReceiptViewer } from '@/components/financeiro/ReceiptViewer';
import { TravelReportForm } from '@/components/travel/TravelReportForm';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const loadReports = async () => {
    const { data, error } = await supabase
      .from('travel_expense_reports')
      .select(`
        *,
        clientes_id_rel:clientes_id(razao_social),
        partner_id_rel:socios_cliente_id(nome)
      `)
      .order('created_at', { ascending: false });

    if (error) { toast.error('❌ Erro ao carregar relatórios'); return; }

    const mapped = (data || []).map((r: any) => {
      // FIX: coluna no banco é `despesas`, não `expenses`
      const expenses = (() => {
        try { return typeof r.despesas === 'string' ? JSON.parse(r.despesas) : r.despesas || []; }
        catch { return []; }
      })();

      const clientName = r.socios_cliente_id && r.partner_id_rel?.nome
        ? r.partner_id_rel.nome
        : r.clientes_id_rel?.razao_social || '';

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
      .select(`
        *,
        clientes_id_rel:clientes_id(razao_social),
        partner_id_rel:socios_cliente_id(nome)
      `)
      .eq('id', reportId)
      .single();

    if (error || !data) throw error;
    const r = data as any;

    // FIX: coluna no banco é `despesas`
    const expenses = (() => {
      try { return typeof r.despesas === 'string' ? JSON.parse(r.despesas) : r.despesas || []; }
      catch { return []; }
    })();

    const clientName = r.socios_cliente_id && r.partner_id_rel?.nome
      ? r.partner_id_rel.nome
      : r.clientes_id_rel?.razao_social || '';

    return {
      ...r,
      client: clientName,
      expenses: expenses as Expense[],
      status: normalizeStatus(r.status),
    } as TravelReport;
  };

  // -------------------------------------------------------------------------
  // Geração de número de relatório
  // -------------------------------------------------------------------------
  const generateReportNumber = async (clientName: string): Promise<string> => {
    if (!clientName?.trim()) {
      return `REL-XXX-0001/${new Date().getFullYear().toString().slice(-2)}`;
    }

    const yearShort = new Date().getFullYear().toString().slice(-2);
    const initials = clientName
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .substring(0, 3)
      .padEnd(3, 'X');

    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await supabase
        .from('travel_expense_reports')
        .select('numero_relatorio')
        .ilike('numero_relatorio', `REL-${initials}%`)
        .order('numero_relatorio', { ascending: false });

      let maxNum = 0;
      for (const rep of existing || []) {
        const m = rep.numero_relatorio.match(/REL-[A-Z]{3}-(\d+)\/\d{2}/);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
      }

      const candidate = `REL-${initials}-${String(maxNum + 1).padStart(3, '0')}/${yearShort}`;
      const { data: exists } = await supabase
        .from('travel_expense_reports')
        .select('id')
        .eq('numero_relatorio', candidate)
        .maybeSingle();

      if (!exists) return candidate;
      await new Promise(r => setTimeout(r, 50));
    }

    return `REL-${initials}-${Date.now().toString().slice(-3)}/${yearShort}`;
  };

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------
  const createNewReport = () => {
    const newReport: TravelReport = {
      numero_relatorio: `REL-XXX-0001/${new Date().getFullYear().toString().slice(-2)}`,
      clientes_id: '',
      socios_cliente_id: null,
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
    if (!reportId || !window.confirm('⚠ Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('travel_expense_reports').delete().eq('id', reportId);
      if (error) throw error;
      toast.success('✓ Relatório excluído com sucesso!');
      loadReports();
    } catch {
      toast.error('❌ Erro ao excluir o relatório.');
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
        reportNumber = await generateReportNumber(reportData.client || '');
      }

      const { data: { user } } = await supabase.auth.getUser();

      // FIX: payload usa exatamente os nomes de colunas do schema
      const payload: any = {
        numero_relatorio: reportNumber,
        clientes_id: reportData.clientes_id,
        socios_cliente_id: reportData.socios_cliente_id || null,
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
            payload.numero_relatorio = await generateReportNumber(reportData.client || '');
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
              socio_cliente_id: reportData.socios_cliente_id || null,
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
          const pdfPath = `reports/${savedReport.numero_relatorio.replace(/\//g, '-')}-${Date.now()}.pdf`;

          const { error: uploadErr } = await supabase.storage
            .from('travel-reports')
            .upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });

          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage.from('travel-reports').getPublicUrl(pdfPath);
            await supabase.from('travel_expense_reports').update({ url_pdf: publicUrl }).eq('id', savedReport.id);
            navigator.clipboard.writeText(publicUrl).catch(() => {});
          }
        } catch (pdfErr: any) {
          console.error('Erro ao gerar PDF:', pdfErr);
          toast.warning(`⚠️ Erro ao gerar PDF: ${pdfErr?.message || 'Tente novamente'}`);
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
  // Envio
  // -------------------------------------------------------------------------
  const handleSendReport = async () => {
    if (!sendReportTarget?.id || !sendDueDate) {
      toast.error('Informe o prazo de vencimento');
      return;
    }
    setIsSending(true);
    try {
      const { error } = await supabase
        .from('travel_expense_reports')
        .update({ status: 'Enviado', updated_at: new Date().toISOString() })
        .eq('id', sendReportTarget.id);
      if (error) throw error;

      // FIX: usar reference_id e reference_type consistentemente
      await supabase
        .from('conciliacoes_bancarias')
        .update({ status: 'enviado', prazo_pagamento: sendDueDate } as any)
        .eq('id', sendReportTarget.id);

      toast.success('✓ Relatório enviado ao cliente com sucesso!');
      setSendDialogOpen(false);
      setSendReportTarget(null);
      setSendDueDate('');
      loadReports();
    } catch (error: any) {
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

  const CyanFolderIcon = () => (
    <svg viewBox="0 0 120 100" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 25 L10 15 Q10 8 17 8 L42 8 Q46 8 48 12 L54 22 Q56 25 60 25 Z" fill="#06b6d4" opacity="0.9" />
      <rect x="6" y="25" width="108" height="68" rx="8" fill="#06b6d4" />
    </svg>
  );

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
                    {reportsWithoutClient.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-muted-foreground font-medium">Nenhum rascunho</p>
                        <p className="text-muted-foreground text-sm">Crie um novo relatório para começar</p>
                      </div>
                    ) : (
                      <div className="space-y-3">{reportsWithoutClient.map(renderReportCard)}</div>
                    )}
                  </div>
                )}

                {/* Finalizados — pastas por cliente */}
                {activeTab === 'relatorios' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Pastas de Clientes</h3>
                    {reportsWithClient.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-muted-foreground font-medium">Nenhum relatório finalizado</p>
                        <p className="text-muted-foreground text-sm">Finalize um rascunho para vê-lo aqui</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                        {Object.entries(
                          reportsWithClient.reduce((acc, r) => {
                            const key = r.client || 'Sem Cliente';
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(r);
                            return acc;
                          }, {} as Record<string, TravelReport[]>),
                        ).map(([clientName, group]) => (
                          <button
                            key={clientName}
                            onClick={() => {
                              const clientId = group[0]?.clientes_id;
                              if (clientId) {
                                navigate(`/financeiro/relatorios-cliente/${clientId}`, {
                                  state: { clientName, clientPartner: group[0]?.socios_cliente_id },
                                });
                              }
                            }}
                            className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200"
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
                        ))}
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
              ? { ...prev, socios_cliente_id: partner.id, client: partner.nome }
              : null,
            );
            if (currentReport && !isEditing) {
              draftStorage.saveDraft({
                ...currentReport,
                socios_cliente_id: partner.id,
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

      {/* Dialog de envio */}
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
              <p className="font-semibold">{sendReportTarget?.numero_relatorio}</p>
              <p className="text-xs text-muted-foreground">{sendReportTarget?.client}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Total:{' '}
                <span className="font-bold text-foreground">{fmt(sendReportTarget?.total_valor)}</span>
              </p>
            </div>
            <div>
              <Label htmlFor="due-date">Prazo de Vencimento</Label>
              <Input
                id="due-date"
                type="date"
                value={sendDueDate}
                onChange={e => setSendDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSendReport}
              disabled={!sendDueDate || isSending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isSending ? 'Enviando...' : <><Send className="h-4 w-4" /> Enviar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}