import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpdateCheck } from "@/contexts/UpdateCheckContext";
import { RefreshCw } from "lucide-react";

export const UpdateNotificationModal = () => {
  const { updateAvailable, currentVersion, latestVersion, dismissUpdate } = useUpdateCheck();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (updateAvailable) {
      setIsOpen(true);
    }
  }, [updateAvailable]);

  const handleRefresh = () => {
    // Força reload da página
    window.location.reload();
  };

  const handleDismiss = () => {
    dismissUpdate();
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            <AlertDialogTitle>Atualização Disponível</AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <AlertDialogDescription className="space-y-3 text-base">
          <p>
            Uma nova versão do sistema está disponível. Para garantir o funcionamento correto,
            é necessário atualizar.
          </p>
          <div className="bg-gray-100 p-3 rounded text-sm text-gray-700">
            <p>
              <strong>Versão atual:</strong> {currentVersion}
            </p>
            <p>
              <strong>Nova versão:</strong> {latestVersion}
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Clique em "Atualizar" para recarregar a página com a versão mais recente.
          </p>
        </AlertDialogDescription>
        <div className="flex gap-2 mt-6">
          <AlertDialogCancel onClick={handleDismiss}>
            Descartar
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleRefresh} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar Agora
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
