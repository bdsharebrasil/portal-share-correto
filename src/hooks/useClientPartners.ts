// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientPartner {
  id: string;
  cliente_id: string;
  nome: string;
  cpf: string;
  percentual_participacao: number | null;
  criado_em: string;
  atualizado_em: string;
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
        .from("socios")
        .select("*")
        .eq("clientes_id", clientId)
        .order("nome");

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
        .from("socios")
        .select("*")
        .order("nome");

      if (error) {
        console.error("[useAllClientPartners] Erro ao buscar parceiros:", error);
        throw error;
      }

      return (data || []) as ClientPartner[];
    },
  });
}
