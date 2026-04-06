import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Clock, Plane } from "lucide-react";

interface Props { crewMemberId: string }

function monthLabel(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function CrewCalendar({ crewMemberId }: Props) {
  const [cursor, setCursor] = useState(() => new Date());

  const [start, end] = useMemo(() => {
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return [iso(s), iso(e)] as const;
  }, [cursor]);

  const { data, isLoading } = useQuery({
    queryKey: ["crew-calendar", crewMemberId, start, end],
    enabled: !!crewMemberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_schedules")
        .select("id, flight_date, flight_time, origin, destination, status")
        .eq("crew_member_id", crewMemberId)
        .gte("flight_date", start)
        .lte("flight_date", end)
        .order("flight_date")
        .order("flight_time");
      if (error) throw error;
      return data || [];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of data || []) {
      const k = s.flight_date;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><Plane className="h-5 w-5" /> Horas de Voo</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : grouped.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem voos neste mês.</div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([date, items]) => (
              <div key={date} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 font-semibold text-foreground">{new Date(date).toLocaleDateString("pt-BR")}</div>
                <ul className="space-y-2">
                  {items.map((it: any) => (
                    <li key={it.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="capitalize">{it.situacao}</Badge>
                        <span className="text-foreground">{it.origin} → {it.destination}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4" /><span className="text-foreground">{it.flight_time}</span></div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
