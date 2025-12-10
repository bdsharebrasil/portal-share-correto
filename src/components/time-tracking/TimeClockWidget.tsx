import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Coffee, LogOut, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
interface TimeEntry {
  id: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  status: string;
  total_hours?: number;
}
export function TimeClockWidget() {
  const [todayEntry, setTodayEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    loadTodayEntry();
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
      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar ponto:', error);
        return;
      }
      setTodayEntry(data);
    } catch (error) {
      console.error('Erro ao carregar ponto:', error);
    }
  };
  const handleClockIn = async () => {
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
      const today = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();
      const {
        data,
        error
      } = await supabase.from('time_entries').insert({
        user_id: user.id,
        entry_date: today,
        clock_in: now,
        status: 'em_andamento'
      }).select().single();
      if (error) throw error;
      setTodayEntry(data);
      toast.success("Ponto iniciado com sucesso!");
      await loadTodayEntry();
    } catch (error) {
      console.error('Erro ao iniciar ponto:', error);
      toast.error("Erro ao iniciar ponto");
    } finally {
      setLoading(false);
    }
  };
  const handleLunchStart = async () => {
    if (!todayEntry) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const {
        error
      } = await supabase.from('time_entries').update({
        lunch_start: now
      }).eq('id', todayEntry.id);
      if (error) throw error;
      toast.success("Início do almoço registrado!");
      await loadTodayEntry();
    } catch (error) {
      console.error('Erro ao registrar início do almoço:', error);
      toast.error("Erro ao registrar início do almoço");
    } finally {
      setLoading(false);
    }
  };
  const handleLunchEnd = async () => {
    if (!todayEntry) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const {
        error
      } = await supabase.from('time_entries').update({
        lunch_end: now
      }).eq('id', todayEntry.id);
      if (error) throw error;
      toast.success("Retorno do almoço registrado!");
      await loadTodayEntry();
    } catch (error) {
      console.error('Erro ao registrar retorno do almoço:', error);
      toast.error("Erro ao registrar retorno do almoço");
    } finally {
      setLoading(false);
    }
  };
  const handleClockOut = async () => {
    if (!todayEntry) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const clockIn = new Date(todayEntry.clock_in!);
      const clockOut = new Date(now);
      let totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);

      // Subtrai tempo de almoço se houver
      if (todayEntry.lunch_start && todayEntry.lunch_end) {
        const lunchStart = new Date(todayEntry.lunch_start);
        const lunchEnd = new Date(todayEntry.lunch_end);
        const lunchMinutes = (lunchEnd.getTime() - lunchStart.getTime()) / (1000 * 60);
        totalMinutes -= lunchMinutes;
      }
      const totalHours = Number((totalMinutes / 60).toFixed(2));
      const {
        error
      } = await supabase.from('time_entries').update({
        clock_out: now,
        total_hours: totalHours,
        status: 'concluido'
      }).eq('id', todayEntry.id);
      if (error) throw error;
      toast.success("Ponto encerrado com sucesso!");
      await loadTodayEntry();
    } catch (error) {
      console.error('Erro ao encerrar ponto:', error);
      toast.error("Erro ao encerrar ponto");
    } finally {
      setLoading(false);
    }
  };
  const canStartLunch = todayEntry && todayEntry.clock_in && !todayEntry.lunch_start;
  const canEndLunch = todayEntry && todayEntry.lunch_start && !todayEntry.lunch_end;
  const canClockOut = todayEntry && todayEntry.clock_in && !todayEntry.clock_out && (!todayEntry.lunch_start || todayEntry.lunch_end);
  return <Card className="border border-border/50">
      <CardHeader className="pb-0 py-0 shadow rounded bg-transparent">
        <CardTitle className="flex items-center gap-2 py-[6px] text-xs text-center bg-transparent">
          <Clock className="h-4 w-4" />
          Ponto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 py-0 rounded-xl shadow-xl border-gray-900 px-0 mx-[21px]">
        <div className="text-center py-0">
          <p className="text-3xl font-bold text-foreground tabular-nums">
            {format(currentTime, 'HH:mm:ss', {
            locale: ptBR
          })}
          </p>
          <p className="text-xs text-muted-foreground mt-0 py-[2px]">
            {format(currentTime, "EEEE, dd 'de' MMMM", {
            locale: ptBR
          })}
          </p>
        </div>

        {todayEntry && todayEntry.status === 'concluido' ? <div className="text-center py-1">
            <p className="text-xs text-muted-foreground">Ponto encerrado para hoje</p>
            {todayEntry.total_hours && <p className="text-sm font-bold text-foreground mt-1">
                {todayEntry.total_hours}h trabalhadas
              </p>}
          </div> : <div className="space-y-1">
            {!todayEntry && <div className="flex justify-center py-1">
              <Button onClick={handleClockIn} disabled={loading} variant="secondary" size="sm" className="py-0 bg-[#060c1c]/80">
                <Play className="h-4 w-4 mr-1.5" />
                Iniciar Dia
              </Button>
            </div>}

            <div className="grid grid-cols-2 gap-1">
              {canStartLunch && <Button onClick={handleLunchStart} disabled={loading} variant="outline" size="sm">
                  <Coffee className="h-4 w-4 mr-1.5" />
                  Almoço
                </Button>}

              {canEndLunch && <Button onClick={handleLunchEnd} disabled={loading} variant="outline" size="sm">
                  <Pause className="h-4 w-4 mr-1.5" />
                  Retornar
                </Button>}

              {canClockOut && <Button onClick={handleClockOut} disabled={loading} variant="destructive" size="sm" className={canStartLunch || canEndLunch ? "" : "col-span-2"}>
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Encerrar Dia
                </Button>}
            </div>
          </div>}

        {todayEntry && todayEntry.clock_in && <div className="text-xs text-muted-foreground space-y-0 border-t border-border/50 pt-1 mt-1">
            <div className="flex justify-between">
              <span>Entrada:</span>
              <span className="font-medium text-xs">{format(new Date(todayEntry.clock_in), 'HH:mm')}</span>
            </div>
            {todayEntry.lunch_start && <div className="flex justify-between">
                <span>Almoço:</span>
                <span className="font-medium">{format(new Date(todayEntry.lunch_start), 'HH:mm')}</span>
              </div>}
            {todayEntry.lunch_end && <div className="flex justify-between">
                <span>Retorno:</span>
                <span className="font-medium">{format(new Date(todayEntry.lunch_end), 'HH:mm')}</span>
              </div>}
          </div>}
      </CardContent>
    </Card>;
}