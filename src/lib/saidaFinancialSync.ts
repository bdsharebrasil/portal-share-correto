import { supabase } from "@/integrations/supabase/client";

/**
 * Sincroniza as 4 pernas financeiras de uma origem de SAÍDA
 * (NF de Saída, Recibo de Saída, Invoice, Despesa Contas a Receber):
 *
 *   1. contas_areceber
 *   2. movimentacoes (tipo_caixa = 'share')  → receita da Share (ou 'entrada' se subcategoria C.M.A)
 *   3. movimentacoes (tipo_caixa = 'cliente') → despesa do cliente/sócio
 *   4. rateio_despesas (fluxo = 'SAIDA')
 *
 * Deve rodar UMA VEZ POR CLIENTE/SÓCIO selecionado — quem chama faz o loop.
 * Idempotente via reference_type + suffix por perna.
 *
 * IMPORTANTE: a tabela `movimentacoes` só tem a coluna `reference_type` (não tem
 * `reference_id` — ver erro PGRST204 "Could not find the 'reference_id' column").
 * Por isso, para `movimentacoes`, o `origem_id` é embutido dentro do próprio
 * `reference_type` (ex: `nf_saida:<clienteOuSocioId>:mov_cliente:<origem_id>`), em vez
 * de usar uma coluna separada. `contas_areceber` continua usando reference_type +
 * reference_id normalmente, pois essa tabela tem as duas colunas.
 */

// IDs em expense_configu — usados como categoria_id apenas na perna de DESPESA (mov_cliente)
export const EXPENSE_CATEGORIA_ADM_SHARE = "928cc6be-cb78-4b83-ac63-bd386686a8c9";        // ADM SHARE BRASIL
export const EXPENSE_CATEGORIA_ADM_E_TRIP = "c80a9fc7-e0ef-4df1-9ad5-74ffa8d4f1b0";       // ADM E TRIP SHARE BRASIL

const SUBCATEGORIA_CMA =
  "C.M.A (CERTIFICADO MÉDICO AERONAUTICO) - RENOVAÇÃO DE HABILITAÇÕES";

export type SaidaOrigem = "nf_saida" | "recibo_saida" | "invoice" | "solicitacao_areceber";

export interface SaidaLegInput {
  origem: SaidaOrigem;
  origem_id: string;             // id da NF/Recibo/etc

  // Iteração (1 cliente OU 1 sócio por chamada)
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_cnpj?: string | null;
  socio_id?: string | null;
  socio_nome?: string | null;
  /**
   * @deprecated Não é mais usado para preencher rateio_despesas.percentual_sociedade.
   * O percentual agora é sempre buscado em `cotistas_aeronave` (id_aeronave + cliente/sócio).
   * Mantido apenas para compatibilidade com chamadores existentes.
   */
  percentual_sociedade?: number | null;
  percentual_uso?: number | null;
  aeronave_id?: string | null;
  aeronave_registro?: string | null;

  // Dados financeiros
  valor: number;                 // valor total desta iteração (proporcional)
  valor_total_despesa?: number | null;
  data_competencia: string;      // YYYY-MM-DD
  data_vencimento: string;       // YYYY-MM-DD
  status?: string | null;        // 'pendente' | 'recebido' | 'pago' | 'cancelado'

  // Categoria — nome da categoria de origem (ex: "ADM SHARE - RECIBO")
  categoria_origem_label?: string | null;
  // Sub-categoria (para regra C.M.A)
  subcategoria?: string | null;

  // Documentos / anexos
  numero_doc?: string | null;    // usado em numero_doc de mov e rateio
  numero_nf?: string | null;
  numero_recibo?: string | null;
  numero_boleto?: string | null;
  nf_url?: string | null;
  recibo_url?: string | null;
  boleto_url?: string | null;
  comprovante_url?: string | null;
  demonstrativo_url?: string | null;

  descricao?: string | null;
  observacoes?: string | null;
  criado_por?: string | null;
}

