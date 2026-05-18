import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Plane, DollarSign, Fuel, Wrench, Building2, Users,
  TrendingUp, TrendingDown, Scale, Receipt, Wallet, Search,
  FileDown, Filter, ChevronDown, ChevronUp, BarChart3,
  AlertCircle, CheckCircle2, Clock, Minus, ArrowUpRight, ArrowDownRight,
  Mail, Phone, MapPin, Building, KeyRound, FileText
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type TipoCusto = 'FIXO' | 'VARIÁVEL P/ VOO' | 'VARIÁVEL P/ HORA' | 'EXTRA';
type PrazoCusto = 'CURTO PRAZO' | 'MÉDIO PRAZO' | 'LONGO PRAZO';
type CategoriaCusto = 'COMBUSTÍVEIS' | 'HANGARAG./TAXAS' | 'MANUTENÇÃO' | 'TRIPULAÇÃO & ADM' | 'CUSTO TERCEIRO' | string;

interface LancamentoBalanco {
  id: string;
  data: string;
  doc?: string;
  fornecedor?: string;
  descricao: string;
  categoria: CategoriaCusto;
  tipo: TipoCusto;
  prazo: PrazoCusto;
  pago_por?: string;
  valor_pago: number;
  aeronave_id?: string;
  rateios: Array<{
    cliente_id: string;
    nome_cotista: string;
    percentual: number;
    valor_rateado: number;
    valor_pago_real: number;
    pago_diretamente: boolean;
  }>;
  status?: string;
  numero_nf?: string;
  numero_doc?: string;
  origem?: string;
}

