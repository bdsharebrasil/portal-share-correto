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
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const formatDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

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
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (s === "pendente") return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  if (s === "cancelado") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
  return "bg-slate-500/10 text-slate-400 border-slate-500/20";
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

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function RelatoriosViagemTab({ relatorios, cotistas, aeronaveLabel }: Props) {
  const hoje = new Date();
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroSocio, setFiltroSocio] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [relatorioSelecionado, setRelatorioSelecionado] = useState<string | null>(null);
  
  // Controle de Navegação por Mês
  const [mesAtivo, setMesAtivo] = useState(hoje.getMonth());
  const [anoAtivo, setAnoAtivo] = useState(hoje.getFullYear());

  const navegarMes = (direcao: number) => {
    let novoMes = mesAtivo + direcao;
    let novoAno = anoAtivo;
    if (novoMes < 0) {
      novoMes = 11;
      novoAno--;
    } else if (novoMes > 11) {
      novoMes = 0;
      novoAno++;
    }
    setMesAtivo(novoMes);
    setAnoAtivo(novoAno);
  };

  const socioMap = useMemo(() => {
    const m = new Map<string, { nome: string; cor: typeof PALETA[0] }>();
    cotistas.forEach((c, idx) => m.set(c.id, { nome: c.nome, cor: pickColor(idx) }));
    return m;
  }, [cotistas]);

  const relatoriosFiltrados = useMemo(() => {
    const q = termoBusca.trim().toLowerCase();
    return relatorios.filter((r) => {
      const dataInicio = r.data_inicio ? new Date(r.data_inicio) : null;
      if (!dataInicio) return false;

      // Filtro de Mês/Ano
      if (dataInicio.getMonth() !== mesAtivo || dataInicio.getFullYear() !== anoAtivo) return false;

      if (filtroSocio !== "todos" && r.socios_id !== filtroSocio) return false;
      if (filtroStatus !== "todos" && (r.status || "") !== filtroStatus) return false;

      if (q) {
        return (
          (r.numero_relatorio || "").toLowerCase().includes(q) ||
          (r.rota || "").toLowerCase().includes(q) ||
          (r.nome_tripulante || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [relatorios, termoBusca, filtroSocio, filtroStatus, mesAtivo, anoAtivo]);

  const totais = useMemo(() => {
    return relatoriosFiltrados.reduce((acc, r) => ({
      valor: acc.valor + (r.total_valor || 0),
      clientes: acc.clientes + (r.total_clientes || 0),
      dias: acc.dias + (r.dias_count || 0),
    }), { valor: 0, clientes: 0, dias: 0 });
  }, [relatoriosFiltrados]);

  return (
    <div className="space-y-6">
      {/* Filtros e Navegação Centralizada */}
      <Card className="bg-card/40 border-border/40 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          {/* Navegação de Mês */}
          <div className="flex items-center justify-between p-4 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navegarMes(-1)}
                className="hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center min-w-[150px]">
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                  {MESES[mesAtivo]} <span className="text-primary">{anoAtivo}</span>
                </h3>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navegarMes(1)}
                className="hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-6 px-6 border-l border-border/40">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total Viagens</p>
                  <p className="text-lg font-bold text-foreground">{formatBRL(totais.valor)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total Dias</p>
                  <p className="text-lg font-bold text-foreground">{totais.dias} dias</p>
                </div>
              </div>
            </div>
          </div>

          {/* Barra de Filtros */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/5">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por rota, número ou tripulante..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={filtroSocio}
                onChange={(e) => setFiltroSocio(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border/40 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="todos">Todos os sócios</option>
                {cotistas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border/40 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="todos">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="pago">Pago</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Relatórios */}
      <div className="grid grid-cols-1 gap-4">
        {relatoriosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-card/20 rounded-3xl border border-dashed border-border/40">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">Nenhum relatório encontrado para este período.</p>
          </div>
        ) : (
          relatoriosFiltrados.map((r) => {
            const info = r.socios_id ? socioMap.get(r.socios_id) : null;
            const cor = info?.cor || PALETA[PALETA.length - 1];
            const expandido = relatorioSelecionado === r.id;

            return (
              <div 
                key={r.id}
                className="group bg-card/40 border border-border/40 rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300"
              >
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl border ${cor.bg} ${cor.text} ${cor.border} font-mono font-bold text-sm`}>
                      {r.numero_relatorio || "—"}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground flex items-center gap-2">
                        {r.rota || "Sem rota definida"}
                        <Badge variant="outline" className={`${getStatusColor(r.status)} border-none text-[10px] uppercase px-2 py-0`}>
                          {getStatusLabel(r.status)}
                        </Badge>
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(r.data_inicio)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {r.nome_tripulante || "Tripulante não informado"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Valor</p>
                      <p className="text-lg font-bold text-foreground">{formatBRL(r.total_valor)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Duração</p>
                      <p className="text-lg font-bold text-foreground">{r.dias_count || 0} dias</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setRelatorioSelecionado(expandido ? null : r.id)}
                      className={`rounded-full transition-transform duration-300 ${expandido ? "rotate-180 bg-primary/10 text-primary" : ""}`}
                    >
                      <ChevronDown className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {expandido && (
                  <div className="px-5 pb-5 pt-2 border-t border-border/20 bg-muted/5 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Período Detalhado</p>
                          <p className="text-sm font-medium">{formatDate(r.data_inicio)} até {formatDate(r.data_fim)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Sócio / Cotista</p>
                          <p className="text-sm font-medium">{info?.nome || "Não vinculado"}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Tripulante Responsável</p>
                          <p className="text-sm font-medium">{r.nome_tripulante || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Aeronave</p>
                          <p className="text-sm font-medium font-mono">{r.aeronave || aeronaveLabel || "—"}</p>
                        </div>
                      </div>

                      <div className="bg-background/40 p-4 rounded-xl border border-border/40">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Observações</p>
                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                          {r.observacoes || "Nenhuma observação registrada para este relatório."}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end gap-3">
                      <Button variant="outline" size="sm" className="gap-2 text-xs rounded-lg">
                        <Eye className="h-3.5 w-3.5" /> Abrir Relatório Completo
                      </Button>
                      <Button size="sm" className="gap-2 text-xs rounded-lg">
                        <FileText className="h-3.5 w-3.5" /> Gerar PDF da Viagem
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
