import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";

type FlightScheduleRow = Database["public"]["Tables"]["flight_schedules"]["Row"];
type AircraftRow = Database["public"]["Tables"]["aircraft"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type CrewMemberRow = Database["public"]["Tables"]["crew_members"]["Row"];
type FlightPlanRow = Database["public"]["Tables"]["flight_plans"]["Row"];

type FlightScheduleRelations = {
  aircraft?: Pick<AircraftRow, "id" | "registration" | "model"> | null;
  clients?: Pick<ClientRow, "id" | "company_name"> | null;
  flight_plans?: Pick<FlightPlanRow, "id">[] | null;
};

export type FlightScheduleWithDetails = FlightScheduleRow &
  FlightScheduleRelations & {
    crew_members?: Pick<CrewMemberRow, "full_name"> | null;
  };

type FetchFlightSchedulesOptions = {
  status?: FlightScheduleRow["status"];
  includeFlightPlans?: boolean;
};

export async function fetchFlightSchedulesWithDetails(
  options: FetchFlightSchedulesOptions = {}
): Promise<FlightScheduleWithDetails[]> {
  const { status, includeFlightPlans = false } = options;

  let selectString =
    "*, aircraft:aircraft_id(id, registration, model)";

  if (includeFlightPlans) {
    selectString += ", flight_plans(id)";
  }

  let query = supabase
    .from("flight_schedules")
    .select(selectString)
    .order("flight_date", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  let schedules: (Tables<'flight_schedules'> & FlightScheduleRelations)[] = [];

  if (error) {
    const isRelationshipError = /relationship|schema cache/i.test(error.message || "");
    if (!isRelationshipError) {
      console.error("Error details:", error);
      throw new Error(`Falha ao buscar agendamentos: ${error.message}`);
    }

    // Fallback without relational selects: fetch base rows then hydrate
    let baseQuery = supabase
      .from("flight_schedules")
      .select("*")
      .order("flight_date", { ascending: true });
    if (status) {
      baseQuery = baseQuery.eq("status", status);
    }
    const { data: baseRows, error: baseErr } = await baseQuery;

    if (baseErr) {
      console.error("Error details:", baseErr);
      throw new Error(`Falha ao buscar agendamentos: ${baseErr.message}`);
    }

    const rows = (baseRows ?? []) as Tables<'flight_schedules'>[];

    // Collect IDs
    const aircraftIds = Array.from(new Set(rows.map(r => r.aircraft_id).filter((v): v is string => Boolean(v))));

    // Fetch related tables
    const { data: aircraftRows } = await (aircraftIds.length ? supabase.from("aircraft").select("id, registration, model").in("id", aircraftIds) : Promise.resolve({ data: [], error: null } as any));

    const aircraftMap = new Map<string, Pick<AircraftRow, "id" | "registration" | "model">>();

    (aircraftRows as Pick<AircraftRow, "id" | "registration" | "model">[] | undefined)?.forEach(a => aircraftMap.set(a.id, a));

    let plansBySchedule = new Map<string, Pick<FlightPlanRow, "id">[]>();
    if (includeFlightPlans) {
      const { data: planRows } = await supabase.from("flight_plans").select("id, flight_schedule_id");
      (planRows as { id: string; flight_schedule_id: string | null }[] | undefined)?.forEach(p => {
        if (!p.flight_schedule_id) return;
        const arr = plansBySchedule.get(p.flight_schedule_id) || [];
        arr.push({ id: p.id } as Pick<FlightPlanRow, "id">);
        plansBySchedule.set(p.flight_schedule_id, arr);
      });
    }

    schedules = rows.map((r) => ({
      ...(r as any),
      aircraft: r.aircraft_id ? aircraftMap.get(r.aircraft_id) ?? null : null,
      clients: null,
      flight_plans: includeFlightPlans ? plansBySchedule.get(r.id) ?? [] : null,
    }));
  } else {
    schedules = (data ?? []) as unknown as (Tables<'flight_schedules'> & FlightScheduleRelations)[];
  }

  const crewIds = Array.from(
    new Set(
      schedules
        .map((schedule) => schedule.crew_member_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let crewMap = new Map<string, CrewMemberRow["full_name"] | null>();

  if (crewIds.length > 0) {
    const { data: crewData, error: crewError } = await supabase
      .from("crew_members")
      .select("id, full_name")
      .in("id", crewIds);

    if (crewError) {
      throw crewError;
    }

    (crewData ?? []).forEach((crew) => {
      crewMap.set(crew.id, crew.full_name ?? null);
    });
  }

  return schedules.map((schedule) => ({
    ...schedule,
    crew_members: schedule.crew_member_id
      ? { full_name: crewMap.get(schedule.crew_member_id) ?? null }
      : null,
  }));
}
