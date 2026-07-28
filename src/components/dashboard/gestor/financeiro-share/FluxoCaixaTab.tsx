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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

/* ─────────────────────────── types ─────────────────────────── */

interface Movimentacao {
  id: string;
  descricao: string | null;
  tipo: string | null;
  tipo_caixa: string | null;
  valor: string | number | null;
  data_competencia: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  clientes_id: string | null;
  socio_id: string | null;
  categoria_id: string | null;
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
}

interface Categoria { id: string; nome: string }
interface Pessoa { id: string; nome: string | null }

/* ─────────────────────────── helpers ─────────────────────────── */

const norm = (s?: string | null) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const num = (v: string | number | null | undefined) => Number(v) || 0;

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

type StatusKind = "aprovado" | "pendente" | "vencido" | "deposito" | "reembolsado" | "cancelado";

function statusOf(m: Movimentacao): { label: string; kind: StatusKind } {
  const s = norm(m.status);
  if (s === "cancelado" || s === "rejeitado") return { label: "Cancelado", kind: "cancelado" };
  if (m.reembolsavel && m.reembolso_quitado) return { label: "Reembolsado", kind: "reembolsado" };
  const isDeposit = norm(m.tipo) === "deposito" || norm(m.tipo_caixa) === "deposito";
  if (isDeposit) return { label: "Depósito", kind: "deposito" };
  const pago = !!m.data_pagamento || s === "aprovado" || s === "pago" || s === "quitado" || s === "confirmado" || s === "receita paga" || s === "despesa paga";
  if (pago) return { label: "Aprovado", kind: "aprovado" };
  if (m.data_vencimento && new Date(m.data_vencimento) < new Date()) return { label: "Vencido", kind: "vencido" };
  return { label: "Pendente", kind: "pendente" };
}

