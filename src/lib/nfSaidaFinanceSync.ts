import { supabase } from "@/integrations/supabase/client";
import { syncClientExpenseMirror, deleteClientExpenseMirror } from "@/lib/clientExpenseMirrorSync";

export interface NFSaidaSyncInput {
  nfId: string;
  numero: string;
  cliente_nome: string;
  cliente_cnpj?: string | null;
  cliente_id?: string | null;
  aeronave_id?: string | null;
  categoria_id?: string | null;
  valor: number;
  descricao?: string | null;
  data_criacao: string;
  data_vencimento: string;
  status: string; // pendente | recebido | cancelado
  nf_url?: string | null;
  criado_por?: string | null;
}

const REF_TYPE = "nf_saida";

/**
 * Sincroniza uma NF de Saída com `movimentacoes` (receita) e `contas_areceber`
 * usando reference_type/reference_id para idempotência.
 */
export async function syncNFSaidaFinance(input: NFSaidaSyncInput) {
  const statusMov = input.status === "recebido" ? "pago" : input.status === "cancelado" ? "cancelado" : "pendente";

  const movPayload: any = {
    descricao: `NF ${input.numero} - ${input.cliente_nome}${input.descricao ? ` - ${input.descricao}` : ""}`,
    tipo: "receita",
    categoria_id: input.categoria_id || null,
    valor: input.valor,
    data_competencia: input.data_criacao,
    data_vencimento: input.data_vencimento,
    data_pagamento: input.status === "recebido" ? new Date().toISOString().split("T")[0] : null,
    status: statusMov,
    aeronave_id: input.aeronave_id || null,
    clientes_id: input.cliente_id || null,
    numero_nf: input.numero,
    nf_url: input.nf_url || null,
    fornecedor_nome: input.cliente_nome,
    reference_type: REF_TYPE,
    reference_id: input.nfId,
    criado_por: input.criado_por || null,
  };

  // Upsert movimentacao
  const { data: existingMov } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("reference_type", REF_TYPE)
    .eq("reference_id", input.nfId)
    .maybeSingle();

  let movimentacaoId: string | null = existingMov?.id || null;

  if (movimentacaoId) {
    const { error } = await supabase
      .from("movimentacoes")
      .update({ ...movPayload, atualizado_em: new Date().toISOString() })
      .eq("id", movimentacaoId);
    if (error) throw error;
  } else {
    const { data: inserted, error } = await supabase
      .from("movimentacoes")
      .insert([movPayload])
      .select("id")
      .single();
    if (error) throw error;
    movimentacaoId = inserted?.id || null;
  }

  // Upsert contas_areceber (espelho de cobrança)
  const arPayload: any = {
    numero: input.numero,
    cliente_nome: input.cliente_nome,
    cliente_cnpj: input.cliente_cnpj || "",
    cliente_id: input.cliente_id || null,
    data_criacao: input.data_criacao,
    data_vencimento: input.data_vencimento,
    valor: input.valor,
    categoria: "NF de Saída",
    categoria_id: input.categoria_id || null,
    descricao: input.descricao || null,
    status: input.status,
    nota_fiscal_url: input.nf_url || null,
    nf_saida_id: input.nfId,
    movimentacao_id: movimentacaoId,
    reference_type: REF_TYPE,
    reference_id: input.nfId,
    criado_por: input.criado_por || null,
  };

  const { data: existingAR } = await supabase
    .from("contas_areceber")
    .select("id")
    .eq("reference_type", REF_TYPE)
    .eq("reference_id", input.nfId)
    .maybeSingle();

  if (existingAR?.id) {
    const { error } = await supabase
      .from("contas_areceber")
      .update({ ...arPayload, atualizado_em: new Date().toISOString() })
      .eq("id", existingAR.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("contas_areceber").insert([arPayload]);
    if (error) throw error;
  }

  return { movimentacaoId };
}

export async function deleteNFSaidaFinanceMirror(nfId: string) {
  await supabase
    .from("contas_areceber")
    .delete()
    .eq("reference_type", REF_TYPE)
    .eq("reference_id", nfId);
  await supabase
    .from("movimentacoes")
    .delete()
    .eq("reference_type", REF_TYPE)
    .eq("reference_id", nfId);
}
