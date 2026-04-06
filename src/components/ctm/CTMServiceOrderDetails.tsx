import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { fromUntyped } from '@/lib/supabase-helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseDateSafe, formatDateToBR } from '@/lib/date-utils';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Info, Wrench, Package, Users, DollarSign,
  Plus, Trash2, Edit2, ChevronLeft, FileText,
  AlertCircle, CheckCircle2, Clock, TrendingUp,
  Loader2, X, Upload, MapPin, Weight, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CTMServiceItemsForm } from './CTMServiceItemsForm';
import { CTMComponentMap } from './CTMComponentMap';
import { CTMWeightBalance } from './CTMWeightBalance';
import { CTMBudgetHistory } from './CTMBudgetHistory';
import { CTMBudgetFromOAS } from './CTMBudgetFromOAS';
import { CTMOASDocumentGenerator } from './CTMOASDocumentGenerator';
import { OASFlightHoursRateio } from './OASFlightHoursRateio';
import { OASBudgetsSection } from './OASBudgetsSection';
import { useCTMBudgetTracking } from '@/hooks/useCTMBudgetTracking';
import { useCTMDocumentGeneration } from '@/hooks/useCTMDocumentGeneration';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServiceOrder {
  id: string;
  numero: string;
  tipo_manutencao: string;
  status?: string;
  status?: string;
  oficina_nome?: string;
  oficina_contato?: string;
  horas_celula?: number;
  data_entrada?: string;
  data_saida?: string;
  dias_previstos?: number;
  dias_efetivos?: number;
  objetivo?: string;
  observacoes?: string;
  tipo_rateio?: string;
  total_mao_obra?: number;
  total_pecas?: number;
  total_geral?: number;
  aeronave_id: string;
}

interface ServiceItem {
  id: string;
  ordenacao: number;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

interface Service {
  id: string;
  numero_servico?: string;
  descricao: string;
  fornecedor?: string;
  modelo?: string;
  p_n?: string;
  n_s?: string;
  valor: number;
  status: string;
  observacoes?: string;
  modo_pagamento?: string;
  condicoes_pagamento?: string;
  items?: ServiceItem[];
}

interface Peca {
  id: string;
  descricao: string;
  p_n_removido?: string;
  s_n_removido?: string;
  p_n_instalado?: string;
  s_n_instalado?: string;
  quantidade: number;
  fornecedor?: string;
  observacoes?: string;
}

interface RateioSocio {
  id: string;
  socio_nome: string;
  percentual: number;
  horas_uso?: number;
  valor_devido: number;
  status_pagamento: string;
}

interface Rateio {
  id: string;
  tipo_rateio: 'igual' | 'por_uso';
  valor_total: number;
  periodo_inicio?: string;
  periodo_fim?: string;
  socios: RateioSocio[];
}

// ─── Tab enum ─────────────────────────────────────────────────────────────────

type Tab = 'informacoes' | 'servicos' | 'pecas' | 'rateio' | 'financeiro' | 'componentes' | 'peso_balanceamento' | 'orcamentos' | 'documentos';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CTMServiceOrderDetailsProps {
  orderId: string;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: (id: string) => void;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: <Clock className="h-3 w-3" /> },
  concluida: { label: 'Concluída', color: 'bg-green-500/15 text-green-400 border-green-500/30', icon: <CheckCircle2 className="h-3 w-3" /> },
  pausada: { label: 'Pausada', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: <AlertCircle className="h-3 w-3" /> },
  cancelada: { label: 'Cancelada', color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: <X className="h-3 w-3" /> },
};

const fmt = (v?: number) =>
  v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';

// ─── Main Component ───────────────────────────────────────────────────────────

