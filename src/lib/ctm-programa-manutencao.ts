/**
 * Programa de Manutenção — catálogo regulatório e lógica de vencimentos.
 *
 * Categorias:
 *  - REGULATORIO_ANAC          → obrigatório por lei, prazo fixo (RBAC)
 *  - VIDA_LIMITADA             → overhaul / hard time definido pelo fabricante
 *  - DESGASTE                  → consumíveis (pneu, óleo, freio) por horas/pousos
 *  - PREVENTIVA_PROGRAMADA     → itens do PMAC / PMRF
 *  - EMERGENCIA                → extintor, ELT, coletes, kit de sobrevivência
 */

export type CategoriaPrograma =
  | 'REGULATORIO_ANAC'
  | 'VIDA_LIMITADA'
  | 'DESGASTE'
  | 'PREVENTIVA_PROGRAMADA'
  | 'EMERGENCIA';

export type TipoControle = 'calendario' | 'horas' | 'ciclos' | 'pousos' | 'misto';

export interface CategoriaConfig {
  value: CategoriaPrograma;
  label: string;
  descricao: string;
  cor: string;
  bg: string;
  border: string;
}

export const CATEGORIAS_PROGRAMA: CategoriaConfig[] = [
  {
    value: 'REGULATORIO_ANAC',
    label: 'Regulatório (ANAC)',
    descricao: 'Obrigatório por lei, prazo fixo definido em RBAC/IS',
    cor: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  {
    value: 'VIDA_LIMITADA',
    label: 'Vida limitada / Overhaul',
    descricao: 'Intervalo definido pelo manual do fabricante (TBO, hard time, ICA)',
    cor: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  {
    value: 'DESGASTE',
    label: 'Desgaste / Consumíveis',
    descricao: 'Pneu, óleo, freio, velas — controlados por horas, pousos ou inspeção visual',
    cor: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  {
    value: 'PREVENTIVA_PROGRAMADA',
    label: 'Preventiva / Programada',
    descricao: 'Checklist periódico do PMAC/PMRF aprovado da aeronave',
    cor: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  {
    value: 'EMERGENCIA',
    label: 'Equipamentos de emergência',
    descricao: 'ELT, extintor, coletes, kit de sobrevivência — validade periódica',
    cor: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
];

export const categoriaConfig = (c?: string | null): CategoriaConfig =>
  CATEGORIAS_PROGRAMA.find((x) => x.value === c) ?? CATEGORIAS_PROGRAMA[3];

export const TIPOS_CONTROLE: { value: TipoControle; label: string }[] = [
  { value: 'calendario', label: 'Calendário (meses)' },
  { value: 'horas', label: 'Horas de célula' },
  { value: 'ciclos', label: 'Ciclos' },
  { value: 'pousos', label: 'Pousos' },
  { value: 'misto', label: 'Misto (o que ocorrer primeiro)' },
];

export interface ItemCatalogo {
  categoria: CategoriaPrograma;
  grupo: string;
  item: string;
  base_legal?: string;
  tipo_controle: TipoControle;
  obrigatorio: boolean;
  intervalo_meses?: number;
  intervalo_horas?: number;
  intervalo_pousos?: number;
  intervalo_ciclos?: number;
  observacoes?: string;
}

/**
 * Catálogo padrão. Os valores de fabricante (TBO, óleo, pneu) são sugestões
 * iniciais — devem ser confirmados no manual específico do motor/célula.
 */
export const CATALOGO_PROGRAMA: ItemCatalogo[] = [
  // ── Regulatórios ANAC ──────────────────────────────────────────────
  {
    categoria: 'REGULATORIO_ANAC', grupo: 'Inspeções', item: 'Inspeção Anual de Manutenção (IAM)',
    base_legal: 'RBAC 91.409 + RBAC 43 Apêndice D', tipo_controle: 'calendario',
    obrigatorio: true, intervalo_meses: 12,
  },
  {
    categoria: 'REGULATORIO_ANAC', grupo: 'Inspeções', item: 'Inspeção de 100 horas (instrução / aluguel remunerado)',
    base_legal: 'RBAC 91.409 + RBAC 43 Apêndice D', tipo_controle: 'horas',
    obrigatorio: false, intervalo_horas: 100,
    observacoes: 'Obrigatória apenas se a aeronave for usada para instrução ou aluguel remunerado.',
  },
  {
    categoria: 'REGULATORIO_ANAC', grupo: 'Inspeções', item: 'Verificação de Aeronavegabilidade (PMAC/PMRF)',
    base_legal: 'IS 91.403-001', tipo_controle: 'misto', obrigatorio: true, intervalo_meses: 12,
    observacoes: 'Intervalo definido pelo programa de manutenção adotado pela aeronave.',
  },
  {
    categoria: 'REGULATORIO_ANAC', grupo: 'Limitações', item: 'Cumprimento das Limitações de Aeronavegabilidade (ICA)',
    base_legal: 'RBAC 91.403(c) + RBAC 43.16', tipo_controle: 'misto', obrigatorio: true,
    observacoes: 'Componentes de vida limitada da célula/motor — intervalo conforme seção de limitações do manual.',
  },
  {
    categoria: 'REGULATORIO_ANAC', grupo: 'Diretrizes', item: 'Diretrizes de Aeronavegabilidade (DA/AD) — recorrentes',
    base_legal: 'RBAC 39', tipo_controle: 'misto', obrigatorio: true,
    observacoes: 'Cada DA define seu próprio prazo. Controle item a item na aba AD & SB.',
  },
  {
    categoria: 'REGULATORIO_ANAC', grupo: 'Aviônicos', item: 'Teste do sistema de altímetro e pressão estática (IFR)',
    base_legal: 'RBAC 91.411 + RBAC 43 Apêndice E', tipo_controle: 'calendario', obrigatorio: true, intervalo_meses: 24,
  },
  {
    categoria: 'REGULATORIO_ANAC', grupo: 'Aviônicos', item: 'Teste do transponder',
    base_legal: 'RBAC 91.413 + RBAC 43 Apêndice F', tipo_controle: 'calendario', obrigatorio: true, intervalo_meses: 24,
  },
  {
    categoria: 'REGULATORIO_ANAC', grupo: 'Documentos', item: 'Validade do Certificado de Aeronavegabilidade (CA)',
    base_legal: 'Decorre da IAM em dia', tipo_controle: 'calendario', obrigatorio: true, intervalo_meses: 12,
  },

  // ── Equipamentos de emergência ─────────────────────────────────────
  {
    categoria: 'EMERGENCIA', grupo: 'ELT', item: 'Inspeção do ELT',
    base_legal: 'RBAC 91.207', tipo_controle: 'calendario', obrigatorio: true, intervalo_meses: 12,
  },
  {
    categoria: 'EMERGENCIA', grupo: 'ELT', item: 'Substituição da bateria do ELT',
    base_legal: 'RBAC 91.207', tipo_controle: 'calendario', obrigatorio: true, intervalo_meses: 24,
    observacoes: '50% da vida útil da bateria, ou após 1h de uso cumulativo do transmissor.',
  },
  {
    categoria: 'EMERGENCIA', grupo: 'Cabine', item: 'Inspeção / recarga do extintor de bordo',
    tipo_controle: 'calendario', obrigatorio: true, intervalo_meses: 12,
  },
  {
    categoria: 'EMERGENCIA', grupo: 'Cabine', item: 'Validade dos coletes salva-vidas',
    tipo_controle: 'calendario', obrigatorio: false, intervalo_meses: 24,
  },
  {
    categoria: 'EMERGENCIA', grupo: 'Cabine', item: 'Kit de sobrevivência / primeiros socorros',
    tipo_controle: 'calendario', obrigatorio: false, intervalo_meses: 12,
    observacoes: 'Conforme a área de operação (selva, mar, etc.).',
  },

  // ── Vida limitada / Overhaul (fabricante) ──────────────────────────
  {
    categoria: 'VIDA_LIMITADA', grupo: 'Motor', item: 'TBO do motor (revisão geral)',
    base_legal: 'Manual do fabricante / IS 91.409-001', tipo_controle: 'misto', obrigatorio: true,
    intervalo_horas: 2000, intervalo_meses: 144,
    observacoes: 'Confirmar horas e anos no manual do motor específico (o que ocorrer primeiro).',
  },
  {
    categoria: 'VIDA_LIMITADA', grupo: 'Hélice', item: 'Overhaul da hélice',
    base_legal: 'Manual do fabricante', tipo_controle: 'misto', obrigatorio: true,
    intervalo_horas: 2000, intervalo_meses: 72,
  },
  {
    categoria: 'VIDA_LIMITADA', grupo: 'Hard time', item: 'Magnetos — revisão',
    base_legal: 'Manual / ICA', tipo_controle: 'horas', obrigatorio: true, intervalo_horas: 500,
  },
  {
    categoria: 'VIDA_LIMITADA', grupo: 'Hard time', item: 'Bomba de vácuo',
    base_legal: 'Manual / ICA', tipo_controle: 'horas', obrigatorio: true, intervalo_horas: 500,
  },
  {
    categoria: 'VIDA_LIMITADA', grupo: 'Hard time', item: 'Bomba de combustível',
    base_legal: 'Manual / ICA', tipo_controle: 'horas', obrigatorio: true, intervalo_horas: 1000,
  },

  // ── Desgaste / consumíveis ─────────────────────────────────────────
  {
    categoria: 'DESGASTE', grupo: 'Trem de pouso', item: 'Troca dos pneus principais',
    tipo_controle: 'pousos', obrigatorio: false, intervalo_pousos: 300,
    observacoes: 'Critério adicional: limite de desgaste do sulco em inspeção visual.',
  },
  {
    categoria: 'DESGASTE', grupo: 'Trem de pouso', item: 'Troca do pneu do trem de nariz',
    tipo_controle: 'pousos', obrigatorio: false, intervalo_pousos: 250,
  },
  {
    categoria: 'DESGASTE', grupo: 'Trem de pouso', item: 'Pastilhas / discos de freio',
    tipo_controle: 'pousos', obrigatorio: false, intervalo_pousos: 500,
  },
  {
    categoria: 'DESGASTE', grupo: 'Motor', item: 'Troca de óleo do motor + filtro',
    tipo_controle: 'misto', obrigatorio: true, intervalo_horas: 50, intervalo_meses: 4,
    observacoes: 'Varia por motor (25–50h) e por tempo (4–6 meses), o que ocorrer primeiro.',
  },
  {
    categoria: 'DESGASTE', grupo: 'Motor', item: 'Velas de ignição — limpeza/troca',
    tipo_controle: 'horas', obrigatorio: false, intervalo_horas: 100,
  },
  {
    categoria: 'DESGASTE', grupo: 'Motor', item: 'Filtro de ar e filtro de combustível',
    tipo_controle: 'horas', obrigatorio: false, intervalo_horas: 100,
  },
  {
    categoria: 'DESGASTE', grupo: 'Elétrico', item: 'Checagem de capacidade da bateria',
    tipo_controle: 'calendario', obrigatorio: false, intervalo_meses: 12,
  },

  // ── Preventiva / programada (PMAC / PMRF) ──────────────────────────
  {
    categoria: 'PREVENTIVA_PROGRAMADA', grupo: 'PMRF', item: 'Inspeção programada 50 horas',
    base_legal: 'PMRF / PMAC do fabricante', tipo_controle: 'horas', obrigatorio: true, intervalo_horas: 50,
  },
  {
    categoria: 'PREVENTIVA_PROGRAMADA', grupo: 'PMRF', item: 'Inspeção programada 100 horas',
    base_legal: 'PMRF / PMAC do fabricante', tipo_controle: 'horas', obrigatorio: true, intervalo_horas: 100,
  },
  {
    categoria: 'PREVENTIVA_PROGRAMADA', grupo: 'PMRF', item: 'Inspeção programada 200 horas',
    base_legal: 'PMRF / PMAC do fabricante', tipo_controle: 'horas', obrigatorio: true, intervalo_horas: 200,
  },
  {
    categoria: 'PREVENTIVA_PROGRAMADA', grupo: 'PMRF', item: 'Inspeção programada anual (célula)',
    base_legal: 'PMRF / PMAC do fabricante', tipo_controle: 'calendario', obrigatorio: true, intervalo_meses: 12,
  },
  {
    categoria: 'PREVENTIVA_PROGRAMADA', grupo: 'RBAC 43 Ap. A', item: 'Manutenção preventiva do proprietário/piloto',
    base_legal: 'RBAC 43 Apêndice A', tipo_controle: 'calendario', obrigatorio: false, intervalo_meses: 6,
  },
  {
    categoria: 'PREVENTIVA_PROGRAMADA', grupo: 'Lubrificação', item: 'Lubrificação geral da célula',
    tipo_controle: 'horas', obrigatorio: false, intervalo_horas: 100,
  },
];

// ── Cálculo de status ────────────────────────────────────────────────

export type NivelAlerta = 'vencido' | 'critico' | 'atencao' | 'ok' | 'sem_controle';

export interface EstadoAeronave {
  horas: number;
  pousos: number;
  ciclos: number;
}

export interface ItemPrograma {
  id: string;
  categoria: string;
  grupo?: string | null;
  item: string;
  base_legal?: string | null;
  tipo_controle: string;
  obrigatorio?: boolean | null;
  intervalo_meses?: number | null;
  intervalo_horas?: number | null;
  intervalo_ciclos?: number | null;
  intervalo_pousos?: number | null;
  ultima_execucao_data?: string | null;
  ultima_execucao_horas?: number | null;
  ultima_execucao_ciclos?: number | null;
  ultima_execucao_pousos?: number | null;
  alerta_antecedencia_dias?: number | null;
  alerta_antecedencia_horas?: number | null;
  alerta_antecedencia_pousos?: number | null;
  observacoes?: string | null;
  status?: string | null;
}

export interface DimensaoStatus {
  tipo: 'calendario' | 'horas' | 'ciclos' | 'pousos';
  label: string;
  proximo: string;      // valor formatado do próximo vencimento
  restante: number;     // dias / horas / pousos restantes (negativo = vencido)
  restanteLabel: string;
  progresso: number;    // 0-100 do intervalo consumido
  nivel: NivelAlerta;
}

export interface StatusPrograma {
  item: ItemPrograma;
  dimensoes: DimensaoStatus[];
  nivel: NivelAlerta;
  critica: DimensaoStatus | null;
  resumo: string;
  previsaoData: string | null; // previsão futura estimada (ISO date)
}

const NIVEL_PESO: Record<NivelAlerta, number> = {
  vencido: 4, critico: 3, atencao: 2, ok: 1, sem_controle: 0,
};

export const NIVEL_STYLE: Record<NivelAlerta, { label: string; text: string; bg: string; border: string; bar: string }> = {
  vencido: { label: 'Vencido', text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', bar: 'bg-red-500' },
  critico: { label: 'Crítico', text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/40', bar: 'bg-orange-500' },
  atencao: { label: 'Atenção', text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', bar: 'bg-yellow-500' },
  ok: { label: 'Em dia', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', bar: 'bg-emerald-500' },
  sem_controle: { label: 'Sem intervalo', text: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30', bar: 'bg-slate-500' },
};

const addMonths = (iso: string, meses: number) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const base = new Date(Date.UTC(y, (m - 1) + meses, d));
  return base.toISOString().slice(0, 10);
};

const diffDias = (isoFuturo: string) => {
  const hoje = new Date();
  const hojeUTC = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const [y, m, d] = isoFuturo.slice(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - hojeUTC) / 86400000);
};

export const formatDataBR = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';

function nivelPor(restante: number, limiteAtencao: number): NivelAlerta {
  if (restante <= 0) return 'vencido';
  if (restante <= limiteAtencao * 0.4) return 'critico';
  if (restante <= limiteAtencao) return 'atencao';
  return 'ok';
}

/**
 * Calcula o status de um item do programa considerando todas as dimensões
 * configuradas (calendário, horas, ciclos, pousos). O item vence pelo que
 * ocorrer primeiro.
 */
export function calcularStatusItem(
  item: ItemPrograma,
  estado: EstadoAeronave,
  mediaHorasMes: number,
  mediaPousosMes: number,
): StatusPrograma {
  const dimensoes: DimensaoStatus[] = [];

  // Calendário
  if (item.intervalo_meses && item.ultima_execucao_data) {
    const proximo = addMonths(item.ultima_execucao_data, item.intervalo_meses);
    const restante = diffDias(proximo);
    const totalDias = item.intervalo_meses * 30.44;
    const limite = item.alerta_antecedencia_dias ?? 30;
    dimensoes.push({
      tipo: 'calendario',
      label: `${item.intervalo_meses} ${item.intervalo_meses === 1 ? 'mês' : 'meses'}`,
      proximo: formatDataBR(proximo),
      restante,
      restanteLabel: restante >= 0 ? `${restante} dia(s)` : `${Math.abs(restante)} dia(s) em atraso`,
      progresso: Math.min(100, Math.max(0, ((totalDias - restante) / totalDias) * 100)),
      nivel: nivelPor(restante, limite),
    });
  }

  // Horas
  if (item.intervalo_horas) {
    const base = Number(item.ultima_execucao_horas ?? 0);
    const proximo = base + Number(item.intervalo_horas);
    const restante = proximo - estado.horas;
    const limite = item.alerta_antecedencia_horas ?? 10;
    dimensoes.push({
      tipo: 'horas',
      label: `${item.intervalo_horas}h`,
      proximo: `${proximo.toFixed(1)}h`,
      restante,
      restanteLabel: restante >= 0 ? `${restante.toFixed(1)}h restantes` : `${Math.abs(restante).toFixed(1)}h excedidas`,
      progresso: Math.min(100, Math.max(0, ((Number(item.intervalo_horas) - restante) / Number(item.intervalo_horas)) * 100)),
      nivel: nivelPor(restante, limite),
    });
  }

  // Pousos
  if (item.intervalo_pousos) {
    const base = Number(item.ultima_execucao_pousos ?? 0);
    const proximo = base + Number(item.intervalo_pousos);
    const restante = proximo - estado.pousos;
    const limite = item.alerta_antecedencia_pousos ?? 20;
    dimensoes.push({
      tipo: 'pousos',
      label: `${item.intervalo_pousos} pousos`,
      proximo: `${proximo} pousos`,
      restante,
      restanteLabel: restante >= 0 ? `${restante} pouso(s) restantes` : `${Math.abs(restante)} pouso(s) excedidos`,
      progresso: Math.min(100, Math.max(0, ((Number(item.intervalo_pousos) - restante) / Number(item.intervalo_pousos)) * 100)),
      nivel: nivelPor(restante, limite),
    });
  }

  // Ciclos
  if (item.intervalo_ciclos) {
    const base = Number(item.ultima_execucao_ciclos ?? 0);
    const proximo = base + Number(item.intervalo_ciclos);
    const restante = proximo - estado.ciclos;
    dimensoes.push({
      tipo: 'ciclos',
      label: `${item.intervalo_ciclos} ciclos`,
      proximo: `${proximo} ciclos`,
      restante,
      restanteLabel: restante >= 0 ? `${restante} ciclo(s) restantes` : `${Math.abs(restante)} ciclo(s) excedidos`,
      progresso: Math.min(100, Math.max(0, ((Number(item.intervalo_ciclos) - restante) / Number(item.intervalo_ciclos)) * 100)),
      nivel: nivelPor(restante, 20),
    });
  }

  if (dimensoes.length === 0) {
    return {
      item, dimensoes, nivel: 'sem_controle', critica: null,
      resumo: 'Intervalo não configurado', previsaoData: null,
    };
  }

  const critica = [...dimensoes].sort(
    (a, b) => NIVEL_PESO[b.nivel] - NIVEL_PESO[a.nivel] || b.progresso - a.progresso,
  )[0];

  // Previsão futura: converte o restante em dias usando as médias de utilização
  let previsaoData: string | null = null;
  const hoje = new Date();
  const diasEstimados = (() => {
    if (critica.tipo === 'calendario') return critica.restante;
    if (critica.tipo === 'horas' && mediaHorasMes > 0) return (critica.restante / mediaHorasMes) * 30.44;
    if (critica.tipo === 'pousos' && mediaPousosMes > 0) return (critica.restante / mediaPousosMes) * 30.44;
    return null;
  })();
  if (diasEstimados !== null && Number.isFinite(diasEstimados)) {
    const d = new Date(hoje.getTime() + diasEstimados * 86400000);
    previsaoData = d.toISOString().slice(0, 10);
  }

  return {
    item,
    dimensoes,
    nivel: critica.nivel,
    critica,
    resumo: `${critica.restanteLabel} · próximo em ${critica.proximo}`,
    previsaoData,
  };
}

export function ordenarPorCriticidade(lista: StatusPrograma[]): StatusPrograma[] {
  return [...lista].sort(
    (a, b) => NIVEL_PESO[b.nivel] - NIVEL_PESO[a.nivel] ||
      (b.critica?.progresso ?? 0) - (a.critica?.progresso ?? 0),
  );
}