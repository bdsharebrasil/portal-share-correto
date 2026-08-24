export const CLIENTE_DGA_ID = "738850b2-d19c-496b-b2d3-35ecc64bd862";

export type CaixaTipo = "share" | "cliente" | "dga";
export type NaturezaFinanceira =
  | "ENTRADA"
  | "DESPESA_SHARE"
  | "DESPESA_CLIENTE_PAGA_SHARE"
  | "DESPESA_CLIENTE_PAGA_DIRETO"
  | "DESPESA_DGA_PAGA_BANCO"
  | "DESPESA_DGA_PAGA_COTISTA"
  | "OUTRA_SAIDA";

export const norm = (v?: string | null) =>
  (v ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const isEntrada = (m: any) => {
  const f = norm(m?.fluxo);
  return ["entrada", "estorno", "receita", "credito", "deposito", "recebido"].includes(f);
};

export const isDga = (m: any) => {
  const tipoCaixa = norm(m?.tipo_caixa);
  return tipoCaixa === "dga" || (tipoCaixa === "cliente" && String(m?.clientes_id || "") === CLIENTE_DGA_ID);
};

export const isCancelado = (m: any) => norm(m?.status) === "cancelado";

export const paidByClientDirect = (m: any) => {
  if (isDga(m)) return false;
  const payer = norm(m?.pago_por);
  return Boolean(m?.pago_diretamente) || payer === "cliente" || payer === "cotista_cliente";
};

export const paidByShareForClient = (m: any) => {
  if (isDga(m) || isEntrada(m) || !m?.clientes_id) return false;
  if (paidByClientDirect(m)) return false;
  const payer = norm(m?.pago_por);
  const referenceType = norm(m?.reference_type);
  const grupo = norm(m?.grupo_categoria);
  const isTravelExpensePayable = referenceType === "travel_expense_report";
  return payer === "share" || payer === "share brasil" || Boolean(m?.reembolsavel) ||
    norm(m?.status) === "aguardando_reembolso" || isTravelExpensePayable || grupo.includes("reembolsav");
};

// tipo_caixa='share' não basta: uma despesa DESPESAS REEMBOLSÁVEIS também sai do
// caixa Share no momento do lançamento (regra de negócio, seção 3.1.1), mas é do
// cliente por natureza — não pode contar como despesa pura da Share.
export const isShare = (m: any) => !isDga(m) && norm(m?.tipo_caixa) === "share" && !paidByShareForClient(m);
export const isCliente = (m: any) => !isDga(m) && norm(m?.tipo_caixa) === "cliente";

export const isDgaCotistaOutOfPocket = (m: any) => {
  if (!isDga(m) || isEntrada(m)) return false;
  const payer = norm(m?.pago_por);
  return Boolean(m?.pago_diretamente && m?.socio_id) || payer === "cotista" || payer === "socio" || payer === "cotista_direto";
};

export const isDgaPaidByBank = (m: any) => isDga(m) && !isEntrada(m) && !isDgaCotistaOutOfPocket(m);

export const valueOf = (m: any) => num(m?.valor_rateado) || num(m?.valor_pago_real) || num(m?.valor_total) || num(m?.valor);
export const paidValueOf = (m: any) => num(m?.valor_pago_real) || valueOf(m);

export const dateOf = (m: any) => m?.data_pagamento || m?.data_emissao || m?.data_vencimento || null;
export const periodOf = (date?: string | null) => (date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0,7) : null);

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
}

export function fornecedorStatus(m: any) {
  const s = norm(m?.status);
  if (["cancelado", "rejeitado"].includes(s)) return "cancelado";
  if (s === "aguardando_reembolso") return "Reembolso pendente";
  if (m?.data_pagamento || ["pago","quitado","confirmado","reembolsado","recebido"].includes(s)) return "pago";
  if (m?.data_vencimento && m.data_vencimento < new Date().toISOString().slice(0,10)) return "vencido";
  return "pendente";
}

export function clienteDividaLabel(m: any) {
  const c = classify(m);
  if (c.natureza === "DESPESA_CLIENTE_PAGA_SHARE") return "Deve à Share";
  if (c.natureza === "DESPESA_CLIENTE_PAGA_DIRETO") return "Pago pelo cliente";
  return "—";
}

export function dgaPayerLabel(m: any) {
  if (isDgaCotistaOutOfPocket(m)) return "Cotista";
  if (isDgaPaidByBank(m)) return "Banco DGA";
  return "—";
}