// @ts-nocheck — colunas legadas fora dos types gerados
import { supabase } from "@/integrations/supabase/client";
import { FinanceCategoryId, FinanceCategoryLabel, FinanceGroupName } from "@/lib/financeConstants";

export interface BaixaReceitaInput {
  movId?: string | null;
  contasAreceberId?: string | null;
  data: string; // yyyy-mm-dd
  valorRecebido?: number | null;
  banco?: string | null;
  bancoId?: string | null;
  comprovante?: string | null;
  pagador?: string | null;
  formaPagamento?: string | null;
  isReembolso?: boolean;
}

/**
 * Baixa de uma ENTRADA/RECEITA do caixa Share (reembolso OU receita direta do
 * cliente) propagando para todas as tabelas envolvidas:
 *  - movimentacoes (perna SHARE)     → recebido / reembolsado + banco
 *  - contas_areceber                 → recebido + banco_recebimento
 *  - movimentacoes (perna CLIENTE)   → pago + banco
 *  - rateio_despesas vinculados      → pago / reembolsado
 */
export async function baixarReceitaShare(input: BaixaReceitaInput) {
  const client = supabase as any;
  const {
    data,
    valorRecebido = null,
    banco = null,
    bancoId = null,
    comprovante = null,
    pagador = null,
    formaPagamento = null,
    isReembolso = false,
  } = input;
  const agora = new Date().toISOString();

  let movId = input.movId || null;
  let carId = input.contasAreceberId || null;
  let mov: any = null;
  let shareMovId: string | null = null;
  let clientMovId: string | null = null;

  if (movId) {
    const { data: row } = await client
      .from("movimentacoes")
      .select("id, reference_type, reference_id, contas_areceber_id, tipo_caixa")
      .eq("id", movId)
      .maybeSingle();
    mov = row;
    carId = carId || row?.contas_areceber_id || null;

    if (row) {
      const refType = row.reference_type || "";
      if (refType.endsWith(":mov_share") || row.tipo_caixa === "share") {
        shareMovId = movId;
      } else if (refType.endsWith(":mov_cliente") || row.tipo_caixa === "cliente") {
        clientMovId = movId;
        if (refType && row.reference_id) {
          const shareRef = refType.replace(/:mov_cliente$/, ":mov_share");
          const { data: movShare } = await client
            .from("movimentacoes")
            .select("id")
            .eq("reference_type", shareRef)
            .eq("reference_id", row.reference_id)
            .maybeSingle();
          shareMovId = movShare?.id ?? null;
        }
      }
    }
  }

  if (!shareMovId && carId) {
    const { data: movsShare } = await client
      .from("movimentacoes")
      .select("id, reference_type, reference_id, contas_areceber_id, tipo_caixa")
      .eq("contas_areceber_id", carId)
      .eq("tipo_caixa", "share");
    const shareRow = (movsShare || [])[0] ?? null;
    shareMovId = shareRow?.id ?? null;
    if (!mov && shareRow) mov = shareRow;
  }

  // A baixa iniciada pelo caixa do cliente precisa preservar a própria perna
  // como alvo da sincronização. Antes este id era identificado, mas nunca era
  // incluído no conjunto atualizado quando o vínculo pelo contas_areceber_id
  // não estava disponível em registros antigos.
  const clienteIds = new Set<string>();
  if (clientMovId) clienteIds.add(clientMovId);

  // 1) perna SHARE
  const patchShare: Record<string, any> = {
    status: isReembolso ? "reembolsado" : "recebido",
    data_pagamento: data,
    atualizado_em: agora,
  };
  if (isReembolso) {
    patchShare.fluxo = "entrada";
    patchShare.categoria_id = FinanceCategoryId.TRAVEL_REPORT_REIMBURSEMENT;
    patchShare.categoria_nome = FinanceCategoryLabel.TRAVEL_REPORT_RECEIVED;
    patchShare.grupo_categoria = FinanceGroupName.REIMBURSEMENT_INCOME;
  }
  if (isReembolso) patchShare.reembolso_quitado = true;
  if (banco) patchShare.conta_bancaria = banco;
  if (bancoId) patchShare.conta_bancaria = bancoId;
  if (comprovante) patchShare.comprovante_url = comprovante;
  if (pagador) patchShare.pago_por = pagador;
  if (formaPagamento) patchShare.forma_pagamento = formaPagamento;
  if (valorRecebido != null) patchShare.valor_pago_real = valorRecebido;

  if (shareMovId) {
    const { error } = await client.from("movimentacoes").update(patchShare).eq("id", shareMovId);
    if (error) throw error;
  }

  // 2) contas a receber
  if (carId) {
    const { error } = await client
      .from("contas_areceber")
      .update({
        status: "recebido",
        data_pagamento: data,
        data_recebimento: data,
        banco_recebimento: banco || null,
        metodo_pagamento: formaPagamento || null,
        ...(comprovante
          ? { comprovante_recebimento_url: comprovante, comprovante_url: comprovante }
          : {}),
        atualizado_em: agora,
      })
      .eq("id", carId);
    if (error) throw error;

    if (!movId) {
      const { data: movsShare } = await client
        .from("movimentacoes")
        .select("id")
        .eq("contas_areceber_id", carId)
        .eq("tipo_caixa", "share");
      const first = (movsShare || [])[0];
      if (first?.id) {
        movId = first.id;
        const { error } = await client.from("movimentacoes").update(patchShare).eq("id", first.id);
        if (error) throw error;
      }
    }
  }

  // 3) perna CLIENTE (espelho da despesa no caixa do cliente)
  const refType: string | null = mov?.reference_type || null;
  if (refType && mov?.reference_id && refType.endsWith(":mov_share")) {
    const clienteRef = refType.replace(/:mov_share$/, ":mov_cliente");
    const { data: movCli } = await client
      .from("movimentacoes")
      .select("id")
      .eq("reference_type", clienteRef)
      .eq("reference_id", mov.reference_id);
    (movCli || []).forEach((r: any) => clienteIds.add(r.id));
  }
  if (carId) {
    const { data: movsCar } = await client
      .from("movimentacoes")
      .select("id")
      .eq("contas_areceber_id", carId)
      .eq("tipo_caixa", "cliente");
    (movsCar || []).forEach((r: any) => clienteIds.add(r.id));
  }

  const ids = Array.from(clienteIds);
  if (ids.length > 0) {
    const { error } = await client
      .from("movimentacoes")
      .update({
        status: "pago",
        data_pagamento: data,
        ...(banco ? { conta_bancaria: banco } : {}),
        ...(bancoId ? { conta_bancaria: bancoId } : {}),
        ...(pagador ? { pago_por: pagador } : {}),
        ...(valorRecebido != null ? { valor_pago_real: valorRecebido } : {}),
        atualizado_em: agora,
      })
      .in("id", ids);
    if (error) throw error;
  }

  // 4) rateio_despesas ligados às pernas (cliente e share)
  const rateioIds = movId ? [...ids, movId] : ids;
  if (rateioIds.length > 0) {
    const { error } = await client
      .from("rateio_despesas")
      .update({
        status: isReembolso ? "reembolsado" : "pago",
        data_pagamento: data,
        ...(pagador ? { pago_por: pagador } : {}),
        ...(valorRecebido != null ? { valor_pago_real: valorRecebido } : {}),
        ...(comprovante ? { comprovante_url: comprovante } : {}),
        atualizado_em: agora,
      })
      .in("despesa_id", rateioIds);
    if (error) throw error;
  }

  return { movId, shareMovId, contasAreceberId: carId, movClienteIds: ids, patch: patchShare };
}
