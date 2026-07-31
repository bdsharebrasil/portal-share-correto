import { Fragment, useMemo, useState } from "react";
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
      // Mark all despesas as conferido
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

  // Find other rateios for the same despesa (rateio with other cotistas)
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Fechamento de Balanço</h2>
            <p className="text-xs text-slate-400">
              {periodLabel} · {matricula || "Aeronave"} · {totalConferido}/{totalLancamentos} conferidos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress ring */}
          <div className="flex items-center gap-2">
            <div className="relative h-12 w-12">
              <svg className="h-12 w-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#1e293b" strokeWidth="4" />
                <circle
                  cx="24" cy="24" r="20" fill="none" stroke="#06b6d4" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${totalLancamentos > 0 ? (totalConferido / totalLancamentos) * 125.6 : 0} 125.6`}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-cyan-400">
                {totalLancamentos > 0 ? Math.round((totalConferido / totalLancamentos) * 100) : 0}%
              </span>
            </div>
            <div className="text-xs text-slate-400">
              <p className="font-semibold text-slate-200">{totalConferido} conferidos</p>
              <p>{totalLancamentos - totalConferido} pendentes</p>
            </div>
          </div>

          <button
            onClick={() => fecharMesMutation.mutate()}
            disabled={!todosConferidos || fecharMesMutation.isPending}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all ${
              todosConferidos
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg hover:from-emerald-500 hover:to-emerald-400"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            {fecharMesMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            Fechar Mês
          </button>
        </div>
      </div>

      {/* Info banner */}
      {!todosConferidos && totalLancamentos > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-4 py-2.5 text-xs text-amber-300">
          <Circle className="h-3.5 w-3.5" />
          Confira cada lançamento clicando em "Conferido". O mês só pode ser fechado quando todos estiverem conferidos.
        </div>
      )}
      {todosConferidos && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Todos os lançamentos foram conferidos! Você já pode fechar o mês.
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/40 text-[10px] uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3 text-left font-semibold w-8"></th>
                <th className="px-3 py-3 text-left font-semibold">Tipo Rateio</th>
                <th className="px-3 py-3 text-left font-semibold">Fluxo</th>
                <th className="px-3 py-3 text-left font-semibold">Vencimento</th>
                <th className="px-3 py-3 text-left font-semibold">Pagamento</th>
                <th className="px-3 py-3 text-left font-semibold">NF</th>
                <th className="px-3 py-3 text-left font-semibold">Doc</th>
                <th className="px-3 py-3 text-left font-semibold">Fornecedor</th>
                <th className="px-3 py-3 text-left font-semibold">Cliente</th>
                <th className="px-3 py-3 text-left font-semibold">Sócio</th>
                <th className="px-3 py-3 text-left font-semibold">Pago Por</th>
                <th className="px-3 py-3 text-left font-semibold">Aeronave</th>
                <th className="px-3 py-3 text-right font-semibold">% Soc.</th>
                <th className="px-3 py-3 text-right font-semibold">% Uso</th>
                <th className="px-3 py-3 text-left font-semibold">Descrição</th>
                <th className="px-3 py-3 text-left font-semibold">Periodicidade</th>
                <th className="px-3 py-3 text-right font-semibold">Valor Total</th>
                <th className="px-3 py-3 text-right font-semibold">Valor Rateado</th>
                <th className="px-3 py-3 text-right font-semibold">Valor Pago</th>
                <th className="px-3 py-3 text-center font-semibold">Status</th>
                <th className="px-3 py-3 text-center font-semibold">Anexos</th>
                <th className="px-3 py-3 text-center font-semibold">Conferido</th>
                <th className="px-3 py-3 text-center font-semibold">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {despesas.length === 0 ? (
                <tr>
                  <td colSpan={23} className="px-4 py-10 text-center text-slate-500">
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
                    { label: "Demonstrativo", url: r.demonstrativo_url },
                    { label: "Relatório", url: r.relatorio_url },
                  ].filter((a) => a.url);

                  const st = statusOf(r);

                  return (
                    <Fragment key={r.id}>
                      <tr
                        className={`transition-colors ${r.conferido ? "bg-emerald-500/[0.04]" : "hover:bg-slate-800/30"}`}
                      >
                        {/* Expand button */}
                        <td className="px-3 py-2.5">
                          {hasOutrosRateios && (
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                              className="text-slate-400 hover:text-cyan-400 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{r.tipo_rateio || "—"}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-semibold ${isSaida(r.fluxo) ? "text-red-400" : "text-emerald-400"}`}>
                            {r.fluxo || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{formatDate(r.data_vencimento)}</td>
                        <td className="px-3 py-2.5 text-slate-300">{formatDate(r.data_pagamento)}</td>
                        <td className="px-3 py-2.5 font-mono text-cyan-400">{r.numero_nf || "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-cyan-400">{r.numero_doc || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-200">{r.fornecedor_nome || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-300">{r.clientes_nome || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-300">{r.socios_nome || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-300">{r.pago_por || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-400">{r.aeronave_registro || "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                          {r.percentual_sociedade != null ? `${num(r.percentual_sociedade)}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                          {r.percentual_uso != null ? `${num(r.percentual_uso)}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-200 max-w-[180px] truncate" title={r.descricao_despesa || ""}>
                          {r.descricao_despesa || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">{r.periodicidade || "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-100">
                          {formatBRL(num(r.valor_total_despesa))}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                          {formatBRL(num(r.valor_rateado))}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                          {formatBRL(num(r.valor_pago_real))}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                            st.tone === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                            st.tone === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
                            "border-red-500/30 bg-red-500/10 text-red-400"
                          }`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {anexos.length > 0 ? (
                              anexos.map((a) => (
                                <a
                                  key={a.label}
                                  href={a.url!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 rounded bg-slate-700/50 px-1.5 py-0.5 text-[9px] text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-400 transition-colors"
                                  title={a.label}
                                >
                                  <Paperclip className="h-2.5 w-2.5" />
                                  {a.label}
                                </a>
                              ))
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => conferirMutation.mutate({ id: r.id, conferido: !r.conferido })}
                            disabled={conferirMutation.isPending}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                              r.conferido
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                                : "bg-slate-700/50 text-slate-300 border border-slate-600 hover:bg-cyan-500/15 hover:text-cyan-400 hover:border-cyan-500/30"
                            }`}
                          >
                            {r.conferido ? (
                              <><CheckCircle2 className="h-3 w-3" /> Conferido</>
                            ) : (
                              <><Circle className="h-3 w-3" /> Conferir</>
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => setEditingRateio(r)}
                            className="text-slate-400 hover:text-cyan-400 transition-colors"
                            title="Editar lançamento"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded row: outros rateios da mesma despesa */}
                      <AnimatePresence>
                        {isExpanded && hasOutrosRateios && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-950/40"
                          >
                            <td colSpan={23} className="px-6 py-3">
                              <div className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Rateio com outros cotistas/sócios — mesma despesa
                                </p>
                                <div className="space-y-1.5">
                                  {outrosRateios.map((o) => (
                                    <div key={o.id} className="flex items-center gap-3 text-xs">
                                      <span className="w-32 truncate text-slate-300">
                                        {o.socios_nome || o.clientes_nome || "—"}
                                      </span>
                                      <span className="text-slate-500">
                                        {o.percentual_sociedade != null ? `${num(o.percentual_sociedade)}%` : "—"}
                                      </span>
                                      <span className="flex-1 text-right tabular-nums font-semibold text-slate-200">
                                        {formatBRL(num(o.valor_rateado))}
                                      </span>
                                      <span className={`rounded border px-1.5 py-0.5 text-[9px] ${
                                        o.conferido
                                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                          : "border-slate-600 bg-slate-700/30 text-slate-400"
                                      }`}>
                                        {o.conferido ? "Conferido" : "Pendente"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
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
                <tr className="border-t-2 border-cyan-500/20 bg-slate-800/40 font-bold">
                  <td colSpan={16} className="px-3 py-3 text-right text-slate-200">TOTAL:</td>
                  <td className="px-3 py-3 text-right tabular-nums text-cyan-400">
                    {formatBRL(despesas.reduce((s, d) => s + num(d.valor_total_despesa), 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-100">
                    {formatBRL(despesas.reduce((s, d) => s + num(d.valor_rateado), 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-100">
                    {formatBRL(despesas.reduce((s, d) => s + num(d.valor_pago_real), 0))}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Edit modal */}
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
    numero_nf: rateio.numero_nf || "",
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
        numero_nf: form.numero_nf || null,
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

  const inputCls = "w-full rounded-lg bg-slate-950/60 border border-slate-700/70 px-3 py-2 text-[13px] text-slate-100 outline-none transition focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-500/60 placeholder:text-slate-600";
  const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "rgba(2,6,23,0.85)" }} onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
              <Edit2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100">Editar Lançamento</div>
              <div className="text-[10.5px] text-slate-500">Fechamento de Balanço</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5 md:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className={labelCls}>Vencimento</label>
              <input type="date" className={inputCls} value={form.data_vencimento} onChange={(e) => setF("data_vencimento", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Pagamento</label>
              <input type="date" className={inputCls} value={form.data_pagamento} onChange={(e) => setF("data_pagamento", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Número NF</label>
              <input className={inputCls} value={form.numero_nf} onChange={(e) => setF("numero_nf", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Número Doc</label>
              <input className={inputCls} value={form.numero_doc} onChange={(e) => setF("numero_doc", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Fornecedor</label>
              <input className={inputCls} value={form.fornecedor_nome} onChange={(e) => setF("fornecedor_nome", e.target.value)} />
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
              <label className={labelCls}>Valor Pago</label>
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
              <label className={labelCls}>Descrição</label>
              <input className={inputCls} value={form.descricao_despesa} onChange={(e) => setF("descricao_despesa", e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Observações</label>
              <textarea className={inputCls} rows={2} value={form.observacoes} onChange={(e) => setF("observacoes", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/60 px-6 py-3.5">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
