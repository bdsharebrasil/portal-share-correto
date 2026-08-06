export function utcToBrasilia(utcTime: string | null | undefined): string | null {
  if (!utcTime) return null;
  const clean = utcTime.slice(0, 5);
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  let bh = h - 3;
  if (bh < 0) bh += 24;
  return `${String(bh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
