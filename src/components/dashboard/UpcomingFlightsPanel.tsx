import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plane, ArrowRight, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function UpcomingFlightsPanel() {
  const navigate = useNavigate();

  const { data: flights = [] } = useQuery({
    queryKey: ["upcoming-flights-panel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_schedules")
        .select(`
          *,
          aircraft:aeronave_id(registration)
        `)
        .gte("flight_date", new Date().toISOString().split("T")[0])
        .order("flight_date", { ascending: true })
        .order("flight_time", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data || [];
    },
  });

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmado':
        return 'bg-success/20 text-success border-success';
      case 'pendente':
        return 'bg-warning/20 text-warning border-warning';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Próximos Voos</h3>
      </div>

      {flights.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Plane className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p className="text-sm">Nenhum voo agendado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flights.map((flight: any) => (
            <div 
              key={flight.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate("/agendamento")}
            >
              <div className="flex flex-col items-center justify-center min-w-[50px] text-center">
                <span className="text-xs text-muted-foreground uppercase">
                  {format(new Date(flight.flight_date), "dd MMM", { locale: ptBR })}
                </span>
                <span className="text-lg font-bold text-primary">
                  {flight.flight_time?.slice(0, 5) || "--:--"}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground text-sm">
                    {flight.origin || "---"} → {flight.destination || "---"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {flight.aeronave?.matricula || "N/A"}
                  </Badge>
                  {flight.passengers && (
                    <span className="text-xs text-muted-foreground">
                      {flight.passengers} Pax
                    </span>
                  )}
                </div>
              </div>

              {flight.situacao === 'pendente' && (
                <Badge className={getStatusStyle(flight.situacao)}>
                  Pendente
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <Button 
        variant="ghost" 
        className="w-full mt-4 text-primary hover:text-primary/80"
        onClick={() => navigate("/agendamento")}
      >
        Ver Agenda Completa
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
