export interface CotistaOption {
  id: string;
  cliente_id?: string | null;
  nome: string;
  documento: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  percentual: number;
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

export function normalizeTextForMatching(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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
        nome: socio.nome,
        documento: socio.documento,
        endereco: socio.endereco,
        cidade: socio.cidade,
        uf: socio.uf,
        percentual: existing.percentual,
      };
      map.set(socio.id, duplicate);
    } else {
      map.set(socio.id, socio);
    }
  }

  return Array.from(map.values());
}
