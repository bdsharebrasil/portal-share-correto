export type TipoDespesaCategoria = "COMBUSTIVEIS" | "DESPESAS_DE_VIAGEM" | "OUTRA";
export type TipoRateio = "FIXO" | "VARIAVEL_POR_VOO" | "VARIAVEL_POR_HORA" | "EXTRA";

export interface SocioRateioInput {
  id: string;
  nome: string;
  percentual_participacao?: number | null;
}

export interface SocioAnexoOption {
  id: string;
  nome: string;
}

export interface LinhRateioMontada {
  socio_id: string | null;
  socio_nome: string | null;
  percentual_uso: number;
  valor_rateado: number;
}

export interface FuelCandidate {
  id: string;
  id_clientes?: string | null;
  valor_total?: number | null;
  data?: string | null;
  nf?: string | null;
}

export interface TravelExpenseCandidate {
  id: string;
  clientes_id?: string | null;
  total_valor?: number | null;
  despesas?: unknown;
  pago_em?: string | null;
}

export interface ReceiptCandidate {
  id: string;
  cliente_id?: string | null;
  clientes_id?: string | null;
  valor_total?: number | null;
  numero_recibo?: string | null;
  numero?: string | null;
}

export interface TravelExpenseItem {
  description?: string | null;
  amount?: number | null;
  category?: string | null;
}

export function normalizarTipoDespesa(label: string): TipoDespesaCategoria {
  const normalized = label.normalize("NFD").replace(/[^\w\s]/g, "").toUpperCase();
  if (normalized.includes("COMBUST")) return "COMBUSTIVEIS";
  if (normalized.includes("DESPESA") && normalized.includes("VIAGEM")) return "DESPESAS_DE_VIAGEM";
  return "OUTRA";
}

export function consolidarSociosParaAnexo(socios: Array<SocioRateioInput | SocioAnexoOption>): SocioAnexoOption[] {
  const mapa = new Map<string, SocioAnexoOption>();
  for (const socio of socios || []) {
    if (!socio?.id) continue;
    if (!mapa.has(socio.id)) {
      mapa.set(socio.id, { id: socio.id, nome: socio.nome || "Sócio" });
    }
  }
  return Array.from(mapa.values());
}

export function normalizarTipoRateio(value: string | null | undefined): TipoRateio {
  const normalized = (value || "").normalize("NFD").replace(/[^\w\s]/g, "").trim().toUpperCase();

  if (normalized.includes("VARIAVEL") && normalized.includes("VOO")) return "VARIAVEL_POR_VOO";
  if (normalized.includes("VARIAVEL") && normalized.includes("HORA")) return "VARIAVEL_POR_HORA";
  if (normalized.includes("EXTRA")) return "EXTRA";
  return "FIXO";
}

export function resolverTipoRateioPadraoParaDespesa(label: string | null | undefined): TipoRateio | null {
  const normalized = (label || "").normalize("NFD").replace(/[^\w\s]/g, "").trim().toUpperCase();

  if (!normalized) return null;
  if (normalized.includes("COMBUST")) return "VARIAVEL_POR_HORA";
  if (normalized.includes("ADM") && (normalized.includes("SHARE") || normalized.includes("TRIP"))) return "FIXO";
  return null;
}

export function resolverPagoPorSolicitacao(params: {
  socioNome?: string | null;
  clienteNome?: string | null;
  rateadoParaTodosSocios?: boolean;
  socioCount?: number;
}): string | null {
  const socioNome = (params.socioNome || "").trim();
  const clienteNome = (params.clienteNome || "").trim();
  const socioCount = Number(params.socioCount ?? 0) || 0;

  if (socioCount > 1) {
    return clienteNome || socioNome || null;
  }

  if (socioCount === 1) {
    return socioNome || clienteNome || null;
  }

  if (params.rateadoParaTodosSocios) {
    return clienteNome || socioNome || null;
  }

  return socioNome || clienteNome || null;
}

