export function formatBRL(value: number): string {
  return (
    "R$ " +
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatBRLCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return "R$ " + (value / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return "R$ " + (value / 1_000).toFixed(0) + "k";
  return "R$ " + value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}
