import { useQuery } from "@tanstack/react-query";
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
  diasAtrasoMinimo?: number; // default 1 = qualquer coisa já vencida
}

export function useInadimplencia(options: UseInadimplenciaOptions = {}) {
  const { clienteId, diasAtrasoMinimo = 1 } = options;
  const hoje = new Date().toISOString().split("T")[0];

  const { data, isLoading, error } = useQuery({
    queryKey: ["inadimplencia", clienteId, diasAtrasoMinimo],
    queryFn: async () => {
      // 1) Despesas do cliente pagas direto (caixa cliente), sem passar pelo caixa Share
      let despesasQuery = supabase
        .from("movimentacoes")
        .select(`
          id,
          descricao,
          grupo_custo,
          valor,
          data_vencimento,
          status,
          clientes_id,
          clientes:clientes_id ( razao_social )
        `)
        .eq("tipo_caixa", "cliente")
        .in("status", ["pendente", "parcial"])
        .not("clientes_id", "is", null)
        .not("data_vencimento", "is", null)
        .lt("data_vencimento", hoje);

      if (clienteId) despesasQuery = despesasQuery.eq("clientes_id", clienteId);

      // 2) Contas que a Share tem a receber do cliente (reembolso ou receita mensal)
      let receberQuery = supabase
        .from("contas_areceber")
        .select(`
          id,
          cliente_id,
          cliente_nome,
          descricao,
          categoria,
          valor,
          data_vencimento,
          status
        `)
        .eq("status", "pendente")
        .lt("data_vencimento", hoje);

      if (clienteId) receberQuery = receberQuery.eq("cliente_id", clienteId);

      const [
        { data: despesas, error: errDespesas },
        { data: receber, error: errReceber },
      ] = await Promise.all([despesasQuery, receberQuery]);

      if (errDespesas) throw errDespesas;
      if (errReceber) throw errReceber;

      const itensDespesas: InadimplenciaItem[] = (despesas || []).map((d: any) => ({
        id: d.id,
        origem: "despesa_cliente_direta",
        cliente_id: d.clientes_id,
        cliente_nome: d.clientes?.razao_social || "Cliente desconhecido",
        descricao: d.descricao,
        categoria: d.grupo_custo || null,
        valor: Number(d.valor),
        data_vencimento: d.data_vencimento,
        dias_atraso: differenceInDays(new Date(), parseISO(d.data_vencimento)),
      }));

      const itensReceber: InadimplenciaItem[] = (receber || []).map((r: any) => ({
        id: r.id,
        origem: "conta_a_receber",
        cliente_id: r.cliente_id,
        cliente_nome: r.cliente_nome || "Cliente desconhecido",
        descricao: r.descricao || "",
        categoria: r.categoria || null,
        valor: Number(r.valor),
        data_vencimento: r.data_vencimento,
        dias_atraso: differenceInDays(new Date(), parseISO(r.data_vencimento)),
      }));

      return [...itensDespesas, ...itensReceber]
        .filter((item) => item.dias_atraso >= diasAtrasoMinimo)
        .sort((a, b) => b.dias_atraso - a.dias_atraso);
    },
  });

  const lista = data || [];

  const resumo = {
    totalEmAtraso: lista.reduce((acc, i) => acc + i.valor, 0),
    totalDespesasDiretas: lista
      .filter((i) => i.origem === "despesa_cliente_direta")
      .reduce((acc, i) => acc + i.valor, 0),
    totalAReceber: lista
      .filter((i) => i.origem === "conta_a_receber")
      .reduce((acc, i) => acc + i.valor, 0),
    quantidadeClientes: new Set(lista.map((i) => i.cliente_id)).size,
  };

  return { data: lista, resumo, isLoading, error };
}