export function resolverFornecedorSolicitacao(params: {
  isViagemMode?: boolean;
  fornecedorNome?: string | null;
}): string | null {
  if (params.isViagemMode) return "SHARE BRASIL";
  return (params.fornecedorNome || "").trim() || null;
}

export function resolverSubcategoriaSelecionadaParaPayload(params: {
  subcategoriaSelecionada?: string | null;
  subcategoria1?: string | null;
  subcategoria2?: string | null;
}): string | null {
  const selecionada = (params.subcategoriaSelecionada || "").trim();
  if (!selecionada) return null;

  const sub1 = (params.subcategoria1 || "").trim();
  const sub2 = (params.subcategoria2 || "").trim();

  if (sub1 && selecionada.toUpperCase() === sub1.toUpperCase()) return sub1;
  if (sub2 && selecionada.toUpperCase() === sub2.toUpperCase()) return sub2;

  return selecionada;
}

/**
 * Rateio de UM cliente entre seus sócios (modelo holding).
 * Usado no fluxo de Despesas de Viagem (single-cliente).
 *
 * IMPORTANTE: `socios[].percentual_participacao` deve vir de
 * `cotistas_aeronave.percentual_sociedade` (filtrado por id_clientes + id_aeronave),
 * e NUNCA de `socios.percentual_participacao`, que não é específico por aeronave
 * e pode estar desatualizado/zerado — isso é o que causava o rateio igualitário
 * incorreto (33.33% para todos) reportado anteriormente.
 */
export function filtrarSociosParaRateio(params: {
  socios: SocioRateioInput[];
  socioSelecionadoId: string | null;
  sociosExcluidos?: string[] | null;
}): SocioRateioInput[] {
  const sociosAtivos = (params.socios || []).filter((socio) => Boolean(socio?.id));
  const idsExcluidos = new Set((params.sociosExcluidos || []).filter(Boolean).map((id) => String(id)));
  const filtrados = sociosAtivos.filter((socio) => !idsExcluidos.has(String(socio.id)));

  if (!params.socioSelecionadoId || params.socioSelecionadoId.trim() === "") {
    return filtrados;
  }
  return filtrados.filter((socio) => socio.id === params.socioSelecionadoId);
}

export function resolverClienteParaRateio(params: {
  clienteId?: string | null;
  socioId?: string | null;
  clientesDaAeronave?: Array<{
    clienteId: string;
    socios?: Array<{ id?: string | null }>;
  }>;
}): string | null {
  const clienteSelecionado = (params.clienteId || "").trim();
  if (clienteSelecionado && clienteSelecionado !== "__all__") {
    return clienteSelecionado;
  }

  const socioSelecionado = (params.socioId || "").trim();
  if (!socioSelecionado) {
    return null;
  }

  const clienteEncontrado = (params.clientesDaAeronave || []).find((cliente) =>
    (cliente.socios || []).some((socio) => (socio.id || "") === socioSelecionado),
  );

  return clienteEncontrado?.clienteId || null;
}

export function montarLinhasRateio(params: {
  valorTotal: number;
  percentualUso: number | string;
  socios: SocioRateioInput[];
  socioSelecionadoId: string | null;
}): LinhRateioMontada[] {
  const valor = Number(params.valorTotal ?? 0) || 0;
  const percentualUso = Number(String(params.percentualUso ?? "100").replace(",", ".")) || 0;
  const linhasBase = filtrarSociosParaRateio({
    socios: params.socios,
    socioSelecionadoId: params.socioSelecionadoId,
  });

  if (!linhasBase.length) {
    return [];
  }

  const usarTodos = !params.socioSelecionadoId || params.socioSelecionadoId.trim() === "";
  const baseValor = valor * (percentualUso > 0 ? percentualUso / 100 : 1);

  if (usarTodos && linhasBase.length > 1) {
    const totalPct = linhasBase.reduce((sum, socio) => sum + (Number(socio.percentual_participacao ?? 0) || 0), 0);
    const divisor = totalPct > 0 ? totalPct : linhasBase.length;
    return linhasBase.map((socio) => {
      const pct = divisor > 0 ? (Number(socio.percentual_participacao ?? 0) || 0) / divisor : 1 / linhasBase.length;
      const valorRateado = +(baseValor * pct).toFixed(2);
      return {
        socio_id: socio.id || null,
        socio_nome: socio.nome || null,
        percentual_uso: +(pct * 100).toFixed(2),
        valor_rateado: valorRateado,
      };
    });
  }

  const pctBase = linhasBase.length > 1 ? 100 / linhasBase.length : 100;
  const valorBase = +(baseValor * (pctBase / 100)).toFixed(2);
  return linhasBase.map((socio) => ({
    socio_id: socio.id || null,
    socio_nome: socio.nome || null,
    percentual_uso: +(pctBase).toFixed(2),
    valor_rateado: valorBase,
  }));
}

