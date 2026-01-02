import { useState, useEffect } from "react";
import {
  Receipt,
  MapPin,
  DollarSign,
  Clock,
  Play,
  Coffee,
  LogOut,
  Pause,
  ArrowUpRight,
  CalendarDays,
  FileText,
  CheckCircle2,
  Timer,
  Plane
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { NotesPanel } from "@/components/dashboard/NotesPanel";
import { TasksQuickAccess } from "@/components/dashboard/TasksQuickAccess";
import { TimeClockHistoryModal } from "@/components/time-tracking/TimeClockHistoryModal";
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

export function FinanceiroDashboard() {
  const navigate = useNavigate();
  const [todayEntry, setTodayEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeClockHistoryOpen, setTimeClockHistoryOpen] = useState(false);

  useEffect(() => {
    loadTodayEntry();
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
        const { error } = await supabase.from('time_entries')
          .update({ lunch_start: now })
          .eq('id', todayEntry!.id);
        if (error) throw error;
        toast.success("Almoço iniciado!");
      } else if (action === 'lunch_end') {
        const { error } = await supabase.from('time_entries')
          .update({ lunch_end: now })
          .eq('id', todayEntry!.id);
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
        const { error } = await supabase.from('time_entries')
          .update({ clock_out: now, total_hours: totalHours, status: 'concluido' })
          .eq('id', todayEntry!.id);
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
    { icon: Receipt, label: "Emissão de Recibo", route: "/financeiro/recibo", gradient: "from-emerald-500 to-teal-600", action: undefined },
    { icon: MapPin, label: "Relatório de Viagem", route: "/financeiro/viagem", gradient: "from-blue-500 to-indigo-600", action: undefined },
    { icon: DollarSign, label: "Conciliação Bancária", route: "/financeiro/conciliacao", gradient: "from-violet-500 to-purple-600", action: undefined },
    { icon: CalendarDays, label: "Histórico de Ponto", route: undefined, gradient: "from-cyan-500 to-blue-600", action: () => setTimeClockHistoryOpen(true) },
  ];

  const getTimeStatus = () => {
    if (!todayEntry) return { label: "Não iniciado", color: "text-muted-foreground" };
    if (todayEntry.status === 'concluido') return { label: "Finalizado", color: "text-emerald-400" };
    if (todayEntry.lunch_start && !todayEntry.lunch_end) return { label: "Em almoço", color: "text-amber-400" };
    return { label: "Em andamento", color: "text-blue-400" };
  };

  const status = getTimeStatus();

  return (
    <main className="flex-1 p-4 md:p-6 space-y-6 overflow-auto">
      {/* Hero Header with Aviation Image */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 h-40 md:h-48">
        <img
          src={aviationHero}
          alt="Aviation"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
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

      {/* Bento Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">

        {/* Quick Tools - Small Cards */}
        {quickTools.map((tool) => (
          <button
            key={tool.label}
            onClick={() => tool.action ? tool.action() : tool.route && navigate(tool.route)}
            className="col-span-1 rounded-2xl bg-slate-800/50 border border-white/10 p-4 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-slate-800/80 transition-all duration-300 group backdrop-blur-sm min-h-[100px]"
          >
            <div className={cn(
              "p-3 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
              tool.gradient
            )}>
              <tool.icon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-medium text-foreground text-center leading-tight">{tool.label}</span>
          </button>
        ))}

        {/* Time Clock - Compact Card */}
        <div className="col-span-2 rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 p-4 flex flex-col backdrop-blur-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/20">
                <Timer className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium text-sm text-foreground">Ponto</span>
            </div>
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full bg-white/5", status.color)}>
              {status.label}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            {/* Clock Display */}
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
                {format(currentTime, "HH:mm")}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {format(currentTime, "EEE, dd MMM", { locale: ptBR })}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {todayEntry?.status === 'concluido' ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">{todayEntry.total_hours?.toFixed(1)}h</span>
                </div>
              ) : !todayEntry ? (
                <Button
                  onClick={() => handleClockAction('clock_in')}
                  disabled={loading}
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
                >
                  <Play className="h-4 w-4 mr-1" />
                  Iniciar
                </Button>
              ) : (
                <>
                  {canStartLunch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClockAction('lunch_start')}
                      disabled={loading}
                      className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                    >
                      <Coffee className="h-4 w-4" />
                    </Button>
                  )}
                  {canEndLunch && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClockAction('lunch_end')}
                      disabled={loading}
                      className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  {canClockOut && (
                    <Button
                      size="sm"
                      onClick={() => handleClockAction('clock_out')}
                      disabled={loading}
                      className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Time Entries Info */}
          {todayEntry && todayEntry.clock_in && todayEntry.status !== 'concluido' && (
            <div className="flex gap-3 mt-3 pt-3 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-muted-foreground">Entrada:</span>
                <span className="text-xs font-medium text-foreground">{format(new Date(todayEntry.clock_in), "HH:mm")}</span>
              </div>
              {todayEntry.lunch_start && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-xs text-muted-foreground">Almoço:</span>
                  <span className="text-xs font-medium text-foreground">{format(new Date(todayEntry.lunch_start), "HH:mm")}</span>
                </div>
              )}
              {todayEntry.lunch_end && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-xs text-muted-foreground">Retorno:</span>
                  <span className="text-xs font-medium text-foreground">{format(new Date(todayEntry.lunch_end), "HH:mm")}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tasks Panel - Large Card */}
        <div className="col-span-2 md:col-span-2 lg:col-span-3 row-span-2 rounded-2xl bg-slate-800/50 border border-white/10 p-5 backdrop-blur-sm flex flex-col min-h-[320px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-violet-500/20">
                <FileText className="h-5 w-5 text-violet-400" />
              </div>
              <span className="font-semibold text-foreground">Minhas Tarefas</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/tarefas")}
            >
              Ver todas
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto">
            <TasksQuickAccess />
          </div>
        </div>

        {/* Notes Panel */}
        <div className="col-span-2 md:col-span-2 lg:col-span-3 row-span-2 rounded-2xl bg-slate-800/50 border border-white/10 p-5 backdrop-blur-sm min-h-[320px]">
          <NotesPanel />
        </div>
      </div>

      {/* Time Clock History Modal */}
      <TimeClockHistoryModal
        open={timeClockHistoryOpen}
        onOpenChange={setTimeClockHistoryOpen}
      />
    </main>
  );
}
