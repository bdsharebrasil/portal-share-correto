import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logError } from '@/utils/logger';
import { calculateCelulaAtual, calculateCelulaDisponivel } from '@/utils/flightTime';

export const useCelulaManagement = (
  aircraftId: string,
  selectedMonth: number,
  selectedYear: number,
  logbookMonth: any,
  onSetLogbookMonth: (data: any) => void,
  onUpdateMaintenanceHours?: (celulaAtual: number) => Promise<void>
) => {
  const updateCelulaAtual = useCallback(
    async (flightTimeIncrement: number = 0) => {
      if (!logbookMonth) return;

      try {
        const { data: monthEntries } = await supabase
          .from('lancamentos_diario_bordo')
          .select('id, tempo_total, numero_sequencial')
          .eq('aeronave_id', aircraftId)
          .gte('data_registro', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
          .lt('data_registro', selectedMonth === 12
            ? `${selectedYear + 1}-01-01`
            : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`)
          .order('numero_sequencial', { ascending: true });

        const celulaAnterior = logbookMonth.celula_anterior_ttotal ?? 0;

        const mappedEntries = (monthEntries || []).map(e => ({
          ...e,
          total_time: e.tempo_total,
          sequential_number: e.numero_sequencial
        }));

        const newCelulaAtual = calculateCelulaAtual(mappedEntries, celulaAnterior);
        const newCelulaDisponivel = calculateCelulaDisponivel(
          logbookMonth.celula_prox_revisao_ttotal ?? 0,
          newCelulaAtual
        );

        const newCelulaAtualFormatted = parseFloat(newCelulaAtual.toFixed(2));
        const newCelulaDisponvelFormatted = parseFloat(newCelulaDisponivel.toFixed(2));

        const { error } = await supabase
          .from('diario_mes')
          .update({
            celula_atual_ttotal: newCelulaAtualFormatted,
            celula_disponivel_ttotal: newCelulaDisponvelFormatted
          })
          .eq('id', logbookMonth.id);

        if (error) {
          logError('Erro ao atualizar célula_atual:', error);
        } else {
          const updatedMonth = {
            ...logbookMonth,
            celula_atual_ttotal: newCelulaAtualFormatted,
            celula_disponivel_ttotal: newCelulaDisponvelFormatted
          };
          onSetLogbookMonth(updatedMonth);
          if (onUpdateMaintenanceHours) {
            await onUpdateMaintenanceHours(newCelulaAtualFormatted);
          }
        }
      } catch (error) {
        logError('Erro ao recalcular célula:', error);
        toast.error('Erro ao atualizar horas de célula');
      }
    },
    [aircraftId, selectedMonth, selectedYear, logbookMonth, onSetLogbookMonth, onUpdateMaintenanceHours]
  );

  return {
    updateCelulaAtual
  };
};
