export interface CotistaOption {
  id: string;
  cliente_id?: string | null;
  socio_id?: string | null;
  nome: string;
  documento: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  percentual: number;
}

export interface RateioParticipant {
  id: string;
  cliente_id?: string | null;
  socio_id?: string | null;
  nome: string;
  percentual?: number;
}

export const SPECIAL_RATEIO_OPTIONS = [
  { id: "VOO TRANSLADO", label: "VOO TRANSLADO" },
  { id: "VOO DE CHECK", label: "VOO DE CHECK" },
  { id: "VOO TESTE", label: "VOO TESTE" },
] as const;

export const isSpecialRateio = (value: string | null | undefined) =>
  SPECIAL_RATEIO_OPTIONS.some((option) => option.id === (value || "").toUpperCase());

// Dedup por cliente: se o mesmo cliente aparece mais de uma vez (ex: cliente + sócio
// vinculado), mantém uma única ocorrência para não inflar o divisor do rateio.
const getRateioParticipants = (participants: RateioParticipant[]) => {
  const byClient = new Map<string, RateioParticipant>();

  for (const participant of participants) {
    const key = participant.cliente_id || participant.id;
    if (!key || !participant.nome) continue;

    const existing = byClient.get(key);
    if (!existing || (existing.socio_id && !participant.socio_id)) {
      byClient.set(key, participant);
    }
  }

  return Array.from(byClient.values());
};

/**
 * Expande uma linha de rateio especial (VOO TESTE / VOO DE CHECK / VOO TRANSLADO)
 * em uma linha por participante.
 *
 * modo "igual"       -> divide 1/N entre os participantes.
 *                        Usado para VOO DE CHECK, VOO TRANSLADO, e como fallback
 *                        do VOO TESTE quando ainda não há % apurado na OAS.
 * modo "percentual"  -> divide proporcionalmente ao campo `percentual` de cada
 *                        participante. Usado para VOO TESTE, com o % de uso
 *                        (horas voadas no período da manutenção) vindo da OAS.
 *
 * IMPORTANTE: `participantesRateio` deve conter apenas proprietários/cotistas reais
 * da aeronave — nunca tomadores de empréstimo, que não participam desse rateio.
 */
export function expandSpecialRateioLine<T extends { cotistaNome: string; valor: number }>(
  line: T,
  participantesRateio: RateioParticipant[],
  modo: "igual" | "percentual" = "igual"
): T[] {
  if (!isSpecialRateio(line.cotistaNome)) return [line];

  const candidates = getRateioParticipants(participantesRateio);
  if (candidates.length === 0) return [line];

  const totalCents = Math.round((line.valor || 0) * 100);
  const count = candidates.length;
  const totalPercentual = candidates.reduce((sum, c) => sum + (c.percentual || 0), 0);

  // Se pediram "percentual" mas ninguém tem percentual cadastrado, cai pro igual
  // em vez de gerar linhas zeradas.
  const useEqualSplit = modo === "igual" || totalPercentual <= 0;

  let acumulado = 0;
  const centsPerCandidate = candidates.map((c, index) => {
    if (index === count - 1) {
      // última linha absorve o resto do arredondamento (no máximo alguns centavos)
      return totalCents - acumulado;
    }
    const share = useEqualSplit
      ? Math.floor(totalCents / count)
      : Math.round((totalCents * (c.percentual || 0)) / totalPercentual);
    acumulado += share;
    return share;
  });

  return candidates.map((candidate, index) => ({
    ...line,
    cotistaNome: candidate.nome,
    valor: centsPerCandidate[index] / 100,
  }));
}

export function normalizeTextForMatching(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Faz o parse de um texto livre do tipo "CARVALIMA: 25,98% / WATT: 74,02%"
 * (campos total_voado_porcentagem / porcentagem_rateio da OAS) em um mapa nome -> valor.
 * Linhas que não casam com o padrão "nome: número%" são simplesmente ignoradas —
 * não tenta adivinhar formato.
 */
export function parsePercentuaisTexto(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  const result: Record<string, number> = {};
  const partes = raw
    .split(/[\n;,/]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const parte of partes) {
    const match = parte.match(/^(.+?)[:\s]+(\d+(?:[.,]\d+)?)\s*%?$/);
    if (!match) continue;
    const nome = match[1].trim();
    const valor = parseFloat(match[2].replace(",", "."));
    if (nome && !Number.isNaN(valor)) result[nome] = valor;
  }

  return result;
}

/**
 * Casa os nomes extraídos do texto da OAS com os cotistas reais da aeronave.
 * Só preenche quando há correspondência normalizada exata — nunca atribui um
 * número certo a um cotista errado por causa de um formato de texto inesperado.
 */
export function mapPercentuaisParaCotistas(
  parsed: Record<string, number>,
  cotistas: { nome: string }[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cotistas) {
    const key = Object.keys(parsed).find(
      (k) => normalizeTextForMatching(k) === normalizeTextForMatching(c.nome)
    );
    if (key) out[c.nome] = parsed[key];
  }
  return out;
}

interface CotistaAeronaveRow {
  id_clientes: string;
  percentual_sociedade?: number | null;
  clientes?: {
    id?: string | null;
    razao_social?: string | null;
    cnpj?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    uf?: string | null;
  } | null;
}

interface SocioRow {
  id: string;
  nome?: string | null;
  cpf?: string | null;
  cliente_id?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export function buildCotistaOptions(
  cotistasAeronaveRows: CotistaAeronaveRow[],
  sociosRows: SocioRow[]
): CotistaOption[] {
  const cotistas = (cotistasAeronaveRows || [])
    .map((r) => {
      const cliente = r.clientes;
      const id = cliente?.id || r.id_clientes;
      const nome = cliente?.razao_social || "";

      return {
        id,
        cliente_id: id,
        socio_id: null,
        nome,
        documento: cliente?.cnpj || null,
        endereco: cliente?.endereco || null,
        cidade: cliente?.cidade || null,
        uf: cliente?.uf || null,
        percentual: Number(r.percentual_sociedade) || 0,
      } as CotistaOption;
    })
    .filter((c) => c.nome);

  const socios = (sociosRows || [])
    .map((s) => ({
      id: s.id,
      cliente_id: s.cliente_id || null,
      nome: s.nome || "",
      documento: s.cpf || null,
      endereco: s.endereco || null,
      cidade: s.cidade || null,
      uf: s.uf || null,
      percentual: 0,
    }))
    .filter((s) => s.nome);

  const map = new Map<string, CotistaOption>();

  for (const cotista of cotistas) {
    map.set(cotista.id, cotista);
  }

  for (const socio of socios) {
    const key = socio.cliente_id || socio.id;
    const existing = map.get(key);

    if (existing) {
      const duplicate = {
        ...existing,
        id: socio.id,
        cliente_id: socio.cliente_id || existing.cliente_id,
        socio_id: socio.id,
        nome: socio.nome,
        documento: socio.documento,
        endereco: socio.endereco,
        cidade: socio.cidade,
        uf: socio.uf,
        percentual: existing.percentual,
      };
      map.set(socio.id, duplicate);
    } else {
      map.set(socio.id, { ...socio, socio_id: socio.id });
    }
  }

  return Array.from(map.values());
}