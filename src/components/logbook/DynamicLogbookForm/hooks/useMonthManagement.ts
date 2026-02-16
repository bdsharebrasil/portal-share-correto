import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LogbookMonth } from '../types';

export function useMonthManagement(aircraftId: string) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Buscar ou criar logbook_month
  const { data: logbookMonth, refetch: refetchLogbookMonth } = useQuery({
    queryKey: ['logbook-month', aircraftId, selectedMonth, selectedYear],
    queryFn: async (): Promise<LogbookMonth | null> => {
      // Primeiro tentar buscar
      const { data: existing, error: fetchError } = await supabase
        .from('logbook_months')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)
        .maybeSingle();

      if (fetchError) {
        console.error('Erro ao buscar logbook month:', fetchError);
        return null;
      }

      // Se já existe, retornar
      if (existing) {
        return existing as LogbookMonth;
      }

      // Se não existe, criar
      const { data: created, error: createError } = await supabase
        .from('logbook_months')
        .insert([
          {
            aircraft_id: aircraftId,
            month: selectedMonth,
            year: selectedYear,
            status: 'open',
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error('Erro ao criar logbook month:', createError);
        return null;
      }

      return created as LogbookMonth;
    },
    enabled: !!aircraftId,
  });

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
  };

  return {
    selectedMonth,
    selectedYear,
    logbookMonth,
    handleMonthChange,
    handleYearChange,
    refetchLogbookMonth,
  };
}
