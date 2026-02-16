// components/DeleteConfirmDialog.tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FlightEntry } from '../types';
import { Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FlightEntry | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  entry,
  onConfirm,
  isDeleting,
}: DeleteConfirmDialogProps) {
  if (!entry) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Confirmar Exclusão
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este registro de voo?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/50 p-4 rounded-lg space-y-2 my-4">
          <p className="text-sm">
            <span className="font-semibold">Data:</span>{' '}
            {format(new Date(entry.entry_date), 'dd/MM/yyyy')}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Rota:</span>{' '}
            <span className="font-mono">
              {entry.departure_aerodrome} → {entry.arrival_aerodrome}
            </span>
          </p>
          <p className="text-sm">
            <span className="font-semibold">PIC:</span> {entry.pic_canac}
          </p>
          <p className="text-sm">
            <span className="font-semibold">Tempo de Bloco:</span>{' '}
            {entry.total_time.toFixed(1)}h
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          ⚠️ Esta ação não pode ser desfeita. As horas de voo da tripulação serão atualizadas automaticamente.
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir Registro'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}