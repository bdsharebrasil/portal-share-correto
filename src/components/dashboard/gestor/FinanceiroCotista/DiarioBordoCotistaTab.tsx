// DiarioBordoTab.tsx
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plane, Fuel, FileText, Clock, TrendingUp, TrendingDown,
  Minus, MapPin, ChevronDown, ChevronUp, Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ── helpers ──────────────────────────────────────────────────────────────────

function decimalToHHMM(h: number): string {
  if (!h || isNaN(h)) return "0:00";
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function num(v: any, d = 1) {
  return Number(v ?? 0).toFixed(d);
}

const monthNames = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

// Haversine simples — retorna km
function haversineKm(
  c1: string | null,
  c2: string | null,
  aerodromesMap: Map<string, { coordenadas: string | null }>
): number | null {
  const coord = (icao: string | null) => {
    if (!icao) return null;
    const entry = aerodromesMap.get(icao);
    if (!entry?.coordenadas) return null;
    const [lat, lon] = entry.coordenadas.split(",").map(Number);
    return isNaN(lat) || isNaN(lon) ? null : { lat, lon };
  };
  const p1 = coord(c1);
  const p2 = coord(c2);
  if (!p1 || !p2) return null;
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lon - p1.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── tipos mínimos ─────────────────────────────────────────────────────────────

type LancRow = {
  id: string;
  data_registro: string;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  tempo_voo: number | null;
  tempo_total: number | null;
  pousos_total: number | null;
  combustivel_adicionado: number | null;
  natureza_voo: string | null;
  trecho: string | null;
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

// ── hook de dados ─────────────────────────────────────────────────────────────

function useDiarioBordoCliente(clienteId: string | undefined, aeronaveId: string) {
  return useQuery({
    queryKey: ["diario-bordo-cliente", clienteId, aeronaveId],
    enabled: !!clienteId && !!aeronaveId,
    staleTime: 60_000,
    queryFn: async () => {
      const [lancRes, abastRes, aeroRes] = await Promise.all([
        supabase
          .from("lancamentos_diario_bordo")
          .select("id,data_registro,aerodromo_partida,aerodromo_chegada,tempo_voo,tempo_total,pousos_total,combustivel_adicionado,natureza_voo,trecho")
          .eq("aeronave_id", aeronaveId)
          .eq("clientes_id", clienteId)
          .order("data_registro", { ascending: false }),
        supabase
          .from("abastecimentos")
          .select("id,logbook_entry_id,litros,valor_total,local,abastecedor,comanda")
          .eq("aeronave_id", aeronaveId)
          .not("logbook_entry_id", "is", null),
        supabase
          .from("aerodromes")
          .select("designativo,nome,coordenadas"),
      ]);

      return {
        lancamentos: (lancRes.data ?? []) as LancRow[],
        abastecimentos: (abastRes.data ?? []) as AbastRow[],
        aerodromes: (aeroRes.data ?? []) as AerodromeRow[],
      };
    },
  });
}

// ── componente principal ──────────────────────────────────────────────────────

export function DiarioBordoTab({
  clienteId,
  aeronaveId,
  aeronaveMatricula,
  relatorios,
}: {
  clienteId: string | undefined;
  aeronaveId: string;
  aeronaveMatricula?: string;
  relatorios: RelRow[];
}) {
  const { data, isLoading } = useDiarioBordoCliente(clienteId, aeronaveId);

  // meses disponíveis
  const availableMeses = useMemo(() => {
    const set = new Map<string, { mes: number; ano: number }>();
    for (const l of data?.lancamentos ?? []) {
      const d = new Date(l.data_registro + "T00:00");
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      if (!set.has(key)) set.set(key, { mes: d.getMonth() + 1, ano: d.getFullYear() });
    }
    return Array.from(set.values()).sort((a, b) =>
      a.ano !== b.ano ? b.ano - a.ano : b.mes - a.mes
    );
  }, [data?.lancamentos]);

  const [mesSel, setMesSel] = useState<{ mes: number; ano: number } | null>(null);

  // inicializa com o mês mais recente
  useEffect(() => {
    if (availableMeses.length > 0 && !mesSel) setMesSel(availableMeses[0]);
  }, [availableMeses]);

  // mapas auxiliares
  const abastByLanc = useMemo(() => {
    const m = new Map<string, AbastRow[]>();
    for (const a of data?.abastecimentos ?? []) {
      if (!a.logbook_entry_id) continue;
      const arr = m.get(a.logbook_entry_id) ?? [];
      arr.push(a);
      m.set(a.logbook_entry_id, arr);
    }
    return m;
  }, [data?.abastecimentos]);

  const aerodromesMap = useMemo(() => {
    const m = new Map<string, AerodromeRow>();
    for (const a of data?.aerodromes ?? []) m.set(a.designativo, a);
    return m;
  }, [data?.aerodromes]);

  // lançamentos do mês selecionado
  const lancMes = useMemo(() => {
    if (!mesSel) return [];
    return (data?.lancamentos ?? []).filter((l) => {
      const d = new Date(l.data_registro + "T00:00");
      return d.getMonth() + 1 === mesSel.mes && d.getFullYear() === mesSel.ano;
    });
  }, [data?.lancamentos, mesSel]);

  // lançamentos do mês anterior (comparativo)
  const lancMesAnterior = useMemo(() => {
    if (!mesSel) return [];
    const ma = mesSel.mes === 1
      ? { mes: 12, ano: mesSel.ano - 1 }
      : { mes: mesSel.mes - 1, ano: mesSel.ano };
    return (data?.lancamentos ?? []).filter((l) => {
      const d = new Date(l.data_registro + "T00:00");
      return d.getMonth() + 1 === ma.mes && d.getFullYear() === ma.ano;
    });
  }, [data?.lancamentos, mesSel]);

  // totais do mês atual
  const totais = useMemo(() => ({
    pousos: lancMes.reduce((s, l) => s + Number(l.pousos_total ?? 0), 0),
    tVoo: lancMes.reduce((s, l) => s + Number(l.tempo_voo ?? 0), 0),
    voos: lancMes.length,
    abast: lancMes.reduce((s, l) => s + Number(l.combustivel_adicionado ?? 0), 0),
  }), [lancMes]);

  const totaisAnt = useMemo(() => ({
    pousos: lancMesAnterior.reduce((s, l) => s + Number(l.pousos_total ?? 0), 0),
    tVoo: lancMesAnterior.reduce((s, l) => s + Number(l.tempo_voo ?? 0), 0),
    voos: lancMesAnterior.length,
  }), [lancMesAnterior]);

  // relatório vinculado ao voo (por data dentro do período)
  const relByDate = useMemo(() => {
    const m = new Map<string, RelRow>();
    for (const r of relatorios) {
      if (!r.data_inicio || !r.data_fim) continue;
      m.set(`${r.data_inicio}__${r.data_fim}`, r);
    }
    return m;
  }, [relatorios]);

  function relParaVoo(l: LancRow): RelRow | null {
    for (const r of relatorios) {
      if (!r.data_inicio || !r.data_fim) continue;
      const d = l.data_registro;
      if (d >= r.data_inicio && d <= r.data_fim) return r;
    }
    return null;
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-muted/40 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-card/40 rounded-2xl border border-border/40" />
          ))}
        </div>
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

  const deltaHoras = totais.tVoo - totaisAnt.tVoo;
  const deltaPousos = totais.pousos - totaisAnt.pousos;

  return (
    <div className="space-y-6">

      {/* ── SELETOR DE MÊS ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 text-primary/60" />
          <span className="font-medium">Período:</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {availableMeses.map((am) => {
            const active = mesSel?.mes === am.mes && mesSel?.ano === am.ano;
            return (
              <button
                key={`${am.ano}-${am.mes}`}
                onClick={() => setMesSel(am)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow"
                    : "bg-card/40 text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
                }`}
              >
                {monthNames[am.mes - 1].slice(0, 3)} {am.ano}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CARDS RESUMO ───────────────────────────────────────────────── */}
      {mesSel && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Plane className="h-4 w-4" />}
            label="Voos"
            value={String(totais.voos)}
            delta={totais.voos - totaisAnt.voos}
            deltaLabel="vs mês anterior"
          />
          <SummaryCard
            icon={<MapPin className="h-4 w-4" />}
            label="Pousos"
            value={String(totais.pousos)}
            delta={deltaPousos}
            deltaLabel="vs mês anterior"
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label="Horas de voo"
            value={decimalToHHMM(totais.tVoo)}
            delta={deltaHoras}
            deltaLabel="vs mês anterior"
            deltaFormat="horas"
          />
          <SummaryCard
            icon={<Fuel className="h-4 w-4" />}
            label="Abastecimento"
            value={`${num(totais.abast, 0)} L`}
            showDelta={false}
          />
        </div>
      )}

      {/* ── LISTA DE VOOS ──────────────────────────────────────────────── */}
      {mesSel && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            Voos em {monthNames[mesSel.mes - 1]} {mesSel.ano}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {aeronaveMatricula}
            </span>
          </h3>

          {lancMes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum voo registrado neste período.
            </p>
          ) : (
            <div className="space-y-2">
              {lancMes.map((l, idx) => (
                <VooCard
                  key={l.id}
                  idx={idx + 1}
                  lanc={l}
                  abastecimentos={abastByLanc.get(l.id) ?? []}
                  relatorio={relParaVoo(l)}
                  aerodromesMap={aerodromesMap}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SummaryCard ───────────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, value, delta, deltaLabel, deltaFormat, showDelta = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  deltaFormat?: "horas";
  showDelta?: boolean;
}) {
  const isPositive = (delta ?? 0) > 0;
  const isNeutral = (delta ?? 0) === 0;

  const deltaStr = deltaFormat === "horas"
    ? `${isPositive ? "+" : ""}${decimalToHHMM(Math.abs(delta ?? 0))}`
    : `${isPositive ? "+" : ""}${delta ?? 0}`;

  return (
    <div className="relative p-5 rounded-2xl bg-gradient-to-b from-card/60 to-card/20 backdrop-blur-md border border-border/40 hover:border-primary/20 transition-all overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
            {label}
          </span>
          <div className="p-2 rounded-lg bg-background/50 border border-border/50 text-muted-foreground">
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        {showDelta && delta !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-medium ${
            isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald-500" : "text-rose-500"
          }`}>
            {isNeutral ? (
              <Minus className="h-3 w-3" />
            ) : isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{deltaStr}</span>
            {deltaLabel && (
              <span className="text-muted-foreground/60 font-normal">{deltaLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── VooCard ───────────────────────────────────────────────────────────────────

function VooCard({
  idx, lanc, abastecimentos, relatorio, aerodromesMap,
}: {
  idx: number;
  lanc: LancRow;
  abastecimentos: AbastRow[];
  relatorio: RelRow | null;
  aerodromesMap: Map<string, AerodromeRow>;
}) {
  const [expanded, setExpanded] = useState(false);

  const data = new Date(lanc.data_registro + "T00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit",
  });

  const trecho =
    lanc.trecho ||
    (lanc.aerodromo_partida && lanc.aerodromo_chegada
      ? `${lanc.aerodromo_partida} → ${lanc.aerodromo_chegada}`
      : "—");

  const distancia = haversineKm(
    lanc.aerodromo_partida,
    lanc.aerodromo_chegada,
    aerodromesMap as any
  );

  const temAbast = abastecimentos.length > 0;
  const totalAbastLitros = abastecimentos.reduce((s, a) => s + Number(a.litros ?? 0), 0);
  const totalAbastValor = abastecimentos.reduce((s, a) => s + Number(a.valor_total ?? 0), 0);

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden transition-all hover:border-border/70">
      {/* linha resumo */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/10 transition-colors"
      >
        {/* número */}
        <span className="w-6 text-center text-[10px] font-mono text-muted-foreground/50 shrink-0">
          {idx}
        </span>

        {/* data */}
        <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">{data}</span>

        {/* rota */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{trecho}</span>
          {distancia && (
            <Badge variant="outline" className="text-[10px] px-1.5 shrink-0 border-border/50 text-muted-foreground">
              ~{distancia} km
            </Badge>
          )}
        </div>

        {/* badges compactos */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{decimalToHHMM(Number(lanc.tempo_voo ?? 0))}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{lanc.pousos_total ?? 0}</span>
          </div>
          {temAbast && (
            <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 px-1.5">
              <Fuel className="h-2.5 w-2.5 mr-1" />
              {num(totalAbastLitros, 0)}L
            </Badge>
          )}
          {relatorio && (
            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 px-1.5">
              <FileText className="h-2.5 w-2.5 mr-1" />
              {relatorio.numero_relatorio ?? "Rel."}
            </Badge>
          )}
        </div>

        <span className="text-muted-foreground/40 shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* expansão detalhes */}
      {expanded && (
        <div className="border-t border-border/30 px-4 py-3 bg-muted/10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
            <Detail label="Partida" value={lanc.aerodromo_partida ?? "—"} mono />
            <Detail label="Chegada" value={lanc.aerodromo_chegada ?? "—"} mono />
            <Detail label="T. Voo" value={decimalToHHMM(Number(lanc.tempo_voo ?? 0))} mono />
            <Detail label="T. Total" value={decimalToHHMM(Number(lanc.tempo_total ?? 0))} mono />
            <Detail label="Pousos" value={String(lanc.pousos_total ?? 0)} />
            <Detail label="Natureza" value={lanc.natureza_voo ?? "—"} />
            {distancia && <Detail label="Distância" value={`~${distancia} km`} />}

            {/* abastecimentos */}
            {abastecimentos.map((a, i) => (
              <div key={a.id} className="col-span-full">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Abastecimento {abastecimentos.length > 1 ? i + 1 : ""}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Detail label="Local" value={a.local ?? "—"} />
                  <Detail label="Litros" value={`${num(a.litros, 0)} L`} mono />
                  {a.valor_total && (
                    <Detail
                      label="Valor"
                      value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(a.valor_total))}
                      mono
                    />
                  )}
                  {a.abastecedor && <Detail label="Abastecedor" value={a.abastecedor} />}
                  {a.comanda && <Detail label="Comanda" value={a.comanda} mono />}
                </div>
              </div>
            ))}

            {/* relatório */}
            {relatorio && (
              <div className="col-span-full">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">
                  Relatório de Voo
                </p>
                <div className="flex flex-wrap gap-3">
                  <Detail label="Número" value={relatorio.numero_relatorio ?? "—"} mono />
                  {relatorio.rota && <Detail label="Rota" value={relatorio.rota} />}
                  {relatorio.data_inicio && (
                    <Detail
                      label="Período"
                      value={`${new Date(relatorio.data_inicio).toLocaleDateString("pt-BR")} → ${new Date(relatorio.data_fim!).toLocaleDateString("pt-BR")}`}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">{label}</p>
      <p className={`text-xs font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}