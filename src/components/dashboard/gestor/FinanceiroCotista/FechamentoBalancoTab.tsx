import { Fragment, useMemo, useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, FileText,
  Lock, Paperclip, ExternalLink, Edit2, X, Save, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
}

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export function FechamentoBalancoTab({
  rateios,
  cotistas,
  aeronaveId,
  matricula,
  ano,
  selectedMonths,
  catMap,
}: FechamentoBalancoTabProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingRateio, setEditingRateio] = useState<RateioRow | null>(null);
  const qc = useQueryClient();

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

  // Only saídas (despesas) matter for conference
  const despesas = useMemo(
    () => rateiosDoPeriodo.filter((r) => isSaida(r.fluxo)),
    [rateiosDoPeriodo]
  );

  const totalConferido = useMemo(
    () => despesas.filter((d) => d.conferido).length,
    [despesas]
  );
  const totalLancamentos = despesas.length;
  const todosConferidos = totalLancamentos > 0 && totalConferido === totalLancamentos;

  const conferirMutation = useMutation({
    mutationFn: async ({ id, conferido }: { id: string; conferido: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      const patch: any = {
        conferido,
        conferido_em: conferido ? new Date().toISOString() : null,
        conferido_por: conferido ? userData?.user?.id ?? null : null,
      };
      const { error } = await supabase.from("rateio_despesas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["balanco-aeronave"] });
      qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
    onError: (e: any) => toast.error("Erro ao conferir: " + (e.message || "desconhecido")),
  });

  const fecharMesMutation = useMutation({
    mutationFn: async () => {
      const ids = despesas.filter((d) => !d.conferido).map((d) => d.id);
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
    const walk = (x - startX) * 1.5; // Velocidade do scroll
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
      {/* Header Premium (Mais Compacto) */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/20 text-cyan-400 shadow-inner">
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
            <div className="relative h-10 w-10">
              <svg className="h-10 w-10 -rotate-90 drop-shadow-md" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#0f172a" strokeWidth="5" />
                <circle
                  cx="24" cy="24" r="20" fill="none" stroke="#06b6d4" strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${totalLancamentos > 0 ? (totalConferido / totalLancamentos) * 125.6 : 0} 125.6`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-cyan-400">
                {totalLancamentos > 0 ? Math.round((totalConferido / totalLancamentos) * 100) : 0}%
              </span>
            </div>
            <div className="text-xs">
              <p className="font-bold text-slate-200 leading-tight">{totalConferido} Conf.</p>
              <p className="text-slate-500 font-medium leading-tight">{totalLancamentos - totalConferido} Pend.</p>
            </div>
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

      {/* Tabela Premium AA++ (Compacta e Arrastável) */}
      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/40 shadow-2xl backdrop-blur-sm">
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
              <tr className="border-b-2 border-slate-700/60 bg-slate-800/80 text-[9px] uppercase tracking-widest text-slate-400 divide-x divide-slate-700/30">
                <th className="px-3 py-2 text-center font-bold w-10"></th>
                <th className="px-3 py-2 text-left font-bold">Fluxo</th>
                <th className="px-3 py-2 text-left font-bold">Vencimento</th>
                <th className="px-3 py-2 text-left font-bold">Pagamento</th>
                <th className="px-3 py-2 text-left font-bold">nº Doc</th>
                <th className="px-3 py-2 text-left font-bold min-w-[130px]">Fornecedor</th>
                <th className="px-3 py-2 text-left font-bold">Cliente</th>
                <th className="px-3 py-2 text-left font-bold min-w-[160px]">Descrição</th>
                <th className="px-3 py-2 text-right font-bold">% Uso</th>
                <th className="px-3 py-2 text-right font-bold">Vlr. Total</th>
                <th className="px-3 py-2 text-right font-bold">Vlr. Pago</th>
                <th className="px-3 py-2 text-center font-bold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {despesas.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-xs font-medium text-slate-500">
                    Nenhum lançamento encontrado no período selecionado.
                  </td>
                </tr>
              ) : (
                despesas.map((r, idx) => {
                  const isExpanded = expandedRow === r.id;
                  const outrosRateios = findRateiosDaMesmaDespesa(r);
                  const hasOutrosRateios = outrosRateios.length > 0;
                  const anexos = [
                    { label: "NF", url: r.nf_url },
                    { label: "Comprovante", url: r.comprovante_url },
                    { label: "Recibo", url: r.recibo_url },
                    { label: "Boleto", url: r.boleto_url },
                    { label: "Demons.", url: r.demonstrativo_url },
                    { label: "Relatório", url: r.relatorio_url },
                  ].filter((a) => a.url);

                  const st = statusOf(r);
                  const clienteOuSocio = r.socios_nome || r.clientes_nome || "—";
                  const valorPago = num(r.valor_pago_real);
                  const valorOutroSocio = outrosRateios.reduce((s, o) => s + num(o.valor_rateado), 0);

                  return (
                    <Fragment key={r.id}>
                      {/* Linha Principal da Tabela */}
                      <tr
                        className={`group transition-all duration-200 divide-x divide-slate-700/20 ${
                          r.conferido ? "bg-emerald-950/10 hover:bg-emerald-950/20" : "bg-transparent hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                            className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 bg-slate-800/50 text-slate-400 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-400 focus:outline-none"
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-sm ${isSaida(r.fluxo) ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                            {r.fluxo || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-medium font-mono">
                          {formatDate(r.data_vencimento)}
                        </td>
                        <td className={`px-3 py-2 font-mono ${r.data_pagamento ? "text-emerald-600 font-bold" : "text-slate-500"}`}>
                          {r.data_pagamento ? formatDate(r.data_pagamento) : "---"}
                        </td>
                        <td className="px-3 py-2 font-mono text-cyan-400/90 text-[10px]">
                          {r.numero_doc || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-200 font-semibold truncate max-w-[130px]">
                          {r.fornecedor_nome || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-300 font-medium truncate max-w-[110px]">
                          {clienteOuSocio}
                        </td>
                        <td className="px-3 py-2 text-slate-400 max-w-[180px] truncate" title={r.descricao_despesa || ""}>
                          {r.descricao_despesa || "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-300 font-medium">
                          {r.percentual_uso != null ? `${num(r.percentual_uso)}%` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-200">
                          {formatBRL(num(r.valor_total_despesa))}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-bold ${valorPago > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                          {formatBRL(valorPago)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => conferirMutation.mutate({ id: r.id, conferido: !r.conferido })}
                            disabled={conferirMutation.isPending}
                            className={`inline-flex min-w-[75px] items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold transition-all shadow-sm ${
                              r.conferido
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
                                : "bg-slate-800 text-slate-300 border border-slate-600 hover:bg-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/40"
                            }`}
                          >
                            {r.conferido ? (
                              <><CheckCircle2 className="h-3 w-3" /> Ok</>
                            ) : (
                              <><Circle className="h-3 w-3" /> Conferir</>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Área Expandida */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-950/80 border-b border-slate-700/50 shadow-inner"
                          >
                            <td colSpan={12} className="px-4 py-4 cursor-default">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                {/* Coluna 1: Anexos */}
                                <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                  <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                    Anexos e Documentos
                                  </h4>
                                  <div className="flex flex-col gap-1.5">
                                    {anexos.length > 0 ? (
                                      anexos.map((a) => (
                                        <a
                                          key={a.label}
                                          href={a.url!}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center justify-between rounded-md border border-slate-700/50 bg-slate-800/50 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-400"
                                        >
                                          <div className="flex items-center gap-1.5">
                                            <FileText className="h-3 w-3 text-red-400" />
                                            {a.label}
                                          </div>
                                          <ExternalLink className="h-3 w-3 opacity-50" />
                                        </a>
                                      ))
                                    ) : (
                                      <p className="text-[10px] italic text-slate-600">Nenhum documento anexado.</p>
                                    )}
                                  </div>
                                </div>

                                {/* Coluna 2: Estrutura de Rateio (STATUS, SOCIEDADE, VALOR OUTRO SÓCIO) */}
                                <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                  <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                    Estrutura de Rateio
                                  </h4>
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="text-[10px] text-slate-400">STATUS</span>
                                    <span className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
                                      st.tone === "success" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" :
                                      st.tone === "warning" ? "border-amber-500/40 bg-amber-500/10 text-amber-400" :
                                      "border-red-500/40 bg-red-500/10 text-red-400"
                                    }`}>
                                      {st.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                    <span className="text-[10px] text-slate-400">SOCIEDADE</span>
                                    <span className="text-[10px] font-bold text-slate-200 text-right">
                                      {hasOutrosRateios ? sociedadeLabel(r, outrosRateios) : "—"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">VALOR OUTRO SÓCIO</span>
                                    <span className="text-[10px] font-bold text-cyan-400">
                                      {hasOutrosRateios ? formatBRL(valorOutroSocio) : "—"}
                                    </span>
                                  </div>
                                </div>

                                {/* Coluna 3: Notas / Edição */}
                                <div className="flex flex-col space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                      Histórico / Notas
                                    </h4>
                                    <button
                                      onClick={() => setEditingRateio(r)}
                                      className="flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-[9px] font-bold text-slate-300 transition-colors hover:border-cyan-500/50 hover:bg-cyan-500/20 hover:text-cyan-300 shadow-sm"
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

                              {/* Sócios (Se houver rateio) */}
                              {hasOutrosRateios && (
                                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                                  <h4 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                    Divisão (Mesma Despesa)
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {[r, ...outrosRateios].map((o) => (
                                      <div key={o.id} className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/80 px-3 py-1.5 shadow-sm">
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-bold text-slate-200 truncate w-24">
                                            {o.socios_nome || o.clientes_nome || "—"}
                                          </span>
                                          <span className="text-[9px] text-slate-500">
                                            Quota: {o.percentual_sociedade != null ? `${num(o.percentual_sociedade)}%` : "—"}
                                          </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-0.5">
                                          <span className="text-[10px] font-bold text-cyan-400 tabular-nums">
                                            {formatBRL(num(o.valor_rateado))}
                                          </span>
                                          <span className={`rounded border px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider ${
                                            o.conferido
                                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                              : "border-slate-600 bg-slate-800 text-slate-400"
                                          }`}>
                                            {o.conferido ? "Ok" : "Pend."}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {despesas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-slate-900 shadow-inner">
                  <td colSpan={8} className="px-3 py-3 text-right font-bold tracking-widest text-slate-400 text-[10px]">
                    TOTAL DO MÊS:
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-black text-slate-100 text-xs">
                    {formatBRL(despesas.reduce((s, d) => s + num(d.valor_total_despesa), 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-black text-cyan-400 text-xs">
                    {formatBRL(despesas.reduce((s, d) => s + num(d.valor_pago_real), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Edit modal (Inalterado, mantido super premium) */}
      <AnimatePresence>
        {editingRateio && (
          <EditRateioModal
            rateio={editingRateio}
            onClose={() => setEditingRateio(null)}
            onSaved={() => {
              setEditingRateio(null);
              qc.invalidateQueries({ queryKey: ["balanco-aeronave"] });
              qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============== Edit Modal ==============
function EditRateioModal({
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

  const setF = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch: any = {
        data_vencimento: form.data_vencimento || null,
        data_pagamento: form.data_pagamento || null,
        numero_doc: form.numero_doc || null,
        fornecedor_nome: form.fornecedor_nome || null,
        valor_total_despesa: form.valor_total_despesa === "" ? null : Number(form.valor_total_despesa),
        valor_rateado: form.valor_rateado === "" ? null : Number(form.valor_rateado),
        valor_pago_real: form.valor_pago_real === "" ? null : Number(form.valor_pago_real),
        status: form.status || null,
        descricao_despesa: form.descricao_despesa || null,
        observacoes: form.observacoes || null,
      };
      const { error } = await supabase.from("rateio_despesas").update(patch).eq("id", rateio.id);
      if (error) throw error;
      toast.success("Lançamento atualizado");
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-xl bg-slate-950/80 border border-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-100 outline-none transition-all duration-200 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 placeholder:text-slate-600 shadow-inner";
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Edit2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-100 tracking-wide">Editar Lançamento</div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-cyan-500/70">Ajuste Financeiro</div>
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
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/80 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-7 py-2.5 text-sm font-bold tracking-wide text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-cyan-500/25 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Alterações
          </button>
        </div>
      </motion.div>
    </div>
  );
}