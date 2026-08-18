import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Layers,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Trash2,
  Pencil,
  HandCoins,
  CheckCircle2,
  CalendarDays,
  Building2,
  PiggyBank,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatBRL } from "@/lib/format";
import BaixaPagamentoModal from "./BaixaPagamentoModal";
import ReembolsoModal from "./ReembolsoModal";
import EditLancamentoModal from "./EditLancamentoModal";
import AttachmentViewerModal from "./AttachmentViewerModal";
import NovaDespesaShareForm from "./NovaDespesaShareForm";
import NovaDespesaClienteForm from "./NovaDespesaClienteForm";
import { useColumnWidths } from "@/hooks/useColumnWidths";
import { resolverSubcategoriasAtivas } from "./categoryFilters";

/* ───────────── coluna redimensionável (estilo Excel) ───────────── */

function ResizableTh({
  colId,
  width,
  onResize,
  className = "",
  children,
}: {
  colId: string;
  width?: number;
  onResize: (id: string, w: number) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const startX = e.clientX;
    const startW = width ?? th.getBoundingClientRect().width;
    const move = (ev: MouseEvent) => onResize(colId, Math.max(60, startW + (ev.clientX - startX)));
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <th
      className={`relative group/th ${className}`}
      style={width ? { width, minWidth: width, maxWidth: width } : undefined}
    >
      <div className="truncate">{children}</div>
      <span
        onMouseDown={startDrag}
        onDoubleClick={(e) => { e.stopPropagation(); onResize(colId, 120); }}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none bg-transparent hover:bg-primary/50 group-hover/th:bg-border transition-colors"
      />
    </th>
  );
}


/* ─────────────────────────── types ─────────────────────────── */

/** Cliente DGA — movimentações exibidas em roxo no financeiro Share */
const CLIENTE_DGA_ID = "738850b2-d19c-496b-b2d3-35ecc64bd862";

interface Movimentacao {
  id: string;
  origem?: "rateio_abastecimento";
  descricao: string | null;
  /** @deprecated coluna não existe em `movimentacoes` — usar `fluxo` */
  tipo: string | null;
  fluxo: string | null;
  tipo_caixa: string | null;
  valor?: string | number | null;
  valor_original?: string | number | null;
  valor_total?: string | number | null;
  aeronave_id?: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  clientes_id: string | null;
  socio_id: string | null;
  categoria_id: string | null;
  categoria_nome: string | null;
  status: string | null;
  forma_pagamento: string | null;
  fornecedor_nome: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  numero_boleto: string | null;
  numero_recibo: string | null;
  comprovante_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  recibo_url: string | null;
  conta_bancaria: string | null;
  reembolsavel: boolean | null;
  reembolso_quitado: boolean | null;
  observacoes: string | null;
  reference_type: string | null;
  contas_apagar_id: string | null;
  contas_areceber_id: string | null;
  pago_diretamente: boolean | null;
  percentual_uso: string | number | null;
  valor_rateado: string | number | null;
  valor_pago_real: string | number | null;
  pago_por: string | null;
  socios_nome: string | null;
}

interface Categoria { id: string; nome: string; grupo_categoria: string | null }
interface Pessoa { id: string; nome: string | null }

type RateioDespesa = Database["public"]["Tables"]["rateio_despesas"]["Row"];

const movimentacaoDeRateioAbastecimento = (rateio: RateioDespesa): Movimentacao => ({
  id: rateio.despesa_id,
  origem: "rateio_abastecimento",
  descricao: rateio.descricao_despesa,
  tipo: null,
  fluxo: rateio.fluxo,
  tipo_caixa: "cliente",
  valor: rateio.valor_pago_real ?? rateio.valor_total ?? rateio.valor_rateado,
  valor_total: rateio.valor_total,
  aeronave_id: rateio.aeronave_id,
  data_emissao: rateio.data_emissao,
  data_vencimento: rateio.data_vencimento,
  data_pagamento: rateio.data_pagamento,
  clientes_id: rateio.cliente_id,
  socio_id: rateio.socio_id,
  categoria_id: rateio.categoria_custo,
  categoria_nome: rateio.categoria_nome,
  status: rateio.status,
  forma_pagamento: rateio.forma_pagamento,
  fornecedor_nome: rateio.fornecedor_nome,
  numero_doc: rateio.numero_doc,
  numero_nf: rateio.numero_nf,
  numero_boleto: rateio.numero_boleto,
  numero_recibo: rateio.numero_recibo,
  comprovante_url: rateio.comprovante_url,
  nf_url: rateio.nf_url,
  boleto_url: rateio.boleto_url,
  recibo_url: rateio.recibo_url,
  conta_bancaria: rateio.conta_bancaria,
  reembolsavel: false,
  reembolso_quitado: false,
  observacoes: rateio.observacoes,
  reference_type: "abastecimento",
  contas_apagar_id: null,
  contas_areceber_id: null,
  pago_diretamente: rateio.pago_diretamente,
  percentual_uso: rateio.percentual_uso,
  valor_rateado: rateio.valor_rateado,
  valor_pago_real: rateio.valor_pago_real,
  pago_por: rateio.pago_por,
  socios_nome: rateio.socios_nome,
});

/* ─────────────────────────── helpers ─────────────────────────── */

const norm = (s?: string | null) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// Meses do ano, usados pelo filtro de "Mês" acima da tabela.
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const periodKeyFromDate = (d?: string | null): string | null => {
  const value = String(d || "");
  return /^\d{4}-(0[1-9]|1[0-2])/.test(value) ? value.slice(0, 7) : null;
};

const periodLabel = (period: string) => {
  const month = Number(period.slice(5, 7)) - 1;
  return `${MESES[month]} ${period.slice(0, 4)}`;
};

const GRUPOS_EMPRESA = [
  "DESPESAS EMPRESA",
  "DESPESAS EMPRESA - BANCO",
  "DESPESAS PARTICULARES",
  "FOLHA DE PAGAMENTO",
  "IMPOSTOS",
  "RECEITAS OPERACIONAIS",
];

const isGrupoEmpresa = (grupo: string | null | undefined) =>
  !!grupo && GRUPOS_EMPRESA.some((g) => norm(grupo) === norm(g));
const isGrupoReembolsavel = (grupo: string | null | undefined) =>
  !!grupo && norm(grupo) === norm("DESPESAS REEMBOLSÁVEIS");

const num = (v: string | number | null | undefined) => Number(v) || 0;

const valorDe = (m: Movimentacao) => num(m.valor_rateado) || num(m.valor) || num(m.valor_original);
// valor_total é o campo real da tabela (valor_original não existe em `movimentacoes`).
const valorTotalDe = (m: Movimentacao) => num(m.valor_total) || num(m.valor_original) || valorDe(m);

const aguardandoReembolso = (m: Movimentacao) =>
  !!m.reembolsavel && !m.reembolso_quitado &&
  (norm(m.fluxo) === "aguardando_reembolso" || norm(m.status) === "aguardando_reembolso" || !!m.data_pagamento);

const isEntrada = (m: Movimentacao) => {
  // `fluxo` é a coluna real da tabela (valores: entrada | saida | despesa | estorno).
  // Um estorno devolve dinheiro ao caixa, então também conta como entrada.
  const f = norm(m.fluxo);
  return f === "entrada" || f === "estorno" || f === "receita" || f === "credito" || f === "deposito";
};

const isShare = (m: Movimentacao) => norm(m.tipo_caixa) === "share";

