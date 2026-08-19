import { Fragment, useMemo, useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, FileText,
  Lock, Paperclip, ExternalLink, Edit2, X, Save, Loader2, Eye, EyeOff,
  ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AttachmentViewerModal from "../financeiro-share/AttachmentViewerModal";
import AnexosDinamicosField, { type AnexoLinha, type AnexoTipoId } from "./AnexosDinamicosField";

import {
  type RateioRow,
  type Cotista,
  MESES,
  isSaida,
  formatDate,
  num,
  statusOf,
} from "./balancoTypes";

interface FechamentoBalancoTabProps {
  rateios: RateioRow[];
  cotistas: Cotista[];
  aeronaveId: string;
  matricula?: string;
  ano: number;
  selectedMonths: number[];
  catMap: Map<string, string>;
  onRefresh?: () => void;
  onVerNaTela?: () => void;
  onExportPDF?: () => void;
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const HIDEABLE_COLUMNS = [
  ["fluxo", "Fluxo"],
  ["vencimento", "Vencimento"],
  ["pagamento", "Pagamento"],
  ["documento", "nº Doc"],
  ["fornecedor", "Fornecedor"],
  ["cliente", "Cliente"],
  ["descricao", "Descrição"],
  ["uso", "% Uso"],
  ["total", "Vlr. Total"],
  ["rateado", "Vlr. Rateado"],
] as const;

export function FechamentoBalancoTab({
  rateios,
  cotistas,
  aeronaveId,
  matricula,
  ano,
  selectedMonths,
  catMap,
  onRefresh,
  onVerNaTela,
  onExportPDF,
}: FechamentoBalancoTabProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingRateio, setEditingRateio] = useState<RateioRow | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [viewerAnexo, setViewerAnexo] = useState<{ url: string; title: string } | null>(null);

  type SortBy = "vencimento" | "pagamento" | "fornecedor" | "cliente" | "descricao" | "total" | "rateado";
  const [sortBy, setSortBy] = useState<SortBy>("vencimento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const setFilter = (key: string, value: string) =>
    setColumnFilters((current) => ({ ...current, [key]: value }));

  const norm = (v: unknown) =>
    String(v ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const toggleColumn = (column: string) => {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  };

  const columnVisible = (column: string) => !hiddenColumns.has(column);
  const visibleColumnCount = 2 + HIDEABLE_COLUMNS.length - hiddenColumns.size;

  const toggleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  // Ícone de ordenação para o cabeçalho da coluna (estilo grid)
  const SortIcon = ({ field }: { field: SortBy }) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-2.5 w-2.5 text-slate-600 group-hover:text-teal-400/70 transition-colors" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-2.5 w-2.5 text-teal-400" />
    ) : (
      <ArrowDown className="h-2.5 w-2.5 text-teal-400" />
    );
  };

  const thBase =
    "px-3 py-2.5 font-bold whitespace-nowrap select-none transition-colors";
  const thSortable = (field: SortBy) =>
    `group cursor-pointer hover:bg-teal-500/10 ${sortBy === field ? "text-teal-300" : "text-slate-400"}`;

  // Drag to scroll refs and state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Filter by selected months
  const rateiosDoPeriodo = useMemo(() => {
    const selectedSet = new Set(selectedMonths);
    return rateios.filter((r) => {
      const d = r.data_pagamento || r.data_vencimento;
      if (!d) return false;
      const dt = new Date(d + (d.length <= 10 ? "T00:00:00" : ""));
      return dt.getFullYear() === ano && selectedSet.has(dt.getMonth() + 1);
    });
  }, [rateios, ano, selectedMonths]);

  // A tabela exibe entradas e saídas; apenas saídas participam da conferência.
  const despesas = rateiosDoPeriodo;

  // Agrupa despesas pelo despesa_id para mostrar uma única linha por despesa
  const despesasAgrupadas = useMemo(() => {
    const grouped = new Map<string, RateioRow[]>();

    despesas.forEach((r) => {
      const key = r.despesa_id || `solo-${r.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(r);
    });

    return Array.from(grouped.values()).map((grupo) => ({
      representante: grupo[0],
      todos: grupo,
      numCotistas: grupo.length,
      valorTotal: num(grupo[0].valor_total_despesa),
      valorRateado: grupo.reduce((s, r) => s + num(r.valor_rateado), 0),
      valorPagoTotal: grupo.reduce((s, r) => s + num(r.valor_pago_real), 0),
      todosConferidos: grupo.every((r) => r.conferido),
      algumConferido: grupo.some((r) => r.conferido),
    }));
  }, [despesas]);

  // Aplica os filtros digitados no cabeçalho de cada coluna
  const filteredDespesasAgrupadas = useMemo(() => {
    const active = Object.entries(columnFilters).filter(([, v]) => norm(v) !== "");
    if (active.length === 0) return despesasAgrupadas;

    return despesasAgrupadas.filter((grupo) => {
      const r = grupo.representante;
const cliente = r.socios_nome || r.clientes_nome || r.pago_por || "";      return active.every(([key, raw]) => {
        const q = norm(raw);
        switch (key) {
          case "fluxo": return norm(r.fluxo).includes(q);
          case "vencimento": return norm(formatDate(r.data_vencimento)).includes(q) || norm(r.data_vencimento).includes(q);
          case "pagamento": return norm(r.data_pagamento ? formatDate(r.data_pagamento) : "").includes(q) || norm(r.data_pagamento).includes(q);
          case "documento": return norm(r.numero_nf || r.numero_doc || r.numero_recibo).includes(q);
          case "fornecedor": return norm(r.fornecedor_nome).includes(q);
          case "cliente": return norm(grupo.numCotistas > 1 ? `${grupo.numCotistas} socios` : cliente).includes(q);
          case "descricao": return norm(r.descricao_despesa).includes(q);
          case "uso": return norm(r.percentual_uso).includes(q);
          case "total": return norm(grupo.valorTotal).includes(q) || norm(formatBRL(grupo.valorTotal)).includes(q);
          case "rateado": return norm(grupo.valorRateado).includes(q) || norm(formatBRL(grupo.valorRateado)).includes(q);
          default: return true;
        }
      });
    });
  }, [despesasAgrupadas, columnFilters]);

  const hasActiveFilters = useMemo(
    () => Object.values(columnFilters).some((v) => norm(v) !== ""),
    [columnFilters]
  );

  const totalFiltradoRateado = useMemo(
    () => filteredDespesasAgrupadas.reduce((s, g) => s + g.valorRateado, 0),
    [filteredDespesasAgrupadas]
  );
  const totalFiltradoTotal = useMemo(
    () => filteredDespesasAgrupadas.reduce((s, g) => s + g.valorTotal, 0),
    [filteredDespesasAgrupadas]
  );

  const sortedDespesasAgrupadas = useMemo(() => {
    const rows = filteredDespesasAgrupadas.map((grupo) => {
      const r = grupo.representante;
      const cliente = r.socios_nome || r.clientes_nome || r.pago_por || "";
      const sortValue: string | number = (() => {
        switch (sortBy) {
          case "vencimento": return r.data_vencimento || "";
          case "pagamento": return r.data_pagamento || "";
          case "fornecedor": return r.fornecedor_nome || "";
          case "cliente": return cliente;
          case "descricao": return r.descricao_despesa || "";
          case "total": return grupo.valorTotal;
          case "rateado": return grupo.valorRateado;
          default: return "";
        }
      })();
      return { grupo, sortValue };
    });

    rows.sort((a, b) => {
      const aVal = a.sortValue;
      const bVal = b.sortValue;
      let cmp = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), "pt-BR", { sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows.map((row) => row.grupo);
  }, [filteredDespesasAgrupadas, sortBy, sortDir]);

  const totalConferido = useMemo(
    () => despesasAgrupadas.filter((g) => isSaida(g.representante.fluxo) && g.todosConferidos).length,
    [despesasAgrupadas]
  );
  const totalLancamentos = useMemo(
    () => despesasAgrupadas.filter((g) => isSaida(g.representante.fluxo)).length,
    [despesasAgrupadas]
  );
  const todosConferidos = totalLancamentos > 0 && totalConferido === totalLancamentos;

  const conferirMutation = useMutation({
    mutationFn: async ({ id, conferido }: { id: string; conferido: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const patch: any = {
        conferido,
        conferido_em: conferido ? new Date().toISOString() : null,
        conferido_por: conferido ? userData?.user?.id ?? null : null,
      };
      const { data, error } = await supabase
        .from("rateio_despesas")
        .update(patch)
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Nenhum registro atualizado (verifique permissões)");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balanco-aeronave"] });
      qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      onRefresh?.();
    },
    onError: (e: any) => toast.error("Erro ao conferir: " + (e.message || "desconhecido")),
  });

  const fecharMesMutation = useMutation({
    mutationFn: async () => {
      const ids = despesasAgrupadas
        .filter((g) => isSaida(g.representante.fluxo) && !g.todosConferidos)
        .flatMap((g) => g.todos.map((r) => r.id));
      if (ids.length === 0) return;
      const { data: userData } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("rateio_despesas")
        .update({ conferido: true, conferido_em: now, conferido_por: userData?.user?.id ?? null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mês fechado com sucesso! Todos os lançamentos foram conferidos.");
      qc.invalidateQueries({ queryKey: ["balanco-aeronave"] });
      qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      onRefresh?.();
    },
    onError: (e: any) => toast.error("Erro ao fechar mês: " + (e.message || "desconhecido")),
  });

  const findRateiosDaMesmaDespesa = (rateio: RateioRow): RateioRow[] => {
    if (!rateio.despesa_id) return [rateio];
    return rateiosDoPeriodo.filter(
      (r) => r.despesa_id === rateio.despesa_id && r.id !== rateio.id
    );
  };

  const periodLabel = useMemo(() => {
    if (selectedMonths.length === 1) return `${MESES[selectedMonths[0] - 1]} ${ano}`;
    if (selectedMonths.length === 12) return `Ano ${ano}`;
    const sorted = [...selectedMonths].sort((a, b) => a - b);
    return `${MESES[sorted[0] - 1].slice(0, 3)}–${MESES[sorted[sorted.length - 1] - 1].slice(0, 3)} ${ano}`;
  }, [selectedMonths, ano]);

  // Funções de Drag to Scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tableContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tableContainerRef.current.offsetLeft);
    setScrollLeft(tableContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    tableContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Helper: rótulo "SOCIEDADE" no estilo "WATT (50%) | SHARE (50%)"
  const sociedadeLabel = (r: RateioRow, outros: RateioRow[]) => {
    const partes = [r, ...outros].map((x) => {
      const nome = (x.socios_nome || x.clientes_nome || "—").split(" ")[0].toUpperCase();
      const pct = x.percentual_sociedade != null ? `${num(x.percentual_sociedade)}%` : "—";
      return `${nome} (${pct})`;
    });
    return partes.join(" | ");
  };

  return (
    <div className="space-y-4">
      {/* Header Premium */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 border border-teal-500/20 text-teal-400 shadow-inner">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-wide text-slate-100 leading-tight">Fechamento de Balanço</h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              {periodLabel} <span className="mx-1.5 text-slate-600">•</span> {matricula || "Aeronave"} <span className="mx-1.5 text-slate-600">•</span> {totalConferido}/{totalLancamentos} conferidos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            {hasActiveFilters && (
              <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-right">
                <p className="text-[9px] font-bold uppercase tracking-widest text-teal-300/80">Total filtrado</p>
                <p className="text-xs font-black tabular-nums text-teal-300">{formatBRL(totalFiltradoRateado)}</p>
              </div>
            )}
            <div className="relative h-10 w-10">
              <svg className="h-10 w-10 -rotate-90 drop-shadow-md" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#0f172a" strokeWidth="5" />
                <circle
                  cx="24" cy="24" r="20" fill="none" stroke="#2dd4bf" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${totalLancamentos > 0 ? (totalConferido / totalLancamentos) * 125.6 : 0} 125.6`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-teal-400">
                {totalLancamentos > 0 ? Math.round((totalConferido / totalLancamentos) * 100) : 0}%
              </span>
            </div>
            <div className="text-xs">
              <p className="font-bold text-slate-200 leading-tight">{totalConferido} Conf.</p>
              <p className="text-slate-500 font-medium leading-tight">{totalLancamentos - totalConferido} Pend.</p>
            </div>
          </div>

          <div className="relative z-[500] overflow-visible">
            <button
              onClick={() => setShowColumnMenu((current) => !current)}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-[11px] font-bold text-slate-300 transition-colors hover:border-teal-500/50 hover:bg-teal-500/10 hover:text-teal-300"
              aria-expanded={showColumnMenu}
              aria-label="Mostrar ou ocultar colunas"
            >
              <Eye className="h-3.5 w-3.5" />
              COLUNAS
            </button>
            {showColumnMenu && (
              <>
                <div className="fixed inset-0 z-[9998]" onClick={() => setShowColumnMenu(false)} />
                <div className="absolute right-0 top-full z-[9999] mt-2 w-48 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-2xl">
                  {HIDEABLE_COLUMNS.map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => toggleColumn(id)}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[10px] font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-teal-300"
                    >
                      {label}
                      {columnVisible(id) ? <Eye className="h-3.5 w-3.5 text-teal-400" /> : <EyeOff className="h-3.5 w-3.5 text-slate-600" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>


          <div className="flex items-center gap-2">
            {onVerNaTela && (
              <button
                onClick={onVerNaTela}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-[11px] font-bold text-slate-300 transition-colors hover:border-teal-500/50 hover:bg-teal-500/10 hover:text-teal-300"
                title="Ver relatório dos meses fechados na tela"
              >
                <Eye className="h-3.5 w-3.5" /> VER NA TELA
              </button>
            )}
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-[11px] font-bold text-slate-300 transition-colors hover:border-teal-500/50 hover:bg-teal-500/10 hover:text-teal-300"
                title="Exportar PDF"
              >
                <FileText className="h-3.5 w-3.5" /> EXPORTAR PDF
              </button>
            )}
          </div>
          <button
            onClick={() => fecharMesMutation.mutate()}
            disabled={!todosConferidos || fecharMesMutation.isPending}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-bold tracking-wide transition-all duration-300 ${
              todosConferidos
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-[1.02]"
                : "bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-not-allowed"
            }`}
          >
            {fecharMesMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            FECHAR MÊS
          </button>
        </div>
      </div>

      {/* Tabela estilo grid (teal/dark) */}
      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-[#0a1120] shadow-2xl backdrop-blur-sm">
        <div
          ref={tableContainerRef}
          className={`overflow-x-auto custom-scrollbar ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <table className="w-full text-[11px] border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b-2 border-teal-500/30 bg-[#0f1b2d] text-[9px] uppercase tracking-widest divide-x divide-slate-800/60">
                <th className={`${thBase} px-3 py-2.5 text-center w-10 text-slate-500`}></th>

                <th className={`${thBase} text-left ${columnVisible("fluxo") ? "" : "hidden"} text-slate-400`}>
                  Fluxo
                </th>

                <th
                  onClick={() => toggleSort("vencimento")}
                  className={`${thBase} text-left ${thSortable("vencimento")} ${columnVisible("vencimento") ? "" : "hidden"}`}
                >
                  <span className="inline-flex items-center gap-1">Vencimento <SortIcon field="vencimento" /></span>
                </th>

                <th
                  onClick={() => toggleSort("pagamento")}
                  className={`${thBase} text-left ${thSortable("pagamento")} ${columnVisible("pagamento") ? "" : "hidden"}`}
                >
                  <span className="inline-flex items-center gap-1">Pagamento <SortIcon field="pagamento" /></span>
                </th>

                <th className={`${thBase} text-left ${columnVisible("documento") ? "" : "hidden"} text-slate-400`}>
                  nº Doc
                </th>

                <th
                  onClick={() => toggleSort("fornecedor")}
                  className={`${thBase} text-left min-w-[130px] ${thSortable("fornecedor")} ${columnVisible("fornecedor") ? "" : "hidden"}`}
                >
                  <span className="inline-flex items-center gap-1">Fornecedor <SortIcon field="fornecedor" /></span>
                </th>

                <th
                  onClick={() => toggleSort("cliente")}
                  className={`${thBase} text-left ${thSortable("cliente")} ${columnVisible("cliente") ? "" : "hidden"}`}
                >
                  <span className="inline-flex items-center gap-1">Cliente <SortIcon field="cliente" /></span>
                </th>

                <th
                  onClick={() => toggleSort("descricao")}
                  className={`${thBase} text-left min-w-[160px] ${thSortable("descricao")} ${columnVisible("descricao") ? "" : "hidden"}`}
                >
                  <span className="inline-flex items-center gap-1">Descrição <SortIcon field="descricao" /></span>
                </th>

                <th className={`${thBase} text-right ${columnVisible("uso") ? "" : "hidden"} text-slate-400`}>
                  % Uso
                </th>

                <th
                  onClick={() => toggleSort("total")}
                  className={`${thBase} text-right ${thSortable("total")} ${columnVisible("total") ? "" : "hidden"}`}
                >
                  <span className="inline-flex items-center justify-end gap-1 w-full">Vlr. Total <SortIcon field="total" /></span>
                </th>

                <th
                  onClick={() => toggleSort("rateado")}
                  className={`${thBase} text-right ${thSortable("rateado")} ${columnVisible("rateado") ? "" : "hidden"}`}
                >
                  <span className="inline-flex items-center justify-end gap-1 w-full">Vlr. Rateado <SortIcon field="rateado" /></span>
                </th>

                <th className={`${thBase} text-center text-slate-400`}>Ações</th>
              </tr>

              {/* Linha de filtros por coluna */}
              <tr className="border-b border-slate-800/70 bg-[#0b1524]">
                <th className="px-2 py-1.5">
                  {hasActiveFilters && (
                    <button
                      onClick={() => setColumnFilters({})}
                      title="Limpar filtros"
                      className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 bg-slate-800/60 text-[10px] font-bold text-slate-400 hover:border-teal-500/50 hover:text-teal-300"
                    >
                      ×
                    </button>
                  )}
                </th>
                {HIDEABLE_COLUMNS.map(([id, label]) => (
                  <th key={id} className={`px-2 py-1.5 ${columnVisible(id) ? "" : "hidden"}`}>
                    <input
                      value={columnFilters[id] ?? ""}
                      onChange={(e) => setFilter(id, e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      placeholder={label}
                      className={`w-full min-w-[70px] rounded border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-[10px] font-medium text-slate-200 placeholder:text-slate-600 outline-none transition-colors focus:border-teal-500/60 ${
                        id === "total" || id === "rateado" || id === "uso" ? "text-right" : ""
                      }`}
                    />
                  </th>
                ))}
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedDespesasAgrupadas.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumnCount} className="px-4 py-10 text-center text-xs font-medium text-slate-500">
                    {hasActiveFilters
                      ? "Nenhum lançamento corresponde aos filtros aplicados."
                      : "Nenhum lançamento encontrado no período selecionado."}
                  </td>
                </tr>
              ) : (
                sortedDespesasAgrupadas.map((grupo, idx) => {
                  const r = grupo.representante;
                  const isExpanded = expandedRow === (r.despesa_id || r.id);
                  const anexos = [
                    { label: "NF", url: r.nf_url },
                    { label: "Comprovante", url: r.comprovante_url },
                    { label: "Recibo", url: r.recibo_url },
                    { label: "Boleto", url: r.boleto_url },
                    { label: "Demons.", url: r.demonstrativo_url },
                    { label: "Relatório", url: r.relatorio_url },
                  ].filter((a) => a.url);

                  const st = statusOf(r);
                  const clienteDisplay = r.socios_nome || r.clientes_nome || r.pago_por || "—";
                  const docDisplay = r.numero_nf || r.numero_doc || r.numero_recibo || "—";
                  const temMultiplosCotistas = grupo.numCotistas > 1;

                  // zebra: linhas pares recebem um leve tint teal, conferidas mantêm o tom emerald
                  const rowBg = grupo.todosConferidos
                    ? "bg-emerald-950/10 hover:bg-emerald-950/20"
                    : idx % 2 === 0
                      ? "bg-teal-500/[0.03] hover:bg-teal-500/[0.07]"
                      : "bg-transparent hover:bg-slate-800/40";

                  return (
                    <Fragment key={r.despesa_id || r.id}>
                      {/* Linha Principal da Tabela */}
                      <tr className={`group transition-all duration-200 divide-x divide-slate-800/40 ${rowBg}`}>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : (r.despesa_id || r.id))}
                            className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 bg-slate-800/50 text-slate-400 transition-colors hover:border-teal-500/50 hover:bg-teal-500/10 hover:text-teal-400 focus:outline-none"
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className={`px-3 py-2 ${columnVisible("fluxo") ? "" : "hidden"}`}>
                          <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-sm ${isSaida(r.fluxo) ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                            {r.fluxo || "—"}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-slate-300 font-medium font-mono ${columnVisible("vencimento") ? "" : "hidden"}`}>
                          {formatDate(r.data_vencimento)}
                        </td>
                        <td className={`px-3 py-2 font-mono ${r.data_pagamento ? "text-emerald-500 font-bold" : "text-slate-500"} ${columnVisible("pagamento") ? "" : "hidden"}`}>
                          {r.data_pagamento ? formatDate(r.data_pagamento) : "---"}
                        </td>
                        <td className={`px-3 py-2 font-mono text-teal-400/90 text-[10px] ${columnVisible("documento") ? "" : "hidden"}`}>
                          {docDisplay}
                        </td>
                        <td className={`px-3 py-2 text-slate-200 font-semibold truncate max-w-[130px] ${columnVisible("fornecedor") ? "" : "hidden"}`}>
                          {r.fornecedor_nome || "—"} {temMultiplosCotistas && <span className="text-teal-400 text-[9px]">({grupo.numCotistas})</span>}
                        </td>
                        <td className={`px-3 py-2 text-slate-300 font-medium truncate max-w-[110px] ${columnVisible("cliente") ? "" : "hidden"}`}>
                          {temMultiplosCotistas ? `${grupo.numCotistas} sócios` : clienteDisplay}
                        </td>
                        <td className={`px-3 py-2 text-slate-400 max-w-[180px] truncate ${columnVisible("descricao") ? "" : "hidden"}`} title={r.descricao_despesa || ""}>
                          {r.descricao_despesa || "—"}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums text-slate-300 font-medium ${columnVisible("uso") ? "" : "hidden"}`}>
                          {r.percentual_uso != null ? `${num(r.percentual_uso)}%` : "—"}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold text-slate-200 ${columnVisible("total") ? "" : "hidden"}`}>
                          {formatBRL(grupo.valorTotal)}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${grupo.valorRateado > 0 ? "text-teal-400" : "text-slate-500"} ${columnVisible("rateado") ? "" : "hidden"}`}>
                          {formatBRL(grupo.valorRateado)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isSaida(r.fluxo) ? <button
                            onClick={() => {
                              const idsParaConferir = grupo.todos.map(r => r.id);
                              idsParaConferir.forEach((id) => {
                                conferirMutation.mutate({ id, conferido: !grupo.todosConferidos });
                              });
                            }}
                            disabled={conferirMutation.isPending}
                            className={`inline-flex min-w-[75px] items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold transition-all shadow-sm ${
                              grupo.todosConferidos
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
                                : "bg-slate-800 text-slate-300 border border-slate-600 hover:bg-teal-500/20 hover:text-teal-300 hover:border-teal-500/40"
                            }`}
                          >
                            {grupo.todosConferidos ? (
                              <><CheckCircle2 className="h-3 w-3" /> Ok</>
                            ) : (
                              <><Circle className="h-3 w-3" /> Conferir</>
                            )}
                          </button> : <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">Entrada</span>}
                        </td>
                      </tr>

                      {/* Área Expandida */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-950/80 border-b border-slate-800/60 shadow-inner"
                          >
                            <td colSpan={visibleColumnCount} className="px-4 py-4 cursor-default">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                {/* Coluna 1: Anexos */}
                                <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                  <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                    Anexos e Documentos
                                  </h4>
                                  <div className="flex flex-col gap-1.5">
                                    {anexos.length > 0 ? (
                                      anexos.map((a) => (
                                        <button
                                          key={a.label}
                                          type="button"
                                          onClick={() => setViewerAnexo({ url: a.url!, title: a.label })}
                                          className="flex w-full items-center justify-between rounded-md border border-slate-700/50 bg-slate-800/50 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 transition-colors hover:border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-400"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <FileText className="h-3 w-3 text-red-400" />
                                            {a.label}
                                          </div>
                                          <ExternalLink className="h-3 w-3 opacity-50" />
                                        </button>
                                      ))

                                    ) : (
                                      <p className="text-[10px] italic text-slate-600">Nenhum documento anexado.</p>
                                    )}
                                  </div>
                                </div>

                                {/* Coluna 2: Dados da Despesa */}
                                <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                  <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                    Informações da Despesa
                                  </h4>
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="text-[10px] text-slate-400">Data Emissão</span>
                                    <span className="text-[10px] font-bold text-slate-200">
                                      {formatDate(r.data_emissao || r.data_vencimento)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="text-[10px] text-slate-400">Data Vencimento</span>
                                    <span className="text-[10px] font-bold text-slate-200">
                                      {formatDate(r.data_vencimento)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="text-[10px] text-slate-400">Data Pagamento</span>
                                    <span className={`text-[10px] font-bold ${r.data_pagamento ? "text-emerald-400" : "text-slate-500"}`}>
                                      {r.data_pagamento ? formatDate(r.data_pagamento) : "—"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">Valor Total</span>
                                    <span className="text-[10px] font-bold text-teal-400">
                                      {formatBRL(grupo.valorTotal)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">Valor Pago Real</span>
                                    <span className="text-[10px] font-bold text-emerald-400">
                                      {formatBRL(grupo.valorPagoTotal)}
                                    </span>
                                  </div>
                                </div>

                                {/* Coluna 3: Notas / Edição */}
                                <div className="flex flex-col space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                      Observações
                                    </h4>
                                    <button
                                      onClick={() => setEditingRateio(r)}
                                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 transition-colors hover:bg-teal-500/20 hover:text-teal-300"
                                    >
                                      <Edit2 className="h-3 w-3" /> Editar
                                    </button>
                                  </div>
                                  <div className="flex-1 rounded bg-slate-950/50 p-2 border border-slate-800/80">
                                    <p className="text-[10px] italic text-slate-400">
                                      {r.observacoes ? `"${r.observacoes}"` : "Sem notas adicionais."}
                                    </p>
                                  </div>
                                </div>

                              </div>

                              {/* Cotistas Envolvidos no Rateio */}
                              {temMultiplosCotistas && (
                                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                                  <h4 className="mb-3 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                    Cotistas Envolvidos no Rateio ({grupo.numCotistas})
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {grupo.todos.map((o, i) => {
                                      const oStatus = statusOf(o);
                                      const statusColors = {
                                        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                                        warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
                                        danger: "border-red-500/30 bg-red-500/10 text-red-400",
                                      };
                                      const statusIcons = {
                                        success: "✓",
                                        warning: "⊙",
                                        danger: "⚠",
                                      };
                                      return (
                                      <div key={`${o.id}-${i}`} className="rounded-md border border-slate-700/50 bg-slate-900/50 p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-200 truncate">
                                              {o.socios_nome || o.clientes_nome || "—"}
                                            </p>
                                            <p className="text-[9px] text-slate-500 mt-0.5">
                                              Quota: {o.percentual_sociedade != null ? `${num(o.percentual_sociedade)}%` : "—"}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => setEditingRateio(o)}
                                              className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-200 transition-colors hover:bg-teal-500/20 hover:text-teal-300"
                                            >
                                              <Edit2 className="h-3 w-3" /> Editar
                                            </button>
                                            <span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider shrink-0 ${
                                              statusColors[oStatus.tone]
                                            }`}>
                                              {statusIcons[oStatus.tone]} {oStatus.label}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="border-t border-slate-700/50 pt-2 space-y-1">
                                          <div className="flex justify-between text-[9px]">
                                            <span className="text-slate-500">Valor Rateado:</span>
                                            <span className="text-teal-400 font-semibold">{formatBRL(num(o.valor_rateado))}</span>
                                          </div>
                                          {o.valor_pago_real > 0 && (
                                            <div className="flex justify-between text-[9px]">
                                              <span className="text-slate-500">Pago:</span>
                                              <span className="text-emerald-400 font-semibold">{formatBRL(num(o.valor_pago_real))}</span>
                                            </div>
                                          )}
                                          {o.data_pagamento && (
                                            <div className="flex justify-between text-[9px]">
                                              <span className="text-slate-500">Data Pag.:</span>
                                              <span className="text-slate-300 font-semibold">{formatDate(o.data_pagamento)}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                    })}
                                  </div>
                                </div>
                              )}
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                      {isExpanded && editingRateio && grupo.todos.some((o) => o.id === editingRateio.id) && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-950/90 border-b border-slate-800/60"
                        >
                          <td colSpan={visibleColumnCount} className="px-4 py-4">
                            <div className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-inner">
                              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-bold text-slate-100">Editar lançamento</p>
                                  <p className="text-[11px] text-slate-400">Ajuste no fechamento de balanço sem sair do expansor.</p>
                                </div>
                                <button
                                  onClick={() => setEditingRateio(null)}
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-200 transition-colors hover:bg-red-500/10 hover:text-red-300"
                                >
                                  Fechar edição
                                </button>
                              </div>
                              <EditRateioPanel
                                rateio={editingRateio}
                                onClose={() => setEditingRateio(null)}
                                onSaved={() => {
                                  setEditingRateio(null);
                                  qc.invalidateQueries({ queryKey: ["balanco-aeronave"] });
                                  qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
                                  onRefresh?.();
                                }}
                              />
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {sortedDespesasAgrupadas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-teal-500/30 bg-[#0f1b2d] shadow-inner">
                  <td colSpan={visibleColumnCount - 1 - (columnVisible("total") ? 1 : 0) - (columnVisible("rateado") ? 1 : 0)} className="px-3 py-3 text-right font-bold tracking-widest text-slate-400 text-[10px]">
                    {hasActiveFilters ? `TOTAL FILTRADO (${sortedDespesasAgrupadas.length}):` : "TOTAL DO MÊS:"}
                  </td>
                  {columnVisible("total") && (
                    <td className="px-3 py-3 text-right tabular-nums font-black text-slate-100 text-xs">
                      {formatBRL(totalFiltradoTotal)}
                    </td>
                  )}
                  {columnVisible("rateado") && (
                    <td className="px-3 py-3 text-right tabular-nums font-black text-teal-400 text-xs">
                      {formatBRL(totalFiltradoRateado)}
                    </td>
                  )}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {viewerAnexo && (
        <AttachmentViewerModal
          url={viewerAnexo.url}
          title={viewerAnexo.title}
          onClose={() => setViewerAnexo(null)}
        />
      )}
    </div>
  );

}

// ============== Edit Panel ==============
function EditRateioPanel({
  rateio,
  onClose,
  onSaved,
}: {
  rateio: RateioRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({
    data_vencimento: rateio.data_vencimento || "",
    data_pagamento: rateio.data_pagamento || "",
    numero_doc: rateio.numero_doc || "",
    fornecedor_nome: rateio.fornecedor_nome || "",
    valor_total_despesa: rateio.valor_total_despesa ?? "",
    valor_rateado: rateio.valor_rateado ?? "",
    valor_pago_real: rateio.valor_pago_real ?? "",
    status: rateio.status || "",
    descricao_despesa: rateio.descricao_despesa || "",
    observacoes: rateio.observacoes || "",
  });
  const [saving, setSaving] = useState(false);

  // Anexos existentes no rateio -> linhas editáveis
  const [anexos, setAnexos] = useState<AnexoLinha[]>(() =>
    (
      [
        ["comprovante", (rateio as any).comprovante_url],
        ["recibo", (rateio as any).recibo_url],
        ["nf", (rateio as any).nf_url],
        ["boleto", (rateio as any).boleto_url],
        ["demonstrativo", (rateio as any).demonstrativo_url],
        ["outro", (rateio as any).relatorio_url],
      ] as [AnexoTipoId, string | null][]
    )
      .filter(([, url]) => !!url)
      .map(([tipo, url]) => ({
        id: crypto.randomUUID(),
        tipo,
        numero: "",
        url: url as string,
        file: null,
      })),
  );

  const setF = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));

  const anexosPatch = () => {
    const cols: Record<AnexoTipoId, string> = {
      comprovante: "comprovante_url",
      recibo: "recibo_url",
      nf: "nf_url",
      boleto: "boleto_url",
      demonstrativo: "demonstrativo_url",
      comanda: "relatorio_url",
      outro: "relatorio_url",
    };
    const patch: Record<string, string | null> = {
      comprovante_url: null,
      recibo_url: null,
      nf_url: null,
      boleto_url: null,
      demonstrativo_url: null,
      relatorio_url: null,
    };
    anexos.forEach((a) => {
      if (a.url) patch[cols[a.tipo]] = a.url;
    });
    return patch;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Campos que pertencem à despesa inteira (replicados em todos os rateios)
      const patchDespesa: any = {
        data_vencimento: form.data_vencimento || null,
        data_pagamento: form.data_pagamento || null,
        numero_doc: form.numero_doc || null,
        fornecedor_nome: form.fornecedor_nome || null,
        valor_total_despesa: form.valor_total_despesa === "" ? null : Number(form.valor_total_despesa),
        descricao_despesa: form.descricao_despesa || null,
        ...anexosPatch(),
      };
      // Campos do rateio individual
      const patchLinha: any = {
        ...patchDespesa,
        valor_rateado: form.valor_rateado === "" ? null : Number(form.valor_rateado),
        valor_pago_real: form.valor_pago_real === "" ? null : Number(form.valor_pago_real),
        status: form.status || null,
        observacoes: form.observacoes || null,
      };

      const { data, error } = await supabase
        .from("rateio_despesas")
        .update(patchLinha)
        .eq("id", rateio.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nenhum registro atualizado (verifique as permissões).");
      }

      // Replica os dados da despesa nos demais rateios do mesmo documento
      if (rateio.despesa_id) {
        const { error: errSiblings } = await supabase
          .from("rateio_despesas")
          .update(patchDespesa)
          .eq("despesa_id", rateio.despesa_id)
          .neq("id", rateio.id);
        if (errSiblings) throw errSiblings;
      }

      toast.success("Lançamento atualizado");
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || "desconhecido"));
    } finally {
      setSaving(false);
    }

  };

  const inputCls = "w-full rounded-xl bg-slate-950/80 border border-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none transition-all duration-200 focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400 placeholder:text-slate-600 shadow-inner";
  const labelCls = "block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md" style={{ background: "rgba(2,6,23,0.90)" }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Edit2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-100 tracking-wide">Editar Lançamento</div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-teal-500/70">Ajuste Financeiro</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-500/15 hover:text-red-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-6 md:p-8 custom-scrollbar">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelCls}>Vencimento</label>
              <input type="date" className={inputCls} value={form.data_vencimento} onChange={(e) => setF("data_vencimento", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Pagamento</label>
              <input type="date" className={inputCls} value={form.data_pagamento} onChange={(e) => setF("data_pagamento", e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Número Doc</label>
              <input className={inputCls} placeholder="Ex: NF-1234" value={form.numero_doc} onChange={(e) => setF("numero_doc", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Fornecedor</label>
              <input className={inputCls} placeholder="Nome do Beneficiário" value={form.fornecedor_nome} onChange={(e) => setF("fornecedor_nome", e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Valor Total</label>
              <input type="number" step="0.01" className={inputCls} value={form.valor_total_despesa} onChange={(e) => setF("valor_total_despesa", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Valor Rateado</label>
              <input type="number" step="0.01" className={inputCls} value={form.valor_rateado} onChange={(e) => setF("valor_rateado", e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Valor Pago (Real)</label>
              <input type="number" step="0.01" className={inputCls} value={form.valor_pago_real} onChange={(e) => setF("valor_pago_real", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={(e) => setF("status", e.target.value)}>
                <option value="">—</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="reembolsado">Reembolsado</option>
                <option value="atrasado">Atrasado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Descrição da Despesa</label>
              <input className={inputCls} placeholder="Detalhes do que foi gasto..." value={form.descricao_despesa} onChange={(e) => setF("descricao_despesa", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Observações Internas (Notas)</label>
              <textarea className={inputCls} rows={3} placeholder="Insira o contexto ou histórico para conciliação..." value={form.observacoes} onChange={(e) => setF("observacoes", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Anexos do Lançamento</label>
              <AnexosDinamicosField
                anexos={anexos}
                onChange={setAnexos}
                storagePrefix={`balanco-anexos/${rateio.despesa_id || rateio.id}`}
              />
            </div>
          </div>

        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/80 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-7 py-2.5 text-sm font-bold tracking-wide text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-teal-500/25 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Alterações
          </button>
        </div>
      </motion.div>
    </div>
  );
}