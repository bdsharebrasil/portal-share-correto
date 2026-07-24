import { useState, useEffect } from "react";
import {
  Receipt, MapPin, DollarSign, Play, Coffee, LogOut, Pause,
  ArrowUpRight, CalendarDays, CheckCircle2, Timer,
  Plane, BookOpen, MessageSquare, Plus, AlertTriangle, AlertCircle, Clock, Send
} from "lucide-react";
import { SolicitacaoPagamentoModal } from "@/components/dashboard/financeiro/SolicitacaoPagamentoModal";
import TravelReportsTracking from "@/components/dashboard/financeiro/TravelReportsTracking";
import { InadimplenciaPanel } from "@/components/dashboard/financeiro/InadimplenciaPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { TimeClockHistoryModal } from "@/components/ponto/TimeClockHistoryModal";
import { FlightCycleDashboard } from "@/components/ciclo-voo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import aviationHero from "@/assets/aviation-hero.jpg";

interface TimeEntry {
  id: string;
  entrada_hora: string | null;
  inicio_almoco: string | null;
  fim_almoco: string | null;
  saida_hora: string | null;
  status: string;
  horas_totais?: number;
}

interface Note {
  id: string;
  content: string;
  updated_at: string;
}

export function FinanceiroDashboard() {
  const navigate = useNavigate();
  const [todayEntry, setTodayEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeClockHistoryOpen, setTimeClockHistoryOpen] = useState(false);
  const [showFlightCycle, setShowFlightCycle] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [reportDiscordances, setReportDiscordances] = useState<any[]>([]);
  const [discordancesLoading, setDiscordancesLoading] = useState(true);
  const [solicitacaoPagamentoOpen, setSolicitacaoPagamentoOpen] = useState(false);
  const [travelReportsOpen, setTravelReportsOpen] = useState(false);

  useEffect(() => {
    loadTodayEntry();
    loadNotes();
    loadReportDiscordances();
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadTodayEntry = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('lancamento_ponto')
        .select('*')
        .eq('user_id', user.id)
        .eq('data_entrada', today)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') return;
      setTodayEntry(data);
    } catch (error) {
      console.error('Erro ao carregar ponto:', error);
    }
  };

  const loadNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setNotesLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_notes")
        .select("id, content, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(3);

      if (!error && data) {
        setNotes(data as Note[]);
      }
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    } finally {
      setNotesLoading(false);
    }
  };

  const loadReportDiscordances = async () => {
    try {
      const { data, error } = await supabase
        .from("travel_expense_reports")
        .select("id, numero_relatorio, clientes_id, cliente:clientes_id(razao_social), crew_approval_status, crew_approval_notes, client_approval_status, client_approval_notes, updated_at")
        .in("crew_approval_status", ["rejected"])
        .order("updated_at", { ascending: false })
        .limit(5);

      if (!error && data) {
        setReportDiscordances(data);
      }
    } catch (error) {
      console.error('Erro ao carregar discordâncias:', error);
    } finally {
      setDiscordancesLoading(false);
    }
  };

  const handleClockAction = async (action: 'entrada_hora' | 'inicio_almoco' | 'fim_almoco' | 'saida_hora') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const now = new Date().toISOString();
      const today = format(new Date(), 'yyyy-MM-dd');

      if (action === 'entrada_hora') {
        const { error } = await supabase.from('lancamento_ponto').insert({
          user_id: user.id,
          data_entrada: today,
          entrada_hora: now,
          status: 'em_andamento'
        });
        if (error) throw error;
        toast.success("Ponto iniciado!");

      } else if (action === 'inicio_almoco') {
        const { error } = await supabase.from('lancamento_ponto').update({
          inicio_almoco: now
        }).eq('id', todayEntry!.id);
        if (error) throw error;
        toast.success("Almoço iniciado!");

      } else if (action === 'fim_almoco') {
        const { error } = await supabase.from('lancamento_ponto').update({
          fim_almoco: now
        }).eq('id', todayEntry!.id);
        if (error) throw error;
        toast.success("Retorno registrado!");

      } else if (action === 'saida_hora') {
        const clockIn = new Date(todayEntry!.entrada_hora!);
        const clockOut = new Date(now);
        let totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);

        if (todayEntry!.inicio_almoco && todayEntry!.fim_almoco) {
          const lunchStart = new Date(todayEntry!.inicio_almoco);
          const lunchEnd = new Date(todayEntry!.fim_almoco);
          totalMinutes -= (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60);
        }

        const totalHours = Number((totalMinutes / 60).toFixed(2));
        const { error } = await supabase.from('lancamento_ponto').update({
          saida_hora: now,
          horas_totais: totalHours,
          status: 'concluido'
        }).eq('id', todayEntry!.id);

        if (error) throw error;
        toast.success("Ponto encerrado!");
      }
      await loadTodayEntry();
    } catch (error) {
      toast.error("Erro ao registrar ponto");
    } finally {
      setLoading(false);
    }
  };

  const canStartLunch = todayEntry && todayEntry.entrada_hora && !todayEntry.inicio_almoco;
  const canEndLunch = todayEntry && todayEntry.inicio_almoco && !todayEntry.fim_almoco;
  const canClockOut = todayEntry && todayEntry.entrada_hora && !todayEntry.saida_hora && (!todayEntry.inicio_almoco || todayEntry.fim_almoco);

  const quickTools = [
    {
      icon: Receipt,
      label: "Emissão de Recibo",
      route: "/financeiro/recibo",
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      hoverGlow: "hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    },
    {
      icon: MapPin,
      label: "Relatório Viagem",
      route: "/financeiro/viagem",
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      hoverGlow: "hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    },

    {
      icon: Plane,
      label: "Ciclo de Voo",
      route: undefined,
      iconColor: "text-orange-400",
      iconBg: "bg-orange-500/10",
      hoverGlow: "hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      action: () => setShowFlightCycle(true)
    },
    {
      icon: Send,
      label: "Prog. Pagamento",
      route: undefined,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      hoverGlow: "hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      action: () => setSolicitacaoPagamentoOpen(true)
    },
    {
      icon: CalendarDays,
      label: "Histórico Ponto",
      route: undefined,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-500/10",
      hoverGlow: "hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]",
      action: () => setTimeClockHistoryOpen(true)
    }
  ];

  const getTimeStatus = () => {
    if (!todayEntry) return { label: "Não iniciado", color: "text-muted-foreground", bg: "bg-muted/50" };
    if (todayEntry.status === 'concluido') return { label: "Finalizado", color: "text-emerald-400", bg: "bg-emerald-500/10 border border-emerald-500/20" };
    if (todayEntry.inicio_almoco && !todayEntry.fim_almoco) return { label: "Em almoço", color: "text-amber-400", bg: "bg-amber-500/10 border border-amber-500/20" };
    return { label: "Em andamento", color: "text-blue-400", bg: "bg-blue-500/10 border border-blue-500/20" };
  };

  const status = getTimeStatus();

  const getNextPontoAction = () => {
    if (todayEntry?.status === 'concluido') return null;
    if (!todayEntry) return { label: "Iniciar Ponto", icon: Play, action: () => handleClockAction('entrada_hora'), color: "bg-emerald-600/90 hover:bg-emerald-700 text-emerald-50" };
    if (canStartLunch) return { label: "Ir p/ Almoço", icon: Coffee, action: () => handleClockAction('inicio_almoco'), color: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30" };
    if (canEndLunch) return { label: "Voltar", icon: Pause, action: () => handleClockAction('fim_almoco'), color: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30" };
    if (canClockOut) return { label: "Encerrar", icon: LogOut, action: () => handleClockAction('saida_hora'), color: "bg-red-500/90 hover:bg-red-600 text-white" };
    return null;
  };
  const nextPontoAction = getNextPontoAction();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);

  return (
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 overflow-auto">
      {/* Hero Header */}
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-white/[0.06] shadow-2xl h-32 md:h-40 lg:h-48">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
          style={{ backgroundImage: `url(${aviationHero})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="p-1.5 md:p-2 rounded-md bg-primary/10 border border-primary/20">
                <Plane className="h-3 md:h-4 w-3 md:w-4 text-primary" />
              </div>
              <span className="text-xs md:text-sm font-semibold text-primary uppercase tracking-wider drop-shadow-md">
                DASHBOARD FINANCEIRO
              </span>
            </div>
            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight uppercase drop-shadow-md">
              {currentTime.getHours() < 12 ? 'BOM DIA' : currentTime.getHours() < 18 ? 'BOA TARDE' : 'BOA NOITE'}!
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed hidden sm:block">
              Gerencie suas finanças, registre o ponto e acompanhe suas tarefas diárias.
            </p>
          </div>
        </div>
      </div>

      {/* Discordâncias Alert */}
      {!discordancesLoading && reportDiscordances.length > 0 && (
        <div className="rounded-xl md:rounded-2xl bg-white/[0.02] border border-red-500/20 p-4 md:p-5 backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.05)]">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-red-500/10 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.15)] flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-400 mb-1 text-base uppercase tracking-wide">RELATÓRIOS COM DISCORDÂNCIAS</h3>
              <p className="text-sm text-muted-foreground mb-4">Existem {reportDiscordances.length} relatório(s) de viagem que precisam de ajuste:</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reportDiscordances.slice(0, 2).map(report => (
                  <div
                    key={report.id}
                    className="p-3 bg-white/[0.02] border border-red-500/10 rounded-xl hover:border-red-500/40 hover:bg-white/[0.04] transition-all cursor-pointer group"
                    onClick={() => navigate('/financeiro/relatorio-viagem')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm group-hover:text-red-400 transition-colors truncate uppercase">
                          {report.numero_relatorio}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{report.cliente?.razao_social}</p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20 flex-shrink-0 uppercase">
                        Devolvido
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs md:text-sm text-red-400 border-red-500/20 hover:bg-red-500/10 hover:text-red-300 uppercase"
                onClick={() => navigate('/financeiro/relatorio-viagem')}
              >
                Ver todos
                <ArrowUpRight className="h-3 md:h-4 w-3 md:w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <div className="grid w-full max-w-5xl grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {quickTools.map(tool => (
            <button
              key={tool.label}
              onClick={() => tool.action ? tool.action() : tool.route && navigate(tool.route)}
              className={`group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:border-primary/70 hover:bg-card/90 active:scale-95 ${tool.hoverGlow}`}
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-border/40 bg-background/50 transition-all duration-300 group-hover:scale-110 group-hover:border-primary/40 ${tool.iconBg}`}>
                <tool.icon className={`h-7 w-7 ${tool.iconColor}`} strokeWidth={1.7} />
              </div>
              <span className="text-center text-sm font-semibold leading-tight text-foreground">
                {tool.label}
              </span>
            </button>
          ))}

          <div
            className={cn(
              "relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border bg-card/60 p-5 backdrop-blur-sm transition-all duration-300 hover:scale-[1.03] hover:border-primary/70 hover:bg-card/90 active:scale-95",
            todayEntry?.status === 'concluido' ? "border-emerald-500/30 bg-emerald-500/[0.02]" :
            todayEntry?.inicio_almoco && !todayEntry?.fim_almoco ? "border-amber-500/30 bg-amber-500/[0.02]" :
            todayEntry ? "border-blue-500/30 bg-blue-500/[0.02]" : "border-white/[0.06]"
          )}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <Timer className={cn("h-3.5 w-3.5", todayEntry?.status === 'concluido' ? "text-emerald-400" : "text-muted-foreground")} strokeWidth={1.5} />
            <span className="text-base md:text-lg font-bold font-mono text-foreground tracking-tight leading-none">
              {format(currentTime, "HH:mm")}
            </span>
          </div>

          <Badge className={cn("px-2 py-0 text-[9px] uppercase tracking-wider font-semibold mb-1", status.bg, status.color)}>
            {status.label}
          </Badge>

          {nextPontoAction ? (
            <button
              onClick={nextPontoAction.action}
              disabled={loading}
              className={cn(
                "w-full h-8 rounded-lg text-[10px] md:text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm uppercase",
                nextPontoAction.color
              )}
            >
              <nextPontoAction.icon className="h-3 w-3" />
              <span className="truncate">{nextPontoAction.label}</span>
            </button>
          ) : (
            <div className="w-full h-8 flex items-center justify-center bg-white/[0.03] rounded-lg border border-white/[0.05]">
              <span className="text-[10px] md:text-[11px] text-muted-foreground font-medium">
                {todayEntry?.horas_totais?.toFixed(1)}h computadas
              </span>
            </div>
          )}

          <button
            onClick={() => setTimeClockHistoryOpen(true)}
            className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-primary transition-colors opacity-60 hover:opacity-100"
            title="Ver Histórico"
          >
            <CalendarDays className="h-3 w-3" />
          </button>
          </div>
        </div>
      </div>

      {/* Painel de Vencimentos - Mapa + Aeronaves */}
      <InadimplenciaPanel />

      {/* Modais */}
      <TimeClockHistoryModal open={timeClockHistoryOpen} onOpenChange={setTimeClockHistoryOpen} />

      {showFlightCycle && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md overflow-auto">
          <div className="container mx-auto py-6 px-4 md:px-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.05]">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-3 uppercase tracking-wide">
                <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <Plane className="h-6 w-6 text-orange-400" />
                </div>
                Ciclo de Vida do Voo
              </h2>
              <Button
                variant="outline"
                onClick={() => setShowFlightCycle(false)}
                className="bg-white/[0.02] border-white/[0.1] hover:bg-white/[0.05]"
              >
                Voltar ao Dashboard
              </Button>
            </div>
            <FlightCycleDashboard />
          </div>
        </div>
      )}
      {travelReportsOpen ? (
        <section className="fixed inset-0 z-40 overflow-auto bg-background p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <h2 className="text-xl font-semibold text-foreground uppercase tracking-wide">Relatórios de Viagem em Fluxo</h2>
              <Button variant="outline" onClick={() => setTravelReportsOpen(false)}>
                Voltar ao Dashboard
              </Button>
            </div>
            <TravelReportsTracking />
          </div>
        </section>
      ) : null}
      <SolicitacaoPagamentoModal
        open={solicitacaoPagamentoOpen}
        onOpenChange={setSolicitacaoPagamentoOpen}
        onOpenTravelReports={() => setTravelReportsOpen(true)}
      />
    </main>
  );
}
