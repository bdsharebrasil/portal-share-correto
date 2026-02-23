// Re-exporta o AddLogbookEntryDialog usando o DynamicLogbookForm organizado
import { DynamicLogbookForm } from '@/components/logbook/DynamicLogbookForm';

interface AddLogbookEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  logbookMonthId?: string | null;
  prefilledDate?: Date;
  onSuccess?: () => void;
}

/**
 * Wrapper component que delega ao DynamicLogbookForm organizado
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
