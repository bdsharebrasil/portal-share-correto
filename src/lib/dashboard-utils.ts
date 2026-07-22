export function formatBRL(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatHours(hours: number | null | undefined): string {
  const n = Number(hours ?? 0);
  if (!Number.isFinite(n)) return "0 h";
  return `${n.toFixed(1).replace(".", ",")} h`;
}

const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/**
 * Recebe uma chave "YYYY-MM" e retorna label curto tipo "Jan/24".
 */
export function monthLabel(key: string): string {
  if (!key) return "";
  const [ano, mes] = key.split("-");
  const mi = Math.max(0, Math.min(11, Number(mes) - 1));
  const ay = ano ? ano.slice(-2) : "";
  return `${MESES_ABREV[mi]}/${ay}`;
}