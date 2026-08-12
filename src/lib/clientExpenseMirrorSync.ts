import { supabase } from "@/integrations/supabase/client";

/**
 * Espelho de despesa do CLIENTE/AERONAVE para receitas emitidas pela Share Brasil.
 *
 * Quando uma NF de Saída, Recibo ou Invoice é gerada para um cotista, o valor é
 * receita para a Share, mas também é uma despesa fixa (ADM SHARE BRASIL) para o
 * cliente/aeronave. Este helper cria essa "segunda perna" em movimentacoes,
 * vinculada à mesma origem via movimentacao_origem_id, mas com reference_type sufixado
 * com `_espelho` para diferenciar e garantir idempotência.
 */

export type MirrorOrigin = "nf_saida" | "recibo" | "invoice";

export interface ClientExpenseMirrorInput {
  origin: MirrorOrigin;
  originId: string;
  cliente_id: string;
  aeronave_id: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  numero_doc?: string | null;
  descricao_origem?: string | null;
  status_origem?: string | null;
  nf_url?: string | null;
  boleto_url?: string | null;
  criado_por?: string | null;
}

const CATEGORIA_NOME = "ADM SHARE BRASIL";

async function getAdmShareCategoriaId(): Promise<string | null> {
  const { data } = await supabase
    .from("categorias_movimentacao")
    .select("id")
    .ilike("nome", CATEGORIA_NOME)
    .eq("tipo", "despesa")
    .maybeSingle();
  return data?.id ?? null;
}

function mapStatus(s?: string | null): string {
  if (!s) return "pago";
  if (s === "recebido" || s === "pago") return "pago";
  if (s === "cancelado") return "cancelado";
  return "pendente";
}

/**
 * Cria/atualiza a movimentação-espelho de despesa do cliente.
 * Só executa quando cliente_id E aeronave_id estão preenchidos.
 * Idempotente via (reference_type, movimentacao_origem_id).
 */
export async function syncClientExpenseMirror(input: ClientExpenseMirrorInput) {
  if (!input.cliente_id || !input.aeronave_id) {
    return { skipped: true as const };
  }

  const refType = `${input.origin}_espelho`;
  const categoriaId = await getAdmShareCategoriaId();
  const status = mapStatus(input.status_origem);

  const descricaoBase =
    input.origin === "nf_saida"
      ? `NF ${input.numero_doc ?? ""}`
      : input.origin === "recibo"
      ? `Recibo ${input.numero_doc ?? ""}`
      : `Invoice ${input.numero_doc ?? ""}`;

  const payload: any = {
    descricao: `[ADM SHARE] ${descricaoBase.trim()}${
      input.descricao_origem ? ` - ${input.descricao_origem}` : ""
    }`,
    fluxo: "despesa",
    categoria_id: categoriaId,
    valor_rateado: input.valor,
    valor_total: input.valor,
    data_emissao: input.data_emissao,
    data_vencimento: input.data_vencimento,
    data_pagamento: status === "pago" ? input.data_emissao : null,
    status,
    aeronave_id: input.aeronave_id,
    clientes_id: input.cliente_id,
    fornecedor_nome: "Share Brasil",
    numero_nf:
      input.origin === "nf_saida" || input.origin === "invoice"
        ? input.numero_doc ?? null
        : null,
    numero_recibo: input.origin === "recibo" ? input.numero_doc ?? null : null,
    nf_url: input.nf_url ?? null,
    boleto_url: input.boleto_url ?? null,
    reference_type: refType,
    movimentacao_origem_id: input.originId,
    criado_por: input.criado_por ?? null,
  };

  const { data: existing } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("reference_type", refType)
    .eq("movimentacao_origem_id", input.originId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("movimentacoes")
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return { id: existing.id, updated: true as const };
  }

  const { data: inserted, error } = await supabase
    .from("movimentacoes")
    .insert([payload])
    .select("id")
    .single();
  if (error) throw error;
  return { id: inserted?.id ?? null, created: true as const };
}

/** Remove a despesa-espelho associada a uma origem. */
export async function deleteClientExpenseMirror(origin: MirrorOrigin, originId: string) {
  await supabase
    .from("movimentacoes")
    .delete()
    .eq("reference_type", `${origin}_espelho`)
    .eq("movimentacao_origem_id", originId);
}
