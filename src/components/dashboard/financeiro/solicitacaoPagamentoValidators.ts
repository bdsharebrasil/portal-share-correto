export type TipoDespesaCategoria = "COMBUSTIVEIS" | "DESPESAS_DE_VIAGEM" | "OUTRA";

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

  // Busca por correspondência exata ou parcial
  // Prioriza: cliente + valor + data
  // Depois: cliente + valor
  // Depois: cliente + valor aproximado + nf

  // Correspondência EXATA: cliente + valor + data
  const exactMatch = registros.find((registro) => {
    const sameCliente = candidate.clienteId && registro.id_clientes === candidate.clienteId;
    const sameValue = valor && registro.valor_total && Math.abs(Number(registro.valor_total) - valor) < 0.01;
    const sameDate = data && registro.data && registro.data.slice(0, 10) === data;
    return sameCliente && sameValue && sameDate;
  });
  if (exactMatch) return exactMatch;

  // Correspondência FORTE: cliente + valor + NF
  if (numeroNf) {
    const nfMatch = registros.find((registro) => {
      const sameCliente = candidate.clienteId && registro.id_clientes === candidate.clienteId;
      const sameValue = valor && registro.valor_total && Math.abs(Number(registro.valor_total) - valor) < 0.01;
      const sameNf = registro.nf && registro.nf.trim().toLowerCase() === numeroNf;
      return sameCliente && sameValue && sameNf;
    });
    if (nfMatch) return nfMatch;
  }

  // Correspondência MÉDIA: cliente + valor (margem de tolerância)
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

  // Busca em múltiplos níveis
  // 1. Exata: cliente + valor total
  // 2. Parcial: cliente + valor total + descrição na despesa
  // 3. Aproximada: cliente + valor aproximado

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

  // Correspondência EXATA: cliente + valor total do relatório
  const exactMatch = registros.find((registro) => {
    if (!candidate.clienteId || !registro.clientes_id) return false;
    if (registro.clientes_id !== candidate.clienteId) return false;
    if (!valor || !registro.total_valor) return false;
    return Math.abs(Number(registro.total_valor) - valor) < 0.01;
  });
  if (exactMatch) return exactMatch;

  // Correspondência FORTE: cliente + valor + descrição em alguma despesa
  if (descricao) {
    const descMatch = registros.find((registro) => {
      if (!candidate.clienteId || !registro.clientes_id || registro.clientes_id !== candidate.clienteId) return false;
      if (valor && registro.total_valor && Math.abs(Number(registro.total_valor) - valor) >= 0.01) return false;

      const despesas = parseDespes(registro.despesas);
      return despesas.some((item) => {
        const itemDesc = (item?.description || "").trim().toLowerCase();
        const itemAmount = Number(item?.amount ?? 0) || 0;

        // Match por descrição semelhante ou contida
        const descSimilar =
          itemDesc === descricao ||
          itemDesc.includes(descricao) ||
          descricao.includes(itemDesc);

        // Match por valor da item individual
        const amountSimilar = !valor || !itemAmount || Math.abs(itemAmount - valor) < 0.01;

        return descSimilar && amountSimilar;
      });
    });
    if (descMatch) return descMatch;
  }

  // Correspondência MÉDIA: cliente + valor aproximado
  const valueMatch = registros.find((registro) => {
    if (!candidate.clienteId || !registro.clientes_id || registro.clientes_id !== candidate.clienteId) return false;
    if (!valor || !registro.total_valor) return false;
    return Math.abs(Number(registro.total_valor) - valor) < 0.01;
  });
  if (valueMatch) return valueMatch;

  return null;
}
