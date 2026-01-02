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
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Ponto do Dia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <p className="text-3xl font-bold font-mono">
            {format(currentTime, "HH:mm:ss")}
          </p>
          <p className="text-sm text-muted-foreground">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        {todayEntry?.status === 'concluido' ? (
          <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <p className="text-green-600 font-medium">Ponto encerrado</p>
            <p className="text-sm text-muted-foreground">
              Total: {todayEntry.total_hours?.toFixed(2)}h
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {!todayEntry ? (
              <Button 
                onClick={handleClockIn} 
                disabled={loading}
                className="col-span-2"
              >
                <Play className="h-4 w-4 mr-2" />
                Iniciar Ponto
              </Button>
            ) : (
              <>
                {canStartLunch && (
                  <Button 
                    variant="outline" 
                    onClick={handleLunchStart} 
                    disabled={loading}
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    Almoço
                  </Button>
                )}
                {canEndLunch && (
                  <Button 
                    variant="outline" 
                    onClick={handleLunchEnd} 
                    disabled={loading}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Retornar
                  </Button>
                )}
                {canClockOut && (
                  <Button 
                    variant="destructive" 
                    onClick={handleClockOut} 
                    disabled={loading}
                    className={canStartLunch || canEndLunch ? "" : "col-span-2"}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Encerrar
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {todayEntry && todayEntry.clock_in && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Entrada: {format(new Date(todayEntry.clock_in), "HH:mm")}</p>
            {todayEntry.lunch_start && (
              <p>Almoço: {format(new Date(todayEntry.lunch_start), "HH:mm")}</p>
            )}
            {todayEntry.lunch_end && (
              <p>Retorno: {format(new Date(todayEntry.lunch_end), "HH:mm")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}