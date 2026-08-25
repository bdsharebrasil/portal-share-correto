// @ts-nocheck — colunas legadas fora dos types gerados
import { supabase } from "@/integrations/supabase/client";

export interface QuitarReembolsoInput {
  movId: string;
  valorRecebido: number;
  valorEsperado: number;
  data: string; // yyyy-mm-dd
  pagador: string;
  banco?: string | null;
  comprovante?: string | null;
  observacoes?: string | null;
}

/**
 * Dá baixa no reembolso do cliente propagando o recebimento para TODAS as pernas
 * financeiras criadas pela solicitação (saidaFinancialSync):
 *  - movimentacoes (perna SHARE / entrada)   → reembolsado
 *  - contas_areceber                          → recebido
 *  - movimentacoes (perna CLIENTE / despesa)  → pago
 *  - rateio_despesas (despesa_id = mov cliente) → reembolsado
 */
export async function quitarReembolsoLegs(input: QuitarReembolsoInput) {
  const { movId, valorRecebido, valorEsperado, data, pagador } = input;
  const client = supabase as any;
  const quitado = valorRecebido + 0.01 >= valorEsperado;
  const agora = new Date().toISOString();

  const { data: mov, error: movErr } = await client
    .from("movimentacoes")
    .select("id, reference_type, reference_id, contas_areceber_id, tipo_caixa, valor_rateado, valor_total")
    .eq("id", movId)
    .maybeSingle();
  if (movErr) throw movErr;

  // 1) perna SHARE
  const patchShare: Record<string, any> = {
    reembolso_quitado: quitado,
    status: quitado ? "reembolsado" : "reembolso parcial",
    fluxo: "entrada",
    data_pagamento: data,
    pago_por: pagador,
    valor_pago_real: valorRecebido,
    atualizado_em: agora,
  };
  if (input.banco) patchShare.conta_bancaria = input.banco;
  if (input.comprovante) patchShare.comprovante_url = input.comprovante;
  if (input.observacoes) patchShare.observacoes = input.observacoes;

  const { error: e1 } = await client.from("movimentacoes").update(patchShare).eq("id", movId);
  if (e1) throw e1;

  // 2) contas a receber
  const carId = mov?.contas_areceber_id || null;
  if (carId) {
    const { error: carError } = await client
      .from("contas_areceber")
      .update({
        status: quitado ? "recebido" : "parcial",
        data_pagamento: data,
        data_recebimento: data,
        conta_bancaria_recebimento: input.banco || null,
        comprovante_recebimento_url: input.comprovante || null,
        ...(input.comprovante ? { comprovante_url: input.comprovante } : {}),
      })
      .eq("id", carId);
    if (carError) throw carError;
  }

  // 3) perna CLIENTE (mesma origem, sufixo :mov_cliente)
  const movClienteIds = new Set<string>();
  const refType: string | null = mov?.reference_type || null;
  if (refType && mov?.reference_id && refType.endsWith(":mov_share")) {
    const clienteRef = refType.replace(/:mov_share$/, ":mov_cliente");
    const { data: movCli } = await client
      .from("movimentacoes")
      .select("id")
      .eq("reference_type", clienteRef)
      .eq("reference_id", mov.reference_id);
    (movCli || []).forEach((r: any) => movClienteIds.add(r.id));
  }
  if (carId) {
    const { data: movsCar } = await client
      .from("movimentacoes")
      .select("id")
      .eq("contas_areceber_id", carId)
      .eq("tipo_caixa", "cliente");
    (movsCar || []).forEach((r: any) => movClienteIds.add(r.id));
  }

  const ids = Array.from(movClienteIds);
  if (ids.length > 0) {
    const { error: clienteError } = await client
      .from("movimentacoes")
      .update({
        status: quitado ? "pago" : "parcial",
        reembolso_quitado: quitado,
        data_pagamento: data,
        pago_por: pagador,
        valor_pago_real: valorRecebido,
        atualizado_em: agora,
      })
      .in("id", ids);
    if (clienteError) throw clienteError;

    // 4) rateio_despesas vinculados por despesa_id
    const { error: rateioError } = await client
      .from("rateio_despesas")
      .update({
        status: quitado ? "reembolsado" : "parcial",
        data_pagamento: data,
        pago_por: pagador,
        valor_pago_real: valorRecebido,
        atualizado_em: agora,
      })
      .in("despesa_id", ids);
    if (rateioError) throw rateioError;
  }

  // fallback: rateio ligado diretamente à própria movimentação
  const { error: fallbackRateioError } = await client
    .from("rateio_despesas")
    .update({
      status: quitado ? "reembolsado" : "parcial",
      data_pagamento: data,
      pago_por: pagador,
      valor_pago_real: valorRecebido,
      atualizado_em: agora,
    })
    .eq("despesa_id", movId);
  if (fallbackRateioError) throw fallbackRateioError;

  return { quitado, patch: patchShare, movClienteIds: ids, contasAreceberId: carId };
}
