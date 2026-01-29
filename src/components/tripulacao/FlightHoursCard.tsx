import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

function hoursToHhmm(n?: number | null) {
  const v = Number(n || 0);
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  const mm = String(m).padStart(2, "0");
  return `${h}:${mm}`;
}

interface Props {
  crewMemberId: string;
}

export default function FlightHoursCard({ crewMemberId }: Props) {
  const [cursor, setCursor] = useState(() => new Date());
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data, error, isError, isLoading } = useQuery({
    queryKey: ["crew-flight-hours-month", crewMemberId, start, end],
    enabled: !!crewMemberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logbook_entries")
        .select("id, total_time, pousos, pic_canac, sic_canac, entry_date, ifr_time, night_hours")
        .or(`pic_canac.eq.${crewMemberId},sic_canac.eq.${crewMemberId}`)
        .gte("entry_date", start)
        .lte("entry_date", end);

      if (error) {
        const errorMessage = error.message || "Erro ao buscar horas de voo";
        console.error("Error fetching flight hours:", errorMessage);
        throw new Error(errorMessage);
      }

      let totals = {
        pic: 0,
        sic: 0,
        ifr: 0,
        night: 0,
        total: 0,
        landings: 0,
      };

      for (const e of data || []) {
        const flightTime = Number(e.total_time || 0);
        const ifrTime = Number(e.ifr_time || 0);
        const nightTime = Number(e.night_hours || 0);
        const landings = Number(e.pousos || 0);

        if (e.pic_canac === crewMemberId) {
          totals.pic += flightTime;
        }
        if (e.sic_canac === crewMemberId) {
          totals.sic += flightTime;
        }

        totals.ifr += ifrTime;
        totals.night += nightTime;
        totals.total += flightTime;
        totals.landings += landings;
      }

      return totals;
    },
  });

  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(cursor);

  const totals = data || {
    pic: 0,
    sic: 0,
    ifr: 0,
    night: 0,
    total: 0,
    landings: 0,
  };

  if (isError) {
    return (
      <Card className="overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-zinc-200/50 dark:border-zinc-800/50">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
          <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Horas de Voo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error instanceof Error ? error.message : "Erro ao carregar horas de voo"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-zinc-200/50 dark:border-zinc-800/50">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
          <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Horas de Voo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-zinc-200/50 dark:border-zinc-800/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <CardTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Horas de Voo
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="h-9 w-9 rounded-lg border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center font-medium capitalize text-sm text-zinc-700 dark:text-zinc-300">
            {monthLabel}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="h-9 w-9 rounded-lg border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Cards de resumo - estilo iOS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/30 dark:to-cyan-900/20 border border-cyan-200/50 dark:border-cyan-800/30 rounded-xl p-4 shadow-sm">
            <div className="text-xs text-cyan-600 dark:text-cyan-400 uppercase tracking-wider font-semibold mb-2">
              Total de Horas
            </div>
            <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">
              {hoursToHhmm(totals.total)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200/50 dark:border-blue-800/30 rounded-xl p-4 shadow-sm">
            <div className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wider font-semibold mb-2">
              PIC
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {hoursToHhmm(totals.pic)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border border-purple-200/50 dark:border-purple-800/30 rounded-xl p-4 shadow-sm">
            <div className="text-xs text-purple-600 dark:text-purple-400 uppercase tracking-wider font-semibold mb-2">
              SIC
            </div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {hoursToHhmm(totals.sic)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4 shadow-sm">
            <div className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold mb-2">
              IFR
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {hoursToHhmm(totals.ifr)}
            </div>
          </div>
        </div>

        {/* Grid de detalhes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-wider font-semibold mb-2">
              Noturnas
            </p>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {hoursToHhmm(totals.night)}
            </p>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 uppercase tracking-wider font-semibold mb-2">
              Pousos
            </p>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {totals.landings}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
