// @ts-nocheck
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, Calendar, User } from "lucide-react";

interface VacationApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: {
    user_id: string;
    userName: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    reason?: string;
  };
  onApprove: () => void;
}

export function VacationApprovalDialog({
  open,
  onOpenChange,
  request,
  onApprove,
}: VacationApprovalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar Férias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{request.userName}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>
                {format(new Date(request.start_date), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                {format(new Date(request.end_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Total de dias solicitados:{" "}
                <Badge variant="secondary">{request.days_requested} dias</Badge>
              </p>
            </div>

            {request.motivo && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Motivo:</p>
                <p className="text-sm bg-muted p-3 rounded-lg">{request.motivo}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white"
              onClick={onApprove}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Aprovar Férias
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
