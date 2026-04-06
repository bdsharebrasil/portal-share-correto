import { supabase } from "@/integrations/supabase/client";

export interface Aeronave {
  id: string;
  matricula: string;
  modelo: string;
  status?: string | null;
}

export const fetchAeronaves = async (): Promise<Aeronave[]> => {
  const { data, error } = await supabase
    .from("aeronave")
    .select('id, matricula, modelo, status')
    .order("matricula");
  if (error) throw error;
  return data || [];
};

// Backward compatibility
export const fetchAircrafts = fetchAeronaves;
export type Aircraft = Aeronave;

export const createMaintenance = async (payload: {
  aeronave_id: string;
  tipo: string;
  data_programada: string;
  mecanico: string;
  etapa?: string;
  oficina?: string;
  observacoes?: string;
  custo_estimado?: number;
}) => {
  const { data, error } = await (supabase as any)
    .from("manutencoes")
    .insert([{ ...payload, etapa: payload.etapa || "aguardando" }])
    .select()
    .single();
  if (error) throw error;
  return data;
};
