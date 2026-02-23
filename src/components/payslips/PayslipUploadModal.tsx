import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface PayslipUploadModalProps {
  employee: { id: string; email: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PayslipUploadModal({ employee, open, onOpenChange }: PayslipUploadModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload de Holerite - {employee?.email}</DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta funcionalidade requer a tabela employee_payslips que não existe no banco de dados.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
