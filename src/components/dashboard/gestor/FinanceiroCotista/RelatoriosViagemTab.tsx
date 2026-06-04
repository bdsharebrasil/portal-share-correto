import { useMemo, useState } from "react";
import {
  FileText,
  Search,
  User,
  Filter,
  ChevronDown,
  TrendingUp,
  DollarSign,
  Clock,
  MapPin,
  Calendar,
  Eye,
} from "lucide-react";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const formatDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

// Paleta translucida — pills coloridas por sócio
const PALETA = [
  { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/40" },
  { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/40" },
  { bg: "bg-sky-500/15", text: "text-sky-300", border: "border-sky-500/40" },
  { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/40" },
  { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-500/40" },
  { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-500/40" },
  { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/40" },
  { bg: "bg-fuchsia-500/15", text: "text-fuchsia-300", border: "border-fuchsia-500/40" },
  { bg: "bg-slate-500/15", text: "text-slate-300", border: "border-slate-500/40" },
];

function pickColor(idx: number) {
  return PALETA[idx % PALETA.length];
}

function shortNome(nome: string) {
  if (!nome) return "—";
  const limpo = nome.replace(/\(.*?\)/g, "").trim();
  const primeira = limpo.split(/\s+/)[0] || limpo;
  return primeira.slice(0, 3).toUpperCase();
}

function getStatusLabel(status?: string | null) {
  if (!status) return "—";
  const map: Record<string, string> = {
    rascunho: "Rascunho",
    pendente: "Pendente",
    aprovado: "Aprovado",
    pago: "Pago",
    cancelado: "Cancelado",
    finalizado: "Finalizado",
  };
  return map[status.toLowerCase()] || status;
}

function getStatusColor(status?: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "pago" || s === "aprovado" || s === "finalizado")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (s === "pendente") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  if (s === "cancelado") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  return "bg-slate-500/15 text-slate-300 border-slate-500/40";
}

interface Cotista {
  id: string;
  nome: string;
  percentual: number;
}

interface Relatorio {
  id: string;
  numero_relatorio?: string | null;
  rota?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  dias_count?: number | null;
  total_valor?: number;
  total_clientes?: number;
  status?: string | null;
  socios_id?: string | null;
  nome_tripulante?: string | null;
  aeronave?: string | null;
  observacoes?: string | null;
}

interface Props {
  relatorios: Relatorio[];
  cotistas: Cotista[];
  aeronaveLabel?: string;
  onOpen?: (r: Relatorio) => void;
}

export function RelatoriosViagemTab({ relatorios, cotistas, aeronaveLabel }: Props) {
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroSocio, setFiltroSocio] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [relatorioSelecionado, setRelatorioSelecionado] = useState<string | null>(null);

  const socioMap = useMemo(() => {
    const m = new Map<string, { nome: string; cor: typeof PALETA[0] }>();
    cotistas.forEach((c, idx) => m.set(c.id, { nome: c.nome, cor: pickColor(idx) }));
    return m;
  }, [cotistas]);

  const statusDisponiveis = useMemo(() => {
    const s = new Set<string>();
    relatorios.forEach((r) => r.status && s.add(r.status));
    return Array.from(s);
  }, [relatorios]);

  const totalGeral = relatorios.reduce((acc, r) => acc + (r.total_valor || 0), 0);
  const totalClientes = relatorios.reduce((acc, r) => acc + (r.total_clientes || 0), 0);
  const totalDias = relatorios.reduce((acc, r) => acc + (r.dias_count || 0), 0);

  const relatoriosFiltrados = useMemo(() => {
    const q = termoBusca.trim().toLowerCase();
    return relatorios.filter((r) => {
      if (filtroSocio !== "todos" && r.socios_id !== filtroSocio) return false;
      if (filtroStatus !== "todos" && (r.status || "") !== filtroStatus) return false;
      if (q) {
        return (
          (r.numero_relatorio || "").toLowerCase().includes(q) ||
          (r.rota || "").toLowerCase().includes(q) ||
          (r.nome_tripulante || "").toLowerCase().includes(q) ||
          (r.status || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [relatorios, termoBusca, filtroSocio, filtroStatus]);

  return (
    <div className="min-h-screen bg-[#0f1923] -m-4 rounded-xl overflow-hidden">
      {/* Header Premium */}
      <div className="bg-[#162534] border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
              <FileText className="h-8 w-8 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Relatórios de Viagem</h1>
              <p className="text-slate-400 mt-1">
                {aeronaveLabel ? `${aeronaveLabel} · ` : ""}
                Acompanhamento detalhado de todas as viagens realizadas
              </p>
            </div>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#1a2f42] rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  Relatórios
                </span>
                <FileText className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-4xl font-bold mb-1 text-white">{relatorios.length}</p>
              <p className="text-sm text-slate-400">Total registrado</p>
            </div>

            <div className="bg-[#1a2f42] rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  Valor Total
                </span>
                <TrendingUp className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-3xl font-bold mb-1 text-white">{formatBRL(totalGeral)}</p>
              <p className="text-sm text-slate-400">Custo total</p>
            </div>

            <div className="bg-[#1a2f42] rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  Clientes
                </span>
                <DollarSign className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-3xl font-bold mb-1 text-white">{formatBRL(totalClientes)}</p>
              <p className="text-sm text-slate-400">Valor repassado</p>
            </div>

            <div className="bg-[#1a2f42] rounded-2xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  Dias
                </span>
                <Clock className="h-5 w-5 text-cyan-400" />
              </div>
              <p className="text-4xl font-bold mb-1 text-white">{totalDias}</p>
              <p className="text-sm text-slate-400">Total em viagens</p>
            </div>
          </div>

          {/* Legenda de Sócios */}
          {cotistas.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {cotistas.map((c, idx) => {
                const cor = pickColor(idx);
                return (
                  <span
                    key={c.id}
                    className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border ${cor.bg} ${cor.text} ${cor.border}`}
                  >
                    {shortNome(c.nome)} · {c.nome}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filtros e Busca */}
        <div className="bg-[#162534] rounded-2xl border border-slate-700/50 p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por número, rota ou tripulante..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#0f1923] border border-slate-700/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-white placeholder:text-slate-500"
              />
            </div>

            <div className="relative min-w-[200px]">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none z-10" />
              <select
                value={filtroSocio}
                onChange={(e) => setFiltroSocio(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-[#0f1923] border border-slate-700/50 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all cursor-pointer text-white"
              >
                <option value="todos">Todos os sócios</option>
                {cotistas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative min-w-[200px]">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none z-10" />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-[#0f1923] border border-slate-700/50 rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all cursor-pointer text-white"
              >
                <option value="todos">Todos os status</option>
                {statusDisponiveis.map((s) => (
                  <option key={s} value={s}>
                    {getStatusLabel(s)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Lista de Relatórios */}
        <div className="space-y-3">
          {relatoriosFiltrados.length === 0 ? (
            <div className="bg-[#162534] rounded-2xl border border-slate-700/50 p-12 text-center">
              <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Nenhum relatório encontrado
              </h3>
              <p className="text-slate-400">
                Tente ajustar os filtros ou realizar uma nova busca.
              </p>
            </div>
          ) : (
            relatoriosFiltrados.map((relatorio) => {
              const info = relatorio.socios_id ? socioMap.get(relatorio.socios_id) : null;
              const cor = info?.cor || PALETA[PALETA.length - 1];
              const expandido = relatorioSelecionado === relatorio.id;

              return (
                <div
                  key={relatorio.id}
                  className="bg-[#162534] rounded-2xl border border-slate-700/50 hover:border-cyan-500/50 transition-all duration-300 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-mono font-semibold border ${cor.bg} ${cor.text} ${cor.border}`}
                          title={info?.nome || "Sem sócio"}
                        >
                          {relatorio.numero_relatorio || "—"}
                        </span>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            relatorio.status
                          )}`}
                        >
                          {getStatusLabel(relatorio.status)}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-white mb-0.5">
                          {formatBRL(relatorio.total_valor || 0)}
                        </p>
                        <p className="text-xs text-slate-400">
                          Cliente: {formatBRL(relatorio.total_clientes || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-wider text-slate-500 mb-0.5">
                            Rota
                          </p>
                          <p className="text-base font-medium text-white">
                            {relatorio.rota || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-cyan-400 mt-0.5" />
                          <div>
                            <p className="text-xs uppercase tracking-wider text-slate-500 mb-0.5">
                              Período
                            </p>
                            <p className="text-sm text-white">
                              {formatDate(relatorio.data_inicio)} → {formatDate(relatorio.data_fim)}
                            </p>
                            {!!relatorio.dias_count && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                {relatorio.dias_count} dias
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-cyan-400 mt-0.5" />
                          <div>
                            <p className="text-xs uppercase tracking-wider text-slate-500 mb-0.5">
                              Tripulante
                            </p>
                            <p className="text-sm text-white">
                              {relatorio.nome_tripulante || "—"}
                            </p>
                            {relatorio.aeronave && (
                              <p className="text-xs text-slate-400 mt-0.5">{relatorio.aeronave}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-700/50">
                        <button
                          onClick={() =>
                            setRelatorioSelecionado(expandido ? null : relatorio.id)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/30 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {expandido ? "Ocultar detalhes" : "Ver detalhes"}
                        </button>
                      </div>

                      {expandido && (
                        <div className="pt-4 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="bg-[#0f1923] rounded-xl p-4 space-y-3">
                            <div>
                              <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                Observações
                              </p>
                              <p className="text-sm text-slate-300">
                                {relatorio.observacoes || "Sem observações"}
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-700/50">
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Aeronave
                                </p>
                                <p className="text-sm font-medium text-white">
                                  {relatorio.aeronave || aeronaveLabel || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Duração
                                </p>
                                <p className="text-sm font-medium text-white">
                                  {relatorio.dias_count || 0} dias
                                </p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                                  Status
                                </p>
                                <p className="text-sm font-medium text-white capitalize">
                                  {getStatusLabel(relatorio.status)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé com Resumo */}
        {relatoriosFiltrados.length > 0 && (
          <div className="mt-8 bg-[#162534] rounded-2xl border border-slate-700/50 p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-400">
                <FileText className="h-5 w-5" />
                <span className="text-sm">
                  Exibindo{" "}
                  <strong className="text-white font-semibold">
                    {relatoriosFiltrados.length}
                  </strong>{" "}
                  de{" "}
                  <strong className="text-white font-semibold">{relatorios.length}</strong>{" "}
                  relatórios
                </span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block mb-0.5">Total filtrado</span>
                  <span className="text-xl font-bold text-white">
                    {formatBRL(
                      relatoriosFiltrados.reduce((acc, r) => acc + (r.total_valor || 0), 0)
                    )}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block mb-0.5">Total dias</span>
                  <span className="text-xl font-bold text-white">
                    {relatoriosFiltrados.reduce((acc, r) => acc + (r.dias_count || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
