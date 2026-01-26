import { supabase } from "@/integrations/supabase/client";

export interface ManutencaoRow {
  id: string;
  numero_os?: string | null;
  tipo: string;
  aeronave_id: string | null;
  data_programada: string; // ISO date
  mecanico: string;
  etapa: string; // aguardando | em_andamento | concluida | cancelada
  oficina?: string | null;
  observacoes?: string | null;
  custo_estimado?: number | null;
  vencimento_tipo?: string | null; // 'data' | 'horas'
  vencimento_horas?: number | null; // horas do vencimento (ex: 50 para inspeção de 50h)
  horas_realizadas?: number | null; // horas realizadas até agora
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ManutencaoWithAircraft extends ManutencaoRow {
  aeronave_registration?: string;
}

export const fetchAircraftMap = async (): Promise<Record<string, string>> => {
  // Try primary table name "aircraft" first (mais comum), fallback to "aeronave"
  const maps: Record<string, string> = {};

  const tryFetch = async (table: any) => {
    try {
      const { data, error } = await supabase.from(table as any).select("id, registration");
      if (!error && data && data.length > 0) {
        for (const row of data as any[]) {
          if (row.id && row.registration) {
            maps[row.id] = row.registration as string;
          }
        }
        console.log(`✅ Carregadas ${data.length} aeronaves da tabela "${table}"`);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Erro ao buscar aeronaves da tabela "${table}":`, err);
      return false;
    }
  };

  // Tentar "aircraft" primeiro
  const ok = await tryFetch("aircraft");
  if (!ok) {
    // Fallback para "aeronave"
    await tryFetch("aeronave");
  }

  console.log(`Total de aeronaves carregadas: ${Object.keys(maps).length}`);
  return maps;
};

export const fetchManutencoesWithAircraft = async (): Promise<ManutencaoWithAircraft[]> => {
  const { data, error } = await supabase
    .from("manutencoes")
    .select("*")
    .order("updated_at", { ascending: false }); // Ordenar por updated_at para incluir manutenções por horas
  if (error) throw error;
  const manutencoes = (data || []) as ManutencaoRow[];
  if (manutencoes.length === 0) return [];

  const aircraftMap = await fetchAircraftMap();
  return manutencoes.map((m) => ({
    ...m,
    aeronave_registration: m.aeronave_id ? aircraftMap[m.aeronave_id] : undefined,
  }));
};

export interface CreateManutencaoInput {
  aeronave_id: string;
  tipo: string;
  data_programada?: string;
  descricao?: string;
  etapa?: string;
  mecanico?: string;
  oficina?: string;
  custo_estimado?: number;
  vencimento_tipo?: string; // 'data' | 'horas'
  vencimento_horas?: number; // horas do vencimento
}

export const createManutencao = async (input: CreateManutencaoInput): Promise<ManutencaoRow> => {
  // Para manutenções por horas, usar data atual como data_programada se não informado
  const data_programada = input.data_programada ||
    (input.vencimento_tipo === 'horas' ? new Date().toISOString() : null);

  const { data, error } = await supabase
    .from("manutencoes")
    .insert({
      aeronave_id: input.aeronave_id,
      tipo: input.tipo,
      data_programada: data_programada,
      observacoes: input.descricao,
      etapa: input.etapa || "pendente",
      mecanico: input.mecanico || "",
      oficina: input.oficina || null,
      custo_estimado: input.custo_estimado || null,
      vencimento_tipo: input.vencimento_tipo || "data",
      vencimento_horas: input.vencimento_horas || null,
      horas_realizadas: 0,
    })
    .select()
    .single();

  if (error) throw error;

  console.log(`✅ Manutenção criada: ${input.tipo} | Tipo: ${input.vencimento_tipo} | Limite: ${input.vencimento_horas}h`);

  return data as ManutencaoRow;
};

/**
 * Atualiza as horas realizadas de uma manutenção
 * Usado quando voos são adicionados/removidos do diário de bordo
 */
export const updateManutencaoHoras = async (
  manutencaoId: string,
  horasRealizadas: number
): Promise<ManutencaoRow> => {
  const { data, error } = await supabase
    .from("manutencoes")
    .update({
      horas_realizadas: horasRealizadas,
      updated_at: new Date().toISOString(),
    })
    .eq("id", manutencaoId)
    .select()
    .single();

  if (error) throw error;
  return data as ManutencaoRow;
};

/**
 * Busca a manutenção de revisão programada para uma aeronave em um período
 */
export const fetchManutencaoRevisao = async (
  aircraftId: string,
  month: number,
  year: number
): Promise<ManutencaoRow | null> => {
  const { data, error } = await supabase
    .from("manutencoes")
    .select("*")
    .eq("aeronave_id", aircraftId)
    .eq("vencimento_tipo", "horas")
    .ilike("tipo", "%revisão%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar manutenção de revisão:", error);
    return null;
  }

  return data as ManutencaoRow | null;
};

/**
 * Busca a manutenção de revisão ativa para uma aeronave (não concluída)
 */
export const fetchManutencaoRevisaoAtiva = async (
  aircraftId: string
): Promise<ManutencaoRow | null> => {
  const { data, error } = await supabase
    .from("manutencoes")
    .select("*")
    .eq("aeronave_id", aircraftId)
    .eq("vencimento_tipo", "horas")
    .ilike("tipo", "%revisão%")
    .neq("etapa", "concluida")
    .neq("etapa", "cancelada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar manutenção de revisão ativa:", error);
    return null;
  }

  return data as ManutencaoRow | null;
};

/**
 * Cria ou atualiza manutenção de revisão para um mês
 * Se houver celula_prox_revisao, cria/atualiza a manutenção automaticamente
 */
export const ensureRevisionMaintenance = async (
  aircraftId: string,
  month: number,
  year: number,
  celulaProxRevisao?: number | null,
  MONTHS?: string[]
): Promise<ManutencaoRow | null> => {
  // Se não há próxima revisão, não fazer nada
  if (!celulaProxRevisao || celulaProxRevisao <= 0) {
    console.log(`⚠️ ensureRevisionMaintenance chamada sem celula_prox_revisao válida: ${celulaProxRevisao}`);
    return null;
  }

  try {
    // Buscar manutenção ativa existente
    const existingMaintenance = await fetchManutencaoRevisaoAtiva(aircraftId);

    if (existingMaintenance) {
      // Se já existe, apenas atualizar o vencimento_horas se for maior
      if (celulaProxRevisao > (existingMaintenance.vencimento_horas || 0)) {
        console.log(`✅ Atualizando manutenção existente: ${celulaProxRevisao}h`);
        return await updateManutencaoHoras(existingMaintenance.id, celulaProxRevisao);
      }
      console.log(`ℹ️ Manutenção ativa já existe com ${existingMaintenance.vencimento_horas}h, não atualizando`);
      return existingMaintenance;
    }

    // Se não existe, criar nova
    const monthName = MONTHS ? MONTHS[month - 1] : `Mês ${month}`;
    console.log(`✅ Criando nova manutenção de revisão: ${celulaProxRevisao}h para ${monthName}/${year}`);
    return await createManutencao({
      aeronave_id: aircraftId,
      tipo: 'Revisão Programada',
      vencimento_tipo: 'horas',
      vencimento_horas: celulaProxRevisao,
      etapa: 'pendente',
      mecanico: 'Sistema',
      descricao: `Revisão programada para ${celulaProxRevisao}h - ${monthName}/${year}`,
    });
  } catch (error) {
    console.error("Erro ao garantir manutenção de revisão:", error);
    return null;
  }
};
