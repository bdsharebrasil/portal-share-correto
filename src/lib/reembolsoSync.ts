// @ts-nocheck — colunas legadas fora dos types gerados
import { supabase } from "@/integrations/supabase/client";

export interface QuitarReembolsoInput {
  movId: string;
  movIds?: string[];
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
  const movIds = Array.from(new Set((input.movIds && input.movIds.length ? input.movIds : [input.movId]).filter(Boolean)));
  if (movIds.length === 0) {
    throw new Error("Nenhuma pendência de reembolso para quitar.");
  }

  const primaryId = movIds[0];
  const allInputs = { ...input, movIds, movId: primaryId };
  return quitarReembolsosLegs(allInputs as QuitarReembolsoInput & { movIds: string[] });
}

export async function quitarReembolsosLegs(input: QuitarReembolsoInput & { movIds: string[] }) {
  const { movIds, valorRecebido, valorEsperado, data, pagador } = input;
  const client = supabase as any;
  const totalEsperado = Number(valorEsperado) || 0;
  const totalRecebido = Number(valorRecebido) || 0;
  const quitado = totalEsperado > 0 ? totalRecebido + 0.01 >= totalEsperado : totalRecebido > 0;
  const agora = new Date().toISOString();
  const ids = Array.from(new Set(movIds.filter(Boolean)));

  if (ids.length === 0) {
    throw new Error("Nenhuma pendência de reembolso para quitar.");
  }

  const { data: movs, error: movErr } = await client
    .from("movimentacoes")
    .select("id, reference_type, reference_id, contas_areceber_id, tipo_caixa, valor_rateado, valor_total")
    .in("id", ids)
    .order("data_vencimento", { ascending: true });
  if (movErr) throw movErr;

  const movClienteIds = new Set<string>();
  const contasAreceberIds = new Set<string>();

  for (const mov of movs || []) {
    const patchShare: Record<string, any> = {
      reembolso_quitado: quitado,
      status: quitado ? "reembolsado" : "reembolso parcial",
      fluxo: "entrada",
      data_pagamento: data,
      pago_por: pagador,
      valor_pago_real: Number(mov.valor_rateado ?? mov.valor_total ?? 0),
      atualizado_em: agora,
    };
    if (input.banco) patchShare.conta_bancaria = input.banco;
    if (input.comprovante) patchShare.comprovante_url = input.comprovante;
    if (input.observacoes) patchShare.observacoes = input.observacoes;

    const { error: e1 } = await client.from("movimentacoes").update(patchShare).eq("id", mov.id);
    if (e1) throw e1;

    if (mov.contas_areceber_id) {
      contasAreceberIds.add(mov.contas_areceber_id);
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
        .eq("id", mov.contas_areceber_id);
      if (carError) throw carError;
    }

    const refType: string | null = mov.reference_type || null;
    if (refType && mov.reference_id) {
      if (refType.endsWith(":mov_share")) {
        const clienteRef = refType.replace(/:mov_share$/, ":mov_cliente");
        const { data: movCli } = await client
          .from("movimentacoes")
          .select("id")
          .eq("reference_type", clienteRef)
          .eq("reference_id", mov.reference_id);
        (movCli || []).forEach((r: any) => movClienteIds.add(r.id));
      }
      if (refType === "reembolso_share") {
        const { data: movCli } = await client
          .from("movimentacoes")
          .select("id")
          .eq("contas_areceber_id", mov.contas_areceber_id)
          .eq("tipo_caixa", "cliente");
        (movCli || []).forEach((r: any) => movClienteIds.add(r.id));
      }
    }

    if (mov.contas_areceber_id) {
      const { data: movsCar } = await client
        .from("movimentacoes")
        .select("id")
        .eq("contas_areceber_id", mov.contas_areceber_id)
        .eq("tipo_caixa", "cliente");
      (movsCar || []).forEach((r: any) => movClienteIds.add(r.id));
    }
  }

  const movClienteArray = Array.from(movClienteIds);
  if (movClienteArray.length > 0) {
    const { error: clienteError } = await client
      .from("movimentacoes")
      .update({
        status: quitado ? "pago" : "parcial",
        reembolso_quitado: quitado,
        data_pagamento: data,
        pago_por: pagador,
        valor_pago_real: totalRecebido || null,
        atualizado_em: agora,
      })
      .in("id", movClienteArray);
    if (clienteError) throw clienteError;

    const { error: rateioError } = await client
      .from("rateio_despesas")
      .update({
        status: quitado ? "reembolsado" : "parcial",
        data_pagamento: data,
        pago_por: pagador,
        valor_pago_real: totalRecebido || null,
        atualizado_em: agora,
      })
      .in("despesa_id", movClienteArray);
    if (rateioError) throw rateioError;
  }

  const rateioFallbackIds = Array.from(new Set([...ids, ...Array.from(movClienteIds)]));
  const { error: fallbackRateioError } = await client
    .from("rateio_despesas")
    .update({
      status: quitado ? "reembolsado" : "parcial",
      data_pagamento: data,
      pago_por: pagador,
      valor_pago_real: totalRecebido || null,
      atualizado_em: agora,
    })
    .in("despesa_id", rateioFallbackIds);
  if (fallbackRateioError) throw fallbackRateioError;

  return {
    quitado,
    patch: {
      reembolso_quitado: quitado,
      status: quitado ? "reembolsado" : "reembolso parcial",
      data_pagamento: data,
      pago_por: pagador,
      valor_pago_real: totalRecebido,
    },
    movClienteIds: movClienteArray,
    contasAreceberIds: Array.from(contasAreceberIds),
  };
}