/* ------------------------------------------------------------------ */
/* Rateio MULTI-CLIENTE (mesma nota dividida entre vários clientes)   */
/* ------------------------------------------------------------------ */

export interface ClienteLinhaRateioInput {
  clienteId: string;
  clienteNome: string;
  /** % da nota total que esse cliente vai pagar. A soma entre todas as linhas deve ser 100%. */
  percentualUsoCliente: number;
  /** Sócios desse cliente NA AERONAVE selecionada (percentual_participacao = cotistas_aeronave.percentual_sociedade). */
  socios: SocioRateioInput[];
  /** Overrides manuais opcionais: socioId -> percentual de uso dentro da fatia do cliente (0-100). */
  overridesSocio?: Record<string, number>;
  /** Overrides manuais de valor rateado por sócio (em R$). Se informado, tem prioridade sobre overridesSocio. */
  valorOverridesSocio?: Record<string, number>;
}

export interface LinhaRateioClienteMontada extends LinhRateioMontada {
  [x: string]: any;
  cliente_id: string;
  cliente_nome: string;
  percentual_uso_cliente: number;
  valor_cliente: number;
  /** percentual_sociedade original (cotistas_aeronave), antes de qualquer override manual — guardado para auditoria. */
  percentual_sociedade_original: number;
}

/**
 * Monta as linhas de rateio_despesas para uma solicitação com múltiplos clientes
 * na mesma nota. Aceita overrides de percentual e/ou valor por sócio.
 */
