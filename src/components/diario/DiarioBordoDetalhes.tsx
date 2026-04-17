import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plane,
  Calendar,
  Gauge,
  Clock,
  Fuel,
  Users,
  Activity,
  Plus,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import { num } from "@/lib/formatters";

type Aeronave = {
  id: string;
  matricula: string;
  modelo: string;
  consumo_combustivel: number | null;
};

type Lancamento = {
  id: string;
  data_registro: string;
  tempo_voo: number | string | null;
  tempo_total: number | string | null;
  horas_diurnas: number | string | null;
  horas_noturnas: number | string | null;
  pousos_total: number | null;
  combustivel_adicionado: number | string | null;
  litros_combustivel_inicio_voo: number | string | null;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  natureza_voo: string | null;
};

type DiarioMes = {
  id: string;
  celula_atual_ttotal: number | null;
  celula_atual_tvoo: number | null;
};

function DiarioBordoDetalhes() {
  const navigate = useNavigate();
  const { aircraftId } = useParams<{ aircraftId: string }>();

  const [aeronave, setAeronave] = useState<Aeronave | null>(null);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [diarioMes, setDiarioMes] = useState<DiarioMes | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!aircraftId) return;

    const carregarDados = async () => {
      setLoading(true);
      try {
        const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
        const fimDate = new Date(ano, mes, 0);
        const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

        const [aRes, dmRes, lRes] = await Promise.all([
          supabase
            .from("aeronave")
            .select("id,matricula,modelo,consumo_combustivel")
            .eq("id", aircraftId)
            .maybeSingle(),
          supabase
            .from("diario_mes")
            .select("*")
            .eq("aeronave_id", aircraftId)
            .eq("ano", ano)
            .eq("mes", mes)
            .maybeSingle(),
          supabase
            .from("lancamentos_diario_bordo")
            .select("*")
            .eq("aeronave_id", aircraftId)
            .gte("data_registro", ini)
            .lte("data_registro", fim)
            .order("data_registro", { ascending: true }),
        ]);

        setAeronave(aRes.data as Aeronave | null);
        setDiarioMes((dmRes.data ?? null) as DiarioMes | null);
        setLancamentos((lRes.data ?? []) as unknown as Lancamento[]);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [aircraftId, mes, ano]);

  const monthNames = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];

  const calcularTotais = () => {
    const tVoo = lancamentos.reduce((s, l) => s + Number(l.tempo_voo ?? 0), 0);
    const tTotal = lancamentos.reduce((s, l) => s + Number(l.tempo_total ?? 0), 0);
    const tDia = lancamentos.reduce((s, l) => s + Number(l.horas_diurnas ?? 0), 0);
    const tNoit = lancamentos.reduce((s, l) => s + Number(l.horas_noturnas ?? 0), 0);
    const pousos = lancamentos.reduce((s, l) => s + Number(l.pousos_total ?? 0), 0);
    const abast = lancamentos.reduce((s, l) => s + Number(l.combustivel_adicionado ?? 0), 0);

    return { tVoo, tTotal, tDia, tNoit, pousos, abast };
  };

  const totais = calcularTotais();

  if (loading || !aeronave) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl">
              <Plane className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Diário {monthNames[mes - 1]} {ano} — {aeronave.matricula}
              </h1>
              <p className="text-slate-400 text-sm">{aeronave.modelo}</p>
            </div>
          </div>
        </motion.div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Período
            </p>
            <div className="flex gap-2 mb-4">
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
              >
                {monthNames.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </option>
                ))}
              </select>
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none"
              >
                {Array.from({ length: 6 }).map((_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Célula Atual
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50">
                <span className="text-xs text-slate-400">Tempo Total</span>
                <p className="font-bold text-white mt-1">
                  {num(diarioMes?.celula_atual_ttotal ?? 0, 1)}h
                </p>
              </div>
              <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50">
                <span className="text-xs text-slate-400">Tempo Voo</span>
                <p className="font-bold text-white mt-1">
                  {num(diarioMes?.celula_atual_tvoo ?? 0, 1)}h
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-slate-400">T. Voo</span>
            </div>
            <p className="font-bold text-white">{num(totais.tVoo, 1)}h</p>
          </div>

          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-slate-400">T. Dia</span>
            </div>
            <p className="font-bold text-white">{num(totais.tDia, 1)}h</p>
          </div>

          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs text-slate-400">T. Noite</span>
            </div>
            <p className="font-bold text-white">{num(totais.tNoit, 1)}h</p>
          </div>

          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-slate-400">Abastecido</span>
            </div>
            <p className="font-bold text-white">{num(totais.abast, 0)}L</p>
          </div>
        </motion.div>

        {/* Tabela de lançamentos */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden"
        >
          <div className="border-b border-slate-700/50 px-5 py-3.5 flex items-center justify-between bg-slate-800/30">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Plane className="w-4 h-4 text-cyan-400" />
              Registros de Voo
            </h2>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-400">
              {lancamentos.length} voos
            </span>
          </div>

          {lancamentos.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p>Nenhum voo registrado neste período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 text-left">Data</th>
                    <th className="px-4 py-3 text-left">De</th>
                    <th className="px-4 py-3 text-left">Para</th>
                    <th className="px-4 py-3 text-center">T. Voo</th>
                    <th className="px-4 py-3 text-center">T. Total</th>
                    <th className="px-4 py-3 text-center">Pousos</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {lancamentos.map((l, idx) => (
                    <tr
                      key={l.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors ${
                        idx % 2 === 0 ? "bg-slate-800/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {new Date(l.data_registro + "T00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 font-mono">{l.aerodromo_partida ?? "—"}</td>
                      <td className="px-4 py-3 font-mono">{l.aerodromo_chegada ?? "—"}</td>
                      <td className="px-4 py-3 text-center">{num(Number(l.tempo_voo ?? 0), 2)}h</td>
                      <td className="px-4 py-3 text-center">{num(Number(l.tempo_total ?? 0), 2)}h</td>
                      <td className="px-4 py-3 text-center">{l.pousos_total ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
                {lancamentos.length > 0 && (
                  <tfoot className="bg-slate-800/90 border-t-2 border-cyan-500/30">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold uppercase text-cyan-400">
                        TOTAIS
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-cyan-400">
                        {num(totais.tVoo, 1)}h
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-cyan-400">
                        {num(totais.tTotal, 1)}h
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-400">
                        {num(totais.pousos, 0)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}

export default DiarioBordoDetalhes;
