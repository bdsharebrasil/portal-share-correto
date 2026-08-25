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
  /** Inclui a tabela legada despesas_cliente_direto quando necessário. */
  incluirDespesasDiretas?: boolean;
}

const queryKey = (clienteId?: string, diasAtrasoMinimo = 1, incluirDespesasDiretas = true) => [
  "inadimplencia",
  clienteId,
  diasAtrasoMinimo,
  incluirDespesasDiretas,
];

export function useInadimplencia(options: UseInadimplenciaOptions = {}) {
  const { clienteId, diasAtrasoMinimo = 1, incluirDespesasDiretas = true } = options;
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateInadimplencia = () => queryClient.invalidateQueries({ queryKey: ["inadimplencia"] });
    const channel = supabase
      .channel("dashboard-inadimplencia")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentacoes" }, invalidateInadimplencia)
      .on("postgres_changes", { event: "*", schema: "public", table: "despesas_cliente_direto" }, invalidateInadimplencia)
      .on("postgres_changes", { event: "*", schema: "public", table: "contas_areceber" }, invalidateInadimplencia)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKey(clienteId, diasAtrasoMinimo, incluirDespesasDiretas),
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
          contas_areceber_id,
          reembolsavel,
          reembolso_quitado,
          clientes:clientes_id ( razao_social )
        `)
        .not("data_vencimento", "is", null)
        .lt("data_vencimento", hoje);
      let despesasDiretasQuery = supabase
        .from("despesas_cliente_direto")
        .select("id, clientes_id, nome_cliente, descricao, categoria_nome, valor, data_vencimento, status, clientes:clientes_id ( razao_social )")
        .lt("data_vencimento", hoje);
      let contasAReceberQuery = supabase
        .from("contas_areceber")
        .select("id, cliente_id, cliente_nome, descricao, categoria, valor, data_vencimento, status, movimentacao_id")
        .lt("data_vencimento", hoje);

      if (clienteId) {
        movimentacoesQuery = movimentacoesQuery.eq("clientes_id", clienteId);
        despesasDiretasQuery = despesasDiretasQuery.eq("clientes_id", clienteId);
        contasAReceberQuery = contasAReceberQuery.eq("cliente_id", clienteId);
      }

      const [movimentacoesResult, despesasDiretasResult, contasAReceberResult] = await Promise.all([
        movimentacoesQuery,
        incluirDespesasDiretas ? despesasDiretasQuery : Promise.resolve({ data: [], error: null }),
        contasAReceberQuery,
      ]);
      if (movimentacoesResult.error) throw movimentacoesResult.error;
      if (despesasDiretasResult.error) throw despesasDiretasResult.error;
      if (contasAReceberResult.error) throw contasAReceberResult.error;

      const isPendente = (status: string | null | undefined) =>
        !["pago", "recebido", "cancelado", "pagamento_validado", "reembolsado", "comprovante_recebido", "comprovante_pago", "quitado", "quitada"].includes((status || "").toLowerCase());
      const movimentacoes = (movimentacoesResult.data || []) as any[];
      const idsMovimentacoes = new Set(movimentacoes.map((movimentacao) => movimentacao.id));
      const idsContasVinculadas = new Set(
        movimentacoes.map((movimentacao) => movimentacao.contas_areceber_id).filter(Boolean),
      );

      const itensMovimentacoes = movimentacoes
        .filter((movimentacao) => {
          if (!isPendente(movimentacao.status)) return false;
          if (movimentacao.reembolsavel && movimentacao.reembolso_quitado) return false;
          const fluxo = (movimentacao.fluxo || "").toLowerCase();
          if (movimentacao.tipo_caixa === "cliente") return !["entrada", "receita"].includes(fluxo);
          return ["entrada", "receita"].includes(fluxo);
        })
        .map((movimentacao): InadimplenciaItem => ({
          id: movimentacao.id,
          origem: movimentacao.tipo_caixa === "cliente" ? "despesa_cliente_direta" : "conta_a_receber",
          cliente_id: movimentacao.clientes_id,
          cliente_nome: movimentacao.clientes?.razao_social || "Cliente desconhecido",
          descricao: movimentacao.descricao,
          categoria: movimentacao.categoria_nome || null,
          valor: Number(movimentacao.valor_rateado ?? movimentacao.valor_total ?? 0),
          data_vencimento: movimentacao.data_vencimento,
          dias_atraso: differenceInDays(new Date(), parseISO(movimentacao.data_vencimento)),
        }));
      const itensDespesasDiretas = ((despesasDiretasResult.data || []) as any[])
        .filter((despesa) => isPendente(despesa.status))
        .map((despesa): InadimplenciaItem => ({
          id: despesa.id,
          origem: "despesa_cliente_direta",
          cliente_id: despesa.clientes_id,
          cliente_nome: despesa.clientes?.razao_social || despesa.nome_cliente || "Cliente desconhecido",
          descricao: despesa.descricao,
          categoria: despesa.categoria_nome || null,
          valor: Number(despesa.valor || 0),
          data_vencimento: despesa.data_vencimento,
          dias_atraso: differenceInDays(new Date(), parseISO(despesa.data_vencimento)),
        }));
      const itensContasAReceber = ((contasAReceberResult.data || []) as any[])
        .filter((conta) => isPendente(conta.status))
        .filter((conta) => !idsContasVinculadas.has(conta.id) && !idsMovimentacoes.has(conta.movimentacao_id))
        .map((conta): InadimplenciaItem => ({
          id: conta.id,
          origem: "conta_a_receber",
          cliente_id: conta.cliente_id,
          cliente_nome: conta.cliente_nome || "Cliente desconhecido",
          descricao: conta.descricao || conta.categoria || "Conta a receber",
          categoria: conta.categoria || null,
          valor: Number(conta.valor || 0),
          data_vencimento: conta.data_vencimento,
          dias_atraso: differenceInDays(new Date(), parseISO(conta.data_vencimento)),
        }));

      return [...itensMovimentacoes, ...itensDespesasDiretas, ...itensContasAReceber]
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
