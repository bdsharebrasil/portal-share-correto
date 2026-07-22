import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AircraftLite {
  id: string;
  matricula: string;
  modelo: string | null;
}

/**
 * Hook usado pelos painéis de dashboard/balanço para listar todas
 * as aeronaves cadastradas. Fonte: tabela `aeronave`.
 */
export function useAircraft() {
  return useQuery({
    queryKey: ["dashboard", "aircraft"],
    queryFn: async (): Promise<AircraftLite[]> => {
      const { data, error } = await supabase
        .from("aeronave" as any)
        .select("id, matricula, modelo")
        .order("matricula", { ascending: true });
      if (error) throw error;
      return ((data as any[]) ?? []).map((a) => ({
        id: a.id,
        matricula: a.matricula,
        modelo: a.modelo ?? null,
      }));
    },
    staleTime: 10 * 60_000,
  });
}