/** Despesa de cliente que saiu do caixa da Share (não foi paga direto pelo cliente). */
const pagoPelaShare = (m: Movimentacao) =>
  !isShare(m) && !isEntrada(m) && !m.pago_diretamente && aguardandoReembolso(m);

/**
 * Identifica lançamentos da conta comum da DGA , independentemente de tipo_caixa.
 * A conta é cadastrada em `contas_bancarias` como "DGA - BRADESCO 1868-6", mas o texto
 * salvo em `movimentacoes.conta_bancaria` varia (com/sem número, hífen normal ou travessão),
 * por isso o match é por "contém DGA".
 */
const isDGA = (m: Movimentacao) => norm(m.conta_bancaria).includes("dga");


const formatDate = (d?: string | null) =>
  d ? new Date(d + (d.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

function txnId(m: Movimentacao): string {
  const d = m.data_emissao || m.data_vencimento || m.data_pagamento || "";
  const ym = d.slice(2, 4) + d.slice(5, 7);
  const suffix = m.id.replace(/-/g, "").slice(-4).toUpperCase();
  return `TXN-${ym || "0000"}-${suffix}`;
}

type StatusKind = "pago" | "pendente" | "vencido" | "deposito" | "reembolsado" | "cancelado";

function statusOf(m: Movimentacao): { label: string; kind: StatusKind } {
  const s = norm(m.status);
  if (s === "cancelado" || s === "rejeitado") return { label: "Cancelado", kind: "cancelado" };
  if (s === "pendente" || s === "aguardando_reembolso") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (m.data_vencimento) {
      const venc = new Date(m.data_vencimento + "T00:00:00"); venc.setHours(0, 0, 0, 0);
      if (venc < today) return { label: "Vencido", kind: "vencido" };
    }
    return { label: "Pendente", kind: "pendente" };
  }
  if (m.reembolsavel && m.reembolso_quitado) return { label: "Reembolsado", kind: "reembolsado" };
  const isDeposit = norm(m.tipo) === "deposito" || norm(m.tipo_caixa) === "deposito";
  if (isDeposit) return { label: "Depósito", kind: "deposito" };
  const pago = s === "aprovado" || s === "pago" || s === "quitado" || s === "confirmado" || s === "receita paga" || s === "despesa paga" || !!m.data_pagamento;
  if (pago) return { label: "Pago", kind: "pago" };
  if (m.data_vencimento) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const venc = new Date(m.data_vencimento + "T00:00:00"); venc.setHours(0, 0, 0, 0);
    if (venc < today) return { label: "Vencido", kind: "vencido" };
  }
  return { label: "Pendente", kind: "pendente" };
}

