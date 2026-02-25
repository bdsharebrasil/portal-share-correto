/**
 * Tipos TypeScript para o sistema de consolidação de rateio
 */

/**
 * Categoria de movimentação financeira
 */
export interface CategoriaMovimentacao {
  id: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  grupo_categoria: 'COMBUSTIVEIS' | 'MANUTENCAO' | 'HANGAR_TAXAS' | 'CUSTO_TERCEIRO' | 'TRIPULACAO_ADM';
  descricao?: string;
  ativo: boolean;
  reembolsavel: boolean;
  icone?: string;
  cor?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Lançamento financeiro (despesa ou receita)
 */
export interface Lancamento {
  id: string;
  tipo: 'receita' | 'despesa';
  categoria_id: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  referencia_mes?: number;
  referencia_ano?: number;
  status: 'pendente' | 'pago' | 'cancelado';
  observacoes?: string;
  aeronave_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Rateio de lançamento entre clientes
 */
export interface LancamentoRateio {
  id: string;
  lancamento_id: string;
  cliente_id: string;
  valor_rateado: number;
  tipo_rateio: 'percentual' | 'horas_uso' | 'fixo';
  percentual?: number;
  horas_voadas?: number;
  status: 'pendente' | 'conciliado' | 'quitado' | 'cancelado';
  data_conciliacao?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Transação bancária importada
 */
export interface BankTransaction {
  id: string;
  data_transacao: string;
  descricao: string;
  tipo: 'debito' | 'credito';
  valor: number;
  saldo?: number;
  banco?: string;
  conta?: string;
  numero_documento?: string;
  data_importacao: string;
  importado_por?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Conciliação entre lançamento rateio e transação bancária
 */
export interface BankReconciliation {
  id: string;
  lancamento_rateio_id: string;
  bank_transaction_id: string;
  status: 'pendente' | 'conciliado' | 'consolidado';
  data_conciliacao?: string;
  conciliado_por?: string;
  historico_id?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Horas voadas por cliente e aeronave
 */
export interface HorasVoo {
  id: string;
  cliente_id: string;
  aeronave_id: string;
  data_voo: string;
  horas_voadas: number;
  descricao?: string;
  entrada_diario_bordo?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Histórico consolidado de rateio (permanente)
 */
export interface HistoricoRateioConsolidado {
  id: string;
  bank_transaction_id?: string;
  bank_reconciliation_id?: string;
  lancamento_rateio_id?: string;
  aeronave_id: string;
  aeronave_registro: string;
  cliente_id: string;
  cliente_nome: string;
  data_competencia: string;
  data_pagamento?: string;
  data_conciliacao?: string;
  horas_voadas: number;
  horas_totais_aeronave: number;
  percentual_uso: number;
  categoria_id: string;
  categoria_nome: string;
  categoria_grupo: string;
  descricao?: string;
  valor_total_lancamento: number;
  valor_rateado: number;
  valor_pago: number;
  tipo_rateio: 'percentual' | 'horas_uso';
  foi_reembolso: boolean;
  documento_fiscal?: string;
  status: 'consolidado';
  consolidado_por?: string;
  consolidado_em: string;
  created_at: string;
  updated_at: string;
}

/**
 * Consolidação mensal de horas
 */
export interface HorasMensaisConsolidadas {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  aeronave_id: string;
  aeronave_registro: string;
  ano: number;
  mes: number;
  horas_voadas: number;
  horas_totais_aeronave: number;
  percentual_uso: number;
  validado: boolean;
  data_validacao?: string;
  validado_por?: string;
  fonte_diario_bordo: boolean;
  fonte_portal_cliente: boolean;
  consolidado_em: string;
  consolidado_por?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Resumo mensal de custos (view)
 */
export interface ResumoMensalCliente {
  cliente_id: string;
  cliente_nome: string;
  aeronave_id: string;
  aeronave_registro: string;
  ano: number;
  mes: number;
  categoria_grupo: string;
  categoria_nome: string;
  num_lancamentos: number;
  total_categoria: number;
  total_horas_cliente: number;
  horas_totais_aeronave: number;
  percentual_uso_medio: number;
  valor_reembolso: number;
}

/**
 * Extrato do cliente (view)
 */
export interface ExtratoCliente {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  aeronave_id: string;
  aeronave_registro: string;
  data_competencia: string;
  data_pagamento?: string;
  data_conciliacao?: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_grupo: string;
  descricao?: string;
  tipo_rateio: 'percentual' | 'horas_uso';
  horas_voadas: number;
  percentual_uso: number;
  valor_total_lancamento: number;
  valor_rateado: number;
  valor_pago: number;
  foi_reembolso: boolean;
  documento_fiscal?: string;
  status_pagamento: 'Pago' | 'Pendente' | 'Parcialmente Pago';
  saldo_devedor: number;
}

/**
 * Comparativo de uso entre clientes (view)
 */
export interface ComparativoUsoClientes {
  aeronave_id: string;
  aeronave_registro: string;
  ano: number;
  mes: number;
  cliente_id: string;
  cliente_nome: string;
  horas_voadas: number;
  horas_totais_aeronave: number;
  percentual_uso: number;
  percentual_exato: number;
  ranking: number;
  total_clientes: number;
  validado: boolean;
  fonte_diario_bordo: boolean;
  fonte_portal_cliente: boolean;
}

/**
 * Pendências do cliente (view)
 */
export interface PendenciasCliente {
  cliente_id: string;
  cliente_nome: string;
  total_lancamentos_pendentes: number;
  total_pendente: number;
  periodo_inicio: string;
  periodo_fim: string;
  dias_pendente: number;
}

/**
 * Análise anual do cliente (view)
 */
export interface AnaliseAnualCliente {
  cliente_id: string;
  cliente_nome: string;
  ano: number;
  categoria_grupo: string;
  num_lancamentos: number;
  total_ano: number;
  total_horas: number;
  percentual_uso_medio: number;
  primeira_despesa: string;
  ultima_despesa: string;
}

/**
 * Reembolsos pendentes (view)
 */
export interface ReembolsoPendente {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  data_competencia: string;
  data_pagamento: string;
  categoria_nome: string;
  descricao: string;
  valor_rateado: number;
  dias_desde_pagamento: number;
}

/**
 * Status de conciliação (view)
 */
export interface ConciliacaoStatus {
  pendentes: number;
  conciliadas: number;
  consolidadas: number;
  total: number;
  valor_pendente: number;
  valor_conciliado: number;
  valor_consolidado: number;
}

/**
 * Response de consolidação de rateio
 */
export interface ConsolidarRateioResponse {
  data: {
    historico_id: string;
  };
  message: string;
  timestamp: string;
}

/**
 * Response de consolidação de horas
 */
export interface ConsolidarHorasResponse {
  data: {
    id: string;
  };
  message: string;
  timestamp: string;
}

/**
 * Response do extrato do cliente
 */
export interface ExtratoClienteResponse {
  data: ExtratoCliente[];
  count: number;
  timestamp: string;
}

/**
 * Response do resumo mensal
 */
export interface ResumoMensalResponse {
  data: ResumoMensalCliente[];
  summary: {
    total_gasto: number;
    total_horas: number;
    num_categorias: number;
  };
  timestamp: string;
}

/**
 * Response do comparativo de uso
 */
export interface ComparativoUsoResponse {
  data: ComparativoUsoClientes[];
  summary: {
    total_clientes: number;
    total_horas: number;
  };
  timestamp: string;
}

/**
 * Response de pendências
 */
export interface PendenciasResponse {
  data: PendenciasCliente;
  timestamp: string;
}

/**
 * Response de análise anual
 */
export interface AnaliseAnualResponse {
  data: AnaliseAnualCliente[];
  timestamp: string;
}

/**
 * Response de reembolsos pendentes
 */
export interface ReembolsosResponse {
  data: ReembolsoPendente[];
  summary: {
    total_reembolsos: number;
    count: number;
  };
  timestamp: string;
}

/**
 * Response do status de conciliação
 */
export interface ConciliacaoStatusResponse {
  data: ConciliacaoStatus;
  timestamp: string;
}
