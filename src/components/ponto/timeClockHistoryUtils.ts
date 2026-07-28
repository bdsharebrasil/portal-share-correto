export type TimeEntryStatus = "ativo" | "concluido" | "incompleto";

export interface NormalizedTimeEntry {
  id: string;
  user_id: string;
  date: string;
  entrada_hora: string | null;
  saida_hora: string | null;
  inicio_almoco: string | null;
  fim_almoco: string | null;
  horas_totais: number | null;
  status: TimeEntryStatus;
  criado_em: string;
}

export function mapTimeEntryStatus(status?: string | null): TimeEntryStatus {
  switch (status) {
    case "concluido":
      return "concluido";
    case "em_andamento":
    case "ativo":
      return "ativo";
    default:
      return "incompleto";
  }
}

export function normalizeTimeEntry(entry: any): NormalizedTimeEntry {
  const rawHours = entry?.horas_totais ?? entry?.total_hours;
  const horasTotais = rawHours === null || rawHours === undefined || rawHours === ""
    ? null
    : Number(rawHours);

  return {
    id: entry?.id,
    user_id: entry?.user_id,
    date: entry?.data_entrada ?? entry?.data ?? "",
    entrada_hora: entry?.entrada_hora ?? entry?.clock_in ?? null,
    saida_hora: entry?.saida_hora ?? entry?.clock_out ?? null,
    inicio_almoco: entry?.inicio_almoco ?? entry?.lunch_start ?? null,
    fim_almoco: entry?.fim_almoco ?? entry?.lunch_end ?? null,
    horas_totais: Number.isFinite(horasTotais) ? horasTotais : null,
    status: mapTimeEntryStatus(entry?.status),
    criado_em: entry?.criado_em ?? entry?.created_at ?? "",
  };
}
