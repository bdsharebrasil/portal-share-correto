// @ts-nocheck
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

function hoursToHhmm(n?: number | null) {
  const v = Number(n || 0);
  const h = Math.floor(v);
  const m = String(Math.round((v - h) * 60)).padStart(2, "0");
  return `${h}:${m}`;
}

// Mapeamento amigável da natureza_voo
const naturezaLabel: Record<string, string> = {
  "AE - Aérea/Regular": "Regular",
  "CQ - Cheque": "Cheque",
  "EX - Executivo": "Executivo",
  "NR - Não Remunerado": "Não Remunerado",
  "RE - Retorno/Reposição": "Retorno",
  "PV - Privado": "Privado",
  "SA - Serviço Aéreo": "Serviço Aéreo",
  "TN - Transporte Não Regular/Táxi Aéreo": "Táxi Aéreo",
  "TR - Traslado": "Traslado",
  "VOO TESTE": "Voo Teste",
  "EP": "EP",
};

export default function CrewCalendar({ crewMemberId }: Props) {
  const [cursor, setCursor] = useState(() => new Date());

  const [start, end] = useMemo(() => {
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    return [iso(s), iso(e)] as const;
  }, [cursor]);

  // Usa lancamentos_diario_bordo com as colunas corretas do schema
  const { data, isLoading } = useQuery({
    queryKey: ["crew-calendar", crewMemberId, start, end],
    enabled: !!crewMemberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos_diario_bordo")
        .select(`
          id,
          data_registro,
          aerodromo_partida,
          aerodromo_chegada,
          tempo_total,
          natureza_voo,
          confirmado,
          pic_canac,
          sic_canac,
          aeronave:aeronave_id(matricula, modelo)
        `)
        .or(`pic_canac.eq.${crewMemberId},sic_canac.eq.${crewMemberId}`)
        .gte("data_registro", start)
        .lte("data_registro", end)
        .order("data_registro", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Agrupar por data
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of data || []) {
      const k = s.data_registro;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plane className="h-5 w-5" />
          Escala de Voos
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-sm font-medium capitalize text-muted-foreground">
            {monthLabel(cursor)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
                <div className="mb-2 font-semibold text-foreground">
                  {new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </div>
                <ul className="space-y-2">
                  {items.map((it: any) => {
                    const isPic = it.pic_canac === crewMemberId;
                    return (
                      <li key={it.id} className="flex items-center justify-between text-sm gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Função no voo */}
                          <Badge
                            variant="outline"
                            className={isPic
                              ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                              : "border-purple-500/50 text-purple-400 bg-purple-500/10"}
                          >
                            {isPic ? "PIC" : "SIC"}
                          </Badge>

                          {/* Natureza */}
                          <Badge variant="secondary" className="text-xs">
                            {naturezaLabel[it.natureza_voo] ?? it.natureza_voo}
                          </Badge>

                          {/* Trecho */}
                          <span className="text-foreground font-medium">
                            {it.aerodromo_partida} → {it.aerodromo_chegada}
                          </span>

                          {/* Aeronave */}
                          {it.aeronave?.matricula && (
                            <span className="text-muted-foreground text-xs">
                              ({it.aeronave.matricula})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Status confirmação */}
                          <Badge
                            variant="outline"
                            className={it.confirmado
                              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-xs"
                              : "border-amber-500/50 text-amber-400 bg-amber-500/10 text-xs"}
                          >
                            {it.confirmado ? "Confirmado" : "Pendente"}
                          </Badge>

                          {/* Horas */}
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-foreground font-mono text-xs">
                              {hoursToHhmm(it.tempo_total)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}