export function CTMServiceOrderDetails({ orderId, onBack, onEdit, onDelete }: CTMServiceOrderDetailsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('informacoes');
  const [loading, setLoading] = useState(true);

  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [rateio, setRateio] = useState<Rateio | null>(null);
  const [partners, setPartners] = useState<{ id: string; nome: string }[]>([]);

  // Dialog states
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showPecaForm, setShowPecaForm] = useState(false);
  const [showRateioForm, setShowRateioForm] = useState(false);
  const [editingPeca, setEditingPeca] = useState<Peca | null>(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // New data states
  const [linkedBudgets, setLinkedBudgets] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [costSharingData, setCostSharingData] = useState<any[]>([]);
  const [oasBudgets, setOasBudgets] = useState<any[]>([]);
  const [rateioPeriodoInicio, setRateioPeriodoInicio] = useState('');
  const [rateioPeriodoFim, setRateioPeriodoFim] = useState('');

  // Hooks
  const { getOASBudgetLinks } = useCTMBudgetTracking();
  const { listGeneratedDocuments } = useCTMDocumentGeneration();

  // Peca form
  const [pecaForm, setPecaForm] = useState({
    descricao: '', p_n_removido: '', s_n_removido: '',
    p_n_instalado: '', s_n_instalado: '',
    quantidade: 1, fornecedor: '', observacoes: '',
  });

  // Rateio form
  const [rateioForm, setRateioForm] = useState({
    tipo_rateio: 'por_uso' as 'igual' | 'por_uso',
    periodo_inicio: '', periodo_fim: '',
    socios: [] as { nome: string; horas: string; percentual: string }[],
  });

  const [saving, setSaving] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => { loadAll(); }, [orderId]);

  // Load budgets and documents when tab changes
  useEffect(() => {
    if (activeTab === 'orcamentos' && order) {
      getOASBudgetLinks(order.id).then(setLinkedBudgets);
      loadOASBudgets();
    } else if (activeTab === 'documentos' && order) {
      listGeneratedDocuments(order.id).then(setDocuments);
    } else if (activeTab === 'rateio' && order) {
      loadCostSharing();
    }
  }, [activeTab, order, getOASBudgetLinks, listGeneratedDocuments]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadOrder(), loadServices(), loadPecas(), loadRateio(), loadPartners()]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrder = async () => {
    const { data, error } = await fromUntyped('service_orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (error) throw error;
    setOrder(data as ServiceOrder);
  };

  const loadServices = async () => {
    const { data: svcData } = await (supabase as any)
      .from('ctm_services').select('*').eq('service_order_id', orderId).order('created_at');

    if (!svcData) return;

    // Load items for each service
    const withItems = await Promise.all(
      svcData.map(async (svc: Service) => {
        const { data: items } = await (supabase as any)
          .from('ctm_service_items').select('*').eq('service_id', svc.id).order('ordenacao');
        return { ...svc, items: items || [] };
      })
    );
    setServices(withItems);
  };

  const loadPecas = async () => {
    const { data } = await (supabase as any)
      .from('oas_pecas_trocadas').select('*').eq('service_order_id', orderId).order('created_at');
    setPecas(data || []);
  };

  const loadRateio = async () => {
    const { data: rData } = await (supabase as any)
      .from('oas_rateio').select('*').eq('service_order_id', orderId).single();
    if (!rData) return;

    const { data: socios } = await (supabase as any)
      .from('oas_rateio_socios').select('*').eq('rateio_id', rData.id).order('percentual', { ascending: false });

    setRateio({ ...rData, socios: socios || [] });
  };

  const loadPartners = async () => {
    const { data } = await (supabase as any)
      .from('socios_cliente').select('id, nome').order('nome');
    setPartners(data || []);
  };

  const loadCostSharing = async () => {
    const { data } = await fromUntyped('ctm_cost_sharing')
      .select('*, client:clientes(id, razao_social, proprietario)')
      .eq('service_order_id', orderId);
    setCostSharingData(data || []);
  };

  const loadOASBudgets = async () => {
    const { data } = await (supabase as any)
      .from('oas_orcamentos')
      .select('*')
      .eq('service_order_id', orderId)
      .order('created_at', { ascending: false });
    setOasBudgets(data || []);
  };

  // ── Computed ─────────────────────────────────────────────────────────────────

  const totalServicos = useMemo(() => services.reduce((s, svc) => s + (svc.valor || 0), 0), [services]);
  const totalPecas = useMemo(() => pecas.reduce((s, p) => s + (p.quantidade || 1), 0), [pecas]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'informacoes', label: 'Informações', icon: <Info className="h-4 w-4" /> },
    { id: 'servicos', label: 'Serviços', icon: <Wrench className="h-4 w-4" />, count: services.length },
    { id: 'pecas', label: 'Peças', icon: <Package className="h-4 w-4" />, count: pecas.length },
    { id: 'rateio', label: 'Rateio', icon: <Users className="h-4 w-4" />, count: rateio?.socios.length },
    { id: 'financeiro', label: 'Resumo Financeiro', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'componentes', label: 'Mapa de Componentes', icon: <MapPin className="h-4 w-4" /> },
    { id: 'peso_balanceamento', label: 'Peso e Balanceamento', icon: <Weight className="h-4 w-4" /> },
    { id: 'orcamentos', label: 'Orçamentos', icon: <TrendingUp className="h-4 w-4" />, count: linkedBudgets.length },
    { id: 'documentos', label: 'Documentos', icon: <FileText className="h-4 w-4" />, count: documents.length },
  ];

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSavePeca = async () => {
    if (!pecaForm.descricao.trim()) { toast.error('Descrição obrigatória'); return; }
    setSaving(true);
    try {
      if (editingPeca) {
        await (supabase as any).from('oas_pecas_trocadas').update({
          ...pecaForm,
        }).eq('id', editingPeca.id);
        toast.success('Peça atualizada!');
      } else {
        await (supabase as any).from('oas_pecas_trocadas').insert([{
          service_order_id: orderId, ...pecaForm,
        }]);
        toast.success('Peça adicionada!');
      }
      setShowPecaForm(false);
      setEditingPeca(null);
      setPecaForm({ descricao: '', p_n_removido: '', s_n_removido: '', p_n_instalado: '', s_n_instalado: '', quantidade: 1, fornecedor: '', observacoes: '' });
      await loadPecas();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const handleDeletePeca = async (id: string) => {
    if (!confirm('Excluir esta peça?')) return;
    await (supabase as any).from('oas_pecas_trocadas').delete().eq('id', id);
    toast.success('Peça excluída!');
    await loadPecas();
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('Excluir este serviço e todos os seus itens?')) return;
    await (supabase as any).from('ctm_services').delete().eq('id', id);
    toast.success('Serviço excluído!');
    await loadServices();
  };

  // Rateio: calcular % automaticamente por horas
  const calcRateioFromHoras = () => {
    const totalH = rateioForm.socios.reduce((s, x) => s + (parseFloat(x.horas) || 0), 0);
    if (totalH === 0) return;
    setRateioForm(prev => ({
      ...prev,
      socios: prev.socios.map(s => ({
        ...s,
        percentual: totalH > 0 ? ((parseFloat(s.horas) || 0) / totalH * 100).toFixed(2) : '0',
      })),
    }));
  };

  const calcRateioIgual = () => {
    const n = rateioForm.socios.length;
    if (n === 0) return;
    const pct = (100 / n).toFixed(2);
    setRateioForm(prev => ({
      ...prev,
      socios: prev.socios.map(s => ({ ...s, percentual: pct })),
    }));
  };

  const handleSaveRateio = async () => {
    const totalPct = rateioForm.socios.reduce((s, x) => s + (parseFloat(x.percentual) || 0), 0);
    if (Math.abs(totalPct - 100) > 0.1) {
      toast.error(`Percentuais somam ${totalPct.toFixed(2)}% — deve ser 100%`); return;
    }
    setSaving(true);
    try {
      let rateioId = rateio?.id;

      if (!rateioId) {
        const { data } = await (supabase as any).from('oas_rateio').insert([{
          service_order_id: orderId,
          tipo_rateio: rateioForm.tipo_rateio,
          valor_total: order?.total_geral || 0,
          periodo_inicio: rateioForm.periodo_inicio || null,
          periodo_fim: rateioForm.periodo_fim || null,
        }]).select().single();
        rateioId = data.id;
      } else {
        await (supabase as any).from('oas_rateio').update({
          tipo_rateio: rateioForm.tipo_rateio,
          valor_total: order?.total_geral || 0,
          periodo_inicio: rateioForm.periodo_inicio || null,
          periodo_fim: rateioForm.periodo_fim || null,
        }).eq('id', rateioId);
        await (supabase as any).from('oas_rateio_socios').delete().eq('rateio_id', rateioId);
      }

      const valorTotal = order?.total_geral || 0;
      const sociosToInsert = rateioForm.socios.map(s => ({
        rateio_id: rateioId,
        socio_nome: s.nome,
        percentual: parseFloat(s.percentual) || 0,
        horas_uso: parseFloat(s.horas) || null,
        valor_devido: valorTotal * (parseFloat(s.percentual) || 0) / 100,
        status_pagamento: 'pendente',
      }));

      await (supabase as any).from('oas_rateio_socios').insert(sociosToInsert);
      toast.success('Rateio salvo!');
      setShowRateioForm(false);
      await loadRateio();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  // Open rateio form pre-filled
  const openRateioForm = () => {
    if (rateio) {
      setRateioForm({
        tipo_rateio: rateio.tipo_rateio,
        periodo_inicio: rateio.periodo_inicio || '',
        periodo_fim: rateio.periodo_fim || '',
        socios: rateio.socios.map(s => ({
          nome: s.socio_nome,
          horas: s.horas_uso?.toString() || '',
          percentual: s.percentual.toString(),
        })),
      });
    } else {
      setRateioForm({
        tipo_rateio: 'por_uso',
        periodo_inicio: order?.data_entrada || '',
        periodo_fim: order?.data_saida || '',
        socios: partners.map(p => ({ nome: p.nome, horas: '', percentual: '' })),
      });
    }
    setShowRateioForm(true);
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const currentOrderStatus = order?.status || order?.status || 'em_andamento';
  const statusInfo = statusConfig[currentOrderStatus] || statusConfig.em_andamento;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando OAS...</span>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400">
        OAS não encontrada.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-white/5 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold tracking-tight">{order.numero}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                  {statusInfo.icon}
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {order.oficina_nome || '—'} · {order.tipo_manutencao}
                {order.data_entrada && ` · ${formatDateToBR(order.data_entrada)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit button */}
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                title="Editar OAS"
              >
                <Edit2 className="h-5 w-5" />
              </button>
            )}

            {/* Delete button */}
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                title="Deletar OAS"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}

            <div className="text-right ml-4 pl-4 border-l border-slate-700">
              <p className="text-xs text-slate-500">Total Geral</p>
              <p className="text-xl font-black text-cyan-400">{fmt(order.total_geral)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto mt-4 flex gap-1 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count != null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 text-slate-400'
                  }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ══ INFORMAÇÕES ══════════════════════════════════════════════════════ */}
        {activeTab === 'informacoes' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Oficina', value: order.oficina_nome },
              { label: 'Contato', value: order.oficina_contato },
              { label: 'Horas Célula', value: order.horas_celula ? `${order.horas_celula}H` : undefined },
              { label: 'Dias Previstos', value: order.dias_previstos },
              { label: 'Dias Efetivos', value: order.dias_efetivos },
              { label: 'Objetivo', value: order.objetivo },
              { label: 'Tipo Manutenção', value: order.tipo_manutencao },
              { label: 'Data Entrada', value: order.data_entrada ? formatDateToBR(order.data_entrada) : undefined },
              { label: 'Data Saída', value: order.data_saida ? formatDateToBR(order.data_saida) : undefined },
              { label: 'OS Oficina', value: (order as any).os_oficina },
              { label: 'Período', value: (order as any).periodo },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-800/40 border border-white/5 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="font-semibold text-white">{value || '—'}</p>
              </div>
            ))}
            {order.observacoes && (
              <div className="col-span-2 md:col-span-4 bg-slate-800/40 border border-white/5 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">Observações</p>
                <p className="text-sm text-white">{order.observacoes}</p>
              </div>
            )}
          </div>
        )}

        {/* ══ SERVIÇOS ═════════════════════════════════════════════════════════ */}
        {activeTab === 'servicos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Serviços da Oficina</h2>
              <Button
                onClick={() => setShowServiceForm(true)}
                className="bg-cyan-600 hover:bg-cyan-700 gap-2 h-9 text-sm"
              >
                <Plus className="h-4 w-4" /> Adicionar Serviço
              </Button>
            </div>

            {services.length === 0 ? (
              <EmptyState icon={<Wrench className="h-8 w-8" />} label="Nenhum serviço registrado" />
            ) : (
              <div className="space-y-4">
                {services.map(svc => (
                  <div key={svc.id} className="border border-white/8 rounded-xl overflow-hidden bg-slate-800/30">
                    {/* Service header */}
                    <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-white/5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                            {svc.numero_servico || 'S/N'}
                          </span>
                          <span className="font-semibold text-white text-sm">{svc.descricao}</span>
                        </div>
                        <div className="flex gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
                          {svc.fornecedor && <span>Fornecedor: <span className="text-slate-300">{svc.fornecedor}</span></span>}
                          {svc.modelo && <span>Modelo: <span className="text-slate-300">{svc.modelo}</span></span>}
                          {svc.p_n && <span>P/N: <span className="font-mono text-slate-300">{svc.p_n}</span></span>}
                          {svc.n_s && <span>N/S: <span className="font-mono text-slate-300">{svc.n_s}</span></span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-base font-bold text-cyan-400">{fmt(svc.valor)}</span>
                        <button
                          onClick={() => handleDeleteService(svc.id)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Items table */}
                    {svc.items && svc.items.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/2">
                              <th className="text-left px-5 py-2 text-slate-500 font-medium w-8">Ord.</th>
                              <th className="text-left px-5 py-2 text-slate-500 font-medium">Descrição</th>
                              <th className="text-center px-3 py-2 text-slate-500 font-medium w-16">Qtde</th>
                              <th className="text-right px-5 py-2 text-slate-500 font-medium w-28">Vlr. Unit.</th>
                              <th className="text-right px-5 py-2 text-slate-500 font-medium w-28">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {svc.items.map(item => (
                              <tr key={item.id} className="border-b border-white/3 hover:bg-white/2">
                                <td className="px-5 py-2.5 text-slate-500 font-mono">
                                  {item.ordenacao.toString().padStart(2, '0')}
                                </td>
                                <td className="px-5 py-2.5 text-slate-200">{item.descricao}</td>
                                <td className="px-3 py-2.5 text-center text-slate-300">{item.quantidade}</td>
                                <td className="px-5 py-2.5 text-right font-mono text-slate-300">
                                  {fmt(item.valor_unitario)}
                                </td>
                                <td className="px-5 py-2.5 text-right font-mono font-semibold text-white">
                                  {fmt(item.subtotal)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-white/3 font-bold">
                              <td colSpan={4} className="px-5 py-2.5 text-right text-slate-400 text-xs">
                                Total do Serviço:
                              </td>
                              <td className="px-5 py-2.5 text-right text-cyan-400 font-bold">
                                {fmt(svc.valor)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}

                {/* Total serviços */}
                <div className="flex justify-end">
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-6 py-3 text-right">
                    <p className="text-xs text-slate-400">Total Serviços</p>
                    <p className="text-2xl font-black text-cyan-400">{fmt(totalServicos)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PEÇAS ════════════════════════════════════════════════════════════ */}
        {activeTab === 'pecas' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Peças Aplicadas</h2>
              <Button
                onClick={() => { setEditingPeca(null); setPecaForm({ descricao: '', p_n_removido: '', s_n_removido: '', p_n_instalado: '', s_n_instalado: '', quantidade: 1, fornecedor: '', observacoes: '' }); setShowPecaForm(true); }}
                className="bg-cyan-600 hover:bg-cyan-700 gap-2 h-9 text-sm"
              >
                <Plus className="h-4 w-4" /> Adicionar Peça
              </Button>
            </div>

            {pecas.length === 0 ? (
              <EmptyState icon={<Package className="h-8 w-8" />} label="Nenhuma peça registrada" />
            ) : (
              <div className="border border-white/8 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 bg-slate-800/50">
                      <TableHead className="text-slate-400">Descrição</TableHead>
                      <TableHead className="text-slate-400">P/N Removido</TableHead>
                      <TableHead className="text-slate-400">S/N Removido</TableHead>
                      <TableHead className="text-slate-400">P/N Instalado</TableHead>
                      <TableHead className="text-slate-400">S/N Instalado</TableHead>
                      <TableHead className="text-slate-400 text-center">Qtde</TableHead>
                      <TableHead className="text-slate-400">Fornecedor</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pecas.map(peca => (
                      <TableRow key={peca.id} className="border-white/5 hover:bg-white/2">
                        <TableCell className="font-medium text-white">{peca.descricao}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-400">{peca.p_n_removido || '—'}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-400">{peca.s_n_removido || '—'}</TableCell>
                        <TableCell className="font-mono text-xs text-cyan-400">{peca.p_n_instalado || '—'}</TableCell>
                        <TableCell className="font-mono text-xs text-cyan-400">{peca.s_n_instalado || '—'}</TableCell>
                        <TableCell className="text-center text-slate-300">{peca.quantidade}</TableCell>
                        <TableCell className="text-slate-400 text-xs">{peca.fornecedor || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingPeca(peca); setPecaForm({ descricao: peca.descricao, p_n_removido: peca.p_n_removido || '', s_n_removido: peca.s_n_removido || '', p_n_instalado: peca.p_n_instalado || '', s_n_instalado: peca.s_n_instalado || '', quantidade: peca.quantidade, fornecedor: peca.fornecedor || '', observacoes: peca.observacoes || '' }); setShowPecaForm(true); }} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeletePeca(peca.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* ══ RATEIO ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'rateio' && order && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white">Rateio entre Sócios</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecione o período do diário de bordo para calcular o rateio por horas voadas
              </p>
            </div>

            {/* Flight Hours Rateio with integrated calendar */}
            <OASFlightHoursRateio
              orderId={orderId}
              aircraftId={order.aeronave_id}
              costSharing={costSharingData}
              totalGeral={order.total_geral || 0}
              periodoInicio={order.data_entrada || null}
              periodoFim={order.data_saida || null}
              onRefetch={loadCostSharing}
            />
          </div>
        )}

        {/* ══ RESUMO FINANCEIRO ════════════════════════════════════════════════ */}
        {activeTab === 'financeiro' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white">Resumo Financeiro</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FinCard label="Total Mão de Obra" value={order.total_mao_obra} color="text-blue-400" />
              <FinCard label="Total Peças" value={order.total_pecas} color="text-orange-400" />
              <FinCard label="Total Geral" value={order.total_geral} color="text-cyan-400" large />
            </div>

            {/* Breakdown por serviço */}
            {services.length > 0 && (
              <div className="border border-white/8 rounded-xl overflow-hidden mt-4">
                <div className="px-5 py-3 border-b border-white/5 bg-slate-800/30">
                  <p className="text-sm font-semibold text-white">Breakdown por Serviço</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5">
                      <TableHead className="text-slate-400">Serviço</TableHead>
                      <TableHead className="text-slate-400">Fornecedor</TableHead>
                      <TableHead className="text-slate-400 text-center">Itens</TableHead>
                      <TableHead className="text-slate-400 text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map(svc => (
                      <TableRow key={svc.id} className="border-white/5 hover:bg-white/2">
                        <TableCell className="text-white text-sm">
                          <span className="font-mono text-xs text-cyan-400 mr-2">{svc.numero_servico}</span>
                          {svc.descricao}
                        </TableCell>
                        <TableCell className="text-slate-400 text-xs">{svc.fornecedor || '—'}</TableCell>
                        <TableCell className="text-center text-slate-400">{svc.items?.length || 0}</TableCell>
                        <TableCell className="text-right font-bold text-white">{fmt(svc.valor)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-white/3 font-bold border-t-2 border-white/10">
                      <TableCell colSpan={3} className="text-right text-slate-400 pr-4">Total:</TableCell>
                      <TableCell className="text-right text-cyan-400 text-lg font-black">{fmt(totalServicos)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Rateio preview */}
            {rateio && rateio.socios.length > 0 && (
              <div className="border border-white/8 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 bg-slate-800/30">
                  <p className="text-sm font-semibold text-white">Rateio — Valor por Sócio</p>
                </div>
                <div className="divide-y divide-white/5">
                  {rateio.socios.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="font-semibold text-white text-sm">{s.socio_nome}</p>
                        <p className="text-xs text-slate-500">{s.percentual.toFixed(2)}%
                          {rateio.tipo_rateio === 'por_uso' && s.horas_uso != null && ` · ${s.horas_uso}h voadas`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{fmt(s.valor_devido)}</p>
                        <span className={`text-xs ${s.status_pagamento === 'pago' ? 'text-green-400' : 'text-yellow-400'}`}>
                          {s.status_pagamento === 'pago' ? '✓ Pago' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ COMPONENTES ══════════════════════════════════════════════════════════ */}
        {activeTab === 'componentes' && order && (
          <CTMComponentMap aircraftId={order.aeronave_id} />
        )}

        {/* ══ PESO E BALANCEAMENTO ══════════════════════════════════════════════════ */}
        {activeTab === 'peso_balanceamento' && order && (
          <CTMWeightBalance aircraftId={order.aeronave_id} aircraftRegistration="" />
        )}

        {/* ══ ORÇAMENTOS (Histórico) ═══════════════════════════════════════════ */}
        {activeTab === 'orcamentos' && (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-white">Histórico de Orçamentos</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Orçamentos gerados a partir dos serviços e peças desta OAS
              </p>
            </div>

            {oasBudgets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-800/20 rounded-lg border border-white/5">
                <TrendingUp className="h-12 w-12 text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm">Nenhum orçamento registrado</p>
                <p className="text-xs text-slate-500">Adicione serviços ou peças e envie para aprovação</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="flex gap-4 text-sm flex-wrap">
                  <div className="bg-green-500/10 rounded-lg px-3 py-2 border border-green-500/20">
                    <span className="text-green-400 font-bold">
                      Aprovado: R$ {oasBudgets.filter((b: any) => b.status === 'aprovado').reduce((s: number, b: any) => s + (b.valor_total || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="bg-yellow-500/10 rounded-lg px-3 py-2 border border-yellow-500/20">
                    <span className="text-yellow-400 font-bold">
                      Pendente: R$ {oasBudgets.filter((b: any) => b.status === 'pendente_aprovacao').reduce((s: number, b: any) => s + (b.valor_total || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Table */}
                <div className="border border-white/8 rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/5 bg-slate-800/50">
                        <TableHead className="text-slate-400">Tipo</TableHead>
                        <TableHead className="text-slate-400">Descrição</TableHead>
                        <TableHead className="text-slate-400">Empresa</TableHead>
                        <TableHead className="text-slate-400 text-center">Qtd</TableHead>
                        <TableHead className="text-slate-400 text-right">Valor Total</TableHead>
                        <TableHead className="text-slate-400 text-center">Status</TableHead>
                        <TableHead className="text-slate-400 text-center">Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oasBudgets.map((b: any) => {
                        const statusMap: Record<string, { label: string; cls: string }> = {
                          rascunho: { label: 'Rascunho', cls: 'bg-muted text-muted-foreground' },
                          pendente_aprovacao: { label: 'Aguard. Aprovação', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
                          aprovado: { label: 'Aprovado', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
                          rejeitado: { label: 'Rejeitado', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
                        };
                        const s = statusMap[b.status] || statusMap.rascunho;
                        return (
                          <TableRow key={b.id} className="border-white/5 hover:bg-white/2">
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{b.tipo === 'peca' ? 'Peça' : 'Serviço'}</Badge>
                            </TableCell>
                            <TableCell className="font-medium text-white">{b.descricao}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{b.empresa_nome || '—'}</TableCell>
                            <TableCell className="text-center text-slate-300">{b.quantidade}</TableCell>
                            <TableCell className="text-right font-mono text-white">
                              R$ {(b.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={cn('text-xs', s.cls)}>{s.label}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                b.pago ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                              }`}>
                                {b.pago ? '✓ Pago' : '—'}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ DOCUMENTOS ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'documentos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Documentos Gerados</h2>
              <Button
                onClick={() => setShowDocumentGenerator(true)}
                variant="outline"
                className="gap-2 h-9 text-sm"
              >
                <Download className="h-4 w-4" />
                Gerar Documentos
              </Button>
            </div>

            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-800/20 rounded-lg border border-white/5">
                <FileText className="h-12 w-12 text-slate-600 mb-3" />
                <p className="text-slate-400 text-sm">Nenhum documento gerado</p>
                <p className="text-xs text-slate-500">Gere PDFs e relatórios desta OAS</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {documents.map(doc => (
                  <div key={doc.id} className="border border-white/5 rounded-lg p-3 bg-slate-800/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-sm font-medium text-white">{doc.nome_arquivo}</p>
                        <p className="text-xs text-slate-500">
                          {formatDateToBR(doc.generated_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Dialog: Novo Serviço ─────────────────────────────────────────────── */}
      <Dialog open={showServiceForm} onOpenChange={setShowServiceForm}>
        <DialogContent className="max-w-4xl bg-slate-900 border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Wrench className="h-5 w-5 text-cyan-400" /> Novo Serviço
            </DialogTitle>
          </DialogHeader>
          <CTMServiceItemsForm
            orderId={orderId}
            onSaved={() => { setShowServiceForm(false); loadServices(); loadOrder(); }}
            onCancel={() => setShowServiceForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Peça ────────────────────────────────────────────────────── */}
      <Dialog open={showPecaForm} onOpenChange={setShowPecaForm}>
        <DialogContent className="max-w-2xl bg-slate-900 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-cyan-400" />
              {editingPeca ? 'Editar Peça' : 'Adicionar Peça'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Descrição *</Label>
              <Input value={pecaForm.descricao} onChange={e => setPecaForm({ ...pecaForm, descricao: e.target.value })}
                placeholder="Ex: FILTRO DE OLEO" className="bg-slate-800 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">P/N Removido</Label>
                <Input value={pecaForm.p_n_removido} onChange={e => setPecaForm({ ...pecaForm, p_n_removido: e.target.value })}
                  placeholder="Ex: CH481081-OLD" className="bg-slate-800 border-white/10 text-white font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">S/N Removido</Label>
                <Input value={pecaForm.s_n_removido} onChange={e => setPecaForm({ ...pecaForm, s_n_removido: e.target.value })}
                  className="bg-slate-800 border-white/10 text-white font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">P/N Instalado</Label>
                <Input value={pecaForm.p_n_instalado} onChange={e => setPecaForm({ ...pecaForm, p_n_instalado: e.target.value })}
                  placeholder="Ex: CH481081" className="bg-slate-800 border-white/10 text-white font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">S/N Instalado</Label>
                <Input value={pecaForm.s_n_instalado} onChange={e => setPecaForm({ ...pecaForm, s_n_instalado: e.target.value })}
                  className="bg-slate-800 border-white/10 text-white font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Quantidade</Label>
                <Input type="number" min="1" value={pecaForm.quantidade}
                  onChange={e => setPecaForm({ ...pecaForm, quantidade: parseInt(e.target.value) || 1 })}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Fornecedor</Label>
                <Input value={pecaForm.fornecedor} onChange={e => setPecaForm({ ...pecaForm, fornecedor: e.target.value })}
                  placeholder="Ex: CLAUDIO" className="bg-slate-800 border-white/10 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Observações</Label>
              <Textarea value={pecaForm.observacoes} onChange={e => setPecaForm({ ...pecaForm, observacoes: e.target.value })}
                className="bg-slate-800 border-white/10 text-white" rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPecaForm(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSavePeca} disabled={saving} className="flex-1 bg-cyan-600 hover:bg-cyan-700 gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Rateio ──────────────────────────────────────────────────── */}
      <Dialog open={showRateioForm} onOpenChange={setShowRateioForm}>
        <DialogContent className="max-w-2xl bg-slate-900 border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-400" /> Rateio entre Sócios
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Tipo */}
            <div className="flex gap-2">
              {(['por_uso', 'igual'] as const).map(tipo => (
                <button
                  key={tipo}
                  onClick={() => { setRateioForm(prev => ({ ...prev, tipo_rateio: tipo })); if (tipo === 'igual') calcRateioIgual(); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${rateioForm.tipo_rateio === tipo
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'text-slate-400 border-white/10 hover:bg-white/5'
                    }`}
                >
                  {tipo === 'por_uso' ? '📊 Por Horas de Uso' : '⚖️ Divisão Igualitária'}
                </button>
              ))}
            </div>

            {/* Período */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs">Período Início</Label>
                <Input type="data" value={rateioForm.periodo_inicio}
                  onChange={e => setRateioForm(prev => ({ ...prev, periodo_inicio: e.target.value }))}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 text-xs">Período Fim</Label>
                <Input type="data" value={rateioForm.periodo_fim}
                  onChange={e => setRateioForm(prev => ({ ...prev, periodo_fim: e.target.value }))}
                  className="bg-slate-800 border-white/10 text-white" />
              </div>
            </div>

            {/* Sócios */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300 text-sm">Sócios</Label>
                <div className="flex gap-2">
                  {rateioForm.tipo_rateio === 'por_uso' && (
                    <button onClick={calcRateioFromHoras}
                      className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded bg-cyan-500/10">
                      ↻ Calcular % pelas horas
                    </button>
                  )}
                  <button
                    onClick={() => setRateioForm(prev => ({ ...prev, socios: [...prev.socios, { nome: '', horas: '', percentual: '' }] }))}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5"
                  >
                    + Sócio
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {rateioForm.socios.map((s, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={s.nome}
                      onChange={e => setRateioForm(prev => {
                        const socios = [...prev.socios]; socios[idx] = { ...socios[idx], nome: e.target.value }; return { ...prev, socios };
                      })}
                      placeholder="Nome do sócio"
                      className="bg-slate-800 border-white/10 text-white text-sm flex-1"
                    />
                    {rateioForm.tipo_rateio === 'por_uso' && (
                      <Input
                        type="number" step="0.01" value={s.horas}
                        onChange={e => setRateioForm(prev => {
                          const socios = [...prev.socios]; socios[idx] = { ...socios[idx], horas: e.target.value }; return { ...prev, socios };
                        })}
                        placeholder="Horas"
                        className="bg-slate-800 border-white/10 text-white text-sm w-24 font-mono"
                      />
                    )}
                    <Input
                      type="number" step="0.01" value={s.percentual}
                      onChange={e => setRateioForm(prev => {
                        const socios = [...prev.socios]; socios[idx] = { ...socios[idx], percentual: e.target.value }; return { ...prev, socios };
                      })}
                      placeholder="%"
                      className="bg-slate-800 border-white/10 text-white text-sm w-20 font-mono"
                    />
                    <span className="text-xs text-slate-500 w-28 text-right font-mono">
                      {fmt((order?.total_geral || 0) * (parseFloat(s.percentual) || 0) / 100)}
                    </span>
                    <button onClick={() => setRateioForm(prev => ({ ...prev, socios: prev.socios.filter((_, i) => i !== idx) }))}
                      className="text-red-400 hover:bg-red-500/10 p-1 rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Soma */}
              <div className="flex justify-between text-xs pt-1">
                <span className="text-slate-500">Total %:</span>
                <span className={`font-mono font-bold ${Math.abs(rateioForm.socios.reduce((s, x) => s + (parseFloat(x.percentual) || 0), 0) - 100) < 0.1
                    ? 'text-green-400' : 'text-red-400'
                  }`}>
                  {rateioForm.socios.reduce((s, x) => s + (parseFloat(x.percentual) || 0), 0).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowRateioForm(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSaveRateio} disabled={saving} className="flex-1 bg-cyan-600 hover:bg-cyan-700 gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar Rateio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Gerar Orçamento ──────────────────────────────────────────── */}
      {showBudgetForm && order && (
        <CTMBudgetFromOAS
          oasId={order.id}
          onClose={() => setShowBudgetForm(false)}
          onSuccess={() => {
            setShowBudgetForm(false);
            // Reload budgets
            if (order.id) {
              getOASBudgetLinks(order.id).then(setLinkedBudgets);
            }
          }}
        />
      )}

      {/* ── Dialog: Gerador de Documentos ────────────────────────────────────── */}
      {showDocumentGenerator && order && (
        <CTMOASDocumentGenerator
          oasId={order.id}
          oasData={order}
          isOpen={showDocumentGenerator}
          onClose={() => setShowDocumentGenerator(false)}
        />
      )}

      {/* ── Dialog: Confirmação de Deleção ────────────────────────────────────── */}
      {onDelete && order && (
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5" />
                Deletar Ordem de Serviço?
              </DialogTitle>
            </DialogHeader>
            <p className="text-slate-400 text-sm">
              Tem certeza que deseja deletar a OAS <strong>{order.numero}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                className="border-slate-600 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  await onDelete(order.id);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deletar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/40 min-h-[200px] flex flex-col items-center justify-center gap-3 text-slate-500">
      {icon}
      <p className="text-sm">{label}</p>
    </div>
  );
}

function FinCard({ label, value, color, large }: { label: string; value?: number; color: string; large?: boolean }) {
  return (
    <div className="bg-slate-800/40 border border-white/5 rounded-xl p-5">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`font-black ${large ? 'text-3xl' : 'text-2xl'} ${color}`}>
        {value != null ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
      </p>
    </div>
  );
}
