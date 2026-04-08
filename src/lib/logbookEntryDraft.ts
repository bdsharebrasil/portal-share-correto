import React from 'react';

/**
 * Interface para rascunho de lançamento diário do bordo
 * Alinhada com schema: lancamentos_diario_bordo
 */
export interface LancamentoDiarioBordoDraftData {
  // Identificadores e referências
  diario_mes: string;
  aeronave_id: string;
  clientes_id: string | null;
  socios_cliente_id: string | null;
  parceiro_tomador_emprestimo_id: string | null;
  cliente_tomador_emprestimo_id: string | null;

  // Datas e horários
  data_registro: string;
  tripulacao_checkin_hora: string | null;
  data_assinatura_piloto: string | null;

  // Aeródromos e trajeto
  aerodromo_partida: string;
  aerodromo_chegada: string;
  trecho: string | null;

  // Tempos de voo
  tempo_ac: string | null;
  tempo_dep: string | null;
  tempo_pou: string | null;
  tempo_cor: string | null;
  tempo_total: number;
  horas_diurnas: number;
  horas_noturnas: number;
  horas_totais: number;
  tempo_ifr: number;

  // Pousos
  pousos_total: number;

  // Combustível
  consumo_combustivel: number;
  litros_combustivel: number;
  preco_combustivel_litro: number | null;
  local_combustivel: string | null;
  tipo_combustivel: string | null;
  abastecido: boolean;
  combustivel_adicionado: number | null;

  // Célula e horas
  celula: number;

  // Distância e carga
  distancia_nm: number;
  passageiros: number;
  carga_kg: string | null;

  // Natureza do voo
  natureza_voo: string;

  // Observações e registros
  ocorrencias: string | null;
  discrepancias: string | null;
  acoes_corretivas: string | null;

  // Tripulação
  pic_canac: string;
  sic_canac: string | null;
  socios_nome: string | null;
  origem_pic: string;
  origem_sic: string | null;

  // Divisão e empréstimo
  divisao_igual: boolean;
  empreendimento: boolean;

  // Manutenção
  tipo_manutencao_ultima: string | null;
  tipo_manutencao_proxima: string | null;
  horas_celula_proxima_manutencao: number | null;
  responsavel_aprovacao_manutencao: string | null;

  // Tarifa
  tarifa_diaria: string | null;

  // Status
  numero_sequencial: number | null;
  confirmado: boolean;
  fechado: boolean;
}

/**
 * Wrapper para rascunho com metadados
 */
export interface LancamentoDiarioBordoDraft {
  aircraftId: string;
  entry: LancamentoDiarioBordoDraftData;
  savedAt?: string;
}

// Aliases para compatibilidade com código legado
export type LogbookEntryDraftData = LancamentoDiarioBordoDraftData;
export type LogbookEntryDraft = LancamentoDiarioBordoDraft;

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
