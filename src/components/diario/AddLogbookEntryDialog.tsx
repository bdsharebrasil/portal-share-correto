import { DynamicLogbookForm } from './DynamicLogbookForm';

interface AddLogbookEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  logbookMonthId?: string | null;
  prefilledDate?: Date;
  onSuccess?: () => void;
}

/**
 * Wrapper component que delega ao DynamicLogbookForm
 * Mantém a interface compatível com código existente
 */
export function AddLogbookEntryDialog({
  open,
  onOpenChange,
  aircraftId,
  prefilledDate,
  onSuccess,
  logbookMonthId,
}: AddLogbookEntryDialogProps) {
  return (
    <DynamicLogbookForm
      open={open}
      onOpenChange={onOpenChange}
      aircraftId={aircraftId}
      logbookMonthId={logbookMonthId}
      prefilledDate={prefilledDate}
      onSuccess={onSuccess}
    />
  );
}
