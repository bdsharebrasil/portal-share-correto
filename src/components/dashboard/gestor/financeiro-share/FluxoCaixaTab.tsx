import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import BaixaPagamentoModal from "./BaixaPagamentoModal";
import ReembolsoModal from "./ReembolsoModal";
import EditLancamentoModal from "./EditLancamentoModal";
import AttachmentViewerModal from "./AttachmentViewerModal";

/* ─────────────────────────── types ─────────────────────────── */

interface Movimentacao {
  id: string;
  descricao: string | null;
  tipo: string | null;
  tipo_caixa: string | null;
  valor?: string | number | null;
  valor_original?: string | number | null;
  aeronave_id?: string | null;
  data_competencia: string | null;
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
  banco_nome: string | null;
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
}

interface Categoria { id: string; nome: string }
interface Pessoa { id: string; nome: string | null }

/* ─────────────────────────── helpers ─────────────────────────── */

const norm = (s?: string | null) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const num = (v: string | number | null | undefined) => Number(v) || 0;

/** A tabela `movimentacoes` não possui coluna `valor`: o valor da linha é o rateado. */
const valorDe = (m: Movimentacao) => num(m.valor_rateado) || num(m.valor) || num(m.valor_original);
/** Valor cheio da despesa (o que a Share desembolsa quando adianta pelo cliente). */
const valorTotalDe = (m: Movimentacao) => num(m.valor_original) || valorDe(m);

const aguardandoReembolso = (m: Movimentacao) =>
  !!m.reembolsavel && !m.reembolso_quitado &&
  (norm(m.tipo) === "aguardando_reembolso" || norm(m.status) === "aguardando_reembolso" || !!m.data_pagamento);

const isEntrada = (m: Movimentacao) => {
  const t = norm(m.tipo);
  return t === "receita" || t === "entrada" || t === "credito" || t === "deposito";
};

const isShare = (m: Movimentacao) => norm(m.tipo_caixa) === "share";

