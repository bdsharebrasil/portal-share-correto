// hooks/useFlightDelete.ts
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FlightEntry } from '../types';
import { updateCrewFlightHours } from '@/services/crewFlightHours';

export function useFlightDelete(onSuccess: () => void) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<FlightEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const openDeleteConfirm = (entry: FlightEntry) => {
    setEntryToDelete(entry);
    setDeleteConfirmOpen(true);
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmOpen(false);
    setEntryToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;

    setIsDeleting(true);
    try {
      // Remover horas de voo da tripulação
      const entryDate = new Date(entryToDelete.entry_date);
      
      await updateCrewFlightHours({
        picId: entryToDelete.pic_canac,
        sicId: entryToDelete.sic_canac || null,
        aircraftId: entryToDelete.aircraft_id,
        month: entryDate.getMonth() + 1,
        year: entryDate.getFullYear(),
        totalTime: entryToDelete.total_time,
        ifrTime: entryToDelete.ifr_time,
        nightHours: entryToDelete.night_hours,
        flightDay: entryToDelete.entry_date,
        operation: 'remove',
      });

      // Se for empréstimo, remover transações relacionadas
      if (entryToDelete.is_loan) {
        await supabase
          .from('aircraft_loans')
          .delete()
          .eq('logbook_entry_id', entryToDelete.id);

        await supabase
          .from('hour_transactions')
          .delete()
          .eq('logbook_entry_id', entryToDelete.id);
      }

      // Deletar entrada
      const { error } = await supabase
        .from('logbook_entries')
        .delete()
        .eq('id', entryToDelete.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Registro excluído com sucesso.',
      });

      closeDeleteConfirm();
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao excluir registro:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir registro.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteConfirmOpen,
    entryToDelete,
    openDeleteConfirm,
    closeDeleteConfirm,
    handleConfirmDelete,
    isDeleting,
  };
}