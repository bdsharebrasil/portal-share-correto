// hooks/useFlightEntries.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FlightEntry } from '../types';

export function useFlightEntries(aircraftId: string, logbookMonthId?: string) {
  const {
    data: entries = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['logbook-entries', logbookMonthId],
    queryFn: async (): Promise<FlightEntry[]> => {
      if (!logbookMonthId) return [];

      const { data, error } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('logbook_month_id', logbookMonthId)
        .order('entry_date', { ascending: true })
        .order('ac_time', { ascending: true });

      if (error) {
        console.error('Erro ao buscar entradas:', error);
        throw error;
      }

      return (data || []) as FlightEntry[];
    },
    enabled: !!logbookMonthId,
  });

  // Filtrar entradas se necessário
  const filteredEntries = entries.filter(entry => {
    // Adicionar lógica de filtro aqui se necessário
    return true;
  });

  return {
    entries,
    filteredEntries,
    isLoading,
    refetch,
  };
}