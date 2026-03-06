import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

interface EmployeePayslipsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeePayslipsManager({ open, onOpenChange }: EmployeePayslipsManagerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Holerites</DialogTitle>
        </DialogHeader>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Esta funcionalidade requer a tabela profiles. Use user_profiles em vez disso.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
