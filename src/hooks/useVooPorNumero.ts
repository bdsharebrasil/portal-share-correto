import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VooInfo {
  numero_voo: string;
  cliente_id: string | null;
  aeronave_id: string | null;
  origem: string | null;
  destino: string | null;
  data_agendada: string | null;
  ciclo_voo_id: string | null;
  piloto_id: string | null;
  copiloto_id: string | null;
  cliente_nome: string | null;
  aeronave_matricula: string | null;
  piloto_nome: string | null;
  copiloto_nome: string | null;
}

const normalizar = (numero: string) => numero.trim().toUpperCase();

/**
 * Busca os dados de um voo a partir do numero_voo, usando
 * solicitacoes_reserva_voo como fonte única da verdade (é a única das duas
 * tabelas — a outra é ciclos_voo — com índice único em numero_voo, e a única
 * com piloto_id/copiloto_id estruturados para pré-preencher formulários).
 */
export function useVooPorNumero(numeroVoo: string | null | undefined) {
  const numeroNormalizado = numeroVoo ? normalizar(numeroVoo) : "";

  return useQuery({
    queryKey: ["voo-por-numero", numeroNormalizado],
    enabled: numeroNormalizado.length > 0,
    queryFn: async (): Promise<VooInfo | null> => {
      const { data, error } = await supabase
        .from("solicitacoes_reserva_voo")
        .select(`
          numero_voo, cliente_id, aeronave_id, origem, destino, data_agendada,
          ciclo_voo_id, piloto_id, copiloto_id,
          cliente:cliente_id ( razao_social ),
          aeronave:aeronave_id ( matricula ),
          piloto:piloto_id ( nome_completo ),
          copiloto:copiloto_id ( nome_completo )
        `)
        .eq("numero_voo", numeroNormalizado)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        numero_voo: data.numero_voo,
        cliente_id: data.cliente_id,
        aeronave_id: data.aeronave_id,
        origem: data.origem,
        destino: data.destino,
        data_agendada: data.data_agendada,
        ciclo_voo_id: data.ciclo_voo_id,
        piloto_id: data.piloto_id,
        copiloto_id: data.copiloto_id,
        cliente_nome: (data as any).cliente?.razao_social ?? null,
        aeronave_matricula: (data as any).aeronave?.matricula ?? null,
        piloto_nome: (data as any).piloto?.nome_completo ?? null,
        copiloto_nome: (data as any).copiloto?.nome_completo ?? null,
      };
    },
  });
}