function StatusBadge({ m }: { m: Movimentacao }) {
  const { label, kind } = statusOf(m);
  const cfg: Record<StatusKind, { bg: string; text: string; border: string; Icon: React.FC<any> }> = {
    pago:        { bg: "rgba(34,197,94,0.10)",  text: "#4ade80", border: "rgba(34,197,94,0.25)",  Icon: Check },
    reembolsado: { bg: "rgba(56,189,248,0.10)", text: "#38bdf8", border: "rgba(56,189,248,0.25)", Icon: Check },
    deposito:    { bg: "rgba(45,212,191,0.10)", text: "#2dd4bf", border: "rgba(45,212,191,0.25)", Icon: ArrowDownRight },
    pendente:    { bg: "rgba(245,158,11,0.10)", text: "#fbbf24", border: "rgba(245,158,11,0.25)", Icon: Clock },
    vencido:     { bg: "rgba(239,68,68,0.10)",  text: "#f87171", border: "rgba(239,68,68,0.25)",  Icon: Clock },
    cancelado:   { bg: "rgba(100,116,139,0.10)",text: "#94a3b8", border: "rgba(100,116,139,0.25)",Icon: X },
  };
  const c = cfg[kind];
  const Icon = c.Icon;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function StatusDot({ m }: { m: Movimentacao }) {
  const { kind } = statusOf(m);
  const color: Record<StatusKind, string> = {
    pago: "bg-emerald-400", reembolsado: "bg-sky-400", deposito: "bg-teal-400",
    pendente: "bg-amber-400", vencido: "bg-red-400", cancelado: "bg-slate-500",
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color[kind]}`} />;
}

/* ─────────────────────────── tabs ─────────────────────────── */

type TabKey = "caixa_share" | "caixa_cliente" | "caixa_dga" | "despesas_reembolsaveis" | "contas_pagar" | "contas_receber";
type FlowFilter = "todos" | "saidas" | "entradas";

const TABS: { key: TabKey; label: string; icon: React.FC<any> }[] = [
  { key: "caixa_share",             label: "Caixa Share",             icon: Layers },
  { key: "caixa_cliente",           label: "Caixa Cliente",           icon: Wallet },
  { key: "caixa_dga",               label: "DGA",           icon: Building2 },
  { key: "despesas_reembolsaveis",  label: "Despesas Reembolsáveis",  icon: HandCoins },
  { key: "contas_pagar",            label: "Contas a Pagar",          icon: TrendingDown },
  { key: "contas_receber",          label: "Contas a Receber",        icon: TrendingUp },
];

/* ─────────────────────────── main component ─────────────────────────── */

export default function FluxoCaixaTab() {
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [categorias, setCategorias] = useState<Record<string, string>>({});
  const [categoriaGrupos, setCategoriaGrupos] = useState<Record<string, string>>({});
  const [categoriasCliente, setCategoriasCliente] = useState<Record<string, string>>({});
  const [categoriaCustoPorDespesa, setCategoriaCustoPorDespesa] = useState<Record<string, string>>({});
  const [pessoas, setPessoas] = useState<Record<string, Pessoa>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("caixa_share");
  const [flowFilter, setFlowFilter] = useState<FlowFilter>("todos");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [baixaMov, setBaixaMov] = useState<Movimentacao | null>(null);
  const [editMovId, setEditMovId] = useState<string | null>(null);
  const [showNewMov, setShowNewMov] = useState(false);
  const [newMovCaixa, setNewMovCaixa] = useState<"share" | "cliente">("share");
  const [viewAttachment, setViewAttachment] = useState<{ url: string; title: string } | null>(null);
  const [sortBy, setSortBy] = useState<"data" | "nome">("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "pago" | "vencido">("todos");
  const [contasCaixa, setContasCaixa] = useState<"share" | "cliente">("share");
  const [dateMode, setDateMode] = useState<"pagamento" | "emissao">("pagamento");
  // null = todos os meses; o valor YYYY-MM evita misturar o mesmo mês de anos diferentes.
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedDgaCard, setSelectedDgaCard] = useState<string | null>(null);
  const { columnWidths, setColumnWidth } = useColumnWidths("fluxo-caixa-share", {
    data: 130, descricao: 260, categoria: 150, cliente: 170, valor: 130, status: 130, docs: 90,
  });
  const [reembolsoMov, setReembolsoMov] = useState<Movimentacao | null>(null);
  const [sociosPorCliente, setSociosPorCliente] = useState<Record<string, string[]>>({});
  const [subcatsPorDespesa, setSubcatsPorDespesa] = useState<Record<string, string[]>>({});
  const [conferidoPorDespesa, setConferidoPorDespesa] = useState<Record<string, boolean>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  /* ── movimentacoes ── */
  const fetchMovs = useCallback(async () => {
    setLoading(true);
    try {
      const [movimentacoes, abastecimentos] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select("*")
          .order("data_emissao", { ascending: false })
          .limit(5000),
        supabase
          .from("rateio_despesas")
          .select("*")
          .eq("fonte_despesa", "abastecimento")
          .limit(5000),
      ]);
      if (movimentacoes.error) throw movimentacoes.error;
      if (abastecimentos.error) throw abastecimentos.error;

      const registros = (movimentacoes.data ?? []) as unknown as Movimentacao[];
      const idsDeMovimentacoes = new Set(registros.map((movimentacao) => movimentacao.id));
      const abastecimentosSemMovimentacao = (abastecimentos.data ?? [])
        .filter((rateio) => !idsDeMovimentacoes.has(rateio.despesa_id))
        .map(movimentacaoDeRateioAbastecimento);

      setMovs([...registros, ...abastecimentosSemMovimentacao]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMovs(); }, [fetchMovs]);

  /* ── categorias ── */
  useEffect(() => {
    supabase.from("categorias_movimentacao").select("id,nome,grupo_categoria").eq("ativo", true)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        const grupos: Record<string, string> = {};
        (data ?? []).forEach((c: Categoria) => {
          map[c.id] = c.nome;
          if (c.grupo_categoria) grupos[c.id] = c.grupo_categoria;
        });
        setCategorias(map);
        setCategoriaGrupos(grupos);
      });
  }, []);

  /* ── categorias e subcategorias do caixa cliente ── */
  useEffect(() => {
    Promise.all([
      supabase.from("expense_configu").select("id,expense_type,subcategoria_1,subcategoria_2,subcategoria_3,subcategoria_4"),
      supabase
        .from("rateio_despesas")
        .select("despesa_id,categoria_custo,subcategoria_1,subcategoria_2,subcategoria_3,subcategoria_4,conferido"),
    ]).then(([expenseConfig, rateios]) => {
      const categoriasMap: Record<string, string> = {};
      const subcatsConfig: Record<string, string[]> = {};
      (expenseConfig.data ?? []).forEach((categoria: any) => {
        if (categoria.expense_type) categoriasMap[categoria.id] = categoria.expense_type.trim();
        const subs = [categoria.subcategoria_1, categoria.subcategoria_2, categoria.subcategoria_3, categoria.subcategoria_4]
          .filter((s: any) => !!s && String(s).trim())
          .map((s: any) => String(s).trim());
        if (subs.length) subcatsConfig[categoria.id] = subs;
      });
      setCategoriasCliente(categoriasMap);

      const rateioMap: Record<string, string> = {};
      const subMap: Record<string, string[]> = {};
      const conferidoMap: Record<string, boolean> = {};
      const rateiosPorDespesa = new Map<string, any[]>();

      (rateios.data ?? []).forEach((rateio: any) => {
        if (!rateio.despesa_id) return;
        if (!rateiosPorDespesa.has(rateio.despesa_id)) {
          rateiosPorDespesa.set(rateio.despesa_id, []);
        }
        rateiosPorDespesa.get(rateio.despesa_id)?.push(rateio);
      });

      rateiosPorDespesa.forEach((linhas, despesaId) => {
        const linhaPrincipal = linhas[linhas.length - 1] ?? linhas[0];
        if (!linhaPrincipal) return;

        if (linhaPrincipal.categoria_custo) rateioMap[despesaId] = linhaPrincipal.categoria_custo;
        if (linhaPrincipal.conferido) conferidoMap[despesaId] = true;

        const fallback = linhaPrincipal.categoria_custo ? subcatsConfig[linhaPrincipal.categoria_custo] ?? [] : [];
        const subcategorias = resolverSubcategoriasAtivas(linhas, fallback);
        if (subcategorias.length) subMap[despesaId] = subcategorias;
      });

      setCategoriaCustoPorDespesa(rateioMap);
      setSubcatsPorDespesa(subMap);
      setConferidoPorDespesa(conferidoMap);
    });
  }, []);

  /* ── pessoas ── */
  useEffect(() => {
    Promise.all([
      supabase.from("clientes").select("id,razao_social,proprietario"),
      supabase.from("socios").select("id,nome,clientes_id"),
    ]).then(([c, s]) => {
      const map: Record<string, Pessoa> = {};
      (c.data ?? []).forEach((x: any) => { map[x.id] = { id: x.id, nome: x.razao_social || x.proprietario }; });
      const porCliente: Record<string, string[]> = {};
      (s.data ?? []).forEach((x: any) => {
        map[x.id] = { id: x.id, nome: x.nome };
        if (x.clientes_id && x.nome) {
          porCliente[x.clientes_id] = [...(porCliente[x.clientes_id] ?? []), x.nome];
        }
      });
      setPessoas(map);
      setSociosPorCliente(porCliente);
    });
  }, []);

  const resolveName = useCallback((m: Movimentacao) => {
    if (m.socio_id && pessoas[m.socio_id]) return pessoas[m.socio_id].nome || "—";
    if (m.clientes_id) {
      const socios = sociosPorCliente[m.clientes_id];
      if (socios?.length) return socios.join(" / ");
      if (pessoas[m.clientes_id]) return pessoas[m.clientes_id].nome || "—";
    }
    return m.fornecedor_nome || "—";
  }, [pessoas, sociosPorCliente]);

  const resolveCliente = useCallback((m: Movimentacao) => {
    if (m.clientes_id && pessoas[m.clientes_id]) return pessoas[m.clientes_id].nome || null;
    return null;
  }, [pessoas]);

  const categoriaOf = useCallback((m: Movimentacao) => {
    if (isShare(m)) {
      return m.categoria_nome || categorias[m.categoria_id ?? ""] || "—";
    }
    const categoriaCusto = categoriaCustoPorDespesa[m.id] || m.categoria_id;
    return categoriasCliente[categoriaCusto ?? ""] || categoriaCusto || "—";
  }, [categorias, categoriasCliente, categoriaCustoPorDespesa]);

  const grupoOf = useCallback((m: Movimentacao) => {
    if (isShare(m)) {
      return categoriaGrupos[m.categoria_id ?? ""] || null;
    }
    const categoriaCusto = categoriaCustoPorDespesa[m.id] || m.categoria_id;
    return categoriaGrupos[categoriaCusto ?? ""] || null;
  }, [categoriaGrupos, categoriaCustoPorDespesa]);

  const dgaAporteNome = useCallback((m: Movimentacao) => (
    m.socios_nome || (m.socio_id ? resolveName(m) : null) || "Não identificado"
  ), [resolveName]);

  const subcategoriasOf = useCallback(
    (m: Movimentacao) => subcatsPorDespesa[m.id] ?? [],
    [subcatsPorDespesa],
  );

  const dateOf = useCallback(
    (m: Movimentacao) =>
      dateMode === "pagamento"
        ? m.data_pagamento || m.data_vencimento || m.data_emissao || ""
        : m.data_emissao || m.data_vencimento || "",
    [dateMode],
  );

  /* ── filtro-base (tudo exceto o filtro de mês) ── */
  const baseFilteredMovs = useMemo(() => {
    let list = movs;
    switch (activeTab) {
      // Caixa Share: lançamentos do caixa share (despesas da empresa) + despesas de
      // cliente que a Share pagou e aguarda reembolso (o dinheiro saiu do caixa da Share).
      case "caixa_share":    list = list.filter((m) => isShare(m) || pagoPelaShare(m));
        list = list.filter((m) => isGrupoEmpresa(grupoOf(m)));
        break;
      // Despesas Reembolsáveis: apenas lançamentos caixa share do grupo reembolsável.
      case "despesas_reembolsaveis": list = list.filter((m) =>
        (isShare(m) || pagoPelaShare(m)) && isGrupoReembolsavel(grupoOf(m))
      ); break;
      // Caixa Cliente: tudo que não é caixa share, exceto a conta comum da DGA — que tem
      // aba própria, pois é um fundo com lógica de aporte de sócios diferente
      // dos demais clientes.
      case "caixa_cliente":  list = list.filter((m) => !isShare(m) && !isDGA(m)); break;
      // DGA : apenas os lançamentos da conta comum, sem filtro de tipo_caixa —
      // aportes dos cotistas (entradas) e despesas pagas pelo fundo (saídas).
      case "caixa_dga":      list = list.filter(isDGA); break;
      case "contas_pagar":   list = list.filter((m) => {
        const isPayable = !isEntrada(m);
        const kind = statusOf(m).kind;
        const isPaid = kind === "pago" || kind === "reembolsado" || kind === "deposito";
        const isPendingOrOverdue = isPayable && !isPaid;
        if (!isPayable) return false;
        if (statusFilter === "pago") {
          return isPaid && (contasCaixa === "share" ? isShare(m) : !isShare(m));
        }
        // Default behavior for Contas a Pagar: show only open payables (pendente/vencido).
        if (!isPendingOrOverdue) return false;
        return contasCaixa === "share" ? isShare(m) : !isShare(m);
      }); break;
      // Contas a Receber: entradas share em aberto + tudo que está aguardando
      // reembolso do cliente (despesa paga pela Share ainda não ressarcida).
      case "contas_receber": list = list.filter((m) =>
        (isEntrada(m) && !m.data_pagamento && isShare(m)) || aguardandoReembolso(m)
      ); break;
    }
    if (flowFilter === "entradas") list = list.filter(isEntrada);
    if (flowFilter === "saidas")   list = list.filter((m) => !isEntrada(m));
    if (search.trim()) {
      const q = norm(search);
      list = list.filter((m) =>
        norm(m.descricao).includes(q) ||
        norm(m.fornecedor_nome).includes(q) ||
        norm(m.numero_doc).includes(q) ||
        norm(resolveName(m)).includes(q) ||
        norm(categoriaOf(m)).includes(q),
      );
    }
    if (dateFrom) list = list.filter((m) => (dateOf(m) || "") >= dateFrom);
    if (dateTo) list = list.filter((m) => (dateOf(m) || "") <= dateTo);
    if (statusFilter !== "todos") {
      list = list.filter((m) => {
        const k = statusOf(m).kind;
        if (statusFilter === "pendente") return k === "pendente" || k === "vencido";
        if (statusFilter === "pago") return k === "pago" || k === "reembolsado" || k === "deposito";
        if (statusFilter === "vencido") return k === "vencido";
        return true;
      });
    }
    return list;
  }, [movs, activeTab, flowFilter, search, resolveName, categoriaOf, dateFrom, dateTo, statusFilter, contasCaixa, dateOf, grupoOf]);

  /* ── períodos disponíveis para o filtro (calculados a partir do filtro-base) ── */
  const availableMonths = useMemo(() => {
    const periods = new Set<string>();
    baseFilteredMovs.forEach((m) => {
      const period = periodKeyFromDate(dateOf(m));
      if (period) periods.add(period);
    });
    return Array.from(periods).sort().reverse();
  }, [baseFilteredMovs, dateOf]);

  useEffect(() => {
    if (selectedMonth !== null && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(null);
    }
  }, [availableMonths, selectedMonth]);

  /* ── filtro de mês ── */
  const monthFilteredMovs = useMemo(() => {
    if (selectedMonth === null) return baseFilteredMovs;
    return baseFilteredMovs.filter((m) => periodKeyFromDate(dateOf(m)) === selectedMonth);
  }, [baseFilteredMovs, selectedMonth, dateOf]);

  /* ── filtro do card DGA + ordenação ── */
  const filteredMovs = useMemo(() => {
    let list = monthFilteredMovs;
    if (activeTab === "caixa_dga" && selectedDgaCard) {
      list = list.filter((m) => isEntrada(m) && dgaAporteNome(m) === selectedDgaCard);
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "data") {
        cmp = (dateOf(a) || "").localeCompare(dateOf(b) || "");
      } else {
        cmp = norm(resolveName(a)).localeCompare(norm(resolveName(b)));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [monthFilteredMovs, activeTab, selectedDgaCard, dateOf, sortBy, sortDir, resolveName, dgaAporteNome]);

  /* ── pagination ── */
  const totalPages = Math.max(1, Math.ceil(filteredMovs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMovs = filteredMovs.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredMovs.length, itemsPerPage, totalPages, currentPage]);

  /* ── KPIs (já refletem o filtro de mês, pois usam filteredMovs) ── */
  const kpis = useMemo(() => {
    let entradas = 0, saidas = 0, pendentes = 0;
    for (const m of filteredMovs) {
      const v = valorDe(m);
      if (isEntrada(m)) entradas += v; else saidas += v;
      const k = statusOf(m).kind;
      if (k === "pendente" || k === "vencido") pendentes += v;
    }
    return { entradas, saidas, saldo: entradas - saidas, pendentes, total: filteredMovs.length };
  }, [filteredMovs]);

  /* ── DGA: saldo em caixa (sempre acumulado, não respeita o filtro de mês — é um saldo,
     não um total do período) + aportes por cotista (respeita mês/busca/status, igual à tabela) ── */
  const dgaStats = useMemo(() => {
    const dgaMovs = movs.filter(isDGA);
    let saldo = 0;
    for (const m of dgaMovs) saldo += isEntrada(m) ? valorDe(m) : -valorDe(m);

    const aportesPorSocio = new Map<string, number>();
    for (const m of monthFilteredMovs) {
      if (activeTab !== "caixa_dga" || !isEntrada(m)) continue;
      const nome = dgaAporteNome(m);
      aportesPorSocio.set(nome, (aportesPorSocio.get(nome) ?? 0) + valorDe(m));
    }
    return {
      saldo,
      totalMovimentos: dgaMovs.length,
      aportes: Array.from(aportesPorSocio.entries())
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total),
    };
  }, [movs, monthFilteredMovs, activeTab, dgaAporteNome]);

  useEffect(() => {
    if (selectedDgaCard && !dgaStats.aportes.some((aporte) => aporte.nome === selectedDgaCard)) {
      setSelectedDgaCard(null);
    }
  }, [dgaStats.aportes, selectedDgaCard]);

  /* ── actions ── */
  const doAction = useCallback(async (m: Movimentacao, action: "baixa" | "rejeitar") => {
    if (action === "baixa") {
      setBaixaMov(m);
      return;
    }
    setActionLoading(m.id + action);
    setToast(null);
    try {
      const update = { status: "cancelado" };
      const { error: e } = await supabase.from("movimentacoes").update(update).eq("id", m.id);
      if (e) throw e;
      setMovs((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...update } : x)));
      setToast({ type: "ok", text: "Lançamento rejeitado." });
      setExpandedId(null);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao processar ação." });
    } finally {
      setActionLoading(null);
    }
  }, []);

  const queryClient = useQueryClient();
  const onBaixaSuccess = useCallback(async (updated: Partial<Movimentacao>) => {
    if (!baixaMov) return;

    setMovs((prev) => prev.map((x) => (x.id === baixaMov.id ? { ...x, ...updated } : x)));
    setToast({ type: "ok", text: "Baixa registrada com sucesso." });
    setBaixaMov(null);
    setExpandedId(null);

    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["movimentacoes"] }),
        queryClient.invalidateQueries({ queryKey: ["contas-receber"] }),
        queryClient.invalidateQueries({ queryKey: ["balanco"] }),
      ]);
      await fetchMovs();
    } catch (error) {
      console.error("Erro ao sincronizar o fluxo de caixa após a baixa:", error);
    }
  }, [baixaMov, fetchMovs, queryClient]);

  const caixaDaTabAtiva = useMemo<"share" | "cliente">(() => (
    activeTab === "caixa_cliente" ? "cliente" :
    activeTab === "contas_pagar" ? contasCaixa :
    "share"
  ), [activeTab, contasCaixa]);

  // Se o usuário troca de tab com o formulário aberto, o formulário acompanha o caixa da tab.
  useEffect(() => {
    setNewMovCaixa(caixaDaTabAtiva);
  }, [caixaDaTabAtiva]);

  const openNewMov = useCallback(() => {
    setNewMovCaixa(caixaDaTabAtiva);
    setShowNewMov(true);
  }, [caixaDaTabAtiva]);


  const onNewMovSaved = useCallback((createdMovs: Movimentacao[]) => {
    setMovs((prev) => [...createdMovs, ...prev]);
    setShowNewMov(false);
    setActiveTab(newMovCaixa === "cliente" ? "caixa_cliente" : "caixa_share");
    setCurrentPage(1);
  }, [newMovCaixa]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Deseja realmente excluir esta movimentação?")) return;
    try {
      const { error: rateioError } = await supabase
        .from("rateio_despesas")
        .delete()
        .eq("despesa_id", id)
        .eq("fonte_despesa", "movimentacoes");
      if (rateioError) throw rateioError;

      const { error: e } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (e) throw e;
      setMovs((prev) => prev.filter((x) => x.id !== id));
      setToast({ type: "ok", text: "Movimentação excluída." });
      setExpandedId(null);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao excluir." });
    }
  }, []);

  const exportPDF = useCallback(() => {
    const win = window.open("", "_blank");
    if (!win) {
      setToast({ type: "err", text: "Permita pop-ups para exportar o PDF." });
      return;
    }
    const tabLabel = TABS.find((t) => t.key === activeTab)?.label || "Fluxo de Caixa";
    const mesLabel = selectedMonth !== null ? ` — ${periodLabel(selectedMonth)}` : "";
    const rows = filteredMovs.map((m) => {
      const entrada = isEntrada(m);
      const name = resolveName(m);
      const date = formatDate(m.data_pagamento || m.data_vencimento || m.data_emissao);
      const status = statusOf(m).label;
      const valor = formatBRL(valorDe(m));
      return `<tr><td>${date}</td><td>${entrada ? "Entrada" : "Saída"}</td><td>${m.descricao || "—"}</td><td>${name}</td><td style="text-align:right">${valor}</td><td>${status}</td></tr>`;
    }).join("");
    const totalReceita = filteredMovs.filter(isEntrada).reduce((s, m) => s + valorDe(m), 0);
    const totalDespesa = filteredMovs.filter((m) => !isEntrada(m)).reduce((s, m) => s + valorDe(m), 0);
    win.document.write(`<!DOCTYPE html><html><head><title>${tabLabel}${mesLabel}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}h1{font-size:18px;margin:0 0 4px}.meta{font-size:11px;color:#64748b;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#f1f5f9;padding:8px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:9px;text-transform:uppercase}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}.tot{margin-top:16px;font-size:12px;display:flex;gap:24px}.tot span{font-weight:bold}</style></head><body><h1>Relatório — ${tabLabel}${mesLabel}</h1><div class="meta">Gerado em ${new Date().toLocaleDateString("pt-BR")} • ${filteredMovs.length} registros</div><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Cliente</th><th style="text-align:right">Valor</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div class="tot"><span>Receitas: ${formatBRL(totalReceita)}</span><span>Despesas: ${formatBRL(totalDespesa)}</span><span>Saldo: ${formatBRL(totalReceita - totalDespesa)}</span></div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }, [filteredMovs, activeTab, resolveName, selectedMonth]);

  // Cores dinâmicas globais para a Tabela e Tabs
  const isShareActive = activeTab === "caixa_share" || activeTab === "despesas_reembolsaveis" || (activeTab === "contas_pagar" && contasCaixa === "share") || activeTab === "contas_receber";
  const isClienteActive = activeTab === "caixa_cliente" || (activeTab === "contas_pagar" && contasCaixa === "cliente");

  const tableHeaderBg = isShareActive ? "rgba(16,185,129,0.08)" : isClienteActive ? "rgba(59,130,246,0.08)" : "rgba(0,0,0,0.2)";
  const tableHeaderBorder = isShareActive ? "rgba(16,185,129,0.25)" : isClienteActive ? "rgba(59,130,246,0.25)" : "rgba(125,125,125,0.2)";

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center justify-between border ${
          toast.type === "ok" ? "bg-success/10 border-success/20 text-success" : "bg-destructive/10 border-destructive/20 text-destructive"
        }`}>
          {toast.text}
          <button onClick={() => setToast(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm border bg-destructive/10 border-destructive/20 text-destructive">{error}</div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          
          let activeClasses = "bg-primary/15 text-primary border-primary/30";
          if (t.key === "caixa_share") activeClasses = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
          else if (t.key === "caixa_cliente") activeClasses = "bg-blue-500/15 text-blue-400 border-blue-500/30";

          return (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key); setSelectedDgaCard(null); setExpandedId(null); setFlowFilter("todos"); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                active ? activeClasses : "bg-card/50 text-muted-foreground border-border hover:text-foreground hover:bg-card/80"
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filtro de mês + total filtrado */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span>Mês</span>
          <select
            value={selectedMonth ?? "todos"}
            onChange={(event) => {
              const v = event.target.value;
              setSelectedMonth(v === "todos" ? null : v);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
          >
            <option value="todos">Todos os meses</option>
            {availableMonths.map((period) => (
              <option key={period} value={period}>{periodLabel(period)}</option>
            ))}
          </select>
        </label>
        <div className="text-sm font-semibold text-foreground">
          Total filtrado:{" "}
          <span className={kpis.saldo >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatBRL(kpis.saldo)}
          </span>
          <span className="ml-2 text-xs font-normal text-muted-foreground">({kpis.total} lançamentos)</span>
        </div>
      </div>

      {/* Formulário Expansor */}
      {showNewMov && (
        <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-top-4 fade-in duration-300">
          {newMovCaixa === "cliente" ? (
            <NovaDespesaClienteForm
              onCancel={() => setShowNewMov(false)}
              onSaved={onNewMovSaved}
            />
          ) : (
            <NovaDespesaShareForm
              onCancel={() => setShowNewMov(false)}
              onSaved={onNewMovSaved}
            />
          )}
        </div>
      )}

      {/* DGA: saldo do fundo + aportes por cotista */}
      {activeTab === "caixa_dga" && (
        <div className="rounded-2xl border border-purple-500/25 bg-purple-500/[0.04] p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-purple-200">
              <PiggyBank className="h-4 w-4" />
              Saldo em Caixa DGA
              <span className="font-normal text-[11px] text-purple-200/60">(acumulado, conta DGA - BRADESCO 1868-6)</span>
            </div>
            <div className={`font-bold text-2xl tracking-tight ${dgaStats.saldo >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {formatBRL(dgaStats.saldo)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-200/70 mb-2">
              Aportes dos cotistas {selectedMonth !== null ? `em ${periodLabel(selectedMonth)}` : "(todos os meses, conforme filtro)"}
            </div>
            {dgaStats.aportes.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Nenhum aporte encontrado para os filtros selecionados.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {dgaStats.aportes.map((a) => {
                  const selected = selectedDgaCard === a.nome;
                  return (
                    <button
                      key={a.nome}
                      type="button"
                      onClick={() => { setSelectedDgaCard(selected ? null : a.nome); setCurrentPage(1); }}
                      aria-pressed={selected}
                      className={`rounded-lg border px-3 py-2 flex items-center justify-between text-left transition-colors ${
                        selected
                          ? "border-purple-300/70 bg-purple-400/20 ring-1 ring-purple-300/40"
                          : "border-purple-500/20 bg-background/40 hover:border-purple-300/50 hover:bg-purple-400/10"
                      }`}
                    >
                      <span className="text-xs font-medium text-foreground">{a.nome}</span>
                      <span className="text-sm font-bold text-emerald-300">{formatBRL(a.total)}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedDgaCard && (
              <div className="flex items-center justify-between gap-3 border-t border-purple-500/20 pt-3 text-xs">
                <span className="text-purple-100/80">Exibindo apenas lançamentos de <strong className="text-foreground">{selectedDgaCard}</strong>.</span>
                <button type="button" onClick={() => { setSelectedDgaCard(null); setCurrentPage(1); }} className="shrink-0 text-purple-200 underline-offset-2 hover:underline">
                  Limpar seleção
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Receita Total" value={kpis.entradas} tone="green" icon={ArrowUpRight} />
        <KpiCard label="Despesa Total" value={kpis.saidas} tone="red" icon={ArrowDownRight} />
        <KpiCard label="Saldo Líquido" value={kpis.saldo} tone={kpis.saldo >= 0 ? "blue" : "red"} icon={Wallet} />
        <KpiCard label="Pendências"    value={kpis.pendentes} tone="amber" icon={Clock} />
      </div>

      {/* Table card */}
      <div className="rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm border border-border bg-card/60 shadow-xl">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border bg-background/40">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground">Lançamentos</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">{filteredMovs.length} registros</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border mr-2">
              {(["todos", "saidas", "entradas"] as FlowFilter[]).map((f) => (
                <button key={f} onClick={() => { setFlowFilter(f); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    flowFilter === f ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {f === "todos" ? "Todos" : f === "saidas" ? "Saídas" : "Entradas"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input type="text" placeholder="Buscar lançamentos..." value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background/60 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all w-48 sm:w-64" />
            </div>
            <button onClick={fetchMovs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted/60 transition-colors bg-background/60">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
            <button onClick={() => { setShowFilterPanel(!showFilterPanel); setShowSortMenu(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-background/60 ${showFilterPanel ? "border-primary/40 text-primary" : "border-border text-foreground hover:bg-muted/60"}`}>
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            <div className="relative">
              <button onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterPanel(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-background/60 ${showSortMenu ? "border-primary/40 text-primary" : "border-border text-foreground hover:bg-muted/60"}`}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> Ordenar
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-popover shadow-xl py-1">
                    {([
                      { by: "data" as const, dir: "asc" as const, label: "Data — Crescente" },
                      { by: "data" as const, dir: "desc" as const, label: "Data — Decrescente" },
                      { by: "nome" as const, dir: "asc" as const, label: "Nome do Cotista — Crescente" },
                      { by: "nome" as const, dir: "desc" as const, label: "Nome do Cotista — Decrescente" },
                    ]).map((opt) => {
                      const active = sortBy === opt.by && sortDir === opt.dir;
                      return (
                        <button key={opt.label} onClick={() => { setSortBy(opt.by); setSortDir(opt.dir); setShowSortMenu(false); }}
                          className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition ${active ? "text-primary bg-primary/10" : "text-popover-foreground hover:bg-muted/60"}`}>
                          {active ? <Check className="h-3 w-3 shrink-0" /> : <span className="w-3 shrink-0" />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-foreground hover:bg-muted/60 transition-colors bg-background/60">
              <Download className="h-3.5 w-3.5" /> Exportar PDF
            </button>
            <button onClick={openNewMov} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-foreground transition-colors shadow-sm bg-primary hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" /> Nova
            </button>
          </div>
        </div>

        {/* Contas a pagar caixa sub-toggle */}
        {activeTab === "contas_pagar" && (
          <div className="px-5 py-2.5 border-b border-border flex items-center gap-3 bg-background/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Caixa:</span>
            <div className="flex bg-muted/60 p-0.5 rounded-lg border border-border">
              {(["share", "cliente"] as const).map((c) => (
                <button key={c} onClick={() => { setContasCaixa(c); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${contasCaixa === c ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
                  {c === "share" ? "Caixa Share" : "Caixa Cliente"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter panel */}
        {showFilterPanel && (
          <div className="px-5 py-4 border-b border-border space-y-3 bg-background/30">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Data De</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-border bg-input px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Data Até</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-border bg-input px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full rounded-lg border border-border bg-input px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary">
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>
            </div>
            {(dateFrom || dateTo || statusFilter !== "todos" || selectedMonth !== null) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("todos"); setSelectedMonth(null); }} className="text-xs text-muted-foreground hover:text-foreground transition">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30" style={{ transition: 'background 0.3s ease' }}>
                <th className="w-4 px-4 py-3" />
                <ResizableTh colId="data" width={columnWidths.data} onResize={setColumnWidth} className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setDateMode((v) => (v === "pagamento" ? "emissao" : "pagamento"))}
                    title="Clique para alternar entre data de pagamento e data de emissão"
                    className="flex items-center gap-1 uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
                  >
                    Data {dateMode === "pagamento" ? "Pagamento" : "Emissão"}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </ResizableTh>
                <ResizableTh colId="descricao" width={columnWidths.descricao} onResize={setColumnWidth} className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descrição</ResizableTh>
                <ResizableTh colId="categoria" width={columnWidths.categoria} onResize={setColumnWidth} className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Categoria</ResizableTh>
                <ResizableTh colId="cliente" width={columnWidths.cliente} onResize={setColumnWidth} className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Cliente</ResizableTh>
                <ResizableTh colId="valor" width={columnWidths.valor} onResize={setColumnWidth} className="text-right px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor</ResizableTh>
                <ResizableTh colId="status" width={columnWidths.status} onResize={setColumnWidth} className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Status</ResizableTh>
                <ResizableTh colId="docs" width={columnWidths.docs} onResize={setColumnWidth} className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Docs</ResizableTh>
                <th className="w-8 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ações</th>

              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td colSpan={9} className="p-4"><div className="h-8 bg-muted/50 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : paginatedMovs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-muted-foreground text-sm">
                    Nenhum lançamento encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedMovs.map((m) => {
                  const entrada = isEntrada(m);
                  const expanded = expandedId === m.id;
                  const name = resolveName(m);
                  const clienteNome = resolveCliente(m);
                  const cat = categoriaOf(m);
                  const subcats = subcategoriasOf(m);
                  const tid = txnId(m);
                  const dateStr = formatDate(dateOf(m));
                  const isPaid = !!m.data_pagamento;
                  const docCount = [m.nf_url, m.comprovante_url, m.boleto_url, m.recibo_url].filter(Boolean).length;

                  return (
                    <RowFragment key={m.id} m={m} entrada={entrada} expanded={expanded} name={name}
                      clienteNome={clienteNome} cat={cat} subcats={subcats}
                      tid={tid} dateStr={dateStr} isPaid={isPaid} docCount={docCount}
                      conferido={!!conferidoPorDespesa[m.id]}
                      onToggle={() => setExpandedId(expanded ? null : m.id)}
                      onApprove={() => doAction(m, "baixa")}
                      onEdit={() => setEditMovId(m.id)}
                      onDelete={() => handleDelete(m.id)}
                      onOpenAttachment={(url, title) => setViewAttachment({ url, title })}
                      onReembolso={aguardandoReembolso(m) ? () => setReembolsoMov(m) : undefined}
                      actionLoading={actionLoading} 
                      isShareRow={isShare(m)} />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-border px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 bg-background/40">
          <div className="text-xs text-muted-foreground font-medium">
            Mostrando {filteredMovs.length === 0 ? 0 : startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredMovs.length)} de {filteredMovs.length} registros
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden sm:inline">Linhas por página:</span>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-border bg-background/60 rounded-md px-2 py-1 text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer">
                <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-background/60 px-2 py-1 rounded-md border border-border">
              <span className="text-muted-foreground">Page</span>
              <input type="number" min={1} max={totalPages} value={currentPage}
                onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) setCurrentPage(Math.max(1, Math.min(totalPages, val))); }}
                className="w-10 border border-border rounded text-center text-foreground bg-input outline-none focus:ring-1 focus:ring-primary py-0.5" />
              <span className="text-muted-foreground">of {totalPages}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-border bg-background/60 text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-md border border-border bg-background/60 text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      {baixaMov && (
        <BaixaPagamentoModal
          mov={baixaMov}
          onClose={() => setBaixaMov(null)}
          onSuccess={onBaixaSuccess}
        />
      )}
      {reembolsoMov && (
        <ReembolsoModal
          mov={reembolsoMov}
          onClose={() => setReembolsoMov(null)}
          onSuccess={(patch) => { setReembolsoMov(null); onBaixaSuccess(patch || {}); }}
        />
      )}
      {editMovId && (
        <EditLancamentoModal
          movId={editMovId}
          onClose={() => setEditMovId(null)}
          onSaved={(movPatch: any) => { setEditMovId(null); onBaixaSuccess(movPatch || {}); }}
        />
      )}

      {viewAttachment && (
        <AttachmentViewerModal
          url={viewAttachment.url}
          title={viewAttachment.title}
          onClose={() => setViewAttachment(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── RowFragment ─────────────────────────── */

function RowFragment({ m, entrada, expanded, name, clienteNome, cat, subcats, tid, dateStr, isPaid, docCount,
  conferido, onToggle, onApprove, onEdit, onDelete, onOpenAttachment, onReembolso, actionLoading, isShareRow }: {
  m: Movimentacao; entrada: boolean; expanded: boolean; name: string; clienteNome?: string | null;
  cat: string; subcats: string[]; tid: string;
  dateStr: string; isPaid: boolean; docCount: number; conferido: boolean;
  onToggle: () => void; onApprove: () => void; onEdit: () => void; onDelete: () => void;
  onOpenAttachment: (url: string, title: string) => void;
  onReembolso?: () => void;
  actionLoading: string | null;
  isShareRow: boolean;
}) {
  const [rateio, setRateio] = useState<any>(null);
  const [loadingRateio, setLoadingRateio] = useState(false);
  const somenteLeitura = m.origem === "rateio_abastecimento";

  // Paleta de Cores baseadas no tipo de Caixa (Share = Verde, Cliente = Azul, DGA = Roxo)
  const isDga = (m as any).clientes_id === CLIENTE_DGA_ID;
  const theme = isDga ? {
    textMain: "text-purple-50",
    textMuted: "text-purple-200/60",
    catBg: "bg-purple-500/10",
    catText: "text-purple-400",
    catBorder: "border-purple-500/30",
    subBg: "bg-purple-500/5",
    subText: "text-purple-400/80",
    subBorder: "border-purple-500/20",
    hoverBg: "hover:bg-purple-900/20",
    expandedBg: "rgba(76,29,149,0.18)",
    borderBottom: "rgba(168,85,247,0.25)"
  } : isShareRow ? {
    textMain: "text-emerald-50",
    textMuted: "text-emerald-200/60",
    catBg: "bg-emerald-500/10",
    catText: "text-emerald-400",
    catBorder: "border-emerald-500/30",
    subBg: "bg-emerald-500/5",
    subText: "text-emerald-400/80",
    subBorder: "border-emerald-500/20",
    hoverBg: "hover:bg-emerald-900/20",
    expandedBg: "rgba(6,78,59,0.15)",
    borderBottom: "rgba(16,185,129,0.15)"
  } : {
    textMain: "text-blue-50",
    textMuted: "text-blue-200/60",
    catBg: "bg-blue-500/10",
    catText: "text-blue-400",
    catBorder: "border-blue-500/30",
    subBg: "bg-blue-500/5",
    subText: "text-blue-400/80",
    subBorder: "border-blue-500/20",
    hoverBg: "hover:bg-blue-900/20",
    expandedBg: "rgba(30,58,138,0.15)",
    borderBottom: "rgba(59,130,246,0.15)"
  };


  useEffect(() => {
    if (!expanded || rateio) return;
    let cancel = false;
    setLoadingRateio(true);
    (async () => {
      const { data } = await supabase
        .from("rateio_despesas")
        .select("*")
        .eq("despesa_id", m.id)
        .maybeSingle();
      if (!cancel) {
        setRateio(data || null);
        setLoadingRateio(false);
      }
    })();
    return () => { cancel = true; };
  }, [expanded, m.id, rateio]);

  const attachments = [
    { url: m.nf_url, label: "Nota Fiscal", color: "text-cyan-300 hover:border-cyan-400/40" },
    { url: m.comprovante_url, label: "Comprovante", color: "text-emerald-300 hover:border-emerald-400/40" },
    { url: m.boleto_url, label: "Boleto", color: "text-amber-300 hover:border-amber-400/40" },
    { url: m.recibo_url, label: "Recibo", color: "text-sky-300 hover:border-sky-400/40" },
  ].filter((a) => !!a.url);

  const fmtDate = (d?: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
  const fmtNum = (n?: number | string | null) => n != null && n !== "" ? formatBRL(Number(n)) : "—";
  const detail = (label: string, value: any) => (
    <div><span className={theme.textMuted}>{label}:</span> <span className={`font-medium ${theme.textMain}`}>{value ?? "—"}</span></div>
  );

  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer transition-colors ${theme.hoverBg}`}
        style={{ borderBottom: `1px solid ${theme.borderBottom}`, background: expanded ? theme.expandedBg : undefined }}>
        <td className="px-4 py-3.5"><StatusDot m={m} /></td>
        <td className="px-3 py-3.5 whitespace-nowrap">
          <div className={`font-bold text-[12px] ${theme.textMain}`}>{dateStr}</div>
          <div className="flex items-center gap-1 mt-0.5">
            {entrada ? <ArrowUpRight className="h-3 w-3 text-emerald-400" /> : <ArrowDownRight className="h-3 w-3 text-red-400" />}
            <span className={`text-[10px] font-semibold ${entrada ? "text-emerald-300" : "text-red-300"}`}>{entrada ? "Entrada" : "Saída"}</span>
          </div>
        </td>
        <td className="px-3 py-3.5 max-w-[200px]">
          <span className={`block truncate font-semibold ${theme.textMain}`} title={m.descricao ?? ""}>{m.descricao || "—"}</span>
          {m.numero_doc && <span className={`text-[10px] ${theme.textMuted}`}>Doc: {m.numero_doc}</span>}
        </td>
        <td className="px-3 py-3.5 hidden sm:table-cell">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${theme.catBg} ${theme.catText} ${theme.catBorder}`}>{cat}</span>
          {subcats.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {subcats.map((s) => (
                <span key={s} className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium border ${theme.subBg} ${theme.subText} ${theme.subBorder}`}>{s}</span>
              ))}
            </div>
          )}
        </td>
        <td className="px-3 py-3.5 hidden md:table-cell">
          <div className={`text-[11px] font-medium truncate max-w-[150px] ${theme.textMain}`}>{name}</div>
          {clienteNome && clienteNome !== name && (
            <div className={`text-[10px] truncate max-w-[150px] ${theme.textMuted}`}>{clienteNome}</div>
          )}
        </td>
        <td className="px-3 py-3.5 text-right whitespace-nowrap">
          <span className={`font-bold text-[13px] ${entrada ? "text-emerald-300" : theme.textMain}`}>
            {entrada ? "+" : ""} {formatBRL(valorDe(m))}
          </span>
          {valorTotalDe(m) > valorDe(m) && (
            <div className={`text-[10px] ${theme.textMuted}`}>Total: {formatBRL(valorTotalDe(m))}</div>
          )}
        </td>
        <td className="px-3 py-3.5 text-center hidden sm:table-cell">
          <div className="flex flex-col items-center gap-1">
            <StatusBadge m={m} />
            {conferido && (
              <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                <CheckCircle2 className="h-2.5 w-2.5" /> Conferido
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3.5 text-center hidden md:table-cell">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${theme.textMuted}`}>{docCount}<Paperclip className="h-3 w-3" /></span>
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center justify-end gap-2">
            {onReembolso && (
              <button onClick={(e) => { e.stopPropagation(); onReembolso(); }}
                className="p-1.5 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded transition-colors" title="Receber reembolso do cliente">
                <HandCoins className="h-3.5 w-3.5" />
              </button>
            )}
            {!somenteLeitura && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors" title="Deletar">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 ${theme.textMuted} transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ borderBottom: `1px solid ${theme.borderBottom}`, background: theme.expandedBg }}>
          <td colSpan={9} className="px-5 py-4">
            <div className={`flex flex-col gap-5 text-xs ${theme.textMain}`}>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className={`font-bold text-[10px] uppercase tracking-wider mb-2 ${theme.textMuted}`}>Documentos Anexos</div>
                  <div className="flex flex-wrap gap-2">
                    {attachments.length === 0 && <span className={`${theme.textMuted} italic`}>Nenhum documento anexado.</span>}
                    {attachments.map((a) => (
                      <button
                        key={a.label}
                        onClick={(e) => { e.stopPropagation(); onOpenAttachment(a.url as string, a.label); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded bg-background/60 border border-border font-medium transition-colors ${a.color}`}
                      >
                        <FileText className="h-3.5 w-3.5" /> {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {somenteLeitura ? (
                    <span className="px-4 py-2 rounded-lg text-xs font-bold bg-muted/60 text-muted-foreground border border-border text-center">Gerenciado em Abastecimentos</span>
                  ) : (
                    <>
                      {!isPaid ? (
                        <button onClick={(e) => { e.stopPropagation(); onApprove(); }} disabled={actionLoading !== null}
                          className="px-6 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50" style={{ background: "#0e7490", minWidth: 100 }}>
                          {actionLoading === m.id + "baixa" ? <RefreshCw className="h-3.5 w-3.5 animate-spin mx-auto" /> : "Dar Baixa"}
                        </button>
                      ) : (
                        <span className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-400/20 text-center">Quitado</span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="px-6 py-2 rounded-lg text-xs font-bold text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/10 flex items-center justify-center gap-1.5" style={{ minWidth: 100 }}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {aguardandoReembolso(m) && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80 mb-1">
                    Fluxo do reembolso — lançamento único
                  </div>
                  <div className="text-xs text-amber-100/90 leading-relaxed">
                    Despesa <strong>paga pelo caixa da Share</strong>
                    {m.data_pagamento ? ` em ${formatDate(m.data_pagamento)}` : ""} no valor de{" "}
                    <strong>{formatBRL(valorTotalDe(m))}</strong>
                    {clienteNome ? <> — a Share <strong>aguarda o reembolso de {clienteNome}</strong></> : " — aguardando reembolso do cliente"}
                    {" "}no valor de <strong>{formatBRL(valorDe(m))}</strong>.
                  </div>
                  <div className="mt-1 text-[11px] text-amber-200/60">
                    É um único lançamento: saída no caixa Share + conta a receber do cliente (não gera despesa duplicada).
                  </div>
                </div>
              )}

              <div>

                <div className={`font-bold text-[10px] uppercase tracking-wider mb-2 ${theme.textMuted}`}>
                  Detalhes Financeiros {loadingRateio && <span className="opacity-70">(carregando rateio...)</span>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-y-2 gap-x-4">
                  {detail("Data Emissão", fmtDate(rateio?.data_emissao))}
                  {detail("Data Vencimento", fmtDate(rateio?.data_vencimento || m.data_vencimento))}
                  {detail("Data Pagamento", fmtDate(rateio?.data_pagamento || m.data_pagamento))}
                  {detail("Tipo Rateio", rateio?.tipo_rateio)}
                  {detail("Nº Doc", rateio?.numero_doc || m.numero_doc)}
                  {detail("Nº NF", rateio?.numero_nf || m.numero_nf)}
                  {detail("Nº Recibo", rateio?.numero_recibo || m.numero_recibo)}
                  {detail("Forma Pagamento", rateio?.forma_pagamento || m.forma_pagamento)}
                  {detail("Periodicidade", rateio?.periodicidade)}
                  {detail("Pago por", rateio?.pago_por || m.pago_por)}
                  {detail("% Uso", rateio?.percentual_uso != null ? `${rateio.percentual_uso}%` : null)}
                  {detail("% Sociedade", rateio?.percentual_sociedade != null ? `${rateio.percentual_sociedade}%` : null)}
                  {detail("Valor Total", fmtNum(rateio?.valor_total_despesa))}
                  {detail("Valor Rateado", fmtNum(rateio?.valor_rateado))}
                  {detail("Valor Pago Real", fmtNum(rateio?.valor_pago_real ?? valorDe(m)))}
                  {detail("Conta", m.conta_bancaria || m.conta_bancaria)}
                </div>
                {(rateio?.observacoes || m.observacoes) && (
                  <div className="mt-3">
                    <span className={theme.textMuted}>Observações:</span>{" "}
                    <span className={`font-medium ${theme.textMain}`}>{rateio?.observacoes || m.observacoes}</span>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─────────────────────────── KpiCard ─────────────────────────── */

function KpiCard({ label, value, tone, icon: Icon }: {
  label: string; value: number; tone: "green" | "red" | "amber" | "blue"; icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
}) {
  const cfg = {
    green: { bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.15)",  text: "#4ade80", iconBg: "rgba(34,197,94,0.12)" },
    red:   { bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.15)",  text: "#f87171", iconBg: "rgba(239,68,68,0.12)" },
    amber: { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)", text: "#fbbf24", iconBg: "rgba(245,158,11,0.12)" },
    blue:  { bg: "rgba(59,130,246,0.06)", border: "rgba(59,130,246,0.15)", text: "#60a5fa", iconBg: "rgba(59,130,246,0.12)" },
  }[tone];
  return (
    <div className="rounded-xl p-4 border border-border bg-card/50 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: cfg.iconBg }}>
          <Icon className="h-4 w-4" style={{ color: cfg.text } as React.CSSProperties} />
        </div>
      </div>
      <div className="font-bold text-xl tracking-tight" style={{ color: cfg.text }}>{formatBRL(value)}</div>
    </div>
  );
}
