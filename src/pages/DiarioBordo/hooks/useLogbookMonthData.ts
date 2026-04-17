// hooks/useLogbookMonthData.ts

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateCelulaDisponivel } from '@/utils/flightTime';
import { Aircraft } from '@/types';

interface LogbookMonthData {
  id: string;
  celula_anterior_ttotal: number | null;
  celula_atual_ttotal: number | null;
  celula_prox_revisao_ttotal: number | null;
  celula_disponivel_ttotal: number | null;
  ano: number;
  mes: number;
}

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
          // Último mês
          const { data: monthsData, error: monthError } = await supabase
            .from('diario_mes')
            .select(`
              id,
              celula_anterior_ttotal,
              celula_atual_ttotal,
              celula_prox_revisao_ttotal,
              celula_disponivel_ttotal,
              ano,
              mes
            `)
            .eq('aeronave_id', ac.id)
            .order('ano', { ascending: false })
            .order('mes', { ascending: false })
            .limit(1);

          if (monthError || !monthsData || monthsData.length === 0) {
            monthDataMap[ac.id] = null;
            continue;
          }

          const monthData = monthsData[0] as LogbookMonthData;

          // Buscar lançamentos do mês
          const { data: monthEntries } = await supabase
            .from('lancamentos_diario_bordo')
            .select('id, celula')
            .eq('diario_mes', monthData.id)
            .order('numero_sequencial', { ascending: true });

          const celulaAnterior = monthData.celula_anterior_ttotal ?? 0;
          let calculatedCelulaAtual = celulaAnterior;

          if (monthEntries && monthEntries.length > 0) {
            const lastEntry = monthEntries[monthEntries.length - 1];
            calculatedCelulaAtual = lastEntry.celula ?? celulaAnterior;
          }

          const calculatedCelulaDisponivel = calculateCelulaDisponivel(
            monthData.celula_prox_revisao_ttotal ?? 0,
            calculatedCelulaAtual
          );

          // Atualiza se divergente
          if (
            Math.abs((monthData.celula_atual_ttotal ?? 0) - calculatedCelulaAtual) > 0.01
          ) {
            await supabase
              .from('diario_mes')
              .update({
                celula_atual_ttotal: calculatedCelulaAtual,
                celula_disponivel_ttotal: calculatedCelulaDisponivel
              })
              .eq('id', monthData.id);

            monthDataMap[ac.id] = {
              ...monthData,
              celula_atual_ttotal: calculatedCelulaAtual,
              celula_disponivel_ttotal: calculatedCelulaDisponivel
            };
          } else {
            monthDataMap[ac.id] = monthData;
          }
        } catch (err) {
          console.error(`Erro ao carregar diario_mes para ${ac.registration}:`, err);
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