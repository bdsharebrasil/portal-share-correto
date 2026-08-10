import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type FlightScheduleRow = Database["public"]["Tables"]["solicitacoes_reserva_voo"]["Row"];
type AeronaveRow = Database["public"]["Tables"]["aeronave"]["Row"];
type CrewMemberRow = Database["public"]["Tables"]["membros_tripulacao"]["Row"];
type ClientRow = Database["public"]["Tables"]["clientes"]["Row"];

type FlightScheduleRelations = {
  aircraft?: Pick<AeronaveRow, "id" | "matricula" | "modelo"> | null;
  clients?: Pick<ClientRow, "id" | "razao_social"> | null;
};

export type FlightScheduleWithDetails = FlightScheduleRow &
  FlightScheduleRelations & {
    crew_members?: Pick<CrewMemberRow, "nome_completo"> | null;
  };

type FetchFlightSchedulesOptions = {
  status?: FlightScheduleRow["status"];
};

export async function fetchFlightSchedulesWithDetails(
  options: FetchFlightSchedulesOptions = {},
): Promise<FlightScheduleWithDetails[]> {
  const { status } = options;
  let query = supabase
    .from("solicitacoes_reserva_voo")
    .select("*")
    .order("data_agendada", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Falha ao buscar solicitações de voo: ${error.message}`);
  }

  const schedules = (data ?? []) as FlightScheduleRow[];
  const aircraftIds = Array.from(
    new Set(schedules.map((schedule) => schedule.aeronave_id).filter(Boolean)),
  );
  const crewIds = Array.from(
    new Set(
      schedules
        .flatMap((schedule) => [schedule.piloto_id, schedule.copiloto_id])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const aircraftMap = new Map<string, Pick<AeronaveRow, "id" | "matricula" | "modelo">>();
  if (aircraftIds.length > 0) {
    const { data: aircraftRows, error: aircraftError } = await supabase
      .from("aeronave")
      .select("id, matricula, modelo")
      .in("id", aircraftIds);

    if (aircraftError) throw aircraftError;
    (aircraftRows ?? []).forEach((aircraft) => aircraftMap.set(aircraft.id, aircraft));
  }

  const crewMap = new Map<string, CrewMemberRow["nome_completo"] | null>();
  if (crewIds.length > 0) {
    const { data: crewRows, error: crewError } = await supabase
      .from("membros_tripulacao")
      .select("id, nome_completo")
      .in("id", crewIds);

    if (crewError) throw crewError;
    (crewRows ?? []).forEach((crew) => crewMap.set(crew.id, crew.nome_completo));
  }

  return schedules.map((schedule) => ({
    ...schedule,
    aircraft: schedule.aeronave_id ? aircraftMap.get(schedule.aeronave_id) ?? null : null,
    clients: null,
    crew_members: schedule.piloto_id
      ? { nome_completo: crewMap.get(schedule.piloto_id) ?? null }
      : null,
  }));
}
