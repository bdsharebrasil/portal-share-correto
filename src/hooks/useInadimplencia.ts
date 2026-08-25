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

type FinancialSource = {
  status: string | null;
  data_vencimento: string | null;
  valor: number | null;
  descricao: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  categoria: string | null;
};

const sourceReference = (referenceType: string | null | undefined) => {
  const [origin, originId] = String(referenceType || "").split(":");
  return origin && originId && (origin === "nf_saida" || origin === "recibo_saida")
    ? `${origin}:${originId}`
    : null;
};

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
      .on("postgres_changes", { event: "*", schema: "public", table: "notas_fiscais_saida" }, invalidateInadimplencia)
      .on("postgres_changes", { event: "*", schema: "public", table: "recibos_saida" }, invalidateInadimplencia)
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
          reference_type,
          reference_id,
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
        .select("id, cliente_id, cliente_nome, descricao, categoria, valor, data_vencimento, status, movimentacao_id, reference_type, reference_id");
      const notasFiscaisSaidaQuery = supabase
        .from("notas_fiscais_saida")
        .select("id, status, data_vencimento, valor, descricao, categoria, cliente_id, cliente_nome");
      const recibosSaidaQuery = supabase
        .from("recibos_saida")
        .select("id, status, data_vencimento, valor, valor_total, descricao_servico, nome_pagador, nome_categoria, cliente_id");

      if (clienteId) {
        movimentacoesQuery = movimentacoesQuery.eq("clientes_id", clienteId);
        despesasDiretasQuery = despesasDiretasQuery.eq("clientes_id", clienteId);
        contasAReceberQuery = contasAReceberQuery.eq("cliente_id", clienteId);
      }

      const [movimentacoesResult, despesasDiretasResult, contasAReceberResult, notasFiscaisSaidaResult, recibosSaidaResult] = await Promise.all([
        movimentacoesQuery,
        incluirDespesasDiretas ? despesasDiretasQuery : Promise.resolve({ data: [], error: null }),
        contasAReceberQuery,
        notasFiscaisSaidaQuery,
        recibosSaidaQuery,
      ]);
      if (movimentacoesResult.error) throw movimentacoesResult.error;
      if (despesasDiretasResult.error) throw despesasDiretasResult.error;
      if (contasAReceberResult.error) throw contasAReceberResult.error;
      if (notasFiscaisSaidaResult.error) throw notasFiscaisSaidaResult.error;
      if (recibosSaidaResult.error) throw recibosSaidaResult.error;

      const isPendente = (status: string | null | undefined) =>
        ![
          "pago",
          "paga",
          "recebido",
          "recebida",
          "cancelado",
          "cancelada",
          "pagamento_validado",
          "reembolsado",
          "comprovante_recebido",
          "comprovante_pago",
          "quitado",
          "quitada",
          "liquidado",
          "liquidada",
        ].includes((status || "").trim().toLowerCase());

      const fontesAtuais = new Map<string, FinancialSource>();
      (notasFiscaisSaidaResult.data || []).forEach((nota: any) => {
        fontesAtuais.set(`nf_saida:${nota.id}`, {
          status: nota.status,
          data_vencimento: nota.data_vencimento,
          valor: nota.valor == null ? null : Number(nota.valor),
          descricao: nota.descricao,
          cliente_id: nota.cliente_id,
          cliente_nome: nota.cliente_nome,
          categoria: nota.categoria,
        });
      });
      (recibosSaidaResult.data || []).forEach((recibo: any) => {
        fontesAtuais.set(`recibo_saida:${recibo.id}`, {
          status: recibo.status,
          data_vencimento: recibo.data_vencimento,
          valor: recibo.valor_total == null ? Number(recibo.valor) : Number(recibo.valor_total),
          descricao: recibo.descricao_servico,
          cliente_id: recibo.cliente_id,
          cliente_nome: recibo.nome_pagador,
          categoria: recibo.nome_categoria,
        });
      });

      const isCurrentSource = (referenceType: string | null | undefined) => {
        const key = sourceReference(referenceType);
        return key ? fontesAtuais.get(key) || false : null;
      };
      const isOverdue = (date: string | null | undefined) => {
        if (!date) return false;
        const days = differenceInDays(new Date(), parseISO(date));
        return days >= diasAtrasoMinimo;
      };
      const movimentacoes = (movimentacoesResult.data || []) as any[];
      const idsMovimentacoes = new Set(movimentacoes.map((movimentacao) => movimentacao.id));
      const idsContasVinculadas = new Set(
        movimentacoes.map((movimentacao) => movimentacao.contas_areceber_id).filter(Boolean),
      );
      const contasPorId = new Map(
        ((contasAReceberResult.data || []) as any[]).map((conta) => [conta.id, conta]),
      );

      const itensMovimentacoes = movimentacoes
        .filter((movimentacao) => {
          if (!isPendente(movimentacao.status)) return false;
          const fonteAtual = isCurrentSource(movimentacao.reference_type);
          const contaVinculada = movimentacao.contas_areceber_id
            ? contasPorId.get(movimentacao.contas_areceber_id)
            : null;
          if (fonteAtual === false || (fonteAtual && !isPendente(fonteAtual.status))) return false;
          if (movimentacao.contas_areceber_id && !contaVinculada) return false;
          if (contaVinculada && !isPendente(contaVinculada.status)) return false;
          if (movimentacao.reembolsavel && movimentacao.reembolso_quitado) return false;
          const fluxo = (movimentacao.fluxo || "").toLowerCase();
          if (movimentacao.tipo_caixa === "cliente") return !["entrada", "receita"].includes(fluxo);
          return ["entrada", "receita"].includes(fluxo);
        })
        .map((movimentacao): InadimplenciaItem | null => {
          const fonteAtual = isCurrentSource(movimentacao.reference_type);
          const dataVencimento = fonteAtual !== null && fonteAtual !== false
            ? fonteAtual.data_vencimento
            : movimentacao.data_vencimento;
          if (!isOverdue(dataVencimento)) return null;
          return {
            id: movimentacao.id,
            origem: movimentacao.tipo_caixa === "cliente" ? "despesa_cliente_direta" : "conta_a_receber",
            cliente_id: fonteAtual !== null && fonteAtual !== false ? fonteAtual.cliente_id : movimentacao.clientes_id,
            cliente_nome: fonteAtual !== null && fonteAtual !== false
              ? fonteAtual.cliente_nome || movimentacao.clientes?.razao_social || "Cliente desconhecido"
              : movimentacao.clientes?.razao_social || "Cliente desconhecido",
            descricao: fonteAtual !== null && fonteAtual !== false
              ? fonteAtual.descricao || movimentacao.descricao
              : movimentacao.descricao,
            categoria: fonteAtual !== null && fonteAtual !== false
              ? fonteAtual.categoria || movimentacao.categoria_nome || null
              : movimentacao.categoria_nome || null,
            valor: fonteAtual !== null && fonteAtual !== false && fonteAtual.valor != null
              ? fonteAtual.valor
              : Number(movimentacao.valor_rateado ?? movimentacao.valor_total ?? 0),
            data_vencimento: dataVencimento as string,
            dias_atraso: differenceInDays(new Date(), parseISO(dataVencimento as string)),
          };
        })
        .filter((item): item is InadimplenciaItem => item !== null);
      const itensDespesasDiretas = ((despesasDiretasResult.data || []) as any[])
        .filter((despesa) => isPendente(despesa.status))
        .filter((despesa) => isOverdue(despesa.data_vencimento))
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
        .filter((conta) => {
          const fonteAtual = isCurrentSource(conta.reference_type);
          return fonteAtual !== false && !(fonteAtual && !isPendente(fonteAtual.status));
        })
        .filter((conta) => !idsContasVinculadas.has(conta.id) && !idsMovimentacoes.has(conta.movimentacao_id))
        .map((conta): InadimplenciaItem | null => {
          const fonteAtual = isCurrentSource(conta.reference_type);
          const dataVencimento = fonteAtual !== null && fonteAtual !== false
            ? fonteAtual.data_vencimento
            : conta.data_vencimento;
          if (!isOverdue(dataVencimento)) return null;
          return {
            id: conta.id,
            origem: "conta_a_receber",
            cliente_id: fonteAtual !== null && fonteAtual !== false ? fonteAtual.cliente_id : conta.cliente_id,
            cliente_nome: fonteAtual !== null && fonteAtual !== false
              ? fonteAtual.cliente_nome || conta.cliente_nome || "Cliente desconhecido"
              : conta.cliente_nome || "Cliente desconhecido",
            descricao: fonteAtual !== null && fonteAtual !== false
              ? fonteAtual.descricao || conta.descricao || fonteAtual.categoria || "Conta a receber"
              : conta.descricao || conta.categoria || "Conta a receber",
            categoria: fonteAtual !== null && fonteAtual !== false
              ? fonteAtual.categoria || conta.categoria || null
              : conta.categoria || null,
            valor: fonteAtual !== null && fonteAtual !== false && fonteAtual.valor != null
              ? fonteAtual.valor
              : Number(conta.valor || 0),
            data_vencimento: dataVencimento as string,
            dias_atraso: differenceInDays(new Date(), parseISO(dataVencimento as string)),
          };
        })
        .filter((item): item is InadimplenciaItem => item !== null);

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
