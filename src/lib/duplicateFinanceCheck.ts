import { supabase } from "@/integrations/supabase/client";

export type OrigemDuplicata = "movimentacoes" | "contas_apagar" | "agendamento_pagamentos";

export interface PossivelDuplicata {
  id: string;
  origem: OrigemDuplicata;
  origemLabel: string;
  descricao: string;
  fornecedor: string | null;
  documento: string | null;
  valor: number;
  data: string | null;
  status: string | null;
  motivos: string[];
  raw: any;
}

export interface CriteriosDuplicata {
  valor: number;
  documento?: string | null;
  data?: string | null;
  fornecedor?: string | null;
  clienteId?: string | null;
  socioId?: string | null;
  categoriaNome?: string | null;
  ignorarId?: string | null;
}

const norm = (v?: string | null) =>
  (v ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();

const diasEntre = (a?: string | null, b?: string | null) => {
  if (!a || !b) return Infinity;
  const da = new Date(`${String(a).slice(0, 10)}T00:00:00`).getTime();
  const db = new Date(`${String(b).slice(0, 10)}T00:00:00`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return Infinity;
  return Math.abs(da - db) / 86400000;
};

const mesmoValor = (a: number, b: number) => Math.abs(Number(a || 0) - Number(b || 0)) < 0.01;

/**
 * Procura lançamentos parecidos (mesmo valor + coincidência de documento/NF,
 * data, fornecedor ou cliente) em movimentações, contas a pagar e agendamentos
 * de pagamento, para evitar duplicidade de lançamento.
 */
export async function buscarPossiveisDuplicatas(
  criterios: CriteriosDuplicata,
): Promise<PossivelDuplicata[]> {
  const valor = Number(criterios.valor || 0);
  if (!valor || valor <= 0) return [];

  const docAlvo = norm(criterios.documento);
  const fornAlvo = norm(criterios.fornecedor);
  const min = valor - 0.01;
  const max = valor + 0.01;

  const avaliar = (
    origem: OrigemDuplicata,
    origemLabel: string,
    row: any,
    campos: {
      valor: number;
      documento?: string | null;
      data?: string | null;
      fornecedor?: string | null;
      clienteId?: string | null;
      socioId?: string | null;
      categoriaNome?: string | null;
      descricao?: string | null;
      status?: string | null;
    },
  ): PossivelDuplicata | null => {
    if (criterios.ignorarId && String(row.id) === String(criterios.ignorarId)) return null;
    if (!mesmoValor(valor, campos.valor)) return null;

    const motivos: string[] = ["Mesmo valor"];
    const doc = norm(campos.documento);
    if (docAlvo && doc && doc === docAlvo) motivos.push("Mesmo nº de documento/NF");
    const dias = diasEntre(criterios.data, campos.data);
    if (dias === 0) motivos.push("Mesma data");
    else if (dias <= 3) motivos.push(`Data próxima (${dias} dia(s))`);
    const forn = norm(campos.fornecedor);
    if (fornAlvo && forn && (forn === fornAlvo || forn.includes(fornAlvo) || fornAlvo.includes(forn)))
      motivos.push("Mesmo fornecedor");
    if (criterios.clienteId && campos.clienteId && String(campos.clienteId) === String(criterios.clienteId))
      motivos.push("Mesmo cliente");
    if (criterios.socioId && campos.socioId && String(campos.socioId) === String(criterios.socioId))
      motivos.push("Mesmo sócio");
    if (criterios.categoriaNome && campos.categoriaNome && norm(campos.categoriaNome) === norm(criterios.categoriaNome))
      motivos.push("Mesma categoria");

    // Valor sozinho não caracteriza duplicidade.
    if (motivos.length < 2) return null;

    // Se o valor é o mesmo mas o cliente/sócio/categoria é diferente, não é duplicidade (ex: 2 clientes pagando a mesma cota)
    if (criterios.clienteId && campos.clienteId && String(campos.clienteId) !== String(criterios.clienteId)) return null;
    if (criterios.socioId && campos.socioId && String(campos.socioId) !== String(criterios.socioId)) return null;
    if (criterios.categoriaNome && campos.categoriaNome && norm(campos.categoriaNome) !== norm(criterios.categoriaNome)) return null;

    return {
      id: String(row.id),
      origem,
      origemLabel,
      descricao: campos.descricao || "Sem descrição",
      fornecedor: campos.fornecedor || null,
      documento: campos.documento || null,
      valor: Number(campos.valor || 0),
      data: campos.data || null,
      status: campos.status || null,
      motivos,
      raw: row,
    };
  };

  const [movs, contas, agendas] = await Promise.all([
    (supabase as any)
      .from("movimentacoes")
      .select(
        "id, descricao, fornecedor_nome, numero_doc, valor_total, valor_rateado, data_emissao, data_vencimento, data_pagamento, status, clientes_id, socio_id, categoria_nome, tipo_caixa",
      )
      .or(
        `and(valor_total.gte.${min},valor_total.lte.${max}),and(valor_rateado.gte.${min},valor_rateado.lte.${max})`,
      )
      .neq("status", "cancelado")
      .order("data_emissao", { ascending: false })
      .limit(400),
    (supabase as any)
      .from("contas_apagar")
      .select(
        "id, descricao, fornecedor_nome, numero_doc, nf_numero, valor, data_vencimento, data_pagamento, status, cliente_id",
      )
      .gte("valor", min)
      .lte("valor", max)
      .limit(200),
    (supabase as any)
      .from("agendamento_pagamentos")
      .select("id, descricao, fornecedor, valor, data_agendamento, status, categoria")
      .gte("valor", min)
      .lte("valor", max)
      .limit(200),
  ]);

  const encontrados: PossivelDuplicata[] = [];

  for (const m of movs?.data ?? []) {
    const item = avaliar("movimentacoes", "Lançamento no caixa", m, {
      valor: Number(m.valor_total ?? m.valor_rateado ?? 0),
      documento: m.numero_doc,
      data: m.data_emissao || m.data_vencimento || m.data_pagamento,
      fornecedor: m.fornecedor_nome,
      clienteId: m.clientes_id,
      socioId: m.socio_id,
      categoriaNome: m.categoria_nome,
      descricao: m.descricao,
      status: m.status,
    });
    if (item) encontrados.push(item);
  }

  for (const c of contas?.data ?? []) {
    const item = avaliar("contas_apagar", "Conta a pagar", c, {
      valor: Number(c.valor || 0),
      documento: c.numero_doc || c.nf_numero,
      data: c.data_vencimento || c.data_pagamento,
      fornecedor: c.fornecedor_nome,
      clienteId: c.cliente_id,
      descricao: c.descricao,
      status: c.status,
    });
    if (item) encontrados.push(item);
  }

  for (const a of agendas?.data ?? []) {
    const item = avaliar("agendamento_pagamentos", "Agendamento de pagamento", a, {
      valor: Number(a.valor || 0),
      documento: null,
      data: a.data_agendamento,
      fornecedor: a.fornecedor,
      descricao: a.descricao,
      status: a.status,
    });
    if (item) encontrados.push(item);
  }

  return encontrados
    .sort((x, y) => y.motivos.length - x.motivos.length)
    .slice(0, 10);
}