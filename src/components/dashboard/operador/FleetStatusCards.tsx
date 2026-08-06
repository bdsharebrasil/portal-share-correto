import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plane, MapPin, Wrench, Clock, ArrowRight, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AeronaveStatus {
  id: string;
  registration: string;
  model: string;
  status: string;
  base?: string;
  status_atual?: string;
}

interface VooAtivo {
  aeronave_id: string;
  origem: string | null;
  destino: string | null;
  status: string | null;
}

const statusConfig: Record<string, { bg: string; text: string; label: string; borderColor: string; icon: string; textColor: string }> = {
  ativa: { bg: "bg-success/20", text: "text-success", label: "Disponível", borderColor: "border-l-success", icon: "plane", textColor: "text-success" },
  ativo: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Em Voo", borderColor: "border-l-amber-400", icon: "plane", textColor: "text-amber-400" },
  em_voo: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Em Voo", borderColor: "border-l-amber-400", icon: "plane", textColor: "text-amber-400" },
  em_rota: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Em Rota", borderColor: "border-l-amber-400", icon: "plane", textColor: "text-amber-400" },
  reservado: { bg: "bg-cyan-500/20", text: "text-cyan-400", label: "Reservado", borderColor: "border-l-cyan-400", icon: "plane", textColor: "text-cyan-400" },
  disponivel: { bg: "bg-success/20", text: "text-success", label: "Disponível", borderColor: "border-l-success", icon: "plane", textColor: "text-success" },
  atrasado: { bg: "bg-destructive/20", text: "text-destructive", label: "Atrasado", borderColor: "border-l-destructive", icon: "alert", textColor: "text-destructive" },
  solo: { bg: "bg-primary/20", text: "text-primary", label: "Solo", borderColor: "border-l-primary", icon: "zap", textColor: "text-primary" },
  manutencao: { bg: "bg-warning/20", text: "text-warning", label: "Em Manutenção", borderColor: "border-l-warning", icon: "wrench", textColor: "text-warning" },
  indisponivel: { bg: "bg-destructive/20", text: "text-destructive", label: "Indisponível", borderColor: "border-l-destructive", icon: "alert", textColor: "text-destructive" },
  inativo: { bg: "bg-muted", text: "text-muted-foreground", label: "Inativo", borderColor: "border-l-muted-foreground", icon: "plane", textColor: "text-muted-foreground" },
};

export function FleetStatusCards() {
  const navigate = useNavigate();
  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({});

  const { data: aircraft = [] } = useQuery({
    queryKey: ["aircraft-fleet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aeronave')
        .select("*")
        .eq("status", "ativa")
        .order("matricula");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const aircraftIds = (aircraft as Array<{ id: string }>).map((ac) => ac.id);
  const { data: activeFlights = [] } = useQuery({
    queryKey: ["aircraft-fleet-active-bookings", aircraftIds.join(",")],
    queryFn: async () => {
      if (!aircraftIds.length) return [];

      const { data, error } = await supabase
        .from("solicitacoes_reserva_voo")
        .select("aeronave_id, origem, destino, status")
        .in("aeronave_id", aircraftIds)
        .in("status", ["em_voo", "em_rota"]);

      if (error) throw error;
      return (data || []) as VooAtivo[];
    },
    enabled: aircraftIds.length > 0,
  });

  const activeFlightsMap = new Map((activeFlights as VooAtivo[]).map((flight) => [flight.aeronave_id, flight]));

  // Subscribe to live status updates
  useEffect(() => {
    const channel = supabase
      .channel("status-tempo-real-aeronave-cards")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "status_tempo_real_aeronave",
        },
        (payload) => {
          if (payload.new) {
            const newData = payload.new as any;
            setLiveStatuses((prev) => ({
              ...prev,
              [newData.aeronave_id]: newData.status_atual,
            }));
          }
        }
      )
      .subscribe();

    // Fetch initial live statuses
    const fetchLiveStatuses = async () => {
      const { data, error } = await supabase
        .from('status_tempo_real_aeronave')
        .select("*");
      if (!error && data) {
        const statusMap = data.reduce(
          (acc, status) => {
            acc[status.aeronave_id] = status.status_atual;
            return acc;
          },
          {} as Record<string, string>
        );
        setLiveStatuses(statusMap);
      }
    };

    fetchLiveStatuses();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const getStatusInfo = (status: string | null | undefined) => {
    if (!status) return statusConfig.inativo;
    const normalizedStatus = status.toLowerCase().trim();
    return statusConfig[normalizedStatus] || statusConfig.inativo;
  };

  return (
    <div className="bg-card/50 backdrop-blur rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Frota em Tempo Real</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary/80"
          onClick={() => navigate("/painel-agendamentos")}
        >
          Ver Todas Aeronaves
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {aircraft.slice(0, 3).map((ac) => {
          const currentStatus = liveStatuses[ac.id] || ac.status;
          const statusInfo = getStatusInfo(currentStatus);
          const normalizedStatus = (currentStatus ?? '').toLowerCase().trim();
          const isInFlight = ['em_voo', 'em_rota', 'ativo'].includes(normalizedStatus);
          const activeFlight = activeFlightsMap.get(ac.id);
          const shouldShowRoute = isInFlight && Boolean(activeFlight);

          return (
            <div
              key={ac.id}
              className={`bg-card/80 rounded-lg border-l-4 ${statusInfo.borderColor} border border-border p-4 hover:bg-card transition-all cursor-pointer`}
              onClick={() => navigate("/painel-agendamentos")}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className={`uppercase text-xs font-bold mb-3 ${statusInfo.textColor}`}>
                    {statusInfo.label}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-bold text-lg">{ac.matricula}</div>
                      <div className="text-muted-foreground text-xs">{ac.modelo}</div>
                    </div>
                  </div>
                </div>
                <div className={`text-3xl opacity-80 ${statusInfo.text}`}>
                  {statusInfo.icon === 'wrench' && <Wrench className="h-8 w-8" />}
                  {statusInfo.icon === 'alert' && <AlertCircle className="h-8 w-8" />}
                  {statusInfo.icon === 'zap' && <Zap className="h-8 w-8" />}
                  {statusInfo.icon === 'plane' && <Plane className="h-8 w-8 rotate-45" />}
                </div>
              </div>

              {shouldShowRoute ? (
                <div className="text-xs">
                  <p className="text-muted-foreground text-[10px] uppercase">Trecho</p>
                  <p className="text-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {activeFlight?.origem ?? "—"} → {activeFlight?.destino ?? "—"}
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
