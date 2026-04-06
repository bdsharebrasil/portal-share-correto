import { useState, useEffect } from "react";
import { Receipt, MapPin, DollarSign, Play, Coffee, LogOut, Pause, ArrowUpRight, CalendarDays, FileText, CheckCircle2, Timer, Plane, BookOpen, MessageSquare, Plus, Badge as BadgeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { TimeClockHistoryModal } from "@/components/time-tracking/TimeClockHistoryModal";
import { FlightCycleDashboard } from "@/components/flight-cycle";
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
interface Task {
  id: string;
  title: string;
  priority: "baixa" | "media" | "alta";
  status: string;
  due_date: string | null;
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
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(true);
  useEffect(() => {
    loadTodayEntry();
    loadTasks();
    loadNotes();
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  const loadTodayEntry = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      const {
        data,
        error
      } = await supabase.from('time_entries').select('*').eq('user_id', user.id).eq('entry_date', today).maybeSingle();
      if (error && error.code !== 'PGRST116') return;
      setTodayEntry(data);
    } catch (error) {
      console.error('Erro ao carregar ponto:', error);
    }
  };
  const loadTasks = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        setTasksLoading(false);
        return;
      }
      const {
        data,
        error
      } = await supabase.from("tasks").select("id, title, priority, status, due_date").or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`).eq("status", "aberto").order("due_date", {
        ascending: true
      }).limit(4);
      if (!error && data) {
        setPendingTasks(data as Task[]);
      }
    } catch (error) {
      console.error('Erro ao carregar tarefas:', error);
    } finally {
      setTasksLoading(false);
    }
  };
  const loadNotes = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        setNotesLoading(false);
        return;
      }
      const {
        data,
        error
      } = await supabase.from("user_notes").select("id, content, updated_at").eq("user_id", user.id).order("updated_at", {
        ascending: false
      }).limit(3);
      if (!error && data) {
        setNotes(data as Note[]);
      }
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    } finally {
      setNotesLoading(false);
    }
  };
  const handleClockAction = async (action: 'clock_in' | 'lunch_start' | 'lunch_end' | 'clock_out') => {
    setLoading(true);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }
      const now = new Date().toISOString();
      const today = format(new Date(), 'yyyy-MM-dd');
      if (action === 'clock_in') {
        const {
          error
        } = await supabase.from('time_entries').insert({
          user_id: user.id,
          entry_date: today,
          clock_in: now,
          status: 'em_andamento'
        });
        if (error) throw error;
        toast.success("Ponto iniciado!");
      } else if (action === 'lunch_start') {
        const {
          error
        } = await supabase.from('time_entries').update({
          lunch_start: now
        }).eq('id', todayEntry!.id);
        if (error) throw error;
        toast.success("Almoço iniciado!");
      } else if (action === 'lunch_end') {
        const {
          error
        } = await supabase.from('time_entries').update({
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
        const {
          error
        } = await supabase.from('time_entries').update({
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
  const quickTools = [{
    icon: Receipt,
    label: "Emissão de Recibo",
    route: "/financeiro/recibo",
    color: "text-emerald-400",
    bg: "bg-emerald-500/20"
  }, {
    icon: MapPin,
    label: "Relatório de Viagem",
    route: "/financeiro/viagem",
    color: "text-blue-400",
    bg: "bg-blue-500/20"
  }, {
    icon: DollarSign,
    label: "Conciliação Bancária",
    route: "/financeiro/conciliacao",
    color: "text-violet-400",
    bg: "bg-violet-500/20"
  }, {
    icon: Plane,
    label: "Ciclo de Voo",
    route: undefined,
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    action: () => setShowFlightCycle(true)
  }, {
    icon: CalendarDays,
    label: "Histórico de Ponto",
    route: undefined,
    color: "text-cyan-400",
    bg: "bg-cyan-500/20",
    action: () => setTimeClockHistoryOpen(true)
  }];
  const getTimeStatus = () => {
    if (!todayEntry) return {
      label: "Não iniciado",
      color: "text-muted-foreground",
      bg: "bg-muted/50"
    };
    if (todayEntry.status === 'concluido') return {
      label: "Finalizado",
      color: "text-emerald-400",
      bg: "bg-emerald-500/20"
    };
    if (todayEntry.lunch_start && !todayEntry.lunch_end) return {
      label: "Em almoço",
      color: "text-amber-400",
      bg: "bg-amber-500/20"
    };
    return {
      label: "Em andamento",
      color: "text-blue-400",
      bg: "bg-blue-500/20"
    };
  };
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "media":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "baixa":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  const status = getTimeStatus();
  return <main className="flex-1 p-4 md:p-6 space-y-5 overflow-auto">
    {/* Hero Header */}
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 h-36 md:h-44">
      <img src={aviationHero} alt="Aviation" className="absolute inset-0 w-full h-full object-cover opacity-30" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
        <div className="relative z-10 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-widest">
              Dashboard Financeiro
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Bom {currentTime.getHours() < 12 ? 'dia' : currentTime.getHours() < 18 ? 'tarde' : 'noite'}!
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Gerencie suas finanças, registre o ponto e acompanhe suas tarefas.
          </p>
        </div>
      </div>
    </div>

    {/* Bento Grid Layout */}
    <div className="grid grid-cols-12 gap-4 auto-rows-min">

      {/* Quick Tools Row - 5 items spanning full width */}
      {quickTools.map(tool => <button key={tool.label} onClick={() => tool.action ? tool.action() : tool.route && navigate(tool.route)} className="col-span-6 sm:col-span-4 lg:col-span-2 xl:col-span-2 rounded-2xl bg-card/60 border border-border/50 p-4 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-card/80 transition-all duration-300 group backdrop-blur-sm min-h-[100px]">
        <div className={cn("p-2.5 rounded-xl", tool.bg)}>
          <tool.icon className={cn("h-5 w-5", tool.color)} strokeWidth={1.5} />
        </div>
        <span className="text-xs font-medium text-foreground text-center leading-tight">{tool.label}</span>
      </button>)}

      {/* Empty space for 5th tool alignment on xl */}
      <div className="hidden xl:block col-span-2" />

      {/* Left Column */}
      <div className="col-span-12 lg:col-span-6 space-y-4">
        {/* Tasks Card */}
        <div className="rounded-2xl bg-card/60 border border-border/50 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/20">
                <FileText className="h-5 w-5 text-violet-400" />
              </div>
              <span className="font-semibold text-foreground">Minhas Tarefas</span>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => navigate("/minhas-tarefas")}>
              Ver todas
              <ArrowUpRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {tasksLoading ? <div className="text-center py-8 text-muted-foreground text-sm">
            Carregando tarefas...
          </div> : pendingTasks.length === 0 ? <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma tarefa pendente! 🎉</p>
          </div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingTasks.map(task => <div key={task.id} onClick={() => navigate("/minhas-tarefas")} className="p-3 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 transition-all cursor-pointer group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {task.title}
                </p>
                <Badge variant="outline" className={cn("text-[10px] shrink-0", getPriorityColor(task.priority))}>
                  {task.priority}
                </Badge>
              </div>
              {task.due_date && <p className="text-xs text-muted-foreground mt-2">
                Vence: {format(new Date(task.due_date), "dd/MM")}
              </p>}
            </div>)}
          </div>}
        </div>

        {/* Notes/Recados Card */}
        <div className="rounded-2xl bg-card/60 border border-border/50 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20">
                <BookOpen className="h-5 w-5 text-amber-400" />
              </div>
              <span className="font-semibold text-foreground">Recados</span>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => navigate("/minhas-tarefas")}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>

          {notesLoading ? <div className="text-center py-8 text-muted-foreground text-sm">
            Carregando recados...
          </div> : notes.length === 0 ? <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum recado criado</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/minhas-tarefas")}>
              Criar primeiro recado
            </Button>
          </div> : <div className="space-y-3">
            {notes.map(note => <div key={note.id} onClick={() => navigate("/minhas-tarefas")} className="p-3 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 transition-all cursor-pointer">
              <p className="text-sm text-foreground line-clamp-2">{note.content}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {format(new Date(note.updated_at), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>)}
          </div>}
        </div>
      </div>

      {/* Right Column */}
      <div className="col-span-12 lg:col-span-6 space-y-4">
        {/* Time Clock Card - Compact Modern */}
        <div className="rounded-xl bg-card/80 border border-border/40 p-3 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            {/* Left: Clock icon + time */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                todayEntry?.status === 'concluido'
                  ? "bg-emerald-500/20"
                  : todayEntry?.lunch_start && !todayEntry?.lunch_end
                    ? "bg-amber-500/20"
                    : todayEntry
                      ? "bg-blue-500/20"
                      : "bg-muted/50"
              )}>
                <Timer className={cn(
                  "h-4 w-4",
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
                <span className="text-xl font-bold font-mono text-foreground tracking-tight">
                  {format(currentTime, "HH:mm")}
                </span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {format(currentTime, "EEE, dd MMM", { locale: ptBR })}
                </span>
              </div>
            </div>

            {/* Center: Status badge */}
            <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 h-5", status.bg, status.color, "border-0")}>
              {status.label}
            </Badge>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-1.5">
              {todayEntry?.status === 'concluido' ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">{todayEntry.total_hours?.toFixed(1)}h</span>
                </div>
              ) : !todayEntry ? (
                <Button
                  onClick={() => handleClockAction('clock_in')}
                  disabled={loading}
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white h-8 px-3 text-xs"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Iniciar
                </Button>
              ) : (
                <>
                  {canStartLunch && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleClockAction('lunch_start')}
                      disabled={loading}
                      className="h-8 w-8 border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                    >
                      <Coffee className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canEndLunch && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleClockAction('lunch_end')}
                      disabled={loading}
                      className="h-8 w-8 border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                    >
                      <Pause className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canClockOut && (
                    <Button
                      size="icon"
                      onClick={() => handleClockAction('clock_out')}
                      disabled={loading}
                      className="h-8 w-8 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white"
                    >
                      <LogOut className="h-3.5 w-3.5" />
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
    {showFlightCycle && <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-auto">
      <div className="container mx-auto py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-foreground">Ciclo de Vida do Voo</h2>
          <Button variant="outline" onClick={() => setShowFlightCycle(false)}>
            Voltar ao Dashboard
          </Button>
        </div>
        <FlightCycleDashboard />
      </div>
    </div>}
  </main>;
}
