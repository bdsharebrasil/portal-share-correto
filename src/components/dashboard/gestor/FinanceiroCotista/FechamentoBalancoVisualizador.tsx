import { Fragment, useMemo } from "react";
import { X, Download, Eye } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { MESES, formatHours, num } from "./balancoTypes";

interface LinhasPeriodo {
  id: string;
  nome: string;
  horas: number;
  pousos: number;
  debito: number;
  credito: number;
  saldo: number;
  pctPago: number;
}

interface MonthlyBreakdown {
  mes: number;
  custo: number;
  horas: number;
  pousos: number;
  voos: number;
  custoHora: number;
}

interface DiarioPorSocio {
  nome: string;
  socio_id: string | null;
  cliente_id: string | null;
  voos: number;
  horas: number;
  pousos: number;
  noturnas: number;
  ifr: number;
  voosList?: any[];
}

interface FechamentoBalancoVisualizadorProps {
  isOpen: boolean;
  onClose: () => void;
  linhasPeriodo: LinhasPeriodo[];
  monthlyBreakdown: MonthlyBreakdown[];
  diarioPorSocio: DiarioPorSocio[];
  matricula?: string;
  modelo?: string;
  periodo: string;
  custoTotal: number;
  custoFixo: number;
  custoVariavel: number;
  horasPeriodo: number;
  totalPousos: number;
}

