// hooks/useLogbookMonthData.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateCelulaDisponivel } from '@/utils/flightTime';
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

          // Buscar TODOS os voos do mês para recalcular a célula corretamente
          // Célula é contada por ciclo (AC → Corte), não por tempo de voo
          const { data: monthEntries } = await supabase
            .from('logbook_entries')
            .select('id, celula')
            .eq('logbook_month_id', monthData.id)
            .order('sequential_number', { ascending: true });

          // Recalcular célula_atual baseado no último registro do mês
          // A célula final é o valor acumulado do último voo (cada voo soma 1 ciclo)
          const celulaAnterior = monthData.celula_anterior ?? 0;
          let calculatedCelulaAtual = celulaAnterior;

          if (monthEntries && monthEntries.length > 0) {
            // Pegar o último valor de célula (que é o acumulado)
            const lastEntry = monthEntries[monthEntries.length - 1];
            calculatedCelulaAtual = lastEntry.celula || celulaAnterior;
          }

          const calculatedCelulaDisponivel = calculateCelulaDisponivel(
            monthData.celula_prox_revisao ?? 0,
            calculatedCelulaAtual
          );

          // Se houve diferença, atualizar no banco
          if (Math.abs((monthData.celula_atual ?? 0) - calculatedCelulaAtual) > 0.01) {
            await supabase
              .from('logbook_months')
              .update({
                celula_atual: calculatedCelulaAtual,
                celula_disponivel: calculatedCelulaDisponivel
              })
              .eq('id', monthData.id);

            monthDataMap[ac.id] = {
              ...monthData,
              celula_atual: calculatedCelulaAtual,
              celula_disponivel: calculatedCelulaDisponivel
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
