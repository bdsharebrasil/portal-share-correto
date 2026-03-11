import React from 'react';

export interface TravelReportDraft {
  id?: string;
  report_number: string;
  client_id: string;
  client: string;
  client_partner?: string | null;
  aircraft_id: string;
  aircraft_registration: string;
  crew_member_id: string;
  crew_member_name: string;
  crew_member_name_2: string;
  route: string;
  start_date: string;
  end_date: string;
  days_count: number;
  observations: string;
  expenses: Array<{
    category: string;
    description: string;
    amount: number;
    paid_by: string;
    receipt_url?: string;
    id?: string;
  }>;
  total_amount: number;
  total_fuel: number;
  total_lodging: number;
  total_food: number;
  total_transport: number;
  total_other: number;
  total_crew: number;
  total_client: number;
  total_sharebrasil: number;
  status: 'Rascunho' | 'Finalizado' | 'Enviado';
  savedAt?: string;
}

const DRAFT_STORAGE_KEY = 'travelReportDraft';
const DRAFT_AUTO_SAVE_INTERVAL = 30000; // 30 segundos

export const draftStorage = {
  /**
   * Salva um rascunho no localStorage
   */
  saveDraft: (draft: TravelReportDraft): void => {
    try {
      const draftWithTimestamp = {
        ...draft,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftWithTimestamp));
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
    }
  },

  /**
   * Recupera um rascunho do localStorage
   */
  getDraft: (): TravelReportDraft | null => {
    try {
      const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
      return draft ? JSON.parse(draft) : null;
    } catch (error) {
      console.error('Erro ao recuperar rascunho:', error);
      return null;
    }
  },

  /**
   * Limpa o rascunho do localStorage
   */
  clearDraft: (): void => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Erro ao limpar rascunho:', error);
    }
  },

  /**
   * Verifica se existe um rascunho salvo
   */
  hasDraft: (): boolean => {
    try {
      return localStorage.getItem(DRAFT_STORAGE_KEY) !== null;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Hook para auto-salvamento de rascunho
 */
export const useAutoSaveDraft = (draft: TravelReportDraft | null, enabled: boolean = true) => {
  const autoSaveRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (!enabled || !draft) {
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
      draftStorage.saveDraft(draft);
    }, DRAFT_AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, [draft, enabled]);
};