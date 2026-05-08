/**
 * Sincronização do módulo Financeiro Cotista (rateio de despesas) com a
 * tabela centralizada `movimentacoes` e seus espelhos.
 *
 * Tipos de referência:
 *   - 'rateio_despesa'    → movimentação principal (despesa) com cliente_id/aeronave_id
 *   - 'rateio_reembolso'  → espelho de receita (reembolso devido pelos sócios)
 *                           gerado quando o pagador é a EMPRESA (Share)
 */
import { supabase } from "@/integrations/supabase/client";

export type CotistaPagador = "EMPRESA" | "CLIENTE" | string; // string = socio_id

export interface CotistaSyncInput {
  movId: string;
  clienteId: string;
  clienteNome: string | null;
  aeronaveId: string | null;
  pagador: CotistaPagador;
  valorTotal: number;
  data: string;
  status: "pago" | "pendente";
  descricao: string;
  criadoPor?: string | null;
}

/**
 * Garante (ou cria) a categoria "REEMBOLSO RATEIO COTISTA" em
 * categorias_movimentacao (tipo: receita).
 */
async function ensureCategoriaReembolso(criadoPor?: string | null): Promise<string | null> {
  try {
    const nome = "REEMBOLSO RATEIO COTISTA";
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
        tipo: "receita",
        grupo_categoria: "REEMBOLSOS",
        ativo: true,
        criado_por: criadoPor ?? "00000000-0000-0000-0000-000000000000",
      })
      .select("id")
      .single();
    if (error) throw error;
    return created?.id ?? null;
  } catch (e) {
    console.error("ensureCategoriaReembolso falhou:", e);
    return null;
  }
}

/**
 * Cria/atualiza o espelho de reembolso (receita pendente) em `movimentacoes`
 * quando a EMPRESA paga uma despesa de cotista.
 * Idempotente via reference_type='rateio_reembolso' + reference_id=movId.
 */
export async function syncCotistaReembolsoMirror(input: CotistaSyncInput): Promise<string | null> {
  // Só faz sentido espelhar reembolso quando a empresa pagou (ou pagará)
  if (input.pagador !== "EMPRESA") {
    await deleteCotistaReembolsoMirror(input.movId);
    return null;
  }

  const categoriaId = await ensureCategoriaReembolso(input.criadoPor);

  const payload: any = {
    descricao: `Reembolso rateio: ${input.descricao}`,
    tipo: "receita",
    categoria_id: categoriaId,
    valor: input.valorTotal,
    data_competencia: input.data,
    data_vencimento: input.data,
    data_pagamento: null,
    status: "pendente",
    clientes_id: input.clienteId,
    aeronave_id: input.aeronaveId,
    fornecedor_nome: input.clienteNome || "Cotistas",
    observacoes: `Espelho automático de rateio (movimentação ${input.movId})`,
    reembolsavel: false,
    pago_diretamente: false,
    reference_type: "rateio_reembolso",
    reference_id: input.movId,
    criado_por: input.criadoPor || null,
  };

  const { data: existing } = await supabase
    .from("movimentacoes")
    .select("id")
    .eq("reference_type", "rateio_reembolso")
    .eq("reference_id", input.movId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("movimentacoes")
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) console.warn("syncCotistaReembolsoMirror update falhou:", error.message);
    return existing.id;
  }

  const { data: ins, error } = await supabase
    .from("movimentacoes")
    .insert([payload])
    .select("id")
    .single();
  if (error) {
    console.warn("syncCotistaReembolsoMirror insert falhou:", error.message);
    return null;
  }
  return ins?.id || null;
}

export async function deleteCotistaReembolsoMirror(movId: string): Promise<void> {
  const { error } = await supabase
    .from("movimentacoes")
    .delete()
    .eq("reference_type", "rateio_reembolso")
    .eq("reference_id", movId);
  if (error) console.warn("deleteCotistaReembolsoMirror falhou:", error.message);
}
