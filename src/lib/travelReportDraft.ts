import React from 'react';

// ---------------------------------------------------------------------------
// TravelReportDraft — campos espelham travel_expense_reports
// ---------------------------------------------------------------------------
export interface TravelReportDraft {
  id?: string;
  numero_relatorio: string;

  // Relations
  clientes_id: string;
  socios_cliente_id?: string | null;   // was client_partner
  aeronave_id: string;
  matricula_aeronave: string;          // was aircraft_registration

  tripulacao_id: string;               // was crew_member_id  (FK → tripulacao)
  nome_tripulante: string;             // was crew_member_name
  tripulante_id2?: string | null;      // was crew_member_id2 (FK → membros_tripulacao)
  nome_tripulante_2?: string | null;   // was crew_member_name_2

  rota: string;
  data_inicio: string;
  data_fim: string;
  dias_count: number;                  // was days_count
  observacoes: string;                 // was observations

  expenses: Array<{
    id?: string;
    category: string;
    description: string;
    amount: number;
    paid_by: string;
    receipt_url?: string;
    expense_date?: string;
  }>;

  // Totals — nomes das colunas do banco
  total_valor: number;                 // was total_amount
  total_combustivel: number;           // was total_fuel
  total_hospedagem: number;            // was total_lodging
  total_alimentacao: number;           // was total_food
  total_transporte: number;            // was total_transport
  total_outros: number;                // was total_other
  total_tripulacao: number;            // was total_crew
  total_trip: number;                  // was total_crew1
  total_trip2: number;                 // was total_crew2
  total_clientes: number;              // was total_client
  total_sharebrasil: number;

  status: 'Rascunho' | 'Finalizado' | 'Enviado';

  // Display-only
  client?: string;

  // Meta
  savedAt?: string;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const DRAFT_STORAGE_KEY = 'travelReportDraft';
const DRAFT_AUTO_SAVE_INTERVAL = 30_000; // 30 s

export const draftStorage = {
  /** Salva um rascunho no localStorage. */
  saveDraft: (draft: TravelReportDraft): void => {
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ ...draft, savedAt: new Date().toISOString() }),
      );
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
    }
  },

  /** Recupera o rascunho do localStorage. */
  getDraft: (): TravelReportDraft | null => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TravelReportDraft) : null;
    } catch (error) {
      console.error('Erro ao recuperar rascunho:', error);
      return null;
    }
  },

  /** Remove o rascunho do localStorage. */
  clearDraft: (): void => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Erro ao limpar rascunho:', error);
    }
  },

  /** Verifica se existe um rascunho salvo. */
  hasDraft: (): boolean => {
    try {
      return localStorage.getItem(DRAFT_STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  },
};

// ---------------------------------------------------------------------------
// Hook de auto-salvamento
// ---------------------------------------------------------------------------
export const useAutoSaveDraft = (
  draft: TravelReportDraft | null,
  enabled = true,
) => {
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!enabled || !draft) return;

    timerRef.current = setInterval(() => {
      draftStorage.saveDraft(draft);
    }, DRAFT_AUTO_SAVE_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [draft, enabled]);
};