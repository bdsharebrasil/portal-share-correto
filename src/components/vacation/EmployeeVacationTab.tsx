import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Palmtree,
  AlertCircle,
  CalendarDays
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface EmployeeVacationTabProps {
  employeeId: string;
  employeeName: string;
}

export function EmployeeVacationTab({ employeeId, employeeName }: EmployeeVacationTabProps) {
  const { hasAnyRole } = useUserRole();
  const queryClient = useQueryClient();
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const canManageVacations = hasAnyRole(["admin", "gestor_master", "financeiro_master"]);

  // Fetch employee vacation requests
  const { data: vacationRequests = [], isLoading } = useQuery({
    queryKey: ["employee-vacation-requests", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("user_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Update request status
      const { error: requestError } = await supabase
        .from("vacation_requests")
        .update({
          status: "approved",
          approver_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (requestError) throw requestError;

      // Update employee status to "ferias"
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ employment_status: "ferias" })
        .eq("id", employeeId);

      if (profileError) {
        console.error("Erro ao atualizar status do funcionário:", profileError);
      }

      // Get request details for notification
      const request = vacationRequests.find(r => r.id === requestId);

      // Create notification
      const { error: notificationError } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: employeeId,
          content: request 
            ? `Suas férias foram aprovadas! Período: ${format(new Date(request.start_date), "dd/MM/yyyy")} a ${format(new Date(request.end_date), "dd/MM/yyyy")}`
            : "Suas férias foram aprovadas!",
          read: false,
        });

      if (notificationError) {
        console.error("Erro ao criar notificação:", notificationError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacation-requests", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Férias aprovadas com sucesso!");
      setShowApproveDialog(false);
      setSelectedRequestId(null);
    },
    onError: (error) => {
      console.error("Erro ao aprovar férias:", error);
      toast.error("Erro ao aprovar férias");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Update request status
      const { error: requestError } = await supabase
        .from("vacation_requests")
        .update({
          status: "rejected",
          approver_id: user.id,
          remarks: reason || "Solicitação rejeitada",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (requestError) throw requestError;

      // Create notification
      const { error: notificationError } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: employeeId,
          content: `Sua solicitação de férias foi recusada. ${reason ? `Motivo: ${reason}` : ""}`,
          read: false,
        });

      if (notificationError) {
        console.error("Erro ao criar notificação:", notificationError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacation-requests", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      toast.success("Solicitação recusada.");
      setShowRejectDialog(false);
      setSelectedRequestId(null);
      setRejectionReason("");
    },
    onError: (error) => {
      console.error("Erro ao recusar férias:", error);
      toast.error("Erro ao recusar férias");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Recusado
          </Badge>
        );
      default:
        return null;
    }
  };

  const selectedRequest = vacationRequests.find(r => r.id === selectedRequestId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (vacationRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
        <div className="bg-primary/10 rounded-full p-6">
          <Palmtree className="h-12 w-12 text-primary" />
        </div>
        <div>
          <p className="text-lg font-medium text-foreground">Nenhuma solicitação de férias</p>
          <p className="text-sm text-muted-foreground">
            {employeeName} ainda não fez nenhuma solicitação de férias.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Histórico de Férias</h3>
        </div>
        <Badge variant="outline" className="bg-muted/50">
          {vacationRequests.length} solicitação(ões)
        </Badge>
      </div>

      <div className="space-y-3">
        {vacationRequests.map((request: any) => (
          <Card key={request.id} className="border-border/50 rounded-xl hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(request.status)}
                    <span className="text-xs text-muted-foreground">
                      Solicitado em {format(new Date(request.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="font-medium">
                        {format(new Date(request.start_date), "dd/MM/yyyy")} - {format(new Date(request.end_date), "dd/MM/yyyy")}
                      </span>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      {request.days} dias
                    </Badge>
                  </div>

                  {request.remarks && (
                    <p className="mt-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                      {request.remarks}
                    </p>
                  )}
                </div>

                {request.status === "pending" && canManageVacations && (
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                      onClick={() => {
                        setSelectedRequestId(request.id);
                        setShowApproveDialog(true);
                      }}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 rounded-lg"
                      onClick={() => {
                        setSelectedRequestId(request.id);
                        setShowRejectDialog(true);
                      }}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Recusar
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Aprovar Férias
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Tem certeza que deseja aprovar as férias de <strong>{employeeName}</strong>?</p>
              {selectedRequest && (
                <div className="bg-muted/50 p-3 rounded-xl space-y-1 text-sm">
                  <p><strong>Período:</strong> {format(new Date(selectedRequest.start_date), "dd/MM/yyyy")} a {format(new Date(selectedRequest.end_date), "dd/MM/yyyy")}</p>
                  <p><strong>Total:</strong> {selectedRequest.days} dias</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                O status do funcionário será atualizado para "Férias" e ele receberá uma notificação.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-500 hover:bg-emerald-600 rounded-xl"
              onClick={() => selectedRequestId && approveMutation.mutate(selectedRequestId)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "Aprovando..." : "Aprovar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Recusar Férias
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Tem certeza que deseja recusar a solicitação de <strong>{employeeName}</strong>?</p>
              <div className="space-y-2">
                <Label htmlFor="rejection-reason-emp">Motivo da recusa (opcional)</Label>
                <Textarea
                  id="rejection-reason-emp"
                  placeholder="Informe o motivo da recusa..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="rounded-xl"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" onClick={() => setRejectionReason("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 rounded-xl"
              onClick={() => selectedRequestId && rejectMutation.mutate({ requestId: selectedRequestId, reason: rejectionReason })}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Recusando..." : "Recusar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
