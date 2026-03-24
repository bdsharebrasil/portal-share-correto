// hooks/useLogbookMonthData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Aircraft } from '@/types';
import type { LogbookMonthData } from '../types';

export function useLogbookMonthData(aircraft: Aircraft[]) {
  const [logbookMonthData, setLogbookMonthData] = useState<Record<string, LogbookMonthData | null>>({});
  const [loading, setLoading] = useState(aircraft.length > 0);

  const fetchLogbookData = useCallback(async () => {
    if (aircraft.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const monthDataMap: Record<string, LogbookMonthData | null> = {};

      for (const ac of aircraft) {
        try {
          // Buscar o último mês com dados (mais recente)
          const { data: monthsData, error: monthError } = await supabase
            .from('logbook_months')
            .select('id, celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, year, month')
            .eq('aircraft_id', ac.id)
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(1);

          if (monthError || !monthsData || monthsData.length === 0) {
            monthDataMap[ac.id] = null;
            continue;
          }

          const monthData = monthsData[0];

          // Buscar o último lançamento desse mês para validar celula_atual
          const { data: lastEntry } = await supabase
            .from('logbook_entries')
            .select('celula')
            .eq('logbook_month_id', monthData.id)
            .order('sequential_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastEntry?.celula && Math.abs((monthData.celula_atual ?? 0) - lastEntry.celula) > 0.01) {
            // Corrigir celula_atual com o valor real do último lançamento
            const correctedCelulaAtual = lastEntry.celula;
            const correctedDisponivel = (monthData.celula_prox_revisao ?? 0) - correctedCelulaAtual;

            // Atualizar no banco
            await supabase
              .from('logbook_months')
              .update({
                celula_atual: correctedCelulaAtual,
                celula_disponivel: parseFloat(correctedDisponivel.toFixed(2))
              })
              .eq('id', monthData.id);

            monthDataMap[ac.id] = {
              ...monthData,
              celula_atual: correctedCelulaAtual,
              celula_disponivel: parseFloat(correctedDisponivel.toFixed(2))
            };
          } else {
            monthDataMap[ac.id] = monthData;
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
  }, [aircraft]);

  useEffect(() => {
    fetchLogbookData();
  }, [fetchLogbookData]);

  return {
    logbookMonthData,
    loading,
    refetch: fetchLogbookData,
  };
}
