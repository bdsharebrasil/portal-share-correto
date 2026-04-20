/**
 * Mapeador de campos entre schema PostgreSQL e tipos TypeScript
 * Converte entre nomes em português (schema) e nomes em inglês/camelCase (código)
 */

/**
 * Mapeamento para tabela diario_mes
 */
export const diarioMesFieldMap = {
  // Schema -> TypeScript
  'id': 'id',
  'aeronave_id': 'aircraftId',
  'ano': 'year',
  'mes': 'month',
  'celula_anterior_ttotal': 'cellPreviousTotal',
  'celula_atual_ttotal': 'cellCurrentTotal',
  'celula_prox_revisao_ttotal': 'cellNextMaintenanceTotal',
  'celula_disponivel_ttotal': 'cellAvailableTotal',
  'horimetro_inicio': 'horimeterStart',
  'horimetro_final': 'horimeterEnd',
  'horimetro_ativo': 'horimeterActive',
  'criado_em': 'createdAt',
  'fechado': 'closed',
  'confirmado': 'confirmed',
  'confirmado_em': 'confirmedAt',
  'confirmado_por': 'confirmedBy',
  'aerodromo_base': 'baseAerodrome',
  'tarifa_diaria': 'dailyRate',
  'consumo_combustivel': 'fuelConsumption',
  'tem_tarifa_diaria': 'hasDailyRate',
  'celula_atual_tvoo': 'cellCurrentFlightTime',
  'celula_disponivel_tvoo': 'cellAvailableFlightTime',
  'celula_anterior_tvoo': 'cellPreviousFlightTime',
  'celula_prox_revisao_tvoo': 'cellNextMaintenanceFlightTime',
} as const;

/**
 * Mapeamento para tabela lancamentos_diario_bordo
 */
export const lancamentoDiarioBordoFieldMap = {
  // Identificadores
  'id': 'id',
  'diario_mes': 'logbookMonthId',
  'aeronave_id': 'aircraftId',
  'clientes_id': 'clientId',
  'socios_cliente_id': 'partnerClientId',
  
  // Datas e horários
  'data_registro': 'entryDate',
  'tripulacao_checkin_hora': 'crewCheckinTime',
  'data_assinatura_piloto': 'pilotSignatureDate',
  
  // Aeródromos
  'aerodromo_partida': 'departureAerodrome',
  'aerodromo_chegada': 'arrivalAerodrome',
  'trecho': 'route',
  
  // Tempos de voo
  'tempo_ac': 'acTime',
  'tempo_dep': 'depTime',
  'tempo_pou': 'pouTime',
  'tempo_cor': 'corTime',
  'tempo_total': 'totalTime',
  'horas_diurnas': 'dayHours',
  'horas_noturnas': 'nightHours',
  'tempo_ifr': 'ifrTime',
  
  // Pousos
  'pousos_total': 'totalLandings',
  
  // Combustível
  'consumo_combustivel_voo': 'fuelConsumption',
  'litros_combustivel_inicio_voo': 'fuelLitersStart',
  'preco_combustivel_litro': 'fuelPricePerLiter',
  'local_combustivel': 'fuelLocation',
  'tipo_combustivel': 'fuelType',
  'abastecido': 'refueled',
  'combustivel_adicionado': 'fuelAdded',
  'consumo_combustivel_total': 'totalFuelConsumption',
  
  // Célula
  'celula': 'cellHours',
  'celula_tvoo': 'cellFlightTime',
  
  // Tripulação
  'pic_canac': 'picCanac',
  'sic_canac': 'sicCanac',
  'sic_name': 'sicName',
  'origem_pic': 'picOrigin',
  'origem_sic': 'sicOrigin',
  'socios_nome': 'partnerName',
  
  // Cliente/Empréstimo
  'divisao_igual': 'equalSplit',
  'emprestimo': 'isLoan',
  'cliente_tomador_emprestimo_id': 'loanRecipientClientId',
  'parceiro_tomador_emprestimo_id': 'loanRecipientPartnerId',
  
  // Distância e carga
  'distancia_nm': 'distanceNM',
  'passageiros': 'passengers',
  'carga_kg': 'cargoKg',
  
  // Natureza do voo
  'natureza_voo': 'flightNature',
  
  // Observações
  'ocorrencias': 'occurrences',
  'discrepancias': 'discrepancies',
  'acoes_corretivas': 'correctiveActions',
  
  // Status
  'numero_sequencial': 'sequentialNumber',
  'confirmado': 'confirmed',
  'confirmado_por': 'confirmedBy',
  'confirmado_em': 'confirmedAt',
  'fechado': 'closed',
  'fechado_por': 'closedBy',
  'fechado_em': 'closedAt',
  'criado_em': 'createdAt',
  'criado_por': 'createdBy',
  'detectado_por': 'detectedBy',
  
  // Manutenção
  'tipo_manutencao_ultima': 'lastMaintenanceType',
  'tipo_manutencao_proxima': 'nextMaintenanceType',
  'horas_celula_proxima_manutencao': 'cellHoursNextMaintenance',
  'responsavel_aprovacao_manutencao': 'maintenanceApprovalResponsible',
  
  // Tarifa
  'tarifa_diaria': 'dailyRate',
} as const;

/**
 * Reversible map: TypeScript -> Schema (para lancamentos_diario_bordo)
 */
export const lancamentoDiarioBordoReverseMap = Object.fromEntries(
  Object.entries(lancamentoDiarioBordoFieldMap).map(([schema, ts]) => [ts, schema])
) as Record<string, string>;

/**
 * Reversible map: TypeScript -> Schema (para diario_mes)
 */
export const diarioMesReverseMap = Object.fromEntries(
  Object.entries(diarioMesFieldMap).map(([schema, ts]) => [ts, schema])
) as Record<string, string>;

/**
 * Converter objeto com campos do schema para formato TypeScript
 */
export function mapFromSchema<T extends Record<string, any>>(
  data: T,
  fieldMap: Record<string, string>
): Partial<Record<string, any>> {
  const result: Record<string, any> = {};
  
  for (const [schemaKey, tsKey] of Object.entries(fieldMap)) {
    if (schemaKey in data) {
      result[tsKey] = data[schemaKey];
    }
  }
  
  return result;
}

/**
 * Converter objeto com campos TypeScript para formato schema
 */
export function mapToSchema<T extends Record<string, any>>(
  data: T,
  reverseMap: Record<string, string>
): Partial<Record<string, any>> {
  const result: Record<string, any> = {};
  
  for (const [tsKey, schemaKey] of Object.entries(reverseMap)) {
    if (tsKey in data) {
      result[schemaKey] = data[tsKey];
    }
  }
  
  return result;
}

/**
 * Helper para manter campos originais do schema
 * Útil quando queremos usar os nomes nativos do banco de dados
 */
export function preserveSchemaFields<T extends Record<string, any>>(
  data: T
): T {
  return data;
}