/**
 * Mapeia o rótulo da categoria de origem (NF/Recibo) para o UUID em expense_configu.
 * Usado exclusivamente na perna de DESPESA (mov_cliente).
 * ADM E PILOTAGEM - N.F / ADM E PILOTAGEM - RECIBO → ADM E TRIP SHARE BRASIL
 * ADM SHARE - RECIBO / N.F ADM - Somente adm de aeronaves → ADM SHARE BRASIL
 */
export function resolveExpenseCategoriaIdFromLabel(label?: string | null): string | null {
  const s = (label || "").trim().toUpperCase();
  if (!s) return null;
  if (s.includes("ADM E PILOTAGEM")) return EXPENSE_CATEGORIA_ADM_E_TRIP;
  if (s.includes("ADM SHARE")) return EXPENSE_CATEGORIA_ADM_SHARE;
  if (s.includes("N.F ADM") || s.includes("SOMENTE ADM DE AERONAVES")) return EXPENSE_CATEGORIA_ADM_SHARE;
  return null;
}

/**
 * Resolve o categoria_id em `categorias_movimentacao` (tabela de RECEITA) a partir do
 * rótulo da categoria de origem (ex: "ADM SHARE - RECIBO", " ADM E PILOTAGEM - RECIBO").
 * Usado em `contas_areceber` e na perna de RECEITA (mov_share).
 *
 * Importante: é um UUID de uma tabela diferente de EXPENSE_CATEGORIA_* (que são de
 * `expense_configu`, tabela de DESPESA). Usar o UUID errado aqui quebra a FK
 * contas_areceber_categoria_id_fkey -> categorias_movimentacao(id) com erro 409.
 */
async function resolveCategoriaMovimentacaoId(label?: string | null): Promise<string | null> {
  const raw = label || "";
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const client = supabase as any;

  // Tenta correspondência exata primeiro (preserva espaços exatamente como estão no banco)
  const { data: exact } = await client
    .from("categorias_movimentacao")
    .select("id")
    .eq("nome", raw)
    .maybeSingle();

  if (exact?.id) return exact.id as string;

  // Fallback: compara ignorando espaços extras nas pontas e maiúsculas/minúsculas
  const { data: candidates } = await client
    .from("categorias_movimentacao")
    .select("id, nome")
    .eq("tipo", "receita");

  const match = (candidates || []).find(
    (c: any) => (c.nome || "").trim().toLowerCase() === trimmed.toLowerCase()
  );

  return match?.id ?? null;
}

/**
 * Busca o percentual de sociedade real do cliente/sócio na aeronave, em `cotistas_aeronave`.
 * Esta é a ÚNICA fonte de verdade para `rateio_despesas.percentual_sociedade` — nunca
 * deve vir de um valor digitado/calculado em outro lugar (ex: input.percentual_sociedade).
 *
 * Prioriza filtrar por `socios_id` quando disponível (mais específico); cai para
 * `id_clientes` quando só o cliente é conhecido. Sempre filtra também por `id_aeronave`,
 * já que o percentual é por aeronave.
 *
 * Lança erro se aeronave/cliente/sócio não forem informados ou se não houver registro
 * correspondente — o percentual é obrigatório e nunca deve ser silenciosamente 0.
 */
