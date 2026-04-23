import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInDays, addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle } from "lucide-react";

interface VacationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VacationRequestDialog({ open, onOpenChange }: VacationRequestDialogProps) {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [admissionDate, setAdmissionDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdmissionDate = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from("user_profiles")
          .select("admission_date")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar data de admissão:", error);
          setIsLoading(false);
          return;
        }

        setAdmissionDate(profile?.admission_date || null);
        setIsLoading(false);
      } catch (error) {
        console.error("Erro ao buscar data de admissão:", error);
        setIsLoading(false);
      }
    };

    if (open) {
      fetchAdmissionDate();
    }
  }, [open]);

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = differenceInDays(end, start) + 1;

      const { error } = await (supabase
        .from("vacation_requests") as any)
        .insert({
          user_id: user.id,
          start_date: startDate,
          end_date: endDate,
          days_requested: days,
          reason: reason || null,
          status: "pending",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-vacation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-vacation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-vacation-requests"] });
      toast.success("Solicitação enviada com sucesso");
      onOpenChange(false);
      setStartDate("");
      setEndDate("");
      setReason("");
    },
    onError: (error) => {
      console.error("Error creating vacation request:", error);
      toast.error("Erro ao enviar solicitação");
    },
  });

  const getAcquisitionEligibilityDate = () => {
    if (!admissionDate) return null;
    return addMonths(new Date(admissionDate), 12);
  };

  const isEligibleForVacation = () => {
    if (!admissionDate) return false;
    const eligibilityDate = getAcquisitionEligibilityDate();
    return new Date() >= eligibilityDate!;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!admissionDate) {
      toast.error("Data de admissão não encontrada");
      return;
    }

    if (!isEligibleForVacation()) {
      const eligibilityDate = getAcquisitionEligibilityDate();
      const formattedDate = format(eligibilityDate!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      toast.error(`Você poderá solicitar férias a partir de ${formattedDate}`);
      return;
    }

    if (!startDate || !endDate) {
      toast.error("Preencha as datas");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      toast.error("Data final deve ser maior que data inicial");
      return;
    }

    createRequestMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Férias</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Carregando informações...</p>
          </div>
        ) : !isEligibleForVacation() ? (
          <Alert className="border-yellow-500/50 bg-yellow-500/5">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <p className="font-semibold mb-2">Período aquisitivo não completado</p>
              <p className="text-sm">
                Você poderá solicitar férias a partir de{" "}
                <span className="font-semibold">
                  {format(getAcquisitionEligibilityDate()!, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
                , quando completar 12 meses de trabalho.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Início</Label>
              <Input
                id="start-date"
                type="data"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Data Fim</Label>
              <Input
                id="end-date"
                type="data"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Total de dias: <span className="font-semibold text-foreground">
                    {differenceInDays(new Date(endDate), new Date(startDate)) + 1} dias
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo (opcional)</Label>
              <Textarea
                id="motivo"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva o motivo das férias..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createRequestMutation.isPending}>
                {createRequestMutation.isPending ? "Enviando..." : "Solicitar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
