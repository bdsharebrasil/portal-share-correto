import { supabase } from '@/integrations/supabase/client';

export interface FlightDocumentPayload {
  aeronave_id: string;
  name: string;
  document_type?: string;
  expiry_date: string;
  file_path: string;
}

export async function createFlightDocument(payload: FlightDocumentPayload) {
  const { data, error } = await supabase.from('flight_documents').insert(payload);
  if (error) throw error;
  return data;
}
