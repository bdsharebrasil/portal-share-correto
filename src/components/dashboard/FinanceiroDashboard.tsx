import { useState, useEffect } from "react";
import {
  Receipt, MapPin, DollarSign, Play, Coffee, LogOut, Pause,
  ArrowUpRight, CalendarDays, FileText, CheckCircle2, Timer,
  Plane, BookOpen, MessageSquare, Plus, AlertTriangle, Clock, Send
} from "lucide-react";
import { SolicitacaoPagamentoModal } from "@/components/dashboard/financeiro/SolicitacaoPagamentoModal";
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
  const [solicitacaoPagamentoOpen, setSolicitacaoPagamentoOpen] = useState(false);

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
      icon: Send,
      label: "Programar Pagamento",
      route: undefined,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      hoverGlow: "hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      action: () => setSolicitacaoPagamentoOpen(true)
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
    <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 overflow-auto">
      {/* Hero Header */}
      <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-white/[0.06] shadow-2xl h-32 md:h-40 lg:h-48">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-overlay"
          style={{ backgroundImage: `url(${aviationHero})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="p-1.5 md:p-2 rounded-md bg-primary/10 border border-primary/20">
                <Plane className="h-3 md:h-4 w-3 md:w-4 text-primary" />
              </div>
              <span className="text-xs md:text-sm font-semibold text-primary uppercase tracking-wider drop-shadow-md">
                Dashboard Financeiro
              </span>
            </div>
            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
              Bom {currentTime.getHours() < 12 ? 'dia' : currentTime.getHours() < 18 ? 'tarde' : 'noite'}!
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed hidden sm:block">
              Gerencie suas finanças, registre o ponto e acompanhe suas tarefas diárias.
            </p>
          </div>
        </div>
      </div>

      {/* Discordâncias Alert - Glass/Neon Style */}
      {!discordancesLoading && reportDiscordances.length > 0 && (
        <div className="rounded-xl md:rounded-2xl bg-white/[0.02] border border-red-500/20 p-4 md:p-5 backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.05)]">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg md:rounded-xl bg-red-500/10 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.15)] flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-400 mb-1 text-base">Relatórios com Discordâncias</h3>
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
                        <p className="font-medium text-foreground text-sm group-hover:text-red-400 transition-colors truncate">
                          {report.numero_relatorio}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{report.cliente?.razao_social}</p>
                      </div>
                      <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20 flex-shrink-0">
                        Devolvido
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs md:text-sm text-red-400 border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => navigate('/financeiro/relatorio-viagem')}
              >
                Ver todos
                <ArrowUpRight className="h-3 md:h-4 w-3 md:w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* NOVO LAYOUT - Dividido em Seções Limpas */}
      
      {/* 1. Grid das Ferramentas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
        {quickTools.map(tool => (
          <button
            key={tool.label}
            onClick={() => tool.action ? tool.action() : tool.route && navigate(tool.route)}
            className={`flex flex-col items-center justify-center gap-3 md:gap-4 p-4 md:p-5 bg-white/[0.02] hover:bg-white/[0.045] backdrop-blur-md rounded-2xl border border-white/[0.06] transition-transform duration-300 group shadow-md hover:shadow-lg transform-gpu hover:-translate-y-1 ${tool.hoverGlow}`}
          >
            <div className={`p-3 md:p-3.5 rounded-xl transition-transform duration-300 group-hover:scale-110 border border-white/[0.05] ${tool.iconBg}`}>
              <tool.icon className={`h-5 w-5 md:h-6 md:w-6 ${tool.iconColor}`} strokeWidth={1.5} />
            </div>
            <span className="text-xs md:text-sm font-semibold text-foreground group-hover:text-primary transition-colors text-center leading-tight">
              {tool.label}
            </span>
          </button>
        ))}
      </div>

      {/* 2. Área de Recados e Ponto Lado a Lado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-stretch">
        
        {/* Coluna Esquerda - Recados (Ocupa 2 de 3 colunas no Desktop) */}
        <div className="lg:col-span-2 flex flex-col h-full">
          <div className="flex-1 rounded-3xl bg-white/[0.02] border border-white/[0.06] p-6 md:p-8 backdrop-blur-md shadow-lg flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                  <BookOpen className="h-5 w-5 text-amber-400" />
                </div>
                <span className="text-lg font-semibold text-foreground">Recados Recentes</span>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-white/[0.05]" onClick={() => navigate("/minhas-tarefas")}>
                <Plus className="h-4 w-4 mr-1.5" />
                Novo
              </Button>
            </div>

            {notesLoading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-8">
                Carregando recados...
              </div>
            ) : notes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm">Nenhum recado criado</p>
                <Button variant="outline" size="sm" className="mt-4 border-white/[0.1] hover:bg-white/[0.05]" onClick={() => navigate("/minhas-tarefas")}>
                  Criar primeiro recado
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => navigate("/minhas-tarefas")}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-primary/40 hover:bg-white/[0.04] transition-all cursor-pointer group"
                  >
                    <p className="text-sm md:text-base text-foreground/90 line-clamp-2 group-hover:text-foreground transition-colors">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(note.updated_at), "dd/MM/yyyy 'às' HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna Direita - Ponto (Ocupa 1 de 3 colunas no Desktop) -> Design de Widget Profissional */}
        <div className="lg:col-span-1 flex flex-col h-full">
          <div className="flex-1 rounded-3xl bg-white/[0.02] border border-white/[0.06] p-6 md:p-8 backdrop-blur-md shadow-lg flex flex-col justify-center items-center relative overflow-hidden">
            
            {/* Background Decorativo Suave */}
            <div className={cn(
                "absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 rounded-full pointer-events-none",
                todayEntry?.status === 'concluido' ? "bg-emerald-500" :
                todayEntry?.lunch_start && !todayEntry?.lunch_end ? "bg-amber-500" :
                todayEntry ? "bg-blue-500" : "bg-white/10"
            )} />

            <div className="text-center w-full space-y-6 relative z-10">
              
              {/* Cabeçalho Widget */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "p-3.5 rounded-2xl border mb-2 shadow-lg transition-colors",
                  todayEntry?.status === 'concluido' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                  todayEntry?.lunch_start && !todayEntry?.lunch_end ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                  todayEntry ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-white/[0.02] border-white/[0.05] text-muted-foreground"
                )}>
                  <Timer className="h-7 w-7" />
                </div>
                
                {/* Relógio Grande Digital */}
                <h2 className="text-5xl md:text-6xl font-bold font-mono text-foreground tracking-tighter">
                  {format(currentTime, "HH:mm")}
                </h2>
                <p className="text-sm text-muted-foreground capitalize font-medium">
                  {format(currentTime, "EEEE, dd MMM", { locale: ptBR })}
                </p>
              </div>

              {/* Status Pill Centralizada */}
              <div className="flex justify-center">
                <Badge className={cn("px-4 py-1.5 text-sm font-medium", status.bg, status.color)}>
                  {status.label}
                </Badge>
              </div>

              {/* Botões de Ação */}
              <div className="pt-4 flex items-center justify-center gap-3 w-full border-t border-white/[0.06]">
                {todayEntry?.status === 'concluido' ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-full justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="text-base font-bold text-emerald-400">Expediente Completo: {todayEntry.total_hours?.toFixed(1)}h</span>
                  </div>
                ) : !todayEntry ? (
                  <Button
                    onClick={() => handleClockAction('clock_in')}
                    disabled={loading}
                    className="w-full bg-emerald-600/90 hover:bg-emerald-700 text-emerald-50 font-semibold h-11 rounded-xl transition-all"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Ponto
                  </Button>
                ) : (
                  <div className="flex gap-2 w-full justify-center">
                    {canStartLunch && (
                      <Button
                        variant="outline"
                        onClick={() => handleClockAction('lunch_start')}
                        disabled={loading}
                        className="flex-1 h-11 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 rounded-xl"
                      >
                        <Coffee className="h-4 w-4 mr-2" />
                        Almoço
                      </Button>
                    )}
                    {canEndLunch && (
                      <Button
                        variant="outline"
                        onClick={() => handleClockAction('lunch_end')}
                        disabled={loading}
                        className="flex-1 h-11 bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded-xl"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        Retornar
                      </Button>
                    )}
                    {canClockOut && (
                      <Button
                        onClick={() => handleClockAction('clock_out')}
                        disabled={loading}
                        className="flex-1 h-11 bg-red-500/90 hover:bg-red-600 text-white rounded-xl"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Encerrar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modais */}
      <TimeClockHistoryModal open={timeClockHistoryOpen} onOpenChange={setTimeClockHistoryOpen} />

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
      <SolicitacaoPagamentoModal open={solicitacaoPagamentoOpen} onOpenChange={setSolicitacaoPagamentoOpen} />
    </main>
  );
}