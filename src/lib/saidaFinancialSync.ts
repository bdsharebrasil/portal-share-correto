import { supabase } from "@/integrations/supabase/client";

/**
 * Sincroniza as 4 pernas financeiras de uma origem de SAÍDA
 * (NF de Saída, Recibo de Saída, Invoice, Despesa Contas a Receber). Ordem de criação:
 *
 *   1. movimentacoes (tipo_caixa = 'share')  → receita da Share (ou 'entrada' se subcategoria C.M.A)
 *   2. contas_areceber → ancorado em movimentacao_id = id da movimentação share acima
 *   3. movimentacoes (tipo_caixa = 'cliente') → despesa do cliente/sócio, já com contas_areceber_id
 *   4. rateio_despesas (fluxo = 'SAIDA')
 *
 * Deve rodar UMA VEZ POR CLIENTE/SÓCIO selecionado — quem chama faz o loop.
 * Idempotente via reference_type + reference_id (em TODAS as tabelas, incluindo movimentacoes).
 *
 * IMPORTANTE (correção): `movimentacoes.movimentacao_origem_id` é uma FK estrita para
 * `movimentacoes.id` (auto-referência) e possui índice ÚNICO — não serve como campo livre
 * de rastreabilidade para uma origem externa (NF/Recibo/Invoice/UUID gerado no cliente).
 * Usar esse campo para isso causa:
 *   (a) erro 23503 (FK violation) quando o valor não corresponde a um id real já existente
 *       em movimentacoes, e
 *   (b) erro 23505 (unique violation) quando duas linhas (mov_share e mov_cliente) tentam
 *       usar o mesmo valor.
 * `movimentacoes.reference_id` (text, sem FK, sem unique) é a coluna correta para isso —
 * mesmo padrão já usado em contas_areceber via upsert().
 *
 * IMPORTANTE (correção 2): cada recibo/NF já é lançado com seu PRÓPRIO `numero` distinto por
 * cotista — `numero` NUNCA deve ser usado como chave de idempotência/identificação de
 * `contas_areceber`. A chave correta para localizar/ajustar "a mesma despesa de lançamento" é o
 * vínculo real com a movimentação: `contas_areceber.movimentacao_id` ⇄ `movimentacoes.contas_areceber_id`.
 * Por isso a ordem de criação mudou: primeiro a movimentação SHARE (receita) é criada/localizada
 * (ela já é idempotente via reference_type+reference_id), e só então `contas_areceber` é
 * localizado/criado usando `movimentacao_id = movShareId` como âncora (`upsertContasAReceberByMovimentacao`
 * abaixo) — com fallback por reference_type+reference_id apenas para linhas antigas que ainda não
 * tinham `movimentacao_id` preenchido. Depois disso, a movimentação SHARE é atualizada com o
 * `contas_areceber_id` resultante, fechando o vínculo nos dois sentidos.
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
  data_emissao: string;      // YYYY-MM-DD
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
    .insert([{ ...payload, reference_type: refType, reference_id: refId }])
    .select("id")
    .single();
  if (error) throw error;
  return inserted?.id ?? null;
}

/**
 * Upsert específico para `contas_areceber`, ancorado em `movimentacao_id`.
 *
 * CORREÇÃO: a identificação de "é a mesma despesa de lançamento?" deve vir do vínculo real
 * com a movimentação (`movimentacao_id`), NUNCA do `numero` — cada recibo/NF já tem seu
 * próprio número distinto por cotista, então usar `numero` para achar/deduplicar linhas
 * estava simplesmente errado.
 *
 * Lookup em duas etapas:
 *   1) por `movimentacao_id` (fonte de verdade a partir de agora — sempre que a movimentação
 *      SHARE já existir, é isso que identifica a linha certa de contas_areceber a atualizar);
 *   2) fallback por `reference_type + reference_id`, só para compatibilidade com linhas criadas
 *      antes desta correção (que ainda não têm `movimentacao_id` preenchido).
 *
 * Se nenhuma das duas encontrar nada, cria uma linha nova.
 */
