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

export interface CreateManutencaoInput {
  aeronave_id: string;
  tipo: string;
  data_programada: string;
  descricao?: string;
  etapa?: string;
  mecanico?: string;
  oficina?: string;
  custo_estimado?: number;
}

export const createManutencao = async (input: CreateManutencaoInput): Promise<ManutencaoRow> => {
  const { data, error } = await supabase
    .from("manutencoes")
    .insert({
      aeronave_id: input.aeronave_id,
      tipo: input.tipo,
      data_programada: input.data_programada,
      observacoes: input.descricao,
      etapa: input.etapa || "pendente",
      mecanico: input.mecanico || "",
      oficina: input.oficina || null,
      custo_estimado: input.custo_estimado || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ManutencaoRow;
};