async function resolvePercentualSociedade(
  aeronave_id?: string | null,
  cliente_id?: string | null,
  socio_id?: string | null
): Promise<number> {
  if (!aeronave_id) {
    throw new Error(
      "syncSaidaFinancialLegs: aeronave_id é obrigatório para resolver percentual_sociedade em cotistas_aeronave"
    );
  }
  if (!cliente_id && !socio_id) {
    throw new Error(
      "syncSaidaFinancialLegs: cliente_id ou socio_id é obrigatório para resolver percentual_sociedade"
    );
  }

  const client = supabase as any;
  let query = client
    .from("cotistas_aeronave")
    .select("percentual_sociedade")
    .eq("id_aeronave", aeronave_id);

  if (socio_id) {
    query = query.eq("socios_id", socio_id);
  } else if (cliente_id) {
    query = query.eq("id_clientes", cliente_id);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;

  if (data?.percentual_sociedade == null) {
    throw new Error(
      `syncSaidaFinancialLegs: percentual_sociedade não encontrado em cotistas_aeronave para ` +
      `aeronave=${aeronave_id}, cliente=${cliente_id ?? "-"}, socio=${socio_id ?? "-"}`
    );
  }

  return Number(data.percentual_sociedade);
}

function isCategoriaShare(categoriaId?: string | null): boolean {
  return (
    categoriaId === EXPENSE_CATEGORIA_ADM_SHARE ||
    categoriaId === EXPENSE_CATEGORIA_ADM_E_TRIP
  );
}

function isSubcategoriaCMA(subcategoria?: string | null): boolean {
  if (!subcategoria) return false;
  return subcategoria.trim().toUpperCase() === SUBCATEGORIA_CMA.toUpperCase();
}

async function upsert(
  table: string,
  refType: string,
  refId: string,
  payload: Record<string, any>
): Promise<string | null> {
  const client = supabase as any;
  const { data: existing } = await client
    .from(table)
    .select("id")
    .eq("reference_type", refType)
    .eq("reference_id", refId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from(table)
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id as string;
  }
  const { data: inserted, error } = await client
    .from(table)
    .insert([payload])
    .select("id")
    .single();
  if (error) throw error;
  return inserted?.id ?? null;
}

/**
 * Upsert específico para `movimentacoes`. Essa tabela só tem `reference_type`
 * (não tem `reference_id` — ver PGRST204), então a idempotência é feita casando
 * SOMENTE por `reference_type`, que já deve vir com o `origem_id` embutido
 * (ex: `nf_saida:<clienteOuSocioId>:mov_cliente:<origem_id>`).
 */
async function upsertMovimentacao(
  refType: string,
  payload: Record<string, any>
): Promise<string | null> {
  const client = supabase as any;
  const { data: existing } = await client
    .from("movimentacoes")
    .select("id")
    .eq("reference_type", refType)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from("movimentacoes")
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id as string;
  }
  const { data: inserted, error } = await client
    .from("movimentacoes")
    .insert([{ ...payload, reference_type: refType }])
    .select("id")
    .single();
  if (error) throw error;
  return inserted?.id ?? null;
}

/**
 * Variante de upsert para tabelas que não têm reference_type/reference_id
 * (ex: rateio_despesas). Usa uma coluna arbitrária como chave de idempotência.
 */
