import React from 'react';

export interface LogbookEntryDraftData {
  entry_date: string;
  pic_canac: string;
  sic_canac: string;
  sic_name: string;
  crew_checkin_time: string;
  departure_aerodrome: string;
  arrival_aerodrome: string;
  client_id: string;
  client_partner_id: string | null;
  loan_recipient_client_id: string | null;
  loan_recipient_partner_id: string | null;
  is_equal_split: boolean;
  is_loan: boolean;
  ac_time: string;
  dep_time: string;
  pou_time: string;
  cor_time: string;
  total_time: number;
  day_time: number;
  night_hours: number;
  time: number;
  ifr_time: number;
  pousos: number;
  fuel_added: number;
  fuel_consu: number;
  fuel_liters: number;
  fuel_type: string;
  fuel_location: string;
  fuel_price_per_liter: number;
  refueled: boolean;
  celula: number;
  distance_nm: number;
  passengers: number;
  cargo_kg: number;
  flight_nature: string;
  occurrences: string;
  discrepancies: string;
  corrective_actions: string;
  daily_quantity: number;
}

export interface LogbookEntryDraft {
  aircraftId: string;
  entry: LogbookEntryDraftData;
  savedAt?: string;
}

const DRAFT_AUTO_SAVE_INTERVAL = 30000; // 30 segundos

const getDraftKey = (aircraftId: string): string => `logbookEntryDraft-${aircraftId}`;

export const draftStorage = {
  /**
   * Salva um rascunho no localStorage
   */
  saveDraft: (aircraftId: string, entry: LogbookEntryDraftData): void => {
    try {
      const key = getDraftKey(aircraftId);
      const draftWithTimestamp: LogbookEntryDraft = {
        aircraftId,
        entry,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(draftWithTimestamp));
    } catch (error) {
      console.error('Erro ao salvar rascunho de lançamento:', error);
    }
  },

  /**
   * Recupera um rascunho do localStorage
   */
  getDraft: (aircraftId: string): LogbookEntryDraft | null => {
    try {
      const key = getDraftKey(aircraftId);
      const draft = localStorage.getItem(key);
      return draft ? JSON.parse(draft) : null;
    } catch (error) {
      console.error('Erro ao recuperar rascunho de lançamento:', error);
      return null;
    }
  },

  /**
   * Limpa o rascunho do localStorage
   */
  clearDraft: (aircraftId: string): void => {
    try {
      const key = getDraftKey(aircraftId);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Erro ao limpar rascunho de lançamento:', error);
    }
  },

  /**
   * Verifica se existe um rascunho salvo
   */
  hasDraft: (aircraftId: string): boolean => {
    try {
      const key = getDraftKey(aircraftId);
      return localStorage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Hook para auto-salvamento de rascunho de lançamento
 */
export const useLogbookDraftAutoSave = (
  entry: LogbookEntryDraftData | null,
  aircraftId: string | null,
  enabled: boolean = true
) => {
  const autoSaveRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (!enabled || !entry || !aircraftId) {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
      return;
    }

    // Limpa intervalo anterior se existir
    if (autoSaveRef.current) {
      clearInterval(autoSaveRef.current);
    }

    // Define novo intervalo para auto-salvar
    autoSaveRef.current = setInterval(() => {
      draftStorage.saveDraft(aircraftId, entry);
      console.log('📝 Rascunho do lançamento auto-salvo');
    }, DRAFT_AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [entry, aircraftId, enabled]);
};