const formatDate = (d?: string | null) =>
  d ? new Date(d + (d.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

function txnId(m: Movimentacao): string {
  const d = m.data_competencia || m.data_vencimento || m.data_pagamento || "";
  const ym = d.slice(2, 4) + d.slice(5, 7);
  const suffix = m.id.replace(/-/g, "").slice(-4).toUpperCase();
  return `TXN-${ym || "0000"}-${suffix}`;
}

type StatusKind = "pago" | "pendente" | "vencido" | "deposito" | "reembolsado" | "cancelado";

function statusOf(m: Movimentacao): { label: string; kind: StatusKind } {
  const s = norm(m.status);
  if (s === "cancelado" || s === "rejeitado") return { label: "Cancelado", kind: "cancelado" };
  if (m.reembolsavel && m.reembolso_quitado) return { label: "Reembolsado", kind: "reembolsado" };
  const isDeposit = norm(m.tipo) === "deposito" || norm(m.tipo_caixa) === "deposito";
  if (isDeposit) return { label: "Depósito", kind: "deposito" };
  const pago = !!m.data_pagamento || s === "aprovado" || s === "pago" || s === "quitado" || s === "confirmado" || s === "receita paga" || s === "despesa paga";
  if (pago) return { label: "Pago", kind: "pago" };
  if (m.data_vencimento && new Date(m.data_vencimento) < new Date()) return { label: "Vencido", kind: "vencido" };
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

type TabKey = "caixa_share" | "caixa_cliente" | "contas_pagar" | "contas_receber";
type FlowFilter = "todos" | "saidas" | "entradas";

const TABS: { key: TabKey; label: string; icon: React.FC<any> }[] = [
  { key: "caixa_share",    label: "Caixa Share",      icon: Layers },
  { key: "caixa_cliente",  label: "Caixa Cliente",    icon: Wallet },
  { key: "contas_pagar",   label: "Contas a Pagar",   icon: TrendingDown },
  { key: "contas_receber", label: "Contas a Receber", icon: TrendingUp },
];

/* ─────────────────────────── main component ─────────────────────────── */

export default function FluxoCaixaTab() {
  const [movs, setMovs] = useState<Movimentacao[]>([]);
  const [categorias, setCategorias] = useState<Record<string, string>>({});
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
  const [newMov, setNewMov] = useState({ descricao: "", tipo: "saida", categoria_id: "", valor_rateado: "", data_competencia: new Date().toISOString().slice(0, 10), data_vencimento: "", fornecedor_nome: "", reembolsavel: false });
  const [savingNewMov, setSavingNewMov] = useState(false);
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
  const [reembolsoMov, setReembolsoMov] = useState<Movimentacao | null>(null);
  const [sociosPorCliente, setSociosPorCliente] = useState<Record<string, string[]>>({});
  const [subcatsPorDespesa, setSubcatsPorDespesa] = useState<Record<string, string[]>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  /* ── movimentacoes ── */
  const fetchMovs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: e } = await supabase
        .from("movimentacoes")
        .select("*")
        .order("data_competencia", { ascending: false });
      if (e) throw e;
      setMovs((data ?? []) as unknown as Movimentacao[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMovs(); }, [fetchMovs]);

  /* ── categorias ── */
  useEffect(() => {
    supabase.from("categorias_movimentacao").select("id,nome").eq("ativo", true)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((c: Categoria) => { map[c.id] = c.nome; });
        setCategorias(map);
      });
  }, []);

  /* ── categorias e subcategorias do caixa cliente ── */
  useEffect(() => {
    Promise.all([
      supabase.from("expense_configu").select("id,expense_type,subcategoria_1,subcategoria_2,subcategoria_3,subcategoria_4"),
      supabase
        .from("rateio_despesas")
        .select("despesa_id,categoria_custo,subcategoria_1,subcategoria_2,subcategoria_3,subcategoria_4"),
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
      (rateios.data ?? []).forEach((rateio: any) => {
        if (!rateio.despesa_id) return;
        if (rateio.categoria_custo) rateioMap[rateio.despesa_id] = rateio.categoria_custo;
        const subs = [rateio.subcategoria_1, rateio.subcategoria_2, rateio.subcategoria_3, rateio.subcategoria_4]
          .filter((s: any) => !!s && String(s).trim())
          .map((s: any) => String(s).trim());
        const fallback = rateio.categoria_custo ? subcatsConfig[rateio.categoria_custo] ?? [] : [];
        const final = subs.length ? subs : fallback;
        if (final.length) subMap[rateio.despesa_id] = final;
      });
      setCategoriaCustoPorDespesa(rateioMap);
      setSubcatsPorDespesa(subMap);
    });
  }, []);

  /* ── pessoas ── */
  useEffect(() => {
    Promise.all([
      supabase.from("clientes").select("id,razao_social,proprietario"),
      supabase.from("socios").select("id,nome,cliente_id"),
    ]).then(([c, s]) => {
      const map: Record<string, Pessoa> = {};
      (c.data ?? []).forEach((x: any) => { map[x.id] = { id: x.id, nome: x.razao_social || x.proprietario }; });
      const porCliente: Record<string, string[]> = {};
      (s.data ?? []).forEach((x: any) => {
        map[x.id] = { id: x.id, nome: x.nome };
        if (x.cliente_id && x.nome) {
          porCliente[x.cliente_id] = [...(porCliente[x.cliente_id] ?? []), x.nome];
        }
      });
      setPessoas(map);
      setSociosPorCliente(porCliente);
    });
  }, []);

  /** Nome exibido na coluna Cliente — prioriza o nome do sócio quando o cliente possui sócios. */
  const resolveName = useCallback((m: Movimentacao) => {
    if (m.socio_id && pessoas[m.socio_id]) return pessoas[m.socio_id].nome || "—";
    if (m.clientes_id) {
      const socios = sociosPorCliente[m.clientes_id];
      if (socios?.length) return socios.join(" / ");
      if (pessoas[m.clientes_id]) return pessoas[m.clientes_id].nome || "—";
    }
    return m.fornecedor_nome || "—";
  }, [pessoas, sociosPorCliente]);

  /** Razão social do cliente (exibida como subtítulo quando mostramos o sócio). */
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

  const subcategoriasOf = useCallback(
    (m: Movimentacao) => subcatsPorDespesa[m.id] ?? [],
    [subcatsPorDespesa],
  );

  /** Data exibida/filtrada conforme o modo escolhido na coluna "Data". */
  const dateOf = useCallback(
    (m: Movimentacao) =>
      dateMode === "pagamento"
        ? m.data_pagamento || m.data_vencimento || m.data_competencia || ""
        : m.data_competencia || m.data_vencimento || "",
    [dateMode],
  );

  /* ── filter ── */
  const filteredMovs = useMemo(() => {
    let list = movs;
    switch (activeTab) {
      case "caixa_share":    list = list.filter(isShare); break;
      case "caixa_cliente":  list = list.filter((m) => !isShare(m)); break;
      case "contas_pagar":   list = list.filter((m) => {
        const pending = !isEntrada(m) && !m.data_pagamento;
        if (!pending) return false;
        return contasCaixa === "share" ? isShare(m) : !isShare(m);
      }); break;
      case "contas_receber": list = list.filter((m) => isEntrada(m) && !m.data_pagamento && isShare(m)); break;
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
  }, [movs, activeTab, flowFilter, search, resolveName, categoriaOf, dateFrom, dateTo, statusFilter, sortBy, sortDir, contasCaixa, dateOf]);

  /* ── pagination ── */
  const totalPages = Math.max(1, Math.ceil(filteredMovs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMovs = filteredMovs.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredMovs.length, itemsPerPage, totalPages, currentPage]);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    let entradas = 0, saidas = 0, pendentes = 0;
    for (const m of filteredMovs) {
      const v = num(m.valor);
      if (isEntrada(m)) entradas += v; else saidas += v;
      const k = statusOf(m).kind;
      if (k === "pendente" || k === "vencido") pendentes += v;
    }
    return { entradas, saidas, saldo: entradas - saidas, pendentes, total: filteredMovs.length };
  }, [filteredMovs]);

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

  const onBaixaSuccess = useCallback((updated: Partial<Movimentacao>) => {
    if (!baixaMov) return;
    setMovs((prev) => prev.map((x) => (x.id === baixaMov.id ? { ...x, ...updated } : x)));
    setToast({ type: "ok", text: "Baixa registrada com sucesso." });
    setBaixaMov(null);
    setExpandedId(null);
  }, [baixaMov]);

  const openNewMov = useCallback(() => {
    const tipoCaixa = activeTab === "caixa_cliente" ? "cliente" : "share";
    setNewMov({ descricao: "", tipo: "saida", categoria_id: "", valor_rateado: "", data_competencia: new Date().toISOString().slice(0, 10), data_vencimento: "", fornecedor_nome: "", reembolsavel: false });
    setShowNewMov(true);
  }, [activeTab]);

  const saveNewMov = useCallback(async () => {
    if (!newMov.descricao.trim() || !newMov.valor_rateado || Number(newMov.valor_rateado) <= 0) {
      setToast({ type: "err", text: "Informe descrição e valor válido." });
      return;
    }
    setSavingNewMov(true);
    try {
      const tipoCaixa = activeTab === "caixa_cliente" ? "cliente" : "share";
      const categoriaNome = tipoCaixa === "share" ? categorias[newMov.categoria_id] : categoriasCliente[newMov.categoria_id];
      const payload = {
        descricao: newMov.descricao.trim(),
        tipo: newMov.tipo,
        tipo_caixa: tipoCaixa,
        categoria_id: newMov.categoria_id || null,
        categoria_nome: categoriaNome || null,
        valor_rateado: Number(newMov.valor_rateado),
        valor_original: Number(newMov.valor_rateado),
        data_competencia: newMov.data_competencia || null,
        data_vencimento: newMov.data_vencimento || null,
        fornecedor_nome: newMov.fornecedor_nome.trim() || null,
        reembolsavel: newMov.reembolsavel,
        reembolso_quitado: false,
        status: "pendente",
      };
      const { data, error: e } = await supabase.from("movimentacoes").insert(payload).select("*").single();
      if (e) throw e;
      setMovs((prev) => [data as Movimentacao, ...prev]);
      setShowNewMov(false);
      setToast({ type: "ok", text: `Lançamento criado no Caixa ${tipoCaixa === "share" ? "Share" : "Cliente"}.` });
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao criar lançamento." });
    } finally {
      setSavingNewMov(false);
    }
  }, [activeTab, categorias, categoriasCliente, newMov]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Deseja realmente excluir esta movimentação?")) return;
    try {
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
    const rows = filteredMovs.map((m) => {
      const entrada = isEntrada(m);
      const name = resolveName(m);
      const date = formatDate(m.data_pagamento || m.data_vencimento || m.data_competencia);
      const status = statusOf(m).label;
      const valor = formatBRL(num(m.valor));
      return `<tr><td>${date}</td><td>${entrada ? "Entrada" : "Saída"}</td><td>${m.descricao || "—"}</td><td>${name}</td><td style="text-align:right">${valor}</td><td>${status}</td></tr>`;
    }).join("");
    const totalReceita = filteredMovs.filter(isEntrada).reduce((s, m) => s + num(m.valor), 0);
    const totalDespesa = filteredMovs.filter((m) => !isEntrada(m)).reduce((s, m) => s + num(m.valor), 0);
    win.document.write(`<!DOCTYPE html><html><head><title>${tabLabel}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}h1{font-size:18px;margin:0 0 4px}.meta{font-size:11px;color:#64748b;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#f1f5f9;padding:8px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:9px;text-transform:uppercase}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}.tot{margin-top:16px;font-size:12px;display:flex;gap:24px}.tot span{font-weight:bold}</style></head><body><h1>Relatório — ${tabLabel}</h1><div class="meta">Gerado em ${new Date().toLocaleDateString("pt-BR")} • ${filteredMovs.length} registros</div><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Cliente</th><th style="text-align:right">Valor</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div class="tot"><span>Receitas: ${formatBRL(totalReceita)}</span><span>Despesas: ${formatBRL(totalDespesa)}</span><span>Saldo: ${formatBRL(totalReceita - totalDespesa)}</span></div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }, [filteredMovs, activeTab, resolveName]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center justify-between border ${
          toast.type === "ok" ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-300" : "bg-red-500/10 border-red-400/20 text-red-300"
        }`}>
          {toast.text}
          <button onClick={() => setToast(null)}><X className="h-4 w-4" /></button>
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm border bg-red-500/10 border-red-400/20 text-red-300">{error}</div>
      )}

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button key={t.key}
              onClick={() => { setActiveTab(t.key); setExpandedId(null); setFlowFilter("todos"); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                active ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/30" : "bg-slate-900/70 text-slate-400 border-slate-700 hover:text-slate-100 hover:bg-slate-800"
              }`}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Receita Total" value={kpis.entradas} tone="green" icon={ArrowUpRight} />
        <KpiCard label="Despesa Total" value={kpis.saidas} tone="red" icon={ArrowDownRight} />
        <KpiCard label="Saldo Líquido" value={kpis.saldo} tone={kpis.saldo >= 0 ? "blue" : "red"} icon={Wallet} />
        <KpiCard label="Pendências"    value={kpis.pendentes} tone="amber" icon={Clock} />
      </div>

      {/* Table card */}
      <div className="rounded-2xl overflow-hidden flex flex-col backdrop-blur-sm"
        style={{ border: "1px solid rgba(30,41,59,0.8)", background: "rgba(15,23,42,0.7)", boxShadow: "0 20px 60px rgba(2,6,23,0.35)" }}>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b"
          style={{ borderColor: "rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.6)" }}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-100">Lançamentos</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300">{filteredMovs.length} registros</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-slate-800/70 p-0.5 rounded-lg border border-slate-700 mr-2">
              {(["todos", "saidas", "entradas"] as FlowFilter[]).map((f) => (
                <button key={f} onClick={() => { setFlowFilter(f); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    flowFilter === f ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-100"
                  }`}>
                  {f === "todos" ? "Todos" : f === "saidas" ? "Saídas" : "Entradas"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input type="text" placeholder="Buscar lançamentos..." value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all w-48 sm:w-64 bg-slate-950/70" />
            </div>
            <button onClick={fetchMovs} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors bg-slate-950/70">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
            <button onClick={() => { setShowFilterPanel(!showFilterPanel); setShowSortMenu(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-slate-950/70 ${showFilterPanel ? "border-cyan-400/40 text-cyan-300" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}>
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            <div className="relative">
              <button onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterPanel(false); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors bg-slate-950/70 ${showSortMenu ? "border-cyan-400/40 text-cyan-300" : "border-slate-700 text-slate-200 hover:bg-slate-800"}`}>
                <SlidersHorizontal className="h-3.5 w-3.5" /> Ordenar
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-xl py-1">
                    {([
                      { by: "data" as const, dir: "asc" as const, label: "Data — Crescente" },
                      { by: "data" as const, dir: "desc" as const, label: "Data — Decrescente" },
                      { by: "nome" as const, dir: "asc" as const, label: "Nome do Cotista — Crescente" },
                      { by: "nome" as const, dir: "desc" as const, label: "Nome do Cotista — Decrescente" },
                    ]).map((opt) => {
                      const active = sortBy === opt.by && sortDir === opt.dir;
                      return (
                        <button key={opt.label} onClick={() => { setSortBy(opt.by); setSortDir(opt.dir); setShowSortMenu(false); }}
                          className={`flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition ${active ? "text-cyan-300 bg-cyan-500/10" : "text-slate-300 hover:bg-slate-800"}`}>
                          {active ? <Check className="h-3 w-3 shrink-0" /> : <span className="w-3 shrink-0" />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors bg-slate-950/70">
              <Download className="h-3.5 w-3.5" /> Exportar PDF
            </button>
            <button onClick={openNewMov} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 transition-colors shadow-sm" style={{ background: "#06b6d4" }}>
              <Plus className="h-3.5 w-3.5" /> Nova
            </button>
          </div>
        </div>

        {/* Contas a pagar caixa sub-toggle */}
        {activeTab === "contas_pagar" && (
          <div className="px-5 py-2.5 border-b flex items-center gap-3" style={{ borderColor: "rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.4)" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Caixa:</span>
            <div className="flex bg-slate-800/70 p-0.5 rounded-lg border border-slate-700">
              {(["share", "cliente"] as const).map((c) => (
                <button key={c} onClick={() => { setContasCaixa(c); setCurrentPage(1); }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${contasCaixa === c ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-100"}`}>
                  {c === "share" ? "Caixa Share" : "Caixa Cliente"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter panel */}
        {showFilterPanel && (
          <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: "rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.4)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Data De</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Data Até</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400">
                  <option value="todos">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>
            </div>
            {(dateFrom || dateTo || statusFilter !== "todos") && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); setStatusFilter("todos"); }} className="text-xs text-slate-400 hover:text-slate-200 transition">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.7)" }}>
                <th className="w-4 px-4 py-3" />
                <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setDateMode((v) => (v === "pagamento" ? "emissao" : "pagamento"))}
                    title="Clique para alternar entre data de pagamento e data de emissão"
                    className="flex items-center gap-1 uppercase tracking-wider text-slate-400 hover:text-cyan-300 transition-colors"
                  >
                    Data {dateMode === "pagamento" ? "Pagamento" : "Emissão"}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Descrição</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Categoria</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Cliente</th>
                <th className="text-right px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor</th>
                <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Status</th>
                <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Docs</th>
                <th className="w-8 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(30,41,59,0.7)" }}>
                    <td colSpan={9} className="p-4"><div className="h-8 bg-slate-800/70 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : paginatedMovs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500 text-sm">
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
                      onToggle={() => setExpandedId(expanded ? null : m.id)}
                      onApprove={() => doAction(m, "baixa")}
                      onEdit={() => setEditMovId(m.id)}
                      onDelete={() => handleDelete(m.id)}
                      onOpenAttachment={(url, title) => setViewAttachment({ url, title })}
                      onReembolso={aguardandoReembolso(m) ? () => setReembolsoMov(m) : undefined}
                      actionLoading={actionLoading} />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderColor: "rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.6)" }}>
          <div className="text-xs text-slate-400 font-medium">
            Mostrando {filteredMovs.length === 0 ? 0 : startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredMovs.length)} de {filteredMovs.length} registros
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 hidden sm:inline">Linhas por página:</span>
              <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-slate-700 bg-slate-900/70 rounded-md px-2 py-1 text-slate-200 outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer">
                <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/70 px-2 py-1 rounded-md border border-slate-700">
              <span className="text-slate-400">Page</span>
              <input type="number" min={1} max={totalPages} value={currentPage}
                onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) setCurrentPage(Math.max(1, Math.min(totalPages, val))); }}
                className="w-10 border border-slate-700 rounded text-center text-slate-100 bg-slate-950/70 outline-none focus:ring-1 focus:ring-cyan-400 py-0.5" />
              <span className="text-slate-400">of {totalPages}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1.5 rounded-md border border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-md border border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
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
      {showNewMov && (
        <NewMovimentacaoModal
          tipoCaixa={activeTab === "caixa_cliente" ? "cliente" : "share"}
          categorias={activeTab === "caixa_cliente" ? categoriasCliente : categorias}
          form={newMov}
          saving={savingNewMov}
          onChange={(patch) => setNewMov((current) => ({ ...current, ...patch }))}
          onClose={() => setShowNewMov(false)}
          onSave={saveNewMov}
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

/* ─────────────────────────── novo lançamento ─────────────────────────── */

function NewMovimentacaoModal({ tipoCaixa, categorias, form, saving, onChange, onClose, onSave }: {
  tipoCaixa: "share" | "cliente";
  categorias: Record<string, string>;
  form: { descricao: string; tipo: string; categoria_id: string; valor_rateado: string; data_competencia: string; data_vencimento: string; fornecedor_nome: string; reembolsavel: boolean };
  saving: boolean;
  onChange: (patch: Partial<typeof form>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const categoriaLabel = tipoCaixa === "share" ? "Categoria do Caixa Share" : "Categoria do Caixa Cliente";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">Novo Lançamento — Caixa {tipoCaixa === "share" ? "Share" : "Cliente"}</h2>
            <p className="mt-0.5 text-xs text-slate-400">O lançamento será criado diretamente em movimentações.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Descrição *</label>
            <input value={form.descricao} onChange={(event) => onChange({ descricao: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Tipo</label>
            <select value={form.tipo} onChange={(event) => onChange({ tipo: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400">
              <option value="saida">Saída</option>
              <option value="receita">Entrada</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Valor *</label>
            <input type="number" min="0.01" step="0.01" value={form.valor_rateado} onChange={(event) => onChange({ valor_rateado: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">{categoriaLabel}</label>
            <select value={form.categoria_id} onChange={(event) => onChange({ categoria_id: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400">
              <option value="">Sem categoria</option>
              {Object.entries(categorias).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Competência</label>
            <input type="date" value={form.data_competencia} onChange={(event) => onChange({ data_competencia: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Vencimento</label>
            <input type="date" value={form.data_vencimento} onChange={(event) => onChange({ data_vencimento: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Fornecedor</label>
            <input value={form.fornecedor_nome} onChange={(event) => onChange({ fornecedor_nome: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
          </div>
          {tipoCaixa === "share" && form.tipo === "saida" && (
            <label className="sm:col-span-2 flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={form.reembolsavel} onChange={(event) => onChange({ reembolsavel: event.target.checked })} className="h-4 w-4 accent-cyan-400" />
              Despesa reembolsável pelo cliente
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-700 px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">{saving ? "Salvando..." : "Criar lançamento"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── RowFragment ─────────────────────────── */

function RowFragment({ m, entrada, expanded, name, clienteNome, cat, subcats, tid, dateStr, isPaid, docCount,
  onToggle, onApprove, onEdit, onDelete, onOpenAttachment, onReembolso, actionLoading }: {
  m: Movimentacao; entrada: boolean; expanded: boolean; name: string; clienteNome?: string | null;
  cat: string; subcats: string[]; tid: string;
  dateStr: string; isPaid: boolean; docCount: number;
  onToggle: () => void; onApprove: () => void; onEdit: () => void; onDelete: () => void;
  onOpenAttachment: (url: string, title: string) => void;
  onReembolso?: () => void;
  actionLoading: string | null;
}) {
  const [rateio, setRateio] = useState<any>(null);
  const [loadingRateio, setLoadingRateio] = useState(false);

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
    <div><span className="text-slate-500">{label}:</span> <span className="font-medium text-slate-100">{value ?? "—"}</span></div>
  );

  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer transition-colors hover:bg-slate-800/50"
        style={{ borderBottom: "1px solid rgba(30,41,59,0.7)", background: expanded ? "rgba(30,41,59,0.5)" : undefined }}>
        <td className="px-4 py-3.5"><StatusDot m={m} /></td>
        <td className="px-3 py-3.5 whitespace-nowrap">
          <div className="font-bold text-[12px] text-slate-100">{dateStr}</div>
          <div className="flex items-center gap-1 mt-0.5">
            {entrada ? <ArrowUpRight className="h-3 w-3 text-emerald-400" /> : <ArrowDownRight className="h-3 w-3 text-red-400" />}
            <span className={`text-[10px] font-semibold ${entrada ? "text-emerald-300" : "text-red-300"}`}>{entrada ? "Entrada" : "Saída"}</span>
          </div>
        </td>
        <td className="px-3 py-3.5 max-w-[200px]">
          <span className="block truncate font-semibold text-slate-100" title={m.descricao ?? ""}>{m.descricao || "—"}</span>
          {m.numero_doc && <span className="text-[10px] text-slate-500">Doc: {m.numero_doc}</span>}
        </td>
        <td className="px-3 py-3.5 hidden sm:table-cell">
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">{cat}</span>
          {subcats.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {subcats.map((s) => (
                <span key={s} className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-900/70 text-slate-400 border border-slate-700/70">{s}</span>
              ))}
            </div>
          )}
        </td>
        <td className="px-3 py-3.5 hidden md:table-cell">
          <div className="text-[11px] font-medium text-slate-200 truncate max-w-[150px]">{name}</div>
          {clienteNome && clienteNome !== name && (
            <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{clienteNome}</div>
          )}
        </td>
        <td className="px-3 py-3.5 text-right whitespace-nowrap">
          <span className={`font-bold text-[13px] ${entrada ? "text-emerald-300" : "text-slate-100"}`}>
            {entrada ? "+" : ""} {formatBRL(valorDe(m))}
          </span>
          {valorTotalDe(m) > valorDe(m) && (
            <div className="text-[10px] text-slate-500">Total: {formatBRL(valorTotalDe(m))}</div>
          )}
        </td>
        <td className="px-3 py-3.5 text-center hidden sm:table-cell"><StatusBadge m={m} /></td>
        <td className="px-3 py-3.5 text-center hidden md:table-cell">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">{docCount}<Paperclip className="h-3 w-3" /></span>
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center justify-end gap-2">
            {onReembolso && (
              <button onClick={(e) => { e.stopPropagation(); onReembolso(); }}
                className="p-1.5 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded transition-colors" title="Receber reembolso do cliente">
                <HandCoins className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors" title="Deletar">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </td>
      </tr>


      {expanded && (
        <tr style={{ borderBottom: "1px solid rgba(30,41,59,0.7)", background: "rgba(30,41,59,0.4)" }}>
          <td colSpan={9} className="px-5 py-4">
            <div className="flex flex-col gap-5 text-xs text-slate-300">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <div className="font-bold text-[10px] uppercase tracking-wider text-slate-500 mb-2">Documentos Anexos</div>
                  <div className="flex flex-wrap gap-2">
                    {attachments.length === 0 && <span className="text-slate-500 italic">Nenhum documento anexado.</span>}
                    {attachments.map((a) => (
                      <button
                        key={a.label}
                        onClick={(e) => { e.stopPropagation(); onOpenAttachment(a.url as string, a.label); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950/70 border border-slate-700 font-medium transition-colors ${a.color}`}
                      >
                        <FileText className="h-3.5 w-3.5" /> {a.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
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
                </div>
              </div>

              <div>
                <div className="font-bold text-[10px] uppercase tracking-wider text-slate-500 mb-2">
                  Detalhes Financeiros {loadingRateio && <span className="text-slate-600">(carregando rateio...)</span>}
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
                  {detail("Valor Pago Real", fmtNum(rateio?.valor_pago_real ?? m.valor))}
                  {detail("Conta", m.conta_bancaria || m.banco_nome)}
                </div>
                {(rateio?.observacoes || m.observacoes) && (
                  <div className="mt-3">
                    <span className="text-slate-500">Observações:</span>{" "}
                    <span className="font-medium text-slate-100">{rateio?.observacoes || m.observacoes}</span>
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
    <div className="rounded-xl p-4 border shadow-sm" style={{ background: cfg.bg, borderColor: cfg.border }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 opacity-80">{label}</span>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: cfg.iconBg }}>
          <Icon className="h-4 w-4" style={{ color: cfg.text } as React.CSSProperties} />
        </div>
      </div>
      <div className="font-bold text-xl tracking-tight" style={{ color: cfg.text }}>{formatBRL(value)}</div>
    </div>
  );
}
