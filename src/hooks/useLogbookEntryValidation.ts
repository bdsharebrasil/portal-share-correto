import { useMemo } from 'react';
import type { LancamentoDiarioBordoDraftData } from '@/lib/logbookEntryDraft';
import {
  isValidFlightNature,
  isValidPICSource,
  isValidSICSource,
  isValidSICEntry,
  validateCellDistribution,
  isValidCPF,
} from '@/utils/flightValidationRules';

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Hook para validação de entrada de diário de bordo contra o schema
 * Executa validações de constraints CHECK e regras de negócio
 */
export function useLogbookEntryValidation(
  entry: Partial<LancamentoDiarioBordoDraftData> | null
): ValidationError[] {
  return useMemo(() => {
    if (!entry) return [];

    const errors: ValidationError[] = [];

    // Validação: natureza_voo deve estar na lista de valores permitidos
    if (entry.natureza_voo) {
      if (!isValidFlightNature(entry.natureza_voo)) {
        errors.push({
          field: 'natureza_voo',
          message: `Natureza de voo inválida: "${entry.natureza_voo}". Valores permitidos: AE, CQ, EX, NR, RE, PV, SA, TN, TR, VOO_CHECK, TRANSLADO, VOO_TESTE, EP`,
          severity: 'error',
        });
      }
    }

    // Validação: origem_pic deve estar na lista de valores permitidos
    if (entry.origem_pic) {
      if (!isValidPICSource(entry.origem_pic)) {
        errors.push({
          field: 'origem_pic',
          message: `Origem do PIC inválida: "${entry.origem_pic}". Valores permitidos: crew_members, crew`,
          severity: 'error',
        });
      }
    }

    // Validação: origem_sic deve estar na lista de valores permitidos
    if (entry.origem_sic) {
      if (!isValidSICSource(entry.origem_sic)) {
        errors.push({
          field: 'origem_sic',
          message: `Origem do SIC inválida: "${entry.origem_sic}". Valores permitidos: crew_members, crew`,
          severity: 'error',
        });
      }
    }

    // Validação: entrada de SIC (CHECK constraint)
    if (!isValidSICEntry(entry.sic_canac, entry.sic_name)) {
      errors.push({
        field: 'sic_entry',
        message: 'SIC inválido: deve ter CANAC ou nome preenchido, ou ambos vazios',
        severity: 'error',
      });
    }

    // Validação: divisão igual requer célula válida
    if (entry.divisao_igual && !validateCellDistribution(entry.divisao_igual, entry.celula)) {
      errors.push({
        field: 'celula',
        message: 'Quando divisão igual é ativada, célula deve ter um valor válido',
        severity: 'error',
      });
    }

    // Validação: socios_cliente_id requer que socios_nome esteja preenchido
    if (entry.socios_cliente_id && !entry.socios_nome) {
      errors.push({
        field: 'socios_nome',
        message: 'Nome do sócio é obrigatório quando sócio é selecionado',
        severity: 'error',
      });
    }

    // Validação: campos de CPF (se implementado para sócios)
    // Nota: O schema não força validação de CPF em lancamentos_diario_bordo,
    // mas é importante validar em socios_cliente

    // Validação: confirmado_por requer confirmado = true
    if (!entry.confirmado && entry.confirmado_por) {
      errors.push({
        field: 'confirmado',
        message: 'Entrada deve ser marcada como confirmada para registrar quem confirmou',
        severity: 'warning',
      });
    }

    // Validação: fechado_por requer fechado = true
    if (!entry.fechado && entry.fechado_por) {
      errors.push({
        field: 'fechado',
        message: 'Entrada deve ser marcada como fechada para registrar quem fechou',
        severity: 'warning',
      });
    }

    // Validação: campos de tempo devem ser numéricos e não-negativos
    if (entry.tempo_total !== undefined && entry.tempo_total !== null && entry.tempo_total < 0) {
      errors.push({
        field: 'tempo_total',
        message: 'Tempo total não pode ser negativo',
        severity: 'error',
      });
    }

    if (entry.horas_diurnas !== undefined && entry.horas_diurnas !== null && entry.horas_diurnas < 0) {
      errors.push({
        field: 'horas_diurnas',
        message: 'Horas diurnas não podem ser negativas',
        severity: 'error',
      });
    }

    if (entry.horas_noturnas !== undefined && entry.horas_noturnas !== null && entry.horas_noturnas < 0) {
      errors.push({
        field: 'horas_noturnas',
        message: 'Horas noturnas não podem ser negativas',
        severity: 'error',
      });
    }

    // Validação: célula não pode ser negativa
    if (entry.celula !== undefined && entry.celula !== null && entry.celula < 0) {
      errors.push({
        field: 'celula',
        message: 'Célula não pode ser negativa',
        severity: 'error',
      });
    }

    // Validação: consumo de combustível não pode ser negativo
    if (entry.consumo_combustivel_voo !== undefined && entry.consumo_combustivel_voo !== null && entry.consumo_combustivel_voo < 0) {
      errors.push({
        field: 'consumo_combustivel_voo',
        message: 'Consumo de combustível não pode ser negativo',
        severity: 'error',
      });
    }

    // Validação: empréstimo requer cliente tomador
    if (entry.emprestimo && !entry.cliente_tomador_emprestimo_id) {
      errors.push({
        field: 'cliente_tomador_emprestimo_id',
        message: 'Cliente tomador é obrigatório em voos de empréstimo',
        severity: 'error',
      });
    }

    return errors;
  }, [entry]);
}
