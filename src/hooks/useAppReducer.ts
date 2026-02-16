import { useReducer, useCallback } from 'react';
import {
  AppState,
  AppAction,
  FlightEntry,
  UIState,
  PeriodState,
  FormState,
} from '@/types/diarioTypes';

/**
 * Estado inicial
 */
const getInitialState = (): AppState => ({
  ui: {
    showMonthPicker: false,
    showAddForm: false,
    showTechnicalStatus: false,
    showMaintenanceStatus: false,
    showExportDialog: false,
    showCloseDialog: false,
    editingField: null,
    isLoading: false,
    isSaving: false,
  },
  period: {
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),
    availableMonths: [],
    logbookMonthId: null,
  },
  form: {
    newEntry: getEmptyFlightEntry(),
    editingEntryId: null,
    flightType: 'cliente',
    selectedClient: null,
    selectedBorrowerClient: null,
  },
});

/**
 * Cria uma entrada de voo vazia
 */
function getEmptyFlightEntry(): FlightEntry {
  return {
    entry_date: new Date().toISOString().split('T')[0],
    departure_aerodrome: '',
    arrival_aerodrome: '',
    ac_time: '',
    dep_time: '',
    pou_time: '',
    cor_time: '',
    pic_canac: '',
    sic_canac: '',
  };
}

/**
 * Reducer para gerenciar estado complexo
 */
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_UI_STATE':
      return {
        ...state,
        ui: { ...state.ui, ...action.payload },
      };

    case 'SET_PERIOD_STATE':
      return {
        ...state,
        period: { ...state.period, ...action.payload },
      };

    case 'SET_FORM_STATE':
      return {
        ...state,
        form: { ...state.form, ...action.payload },
      };

    case 'RESET_FORM':
      return {
        ...state,
        form: {
          newEntry: getEmptyFlightEntry(),
          editingEntryId: null,
          flightType: 'cliente',
          selectedClient: null,
          selectedBorrowerClient: null,
        },
      };

    case 'SET_LOADING':
      return {
        ...state,
        ui: { ...state.ui, isLoading: action.payload },
      };

    case 'SET_SAVING':
      return {
        ...state,
        ui: { ...state.ui, isSaving: action.payload },
      };

    default:
      return state;
  }
}

/**
 * Hook customizado com useReducer
 * Expõe ações mais idiomáticas
 */
export function useAppReducer() {
  const [state, dispatch] = useReducer(appReducer, getInitialState());

  // ===================== UI Actions =====================
  const setUIState = useCallback((ui: Partial<UIState>) => {
    dispatch({ type: 'SET_UI_STATE', payload: ui });
  }, []);

  const toggleShowMonthPicker = useCallback(() => {
    dispatch({
      type: 'SET_UI_STATE',
      payload: { showMonthPicker: !state.ui.showMonthPicker },
    });
  }, [state.ui.showMonthPicker]);

  const toggleShowAddForm = useCallback(() => {
    dispatch({
      type: 'SET_UI_STATE',
      payload: { showAddForm: !state.ui.showAddForm },
    });
  }, [state.ui.showAddForm]);

  const toggleShowTechnicalStatus = useCallback(() => {
    dispatch({
      type: 'SET_UI_STATE',
      payload: { showTechnicalStatus: !state.ui.showTechnicalStatus },
    });
  }, [state.ui.showTechnicalStatus]);

  const toggleShowExportDialog = useCallback(() => {
    dispatch({
      type: 'SET_UI_STATE',
      payload: { showExportDialog: !state.ui.showExportDialog },
    });
  }, [state.ui.showExportDialog]);

  const toggleShowCloseDialog = useCallback(() => {
    dispatch({
      type: 'SET_UI_STATE',
      payload: { showCloseDialog: !state.ui.showCloseDialog },
    });
  }, [state.ui.showCloseDialog]);

  const setEditingField = useCallback((fieldName: string | null) => {
    dispatch({
      type: 'SET_UI_STATE',
      payload: { editingField: fieldName },
    });
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: isLoading });
  }, []);

  const setSaving = useCallback((isSaving: boolean) => {
    dispatch({ type: 'SET_SAVING', payload: isSaving });
  }, []);

  // ===================== Period Actions =====================
  const setPeriod = useCallback((month: number, year: number) => {
    dispatch({
      type: 'SET_PERIOD_STATE',
      payload: { selectedMonth: month, selectedYear: year },
    });
  }, []);

  const setAvailableMonths = useCallback(
    (months: Array<{ month: number; year: number; id: string }>) => {
      dispatch({
        type: 'SET_PERIOD_STATE',
        payload: { availableMonths: months },
      });
    },
    []
  );

  const setLogbookMonthId = useCallback((id: string | null) => {
    dispatch({
      type: 'SET_PERIOD_STATE',
      payload: { logbookMonthId: id },
    });
  }, []);

  // ===================== Form Actions =====================
  const setNewEntry = useCallback((entry: Partial<FlightEntry>) => {
    dispatch({
      type: 'SET_FORM_STATE',
      payload: {
        newEntry: { ...state.form.newEntry, ...entry },
      },
    });
  }, [state.form.newEntry]);

  const setFlightType = useCallback(
    (flightType: 'cliente' | 'rateio' | 'emprestimo') => {
      dispatch({
        type: 'SET_FORM_STATE',
        payload: { flightType },
      });
    },
    []
  );

  const setSelectedClient = useCallback((clientId: string | null) => {
    dispatch({
      type: 'SET_FORM_STATE',
      payload: { selectedClient: clientId },
    });
  }, []);

  const setSelectedBorrowerClient = useCallback(
    (clientId: string | null) => {
      dispatch({
        type: 'SET_FORM_STATE',
        payload: { selectedBorrowerClient: clientId },
      });
    },
    []
  );

  const setEditingEntryId = useCallback((id: string | null) => {
    dispatch({
      type: 'SET_FORM_STATE',
      payload: { editingEntryId: id },
    });
  }, []);

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM' });
  }, []);

  return {
    state,
    // UI
    setUIState,
    toggleShowMonthPicker,
    toggleShowAddForm,
    toggleShowTechnicalStatus,
    toggleShowExportDialog,
    toggleShowCloseDialog,
    setEditingField,
    setLoading,
    setSaving,
    // Period
    setPeriod,
    setAvailableMonths,
    setLogbookMonthId,
    // Form
    setNewEntry,
    setFlightType,
    setSelectedClient,
    setSelectedBorrowerClient,
    setEditingEntryId,
    resetForm,
  };
}
