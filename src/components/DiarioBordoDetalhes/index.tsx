// DiarioBordoDetalhes/index.tsx
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DynamicLogbookForm } from '@/components/logbook/DynamicLogbookForm';
import { MonthNavigation } from './components/MonthNavigation';
import { MetricsPanel } from './components/MetricsPanel';
import { FlightEntryTable } from './components/FlightEntryTable';
import { EditFlightDialog } from './components/EditFlightDialog';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { useFlightEntries } from './hooks/useFlightEntries';
import { useMonthManagement } from './hooks/useMonthManagement';
import { useFlightEdit } from './hooks/useFlightEdit';
import { useFlightDelete } from './hooks/useFlightDelete';
import { useTripulantes } from '@/hooks/useTripulantes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DiarioBordoDetalhesProps {
  aircraftId: string;
  onBack: () => void;
}

export function DiarioBordoDetalhes({ aircraftId, onBack }: DiarioBordoDetalhesProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  // Custom hooks para gerenciar estado e lógica
  const {
    selectedMonth,
    selectedYear,
    logbookMonth,
    handleMonthChange,
    handleYearChange,
  } = useMonthManagement(aircraftId);

  const {
    entries,
    filteredEntries,
    isLoading,
    refetch,
  } = useFlightEntries(aircraftId, logbookMonth?.id);

  const {
    editingEntry,
    editDialogOpen,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
    isSaving,
  } = useFlightEdit(refetch);

  const {
    deleteConfirmOpen,
    entryToDelete,
    openDeleteConfirm,
    closeDeleteConfirm,
    handleConfirmDelete,
    isDeleting,
  } = useFlightDelete(refetch);

  // Buscar tripulantes (crew_members + crew) para resolver nomes
  const { tripulantes } = useTripulantes();
  
  const { data: crewPersons = [] } = useQuery({
    queryKey: ['crew-for-display'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew')
        .select('id, full_name, canac, status')
        .eq('status', 'ativo')
        .order('full_name', { ascending: true });
      if (error) return [];
      return data || [];
    },
  });

  // Combinar crew_members e crew para display
  const allCrewMembers = [
    ...tripulantes.map((t: any) => ({ id: t.id, full_name: t.full_name, canac: t.canac })),
    ...crewPersons.map((c: any) => ({ id: c.id, full_name: c.full_name, canac: c.canac })),
  ];

  // Deduplicate by id
  const uniqueCrewMembers = allCrewMembers.filter(
    (member, index, self) => index === self.findIndex(m => m.id === member.id)
  );

  // Obter último aeródromo de pouso para pré-preencher decolagem
  const lastArrivalAerodrome = entries.length > 0
    ? entries[entries.length - 1]?.arrival_aerodrome || ''
    : '';

  const handleFormSuccess = () => {
    refetch();
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={onBack}
            className="gap-2 text-slate-300 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
            Voltar
          </Button>

          <h1 className="text-3xl font-bold text-white">
            Diário de Bordo
          </h1>

          <Button
            onClick={() => setShowAddForm(true)}
            className="gap-2"
          >
            + Novo Trecho
          </Button>
        </div>

        {/* Navegação de Meses */}
        <MonthNavigation
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
          aircraftId={aircraftId}
        />

        {/* Painel de Métricas */}
        <MetricsPanel
          logbookMonth={logbookMonth}
          entries={entries}
          isLoading={isLoading}
        />

        {/* Formulário de Novo Trecho */}
        <DynamicLogbookForm
          open={showAddForm}
          onOpenChange={setShowAddForm}
          aircraftId={aircraftId}
          logbookMonthId={logbookMonth?.id}
          prefilledDate={new Date(selectedYear, selectedMonth - 1, 1)}
          onSuccess={handleFormSuccess}
          inline={true}
          lastArrivalAerodrome={lastArrivalAerodrome}
        />

        {/* Tabela de Voos */}
        <FlightEntryTable
          entries={filteredEntries}
          isLoading={isLoading}
          onEdit={openEditDialog}
          onDelete={openDeleteConfirm}
          crewMembers={uniqueCrewMembers}
        />

        {/* Dialog de Edição */}
        <EditFlightDialog
          open={editDialogOpen}
          onOpenChange={closeEditDialog}
          entry={editingEntry}
          onSave={handleSaveEdit}
          isSaving={isSaving}
        />

        {/* Dialog de Confirmação de Exclusão */}
        <DeleteConfirmDialog
          open={deleteConfirmOpen}
          onOpenChange={closeDeleteConfirm}
          entry={entryToDelete}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
}
