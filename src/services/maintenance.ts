import { supabase } from "@/integrations/supabase/client";

export interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status?: string | null;
}

export const fetchAircrafts = async (): Promise<Aircraft[]> => {
  const { data, error } = await supabase
    .from("aircraft")
    .select("id, registration, model, status")
    .order("registration");
  if (error) throw error;
  return data || [];
};

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
