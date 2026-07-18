export function resolveCategoriaLabel(
  value: string | null | undefined,
  categoriasPorId: Map<string, string>
): string {
  const normalized = (value || "").toString().trim();

  if (!normalized) return "—";

  return categoriasPorId.get(normalized) || normalized;
}

export function getCotistaAliases(cotista: {
  id?: string | null;
  clienteId?: string | null;
  socioId?: string | null;
  cliente_id?: string | null;
  socio_id?: string | null;
  aliases?: Array<string | null | undefined>;
}): string[] {
  const values = [
    cotista.id,
    cotista.clienteId,
    cotista.socioId,
    cotista.cliente_id,
    cotista.socio_id,
    ...(cotista.aliases || []),
  ];

  return Array.from(
    new Set(
      values
        .filter((value): value is string => Boolean(value && String(value).trim()))
        .map((value) => String(value).trim())
    )
  );
}

export function findCotistaIdForRecord<T extends Record<string, any>>(
  cotistas: Array<{ id: string; [key: string]: any }>,
  record: T
): string | null {
  const candidates = [
    record.cliente_id,
    record.socio_id,
    record.clientes_id,
    record.socios_id,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = String(candidate).trim();
    if (!normalized) continue;

    const match = cotistas.find((cotista) => getCotistaAliases(cotista).includes(normalized));
    if (match) return match.id;
  }

  return null;
}
