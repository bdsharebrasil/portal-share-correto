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
      // Busca entradas do logbook onde o tripulante é PIC ou SIC
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

      // Agregar dados
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
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-red-500/20">
        <CardHeader>
          <CardTitle>Horas de Voo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-950/30 border border-red-700/50 rounded-lg p-4">
            <p className="text-red-400">
              {error instanceof Error ? error.message : "Erro ao carregar horas de voo"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-cyan-500/20">
        <CardHeader>
          <CardTitle>Horas de Voo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-400">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-cyan-500/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Horas de Voo</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center font-semibold capitalize text-sm">
            {monthLabel}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
              Total de Horas
            </div>
            <div className="text-2xl font-bold text-cyan-400">{hoursToHhmm(totals.total)}</div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
              PIC
            </div>
            <div className="text-2xl font-bold text-blue-400">{hoursToHhmm(totals.pic)}</div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
              SIC
            </div>
            <div className="text-2xl font-bold text-purple-400">{hoursToHhmm(totals.sic)}</div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
              IFR
            </div>
            <div className="text-2xl font-bold text-amber-400">{hoursToHhmm(totals.ifr)}</div>
          </div>
        </div>

        {/* Grid de detalhes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
              Noturnas
            </p>
            <p className="text-xl font-bold text-slate-200">{hoursToHhmm(totals.night)}</p>
          </div>

          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2">
              Pousos
            </p>
            <p className="text-xl font-bold text-slate-200">{totals.landings}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