export function FechamentoBalancoVisualizador({
  isOpen,
  onClose,
  linhasPeriodo,
  monthlyBreakdown,
  diarioPorSocio,
  matricula,
  modelo,
  periodo,
  custoTotal,
  custoFixo,
  custoVariavel,
  horasPeriodo,
  totalPousos,
}: FechamentoBalancoVisualizadorProps) {
  if (!isOpen) return null;

  const custoMedioHoraTotal = horasPeriodo > 0 ? custoTotal / horasPeriodo : 0;

  const totalStats = useMemo(() => {
    return {
      totalHoras: linhasPeriodo.reduce((s, l) => s + l.horas, 0),
      totalPousos: linhasPeriodo.reduce((s, l) => s + l.pousos, 0),
      totalDebito: linhasPeriodo.reduce((s, l) => s + l.debito, 0),
      totalCredito: linhasPeriodo.reduce((s, l) => s + l.credito, 0),
      totalSaldo: linhasPeriodo.reduce((s, l) => s + l.saldo, 0),
    };
  }, [linhasPeriodo]);

  const monthlyStats = useMemo(() => {
    return {
      totalCusto: monthlyBreakdown.reduce((s, m) => s + m.custo, 0),
      totalHoras: monthlyBreakdown.reduce((s, m) => s + m.horas, 0),
      totalPousos: monthlyBreakdown.reduce((s, m) => s + m.pousos, 0),
      totalVoos: monthlyBreakdown.reduce((s, m) => s + m.voos, 0),
    };
  }, [monthlyBreakdown]);

  const diarioStats = useMemo(() => {
    return {
      totalVoos: diarioPorSocio.reduce((s, d) => s + d.voos, 0),
      totalHoras: diarioPorSocio.reduce((s, d) => s + d.horas, 0),
      totalPousos: diarioPorSocio.reduce((s, d) => s + d.pousos, 0),
      totalNoturnas: diarioPorSocio.reduce((s, d) => s + d.noturnas, 0),
      totalIfr: diarioPorSocio.reduce((s, d) => s + d.ifr, 0),
    };
  }, [diarioPorSocio]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="w-full max-w-6xl rounded-2xl border border-slate-700/50 bg-slate-950 shadow-2xl">
            {/* Header */}
            <div className="border-b border-slate-700/50 bg-gradient-to-r from-slate-900 to-slate-900/50 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                  <Eye className="h-6 w-6 text-cyan-400" />
                  Visualização do Fechamento de Balanço
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {matricula} {modelo ? `— ${modelo}` : ""} · {periodo}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-2 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6 space-y-8">
              {/* Resumo Executivo */}
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                  Resumo Executivo
                </h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Custo Total</p>
                    <p className="text-lg font-bold text-cyan-400">{formatBRL(custoTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Custos Fixos</p>
                    <p className="text-lg font-bold text-amber-400">{formatBRL(custoFixo)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Custos Variáveis</p>
                    <p className="text-lg font-bold text-fuchsia-400">{formatBRL(custoVariavel)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Horas Voadas</p>
                    <p className="text-lg font-bold text-emerald-400">{formatHours(horasPeriodo)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Custo/Hora</p>
                    <p className="text-lg font-bold text-sky-400">{formatBRL(custoMedioHoraTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/30">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Pousos</p>
                    <p className="text-lg font-bold text-indigo-400">{totalPousos}</p>
                  </div>
                </div>
              </div>

              {/* Balanço por Cotista/Sócio */}
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                  Balanço por Cotista / Sócio
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/60 text-[11px] uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3 text-left font-bold">Cotista</th>
                        <th className="px-4 py-3 text-right font-bold">Horas</th>
                        <th className="px-4 py-3 text-right font-bold">Pousos</th>
                        <th className="px-4 py-3 text-right font-bold">Débito</th>
                        <th className="px-4 py-3 text-right font-bold">Crédito</th>
                        <th className="px-4 py-3 text-right font-bold">Saldo</th>
                        <th className="px-4 py-3 text-right font-bold">% Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {linhasPeriodo.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-200">{l.nome}</td>
                          <td className="px-4 py-3 text-right text-cyan-400 font-semibold">{formatHours(l.horas)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{l.pousos}</td>
                          <td className="px-4 py-3 text-right text-red-400 font-semibold">{formatBRL(l.debito)}</td>
                          <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{formatBRL(l.credito)}</td>
                          <td className={`px-4 py-3 text-right font-bold ${l.saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {formatBRL(l.saldo)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">{Math.round(l.pctPago)}%</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-cyan-500/20 bg-slate-800/40 font-bold">
                        <td className="px-4 py-3 text-slate-100">Total</td>
                        <td className="px-4 py-3 text-right text-cyan-400">{formatHours(totalStats.totalHoras)}</td>
                        <td className="px-4 py-3 text-right text-slate-100">{totalStats.totalPousos}</td>
                        <td className="px-4 py-3 text-right text-red-400">{formatBRL(totalStats.totalDebito)}</td>
                        <td className="px-4 py-3 text-right text-emerald-400">{formatBRL(totalStats.totalCredito)}</td>
                        <td className="px-4 py-3 text-right text-cyan-400">{formatBRL(totalStats.totalSaldo)}</td>
                        <td className="px-4 py-3 text-right text-slate-100">—</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Evolução Mensal */}
              {monthlyBreakdown.length > 0 && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                    Evolução Mensal
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/60 text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 text-left font-bold">Mês</th>
                          <th className="px-4 py-3 text-right font-bold">Custo</th>
                          <th className="px-4 py-3 text-right font-bold">Horas</th>
                          <th className="px-4 py-3 text-right font-bold">Pousos</th>
                          <th className="px-4 py-3 text-right font-bold">Voos</th>
                          <th className="px-4 py-3 text-right font-bold">Custo/H</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/40">
                        {monthlyBreakdown.map((m) => (
                          <tr key={m.mes} className="hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-200">{MESES[m.mes - 1]}</td>
                            <td className="px-4 py-3 text-right text-cyan-400 font-semibold">{formatBRL(m.custo)}</td>
                            <td className="px-4 py-3 text-right text-slate-300">{formatHours(m.horas)}</td>
                            <td className="px-4 py-3 text-right text-slate-300">{m.pousos}</td>
                            <td className="px-4 py-3 text-right text-slate-300">{m.voos}</td>
                            <td className="px-4 py-3 text-right text-sky-400 font-semibold">
                              {m.custoHora > 0 ? formatBRL(m.custoHora) : "—"}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-cyan-500/20 bg-slate-800/40 font-bold">
                          <td className="px-4 py-3 text-slate-100">Total</td>
                          <td className="px-4 py-3 text-right text-cyan-400">{formatBRL(monthlyStats.totalCusto)}</td>
                          <td className="px-4 py-3 text-right text-slate-100">{formatHours(monthlyStats.totalHoras)}</td>
                          <td className="px-4 py-3 text-right text-slate-100">{monthlyStats.totalPousos}</td>
                          <td className="px-4 py-3 text-right text-slate-100">{monthlyStats.totalVoos}</td>
                          <td className="px-4 py-3 text-right text-cyan-400">
                            {monthlyStats.totalHoras > 0 ? formatBRL(monthlyStats.totalCusto / monthlyStats.totalHoras) : "—"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Espelho do Diário de Bordo por Sócio */}
              {diarioPorSocio.length > 0 && (
                <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
                    Espelho do Diário de Bordo por Sócio
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/60 text-[11px] uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 text-left font-bold">Sócio</th>
                          <th className="px-4 py-3 text-right font-bold">Voos</th>
                          <th className="px-4 py-3 text-right font-bold">Horas</th>
                          <th className="px-4 py-3 text-right font-bold">Pousos</th>
                          <th className="px-4 py-3 text-right font-bold">Noturnas</th>
                          <th className="px-4 py-3 text-right font-bold">IFR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/40">
                        {diarioPorSocio.map((d, idx) => (
                          <tr key={`${d.socio_id || d.cliente_id}-${idx}`} className="hover:bg-slate-800/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-200">{d.nome}</td>
                            <td className="px-4 py-3 text-right text-cyan-400 font-semibold">{d.voos}</td>
                            <td className="px-4 py-3 text-right text-sky-400 font-semibold">{formatHours(d.horas)}</td>
                            <td className="px-4 py-3 text-right text-slate-300">{d.pousos}</td>
                            <td className="px-4 py-3 text-right text-amber-400">{formatHours(d.noturnas)}</td>
                            <td className="px-4 py-3 text-right text-emerald-400">{formatHours(d.ifr)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-cyan-500/20 bg-slate-800/40 font-bold">
                          <td className="px-4 py-3 text-slate-100">Total Aeronave</td>
                          <td className="px-4 py-3 text-right text-cyan-400">{diarioStats.totalVoos}</td>
                          <td className="px-4 py-3 text-right text-sky-400">{formatHours(diarioStats.totalHoras)}</td>
                          <td className="px-4 py-3 text-right text-slate-100">{diarioStats.totalPousos}</td>
                          <td className="px-4 py-3 text-right text-amber-400">{formatHours(diarioStats.totalNoturnas)}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">{formatHours(diarioStats.totalIfr)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-700/50 bg-slate-900/40 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800/50 transition-colors font-medium"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 hover:shadow-lg hover:shadow-cyan-500/50 transition-all font-bold"
              >
                <Download className="h-4 w-4" />
                Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
