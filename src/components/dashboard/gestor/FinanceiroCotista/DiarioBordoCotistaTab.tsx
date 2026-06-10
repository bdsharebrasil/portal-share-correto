import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plane, Fuel, FileText, Clock, TrendingUp, TrendingDown,
  Minus, MapPin, ChevronDown, ChevronUp, Calendar, Users, User, LayoutGrid
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── helpers ──────────────────────────────────────────────────────────────────

function decimalToHHMM(h: number): string {
  if (!h || isNaN(h)) return "0:00";
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const monthNames = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

// ── tipos ─────────────────────────────────────────────────────────────────────

type LancRow = {
  id: string;
  entry_date: string;
  departure_airport: string | null;
  arrival_airport: string | null;
  flight_time: number | null;
  total_time: number | null;
  total_landings: number | null;
  fuel_added: number | null;
  flight_nature: string | null;
  flight_segment: string | null;
  socios_id: string | null;
  partner_name: string | null;
};

type AbastRow = {
  id: string;
  logbook_entry_id: string;
  litros: number | null;
  valor_total: number | null;
  local: string | null;
  abastecedor: string | null;
  comanda: string | null;
};

type RelRow = {
  id: string;
  numero_relatorio: string | null;
  rota: string | null;
  data_inicio: string | null;
  data_fim: string | null;
};

type AerodromeRow = {
  designativo: string;
  nome: string;
  coordenadas: string | null;
};

type SocioRow = {
  id: string;
  nome: string;
  cpf: string;
  percentual_participacao: number | null;
  codigo_cliente: string | null;
};

// ── hook de dados ─────────────────────────────────────────────────────────────

function useDiarioBordo(clienteId: string | undefined, aeronaveId: string) {
  return useQuery({
    queryKey: ["diario-bordo-cliente", clienteId, aeronaveId],
    enabled: !!clienteId && !!aeronaveId,
    staleTime: 60_000,
    queryFn: async () => {
      const [lancRes, abastRes, aeroRes, sociosRes] = await Promise.all([
        supabase
          .from("lancamentos_diario_bordo")
          .select(`
            id, entry_date, departure_airport, arrival_airport,
            flight_time, total_time, total_landings, fuel_added,
            flight_nature, flight_segment, socios_id, partner_name
          `)
          .eq("aeronave_id", aeronaveId)
          .eq("client_id", clienteId)
          .order("entry_date", { ascending: false }),

        supabase
          .from("abastecimentos")
          .select("id,logbook_entry_id,litros,valor_total,local,abastecedor,comanda")
          .eq("aeronave_id", aeronaveId)
          .not("logbook_entry_id", "is", null),

        supabase
          .from("aerodromes")
          .select("designativo,nome,coordenadas"),

        supabase
          .from("socios")
          .select("id,nome,cpf,percentual_participacao,codigo_cliente")
          .eq("cliente_id", clienteId)
          .order("nome"),
      ]);

      return {
        lancamentos: (lancRes.data ?? []) as LancRow[],
        abastecimentos: (abastRes.data ?? []) as AbastRow[],
        aerodromes: (aeroRes.data ?? []) as AerodromeRow[],
        socios: sociosRes.data ? (sociosRes.data as SocioRow[]) : [],
      };
    },
  });
}

// ── componente principal ──────────────────────────────────────────────────────

export function DiarioBordoCotistaTab({
  clienteId,
  aeronaveId,
  aeronaveMatricula,
  relatorios,
}: {
  clienteId: string;
  aeronaveId: string;
  aeronaveMatricula?: string;
  relatorios: RelRow[];
}) {
  const { data, isLoading } = useDiarioBordo(clienteId, aeronaveId);

  const [mesSel, setMesSel] = useState<{ mes: number; ano: number } | null>(null);

  // Meses disponíveis
  const availableMeses = useMemo(() => {
    const set = new Map<string, { mes: number; ano: number }>();
    for (const l of data?.lancamentos ?? []) {
      const d = new Date(l.entry_date + "T00:00");
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!set.has(key)) set.set(key, { mes: d.getMonth() + 1, ano: d.getFullYear() });
    }
    return Array.from(set.values()).sort((a, b) =>
      a.ano !== b.ano ? b.ano - a.ano : b.mes - a.mes
    );
  }, [data?.lancamentos]);

  useEffect(() => {
    if (availableMeses.length > 0 && !mesSel) setMesSel(availableMeses[0]);
  }, [availableMeses]);

  // Lançamentos filtrados pelo mês
  const lancFiltrados = useMemo(() => {
    if (!mesSel) return [];
    return (data?.lancamentos ?? []).filter((l) => {
      const d = new Date(l.entry_date + "T00:00");
      return d.getMonth() + 1 === mesSel.mes && d.getFullYear() === mesSel.ano;
    });
  }, [data?.lancamentos, mesSel]);

  // Totais do período
  const totais = useMemo(() => ({
    pousos: lancFiltrados.reduce((s, l) => s + Number(l.total_landings ?? 0), 0),
    tVoo: lancFiltrados.reduce((s, l) => s + Number(l.flight_time ?? 0), 0),
    voos: lancFiltrados.length,
    abast: lancFiltrados.reduce((s, l) => s + Number(l.fuel_added ?? 0), 0),
  }), [lancFiltrados]);

  // Índice do mês atual
  const mesIndex = useMemo(() => {
    if (!mesSel) return -1;
    return availableMeses.findIndex(m => m.mes === mesSel.mes && m.ano === mesSel.ano);
  }, [mesSel, availableMeses]);

  const handlePrevMonth = () => {
    if (mesIndex > 0) setMesSel(availableMeses[mesIndex - 1]);
  };

  const handleNextMonth = () => {
    if (mesIndex < availableMeses.length - 1) setMesSel(availableMeses[mesIndex + 1]);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-muted/40 rounded-xl" />
        <div className="h-64 bg-card/40 rounded-2xl border border-border/40" />
      </div>
    );
  }

  if ((data?.lancamentos ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Plane className="h-8 w-8 text-primary/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Nenhum voo registrado para este cliente nesta aeronave.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── SELETOR DE MÊS COM SETAS ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-card/40 backdrop-blur-md border border-border/40">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevMonth}
          disabled={mesIndex <= 0}
          className="rounded-lg"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>

        <div className="text-center flex-1">
          <p className="text-sm font-semibold text-foreground">
            {mesSel ? `${monthNames[mesSel.mes - 1]} de ${mesSel.ano}` : "Selecione um período"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Registros de Voo</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextMonth}
          disabled={mesIndex >= availableMeses.length - 1}
          className="rounded-lg"
        >
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>

      {/* ── CARDS RESUMO DO PERÍODO ────────────────────────────────────── */}
      {mesSel && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Plane className="h-4 w-4" />}
            label="Voos"
            value={String(totais.voos)}
          />
          <SummaryCard
            icon={<MapPin className="h-4 w-4" />}
            label="Pousos"
            value={String(totais.pousos)}
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label="Horas de voo"
            value={decimalToHHMM(totais.tVoo)}
          />
          <SummaryCard
            icon={<Fuel className="h-4 w-4" />}
            label="Abastecimento"
            value={`${Math.round(totais.abast)} L`}
          />
        </div>
      )}

      {/* ── TABELA DE REGISTROS DE VOO ─────────────────────────────────── */}
      {mesSel && (
        <div className="rounded-2xl bg-card/40 backdrop-blur-md border border-border/40 overflow-hidden">
          {lancFiltrados.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum voo registrado neste período.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/40">
                    <th className="px-4 py-3 text-left font-semibold text-foreground/80">Data</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground/80">Trecho</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground/80">Natureza</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground/80">Sócio</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground/80">Horas</th>
                    <th className="px-4 py-3 text-right font-semibold text-foreground/80">Pousos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {lancFiltrados.map((l) => {
                    const socio = data?.socios.find(s => s.id === l.socios_id);
                    const natureza = l.flight_nature || "—";
                    const isTeste = natureza.toUpperCase().includes("TESTE") || natureza.toUpperCase().includes("TRANSLADO");

                    return (
                      <tr
                        key={l.id}
                        className={`hover:bg-primary/5 transition-colors ${isTeste ? "bg-blue-500/5" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {l.entry_date ? new Date(l.entry_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-mono text-xs">
                              {l.departure_airport || "—"} → {l.arrival_airport || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              isTeste
                                ? "border-blue-500/40 text-blue-400 bg-blue-500/10"
                                : "border-border/50 text-muted-foreground"
                            }`}
                          >
                            {natureza}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/80">
                          {socio?.nome || l.partner_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-cyan-500">
                          {decimalToHHMM(l.flight_time || 0)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {l.total_landings || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-card/30 border border-border/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
