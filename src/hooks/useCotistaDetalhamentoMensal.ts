import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DespesaFixaVariavel {
  id: string;
  descricao: string;
  tipo: "FIXO" | "VARIAVEL" | "EXTRA";
  valor_total: number;
  valor_rateado: number;
  data_vencimento: string | null;
  fornecedor: string | null;
  status: string | null;
}

export interface LancamentoDiarioBordo {
  id: string;
  data: string;
  horas_voo: number;
  horas_diurnas: number;
  horas_noturnas: number;
  horas_ifr: number;
  descricao: string;
}

export interface CotistaDetalhamentoMensal {
  cotista_id: string;
  cotista_nome: string;
  percentual: number;
  mes: string; // "2024-01"

  // Despesas
  despesasFixas: DespesaFixaVariavel[];
  totalFixo: number;

  despesasVariaveis: DespesaFixaVariavel[];
  totalVariavel: number;

  despesasExtras: DespesaFixaVariavel[];
  totalExtra: number;

  // Horas do diário de bordo
  lancamentosBordo: LancamentoDiarioBordo[];
  horasVoadasTotal: number;
  horasDiurnasTotal: number;
  horasNoturnasTotal: number;
  horasIfrTotal: number;

  // Resumo
  totalDespesas: number;
  saldoMes: number;
}

export function useCotistaDetalhamentoMensal(
  clienteId: string,
  aeronaveId: string,
  mes: string // "2024-01"
) {
  return useQuery({
    queryKey: ["cotista-detalhamento-mensal", clienteId, aeronaveId, mes],
    enabled: !!clienteId && !!aeronaveId && !!mes,
    queryFn: async () => {
      const anoMes = mes; // formato "2024-01"
      const mesInicio = `${anoMes}-01`;
      const mesProximo = new Date(anoMes + "-01");
      mesProximo.setMonth(mesProximo.getMonth() + 1);
      const mesFim = mesProximo.toISOString().split("T")[0];

      // 1. Buscar despesas do cliente neste mês por tipo (FIXO/VARIAVEL/EXTRA)
      const { data: despesas } = await supabase
        .from("rateio_despesas")
        .select(
          "id, cliente_id, clientes_nome, descricao_despesa, categoria_custo, tipo_rateio, valor_total_despesa, valor_rateado, data_vencimento, fornecedor_nome, status"
        )
        .eq("cliente_id", clienteId)
        .eq("aeronave_id", aeronaveId)
        .gte("data_vencimento", mesInicio)
        .lt("data_vencimento", mesFim)
        .order("data_vencimento");

      // 2. Buscar lançamentos do diário de bordo neste mês
      const { data: lancamentosBordo } = await supabase
        .from("lancamentos_diario_bordo")
        .select(
          "id, data_registro, tempo_total, horas_diurnas, horas_noturnas, tempo_ifr"
        )
        .eq("clientes_id", clienteId)
        .eq("aeronave_id", aeronaveId)
        .gte("data_registro", mesInicio)
        .lt("data_registro", mesFim)
        .order("data_registro");

      // Agrupar despesas por tipo
      const despesasFixas: DespesaFixaVariavel[] = [];
      const despesasVariaveis: DespesaFixaVariavel[] = [];
      const despesasExtras: DespesaFixaVariavel[] = [];

      (despesas || []).forEach((d: any) => {
        const item: DespesaFixaVariavel = {
          id: d.id,
          descricao: d.descricao_despesa || d.fornecedor_nome || "—",
          tipo: (d.tipo_rateio || "VARIAVEL") as "FIXO" | "VARIAVEL" | "EXTRA",
          valor_total: Number(d.valor_total_despesa) || 0,
          valor_rateado: Number(d.valor_rateado) || 0,
          data_vencimento: d.data_vencimento,
          fornecedor: d.fornecedor_nome,
          status: d.status,
        };

        if (item.tipo === "FIXO") despesasFixas.push(item);
        else if (item.tipo === "EXTRA") despesasExtras.push(item);
        else despesasVariaveis.push(item);
      });

      const totalFixo = despesasFixas.reduce((s, d) => s + d.valor_rateado, 0);
      const totalVariavel = despesasVariaveis.reduce((s, d) => s + d.valor_rateado, 0);
      const totalExtra = despesasExtras.reduce((s, d) => s + d.valor_rateado, 0);
      const totalDespesas = totalFixo + totalVariavel + totalExtra;

      // Processar lançamentos de bordo
      const lancamentos: LancamentoDiarioBordo[] = (lancamentosBordo || []).map((l: any) => ({
        id: l.id,
        data: l.data_registro,
        horas_voo: Number(l.tempo_total) || 0,
        horas_diurnas: Number(l.horas_diurnas) || 0,
        horas_noturnas: Number(l.horas_noturnas) || 0,
        horas_ifr: Number(l.tempo_ifr) || 0,
        descricao: "",
      }));

      const horasVoadasTotal = lancamentos.reduce((s, l) => s + l.horas_voo, 0);
      const horasDiurnasTotal = lancamentos.reduce((s, l) => s + l.horas_diurnas, 0);
      const horasNoturnasTotal = lancamentos.reduce((s, l) => s + l.horas_noturnas, 0);
      const horasIfrTotal = lancamentos.reduce((s, l) => s + l.horas_ifr, 0);

      return {
        cotista_id: clienteId,
        cotista_nome: "", // será preenchido no componente
        percentual: 0, // será preenchido no componente
        mes: anoMes,
        despesasFixas,
        totalFixo,
        despesasVariaveis,
        totalVariavel,
        despesasExtras,
        totalExtra,
        lancamentosBordo: lancamentos,
        horasVoadasTotal,
        horasDiurnasTotal,
        horasNoturnasTotal,
        horasIfrTotal,
        totalDespesas,
        saldoMes: 0, // será calculado no componente
      };
    },
  });
}
