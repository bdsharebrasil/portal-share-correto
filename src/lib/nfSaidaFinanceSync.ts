import { supabase } from "@/integrations/supabase/client";
import { syncSaidaFinancialLegs, deleteSaidaFinancialLegs } from "@/lib/saidaFinancialSync";

export interface NFSaidaSyncInput {
  nfId: string;
  numero: string;
  cliente_nome: string;
  cliente_cnpj?: string | null;
  cliente_id?: string | null;
  aeronave_id?: string | null;
  aeronave_registro?: string | null;
  categoria_id?: string | null;
  categoria_label?: string | null;
  subcategoria?: string | null;
  valor: number;
  descricao?: string | null;
  data_criacao: string;
  data_vencimento: string;
  status: string; // pendente | recebido | cancelado
  nf_url?: string | null;
  criado_por?: string | null;
}

/**
 * Sincroniza uma NF de Saída gerando as 4 pernas financeiras:
 *   contas_areceber, movimentacao SHARE (tipo=receita), movimentacao CLIENTE (tipo=despesa),
 *   rateio_despesas (fluxo=SAIDA).
 * Uma NF de Saída tem um único cliente, então é uma iteração só.
 */
export async function syncNFSaidaFinance(input: NFSaidaSyncInput) {
  if (!input.cliente_id) {
    // Sem cliente vinculado não conseguimos criar as pernas de rateio/AR
    return { skipped: true as const };
  }
  return await syncSaidaFinancialLegs({
    origem: "nf_saida",
    origem_id: input.nfId,
    cliente_id: input.cliente_id,
    cliente_nome: input.cliente_nome,
    cliente_cnpj: input.cliente_cnpj,
    aeronave_id: input.aeronave_id,
    aeronave_registro: input.aeronave_registro,
    valor: input.valor,
    valor_total_despesa: input.valor,
    data_competencia: input.data_criacao,
    data_vencimento: input.data_vencimento,
    status: input.status,
    categoria_origem_label: input.categoria_label || null,
    subcategoria: input.subcategoria || null,
    numero_doc: input.numero,
    numero_nf: input.numero,
    nf_url: input.nf_url,
    descricao: input.descricao,
    criado_por: input.criado_por,
  });
}

export async function deleteNFSaidaFinanceMirror(nfId: string) {
  await deleteSaidaFinancialLegs("nf_saida", nfId);
}
