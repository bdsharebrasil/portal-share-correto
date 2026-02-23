// hooks/useFlightEdit.ts
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FlightEntry } from '../types';
import { updateCrewFlightHours } from '@/services/crewFlightHours';

export function useFlightEdit(onSuccess: () => void) {
  const [editingEntry, setEditingEntry] = useState<FlightEntry | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const openEditDialog = (entry: FlightEntry) => {
    setEditingEntry(entry);
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingEntry(null);
  };

  const handleSaveEdit = async (updatedEntry: Partial<FlightEntry>) => {
    if (!editingEntry) return;

    setIsSaving(true);
    try {
      // Calcular diferença de horas para atualizar crew
      const oldTotalTime = editingEntry.total_time;
      const oldIfrTime = editingEntry.ifr_time;
      const oldNightHours = editingEntry.night_hours;

      const newTotalTime = updatedEntry.total_time ?? oldTotalTime;
      const newIfrTime = updatedEntry.ifr_time ?? oldIfrTime;
      const newNightHours = updatedEntry.night_hours ?? oldNightHours;

      // Atualizar entrada no banco
      const { error: updateError } = await supabase
        .from('logbook_entries')
        .update(updatedEntry)
        .eq('id', editingEntry.id);

      if (updateError) throw updateError;

      // Se mudou tripulação ou horas, atualizar crew_flight_hours
      if (
        oldTotalTime !== newTotalTime ||
        oldIfrTime !== newIfrTime ||
        oldNightHours !== newNightHours
      ) {
        const entryDate = new Date(editingEntry.entry_date);
        
        // Remover horas antigas
        await updateCrewFlightHours({
          picId: editingEntry.pic_canac,
          sicId: editingEntry.sic_canac || null,
          aircraftId: editingEntry.aircraft_id,
          month: entryDate.getMonth() + 1,
          year: entryDate.getFullYear(),
          totalTime: oldTotalTime,
          ifrTime: oldIfrTime,
          nightHours: oldNightHours,
          flightDay: editingEntry.entry_date,
          operation: 'remove',
        });

        // Adicionar horas novas
        await updateCrewFlightHours({
          picId: updatedEntry.pic_canac || editingEntry.pic_canac,
          sicId: updatedEntry.sic_canac || editingEntry.sic_canac || null,
          aircraftId: editingEntry.aircraft_id,
          month: entryDate.getMonth() + 1,
          year: entryDate.getFullYear(),
          totalTime: newTotalTime,
          ifrTime: newIfrTime,
          nightHours: newNightHours,
          flightDay: editingEntry.entry_date,
          operation: 'add',
        });
      }

      toast({
        title: 'Sucesso',
        description: 'Registro atualizado com sucesso.',
      });

      closeEditDialog();
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao atualizar registro:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar registro.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return {
    editingEntry,
    editDialogOpen,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
    isSaving,
  };
}