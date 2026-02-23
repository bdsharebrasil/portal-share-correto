import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientPartner {
  id: string;
  client_id: string;
  name: string;
  cpf: string;
  share_percentage: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para buscar parceiros (sócios) de um cliente
 */
export function useClientPartners(clientId: string | null) {
  return useQuery({
    queryKey: ["client-partners", clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from("client_partners")
        .select("*")
        .eq("client_id", clientId)
        .order("name");

      if (error) {
        console.error("[useClientPartners] Erro ao buscar parceiros:", error);
        throw error;
      }

      return (data || []) as ClientPartner[];
    },
    enabled: !!clientId,
  });
}

/**
 * Hook para buscar todos os parceiros de múltiplos clientes
 */
export function useAllClientPartners() {
  return useQuery({
    queryKey: ["all-client-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_partners")
        .select("*")
        .order("name");

      if (error) {
        console.error("[useAllClientPartners] Erro ao buscar parceiros:", error);
        throw error;
      }

      return (data || []) as ClientPartner[];
    },
  });
}
