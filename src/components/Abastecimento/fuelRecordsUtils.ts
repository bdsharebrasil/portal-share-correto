export interface FuelRecordPartnerNameSource {
  nome_socio?: string | null;
  partner_name?: string | null;
  socio_nome?: string | null;
}

export function resolveFuelRecordPartnerName(record: FuelRecordPartnerNameSource): string {
  const candidates = [record.nome_socio, record.partner_name, record.socio_nome];
  const value = candidates.find((candidate) => Boolean(candidate && String(candidate).trim()));

  return value ? String(value).trim() : "";
}
