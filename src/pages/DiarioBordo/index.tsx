import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plane, Calendar, Gauge, Activity, ChevronRight, Plus, BookOpenCheck, PlaneTakeoff } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { num } from "@/lib/formatters";

type Aeronave = {
  id: string;
  matricula: string;
  modelo: string;
  status: string;
  consumo_combustivel: number | null;
};

type Resumo = {
  aeronave_id: string;
  ano: number;
  horas_total: number;
  prox_revisao: number | null;
};

function DiarioBordo() {
  const navigate = useNavigate();
  const [aeronaves, setAeronaves] = useState<Aeronave[]>([]);
  const [resumos, setResumos] = useState<Record<string, Resumo>>({});
  const [loading, setLoading] = useState(true);
  const ano = new Date().getFullYear();

  // Determina a cor baseado em horas RESTANTES para próxima revisão
  const getProxRevColor = (horasRestantes: number) => {
    if (horasRestantes > 15) return { textClass: "text-cyan-400", barClass: "bg-gradient-to-r from-cyan-500 to-blue-500" };
    if (horasRestantes >= 10) return { textClass: "text-amber-400", barClass: "bg-gradient-to-r from-amber-500 to-yellow-500" };
    return { textClass: "text-red-400", barClass: "bg-gradient-to-r from-red-500 to-orange-500" };
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: aData } = await supabase
          .from("aeronave")
          .select("id,matricula,modelo,status,consumo_combustivel")
          .ilike("status", "ativ%")
          .order("matricula");
        const aeronaves = (aData ?? []) as Aeronave[];
        setAeronaves(aeronaves);

        // Total ano: soma tempo_total + próxima revisão (último diario_mes do ano)
        const [{ data: lan }, { data: dms }] = await Promise.all([
          supabase
            .from("lancamentos_diario_bordo")
            .select("aeronave_id,tempo_total,data_registro")
            .gte("data_registro", `${ano}-01-01`)
            .lte("data_registro", `${ano}-12-31`),
          supabase
            .from("diario_mes")
            .select("aeronave_id,ano,mes,celula_atual_ttotal,celula_prox_revisao_ttotal")
            .eq("ano", ano)
            .order("mes", { ascending: false }),
        ]);

        const map: Record<string, Resumo> = {};
        for (const a of aeronaves) {
          map[a.id] = { aeronave_id: a.id, ano, horas_total: 0, prox_revisao: null };
        }
        for (const r of (lan ?? []) as Array<{ aeronave_id: string; tempo_total: number | string | null }>) {
          if (map[r.aeronave_id]) map[r.aeronave_id].horas_total += Number(r.tempo_total ?? 0);
        }
        const seenProx = new Set<string>();
        for (const r of (dms ?? []) as Array<{ aeronave_id: string; celula_atual_ttotal: number | null; celula_prox_revisao_ttotal: number | null }>) {
          if (!seenProx.has(r.aeronave_id) && map[r.aeronave_id]) {
            map[r.aeronave_id].prox_revisao = Number(r.celula_prox_revisao_ttotal ?? 0) || null;
            const cur = Number(r.celula_atual_ttotal ?? 0);
            if (cur > map[r.aeronave_id].horas_total) map[r.aeronave_id].horas_total = cur;
            seenProx.add(r.aeronave_id);
          }
        }
        setResumos(map);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao carregar diário de bordo:", error);
        setLoading(false);
      }
    })();
  }, [ano]);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl">
                <BookOpenCheck className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-wide">
                  Diários de Bordo
                </h1>
                <p className="text-slate-400 mt-0.5">
                  Gerencie os diários de bordo digitais das aeronaves
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate("/aerodromos")}
              className="gap-2 whitespace-nowrap border border-[rgba(25,32,49,1)] shadow-[4px_3px_10px_0_rgba(7,18,48,0.83)]"
            >
              <PlaneTakeoff className="h-4 w-4" /> Aeródromos
            </Button>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl border border-slate-600/50 bg-slate-700/50" />
            ))}
          </div>
        ) : (
          <>
            {aeronaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 rounded-3xl border border-slate-600/50 bg-slate-700/50 p-5">
                  <Plane className="h-12 w-12 text-slate-500" />
                </div>
                <p className="mb-1 text-lg font-semibold text-white">
                  Nenhuma aeronave cadastrada
                </p>
                <p className="text-sm text-slate-400">
                  Suas aeronaves ativas aparecerão aqui
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {aeronaves.map((a, i) => {
                  const r = resumos[a.id];
                  const horas = r?.horas_total ?? 0;
                  const prox = r?.prox_revisao ?? 0;
                  const horasRestantes = prox - horas;
                  const pct = prox > 0 ? Math.min(100, (horas / prox) * 100) : 0;
                  const ativa = (a.status ?? "").toLowerCase().startsWith("ativ");

                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <button
                        onClick={() => navigate(`/diario-bordo/${a.id}`)}
                        className="group relative block w-full overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 text-left"
                      >
                        {/* Glow bg */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                        <div className="relative">
                          {/* Top row */}
                          <div className="mb-4 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-xl border border-cyan-500/25 bg-cyan-500/15 transition-colors group-hover:bg-cyan-500/25">
                                <Plane className="h-5 w-5 text-cyan-400" />
                              </div>
                              <div>
                                <h3 className="text-lg font-bold tracking-wide text-white">
                                  {a.matricula}
                                </h3>
                                <p className="text-sm text-slate-400">
                                  {a.modelo || "Sem modelo"}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ativa
                                ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                                : "border-slate-600 bg-slate-800 text-slate-400"
                              }`}>
                              {ativa ? "Ativa" : (a.status ?? "Inativa")}
                            </span>
                          </div>

                          {/* Dados da Aeronave */}
                          <div className="mb-4 rounded-xl border border-slate-700/50 bg-slate-800/80 p-4">
                            <h4 className="mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Dados da Aeronave</h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="mb-1 flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="text-xs text-slate-400">Diário</span>
                                </div>
                                <p className="font-bold text-white">{ano}</p>
                              </div>
                              <div>
                                <div className="mb-1 flex items-center gap-2">
                                  <Gauge className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="text-xs text-slate-400">
                                    Célula Atual
                                  </span>
                                </div>
                                <p className="font-bold text-white">{num(horas, 1)}h</p>
                              </div>
                            </div>
                          </div>

                          {/* Progress bar próxima revisão */}
                          {prox > 0 && (() => {
                            const colors = getProxRevColor(horasRestantes);
                            return (
                              <div className="mb-4">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span className="flex items-center gap-1 text-xs text-slate-400">
                                    <Activity className={`h-3 w-3 ${colors.textClass}`} /> Próxima revisão
                                  </span>
                                  <span className={`text-xs font-medium ${colors.textClass}`}>
                                    {num(horasRestantes, 0)}h restantes
                                  </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                                  <div
                                    className={`h-full rounded-full ${colors.barClass} transition-all`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}

                          {/* Footer */}
                          <div className="flex items-center justify-between border-t border-slate-700/50 pt-2.5 text-xs text-slate-500">
                            <span className="text-xs truncate">
                              Consumo: {a.consumo_combustivel ? num(a.consumo_combustivel, 1) : "—"} L/H
                            </span>
                            <ChevronRight className="h-4 w-4 text-slate-500 transition-all group-hover:translate-x-0.5 group-hover:text-cyan-400 flex-shrink-0" />
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default DiarioBordo;
