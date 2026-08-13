import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VooResumo {
  numero_voo: string;
  origem: string | null;
  destino: string | null;
  data_agendada: string | null;
  cliente_id: string | null;
  aeronave_id: string | null;
}

/**
 * Lista voos que já têm numero_voo gerado (ou seja, já passaram pela
 * confirmação da coordenação), opcionalmente filtrados por aeronave. Usado no
 * combobox "Vincular a um voo confirmado?" da tela de Controle de
 * Abastecimento.
 */
export function useVoosConfirmados(aeronaveId?: string | null) {
  return useQuery({
    queryKey: ["voos-confirmados", aeronaveId ?? "todas"],
    queryFn: async (): Promise<VooResumo[]> => {
      let query = supabase
        .from("solicitacoes_reserva_voo")
        .select("numero_voo, origem, destino, data_agendada, cliente_id, aeronave_id")
        .not("numero_voo", "is", null)
        .order("data_agendada", { ascending: false })
        .limit(200);

      if (aeronaveId) query = query.eq("aeronave_id", aeronaveId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}