interface CotistaInfo {
  id: string;
  nome: string;
  percentual: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

const fmtDate = (s?: string | null) =>
  s ? format(parseISO(s), 'dd/MM/yyyy', { locale: ptBR }) : '—';

const CATEGORIAS_ORDEM: CategoriaCusto[] = [
  'COMBUSTÍVEIS', 'HANGARAG./TAXAS', 'MANUTENÇÃO', 'TRIPULAÇÃO & ADM', 'CUSTO TERCEIRO'
];

const TIPO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'FIXO': { label: 'FIXO', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  'VARIÁVEL P/ VOO': { label: 'VAR. VOO', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30' },
  'VARIÁVEL P/ HORA': { label: 'VAR. HORA', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30' },
  'EXTRA': { label: 'EXTRA', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
};

const PRAZO_CONFIG: Record<string, { color: string; bg: string }> = {
  'CURTO PRAZO': { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
  'MÉDIO PRAZO': { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  'LONGO PRAZO': { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

const CATEGORIA_COLORS: Record<string, string> = {
  'COMBUSTÍVEIS': '#f59e0b',
  'HANGARAG./TAXAS': '#3b82f6',
  'MANUTENÇÃO': '#ef4444',
  'TRIPULAÇÃO & ADM': '#8b5cf6',
  'CUSTO TERCEIRO': '#10b981',
};

function inferirTipo(periodicidade?: string, categoria?: string): TipoCusto {
  const p = (periodicidade || '').toUpperCase();
  const c = (categoria || '').toUpperCase();
  if (p.includes('VARIÁVEL P/ VOO') || p.includes('VARIAVEL P/ VOO')) return 'VARIÁVEL P/ VOO';
  if (p.includes('VARIÁVEL P/ HORA') || p.includes('VARIAVEL P/ HORA')) return 'VARIÁVEL P/ HORA';
  if (p.includes('EXTRA')) return 'EXTRA';
  if (c.includes('COMBUSTÍVEL') || c.includes('ABASTECIMENTO')) return 'VARIÁVEL P/ HORA';
  if (p.includes('MENSAL') || c.includes('HANGAR') || c.includes('SEGURO') || c.includes('TRIPULAÇÃO') || c.includes('ADM')) return 'FIXO';
  return 'FIXO';
}

function inferirPrazo(prazo?: string): PrazoCusto {
  const p = (prazo || '').toUpperCase();
  if (p.includes('LONGO')) return 'LONGO PRAZO';
  if (p.includes('MÉDIO') || p.includes('MEDIO')) return 'MÉDIO PRAZO';
  return 'CURTO PRAZO';
}

function inferirCategoria(cat?: string): CategoriaCusto {
  const c = (cat || '').toUpperCase().replace(/_/g, ' ');
  if (c.includes('COMBUSTÍVEL') || c.includes('ABASTECIMENTO') || c.includes('COMBUSTIVEIS')) return 'COMBUSTÍVEIS';
  if (c.includes('HANGAR') || c.includes('TAXAS') || c.includes('RAMPA') || c.includes('INFRAERO') || c.includes('DECEA') || c.includes('ATENDIMENTO')) return 'HANGARAG./TAXAS';
  if (c.includes('MANUTENÇÃO') || c.includes('MANUTENCAO') || c.includes('PEÇA') || c.includes('OFICINA') || c.includes('MÃO DE OBRA') || c.includes('MAO DE OBRA') || c.includes('REVISÃO')) return 'MANUTENÇÃO';
  if (c.includes('TRIPULAÇÃO') || c.includes('TRIPULACAO') || c.includes('PILOTO') || c.includes('ADM') || c.includes('ADMINISTRAÇÃO')) return 'TRIPULAÇÃO & ADM';
  if (c.includes('TERCEIRO')) return 'CUSTO TERCEIRO';
  return c || 'OUTROS';
}

// ─── Hook principal de dados ──────────────────────────────────────────────────

function useBalancoDetalhe(clienteId?: string, aeronaveId?: string) {
  // Cliente
  const { data: cliente } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      const { data } = await supabase.from('clientes').select('*').eq('id', clienteId!).single();
      return data;
    },
    enabled: !!clienteId,
  });

  // Aeronaves do cliente
  const { data: aeronaves = [] } = useQuery({
    queryKey: ['aeronaves-cliente', clienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cotistas_aeronave')
        .select('id_aeronave, percentual_sociedade, aeronave:id_aeronave(id, matricula, modelo, fabricante)')
        .eq('id_clientes', clienteId!);
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Cotistas da aeronave
  const { data: cotistas = [] } = useQuery({
    queryKey: ['cotistas-aeronave', aeronaveId],
    queryFn: async () => {
      const { data } = await supabase
        .from('cotistas_aeronave')
        .select('id_clientes, percentual_sociedade, cliente:id_clientes(id, razao_social, proprietario)')
        .eq('id_aeronave', aeronaveId!);
      return (data || []).map((c: any) => ({
        id: c.id_clientes,
        nome: c.cliente?.razao_social || c.cliente?.proprietario || 'Cotista',
        percentual: Number(c.percentual_sociedade) || 0,
      })) as CotistaInfo[];
    },
    enabled: !!aeronaveId,
  });

  // Lançamentos do rateio (fonte principal: rateio_despesas)
  const { data: rateioBruto = [], isLoading } = useQuery({
    queryKey: ['rateio-despesas-balanco', clienteId, aeronaveId],
    queryFn: async () => {
      let q = (supabase as any)
        .from('rateio_despesas')
        .select('*')
        .eq('clientes_id', clienteId!);
      if (aeronaveId) q = q.eq('aeronave_id', aeronaveId);
      const { data } = await q.order('data_envio', { ascending: false });
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Agrupa rateio_despesas por despesa_id para montar a estrutura com cotistas
  const lancamentos: LancamentoBalanco[] = useMemo(() => {
    const mapa = new Map<string, LancamentoBalanco>();
    rateioBruto.forEach((r: any) => {
      const key = r.despesa_id || r.id;
      if (!mapa.has(key)) {
        mapa.set(key, {
          id: key,
          data: r.data_pagamento || r.data_vencimento || r.data_envio,
          doc: r.numero_nf || r.numero_doc || r.numero_boleto,
          fornecedor: r.fornecedor_nome,
          descricao: r.descricao_despesa || r.categoria_custo || '—',
          categoria: inferirCategoria(r.categoria_custo || r.descricao_despesa),
          tipo: inferirTipo(r.periodicidade, r.categoria_custo),
          prazo: inferirPrazo(r.prazo),
          pago_por: r.pago_por || 'Share Brasil',
          valor_pago: Number(r.valor_total_despesa) || Number(r.valor_rateado_por_uso) || 0,
          aeronave_id: r.aeronave_id,
          rateios: [],
          status: r.status,
          origem: r.pago_diretamente ? 'direto' : 'conciliacao',
        });
      }
      const lancamento = mapa.get(key)!;
      // Evita duplicar cotista
      if (!lancamento.rateios.find(x => x.cliente_id === r.clientes_id)) {
        lancamento.rateios.push({
          cliente_id: r.clientes_id,
          nome_cotista: r.nome_socio || r.client_name || 'Cotista',
          percentual: Number(r.percentual || r.percentual_voo || 0),
          valor_rateado: Number(r.valor_rateado_por_uso) || 0,
          valor_pago_real: Number(r.valor_pago_real) || 0,
          pago_diretamente: !!r.pago_diretamente,
        });
      }
    });
    return Array.from(mapa.values());
  }, [rateioBruto]);

  return { cliente, aeronaves, cotistas, lancamentos, isLoading };
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function FinanceiroCotistaDetalhe() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();

  const [aeronaveAtual, setAeronaveAtual] = useState('');
  const [activeTab, setActiveTab] = useState('balanco');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [sortCol, setSortCol] = useState<string>('data');
  const [sortAsc, setSortAsc] = useState(false);

  const { cliente, aeronaves, cotistas, lancamentos, isLoading } = useBalancoDetalhe(
    clienteId,
    aeronaveAtual || (aeronaves[0] as any)?.id_aeronave
  );

  const aeronaveEfetiva = aeronaveAtual || (aeronaves[0] as any)?.id_aeronave || '';
  const aeronaveInfo = (aeronaves as any[]).find(a => a.id_aeronave === aeronaveEfetiva)?.aeronave;

  // ── Lançamentos filtrados ────────────────────────────────────────────────────
  const lancamentosFiltrados = useMemo(() => {
    return lancamentos
      .filter(l => {
        if (filtroCategoria !== 'todos' && l.categoria !== filtroCategoria) return false;
        if (filtroTipo !== 'todos' && l.tipo !== filtroTipo) return false;
        if (filtroBusca) {
          const q = filtroBusca.toLowerCase();
          return (
            l.descricao?.toLowerCase().includes(q) ||
            l.fornecedor?.toLowerCase().includes(q) ||
            l.doc?.toLowerCase().includes(q) ||
            l.categoria?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let va: any = a[sortCol as keyof LancamentoBalanco];
        let vb: any = b[sortCol as keyof LancamentoBalanco];
        if (sortCol === 'data') { va = new Date(a.data || 0); vb = new Date(b.data || 0); }
        if (sortCol === 'valor_pago') { va = a.valor_pago; vb = b.valor_pago; }
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [lancamentos, filtroCategoria, filtroTipo, filtroBusca, sortCol, sortAsc]);

  // ── Totais gerais ────────────────────────────────────────────────────────────
  const totais = useMemo(() => {
    const porCategoria: Record<string, Record<string, number>> = {};
    const porCotista: Record<string, { nome: string; percentual: number; devido: number; pago: number }> = {};
    let totalGeral = 0;

    lancamentos.forEach(l => {
      totalGeral += l.valor_pago;

      // por categoria × cotista
      if (!porCategoria[l.categoria]) porCategoria[l.categoria] = {};
      l.rateios.forEach(r => {
        porCategoria[l.categoria][r.cliente_id] = (porCategoria[l.categoria][r.cliente_id] || 0) + r.valor_rateado;
        if (!porCotista[r.cliente_id]) {
          porCotista[r.cliente_id] = { nome: r.nome_cotista, percentual: r.percentual, devido: 0, pago: 0 };
        }
        porCotista[r.cliente_id].devido += r.valor_rateado;
        porCotista[r.cliente_id].pago += r.valor_pago_real;
      });
    });

    const porTipo = { FIXO: 0, 'VARIÁVEL P/ VOO': 0, 'VARIÁVEL P/ HORA': 0, EXTRA: 0 } as Record<string, number>;
    lancamentos.forEach(l => { porTipo[l.tipo] = (porTipo[l.tipo] || 0) + l.valor_pago; });

    return { totalGeral, porCategoria, porCotista, porTipo };
  }, [lancamentos]);

  // ── Dados para gráficos ──────────────────────────────────────────────────────
  const pivotData = useMemo(() => {
    return CATEGORIAS_ORDEM.filter(cat => totais.porCategoria[cat]).map(cat => {
      const entry: any = { categoria: cat.replace(' & ', '/').substring(0, 15) };
      Object.entries(totais.porCotista).forEach(([id, info]) => {
        entry[info.nome] = totais.porCategoria[cat]?.[id] || 0;
      });
      return entry;
    });
  }, [totais]);

  const pieData = CATEGORIAS_ORDEM
    .filter(cat => totais.porCategoria[cat])
    .map(cat => ({
      name: cat,
      value: Object.values(totais.porCategoria[cat] || {}).reduce((s, v) => s + v, 0),
    }));

  // ── Ordenação nas colunas ────────────────────────────────────────────────────
  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortCol === col
      ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />)
      : null;

  // ── CSV Export ───────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const cotistasCols = cotistas.map(c => c.nome);
    const headers = ['Data', 'Doc', 'Fornecedor', 'Descrição', 'Categoria', 'Tipo', 'Prazo', 'Pago Por', 'Valor Total', ...cotistasCols.flatMap(n => [`${n} %`, `${n} Rateio`])];
    const rows = lancamentosFiltrados.map(l => {
      const base = [fmtDate(l.data), l.doc || '—', l.fornecedor || '—', l.descricao, l.categoria, l.tipo, l.prazo, l.pago_por || '—', l.valor_pago.toFixed(2)];
      cotistas.forEach(c => {
        const r = l.rateios.find(x => x.cliente_id === c.id);
        base.push(r ? r.percentual.toFixed(4) + '%' : '0%');
        base.push(r ? r.valor_rateado.toFixed(2) : '0.00');
      });
      return base;
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `balanco_${cliente?.razao_social?.replace(/\s/g, '_')}_${aeronaveInfo?.matricula || 'todas'}.csv`;
    a.click();
  };

  if (isLoading && !cliente) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground text-sm">Carregando balanço...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!cliente) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Building className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">Cliente não encontrado</p>
        </div>
      </Layout>
    );
  }

  const cotistasCols = cotistas.length > 0 ? cotistas : Object.values(totais.porCotista).map((c, i) => ({ id: String(i), nome: c.nome, percentual: c.percentual }));

  return (
    <Layout>
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12 px-4 md:px-6">

        {/* ── Navegação ── */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all w-fit"
          >
            <div className="p-1.5 rounded-lg bg-card border border-border/50 group-hover:border-primary/40 transition-colors">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            <span className="text-sm font-medium">Voltar para clientes</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
            <span>Gestão Financeira</span>
            <span>/</span>
            <span className="text-foreground font-medium">{cliente.razao_social}</span>
            <span>/</span>
            <span className="text-primary">Análise de Balanço</span>
          </div>
        </div>

        {/* ── Hero Card ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card/90 to-card/50 border border-border/50 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="p-6 md:p-8 relative z-10">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {/* Logo */}
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                {cliente.url_logo
                  ? <img src={cliente.url_logo} alt={cliente.razao_social} className="w-full h-full object-cover rounded-xl" />
                  : <span className="text-xl font-bold text-primary">{(cliente.razao_social || '').slice(0, 2).toUpperCase()}</span>
                }
              </div>

              {/* Info */}
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{cliente.razao_social}</h1>
                    <Badge className={`text-xs ${cliente.status === 'ativo' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-muted text-muted-foreground'}`}>
                      {cliente.status || '—'}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">CNPJ {cliente.cnpj || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {cliente.telefone && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 border border-border/50 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 text-primary/60" />{cliente.telefone}
                    </span>
                  )}
                  {cliente.email && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 border border-border/50 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 text-primary/60" />{cliente.email}
                    </span>
                  )}
                  {(cliente.cidade || cliente.uf) && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background/60 border border-border/50 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 text-primary/60" />{cliente.cidade}{cliente.uf && `, ${cliente.uf}`}
                    </span>
                  )}
                </div>
              </div>

              {/* KPIs rápidos */}
              <div className="flex flex-row md:flex-col gap-4 md:pl-8 md:border-l border-border/40 shrink-0">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Aeronaves</p>
                  <p className="text-2xl font-light">{aeronaves.length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Lançamentos</p>
                  <p className="text-2xl font-light">{lancamentos.length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Total</p>
                  <p className="text-lg font-bold text-primary">{fmtBRL(totais.totalGeral)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Seletor de Aeronave ── */}
        {aeronaves.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/40">
            <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
              <Plane className="h-4 w-4 text-primary" />
              <span className="font-medium">Aeronave:</span>
            </div>
            <div className="flex flex-wrap gap-2 flex-1">
              {(aeronaves as any[]).map(a => (
                <button
                  key={a.id_aeronave}
                  onClick={() => setAeronaveAtual(a.id_aeronave)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${a.id_aeronave === aeronaveEfetiva
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background/50 border-border/50 hover:border-primary/40 text-muted-foreground'
                    }`}
                >
                  {a.aeronave?.matricula} — {a.aeronave?.modelo} ({a.percentual_sociedade}%)
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── KPI Cards por Tipo ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(['FIXO', 'VARIÁVEL P/ VOO', 'VARIÁVEL P/ HORA', 'EXTRA'] as TipoCusto[]).map(tipo => {
            const cfg = TIPO_CONFIG[tipo];
            const valor = totais.porTipo[tipo] || 0;
            return (
              <Card key={tipo}
                className={`border ${cfg.bg} cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md`}
                onClick={() => setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo)}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-[10px] uppercase tracking-widest font-semibold ${cfg.color} mb-1`}>{cfg.label}</p>
                      <p className="text-xl font-bold">{fmtBRL(valor)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {totais.totalGeral > 0 ? ((valor / totais.totalGeral) * 100).toFixed(1) : '0'}% do total
                      </p>
                    </div>
                    {filtroTipo === tipo && (
                      <Badge variant="outline" className="text-[10px]">✓</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ── Tabs principais ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-auto p-1 bg-card/60 border border-border/50 rounded-xl flex flex-wrap gap-1 w-full">
            {[
              { value: 'balanco', label: 'Balanço de Custos', icon: <BarChart3 className="h-4 w-4" /> },
              { value: 'pivot', label: 'Resumo por Categoria', icon: <Scale className="h-4 w-4" /> },
              { value: 'cotistas', label: 'Posição por Cotista', icon: <Users className="h-4 w-4" /> },
            ].map(tab => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all text-sm"
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ════════════════════════════════════════
              TAB 1: BALANÇO DE CUSTOS (tabela principal)
          ════════════════════════════════════════ */}
          <TabsContent value="balanco" className="space-y-4">

            {/* Filtros */}
            <Card className="border border-border/50 bg-card/60 rounded-xl">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar fornecedor, descrição, doc..."
                      value={filtroBusca}
                      onChange={e => setFiltroBusca(e.target.value)}
                      className="pl-9 bg-background/50"
                    />
                  </div>
                  <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger className="w-44 bg-background/50">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas categorias</SelectItem>
                      {CATEGORIAS_ORDEM.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="w-40 bg-background/50">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os tipos</SelectItem>
                      <SelectItem value="FIXO">FIXO</SelectItem>
                      <SelectItem value="VARIÁVEL P/ VOO">VARIÁVEL P/ VOO</SelectItem>
                      <SelectItem value="VARIÁVEL P/ HORA">VARIÁVEL P/ HORA</SelectItem>
                      <SelectItem value="EXTRA">EXTRA</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 shrink-0">
                    <FileDown className="h-4 w-4" />
                    CSV
                  </Button>
                  {(filtroCategoria !== 'todos' || filtroTipo !== 'todos' || filtroBusca) && (
                    <Button variant="ghost" size="sm" onClick={() => { setFiltroBusca(''); setFiltroCategoria('todos'); setFiltroTipo('todos'); }} className="text-muted-foreground">
                      Limpar filtros
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {lancamentosFiltrados.length} lançamento(s) · Total filtrado: <strong>{fmtBRL(lancamentosFiltrados.reduce((s, l) => s + l.valor_pago, 0))}</strong>
                </p>
              </CardContent>
            </Card>

            {/* Tabela principal — replica estrutura do Excel */}
            <Card className="border border-border/50 bg-card/60 rounded-xl">
              <CardContent className="pt-0 p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
                        {/* Colunas fixas */}
                        <TableHead
                          className="text-[10px] uppercase tracking-wider font-bold cursor-pointer select-none whitespace-nowrap px-3 py-3"
                          onClick={() => toggleSort('data')}
                        >
                          DATA <SortIcon col="data" />
                        </TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold px-3 py-3">DOC</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold px-3 py-3">FORNECEDOR</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold px-3 py-3 min-w-[160px]">DESCRIÇÃO</TableHead>
                        {/* Qualificação de Custo */}
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold px-3 py-3 text-amber-400/80 border-l border-border/40">CATEGORIA</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold px-3 py-3 text-amber-400/80">TIPO</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold px-3 py-3 text-amber-400/80">PRAZO</TableHead>
                        {/* Pagamento */}
                        <TableHead className="text-[10px] uppercase tracking-wider font-bold px-3 py-3 text-blue-400/80 border-l border-border/40">PAGO POR</TableHead>
                        <TableHead
                          className="text-[10px] uppercase tracking-wider font-bold px-3 py-3 text-blue-400/80 text-right cursor-pointer select-none"
                          onClick={() => toggleSort('valor_pago')}
                        >
                          VALOR PAGO <SortIcon col="valor_pago" />
                        </TableHead>
                        {/* Colunas dinâmicas por cotista — % e Rateio */}
                        {cotistasCols.map(c => (
                          <React.Fragment key={c.id}>
                            <TableHead className="text-[10px] uppercase tracking-wider font-bold px-2 py-3 text-emerald-400/80 border-l border-border/40 text-center whitespace-nowrap">
                              {c.nome}<br />
                              <span className="text-[9px] font-normal text-muted-foreground">{c.percentual.toFixed(2)}%</span>
                            </TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider font-bold px-2 py-3 text-emerald-400/80 text-right whitespace-nowrap">
                              RATEIO
                            </TableHead>
                          </React.Fragment>
                        ))}
                      </TableRow>
                      {/* Sub-header de grupos */}
                      <TableRow className="bg-muted/10 border-b border-border/30">
                        <TableHead colSpan={4} className="text-[9px] text-muted-foreground/60 px-3 py-1"></TableHead>
                        <TableHead colSpan={3} className="text-[9px] text-amber-400/60 font-semibold px-3 py-1 border-l border-border/40">
                          QUALIFICAÇÃO DE CUSTO
                        </TableHead>
                        <TableHead colSpan={2} className="text-[9px] text-blue-400/60 font-semibold px-3 py-1 border-l border-border/40">
                          PAGAMENTO
                        </TableHead>
                        {cotistasCols.map(c => (
                          <TableHead key={c.id} colSpan={2} className="text-[9px] text-emerald-400/60 font-semibold px-2 py-1 border-l border-border/40 text-center">
                            RATEIO — {c.nome}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={9 + cotistasCols.length * 2} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm text-muted-foreground">Carregando lançamentos...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : lancamentosFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9 + cotistasCols.length * 2} className="text-center py-12 text-muted-foreground">
                            Nenhum lançamento encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        lancamentosFiltrados.map((l, idx) => {
                          const tipoCfg = TIPO_CONFIG[l.tipo] || TIPO_CONFIG['FIXO'];
                          const prazoCfg = PRAZO_CONFIG[l.prazo] || PRAZO_CONFIG['CURTO PRAZO'];
                          const catColor = CATEGORIA_COLORS[l.categoria] || '#94a3b8';

                          return (
                            <TableRow
                              key={l.id}
                              className={`border-b border-border/30 hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}
                            >
                              <TableCell className="text-xs font-mono px-3 py-2.5 whitespace-nowrap">
                                {fmtDate(l.data)}
                              </TableCell>
                              <TableCell className="text-xs font-mono px-3 py-2.5 text-muted-foreground">
                                {l.doc || '—'}
                              </TableCell>
                              <TableCell className="text-xs px-3 py-2.5 max-w-[140px]">
                                <span className="truncate block" title={l.fornecedor}>{l.fornecedor || '—'}</span>
                              </TableCell>
                              <TableCell className="text-xs px-3 py-2.5 max-w-[180px]">
                                <span className="truncate block" title={l.descricao}>{l.descricao}</span>
                              </TableCell>

                              {/* Qualificação */}
                              <TableCell className="px-3 py-2.5 border-l border-border/20">
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                                  style={{ backgroundColor: catColor + '20', color: catColor, border: `1px solid ${catColor}40` }}
                                >
                                  {l.categoria}
                                </span>
                              </TableCell>
                              <TableCell className="px-3 py-2.5">
                                <Badge className={`text-[10px] ${tipoCfg.bg} ${tipoCfg.color} border font-medium`}>
                                  {tipoCfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-3 py-2.5">
                                <Badge variant="outline" className={`text-[10px] ${prazoCfg.bg} ${prazoCfg.color} border`}>
                                  {l.prazo}
                                </Badge>
                              </TableCell>

                              {/* Pagamento */}
                              <TableCell className="text-xs px-3 py-2.5 border-l border-border/20 whitespace-nowrap">
                                <span className={`font-medium ${l.origem === 'direto' ? 'text-amber-400' : 'text-blue-400'}`}>
                                  {l.pago_por || '—'}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs font-mono font-semibold px-3 py-2.5 text-right whitespace-nowrap">
                                {fmtBRL(l.valor_pago)}
                              </TableCell>

                              {/* Colunas dinâmicas por cotista */}
                              {cotistasCols.map(c => {
                                const r = l.rateios.find(x => x.cliente_id === c.id);
                                const pct = r?.percentual || 0;
                                const val = r?.valor_rateado || 0;
                                const pago = r?.valor_pago_real || 0;

                                return (
                                  <React.Fragment key={c.id}>
                                    <TableCell className="text-[10px] px-2 py-2.5 text-center border-l border-border/20">
                                      {pct > 0 ? (
                                        <span className="font-mono text-muted-foreground">{pct.toFixed(4)}%</span>
                                      ) : <span className="text-muted-foreground/30">—</span>}
                                    </TableCell>
                                    <TableCell className={`text-xs font-mono px-2 py-2.5 text-right ${val === 0 ? 'text-muted-foreground/30'
                                        : pago >= val ? 'text-emerald-400'
                                          : pago > 0 ? 'text-amber-400'
                                            : 'text-foreground'
                                      }`}>
                                      {val > 0 ? (
                                        <div>
                                          <div className="font-semibold">{fmtBRL(val)}</div>
                                          {pago > 0 && pago !== val && (
                                            <div className="text-[9px] text-emerald-400/70">Pago: {fmtBRL(pago)}</div>
                                          )}
                                          {pago >= val && val > 0 && (
                                            <div className="text-[9px] text-emerald-400/70 flex items-center gap-0.5 justify-end">
                                              <CheckCircle2 className="h-2.5 w-2.5" />pago
                                            </div>
                                          )}
                                        </div>
                                      ) : '—'}
                                    </TableCell>
                                  </React.Fragment>
                                );
                              })}
                            </TableRow>
                          );
                        })
                      )}

                      {/* Linha de Totais */}
                      {lancamentosFiltrados.length > 0 && (
                        <TableRow className="bg-primary/10 border-t-2 border-primary/30 font-bold">
                          <TableCell colSpan={4} className="px-3 py-3 text-sm font-bold text-primary">
                            TOTAL GERAL
                          </TableCell>
                          <TableCell className="border-l border-border/40 px-3 py-3" />
                          <TableCell className="px-3 py-3" />
                          <TableCell className="px-3 py-3" />
                          <TableCell className="border-l border-border/40 px-3 py-3" />
                          <TableCell className="text-right font-mono font-bold text-sm px-3 py-3 text-primary">
                            {fmtBRL(lancamentosFiltrados.reduce((s, l) => s + l.valor_pago, 0))}
                          </TableCell>
                          {cotistasCols.map(c => {
                            const totalRateado = lancamentosFiltrados.reduce((s, l) => {
                              const r = l.rateios.find(x => x.cliente_id === c.id);
                              return s + (r?.valor_rateado || 0);
                            }, 0);
                            return (
                              <React.Fragment key={c.id}>
                                <TableCell className="border-l border-border/40 px-2 py-3" />
                                <TableCell className="text-right font-mono font-bold text-sm px-2 py-3 text-emerald-400">
                                  {fmtBRL(totalRateado)}
                                </TableCell>
                              </React.Fragment>
                            );
                          })}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════════════════════════════════════════
              TAB 2: RESUMO POR CATEGORIA (pivot)
          ════════════════════════════════════════ */}
          <TabsContent value="pivot" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Pivot table — replica imagem 3 */}
              <Card className="border border-border/50 bg-card/60 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Soma de Valor Pago — por Categoria × Cotista
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-[10px] uppercase font-bold px-3 py-2.5">CATEGORIA</TableHead>
                          {cotistasCols.map(c => (
                            <TableHead key={c.id} className="text-[10px] uppercase font-bold px-3 py-2.5 text-right text-emerald-400/80">
                              {c.nome}
                            </TableHead>
                          ))}
                          <TableHead className="text-[10px] uppercase font-bold px-3 py-2.5 text-right text-primary">TOTAL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {CATEGORIAS_ORDEM.filter(cat => totais.porCategoria[cat]).map(cat => {
                          const catTotal = Object.values(totais.porCategoria[cat] || {}).reduce((s, v) => s + v, 0);
                          const catColor = CATEGORIA_COLORS[cat] || '#94a3b8';
                          return (
                            <TableRow key={cat} className="hover:bg-primary/5 border-b border-border/30">
                              <TableCell className="px-3 py-2.5">
                                <span
                                  className="text-xs font-semibold px-2 py-0.5 rounded"
                                  style={{ color: catColor }}
                                >
                                  {cat}
                                </span>
                              </TableCell>
                              {cotistasCols.map(c => (
                                <TableCell key={c.id} className="text-right font-mono text-xs px-3 py-2.5">
                                  {(totais.porCategoria[cat]?.[c.id] || 0) > 0
                                    ? fmtBRL(totais.porCategoria[cat][c.id])
                                    : <span className="text-muted-foreground/30">—</span>
                                  }
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-mono font-bold text-xs px-3 py-2.5 text-primary">
                                {fmtBRL(catTotal)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Linha de totais */}
                        <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                          <TableCell className="font-bold text-xs px-3 py-2.5 text-primary">TOTAL GERAL</TableCell>
                          {cotistasCols.map(c => (
                            <TableCell key={c.id} className="text-right font-mono font-bold text-xs px-3 py-2.5 text-emerald-400">
                              {fmtBRL(Object.values(totais.porCategoria).reduce((s, cats) => s + (cats[c.id] || 0), 0))}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-bold text-sm px-3 py-2.5 text-primary">
                            {fmtBRL(totais.totalGeral)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico de barras agrupado — replica imagem 3 */}
              <Card className="border border-border/50 bg-card/60 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Soma de Valor Pago — Gráfico
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pivotData} margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="categoria"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        angle={-20}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                        formatter={(v: number) => fmtBRL(v)}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {cotistasCols.map((c, i) => (
                        <Bar
                          key={c.id}
                          dataKey={c.nome}
                          fill={['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'][i % 5]}
                          radius={[3, 3, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico pizza por categoria */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-border/50 bg-card/60 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Distribuição por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={CATEGORIA_COLORS[entry.name] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => fmtBRL(v)}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Breakdown por tipo de custo */}
              <Card className="border border-border/50 bg-card/60 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Breakdown por Tipo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  {(['FIXO', 'VARIÁVEL P/ VOO', 'VARIÁVEL P/ HORA', 'EXTRA'] as TipoCusto[]).map(tipo => {
                    const valor = totais.porTipo[tipo] || 0;
                    const pct = totais.totalGeral > 0 ? (valor / totais.totalGeral) * 100 : 0;
                    const cfg = TIPO_CONFIG[tipo];
                    return (
                      <div key={tipo} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className={`font-medium ${cfg.color}`}>{tipo}</span>
                          <span className="font-mono font-semibold">{fmtBRL(valor)}</span>
                        </div>
                        <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: cfg.color.replace('text-', '').includes('amber') ? '#f59e0b'
                                : cfg.color.includes('orange') ? '#f97316'
                                  : cfg.color.includes('purple') ? '#8b5cf6'
                                    : '#3b82f6'
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground text-right">{pct.toFixed(1)}%</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ════════════════════════════════════════
              TAB 3: POSIÇÃO POR COTISTA
          ════════════════════════════════════════ */}
          <TabsContent value="cotistas" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(totais.porCotista).map(([id, info]) => {
                const saldo = info.pago - info.devido;
                return (
                  <Card key={id} className="border border-border/50 bg-card/80 rounded-xl">
                    <CardContent className="pt-5 pb-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">{info.nome}</h3>
                        {saldo > 0 ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                            <ArrowUpRight className="h-3 w-3 mr-1" />Crédito
                          </Badge>
                        ) : saldo < 0 ? (
                          <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs">
                            <ArrowDownRight className="h-3 w-3 mr-1" />Débito
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <Minus className="h-3 w-3 mr-1" />Zerado
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                          <p className="text-[10px] text-red-400/70 uppercase tracking-wider">Deve</p>
                          <p className="text-sm font-bold text-red-400 font-mono">{fmtBRL(info.devido)}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Pagou</p>
                          <p className="text-sm font-bold text-emerald-400 font-mono">{fmtBRL(info.pago)}</p>
                        </div>
                      </div>

                      <Separator className="bg-border/40" />

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">Saldo</span>
                        <span className={`text-base font-bold font-mono ${saldo >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                          {saldo >= 0 ? '+' : ''}{fmtBRL(saldo)}
                        </span>
                      </div>

                      {/* Breakdown por categoria para este cotista */}
                      <div className="space-y-1.5">
                        {CATEGORIAS_ORDEM.filter(cat => totais.porCategoria[cat]?.[id]).map(cat => (
                          <div key={cat} className="flex justify-between items-center text-[10px]">
                            <span className="text-muted-foreground" style={{ color: CATEGORIA_COLORS[cat] }}>
                              {cat}
                            </span>
                            <span className="font-mono">{fmtBRL(totais.porCategoria[cat][id])}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Tabela comparativa entre cotistas */}
            {Object.keys(totais.porCotista).length > 0 && (
              <Card className="border border-border/50 bg-card/60 rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    Balanço Comparativo — Todos os Cotistas
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Categoria × cotista: quanto cada um deve e quanto pagou
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-[10px] uppercase font-bold px-3 py-2.5">CATEGORIA</TableHead>
                          {Object.entries(totais.porCotista).map(([id, info]) => (
                            <TableHead key={id} className="text-[10px] uppercase font-bold px-3 py-2.5 text-right text-emerald-400/80">
                              {info.nome}
                            </TableHead>
                          ))}
                          <TableHead className="text-[10px] uppercase font-bold px-3 py-2.5 text-right text-primary">TOTAL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {CATEGORIAS_ORDEM.filter(cat => totais.porCategoria[cat]).map(cat => {
                          const catTotal = Object.values(totais.porCategoria[cat]).reduce((s, v) => s + v, 0);
                          return (
                            <TableRow key={cat} className="border-b border-border/30 hover:bg-primary/5">
                              <TableCell className="px-3 py-2.5 text-xs font-semibold" style={{ color: CATEGORIA_COLORS[cat] }}>
                                {cat}
                              </TableCell>
                              {Object.keys(totais.porCotista).map(id => (
                                <TableCell key={id} className="text-right font-mono text-xs px-3 py-2.5">
                                  {totais.porCategoria[cat]?.[id]
                                    ? fmtBRL(totais.porCategoria[cat][id])
                                    : <span className="text-muted-foreground/30">—</span>
                                  }
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-mono font-bold text-xs px-3 py-2.5 text-primary">
                                {fmtBRL(catTotal)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-primary/10 border-t-2 border-primary/30">
                          <TableCell className="font-bold text-xs px-3 py-3 text-primary">TOTAL GERAL</TableCell>
                          {Object.entries(totais.porCotista).map(([id, info]) => (
                            <TableCell key={id} className="text-right font-mono font-bold text-sm px-3 py-3 text-emerald-400">
                              {fmtBRL(info.devido)}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-mono font-bold text-sm px-3 py-3 text-primary">
                            {fmtBRL(totais.totalGeral)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}