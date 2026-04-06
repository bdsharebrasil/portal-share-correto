import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import {
  validateFlightEntry,
  FlightEntry,
  FlightType,
  formatValidationErrors,
} from '@/validators/flightEntryValidator';
import {
  calculateBlockTime,
  calculateFlightTime,
  calculateDailyAllowanceForEntry,
} from '@/utils/calculationUtils';
import { updateCrewFlightHours } from '@/services/crewFlightHours';

const toNumberOrNull = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const converted = Number(String(value).replace(',', '.'));
  return Number.isFinite(converted) ? converted : null;
};

const toBoolean = (value: any): boolean | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'sim'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'não', 'nao'].includes(normalized)) return false;
  return null;
};

const sanitizeFlightEntry = (entry: any) => ({
  ...entry,
  total_time: toNumberOrNull(entry.total_time),
  time: toNumberOrNull(entry.time),
  day_time: toNumberOrNull(entry.day_time),
  night_hours: toNumberOrNull(entry.night_hours),
  ifr_time: toNumberOrNull(entry.ifr_time),
  distance_nm: toNumberOrNull(entry.distance_nm),
  pousos: toNumberOrNull(entry.pousos),
  fuel_added: toNumberOrNull(entry.fuel_added),
  fuel_liters: toNumberOrNull(entry.fuel_liters),
  fuel_price_per_liter: toNumberOrNull(entry.fuel_price_per_liter),
  celula: toNumberOrNull(entry.celula),
  daily_rate: toNumberOrNull(entry.daily_rate),
  is_equal_split: toBoolean(entry.is_equal_split),
  is_loan: toBoolean(entry.is_loan),
  refueled: toBoolean(entry.refueled),
  confirmed: toBoolean(entry.confirmed),
  // keep strings as-is for text fields
});

export interface FlightServiceConfig {
  aircraftId: string;
  logbookMonthId?: string | null;
  baseAerodrome?: string | null;
}

/**
 * Serviço centralizado para operações com voos
 */
export class FlightService {
  /**
   * Salva um novo voo ou atualiza um existente
   */
  static async saveFlightEntry(
    entry: FlightEntry,
    config: FlightServiceConfig,
    flightType: FlightType
  ): Promise<FlightEntry> {
    try {
      // Validar entrada
      const validation = validateFlightEntry(entry, flightType);
      if (!validation.isValid) {
        const errorMessage = formatValidationErrors(validation.errors);
        throw new Error(`Validação falhou:\n${errorMessage}`);
      }

      logger.info('Validação de voo passou', { entryId: entry.id });

      // Processar dados do voo
      const processedEntry = this.processFlightEntry(entry, config);

      // Salvar no banco
      let result: FlightEntry;
      if (entry.id) {
        result = await this.updateFlightEntry(entry.id, processedEntry);
        logger.success('Voo atualizado', { entryId: entry.id });
      } else {
        result = await this.createFlightEntry(processedEntry, config);
        logger.success('Voo criado', { entryId: result.id });
      }

      // Atualizar horas da tripulação
      await this.updateCrewHours(result, config.aeronaveId);

      // Processar empréstimo se necessário
      if (flightType === 'emprestimo' && result) {
        await this.handleLoanProcessing(result, config);
      }

      return result;
    } catch (error) {
      logger.error('Erro ao salvar voo', error);
      throw error;
    }
  }

  /**
   * Processa e enriquece dados do voo com cálculos
   */
  private static processFlightEntry(
    entry: FlightEntry,
    config: FlightServiceConfig
  ): FlightEntry {
    const normalized = sanitizeFlightEntry(entry);

    const blockTime = calculateBlockTime(normalized.ac_time, normalized.cor_time);
    const flightTime = calculateFlightTime(normalized.dep_time, normalized.pou_time);

    return {
      ...normalized,
      total_time: blockTime,
      time: flightTime,
      // day_time e night_time já foram calculados no frontend com cálculo solar correto
      aeronave_id: config.aeronaveId,
    } as any;
  }

