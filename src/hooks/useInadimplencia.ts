import { useEffect } from "react";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

export type InadimplenciaOrigem = "despesa_cliente_direta" | "conta_a_receber";

export interface InadimplenciaItem {
  id: string;
  origem: InadimplenciaOrigem;
  cliente_id: string | null;
  cliente_nome: string;
  descricao: string;
  categoria: string | null;
  valor: number;
  data_vencimento: string;
  dias_atraso: number;
}

interface UseInadimplenciaOptions {
  clienteId?: string;
  diasAtrasoMinimo?: number;
}

const queryKey = (clienteId?: string, diasAtrasoMinimo = 1) => [
  "inadimplencia",
  clienteId,
  diasAtrasoMinimo,
];

export function useInadimplencia(options: UseInadimplenciaOptions = {}) {
  const { clienteId, diasAtrasoMinimo = 1 } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-inadimplencia")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "movimentacoes" },
        () => queryClient.invalidateQueries({ queryKey: ["inadimplencia"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKey(clienteId, diasAtrasoMinimo),
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      let movimentacoesQuery = supabase
        .from("movimentacoes")
        .select(`
          id,
          descricao,
          categoria_nome,
          valor_rateado,
          valor_total,
          data_vencimento,
          status,
          fluxo,
          tipo_caixa,
          clientes_id,
          clientes:clientes_id ( razao_social )
        `)
        .in("status", ["pendente", "parcial", "aguardando_reembolso"])
        .not("data_vencimento", "is", null)
        .lt("data_vencimento", hoje);

      if (clienteId) movimentacoesQuery = movimentacoesQuery.eq("clientes_id", clienteId);

      const { data: movimentacoes, error: movimentacoesError } = await movimentacoesQuery;
      if (movimentacoesError) throw movimentacoesError;

      return ((movimentacoes || []) as any[])
        .filter((movimentacao: any) => {
          if (movimentacao.tipo_caixa === "cliente") return true;
          return ["entrada", "receita"].includes(movimentacao.fluxo);
        })
        .map((movimentacao: any): InadimplenciaItem => ({
          id: movimentacao.id,
          origem: movimentacao.tipo_caixa === "cliente" ? "despesa_cliente_direta" : "conta_a_receber",
          cliente_id: movimentacao.clientes_id,
          cliente_nome: movimentacao.clientes?.razao_social || "Cliente desconhecido",
          descricao: movimentacao.descricao,
          categoria: movimentacao.categoria_nome || null,
          valor: Number(movimentacao.valor_rateado ?? movimentacao.valor_total ?? 0),
          data_vencimento: movimentacao.data_vencimento,
          dias_atraso: differenceInDays(new Date(), parseISO(movimentacao.data_vencimento)),
        }))
        .filter((item) => item.dias_atraso >= diasAtrasoMinimo)
        .sort((a, b) => b.dias_atraso - a.dias_atraso);
    },
  });

  const lista = data || [];
  const resumo = {
    totalEmAtraso: lista.reduce((acc, item) => acc + item.valor, 0),
    totalDespesasDiretas: lista
      .filter((item) => item.origem === "despesa_cliente_direta")
      .reduce((acc, item) => acc + item.valor, 0),
    totalAReceber: lista
      .filter((item) => item.origem === "conta_a_receber")
      .reduce((acc, item) => acc + item.valor, 0),
    quantidadeClientes: new Set(lista.map((item) => item.cliente_id)).size,
  };

  return { data: lista, resumo, isLoading, error };
}
