import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LancamentoRateio {
  id: string;
  lancamento_id: string;
  cliente_id: string | null;
  cliente_nome: string;
  aeronave_registro: string;
  percentual: number;
  valor_rateado: number;
  valor_recebido: number;
  valor_pendente: number;
  status: "pendente" | "parcial" | "quitado";
  reembolsos_ids: string[];
  observacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function useLancamentosRateio(lancamentoId?: string) {
  const queryClient = useQueryClient();

  const { data: rateios, isLoading, error } = useQuery({
    queryKey: ["lancamentos_rateio", lancamentoId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("lancamentos_rateio")
        .select("*")
        .order("cliente_nome");

      if (lancamentoId) {
        query = query.eq("lancamento_id", lancamentoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LancamentoRateio[];
    },
    enabled: true,
  });

  const createRateios = useMutation({
    mutationFn: async (rateios: Omit<LancamentoRateio, "id" | "criado_em" | "atualizado_em">[]) => {
      const { data, error } = await (supabase as any)
        .from("lancamentos_rateio")
        .insert(rateios)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_rateio"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    },
  });

  const updateRateio = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LancamentoRateio> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("lancamentos_rateio")
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_rateio"] });
    },
  });

  const deleteRateiosByLancamento = useMutation({
    mutationFn: async (lancamentoId: string) => {
      const { error } = await (supabase as any)
        .from("lancamentos_rateio")
        .delete()
        .eq("lancamento_id", lancamentoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos_rateio"] });
    },
  });

  // Calcular totais
  const totais = rateios?.reduce(
    (acc, r) => ({
      valorTotal: acc.valorTotal + r.valor_rateado,
      valorRecebido: acc.valorRecebido + r.valor_recebido,
      valorPendente: acc.valorPendente + r.valor_pendente,
    }),
    { valorTotal: 0, valorRecebido: 0, valorPendente: 0 }
  );

  return {
    rateios: rateios || [],
    totais,
    isLoading,
    error,
    createRateios,
    updateRateio,
    deleteRateiosByLancamento,
  };
}