function StatusBadge({ m }: { m: Movimentacao }) {
  const { label, kind } = statusOf(m);
  const cfg: Record<StatusKind, { bg: string; text: string; border: string; Icon: React.FC<any> }> = {
    aprovado:    { bg: "rgba(34,197,94,0.10)",  text: "#4ade80", border: "rgba(34,197,94,0.25)",  Icon: Check },
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
    aprovado: "bg-emerald-400", reembolsado: "bg-sky-400", deposito: "bg-teal-400",
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
  const [pessoas, setPessoas] = useState<Record<string, Pessoa>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("caixa_share");
  const [flowFilter, setFlowFilter] = useState<FlowFilter>("todos");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
      setMovs((data ?? []) as Movimentacao[]);
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

  /* ── pessoas ── */
  useEffect(() => {
    Promise.all([
      supabase.from("clientes").select("id,razao_social,proprietario"),
      supabase.from("socios").select("id,nome"),
    ]).then(([c, s]) => {
      const map: Record<string, Pessoa> = {};
      (c.data ?? []).forEach((x: any) => { map[x.id] = { id: x.id, nome: x.razao_social || x.proprietario }; });
      (s.data ?? []).forEach((x: any) => { map[x.id] = { id: x.id, nome: x.nome }; });
      setPessoas(map);
    });
  }, []);

  const resolveName = useCallback((m: Movimentacao) => {
    if (m.clientes_id && pessoas[m.clientes_id]) return pessoas[m.clientes_id].nome || "—";
    if (m.socio_id && pessoas[m.socio_id]) return pessoas[m.socio_id].nome || "—";
    return m.fornecedor_nome || "—";
  }, [pessoas]);

  const categoriaOf = useCallback(
    (m: Movimentacao) => categorias[m.categoria_id ?? ""] || (m.reference_type ? m.reference_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"),
    [categorias],
  );

  /* ── filter ── */
  const filteredMovs = useMemo(() => {
    let list = movs;
    switch (activeTab) {
      case "caixa_share":    list = list.filter(isShare); break;
      case "caixa_cliente":  list = list.filter((m) => !isShare(m)); break;
      case "contas_pagar":   list = list.filter((m) => !isEntrada(m) && !m.data_pagamento); break;
      case "contas_receber": list = list.filter((m) => isEntrada(m) && !m.data_pagamento); break;
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
    return list;
  }, [movs, activeTab, flowFilter, search, resolveName, categoriaOf]);

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
  const doAction = useCallback(async (m: Movimentacao, action: "aprovar" | "rejeitar") => {
    setActionLoading(m.id + action);
    setToast(null);
    try {
      const update =
        action === "aprovar"
          ? {
              data_pagamento: new Date().toISOString().slice(0, 10),
              status: isEntrada(m) ? "receita paga" : "despesa paga",
              ...(m.reembolsavel ? { reembolso_quitado: true } : {}),
            }
          : { status: "cancelado" };
      const { error: e } = await supabase.from("movimentacoes").update(update).eq("id", m.id);
      if (e) throw e;
      setMovs((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...update } : x)));
      setToast({ type: "ok", text: action === "aprovar" ? "Lançamento aprovado com sucesso." : "Lançamento rejeitado." });
      setExpandedId(null);
    } catch (e: any) {
      setToast({ type: "err", text: e.message || "Erro ao processar ação." });
    } finally {
      setActionLoading(null);
    }
  }, []);

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
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors bg-slate-950/70">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors bg-slate-950/70">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Ordenar
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors bg-slate-950/70">
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-950 transition-colors shadow-sm" style={{ background: "#06b6d4" }}>
              <Plus className="h-3.5 w-3.5" /> Nova
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(30,41,59,0.8)", background: "rgba(2,6,23,0.7)" }}>
                <th className="w-4 px-4 py-3" />
                <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">Data / Tipo</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Descrição</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Categoria</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden md:table-cell">Responsável</th>
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
                  const cat = categoriaOf(m);
                  const tid = txnId(m);
                  const dateStr = formatDate(m.data_pagamento || m.data_vencimento || m.data_competencia);
                  const isPaid = !!m.data_pagamento;
                  const docCount = [m.nf_url, m.comprovante_url, m.boleto_url, m.recibo_url].filter(Boolean).length;

                  return (
                    <RowFragment key={m.id} m={m} entrada={entrada} expanded={expanded} name={name} cat={cat}
                      tid={tid} dateStr={dateStr} isPaid={isPaid} docCount={docCount}
                      onToggle={() => setExpandedId(expanded ? null : m.id)}
                      onApprove={() => doAction(m, "aprovar")}
                      onReject={() => doAction(m, "rejeitar")}
                      onDelete={() => handleDelete(m.id)}
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
    </div>
  );
}

/* ─────────────────────────── RowFragment ─────────────────────────── */

function RowFragment({ m, entrada, expanded, name, cat, tid, dateStr, isPaid, docCount,
  onToggle, onApprove, onReject, onDelete, actionLoading }: {
  m: Movimentacao; entrada: boolean; expanded: boolean; name: string; cat: string; tid: string;
  dateStr: string; isPaid: boolean; docCount: number;
  onToggle: () => void; onApprove: () => void; onReject: () => void; onDelete: () => void; actionLoading: string | null;
}) {
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
        </td>
        <td className="px-3 py-3.5 hidden md:table-cell">
          <div className="text-[11px] font-medium text-slate-200 truncate max-w-[150px]">{name}</div>
        </td>
        <td className="px-3 py-3.5 text-right whitespace-nowrap">
          <span className={`font-bold text-[13px] ${entrada ? "text-emerald-300" : "text-slate-100"}`}>
            {entrada ? "+" : ""} {formatBRL(num(m.valor))}
          </span>
        </td>
        <td className="px-3 py-3.5 text-center hidden sm:table-cell"><StatusBadge m={m} /></td>
        <td className="px-3 py-3.5 text-center hidden md:table-cell">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">{docCount}<Paperclip className="h-3 w-3" /></span>
        </td>
        <td className="px-3 py-3.5">
          <div className="flex items-center justify-end gap-2">
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
            <div className="flex flex-col md:flex-row gap-6 text-xs text-slate-300">
              <div className="flex-1">
                <div className="font-bold text-[10px] uppercase tracking-wider text-slate-500 mb-2">Documentos Anexos</div>
                <div className="flex flex-wrap gap-2">
                  {m.nf_url ? <a href={m.nf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950/70 border border-slate-700 text-cyan-300 font-medium hover:border-cyan-400/40 transition-colors"><FileText className="h-3.5 w-3.5" /> Nota Fiscal</a> : null}
                  {m.comprovante_url ? <a href={m.comprovante_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950/70 border border-slate-700 text-emerald-300 font-medium hover:border-emerald-400/40 transition-colors"><Paperclip className="h-3.5 w-3.5" /> Comprovante</a> : null}
                  {m.boleto_url ? <a href={m.boleto_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950/70 border border-slate-700 text-amber-300 font-medium hover:border-amber-400/40 transition-colors"><FileText className="h-3.5 w-3.5" /> Boleto</a> : null}
                  {m.recibo_url ? <a href={m.recibo_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950/70 border border-slate-700 text-sky-300 font-medium hover:border-sky-400/40 transition-colors"><FileText className="h-3.5 w-3.5" /> Recibo</a> : null}
                  {docCount === 0 && <span className="text-slate-500 italic">Nenhum documento anexado.</span>}
                </div>
              </div>
              <div className="flex-1">
                <div className="font-bold text-[10px] uppercase tracking-wider text-slate-500 mb-2">Detalhes Financeiros</div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                  <div><span className="text-slate-500">Conta:</span> <span className="font-medium text-slate-100">{m.conta_bancaria || m.banco_nome || "—"}</span></div>
                  <div><span className="text-slate-500">Caixa:</span> <span className="font-medium text-slate-100">{m.tipo_caixa || "share"}</span></div>
                  <div><span className="text-slate-500">Forma:</span> <span className="font-medium text-slate-100">{m.forma_pagamento || "—"}</span></div>
                  <div><span className="text-slate-500">ID:</span> <span className="mono font-medium text-slate-100">{tid}</span></div>
                  {m.observacoes && <div className="col-span-2"><span className="text-slate-500">Obs:</span> <span className="font-medium text-slate-100">{m.observacoes}</span></div>}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {!isPaid ? (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); onApprove(); }} disabled={actionLoading !== null}
                      className="px-6 py-2 rounded-lg text-xs font-bold text-white transition-colors disabled:opacity-50" style={{ background: "#0e7490", minWidth: 90 }}>
                      {actionLoading === m.id + "aprovar" ? <RefreshCw className="h-3.5 w-3.5 animate-spin mx-auto" /> : "Aprovar"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onReject(); }} disabled={actionLoading !== null}
                      className="px-6 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50" style={{ border: "1px solid #fca5a5", color: "#f87171", background: "transparent", minWidth: 90 }}>
                      {actionLoading === m.id + "rejeitar" ? <RefreshCw className="h-3.5 w-3.5 animate-spin mx-auto" /> : "Rejeitar"}
                    </button>
                  </>
                ) : (
                  <span className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">Lançamento quitado</span>
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
