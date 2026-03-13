import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Abastecimento {
  id: string;
  client_id: string;
  aeronave_id: string | null;
  data: string;
  trecho: string;
  local: string;
  litros: number;
  valor_unitario: number;
  valor_total: number;
  abastecedor: string | null;
  status_pagamento: string | null;
  created_at: string;
  updated_at: string;
  partner_name: string | null;
  comanda: string | null;
}

/**
 * Busca abastecimentos não pagos/não vinculados de um cliente
 */
export function useClientAbastecimentos(clientId: string | null) {
  return useQuery({
    queryKey: ["client-abastecimentos", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];

      // 1. Buscar aircraft_id vinculado ao cliente via client_aircraft
      const { data: clientAircraft } = await supabase
        .from("client_aircraft")
        .select("aircraft_id")
        .eq("client_id", clientId);

      const aircraftIds = (clientAircraft || []).map((ca) => ca.aircraft_id);

      // 2. Buscar abastecimentos pendentes por client_id ou aeronave_id
      let query = supabase
        .from("abastecimentos")
        .select("*")
        .or("status_pagamento.is.null,status_pagamento.eq.em_aberto,status_pagamento.eq.em aberto,status_pagamento.eq.pendente");

      if (aircraftIds.length > 0) {
        query = query.or(`client_id.eq.${clientId},aeronave_id.in.(${aircraftIds.join(",")})`);
      } else {
        query = query.eq("client_id", clientId);
      }

      const { data, error } = await query;

      if (error) {
        toast.error("Erro ao carregar abastecimentos: " + error.message);
        return [];
      }

      return (data || []) as Abastecimento[];
    },
  });
}

/**
 * Vincula uma despesa com um abastecimento
 */
export function useLinkAbastecimentoDespesa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      abastecimentoId: string;
      expenseId: string;
      clientId: string;
      statusPagamento?: string;
    }) => {
      // Update abastecimento com status de pagamento
      const { error: updateError } = await supabase
        .from("abastecimentos")
        .update({
          status_pagamento: data.statusPagamento || "registrado",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.abastecimentoId);

      if (updateError) throw updateError;

      // Update partner_expenses notes to reference abastecimento
      const { error: linkError } = await supabase
        .from("partner_expenses")
        .update({
          notes: `Vinculado ao abastecimento: ${data.abastecimentoId}`,
        })
        .eq("id", data.expenseId);

      if (linkError) throw linkError;

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["client-abastecimentos", data.clientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["partner-expenses", data.clientId],
      });
      toast.success("Despesa vinculada ao abastecimento com sucesso!");
    },
    onError: (err: any) => {
      toast.error(
        "Erro ao vincular despesa: " + (err.message || "Erro desconhecido")
      );
    },
  });
}

/**
 * Busca abastecimentos de um cliente em um período específico
 * Usado para o relatório de sócios
 */
export function useAbastecimentosByPeriod(
  clientId: string | null,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ["abastecimentos-by-period", clientId, startDate, endDate],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from("abastecimentos")
        .select("*")
        .eq("client_id", clientId)
        .gte("data", startDate)
        .lte("data", endDate)
        .order("data", { ascending: false });

      if (error) {
        console.error("Erro ao carregar abastecimentos por período:", error);
        return [];
      }

      return (data || []) as Abastecimento[];
    },
  });
}

/**
 * Cria um novo abastecimento
 */
export function useCreateAbastecimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clientId: string;
      aeronaveId?: string;
      data: string;
      trecho: string;
      local: string;
      litros: number;
      valorUnitario: number;
      abastecedor?: string;
      partnerName?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("abastecimentos")
        .insert({
          client_id: data.clientId,
          aeronave_id: data.aeronaveId || null,
          data: data.data,
          trecho: data.trecho,
          local: data.local,
          litros: data.litros,
          valor_unitario: data.valorUnitario,
          abastecedor: data.abastecedor || null,
          partner_name: data.partnerName || null,
          status_pagamento: null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["client-abastecimentos", data.client_id],
      });
      toast.success("Abastecimento criado com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar abastecimento: " + err.message);
    },
  });
}
