// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export interface QuitarReembolsoInput {
  sourceMovId: string;
  movIds: string[];
  rateioIds: string[];
  valorRecebido: number;
  valorEsperado: number;
  data: string;
  pagador: string;
  banco?: string | null;
  comprovante?: string | null;
  observacoes?: string | null;
}

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export async function quitarReembolsoLegs(input: QuitarReembolsoInput) {
  const client = supabase as any;
  const movIds = Array.from(new Set((input.movIds || []).filter(Boolean)));
  const rateioIds = Array.from(new Set((input.rateioIds || []).filter(Boolean)));
  const recebido = Number(input.valorRecebido || 0);
  const esperado = Number(input.valorEsperado || 0);

  if (!input.sourceMovId) throw new Error("Despesa Share não informada.");
  if (!movIds.length) throw new Error("Nenhuma conta de reembolso selecionada.");
  if (!rateioIds.length) throw new Error("Nenhum item do rateio selecionado.");
  if (recebido <= 0) throw new Error("Informe o valor efetivamente recebido.");
  if (Math.abs(recebido - esperado) > 0.01) {
    throw new Error(`O valor recebido (${recebido.toFixed(2)}) precisa ser igual ao total selecionado (${esperado.toFixed(2)}).`);
  }

  const now = new Date().toISOString();

  const { data: source, error: sourceError } = await client
    .from("movimentacoes")
    .select("id, valor_total, reembolsavel, reembolso_quitado, status, data_pagamento")
    .eq("id", input.sourceMovId)
    .single();
  if (sourceError) throw sourceError;

  if (!source.data_pagamento) {
    throw new Error("A despesa ainda não foi baixada pela Share.");
  }

  const { data: movements, error: movementsError } = await client
    .from("movimentacoes")
    .select("id, contas_areceber_id, clientes_id, valor_rateado, valor_total")
    .in("id", movIds);
  if (movementsError) throw movementsError;

  if ((movements || []).length !== movIds.length) {
    throw new Error("Uma ou mais movimentações de reembolso não foram encontradas.");
  }

  for (const mov of movements || []) {
    const valorMov = Number(mov.valor_rateado ?? mov.valor_total ?? 0);
    const { error } = await client
      .from("movimentacoes")
      .update({
        status: "recebido",
        fluxo: "entrada",
        tipo_caixa: "share",
        reembolso_quitado: true,
        data_pagamento: input.data,
        conta_bancaria: input.banco || null,
        comprovante_url: input.comprovante || null,
        pago_por: input.pagador,
        valor_pago_real: valorMov,
        observacoes: input.observacoes || null,
        atualizado_em: now,
      })
      .eq("id", mov.id);
    if (error) throw error;

    if (mov.contas_areceber_id) {
      const { error: arError } = await client
        .from("contas_areceber")
        .update({
          status: "recebido",
          data_pagamento: input.data,
          data_recebimento: input.data,
          banco_recebimento: input.banco || null,
          conta_bancaria_recebimento: input.banco || null,
          comprovante_recebimento_url: input.comprovante || null,
        })
        .eq("id", mov.contas_areceber_id);
      if (arError) throw arError;
    }
  }

  const { data: rateios, error: rateioError } = await client
    .from("rateio_despesas")
    .select("id, cliente_id, clientes_nome, socio_id, socios_nome, valor_rateado, valor_pago_real, status")
    .eq("despesa_id", input.sourceMovId)
    .order("id");
  if (rateioError) throw rateioError;

  if (!rateios?.length) throw new Error("Não existe rateio para esta despesa.");

  const selectedMovClientIds = new Set((movements || []).map((m: any) => m.clientes_id).filter(Boolean));
  const payerNorm = normalize(input.pagador);
  let payerRateio = (rateios || []).find((r: any) =>
    normalize(r.clientes_nome) === payerNorm || normalize(r.socios_nome) === payerNorm,
  );

  if (!payerRateio) {
    payerRateio = (rateios || []).find((r: any) => rateioIds.includes(r.id));
  }
  if (!payerRateio) throw new Error("O pagador informado não pertence ao rateio desta despesa.");

  const selectedRateios = (rateios || []).filter((r: any) => rateioIds.includes(r.id));
  const totalDespesa = (rateios || []).reduce((sum: number, r: any) => sum + Number(r.valor_rateado || 0), 0);
  const totalSelecionado = selectedRateios.reduce((sum: number, r: any) => sum + Number(r.valor_rateado || 0), 0);
  const quitouTudo = Math.abs(recebido - totalDespesa) <= 0.01;
  const cobreSelecionado = Math.abs(recebido - totalSelecionado) <= 0.01;

  if (!cobreSelecionado && !quitouTudo) {
    throw new Error("O valor recebido precisa corresponder ao total das pendências selecionadas.");
  }

  for (const rateio of rateios || []) {
    const selected = rateioIds.includes(rateio.id);
    if (!selected) continue;

    const isPayer = rateio.id === payerRateio.id;
    const valorReal = isPayer ? recebido : 0;

    const { error: updateRateioError } = await client
      .from("rateio_despesas")
      .update({
        pago_por: input.pagador,
        valor_pago_real: valorReal,
        status: "PAGO",
        pago_diretamente: true,
        data_pagamento: input.data,
        comprovante_url: input.comprovante || null,
        atualizado_em: now,
      })
      .eq("id", rateio.id);
    if (updateRateioError) throw updateRateioError;
  }

  // Quando um único cotista paga tudo, as demais cotas ficam zeradas, mas vinculadas
  // ao mesmo pagador. Isso permite calcular posteriormente "quem deve a quem".
  if (quitouTudo) {
    for (const rateio of rateios || []) {
      if (rateioIds.includes(rateio.id)) continue;
      const { error } = await client
        .from("rateio_despesas")
        .update({
          pago_por: input.pagador,
          valor_pago_real: 0,
          status: "PAGO",
          pago_diretamente: true,
          data_pagamento: input.data,
          comprovante_url: input.comprovante || null,
          atualizado_em: now,
        })
        .eq("id", rateio.id);
      if (error) throw error;
    }
  }

  const { error: sourceUpdateError } = await client
    .from("movimentacoes")
    .update({
      reembolso_quitado: quitouTudo,
      status: quitouTudo ? "reembolsado" : "aguardando_reembolso",
      atualizado_em: now,
    })
    .eq("id", source.id);
  if (sourceUpdateError) throw sourceUpdateError;

  return {
    quitado: quitouTudo,
    patch: {
      reembolso_quitado: quitouTudo,
      status: quitouTudo ? "reembolsado" : "aguardando_reembolso",
      data_pagamento: input.data,
      pago_por: input.pagador,
      valor_pago_real: recebido,
    },
  };
}
