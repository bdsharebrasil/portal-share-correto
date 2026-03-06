import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface UploadComprovanteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reconciliationId: string;
  onSuccess: () => void;
}

export function UploadComprovanteDialog({ open, onOpenChange }: UploadComprovanteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar Comprovante de Pagamento</DialogTitle>
          <DialogDescription>Faça upload do comprovante para dar baixa no pagamento</DialogDescription>
        </DialogHeader>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta funcionalidade requer a tabela client_reconciliations que não existe no banco de dados.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
