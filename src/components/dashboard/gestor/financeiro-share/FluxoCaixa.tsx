
import React, { useState, useMemo, useCallback, useEffect } from "react";
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
  Edit2,
  Trash2,
  GripHorizontal
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Adaptação dos hooks e contexts originais
import { useMovimentacoes } from "@/hooks/useMovimentacoes";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FluxoCaixaInlineForm } from "./FluxoCaixaInlineForm";
import { QuadroMensalTab } from "./QuadroMensalTab";

// --- Helpers do layout referência ---
const norm = (s?: string | null) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const num = (v: string | number | null | undefined) => Number(v) || 0;

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FluxoCaixa() {
  const { user } = useAuth();
  const { data: transacoes, isLoading, error, refetch } = useMovimentacoes();
  const { categorias: contasData } = useCategoriasFinanceiro();

  // Estados
  const [activeTab, setActiveTab] = useState<"lista" | "visualizacao-mensal" | "caixa-cliente">("lista");
  const [flowFilter, setFlowFilter] = useState<"todos" | "saidas" | "entradas">("todos");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Form e edição
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<any>(null);

  // Paginação - Estilo Supabase (Page X of Y)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const isEntrada = useCallback((m: any) => m.tipo_movimento === "entrada", []);
  
  // Filtros aplicados
  const filteredMovs = useMemo(() => {
    if (!transacoes) return [];
    let list = transacoes;

    // Filtro da aba
    if (activeTab === "caixa-cliente") {
      list = list.filter((m: any) => (m.tipo_caixa || 'share') === 'cliente');
    }

    // Filtro de fluxo (entradas/saídas)
    if (flowFilter === "entradas") list = list.filter(isEntrada);
    if (flowFilter === "saidas") list = list.filter((m: any) => !isEntrada(m));

    // Busca textual
    if (search.trim()) {
      const q = norm(search);
      list = list.filter((m: any) =>
        norm(m.descricao).includes(q) ||
        norm(m.numero_documento).includes(q) ||
        norm(m.categoria_nome).includes(q) ||
        norm(m.cliente_nome).includes(q)
      );
    }
    return list;
  }, [transacoes, activeTab, flowFilter, search, isEntrada]);

  // Paginação derivada
  const totalPages = Math.max(1, Math.ceil(filteredMovs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMovs = filteredMovs.slice(startIndex, startIndex + itemsPerPage);

  // Efeito para garantir que a página atual não ultrapasse o total ao filtrar
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredMovs.length, itemsPerPage, totalPages, currentPage]);

  // KPIs
  const kpis = useMemo(() => {
    let entradas = 0, saidas = 0, pendentes = 0;
    for (const m of filteredMovs) {
      const v = num(m.valor);
      if (isEntrada(m)) {
        entradas += v;
      } else {
        saidas += v;
      }
      if (m.status === "pendente") pendentes += v;
    }
    return { entradas, saidas, saldo: entradas - saidas, pendentes };
  }, [filteredMovs, isEntrada]);

  // Handlers
  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta movimentação?")) return;
    try {
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Deletado com sucesso");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao deletar");
    }
  };

  const statusColor = (status: string, isEntr: boolean) => {
    if (status === "pendente") return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    if (status === "recebido" || status === "pago") return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    if (status === "cancelado") return { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" };
    return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" };
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: "#f1f5f9" }}>
      {/* Header bar */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }} className="sticky top-0 z-40 px-6 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600 text-white font-bold">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-800 block leading-none mb-1">Gestão Fiscal</span>
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Share Brasil</span>
            </div>
          </div>
        </div>

        {/* Tab switcher estilo pills */}
        <div className="hidden md:flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
          {[
            { key: "lista", label: "Lista de Movimentações" },
            { key: "visualizacao-mensal", label: "Visualização Mensal" },
            { key: "caixa-cliente", label: "Caixa Cliente" }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as any); setExpandedId(null); }}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button 
            onClick={() => { setEditingMovimentacao(null); setShowInlineForm(!showInlineForm); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova Movimentação
          </button>
        </div>
      </header>

      <main className="p-5 lg:p-6 max-w-[1600px] mx-auto space-y-6">
        
        {showInlineForm && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
            <FluxoCaixaInlineForm
              onSuccess={() => { setShowInlineForm(false); setEditingMovimentacao(null); refetch(); }}
              onCancel={() => { setShowInlineForm(false); setEditingMovimentacao(null); }}
              movimentacao={editingMovimentacao}
            />
          </div>
        )}

        {activeTab === "visualizacao-mensal" ? (
          <QuadroMensalTab />
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Receita Total" value={kpis.entradas} tone="green" icon={ArrowUpRight} />
              <KpiCard label="Despesa Total" value={kpis.saidas} tone="red" icon={ArrowDownRight} />
              <KpiCard label="Saldo Líquido" value={kpis.saldo} tone={kpis.saldo >= 0 ? "blue" : "red"} icon={Wallet} />
              <KpiCard label="Pendências" value={kpis.pendentes} tone="amber" icon={Clock} />
            </div>

            {/* Table card */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
              
              {/* Table toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">Lançamentos</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-600">
                    {filteredMovs.length} registros
                  </span>
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Flow filter pills */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 mr-2">
                    {(["todos", "saidas", "entradas"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => { setFlowFilter(f); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                          flowFilter === f
                            ? "bg-white text-slate-800 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {f === "todos" ? "Todos" : f === "saidas" ? "Saídas" : "Entradas"}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar lançamentos..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all w-48 sm:w-64 bg-white"
                    />
                  </div>
                  
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors bg-white">
                    <Download className="h-3.5 w-3.5" />
                    Exportar
                  </button>
                </div>
              </div>

              {/* Table Data */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-slate-200">
                      <th className="w-4 px-4 py-3" />
                      <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Data / Tipo</th>
                      <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Descrição</th>
                      <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Categoria</th>
                      <th className="text-left px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden md:table-cell">Cliente/Aeronave</th>
                      <th className="text-right px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor</th>
                      <th className="text-center px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Status</th>
                      <th className="w-8 px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100"><td colSpan={8} className="p-4"><div className="h-8 bg-slate-100 rounded animate-pulse" /></td></tr>
                      ))
                    ) : paginatedMovs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">Nenhum lançamento encontrado para os filtros selecionados.</td>
                      </tr>
                    ) : (
                      paginatedMovs.map((m: any) => {
                        const isEntr = isEntrada(m);
                        const expanded = expandedId === m.id;
                        const sColor = statusColor(m.status, isEntr);
                        
                        // Parse date
                        let dataFmt = "—";
                        if (m.data) {
                          const [y, mo, d] = (m.data.split("T")[0]).split("-");
                          dataFmt = `${d}/${mo}/${y}`;
                        }

                        return (
                          <React.Fragment key={m.id}>
                            <tr
                              onClick={() => setExpandedId(expanded ? null : m.id)}
                              className={`cursor-pointer transition-colors border-b border-slate-100 hover:bg-slate-50 ${expanded ? "bg-slate-50" : "bg-white"}`}
                            >
                              {/* Dot indicator */}
                              <td className="px-4 py-3.5">
                                <span className={`block w-2 h-2 rounded-full ${m.status === 'pendente' ? 'bg-amber-400' : isEntr ? 'bg-emerald-400' : 'bg-red-400'}`} />
                              </td>
                              
                              {/* Data / Tipo */}
                              <td className="px-3 py-3.5 whitespace-nowrap">
                                <div className="font-bold text-[12px] text-slate-700">{dataFmt}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {isEntr ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-500" />}
                                  <span className={`text-[10px] font-semibold ${isEntr ? "text-emerald-600" : "text-red-600"}`}>
                                    {isEntr ? "Entrada" : "Saída"}
                                  </span>
                                </div>
                              </td>

                              {/* Descrição */}
                              <td className="px-3 py-3.5 max-w-[200px]">
                                <span className="block truncate font-semibold text-slate-700" title={m.descricao}>{m.descricao || "—"}</span>
                                {m.numero_documento && <span className="text-[10px] text-slate-400">Doc: {m.numero_documento}</span>}
                              </td>

                              {/* Categoria */}
                              <td className="px-3 py-3.5 hidden sm:table-cell">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  {m.categoria_nome || m.categoria || "—"}
                                </span>
                              </td>

                              {/* Cliente / Aeronave */}
                              <td className="px-3 py-3.5 hidden md:table-cell">
                                <div className="text-[11px] font-medium text-slate-700 truncate max-w-[150px]">{m.cliente_nome || "—"}</div>
                                {m.aeronave_registro && (
                                  <span className="inline-block px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {m.aeronave_registro}
                                  </span>
                                )}
                              </td>

                              {/* Valor */}
                              <td className="px-3 py-3.5 text-right whitespace-nowrap">
                                <span className={`font-bold text-[13px] ${isEntr ? "text-emerald-600" : "text-slate-800"}`}>
                                  {isEntr ? "+" : ""} {formatBRL(num(m.valor))}
                                </span>
                              </td>

                              {/* Status */}
                              <td className="px-3 py-3.5 text-center hidden sm:table-cell">
                                <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-bold border ${sColor.bg} ${sColor.text} ${sColor.border}`}>
                                  {m.status?.toUpperCase() || "—"}
                                </span>
                              </td>

                              {/* Ações / Expand */}
                              <td className="px-3 py-3.5">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingMovimentacao(m); setShowInlineForm(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Editar">
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Deletar">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Details */}
                            {expanded && (
                              <tr className="bg-slate-50/80 border-b border-slate-200">
                                <td colSpan={8} className="px-5 py-4">
                                  <div className="flex flex-col md:flex-row gap-6 text-xs text-slate-600">
                                    {/* Documentos */}
                                    <div className="flex-1">
                                      <div className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-2">Documentos Anexos</div>
                                      <div className="flex flex-wrap gap-2">
                                        {m.nf_url ? (
                                          <a href={m.nf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-slate-200 text-blue-600 font-medium hover:border-blue-300 transition-colors">
                                            <FileText className="h-3.5 w-3.5" /> Nota Fiscal
                                          </a>
                                        ) : null}
                                        {m.comprovante_url ? (
                                          <a href={m.comprovante_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white border border-slate-200 text-emerald-600 font-medium hover:border-emerald-300 transition-colors">
                                            <Paperclip className="h-3.5 w-3.5" /> Comprovante
                                          </a>
                                        ) : null}
                                        {!m.nf_url && !m.comprovante_url && <span className="text-slate-400 italic">Nenhum documento anexado.</span>}
                                      </div>
                                    </div>

                                    {/* Detalhes Adicionais */}
                                    <div className="flex-1">
                                      <div className="font-bold text-[10px] uppercase tracking-wider text-slate-400 mb-2">Detalhes Financeiros</div>
                                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                        <div><span className="text-slate-400">Conta:</span> <span className="font-medium text-slate-800">{m.conta_banco || "—"}</span></div>
                                        <div><span className="text-slate-400">Caixa:</span> <span className="font-medium text-slate-800">{m.tipo_caixa || "share"}</span></div>
                                        {m.observacoes && <div className="col-span-2"><span className="text-slate-400">Obs:</span> <span className="font-medium text-slate-800">{m.observacoes}</span></div>}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination - Estilo Supabase */}
              <div className="border-t border-slate-200 px-5 py-3 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 font-medium">
                  Mostrando {filteredMovs.length === 0 ? 0 : startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredMovs.length)} de {filteredMovs.length} registros
                </div>
                
                <div className="flex items-center gap-4 text-xs font-medium">
                  {/* Rows per page */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 hidden sm:inline">Linhas por página:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="border border-slate-200 bg-slate-50 rounded-md px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  
                  {/* Page selector */}
                  <div className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                    <span className="text-slate-500">Page</span>
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) setCurrentPage(Math.max(1, Math.min(totalPages, val)));
                      }}
                      className="w-10 border border-slate-200 rounded text-center text-slate-800 bg-white outline-none focus:ring-1 focus:ring-blue-500 no-spinners py-0.5"
                    />
                    <span className="text-slate-500">of {totalPages}</span>
                  </div>

                  {/* Arrow controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Sub-component: KPI Card
function KpiCard({ label, value, tone, icon: Icon }: any) {
  const cfg = {
    green: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-600", iconBg: "bg-emerald-100" },
    red:   { bg: "bg-red-50", border: "border-red-100", text: "text-red-600", iconBg: "bg-red-100" },
    amber: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-600", iconBg: "bg-amber-100" },
    blue:  { bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-600", iconBg: "bg-blue-100" },
  }[tone as "green"|"red"|"amber"|"blue"];

  return (
    <div className={`rounded-xl p-4 border shadow-sm flex flex-col justify-center ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 opacity-80">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.iconBg}`}>
          <Icon className={`h-4 w-4 ${cfg.text}`} />
        </div>
      </div>
      <div className={`font-bold text-xl tracking-tight ${cfg.text}`}>
        {formatBRL(value)}
      </div>
    </div>
  );
}