export function montarLinhasRateioMultiCliente(params: {
  valorTotal: number;
  linhas: ClienteLinhaRateioInput[];
}): LinhaRateioClienteMontada[] {
  const valorTotal = Number(params.valorTotal ?? 0) || 0;
  const resultado: LinhaRateioClienteMontada[] = [];

  for (const linha of params.linhas || []) {
    if (!linha.clienteId) continue;

    const pctCliente = Number(linha.percentualUsoCliente ?? 0) || 0;
    const valorCliente = +(valorTotal * (pctCliente / 100)).toFixed(2);
    const socios = (linha.socios || []).filter((s) => Boolean(s?.id));

    if (socios.length === 0) {
      resultado.push({
        cliente_id: linha.clienteId,
        cliente_nome: linha.clienteNome,
        percentual_uso_cliente: pctCliente,
        valor_cliente: valorCliente,
        socio_id: null,
        socio_nome: null,
        percentual_uso: pctCliente,
        valor_rateado: valorCliente,
        percentual_sociedade_original: 0,
      });
      continue;
    }

    const totalPctSocios = socios.reduce((sum, s) => sum + (Number(s.percentual_participacao ?? 0) || 0), 0);

    for (const socio of socios) {
      const overrideValor = linha.valorOverridesSocio?.[socio.id];
      const overridePct = linha.overridesSocio?.[socio.id];
      const percentualOriginal = Number(socio.percentual_participacao ?? 0) || 0;

      let valorRateado: number;
      let percentualUsoEfetivo: number;

      const percentualManual = overridePct !== undefined && overridePct !== null && !Number.isNaN(overridePct)
        ? Number(overridePct)
        : null;
      const valorManual = overrideValor !== undefined && overrideValor !== null && !Number.isNaN(overrideValor)
        ? Number(overrideValor)
        : null;

      if (valorManual !== null) {
        valorRateado = +valorManual.toFixed(2);
        percentualUsoEfetivo = percentualManual ?? (valorTotal > 0 ? +((valorRateado / valorTotal) * 100).toFixed(2) : 0);
      } else if (percentualManual !== null) {
        percentualUsoEfetivo = +percentualManual.toFixed(2);
        valorRateado = +(valorTotal * (percentualUsoEfetivo / 100)).toFixed(2);
      } else {
        const pctSocioDentroDoCliente = totalPctSocios > 0
          ? (percentualOriginal / totalPctSocios) * 100
          : 100 / socios.length;
        percentualUsoEfetivo = +(pctCliente * (pctSocioDentroDoCliente / 100)).toFixed(2);
        valorRateado = +(valorTotal * (percentualUsoEfetivo / 100)).toFixed(2);
      }

      resultado.push({
        cliente_id: linha.clienteId,
        cliente_nome: linha.clienteNome,
        percentual_uso_cliente: pctCliente,
        valor_cliente: valorCliente,
        socio_id: socio.id,
        socio_nome: socio.nome,
        percentual_uso: percentualUsoEfetivo,
        valor_rateado: valorRateado,
        percentual_sociedade_original: percentualOriginal,
      });
    }
  }

  return resultado;
}

/** Valida que a soma dos % de uso dos clientes fecha em 100% (com tolerância de 0.5). */
export function validarSomaPercentualClientes(linhas: { percentualUsoCliente: number }[]): string | null {
  const soma = linhas.reduce((sum, l) => sum + (Number(l.percentualUsoCliente) || 0), 0);
  if (Math.abs(soma - 100) > 0.5) {
    return `A soma dos percentuais de uso dos clientes deve ser 100% (atual: ${soma.toFixed(2)}%)`;
  }
  return null;
}

export function findExistingFuelReference(
  candidate: {
    clienteId?: string | null;
    valor?: number | null;
    data?: string | null;
    numeroNf?: string | null;
  },
  registros: FuelCandidate[]
): FuelCandidate | null {
  const valor = Number(candidate.valor ?? 0) || 0;
  const data = candidate.data?.slice(0, 10) || null;
  const numeroNf = (candidate.numeroNf || "").trim().toLowerCase();

  const exactMatch = registros.find((registro) => {
    const sameCliente = candidate.clienteId && registro.id_clientes === candidate.clienteId;
    const sameValue = valor && registro.valor_total && Math.abs(Number(registro.valor_total) - valor) < 0.01;
    const sameDate = data && registro.data && registro.data.slice(0, 10) === data;
    return sameCliente && sameValue && sameDate;
  });
  if (exactMatch) return exactMatch;

  if (numeroNf) {
    const nfMatch = registros.find((registro) => {
      const sameCliente = candidate.clienteId && registro.id_clientes === candidate.clienteId;
      const sameValue = valor && registro.valor_total && Math.abs(Number(registro.valor_total) - valor) < 0.01;
      const sameNf = registro.nf && registro.nf.trim().toLowerCase() === numeroNf;
      return sameCliente && sameValue && sameNf;
    });
    if (nfMatch) return nfMatch;
  }

  const valueMatch = registros.find((registro) => {
    const sameCliente = candidate.clienteId && registro.id_clientes === candidate.clienteId;
    const sameValue = valor && registro.valor_total && Math.abs(Number(registro.valor_total) - valor) < 0.01;
    return sameCliente && sameValue;
  });
  if (valueMatch) return valueMatch;

  return null;
}