  /**
   * Cria uma nova entrada de voo
   */
  private static async createFlightEntry(
    entry: FlightEntry,
    config: FlightServiceConfig
  ): Promise<FlightEntry> {
    const { data, error } = await supabase
      .from('logbook_entries')
      .insert([entry as any])
      .select()
      .single();

    if (error) {
      logger.error('Erro ao inserir voo', error);
      throw error;
    }

    return data as FlightEntry;
  }

  /**
   * Atualiza uma entrada de voo existente
   */
  private static async updateFlightEntry(
    entryId: string,
    entry: FlightEntry
  ): Promise<FlightEntry> {
    const { data, error } = await supabase
      .from('logbook_entries')
      .update(entry)
      .eq('id', entryId)
      .select()
      .single();

    if (error) {
      logger.error('Erro ao atualizar voo', error);
      throw error;
    }

    return data as FlightEntry;
  }

  /**
   * Deleta um voo
   */
  static async deleteFlightEntry(entryId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('logbook_entries')
        .delete()
        .eq('id', entryId);

      if (error) {
        logger.error('Erro ao deletar voo', error);
        throw error;
      }

      logger.success('Voo deletado', { entryId });
    } catch (error) {
      logger.error('Erro ao deletar voo', error);
      throw error;
    }
  }

  /**
   * Atualiza horas de voo da tripulação
   */
  private static async updateCrewHours(
    entry: FlightEntry,
    aircraftId: string
  ): Promise<void> {
    try {
      const date = new Date(entry.entry_date);
      await updateCrewFlightHours({
        picId: entry.pic_canac,
        sicId: entry.sic_canac || null,
        aircraftId,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        totalTime: entry.total_time || 0,
        ifrTime: entry.ifr_time || 0,
        nightHours: entry.night_time || 0,
        flightDay: entry.entry_date,
        operation: 'add',
      });
      logger.success('Horas de tripulação atualizadas');
    } catch (error) {
      logger.warning('Erro ao atualizar horas de tripulação', error);
      // Não lançar erro, apenas avisar
    }
  }

  /**
   * Processa empréstimo de aeronave
   */
  private static async handleLoanProcessing(
    entry: FlightEntry,
    config: FlightServiceConfig
  ): Promise<void> {
    try {
      // Criar registro de empréstimo
      const { error: loanError } = await (supabase as any)
        .from('emprestimos_aeronave')
        .insert([
          {
            hours_borrowed: entry.total_time,
            entry_date: entry.entry_date,
            logbook_entry_id: entry.id,
            status: 'active',
          },
        ]);

      if (loanError) {
        logger.warning('Erro ao registrar empréstimo', loanError);
      } else {
        logger.success('Empréstimo registrado');
      }

      // Registrar transação no banco de horas
      const { error: transError } = await supabase
        .from('hour_transactions')
        .insert([
          {
            aeronave_id: config.aeronaveId,
            from_partner_id: entry.loan_recipient_client_id,
            to_partner_id: entry.cliente_id,
            hours: entry.total_time,
            type: 'loan',
            logbook_entry_id: entry.id,
          },
        ]);

      if (transError && transError.code !== '403') {
        logger.warning('Erro ao registrar transação', transError);
      } else if (!transError) {
        logger.success('Transação de horas registrada');
      }
    } catch (error) {
      logger.error('Erro ao processar empréstimo', error);
      throw error;
    }
  }

  /**
   * Carrega entradas de voo para um mês
   */
  static async loadFlightEntries(
    logbookMonthId: string
  ): Promise<FlightEntry[]> {
    try {
      const { data, error } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('logbook_month_id', logbookMonthId)
        .order('entry_date', { ascending: true });

      if (error) throw error;

      logger.success('Entradas carregadas', { count: data?.length || 0 });
      return data as FlightEntry[];
    } catch (error) {
      logger.error('Erro ao carregar entradas', error);
      throw error;
    }
  }

  /**
   * Confirma/desconfirma uma entrada
   */
  static async toggleConfirmation(
    entryId: string,
    confirmed: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('logbook_entries')
        .update({ confirmed })
        .eq('id', entryId);

      if (error) throw error;

      logger.success(`Voo ${confirmed ? 'confirmado' : 'desconfirmado'}`, {
        entryId,
      });
    } catch (error) {
      logger.error('Erro ao confirmar voo', error);
      throw error;
    }
  }
}