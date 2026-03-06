import { supabase } from '@/integrations/supabase/client';

export interface Aircraft {
  id: string;
  registration: string;
}

export interface MaintenancePayload {
  tipo: string;
  aeronave_id: string | null;
  data_programada: string;
  mecanico: string;
  etapa: string;
  oficina?: string | null;
  observacoes?: string | null;
  custo_estimado?: number | null;
  vencimento_tipo?: string;
  vencimento_horas?: number;
}

export async function fetchAircrafts(): Promise<Aircraft[]> {
  const { data, error } = await supabase
    .from('aircraft')
    .select('id, registration')
    .order('registration');
  if (error) throw error;
  return (data as Aircraft[]) || [];
}

export async function createMaintenance(payload: MaintenancePayload) {
  const { data, error } = await supabase.from('manutencoes').insert([payload]);
  if (error) throw error;
  return data;
}

export async function updateMaintenance(id: string, payload: Partial<MaintenancePayload>) {
  const { data, error } = await supabase
    .from('manutencoes')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
  return data;
}
