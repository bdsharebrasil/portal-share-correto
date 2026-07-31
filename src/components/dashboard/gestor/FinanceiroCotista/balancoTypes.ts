export interface Aeronave {
  id: string;
  matricula: string;
  modelo?: string;
  fabricante?: string;
}

export interface Cotista {
  id: string;
  cliente_id: string | null;
  socio_id: string | null;
  nome: string;
  percentual: number;
  documento?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
}

export interface RateioRow {
  id: string;
  despesa_id: string | null;
  fluxo: string | null;
  periodicidade: string | null;
  tipo_rateio: string | null;
  descricao_despesa: string | null;
  fornecedor_nome: string | null;
  categoria_custo: string | null;
  cliente_id: string | null;
  socio_id: string | null;
  clientes_nome: string | null;
  socios_nome: string | null;
  data_emissao: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  valor_total_despesa: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  percentual_uso: number | null;
  percentual_sociedade: number | null;
  numero_nf: string | null;
  numero_doc: string | null;
  numero_recibo: string | null;
  forma_pagamento: string | null;
  status: string | null;
  observacoes: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
  relatorio_url: string | null;
  demonstrativo_url: string | null;
  conferido: boolean;
  conferido_em: string | null;
  conferido_por: string | null;
  pago_por: string | null;
  pago_diretamente: boolean | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
}

export interface VooRow {
  id: string;
  data_registro: string;
  tempo_total: number | null;
  tempo_voo: number | null;
  horas_diurnas: number | null;
  horas_noturnas: number | null;
  tempo_ifr: number | null;
  clientes_id: string | null;
  socios_id: string | null;
  socios_nome: string | null;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  trecho: string | null;
  natureza_voo: string | null;
  pousos_total: number | null;
  emprestimo: boolean | null;
  cliente_tomador_emprestimo_id: string | null;
  socio_tomador_emprestimo_id: string | null;
  pic_canac: string | null;
  sic_canac: string | null;
  sic_name: string | null;
  distancia_nm: number | null;
  consumo_combustivel_voo: number | null;
  litros_combustivel_inicio_voo: number | null;
  preco_combustivel_litro: number | null;
  abastecido: boolean | null;
}

export interface MembroTripulacao {
  id: string;
  canac: string;
  nome_completo: string;
}

export interface TERRow {
  id: string;
  numero_relatorio: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  rota: string | null;
  status: string | null;
  aeronave_id: string | null;
  total_valor: number | null;
  pago_em: string | null;
}

export interface AbastecimentoRow {
  id: string;
  logbook_entry_id: string | null;
  data: string | null;
  trecho: string | null;
  litros: number | null;
  valor_total: number | null;
  valor_unitario: number | null;
  status: string | null;
}

export interface ContaApagarRow {
  id: string;
  reference_type: string | null;
  reference_id: string | null;
  categoria: string | null;
  descricao: string | null;
  valor: number | null;
  status: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  aeronave_registro: string | null;
  competencia_decea: string | null;
  competencia_infraero: string | null;
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MESES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const norm = (s?: string | null) =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export const isSaida = (fluxo?: string | null) => norm(fluxo) !== "entrada";

export const isFixo = (p?: string | null) => norm(p).startsWith("mensal");

export const formatDate = (d?: string | null) =>
  d ? new Date(d + (d.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";

export const num = (v: unknown): number =>
  typeof v === "number" ? (Number.isFinite(v) ? v : 0) : Number(v) || 0;

export const cotistaKey = (cid: string | null, sid: string | null) =>
  `${cid || ""}|${sid || ""}`;

export function findCotistaKey(
  cotistas: Cotista[],
  rec: { cliente_id?: string | null; socio_id?: string | null; clientes_id?: string | null; socios_id?: string | null },
): string | null {
  const cid = rec.cliente_id ?? rec.clientes_id ?? null;
  const sid = rec.socio_id ?? rec.socios_id ?? null;
  const bySocio = sid ? cotistas.find((c) => c.socio_id === sid) : null;
  if (bySocio) return bySocio.id;
  const byCliente = cid ? cotistas.find((c) => c.cliente_id === cid && !c.socio_id) : null;
  if (byCliente) return byCliente.id;
  return cid ? cotistas.find((c) => c.cliente_id === cid)?.id ?? null : null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveCategoria(raw: string | null | undefined, map: Map<string, string>): string {
  const v = (raw || "").trim();
  if (!v) return "Sem categoria";
  if (UUID_RE.test(v)) return map.get(v) || "Sem categoria";
  return v;
}

export interface StatusInfo {
  label: string;
  tone: "success" | "warning" | "danger";
  kind: "pendente" | "pago" | "vencido" | "reembolsado" | "aprovado";
}

export function statusOf(r: RateioRow): StatusInfo {
  if (r.status) {
    const n = norm(r.status);
    if (n.startsWith("pago") || n === "aprovado" || n === "despesa paga") return { label: "Pago", tone: "success", kind: "aprovado" };
    if (n.startsWith("reembols") || n.startsWith("deposito")) return { label: "Reembolsado", tone: "success", kind: "reembolsado" };
    if (n.startsWith("atras") || n === "vencido") return { label: "Vencido", tone: "danger", kind: "vencido" };
    return { label: "Pendente", tone: "warning", kind: "pendente" };
  }
  if ((num(r.valor_pago_real) > 0) || r.data_pagamento) return { label: "Pago", tone: "success", kind: "aprovado" };
  if (r.data_vencimento && new Date(r.data_vencimento) < new Date()) return { label: "Vencido", tone: "danger", kind: "vencido" };
  return { label: "Pendente", tone: "warning", kind: "pendente" };
}

export const formatHours = (h: number): string => {
  if (!h || h <= 0) return "0h";
  const intPart = Math.floor(h);
  const decPart = Math.round((h - intPart) * 60);
  return decPart > 0 ? `${intPart}h${String(decPart).padStart(2, "0")}` : `${intPart}h`;
};

export const monthLabel = (key: string): string => {
  const m = parseInt(key.split("-")[1] || "1", 10) - 1;
  return MESES_SHORT[m] || key;
};
