/**
 * Sincroniza lançamentos do módulo de Sócios (FinanceiroSocios / Cotistas)
 * com a tabela centralizada `movimentacoes` usando
 * reference_type/reference_id para idempotência.
 *
 * Tipos de referência usados:
 *  - 'partner_deposit'        → depósito de sócio (receita)
 *  - 'partner_bank_interest'  → rendimento bancário (receita)
 *  - 'partner_payment'        → pagamento de despesa via saldo do sócio (despesa)
 *  - 'partner_expense'        → despesa do sócio (despesa)
 *  - 'partner_fuel'           → abastecimento do cliente/sócio (despesa)
 */
import { supabase } from "@/integrations/supabase/client";
import { FinanceCategoryName, FinanceMovementGroup } from "@/lib/financeConstants";

export type PartnerRefType =
  | "partner_deposit"
  | "partner_bank_interest"
  | "partner_payment"
  | "partner_expense"
  | "partner_fuel";

async function ensureCategoriaMovimentacao(
  nome: string,
  tipo: "receita" | "despesa",
  grupo: "FIXO" | "VARIAVEL" | "EXTRA" = "VARIAVEL",
  userId?: string | null
): Promise<string | null> {
  try {
    const { data: existing } = await (supabase as any)
      .from("categorias_movimentacao")
      .select("id")
      .eq("nome", nome)
      .maybeSingle();
    if (existing?.id) return existing.id;

    const { data: created, error } = await (supabase as any)
      .from("categorias_movimentacao")
      .insert({
        nome,
        tipo,
        grupo_categoria: grupo,
        ativo: true,
        criado_por: userId ?? "00000000-0000-0000-0000-000000000000",
      })
      .select("id")
      .single();
    if (error) throw error;
    return created?.id ?? null;
  } catch (e) {
    console.error("ensureCategoriaMovimentacao(partner) falhou:", e);
    return null;
  }
}

export interface PartnerSyncInput {
  refType: PartnerRefType;
  refId: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  data_competencia: string; // YYYY-MM-DD
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  status?: "pendente" | "pago" | "cancelado";
  clientes_id?: string | null;
  socio_id?: string | null;
  aeronave_id?: string | null;
  conta_bancaria?: string | null;
  forma_pagamento?: string | null;
  fornecedor_nome?: string | null;
  numero_doc?: string | null;
  numero_nf?: string | null;
  numero_boleto?: string | null;
  comprovante_url?: string | null;
  nf_url?: string | null;
  boleto_url?: string | null;
  observacoes?: string | null;
  reembolsavel?: boolean;
  pago_diretamente?: boolean;
  categoria_nome?: string;
  criado_por?: string | null;
}

/**
 * Upsert de uma movimentacao espelhada a partir de um lançamento de sócio.
 * Idempotente via (reference_type, reference_id).
 */
export async function syncPartnerToMovimentacoes(input: PartnerSyncInput): Promise<string | null> {
  const categoriaNome =
    input.categoria_nome ||
    (input.refType === "partner_deposit"
      ? FinanceCategoryName.PARTNER_DEPOSIT
      : input.refType === "partner_bank_interest"
        ? FinanceCategoryName.PARTNER_INTEREST
        : input.refType === "partner_payment"
          ? FinanceCategoryName.PARTNER_PAYMENT
          : input.refType === "partner_fuel"
            ? FinanceCategoryName.PARTNER_FUEL
            : "Despesa de Sócio");

  const categoriaId = await ensureCategoriaMovimentacao(
    categoriaNome,
    input.tipo,
    FinanceMovementGroup.VARIAVEL,
    input.criado_por
  );

  const status =
    input.status ||
    (input.tipo === "receita" ? "pago" : input.data_pagamento ? "pago" : "pendente");

  const payload: any = {
    descricao: input.descricao,
    tipo: input.tipo,
    categoria_id: categoriaId,
    valor_rateado: input.valor,
    data_competencia: input.data_competencia,
    data_vencimento: input.data_vencimento || input.data_competencia,
    data_pagamento: input.data_pagamento || (status === "pago" ? input.data_competencia : null),
    status,
    clientes_id: input.clientes_id || null,
    socio_id: input.socio_id || null,
    aeronave_id: input.aeronave_id || null,
    conta_bancaria: input.conta_bancaria || null,
    forma_pagamento: input.forma_pagamento || null,
    fornecedor_nome: input.fornecedor_nome || null,
    numero_doc: input.numero_doc || null,
    numero_nf: input.numero_nf || null,
    numero_boleto: input.numero_boleto || null,
    comprovante_url: input.comprovante_url || null,
    nf_url: input.nf_url || null,
    boleto_url: input.boleto_url || null,
    observacoes: input.observacoes || null,
    reembolsavel: input.reembolsavel ?? false,
    pago_diretamente: input.pago_diretamente ?? false,
    reference_type: input.refType,
    reference_id: input.refId,
    criado_por: input.criado_por || null,
  };

  const { data: existing } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("reference_type", input.refType)
    .eq("reference_id", input.refId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("movimentacoes")
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      console.warn("syncPartnerToMovimentacoes update falhou:", error.message);
      return existing.id;
    }
    return existing.id;
  }

  const { data: inserted, error } = await supabase
    .from("movimentacoes")
    .insert([payload])
    .select("id")
    .single();
  if (error) {
    console.warn("syncPartnerToMovimentacoes insert falhou:", error.message);
    return null;
  }
  return inserted?.id || null;
}

/**
 * Remove o espelho em `movimentacoes` para um dado lançamento de sócio.
 */
export async function deletePartnerMovimentacaoMirror(
  refType: PartnerRefType,
  refId: string
): Promise<void> {
  const { error } = await supabase
    .from("movimentacoes")
    .delete()
    .eq("reference_type", refType)
    .eq("reference_id", refId);
  if (error) console.warn("deletePartnerMovimentacaoMirror falhou:", error.message);
}