async function upsertContasAReceberByMovimentacao(
  movimentacaoId: string,
  refType: string,
  refId: string,
  payload: Record<string, any>
): Promise<string | null> {
  const client = supabase as any;

  let existingId: string | null = null;

  const { data: byMovimentacao } = await client
    .from("contas_areceber")
    .select("id")
    .eq("movimentacao_id", movimentacaoId)
    .maybeSingle();
  if (byMovimentacao?.id) existingId = byMovimentacao.id as string;

  if (!existingId) {
    const { data: byReference } = await client
      .from("contas_areceber")
      .select("id")
      .eq("reference_type", refType)
      .eq("reference_id", refId)
      .maybeSingle();
    if (byReference?.id) existingId = byReference.id as string;
  }

  if (existingId) {
    const { error } = await client
      .from("contas_areceber")
      .update({
        ...payload,
        movimentacao_id: movimentacaoId,
        reference_type: refType,
        reference_id: refId,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", existingId);
    if (error) throw error;
    return existingId;
  }

  const { data: inserted, error } = await client
    .from("contas_areceber")
    .insert([{ ...payload, movimentacao_id: movimentacaoId, reference_type: refType, reference_id: refId }])
    .select("id")
    .single();
  if (error) throw error;
  return inserted?.id ?? null;
}

/** Grava o vínculo de volta em `movimentacoes.contas_areceber_id` após o contas_areceber existir. */
async function linkMovimentacaoAoContasAReceber(
  movimentacaoId: string,
  contasAreceberId: string
): Promise<void> {
  const client = supabase as any;
  const { error } = await client
    .from("movimentacoes")
    .update({ contas_areceber_id: contasAreceberId, atualizado_em: new Date().toISOString() })
    .eq("id", movimentacaoId);
  if (error) throw error;
}

/**
 * Upsert específico para `movimentacoes`.
 *
 * CORREÇÃO: usa `reference_id` (text, sem FK, sem índice único) para rastreabilidade/
 * idempotência — igual ao helper `upsert()` acima usa para as demais tabelas.
 *
 * Antes, esta função gravava o `origemId` em `movimentacao_origem_id`, mas essa coluna
 * é uma FK estrita para `movimentacoes.id` (exige que o valor já exista como id de outra
 * movimentação) e tem índice ÚNICO (só uma linha em toda a tabela pode ter um dado valor).
 * Como `origemId` normalmente é o id de uma NF/Recibo/Invoice (de outra tabela) ou um UUID
 * gerado no cliente, ele nunca corresponde a um id real de `movimentacoes` — daí o erro
 * 23503 "violates foreign key constraint mov_origem_fkey". E mesmo corrigindo isso, usar o
 * mesmo valor para mov_share e mov_cliente quebraria em seguida com 23505 (unique violation).
 */
async function upsertMovimentacao(
  refType: string,
  origemId: string,
  payload: Record<string, any>
): Promise<string | null> {
  const client = supabase as any;
  const { data: existing } = await client
    .from("movimentacoes")
    .select("id")
    .eq("reference_type", refType)
    .eq("reference_id", origemId)
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
    .insert([{ ...payload, reference_type: refType, reference_id: origemId }])
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
    valor, data_emissao, data_vencimento,
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

  // Campos comuns às duas movimentações. `contas_areceber_id` ainda não existe neste ponto
  // (só é conhecido depois do passo 2), então entra depois via spread em cada leg específica.
  const movComum = {
    descricao: descricaoBase,
    valor_rateado: valor,
    valor_total: input.valor_total_despesa ?? valor,
    valor_original: input.valor_total_despesa ?? valor,
    data_emissao,
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
    criado_por: input.criado_por || null,
  };

  // 1) movimentacao SHARE (receita/entrada) — criada ANTES do contas_areceber, pois é ela
  // que serve de âncora (movimentacao_id) para localizar/criar a linha certa de contas_areceber.
  const movShareRefType = `${baseRef}:mov_share`;
  const movShareId = await upsertMovimentacao(
    movShareRefType,
    origem_id,
    {
      ...movComum,
      fluxo: tipoShare,        // 'receita' ou 'entrada' (subcat C.M.A)
      tipo_caixa: "share",
      categoria_id: categoriaMovimentacaoId,
    }
  );

  // 2) contas_areceber — upsert ancorado em movimentacao_id = movShareId (não em `numero`).
  const arPayload = {
    numero: numeroDocFinal,
    cliente_nome: input.cliente_nome || input.socio_nome || "",
    cliente_cnpj: input.cliente_cnpj || null,
    cliente_id: cliente_id || null,
    socio_id: socio_id || null,
    data_criacao: data_emissao,
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
    criado_por: input.criado_por || null,
  };
  const contasAreceberId = await upsertContasAReceberByMovimentacao(
    movShareId as string,
    `${baseRef}:areceber`,
    origem_id,
    arPayload
  );

  // 2b) fecha o vínculo nos dois sentidos: grava contas_areceber_id na movimentacao SHARE.
  await linkMovimentacaoAoContasAReceber(movShareId as string, contasAreceberId as string);

  // 3) movimentacao CLIENTE (despesa) — usa categoria de expense_configu; já sai criada com
  // o contas_areceber_id correto, pois o passo 2 já rodou.
  const movClienteRefType = `${baseRef}:mov_cliente`;
  const movClienteId = await upsertMovimentacao(
    movClienteRefType,
    origem_id,
    {
      ...movComum,
      fluxo: "despesa",
      tipo_caixa: "cliente",
      categoria_id: categoriaExpenseId,
      contas_areceber_id: contasAreceberId,
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
    data_emissao: data_emissao,
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
    valor_total: input.valor_total_despesa ?? valor,
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

    const { data: movClientes } = await client
      .from("movimentacoes")
      .select("id")
      .like("reference_type", `${prefix}%:mov_cliente`)
      .eq("reference_id", origem_id);

    const despesaIds = (movClientes || []).map((m: any) => m.id);
    if (despesaIds.length > 0) {
      await client.from("rateio_despesas").delete().in("despesa_id", despesaIds);
    }

    await client.from("movimentacoes").delete().like("reference_type", `${prefix}%:mov_cliente`).eq("reference_id", origem_id);
    await client.from("movimentacoes").delete().like("reference_type", `${prefix}%:mov_share`).eq("reference_id", origem_id);

    // contas_areceber tem reference_id de verdade, então continua filtrando por ele
    await client.from("contas_areceber").delete().eq("reference_id", origem_id).like("reference_type", `${prefix}%`);
    return;
  }

  const baseRef = `${origem}:${suffixIter}`;
  const movClienteRefType = `${baseRef}:mov_cliente`;
  const movShareRefType = `${baseRef}:mov_share`;

  // Acha o mov_cliente desta iteração para remover o rateio vinculado por despesa_id
  const { data: movCliente } = await client
    .from("movimentacoes")
    .select("id")
    .eq("reference_type", movClienteRefType)
    .eq("reference_id", origem_id)
    .maybeSingle();

  if (movCliente?.id) {
    await client.from("rateio_despesas").delete().eq("despesa_id", movCliente.id);
  }

  await client.from("movimentacoes").delete().eq("reference_type", movClienteRefType).eq("reference_id", origem_id);
  await client.from("movimentacoes").delete().eq("reference_type", movShareRefType).eq("reference_id", origem_id);
  await client.from("contas_areceber").delete().eq("reference_type", `${baseRef}:areceber`).eq("reference_id", origem_id);
}
