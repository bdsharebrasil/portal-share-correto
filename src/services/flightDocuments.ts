import { supabase } from '@/integrations/supabase/client';

export interface FlightDocumentPayload {
  aeronave_id: string;
  nome: string;
  tipo_documento?: string;
  data_validade: string;
  caminho_arquivo: string;
}

export async function createFlightDocument(payload: FlightDocumentPayload) {
  const { data, error } = await supabase.from('documentos_voo').insert(payload);
  if (error) throw error;
  return data;
}