async function upsertByColumn(
  table: string,
  columnName: string,
  columnValue: string,
  payload: Record<string, any>
): Promise<string | null> {
  const client = supabase as any;
  const { data: existing } = await client
    .from(table)
    .select("id")
    .eq(columnName, columnValue)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from(table)
      .update({ ...payload, atualizado_em: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id as string;
  }
  const { data: inserted, error } = await client
    .from(table)
    .insert([payload])
    .select("id")
    .single();
  if (error) throw error;
  return inserted?.id ?? null;
}

export async function syncSaidaFinancialLegs(input: SaidaLegInput) {
  const {
    origem, origem_id,
    cliente_id, socio_id,
    valor, data_competencia, data_vencimento,
    numero_doc, numero_nf, numero_recibo,
  } = input;

  if (!cliente_id && !socio_id) {
    throw new Error("syncSaidaFinancialLegs: cliente_id ou socio_id é obrigatório");
  }

  const suffixIter = socio_id || cliente_id;
  const baseRef = `${origem}:${suffixIter}`;
  const status = (input.status || "pendente").toLowerCase();

  // categoriaExpenseId: usado SOMENTE na perna de despesa (mov_cliente) — vem de expense_configu
  const categoriaExpenseId = resolveExpenseCategoriaIdFromLabel(input.categoria_origem_label);
  // categoriaMovimentacaoId: usado em contas_areceber e na perna de receita (mov_share) — vem de categorias_movimentacao
  const categoriaMovimentacaoId = await resolveCategoriaMovimentacaoId(input.categoria_origem_label);

  const tipoShare =
    isCategoriaShare(categoriaExpenseId) && !isSubcategoriaCMA(input.subcategoria)
      ? "receita"
      : isSubcategoriaCMA(input.subcategoria)
        ? "entrada"
        : "receita";

  const numeroDocFinal = numero_doc || numero_nf || numero_recibo || null;
  const descricaoBase = input.descricao || input.categoria_origem_label || `${origem} ${numeroDocFinal ?? ""}`.trim();

  // 1) contas_areceber
  const arPayload = {
    numero: numeroDocFinal,
    cliente_nome: input.cliente_nome || input.socio_nome || "",
    cliente_cnpj: input.cliente_cnpj || null,
    cliente_id: cliente_id || null,
    socio_id: socio_id || null,
    data_criacao: data_competencia,
    data_vencimento,
    valor,
    categoria: input.categoria_origem_label || null,
    categoria_id: categoriaMovimentacaoId,
    descricao: descricaoBase,
    status,
    aeronave: input.aeronave_registro || null,
    nota_fiscal_url: input.nf_url || null,
    boleto_url: input.boleto_url || null,
    arquivo_pdf_url: input.recibo_url || input.nf_url || null,
    reference_type: `${baseRef}:areceber`,
    reference_id: origem_id,
    criado_por: input.criado_por || null,
  };
  const contasAreceberId = await upsert("contas_areceber", arPayload.reference_type, origem_id, arPayload);

  // 2) movimentacao SHARE (receita/entrada) — usa categoria de categorias_movimentacao
  const movComum = {
    descricao: descricaoBase,
    valor,
    valor_original: input.valor_total_despesa ?? valor,
    data_competencia,
    data_vencimento,
    status,
    aeronave_id: input.aeronave_id || null,
    clientes_id: cliente_id || null,
    socio_id: socio_id || null,
    fornecedor_nome: input.cliente_nome || input.socio_nome || null,
    numero_nf: numero_nf || null,
    numero_recibo: numero_recibo || null,
    numero_boleto: input.numero_boleto || null,
    numero_doc: numeroDocFinal,
    nf_url: input.nf_url || null,
    recibo_url: input.recibo_url || null,
    boleto_url: input.boleto_url || null,
    comprovante_url: input.comprovante_url || null,
    observacoes: input.observacoes || null,
    contas_areceber_id: contasAreceberId,
    criado_por: input.criado_por || null,
  };

  const movShareRefType = `${baseRef}:mov_share:${origem_id}`;
  const movShareId = await upsertMovimentacao(
    movShareRefType,
    {
      ...movComum,
      tipo: tipoShare,          // 'receita' ou 'entrada' (subcat C.M.A)
      tipo_caixa: "share",
      categoria_id: categoriaMovimentacaoId,
    }
  );

  // 3) movimentacao CLIENTE (despesa) — usa categoria de expense_configu
  const movClienteRefType = `${baseRef}:mov_cliente:${origem_id}`;
  const movClienteId = await upsertMovimentacao(
    movClienteRefType,
    {
      ...movComum,
      tipo: "despesa",
      tipo_caixa: "cliente",
      categoria_id: categoriaExpenseId,
    }
  );

  // Percentual real de sociedade do cliente/sócio na aeronave — sempre buscado em
  // cotistas_aeronave, nunca aceito como valor digitado (input.percentual_sociedade é ignorado).
  const percentualSociedade = await resolvePercentualSociedade(
    input.aeronave_id,
    cliente_id,
    socio_id
  );

  // 4) rateio_despesas — esta tabela NÃO tem reference_type/reference_id,
  // então a idempotência aqui é feita pela coluna despesa_id (FK para movimentacoes.id,
  // que é o próprio movClienteId gerado no passo anterior).
  const rateioPayload = {
    despesa_id: movClienteId,
    fonte_despesa: origem,
    tipo_rateio: "FIXO",
    fluxo: "SAÍDA",
    data_emissao: data_competencia,
    data_vencimento,
    numero_boleto: input.numero_boleto || null,
    numero_nf: numero_nf || null,
    numero_doc: numeroDocFinal,
    numero_recibo: numero_recibo || null,
    fornecedor_nome: input.cliente_nome || input.socio_nome || null,
    cliente_id: cliente_id || null,
    clientes_nome: input.cliente_nome || null,
    socio_id: socio_id || null,
    socios_nome: input.socio_nome || null,
    pago_diretamente: false,
    aeronave_id: input.aeronave_id || null,
    aeronave_registro: input.aeronave_registro || null,
    percentual_sociedade: percentualSociedade,
    percentual_uso: input.percentual_uso ?? 100,
    descricao_despesa: descricaoBase,
    periodicidade: "MENSAL",
    valor_total_despesa: input.valor_total_despesa ?? valor,
    valor_rateado: valor,
    status: "pendente",
    observacoes: input.observacoes || null,
    boleto_url: input.boleto_url || null,
    nf_url: input.nf_url || null,
    recibo_url: input.recibo_url || null,
    comprovante_url: input.comprovante_url || null,
    demonstrativo_url: input.demonstrativo_url || null,
    subcategoria_1: input.subcategoria || null,
    categoria_custo: categoriaExpenseId,
  };
  const rateioId = await upsertByColumn("rateio_despesas", "despesa_id", movClienteId as string, rateioPayload);

  return { contasAreceberId, movShareId, movClienteId, rateioId };
}

/** Remove todas as pernas geradas por uma origem+iteração (cliente/sócio). */
export async function deleteSaidaFinancialLegs(
  origem: SaidaOrigem,
  origem_id: string,
  iter?: { cliente_id?: string | null; socio_id?: string | null }
) {
  const client = supabase as any;
  const suffixIter = iter?.socio_id || iter?.cliente_id;

  if (!suffixIter) {
    // remove todos os registros dessa origem (todas iterações)
    const prefix = `${origem}:`;

    // `movimentacoes` não tem reference_id — o origem_id está embutido no fim do
    // reference_type (ex: "nf_saida:<iter>:mov_cliente:<origem_id>"), então casamos
    // por padrão: começa com o prefixo da origem e termina com ":mov_cliente:<origem_id>"
    const { data: movClientes } = await client
      .from("movimentacoes")
      .select("id")
      .like("reference_type", `${prefix}%:mov_cliente:${origem_id}`);

    const despesaIds = (movClientes || []).map((m: any) => m.id);
    if (despesaIds.length > 0) {
      await client.from("rateio_despesas").delete().in("despesa_id", despesaIds);
    }

    await client.from("movimentacoes").delete().like("reference_type", `${prefix}%:mov_cliente:${origem_id}`);
    await client.from("movimentacoes").delete().like("reference_type", `${prefix}%:mov_share:${origem_id}`);
    // contas_areceber tem reference_id de verdade, então continua filtrando por ele
    await client.from("contas_areceber").delete().eq("reference_id", origem_id).like("reference_type", `${prefix}%`);
    return;
  }

  const baseRef = `${origem}:${suffixIter}`;
  const movClienteRefType = `${baseRef}:mov_cliente:${origem_id}`;
  const movShareRefType = `${baseRef}:mov_share:${origem_id}`;

  // Acha o mov_cliente desta iteração para remover o rateio vinculado por despesa_id
  const { data: movCliente } = await client
    .from("movimentacoes")
    .select("id")
    .eq("reference_type", movClienteRefType)
    .maybeSingle();

  if (movCliente?.id) {
    await client.from("rateio_despesas").delete().eq("despesa_id", movCliente.id);
  }

  await client.from("movimentacoes").delete().eq("reference_type", movClienteRefType);
  await client.from("movimentacoes").delete().eq("reference_type", movShareRefType);
  await client.from("contas_areceber").delete().eq("reference_type", `${baseRef}:areceber`).eq("reference_id", origem_id);
}