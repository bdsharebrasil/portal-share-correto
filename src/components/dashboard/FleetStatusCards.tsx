import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plane, MapPin, Wrench, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AircraftStatus {
  id: string;
  registration: string;
  model: string;
  status: string;
  base?: string;
  current_status?: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  ativo: { bg: "bg-success/20", text: "text-success", label: "Em Voo" },
  em_voo: { bg: "bg-success/20", text: "text-success", label: "Em Voo" },
  disponivel: { bg: "bg-success/20", text: "text-success", label: "Disponível" },
  solo: { bg: "bg-primary/20", text: "text-primary", label: "Solo" },
  manutencao: { bg: "bg-warning/20", text: "text-warning", label: "Manutenção" },
  indisponivel: { bg: "bg-destructive/20", text: "text-destructive", label: "Indisponível" },
  inativo: { bg: "bg-muted", text: "text-muted-foreground", label: "Inativo" },
};

export function FleetStatusCards() {
  const navigate = useNavigate();
  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({});

  const { data: aircraft = [] } = useQuery({
    queryKey: ["aircraft-fleet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("*")
        .order("registration");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // Subscribe to live status updates
  useEffect(() => {
    const channel = supabase
      .channel("aircraft-live-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "aircraft_live_status",
        },
        (payload) => {
          if (payload.new) {
            setLiveStatuses((prev) => ({
              ...prev,
              [payload.new.aircraft_id]: payload.new.current_status,
            }));
          }
        }
      )
      .subscribe();

    // Fetch initial live statuses
    const fetchLiveStatuses = async () => {
      const { data, error } = await supabase
        .from("aircraft_live_status")
        .select("*");
      if (!error && data) {
        const statusMap = data.reduce(
          (acc, status) => {
            acc[status.aircraft_id] = status.current_status;
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

  const getStatusInfo = (status: string) => {
    return statusConfig[status?.toLowerCase()] || statusConfig.inativo;
  };

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Frota em Tempo Real</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary/80"
          onClick={() => navigate("/aeronaves")}
        >
          Ver Todas Aeronaves
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {aircraft.slice(0, 3).map((ac) => {
          const currentStatus = liveStatuses[ac.id] || ac.status;
          const statusInfo = getStatusInfo(currentStatus);
          const isInFlight = currentStatus?.toLowerCase() === 'em_voo' || currentStatus?.toLowerCase() === 'ativo';

          return (
            <div
              key={ac.id}
              className="bg-card rounded-lg border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/aeronaves/${ac.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isInFlight ? (
                    <Plane className="h-5 w-5 text-success rotate-45 animate-pulse" />
                  ) : currentStatus === 'manutencao' ? (
                    <Wrench className="h-5 w-5 text-warning" />
                  ) : currentStatus === 'indisponivel' ? (
                    <Plane className="h-5 w-5 text-destructive" />
                  ) : (
                    <Plane className="h-5 w-5 text-primary -rotate-45" />
                  )}
                  <span className="font-bold text-foreground">{ac.registration}</span>
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
              </div>

              <p className="text-sm text-muted-foreground mb-3">{ac.model}</p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">
                    {isInFlight ? "Destino" : "Localização"}
                  </p>
                  <p className="text-foreground font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {ac.base || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {isInFlight ? "ETA" : "Próx. Voo"}
                  </p>
                  <p className="text-foreground font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    --:--
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
