import { useMemo } from 'react';
import { classify, dateOf, isDga, isEntrada, periodOf, paidByShareForClient, valueOf } from '@/utils/financeiroRules';

export function useClienteFinanceiro(movimentacoes: any[], rateios: any[] = [], clienteId: string | null) {
  return useMemo(() => {
    if (!clienteId) {
      return {
        movimentos: [],
        mensal: [],
        resumo: { despesas: 0, sharePagou: 0, clientePagouDireto: 0, recebidoShare: 0, aberto: 0 },
      };
    }

    const valoresRateadosPorMovimentacao = new Map<string, number>();
    rateios.forEach((rateio) => {
      if (String(rateio?.cliente_id || '') !== clienteId) return;
      const movimentacaoId = String(rateio?.despesa_id || rateio?.movimentacao_id || '');
      if (!movimentacaoId) return;
      const valor = Number(rateio?.valor_rateado) || Number(rateio?.valor) || 0;
      valoresRateadosPorMovimentacao.set(
        movimentacaoId,
        (valoresRateadosPorMovimentacao.get(movimentacaoId) || 0) + valor,
      );
    });

    const movimentos = movimentacoes
      .map((movimento) => {
        const movimentacaoId = String(movimento?.id || '');
        const rateiosDoCliente = rateios.filter(
          (rateio) => String(rateio?.despesa_id || rateio?.movimentacao_id || '') === movimentacaoId && String(rateio?.cliente_id || '') === clienteId,
        );
        const valorRateado = valoresRateadosPorMovimentacao.get(movimentacaoId);
        if (valorRateado == null && rateiosDoCliente.length === 0) return movimento;
        const rateioPrincipal = rateiosDoCliente[0];
        const valorPago = rateiosDoCliente.reduce(
          (total, rateio) => total + (Number(rateio?.valor_pago_real) || 0),
          0,
        );
        return {
          ...movimento,
          clientes_id: clienteId,
          ...(valorRateado != null ? { valor_rateado: valorPago > 0 ? valorPago : valorRateado } : {}),
          ...(rateioPrincipal?.percentual_uso != null ? { percentual_uso: rateioPrincipal.percentual_uso } : {}),
          ...(rateioPrincipal?.percentual_sociedade != null ? { percentual_sociedade: rateioPrincipal.percentual_sociedade } : {}),
          ...(rateioPrincipal?.status ? { status: rateioPrincipal.status.toLowerCase() } : {}),
          ...(rateioPrincipal?.pago_por ? { pago_por: rateioPrincipal.pago_por } : {}),
          ...(rateioPrincipal?.pago_diretamente != null ? { pago_diretamente: rateioPrincipal.pago_diretamente } : {}),
          _rateiosCliente: rateiosDoCliente,
        };
      })
      .filter(
        (movimento) => String(movimento?.clientes_id || '') === clienteId && !isDga(movimento) && !['cancelado'].includes(String(movimento?.status || '').toLowerCase()),
      );
    const despesasShare = movimentos.filter(paidByShareForClient);
    const despesasDiretas = movimentos.filter((movimento) => !isEntrada(movimento) && classify(movimento).natureza === 'DESPESA_CLIENTE_PAGA_DIRETO');
    const recebimentos = movimentos.filter(isEntrada);
    const despesas = despesasShare.reduce((sum, movimento) => sum + valueOf(movimento), 0) + despesasDiretas.reduce((sum, movimento) => sum + valueOf(movimento), 0);
    const sharePagou = despesasShare.reduce((sum, movimento) => sum + valueOf(movimento), 0);
    const clientePagouDireto = despesasDiretas.reduce((sum, movimento) => sum + valueOf(movimento), 0);
    const recebidoShare = recebimentos.reduce((sum, movimento) => sum + valueOf(movimento), 0);
    const aberto = Math.max(0, sharePagou - recebidoShare);

    const map = new Map<string, {
      periodo: string;
      despesas: number;
      sharePagou: number;
      clientePagouDireto: number;
      recebidoShare: number;
      aberto: number;
    }>();

    for (const movimento of movimentos) {
      const periodo = periodOf(dateOf(movimento));
      if (!periodo) continue;
      if (!map.has(periodo)) map.set(periodo, { periodo, despesas: 0, sharePagou: 0, clientePagouDireto: 0, recebidoShare: 0, aberto: 0 });
      const row = map.get(periodo)!;
      const value = valueOf(movimento);
      row.despesas += !isEntrada(movimento) ? value : 0;
      if (paidByShareForClient(movimento)) row.sharePagou += value;
      if (!isEntrada(movimento) && classify(movimento).natureza === 'DESPESA_CLIENTE_PAGA_DIRETO') row.clientePagouDireto += value;
      if (isEntrada(movimento)) row.recebidoShare += value;
    }

    const mensal = Array.from(map.values()).sort((a, b) => a.periodo.localeCompare(b.periodo));
    let saldo = 0;
    mensal.forEach((row) => {
      saldo += row.sharePagou - row.recebidoShare;
      row.aberto = Math.max(0, saldo);
    });

    return { movimentos, mensal, resumo: { despesas, sharePagou, clientePagouDireto, recebidoShare, aberto } };
  }, [movimentacoes, rateios, clienteId]);
}
