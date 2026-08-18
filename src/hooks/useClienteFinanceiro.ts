import { useMemo } from "react";
import { classify, dateOf, isDga, isEntrada, num, periodOf, paidByShareForClient, valueOf } from "@/utils/financeiroRules";

export function useClienteFinanceiro(movimentacoes: any[], clienteId: string | null) {
  return useMemo(() => {
    if (!clienteId) return { movimentos: [], mensal: [], resumo: { despesas:0, sharePagou:0, clientePagouDireto:0, recebidoShare:0, aberto:0 } };
    const movimentos = movimentacoes.filter(m => String(m?.clientes_id || "") === clienteId && !isDga(m) && !['cancelado'].includes(String(m?.status || '').toLowerCase()));
    const despesasShare = movimentos.filter(paidByShareForClient);
    const despesasDiretas = movimentos.filter(m => !isEntrada(m) && classify(m).natureza === "DESPESA_CLIENTE_PAGA_DIRETO");
    const recebimentos = movimentos.filter(m => isEntrada(m));
    const despesas = despesasShare.reduce((s,m)=>s+valueOf(m),0) + despesasDiretas.reduce((s,m)=>s+valueOf(m),0);
    const sharePagou = despesasShare.reduce((s,m)=>s+valueOf(m),0);
    const clientePagouDireto = despesasDiretas.reduce((s,m)=>s+valueOf(m),0);
    const recebidoShare = recebimentos.reduce((s,m)=>s+valueOf(m),0);
    const aberto = Math.max(0, sharePagou - recebidoShare);

    const map = new Map<string, any>();
    for (const m of movimentos) {
      const p = periodOf(dateOf(m));
      if (!p) continue;
      if (!map.has(p)) map.set(p, { periodo:p, despesas:0, sharePagou:0, clientePagouDireto:0, recebidoShare:0, aberto:0 });
      const row = map.get(p);
      const value = valueOf(m);
      row.despesas += !isEntrada(m) ? value : 0;
      if (paidByShareForClient(m)) row.sharePagou += value;
      if (!isEntrada(m) && classify(m).natureza === "DESPESA_CLIENTE_PAGA_DIRETO") row.clientePagouDireto += value;
      if (isEntrada(m)) row.recebidoShare += value;
    }
    const mensal = Array.from(map.values()).sort((a,b)=>a.periodo.localeCompare(b.periodo));
    let saldo = 0;
    mensal.forEach(row => { saldo += row.sharePagou - row.recebidoShare; row.aberto = Math.max(0,saldo); });
    return { movimentos, mensal, resumo: { despesas, sharePagou, clientePagouDireto, recebidoShare, aberto } };
  }, [movimentacoes, clienteId]);
}
