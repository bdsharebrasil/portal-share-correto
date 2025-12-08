import { supabase } from "@/integrations/supabase/client";

export interface ManutencaoRow {
  id: string;
  numero_os?: string | null;
  tipo: string;
  aeronave_id: string | null;
  data_programada: string; // ISO date
  mecanico: string;
  etapa: string; // aguardando | em_andamento | concluida | cancelada
  oficina?: string | null;
  observacoes?: string | null;
  custo_estimado?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ManutencaoWithAircraft extends ManutencaoRow {
  aeronave_registration?: string;
}

export const fetchAircraftMap = async (): Promise<Record<string, string>> => {
  // Try primary table name "aeronave", fallback to "aircraft"
  const maps: Record<string, string> = {};

  const tryFetch = async (table: any) => {
    const { data, error } = await supabase.from(table as any).select("id, registration");
    if (!error && data) {
      for (const row of data as any[]) {
        if (row.id && row.registration) maps[row.id] = row.registration as string;
      }
      return true;
    }
    return false;
  };

  const ok = await tryFetch("aeronave");
  if (!ok) {
    await tryFetch("aircraft");
  }
  return maps;
};

export const fetchManutencoesWithAircraft = async (): Promise<ManutencaoWithAircraft[]> => {
  const { data, error } = await supabase
    .from("manutencoes")
    .select("*")
    .order("data_programada", { ascending: false });
  if (error) throw error;
  const manutencoes = (data || []) as ManutencaoRow[];
  if (manutencoes.length === 0) return [];

  const aircraftMap = await fetchAircraftMap();
  return manutencoes.map((m) => ({
    ...m,
    aeronave_registration: m.aeronave_id ? aircraftMap[m.aeronave_id] : undefined,
  }));
};
