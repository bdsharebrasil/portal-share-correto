import { useState, useEffect } from "react";
import {
  Receipt, MapPin, DollarSign, Play, Coffee, LogOut, Pause,
  ArrowUpRight, CalendarDays, FileText, CheckCircle2, Timer,
  Plane, BookOpen, MessageSquare, Plus, AlertTriangle
} from "lucide-react";
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
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  status: string;
  total_hours?: number;
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
        .from('time_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('entry_date', today)
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

  const handleClockAction = async (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const now = new Date().toISOString();
      const today = format(new Date(), 'yyyy-MM-dd');

      if (action === 'clock_in') {
        const { error } = await supabase.from('time_entries').insert({
          user_id: user.id,
          entry_date: today,
          clock_in: now,
          status: 'em_andamento'
        });
        if (error) throw error;
        toast.success("Ponto iniciado!");

      } else if (action === 'lunch_start') {
        const { error } = await supabase.from('time_entries').update({
          lunch_start: now
        }).eq('id', todayEntry!.id);
        if (error) throw error;
        toast.success("Almoço iniciado!");

      } else if (action === 'lunch_end') {
        const { error } = await supabase.from('time_entries').update({
          lunch_end: now
        }).eq('id', todayEntry!.id);
        if (error) throw error;
        toast.success("Retorno registrado!");

      } else if (action === 'clock_out') {
        const clockIn = new Date(todayEntry!.clock_in!);
        const clockOut = new Date(now);
        let totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);

        if (todayEntry!.lunch_start && todayEntry!.lunch_end) {
          const lunchStart = new Date(todayEntry!.lunch_start);
          const lunchEnd = new Date(todayEntry!.lunch_end);
          totalMinutes -= (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60);
        }

        const totalHours = Number((totalMinutes / 60).toFixed(2));
        const { error } = await supabase.from('time_entries').update({
          clock_out: now,
          total_hours: totalHours,
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

  const canStartLunch = todayEntry && todayEntry.clock_in && !todayEntry.lunch_start;
  const canEndLunch = todayEntry && todayEntry.lunch_start && !todayEntry.lunch_end;
  const canClockOut = todayEntry && todayEntry.clock_in && !todayEntry.clock_out && (!todayEntry.lunch_start || todayEntry.lunch_end);

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
      label: "Relatório de Viagem",
      route: "/financeiro/viagem",
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      hoverGlow: "hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]",
    },
    {
      icon: DollarSign,
      label: "Conciliação Bancária",
      route: "/financeiro/conciliacao",
      iconColor: "text-violet-400",
      iconBg: "bg-violet-500/10",
      hoverGlow: "hover:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]",
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
      icon: CalendarDays,
      label: "Histórico de Ponto",
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
    if (todayEntry.lunch_start && !todayEntry.lunch_end) return { label: "Em almoço", color: "text-amber-400", bg: "bg-amber-500/10 border border-amber-500/20" };
    return { label: "Em andamento", color: "text-blue-400", bg: "bg-blue-500/10 border border-blue-500/20" };
  };

  const status = getTimeStatus();

  return (
    <main className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">
      {/* Hero Header */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.05] shadow-lg h-36 md:h-44">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-overlay"
          style={{ backgroundImage: `url(${aviationHero})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="relative z-10 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20">
                <Plane className="h-3 w-3 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider drop-shadow-md">
                Dashboard Financeiro
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Bom {currentTime.getHours() < 12 ? 'dia' : currentTime.getHours() < 18 ? 'tarde' : 'noite'}!
            </h1>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Gerencie suas finanças, registre o ponto e acompanhe suas tarefas diárias.
            </p>
          </div>
        </div>
      </div>

      {/* Discordâncias Alert - Glass/Neon Style */}
      {!discordancesLoading && reportDiscordances.length > 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-red-500/20 p-5 backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.05)]">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mt-1 shadow-[0_0_10px_rgba(239,68,68,0.15)]">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-400 mb-2">Relatórios com Discordâncias</h3>
              <p className="text-sm text-muted-foreground mb-4">Existem {reportDiscordances.length} relatório(s) de viagem que precisam de ajuste:</p>

              <div className="space-y-3">
                {reportDiscordances.map(report => (
                  <div
                    key={report.id}
                    className="p-4 bg-white/[0.02] border border-red-500/10 rounded-xl hover:border-red-500/40 hover:bg-white/[0.04] transition-all cursor-pointer group"
                    onClick={() => navigate('/financeiro/relatorio-viagem')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm group-hover:text-red-400 transition-colors">
                          {report.numero_relatorio}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{report.cliente?.razao_social}</p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
                        Devolvido
                      </Badge>
                    </div>
                    {report.crew_approval_notes && (
                      <p className="text-xs text-red-400/80 mt-2 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                        📝 {report.crew_approval_notes}
                      </p>
                    )}
                    {report.client_approval_notes && (
                      <p className="text-xs text-red-400/80 mt-2 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                        📝 Cliente: {report.client_approval_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => navigate('/financeiro/relatorio-viagem')}
              >
                Ver todos os relatórios
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-4 auto-rows-min">

        {/* Quick Tools Row */}
        {quickTools.map(tool => (
          <button
            key={tool.label}
            onClick={() => tool.action ? tool.action() : tool.route && navigate(tool.route)}
            className={`col-span-6 sm:col-span-4 lg:col-span-2 xl:col-span-2 flex flex-col items-center justify-center gap-4 p-5 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-md rounded-2xl border border-white/[0.05] transition-all duration-300 group min-h-[120px] ${tool.hoverGlow}`}
          >
            <div className={`p-3.5 rounded-xl transition-transform duration-300 group-hover:scale-110 border border-white/[0.05] ${tool.iconBg}`}>
              <tool.icon className={`h-6 w-6 ${tool.iconColor}`} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors text-center leading-tight">
              {tool.label}
            </span>
          </button>
        ))}

        {/* Empty space for 5th tool alignment on xl */}
        <div className="hidden xl:block col-span-2" />

        {/* Left Column - Notes */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                  <BookOpen className="h-5 w-5 text-amber-400" />
                </div>
                <span className="font-semibold text-foreground">Recados</span>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-white/[0.05]" onClick={() => navigate("/minhas-tarefas")}>
                <Plus className="h-4 w-4 mr-1" />
                Novo
              </Button>
            </div>

            {notesLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Carregando recados...
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhum recado criado</p>
                <Button variant="outline" size="sm" className="mt-4 border-white/[0.1] hover:bg-white/[0.05]" onClick={() => navigate("/minhas-tarefas")}>
                  Criar primeiro recado
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => navigate("/minhas-tarefas")}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-primary/40 hover:bg-white/[0.04] transition-all cursor-pointer group"
                  >
                    <p className="text-sm text-foreground/90 line-clamp-2 group-hover:text-foreground transition-colors">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-2.5 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {format(new Date(note.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Time Clock */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 backdrop-blur-md">
            <div className="flex items-center justify-between">

              {/* Left: Clock icon + time */}
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3.5 rounded-xl border transition-colors shadow-lg",
                  todayEntry?.status === 'concluido'
                    ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    : todayEntry?.lunch_start && !todayEntry?.lunch_end
                      ? "bg-amber-500/10 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                      : todayEntry
                        ? "bg-blue-500/10 border-white/[0.27] shadow-[0_0_15px_rgba(59,130,246,0.1)]"
                        : "bg-white/[0.02] border-white/[0.05]"
                )}>
                  <Timer className={cn(
                    "h-6 w-6",
                    todayEntry?.status === 'concluido'
                      ? "text-emerald-400"
                      : todayEntry?.lunch_start && !todayEntry?.lunch_end
                        ? "text-amber-400"
                        : todayEntry
                          ? "text-blue-400"
                          : "text-muted-foreground"
                  )} />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold font-mono text-foreground tracking-tight">
                    {format(currentTime, "HH:mm")}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize mt-0.5">
                    {format(currentTime, "EEE, dd MMM", { locale: ptBR })}
                  </span>
                </div>
              </div>

              {/* Center: Status badge */}
              <Badge className={cn("text-xs px-3 py-1 font-medium", status.bg, status.color)}>
                {status.label}
              </Badge>

              {/* Right: Action buttons */}
              <div className="flex items-center gap-2">
                {todayEntry?.status === 'concluido' ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">{todayEntry.total_hours?.toFixed(1)}h</span>
                  </div>
                ) : !todayEntry ? (
                  <Button
                    onClick={() => handleClockAction('clock_in')}
                    disabled={loading}
                    size="sm"
                    className="bg-emerald-600/93 hover:bg-emerald-700 text-emerald-50 font-semibold h-9 px-4 rounded-sm border border-gray-600/40 overflow-hidden transition-all shadow-none"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Ponto
                  </Button>
                ) : (
                  <>
                    {canStartLunch && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleClockAction('lunch_start')}
                        disabled={loading}
                        className="h-9 w-9 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 transition-colors"
                        title="Iniciar Almoço"
                      >
                        <Coffee className="h-4 w-4" />
                      </Button>
                    )}
                    {canEndLunch && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleClockAction('lunch_end')}
                        disabled={loading}
                        className="h-9 w-9 bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
                        title="Retornar do Almoço"
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {canClockOut && (
                      <Button
                        size="icon"
                        onClick={() => handleClockAction('clock_out')}
                        disabled={loading}
                        className="h-9 w-9 bg-red-500 hover:bg-red-600 text-white shadow-none transition-all"
                        title="Encerrar Expediente"
                      >
                        <LogOut className="h-4 w-4 ml-0.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Clock History Modal */}
      <TimeClockHistoryModal open={timeClockHistoryOpen} onOpenChange={setTimeClockHistoryOpen} />

      {/* Flight Cycle Dashboard Modal */}
      {showFlightCycle && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md overflow-auto">
          <div className="container mx-auto py-6 px-4 md:px-8">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.05]">
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
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
    </main>
  );
}
