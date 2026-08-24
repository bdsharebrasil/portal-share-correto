export const CLIENTE_DGA_ID = "738850b2-d19c-496b-b2d3-35ecc64bd862";[span_0](start_span)[span_0](end_span)

export type CaixaTipo = "share" | "cliente" | "dga";[span_1](start_span)[span_1](end_span)
export type NaturezaFinanceira =
  | "ENTRADA"
  | "DESPESA_SHARE"
  | "DESPESA_CLIENTE_PAGA_SHARE"
  | "DESPESA_CLIENTE_PAGA_DIRETO"
  | "DESPESA_DGA_PAGA_BANCO"
  | "DESPESA_DGA_PAGA_COTISTA"
  | "OUTRA_SAIDA";[span_2](start_span)[span_2](end_span)

export const norm = (v?: string | null) =>
  (v ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();[span_3](start_span)[span_3](end_span)

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};[span_4](start_span)[span_4](end_span)

export const isEntrada = (m: any) => {
  const f = norm(m?.fluxo);
  return ["entrada", "estorno", "receita", "credito", "deposito", "recebido"].includes(f);
};[span_5](start_span)[span_5](end_span)

export const isDga = (m: any) => {
  const tipoCaixa = norm(m?.tipo_caixa);
  return tipoCaixa === "dga" || (tipoCaixa === "cliente" && String(m?.clientes_id || "") === CLIENTE_DGA_ID);
};[span_6](start_span)[span_6](end_span)

export const isCancelado = (m: any) => norm(m?.status) === "cancelado";[span_7](start_span)[span_7](end_span)

export const paidByClientDirect = (m: any) => {
  if (isDga(m)) return false;
  const payer = norm(m?.pago_por);
  return Boolean(m?.pago_diretamente) || payer === "cliente" || payer === "cotista_cliente";
};[span_8](start_span)[span_8](end_span)

export const paidByShareForClient = (m: any) => {
  if (isDga(m) || isEntrada(m) || !m?.clientes_id) return false;
  if (paidByClientDirect(m)) return false;
  const payer = norm(m?.pago_por);
  const referenceType = norm(m?.reference_type);
  const grupo = norm(m?.grupo_categoria);
  const isTravelExpensePayable = referenceType === "travel_expense_report";
  return payer === "share" || payer === "share brasil" || Boolean(m?.reembolsavel) ||
    norm(m?.status) === "aguardando_reembolso" || isTravelExpensePayable || grupo.includes("reembolsav");
};[span_9](start_span)[span_9](end_span)

// tipo_caixa='share' não basta: uma despesa DESPESAS REEMBOLSÁVEIS também sai do
// caixa Share no momento do lançamento (regra de negócio, seção 3.1.1), mas é do
// cliente por natureza — não pode contar como despesa pura da Share.
export const isShare = (m: any) => !isDga(m) && norm(m?.tipo_caixa) === "share" && !paidByShareForClient(m);[span_10](start_span)[span_10](end_span)
export const isCliente = (m: any) => !isDga(m) && norm(m?.tipo_caixa) === "cliente";[span_11](start_span)[span_11](end_span)


export const isDgaCotistaOutOfPocket = (m: any) => {
  if (!isDga(m) || isEntrada(m)) return false;
  const payer = norm(m?.pago_por);
  return Boolean(m?.pago_diretamente && m?.socio_id) || payer === "cotista" || payer === "socio" || payer === "cotista_direto";
};[span_12](start_span)[span_12](end_span)

export const isDgaPaidByBank = (m: any) => isDga(m) && !isEntrada(m) && !isDgaCotistaOutOfPocket(m);[span_13](start_span)[span_13](end_span)

export const valueOf = (m: any) => num(m?.valor_rateado) || num(m?.valor_pago_real) || num(m?.valor_total) || num(m?.valor);[span_14](start_span)[span_14](end_span)
export const paidValueOf = (m: any) => num(m?.valor_pago_real) || valueOf(m);[span_15](start_span)[span_15](end_span)

export const dateOf = (m: any) => m?.data_pagamento || m?.data_emissao || m?.data_vencimento || null;[span_16](start_span)[span_16](end_span)
export const periodOf = (date?: string | null) => (date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0,7) : null);[span_17](start_span)[span_17](end_span)

export function classify(m: any): { caixa: CaixaTipo; natureza: NaturezaFinanceira } {
  if (isDga(m)) {
    if (isEntrada(m)) return { caixa: "dga", natureza: "ENTRADA" };
    if (isDgaCotistaOutOfPocket(m)) return { caixa: "dga", natureza: "DESPESA_DGA_PAGA_COTISTA" };
    return { caixa: "dga", natureza: "DESPESA_DGA_PAGA_BANCO" };
  }
  if (isEntrada(m)) return { caixa: norm(m?.tipo_caixa) === "share" ? "share" : "cliente", natureza: "ENTRADA" };
  if (isShare(m)) return { caixa: "share", natureza: "DESPESA_SHARE" };
  if (paidByShareForClient(m)) return { caixa: "cliente", natureza: "DESPESA_CLIENTE_PAGA_SHARE" };
  if (paidByClientDirect(m)) return { caixa: "cliente", natureza: "DESPESA_CLIENTE_PAGA_DIRETO" };
  return { caixa: "cliente", natureza: "OUTRA_SAIDA" };
}[span_18](start_span)[span_18](end_span)

export function fornecedorStatus(m: any) {
  const s = norm(m?.status);
  if (["cancelado", "rejeitado"].includes(s)) return "cancelado";
  if (s === "aguardando_reembolso") return "Reembolso pendente";
  if (m?.data_pagamento || ["pago","quitado","confirmado","reembolsado","recebido"].includes(s)) return "pago";
  if (m?.data_vencimento && m.data_vencimento < new Date().toISOString().slice(0,10)) return "vencido";
  return "pendente";
}[span_19](start_span)[span_19](end_span)

export function clienteDividaLabel(m: any) {
  const c = classify(m);
  if (c.natureza === "DESPESA_CLIENTE_PAGA_SHARE") return "Deve à Share";
  if (c.natureza === "DESPESA_CLIENTE_PAGA_DIRETO") return "Pago pelo cliente";
  return "—";
}[span_20](start_span)[span_20](end_span)

export function dgaPayerLabel(m: any) {
  if (isDgaCotistaOutOfPocket(m)) return "Cotista";
  if (isDgaPaidByBank(m)) return "Banco DGA";
  return "—";
}[span_21](start_span)[span_21](end_span)
