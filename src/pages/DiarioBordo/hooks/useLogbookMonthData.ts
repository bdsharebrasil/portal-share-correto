// hooks/useLogbookMonthData.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Aircraft } from '@/types';
import type { LogbookMonthData } from '../types';

export function useLogbookMonthData(aircraft: Aircraft[]) {
  const [logbookMonthData, setLogbookMonthData] = useState<Record<string, LogbookMonthData | null>>({});
  const [loading, setLoading] = useState(aircraft.length > 0);

  useEffect(() => {
    if (aircraft.length === 0) {
      setLoading(false);
      return;
    }

    fetchLogbookData();
  }, [aircraft]);

  const fetchLogbookData = async () => {
    setLoading(true);
    try {
      const monthDataMap: Record<string, LogbookMonthData | null> = {};
      const currentMonth = new Date().getMonth() + 1; // 1-12
      const currentYear = new Date().getFullYear();

      for (const ac of aircraft) {
        try {
          // Primeiro, tentar buscar o mês atual
          let { data: currentMonthData } = await supabase
            .from('logbook_months')
            .select('celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, year, month')
            .eq('aircraft_id', ac.id)
            .eq('year', currentYear)
            .eq('month', currentMonth)
            .maybeSingle();

          // Se existe e tem dados válidos (celula_atual > 0), usar
          if (currentMonthData && (currentMonthData.celula_atual || 0) > 0) {
            monthDataMap[ac.id] = currentMonthData;
            console.log(`Dados do mês atual para ${ac.registration}:`, currentMonthData);
          } else {
            // Caso contrário, buscar o último mês com dados válidos
            const { data: monthsData, error: monthError } = await supabase
              .from('logbook_months')
              .select('celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, year, month')
              .eq('aircraft_id', ac.id)
              .gt('celula_atual', 0)
              .order('year', { ascending: false })
              .order('month', { ascending: false })
              .limit(1);

            if (monthError) {
              console.warn(`Erro ao carregar logbook_months para ${ac.registration}:`, monthError);
              monthDataMap[ac.id] = null;
            } else if (monthsData && monthsData.length > 0) {
              monthDataMap[ac.id] = monthsData[0];
              console.log(`Dados carregados para ${ac.registration}:`, monthsData[0]);
            } else {
              console.log(`Nenhum dado de logbook_months para ${ac.registration}`);
              monthDataMap[ac.id] = null;
            }
          }
        } catch (err) {
          console.error(`Erro ao carregar logbook_months para ${ac.registration}:`, err);
          monthDataMap[ac.id] = null;
        }
      }

      setLogbookMonthData(monthDataMap);
    } catch (error) {
      console.error('Erro ao carregar dados de logbook:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    logbookMonthData,
    loading,
    refetch: fetchLogbookData,
  };
}
