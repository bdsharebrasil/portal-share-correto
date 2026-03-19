import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface ReceiptPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  imageUrl?: string;
  fileName?: string;
  isLoading?: boolean;
  error?: string;
}

export function ReceiptPreviewModal({
  open,
  onClose,
  onConfirm,
  imageUrl,
  fileName = "Comprovante",
  isLoading = false,
  error
}: ReceiptPreviewModalProps) {
  const [localImageUrl, setLocalImageUrl] = useState<string | undefined>(imageUrl);

  useEffect(() => {
    setLocalImageUrl(imageUrl);
  }, [imageUrl]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Prévia do Comprovante</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-800">Erro ao processar comprovante</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4" />
                <p className="text-gray-600">Processando comprovante...</p>
              </div>
            </div>
          ) : localImageUrl ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600/80">{fileName}</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center max-h-96">
                <img
                  src={localImageUrl}
                  alt="Preview do comprovante"
                  className="max-w-full max-h-96 object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhuma imagem para visualizar</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !localImageUrl || !!error}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="h-4 w-4 mr-2" />
            {error ? "Tentar Novamente" : "Usar Este Comprovante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
