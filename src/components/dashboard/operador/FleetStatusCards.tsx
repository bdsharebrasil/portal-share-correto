import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plane, ArrowRight, Radar, Users, ChevronDown, Wrench, Activity, CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const db = supabase as any;

type Booking = {
  id: string;
  aeronave_id: string | null;
  origem: string | null;
  destino: string | null;
  status: string;
  data_agendada: string;
  horario_previsto_agendamento: string | null;
  qtd_passageiros: number | null;
  cliente_id: string | null;
  clientes?: { razao_social: string | null } | null;
  aeronave?: { id: string; matricula: string; modelo: string | null; status: string | null } | null;
};

const EM_VOO = ["em_voo", "em_rota"];
const AGENDADO = ["confirmado", "aprovado", "pendente"];

const STATUS_META: Record<string, { label: string; dot: string; chip: string }> = {
  em_voo: { label: "Em voo", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  em_rota: { label: "Em rota", dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  confirmado: { label: "Confirmado", dot: "bg-cyan-400", chip: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25" },
  aprovado: { label: "Confirmado", dot: "bg-cyan-400", chip: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25" },
  pendente: { label: "Pendente", dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  manutencao: { label: "Manutenção", dot: "bg-orange-400", chip: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
  disponivel: { label: "Disponível", dot: "bg-sky-400", chip: "bg-sky-500/15 text-sky-400 border-sky-500/25" },
};

type Filtro = "todas" | "em_voo" | "agendadas" | "manutencao";

export function FleetStatusCards() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [expandido, setExpandido] = useState(true);

  const hoje = format(new Date(), "yyyy-MM-dd");

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["frota-tempo-real-bookings"],
    queryFn: async () => {
      const { data, error } = await db
        .from("solicitacoes_reserva_voo")
        .select(
          "id, aeronave_id, origem, destino, status, data_agendada, horario_previsto_agendamento, qtd_passageiros, cliente_id, clientes:cliente_id(razao_social), aeronave:aeronave_id(id, matricula, modelo, status)",
        )
        .not("status", "in", '("rejeitado","cancelado","concluido")')
        .order("data_agendada")
        .order("horario_previsto_agendamento");
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
    refetchInterval: 15000,
  });

  const { data: todasAeronaves = [] } = useQuery({
    queryKey: ["frota-tempo-real-aeronaves"],
    queryFn: async () => {
      const { data, error } = await db
        .from("aeronave")
        .select("id, matricula, modelo, status")
        .eq("status", "ativa")
        .order("matricula");
      if (error) throw error;
      return (data ?? []) as { id: string; matricula: string; modelo: string | null; status: string | null }[];
    },
    refetchInterval: 30000,
  });

  const { data: statusFrota = [] } = useQuery({
    queryKey: ["frota-tempo-real-status"],
    queryFn: async () => {
      const { data } = await db.from("status_tempo_real_aeronave").select("aeronave_id, status_atual");
      return (data ?? []) as { aeronave_id: string; status_atual: string | null }[];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("frota-tempo-real")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitacoes_reserva_voo" }, () => {
        qc.invalidateQueries({ queryKey: ["frota-tempo-real-bookings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "status_tempo_real_aeronave" }, () => {
        qc.invalidateQueries({ queryKey: ["frota-tempo-real-status"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const statusMap = useMemo(
    () => Object.fromEntries(statusFrota.map((s) => [s.aeronave_id, (s.status_atual ?? "").toLowerCase()])),
    [statusFrota],
  );

  /** Uma linha por aeronave, incluindo aeronaves sem voo agendado. */
  const aeronaves = useMemo(() => {
    const bookingMap = new Map<string, Booking[]>();
    bookings.forEach((booking) => {
      if (!booking.aeronave_id) return;
      const voos = bookingMap.get(booking.aeronave_id) ?? [];
      voos.push(booking);
      bookingMap.set(booking.aeronave_id, voos);
    });

    const aircraftList = todasAeronaves.length > 0
      ? todasAeronaves
      : Array.from(bookingMap.entries()).map(([id, voos]) => ({
          id,
          matricula: voos[0]?.aeronave?.matricula ?? "—",
          modelo: voos[0]?.aeronave?.modelo ?? null,
          status: voos[0]?.aeronave?.status ?? null,
        }));

    return aircraftList.map((aircraft) => {
      const voos = bookingMap.get(aircraft.id) ?? [];
      const emVoo = voos.find((v) => EM_VOO.includes(v.status));
      const proximo = emVoo ?? voos[0];
      const liveStatus = statusMap[aircraft.id];
      const estado = emVoo
        ? "em_voo"
        : liveStatus === "manutencao"
          ? "manutencao"
          : proximo?.status ?? "disponivel";
      return {
        aeronave: aircraft,
        voos,
        emVoo,
        proximo,
        estado,
      };
    });
  }, [bookings, statusMap, todasAeronaves]);

  const filtradas = useMemo(() => {
    if (filtro === "todas") return aeronaves;
    if (filtro === "em_voo") return aeronaves.filter((a) => a.estado === "em_voo");
    if (filtro === "manutencao") return aeronaves.filter((a) => a.estado === "manutencao");
    return aeronaves.filter((a) => AGENDADO.includes(a.estado));
  }, [aeronaves, filtro]);

  const voosHoje = bookings.filter((b) => b.data_agendada === hoje);
  const emRota = aeronaves.filter((a) => a.estado === "em_voo").length;

  const chips: { id: Filtro; label: string }[] = [
    { id: "em_voo", label: "Em voo" },
    { id: "agendadas", label: "Agendadas" },
    { id: "manutencao", label: "Manutenção" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur">
      {/* Painel de operações — tabela expansível */}
      <div>
        <button
          onClick={() => setExpandido((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/30"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="truncate text-sm font-semibold text-foreground">Painel de Operações</span>
            <span className="text-xs text-muted-foreground">
              · {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              Ao vivo
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !expandido && "-rotate-90")} />
          </span>
        </button>

        {expandido && (
          <div className="overflow-x-auto px-2 pb-4">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Hora</th>
                  <th className="px-3 py-2 text-left font-medium">Aeronave</th>
                  <th className="px-3 py-2 text-left font-medium">Trecho</th>
                  <th className="px-3 py-2 text-left font-medium">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium">Pax</th>
                  <th className="px-3 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {voosHoje.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      Nenhum voo programado para hoje.
                    </td>
                  </tr>
                ) : (
                  voosHoje.map((v) => {
                    const meta = STATUS_META[v.status] ?? STATUS_META.disponivel;
                    return (
                      <tr
                        key={v.id}
                        onClick={() => navigate(`/painel-agendamentos?aeronaveId=${encodeURIComponent(v.aeronave_id ?? "")}`)}
                        className="cursor-pointer border-t border-border/40 transition-colors hover:bg-accent/30"
                      >
                        <td className="px-3 py-3 font-mono font-semibold text-foreground">
                          {v.horario_previsto_agendamento?.slice(0, 5) ?? "--:--"}
                        </td>
                        <td className="px-3 py-3 font-mono text-primary">{v.aeronave?.matricula ?? "—"}</td>
                        <td className="px-3 py-3 font-medium text-foreground">
                          {v.origem ?? "—"} → {v.destino ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{v.clientes?.razao_social ?? "—"}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" /> {v.qtd_passageiros ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", meta.chip)}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Frota em Tempo Real */}
      <div className="border-t border-border/50">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-2 text-primary">
              <Radar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-foreground">Frota em Tempo Real</h3>
              <p className="text-xs text-muted-foreground">
                {aeronaves.length} aeronave(s) em operação · {emRota} em rota agora
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate("/painel-agendamentos")}>
            Ver todas <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </header>

        <div className="flex flex-wrap gap-2 px-4 py-3">
          {chips.map((c) => (
            <button
              key={c.id}
              onClick={() => setFiltro(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filtro === c.id
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-accent/40",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2">
          {filtradas.length === 0 ? (
            <p className="col-span-full rounded-xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma aeronave agendada ou em voo no momento.
            </p>
          ) : (
            filtradas.map(({ aeronave, proximo, estado, voos }) => {
              const meta = STATUS_META[estado] ?? STATUS_META.disponivel;
              return (
                <button
                  key={aeronave.id}
                  onClick={() => navigate(`/painel-agendamentos?aeronaveId=${encodeURIComponent(aeronave.id)}`)}
                  className="group rounded-xl border border-border/60 bg-background/40 p-4 text-left transition-all hover:border-primary/40 hover:bg-background/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", meta.chip)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                      <p className="mt-2 font-mono text-lg font-bold text-foreground">{aeronave.matricula}</p>
                      <p className="truncate text-xs text-muted-foreground">{aeronave.modelo ?? "—"}</p>
                    </div>
                    {estado === "manutencao" ? (
                      <Wrench className="h-7 w-7 text-orange-400/70" />
                    ) : (
                      <Plane className={cn("h-7 w-7 -rotate-45 transition-transform group-hover:translate-x-0.5", estado === "em_voo" ? "text-emerald-400/80" : "text-primary/60")} />
                    )}
                  </div>

                  {proximo && (
                    <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
                      <div className="flex items-center justify-between gap-2 font-mono text-sm text-foreground">
                        <span>{proximo.origem ?? "—"}</span>
                        <span className="h-px flex-1 bg-gradient-to-r from-primary/40 to-primary/10" />
                        <span>{proximo.destino ?? "—"}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {format(new Date(`${proximo.data_agendada}T00:00:00`), "dd/MM", { locale: ptBR })}
                          {proximo.horario_previsto_agendamento
                            ? ` · ${proximo.horario_previsto_agendamento.slice(0, 5)} UTC`
                            : ""}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {proximo.qtd_passageiros ?? 0}
                        </span>
                        {voos.length > 1 && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">+{voos.length - 1} voo(s)</span>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}