export function findExistingReceiptReference(
  candidate: {
    clienteId?: string | null;
    valor?: number | null;
    numeroRecibo?: string | null;
  },
  registros: ReceiptCandidate[]
): ReceiptCandidate | null {
  const valor = Number(candidate.valor ?? 0) || 0;
  const numeroRecibo = (candidate.numeroRecibo || "").trim().toLowerCase();

  const exactMatch = registros.find((registro) => {
    const sameCliente = candidate.clienteId && (registro.cliente_id === candidate.clienteId || registro.clientes_id === candidate.clienteId);
    const sameValue = valor && registro.valor_total && Math.abs(Number(registro.valor_total) - valor) < 0.01;
    const sameNumber = numeroRecibo && (registro.numero_recibo || registro.numero || "") && (registro.numero_recibo || registro.numero || "").trim().toLowerCase() === numeroRecibo;
    return sameCliente && sameValue && sameNumber;
  });
  if (exactMatch) return exactMatch;

  if (numeroRecibo) {
    const numberMatch = registros.find((registro) => {
      const sameCliente = candidate.clienteId && (registro.cliente_id === candidate.clienteId || registro.clientes_id === candidate.clienteId);
      const sameNumber = (registro.numero_recibo || registro.numero || "").trim().toLowerCase() === numeroRecibo;
      return sameCliente && sameNumber;
    });
    if (numberMatch) return numberMatch;
  }

  const valueMatch = registros.find((registro) => {
    const sameCliente = candidate.clienteId && (registro.cliente_id === candidate.clienteId || registro.clientes_id === candidate.clienteId);
    const sameValue = valor && registro.valor_total && Math.abs(Number(registro.valor_total) - valor) < 0.01;
    return sameCliente && sameValue;
  });
  return valueMatch ?? null;
}

export function findExistingTravelExpenseReference(
  candidate: {
    clienteId?: string | null;
    valor?: number | null;
    descricao?: string | null;
  },
  registros: TravelExpenseCandidate[]
): TravelExpenseCandidate | null {
  const valor = Number(candidate.valor ?? 0) || 0;
  const descricao = (candidate.descricao || "").trim().toLowerCase();

  const pagosRegistros = registros.filter((r) => r.pago_em != null);

  const parseDespes = (despesa: unknown): TravelExpenseItem[] => {
    if (Array.isArray(despesa)) return despesa;
    if (typeof despesa === "string") {
      try {
        const parsed = JSON.parse(despesa);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const exactMatch = pagosRegistros.find((registro) => {
    if (!candidate.clienteId || !registro.clientes_id) return false;
    if (registro.clientes_id !== candidate.clienteId) return false;
    if (!valor || !registro.total_valor) return false;
    return Math.abs(Number(registro.total_valor) - valor) < 0.01;
  });
  if (exactMatch) return exactMatch;

  if (descricao) {
    const descMatch = pagosRegistros.find((registro) => {
      if (!candidate.clienteId || !registro.clientes_id || registro.clientes_id !== candidate.clienteId) return false;
      if (valor && registro.total_valor && Math.abs(Number(registro.total_valor) - valor) >= 0.01) return false;

      const despesas = parseDespes(registro.despesas);
      return despesas.some((item) => {
        const itemDesc = (item?.description || "").trim().toLowerCase();
        const itemAmount = Number(item?.amount ?? 0) || 0;

        const descSimilar =
          itemDesc === descricao ||
          itemDesc.includes(descricao) ||
          descricao.includes(itemDesc);

        const amountSimilar = !valor || !itemAmount || Math.abs(itemAmount - valor) < 0.01;

        return descSimilar && amountSimilar;
      });
    });
    if (descMatch) return descMatch;
  }

  const valueMatch = pagosRegistros.find((registro) => {
    if (!candidate.clienteId || !registro.clientes_id || registro.clientes_id !== candidate.clienteId) return false;
    if (!valor || !registro.total_valor) return false;
    return Math.abs(Number(registro.total_valor) - valor) < 0.01;
  });
  if (valueMatch) return valueMatch;

  return null;
}
