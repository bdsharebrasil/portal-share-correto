// DiarioBordoDetalhes/index.tsx
import { useState } from 'react';
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
        />

        {/* Tabela de Voos */}
        <FlightEntryTable
          entries={filteredEntries}
          isLoading={isLoading}
          onEdit={openEditDialog}
          onDelete={openDeleteConfirm}
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