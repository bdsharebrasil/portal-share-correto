import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Plane, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { format, addDays, isSameDay, startOfToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CrewMember {
  id: string;
  nome_completo: string;
  canac: string;
  situacao: string;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string;
}

interface FlightSchedule {
  id: string;
  aeronave_id: string;
  crew_member_id: string | null;
  flight_date: string;
  flight_time: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  aircraft?: { registration: string };
}

interface CrewScheduleGridProps {
  daysToShow?: number;
}

export function CrewScheduleGrid({ daysToShow = 14 }: CrewScheduleGridProps) {
  const queryClient = useQueryClient();
  const today = startOfToday();

  // Generate array of dates to show
  const dates = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(today, i));
  }, [daysToShow, today]);

  const startDate = format(dates[0], "yyyy-MM-dd");
  const endDate = format(dates[dates.length - 1], "yyyy-MM-dd");

  // Fetch active crew members
  const { data: crewMembers = [] } = useQuery({
    queryKey: ["crew-members-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tripulacao")
        .select("id, nome_completo, canac, status")
        .eq("status", "ativo")
        .order("nome_completo");
      if (error) throw error;
      return (data || []) as CrewMember[];
    }
  });

  // Fetch active aircraft
  const { data: aircraft = [] } = useQuery({
    queryKey: ["aircraft-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aeronave')
        .select('id, matricula, modelo')
        .eq("status", "ativa")
        .order("matricula");
      if (error) throw error;
      return (data || []) as Aircraft[];
    }
  });

  // Fetch flight schedules within date range
  const { data: schedules = [], refetch: refetchSchedules } = useQuery({
    queryKey: ["flight-schedules-grid", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_schedules")
        .select(`
          id,
          aeronave_id,
          crew_member_id,
          flight_date,
          flight_time,
          origin,
          destination,
          status,
          aircraft:aeronave_id(registration)
        `)
        .gte("flight_date", startDate)
        .lte("flight_date", endDate)
        .in("situacao", ["pendente", "confirmado"]);
      if (error) throw error;
      return (data || []) as FlightSchedule[];
    }
  });

  // Fetch booking requests (for assigned pilots/copilots)
  const { data: bookingRequests = [] } = useQuery({
    queryKey: ["booking-requests-grid", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_booking_requests")
        .select(`
          id,
          aeronave_id,
          scheduled_date,
          departure_time,
          return_date,
          origin,
          destination,
          status,
          aircraft:aeronave_id(registration)
        `)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .in("situacao", ["pendente", "confirmado"]);
      if (error) throw error;
      return data || [];
    }
  });

  // Real-time subscription for flight_schedules
  useEffect(() => {
    const channel = supabase
      .channel("crew-schedule-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_schedules" },
        () => {
          refetchSchedules();
          queryClient.invalidateQueries({ queryKey: ["booking-requests-grid"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_booking_requests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["booking-requests-grid"] });
          refetchSchedules();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, refetchSchedules]);

  // Get crew assignment for a specific date
  const getCrewAssignment = (crewId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    // Check flight_schedules
    const schedule = schedules.find(
      (s) => s.crew_member_id === crewId && s.flight_date === dateStr
    );

    if (schedule) {
      return {
        type: "schedule" as const,
        aircraftReg: schedule.aeronave?.matricula || "N/A",
        route: `${schedule.origin || "---"} → ${schedule.destination || "---"}`,
        time: schedule.flight_time?.slice(0, 5) || "",
        status: schedule.situacao
      };
    }

    // Check booking_requests (pilot or copilot)
    const booking = bookingRequests.find((b: any) => {
      if (b.assigned_pilot_id !== crewId && b.assigned_copilot_id !== crewId) return false;
      
      const scheduledDate = parseISO(b.scheduled_date);
      const returnDate = b.return_date ? parseISO(b.return_date) : scheduledDate;
      
      return date >= scheduledDate && date <= returnDate;
    });

    if (booking) {
      return {
        type: "booking" as const,
        aircraftReg: (booking as any).aeronave?.matricula || "N/A",
        route: `${(booking as any).origin || "---"} → ${(booking as any).destination || "---"}`,
        time: (booking as any).departure_time?.slice(0, 5) || "",
        status: (booking as any).situacao,
        role: (booking as any).assigned_pilot_id === crewId ? "PIC" : "SIC"
      };
    }

    return null;
  };

  // Get aircraft assignment for a specific date
  const getAircraftAssignment = (aircraftId: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const schedule = schedules.find(
      (s) => s.aeronave_id === aircraftId && s.flight_date === dateStr
    );

    if (schedule) {
      const crew = crewMembers.find((c) => c.id === schedule.crew_member_id);
      return {
        type: "schedule" as const,
        crewName: crew?.full_name || "Sem tripulação",
        route: `${schedule.origin || "---"} → ${schedule.destination || "---"}`,
        time: schedule.flight_time?.slice(0, 5) || "",
        status: schedule.situacao
      };
    }

    const booking = bookingRequests.find((b: any) => 
      b.aeronave_id === aircraftId && isSameDay(parseISO(b.scheduled_date), date)
    );

    if (booking) {
      const pilot = crewMembers.find((c) => c.id === (booking as any).assigned_pilot_id);
      return {
        type: "booking" as const,
        crewName: pilot?.full_name || "Sem tripulação",
        route: `${(booking as any).origin || "---"} → ${(booking as any).destination || "---"}`,
        time: (booking as any).departure_time?.slice(0, 5) || "",
        status: (booking as any).situacao
      };
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Crew Schedule Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Escala de Tripulação
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Disponibilidade em tempo real dos tripulantes ativos
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              {/* Header - Dates */}
              <div className="flex border-b border-border">
                <div className="min-w-[180px] p-3 font-medium text-muted-foreground bg-muted/30 sticky left-0 z-10">
                  Tripulante
                </div>
                {dates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "min-w-[100px] p-2 text-center border-l border-border",
                      isSameDay(date, today) && "bg-primary/10"
                    )}
                  >
                    <div className="text-xs text-muted-foreground uppercase">
                      {format(date, "EEE", { locale: ptBR })}
                    </div>
                    <div className={cn(
                      "font-semibold",
                      isSameDay(date, today) && "text-primary"
                    )}>
                      {format(date, "dd/MM")}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rows - Crew Members */}
              {crewMembers.map((crew) => (
                <div key={crew.id} className="flex border-b border-border hover:bg-muted/20 transition-colors">
                  <div className="min-w-[180px] p-3 bg-muted/10 sticky left-0 z-10 border-r border-border">
                    <div className="font-medium text-sm truncate">{crew.nome_completo}</div>
                    <div className="text-xs text-muted-foreground">{crew.canac}</div>
                  </div>
                  {dates.map((date) => {
                    const assignment = getCrewAssignment(crew.id, date);
                    const isToday = isSameDay(date, today);

                    return (
                      <TooltipProvider key={date.toISOString()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "min-w-[100px] p-2 border-l border-border flex items-center justify-center",
                                isToday && "bg-primary/5",
                                assignment && "cursor-pointer"
                              )}
                            >
                              {assignment ? (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-xs font-medium px-2 py-1",
                                    assignment.situacao === "confirmado"
                                      ? "bg-destructive/20 text-destructive border-destructive/30"
                                      : "bg-warning/20 text-warning border-warning/30"
                                  )}
                                >
                                  <XCircle className="h-3 w-3 mr-1" />
                                  {assignment.aeronaveReg}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-success/10 text-success border-success/30"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Livre
                                </Badge>
                              )}
                            </div>
                          </TooltipTrigger>
                          {assignment && (
                            <TooltipContent side="top" className="max-w-[200px]">
                              <div className="text-xs space-y-1">
                                <p className="font-semibold">{assignment.aeronaveReg}</p>
                                <p>{assignment.route}</p>
                                {assignment.time && <p>Horário: {assignment.time}</p>}
                                {"role" in assignment && <p>Função: {assignment.role}</p>}
                                <Badge variant="outline" className="text-xs mt-1">
                                  {assignment.situacao === "confirmado" ? "Confirmado" : "Pendente"}
                                </Badge>
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              ))}

              {crewMembers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  Nenhum tripulante ativo encontrado
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Aircraft Schedule Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plane className="h-5 w-5 text-primary" />
            Escala de Aeronaves
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Disponibilidade em tempo real das aeronaves ativas
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              {/* Header - Dates */}
              <div className="flex border-b border-border">
                <div className="min-w-[180px] p-3 font-medium text-muted-foreground bg-muted/30 sticky left-0 z-10">
                  Aeronave
                </div>
                {dates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "min-w-[100px] p-2 text-center border-l border-border",
                      isSameDay(date, today) && "bg-primary/10"
                    )}
                  >
                    <div className="text-xs text-muted-foreground uppercase">
                      {format(date, "EEE", { locale: ptBR })}
                    </div>
                    <div className={cn(
                      "font-semibold",
                      isSameDay(date, today) && "text-primary"
                    )}>
                      {format(date, "dd/MM")}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rows - Aircraft */}
              {aircraft.map((ac) => (
                <div key={ac.id} className="flex border-b border-border hover:bg-muted/20 transition-colors">
                  <div className="min-w-[180px] p-3 bg-muted/10 sticky left-0 z-10 border-r border-border">
                    <div className="font-medium text-sm">{ac.registration}</div>
                    <div className="text-xs text-muted-foreground">{ac.model}</div>
                  </div>
                  {dates.map((date) => {
                    const assignment = getAircraftAssignment(ac.id, date);
                    const isToday = isSameDay(date, today);

                    return (
                      <TooltipProvider key={date.toISOString()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "min-w-[100px] p-2 border-l border-border flex items-center justify-center",
                                isToday && "bg-primary/5",
                                assignment && "cursor-pointer"
                              )}
                            >
                              {assignment ? (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-xs font-medium px-2 py-1 truncate max-w-[90px]",
                                    assignment.situacao === "confirmado"
                                      ? "bg-destructive/20 text-destructive border-destructive/30"
                                      : "bg-warning/20 text-warning border-warning/30"
                                  )}
                                >
                                  <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                  <span className="truncate">Ocupado</span>
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-success/10 text-success border-success/30"
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Livre
                                </Badge>
                              )}
                            </div>
                          </TooltipTrigger>
                          {assignment && (
                            <TooltipContent side="top" className="max-w-[200px]">
                              <div className="text-xs space-y-1">
                                <p className="font-semibold">{assignment.crewName}</p>
                                <p>{assignment.route}</p>
                                {assignment.time && <p>Horário: {assignment.time}</p>}
                                <Badge variant="outline" className="text-xs mt-1">
                                  {assignment.situacao === "confirmado" ? "Confirmado" : "Pendente"}
                                </Badge>
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              ))}

              {aircraft.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Plane className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  Nenhuma aeronave ativa encontrada
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
