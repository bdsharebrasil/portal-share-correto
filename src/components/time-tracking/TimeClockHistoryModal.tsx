import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Calendar,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Coffee,
  LogOut,
  Play,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TimeClockHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  total_hours: number | null;
  status: "ativo" | "concluido" | "incompleto";
  created_at: string;
}

export function TimeClockHistoryModal({ open, onOpenChange }: TimeClockHistoryModalProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [stats, setStats] = useState({
    totalHours: 0,
    workDays: 0,
    completedDays: 0,
  });

  useEffect(() => {
    if (open) {
      fetchTimeEntries();
    }
  }, [open, selectedMonth]);

  const fetchTimeEntries = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);

      const { data, error } = await (supabase as any)
        .from("time_clock")
        .select("*")
        .eq("user_id", user.id)
        .gte("data", format(monthStart, "yyyy-MM-dd"))
        .lte("data", format(monthEnd, "yyyy-MM-dd"))
        .order("data", { ascending: false });

      if (error) throw error;

      setEntries((data || []) as TimeEntry[]);
      calculateStats((data || []) as TimeEntry[]);
    } catch (error) {
      console.error("Error fetching time entries:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: TimeEntry[]) => {
    let totalHours = 0;
    let completedDays = 0;

    data.forEach((entry) => {
      if (entry.total_hours) {
        totalHours += entry.total_hours;
      }
      if (entry.status === "concluido") {
        completedDays += 1;
      }
    });

    setStats({
      totalHours,
      workDays: data.length,
      completedDays,
    });
  };

  const getEntryForDate = (date: Date): TimeEntry | undefined => {
    return entries.find((entry) => entry.data === format(date, "yyyy-MM-dd"));
  };

  const previousMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const nextMonth = () => {
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const renderCalendarView = () => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    const firstDayOfWeek = monthStart.getDay();
    const emptyDays = Array(firstDayOfWeek).fill(null);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-slate-400 py-2">
              {day}
            </div>
          ))}

          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {daysInMonth.map((date) => {
            const entry = getEntryForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "aspect-square p-2 rounded-lg border text-center flex flex-col items-center justify-center text-xs cursor-pointer transition-all",
                  isToday && "border-primary/50 bg-primary/10",
                  !entry && "border-slate-700/50 bg-slate-800/30",
                  entry && entry.situacao === "concluido" && "border-emerald-500/50 bg-emerald-500/10",
                  entry && entry.situacao === "incompleto" && "border-amber-500/50 bg-amber-500/10",
                  entry && entry.situacao === "ativo" && "border-blue-500/50 bg-blue-500/10"
                )}
              >
                <span className="font-semibold text-white">{date.getDate()}</span>
                {entry && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {entry.situacao === "concluido" && (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    )}
                    {entry.situacao === "incompleto" && (
                      <AlertCircle className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                )}
                {entry && entry.total_hours && (
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {entry.total_hours.toFixed(1)}h
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    if (entries.length === 0) {
      return (
        <div className="text-center py-8">
          <Clock className="h-12 w-12 mx-auto mb-3 text-slate-500 opacity-50" />
          <p className="text-slate-400">Nenhum registro para este período</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {entries.map((entry) => (
          <Card key={entry.id} className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold text-white">
                      {format(new Date(entry.data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                    <Badge
                      className={cn(
                        "ml-auto",
                        entry.situacao === "concluido" &&
                          "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                        entry.situacao === "incompleto" &&
                          "bg-amber-500/20 text-amber-400 border-amber-500/30",
                        entry.situacao === "ativo" && "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      )}
                    >
                      {entry.situacao === "concluido" && "Concluído"}
                      {entry.situacao === "incompleto" && "Incompleto"}
                      {entry.situacao === "ativo" && "Em andamento"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    {entry.clock_in && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Play className="h-3 w-3 text-emerald-400" />
                          <span className="text-slate-400">Entrada:</span>
                          <span className="font-mono font-semibold text-white">
                            {format(new Date(entry.clock_in), "HH:mm")}
                          </span>
                        </div>

                        {entry.lunch_start && (
                          <div className="flex items-center gap-1.5">
                            <Coffee className="h-3 w-3 text-amber-400" />
                            <span className="text-slate-400">Almoço:</span>
                            <span className="font-mono font-semibold text-white">
                              {format(new Date(entry.lunch_start), "HH:mm")}
                            </span>
                          </div>
                        )}

                        {entry.lunch_end && (
                          <div className="flex items-center gap-1.5">
                            <Play className="h-3 w-3 text-blue-400" />
                            <span className="text-slate-400">Retorno:</span>
                            <span className="font-mono font-semibold text-white">
                              {format(new Date(entry.lunch_end), "HH:mm")}
                            </span>
                          </div>
                        )}

                        {entry.clock_out && (
                          <div className="flex items-center gap-1.5">
                            <LogOut className="h-3 w-3 text-red-400" />
                            <span className="text-slate-400">Saída:</span>
                            <span className="font-mono font-semibold text-white">
                              {format(new Date(entry.clock_out), "HH:mm")}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {entry.total_hours && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                        <Clock className="h-4 w-4 text-cyan-400" />
                        <span className="text-slate-400">Total de horas:</span>
                        <span className="font-mono font-semibold text-cyan-400">
                          {entry.total_hours.toFixed(2)}h
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Clock className="h-5 w-5 text-cyan-400" />
            Histórico de Ponto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
              className="border-slate-700/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="font-semibold text-white text-lg">
              {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
              className="border-slate-700/50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="text-xs text-slate-400 mb-1">Dias Trabalhados</div>
                <div className="text-2xl font-bold text-white">{stats.workDays}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="text-xs text-slate-400 mb-1">Dias Completos</div>
                <div className="text-2xl font-bold text-emerald-400">{stats.completedDays}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="text-xs text-slate-400 mb-1">Total de Horas</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {stats.totalHours.toFixed(1)}h
                </div>
              </CardContent>
            </Card>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Calendário
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Lista
            </Button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin">
                <Clock className="h-8 w-8 text-slate-500" />
              </div>
              <span className="ml-3 text-slate-400">Carregando...</span>
            </div>
          ) : viewMode === "calendar" ? (
            renderCalendarView()
          ) : (
            renderListView()
          )}

          {/* Footer Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-slate-700/50">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-slate-700/50"
              disabled
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
