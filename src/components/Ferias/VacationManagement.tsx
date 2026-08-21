// @ts-nocheck
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  User,
  Palmtree,
  AlertCircle,
  Bell,
  CalendarCheck,
  CalendarX
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

interface VacationRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  remarks: string | null;
  approver_id: string | null;
  created_at: string;
  updated_at: string | null;
  user_name?: string;
  user_avatar?: string;
  approver_name?: string;
}

export function VacationManagement() {
  const { hasAnyRole } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const canManageVacations = hasAnyRole(["admin", "gestor_master", "financeiro_master"]);

  // Fetch all user profiles
  const { data: userProfiles = [] } = useQuery({
    queryKey: ["user-profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url, email, employment_status");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all vacation requests
  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ["vacation-requests-management"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Enrich requests with user info
  const enrichedRequests = useMemo(() => {
    return allRequests.map((request: any) => {
      const user = userProfiles.find((p: any) => p.id === request.user_id);
      const approver = request.approver_id 
        ? userProfiles.find((p: any) => p.id === request.approver_id) 
        : null;
      return {
        ...request,
        user_name: user?.full_name || "Usuário desconhecido",
        user_avatar: user?.avatar_url,
        user_email: user?.email,
        approver_name: approver?.full_name || null,
      };
    }) as VacationRequest[];
  }, [allRequests, userProfiles]);

  // Filter requests
  const pendingRequests = enrichedRequests.filter(r => r.status === "pending");
  const approvedRequests = enrichedRequests.filter(r => r.status === "approved");
  const rejectedRequests = enrichedRequests.filter(r => r.status === "rejected");

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const request = enrichedRequests.find(r => r.id === requestId);
      if (!request) throw new Error("Solicitação não encontrada");

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

      // A aprovação cria/atualiza o período oficial do colaborador.
      // Não alteramos employment_status aqui: uma aprovação futura não significa
      // que o colaborador já entrou em férias.
      const { error: configError } = await (supabase as any)
        .from("employee_vacation_config")
        .upsert({
          user_profile: request.user_id,
          year: new Date(`${request.start_date}T00:00:00`).getFullYear(),
          scheduled_date: request.start_date,
          total_vacation_days: request.days,
          payment_status: "agendado",
        }, { onConflict: "user_profile,year" });

      if (configError) throw configError;

      // Create notification - messages table disabled
      // const { error: notificationError } = await supabase
      //   .from("messages")
      //   .insert({
      //     sender_id: user.id,
      //     receiver_id: request.user_id,
      //     content: `Suas férias foram aprovadas! Período: ${format(new Date(request.start_date), "dd/MM/yyyy")} a ${format(new Date(request.end_date), "dd/MM/yyyy")}`,
      //     read: false,
      //   });

      const notificationError = null;
      if (notificationError) {
        console.error("Erro ao criar notificação:", notificationError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["vacation-history"] });
      queryClient.invalidateQueries({ queryKey: ["colaboradores-ferias"] });
      toast.success("Férias aprovadas e período agendado com sucesso!");
      setShowApproveDialog(false);
      setSelectedRequest(null);
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

      const request = enrichedRequests.find(r => r.id === requestId);
      if (!request) throw new Error("Solicitação não encontrada");

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

      // Create notification - messages table disabled
      // const { error: notificationError } = await supabase
      //   .from("messages")
      //   .insert({
      //     sender_id: user.id,
      //     receiver_id: request.user_id,
      //     content: `Sua solicitação de férias foi recusada. ${reason ? `Motivo: ${reason}` : ""}`,
      //     read: false,
      //   });

      const notificationError = null;
      if (notificationError) {
        console.error("Erro ao criar notificação:", notificationError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      toast.success("Solicitação recusada. O colaborador foi notificado.");
      setShowRejectDialog(false);
      setSelectedRequest(null);
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
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Recusado
          </Badge>
        );
      default:
        return null;
    }
  };

  const RequestCard = ({ request, showActions = false }: { request: VacationRequest; showActions?: boolean }) => (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30 rounded-2xl overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-md flex-shrink-0">
            <AvatarImage src={request.user_avatar || undefined} alt={request.user_name} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold">
              {request.user_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="font-semibold text-foreground truncate">{request.user_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Solicitado em {format(new Date(request.criado_em), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              {getStatusBadge(request.status)}
            </div>
            
            <div className="flex items-center gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary" />
                <span>
                  {format(new Date(request.start_date), "dd/MM", { locale: ptBR })} - {format(new Date(request.end_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              <Badge variant="outline" className="bg-primary/5 border-primary/20">
                {request.days} dias
              </Badge>
            </div>

            {request.remarks && request.status !== "pending" && (
              <p className="mt-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-lg">
                {request.remarks}
              </p>
            )}

            {request.approver_name && (
              <p className="mt-2 text-xs text-muted-foreground">
                {request.status === "approved" ? "Aprovado" : "Recusado"} por: {request.approver_name}
              </p>
            )}
          </div>
        </div>

        {showActions && canManageVacations && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
            <Button
              size="sm"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl"
              onClick={() => {
                setSelectedRequest(request);
                setShowApproveDialog(true);
              }}
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 rounded-xl"
              onClick={() => {
                setSelectedRequest(request);
                setShowRejectDialog(true);
              }}
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Recusar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!canManageVacations) {
    return (
      <Card className="rounded-2xl border-border/50">
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Você não tem permissão para gerenciar férias.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Bell className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingRequests.length}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border-emerald-500/20 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <CalendarCheck className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{approvedRequests.length}</p>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/5 border-red-500/20 rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <CalendarX className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{rejectedRequests.length}</p>
                <p className="text-sm text-muted-foreground">Recusadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="shadow-lg border-border/50 rounded-2xl">
        <CardHeader className="border-b border-border bg-muted/30 rounded-t-2xl">
          <CardTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="bg-blue-500/10 p-2.5 rounded-xl">
              <Palmtree className="h-5 w-5 text-blue-600" />
            </div>
            Gestão de Solicitações de Férias
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 gap-2 w-full max-w-md mb-6 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-white rounded-lg"
              >
                <Clock className="w-4 h-4 mr-1.5" />
                Pendentes ({pendingRequests.length})
              </TabsTrigger>
              <TabsTrigger
                value="approved"
                className="data-[state=active]:bg-emerald-500 data-[state=active]:text-white rounded-lg"
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Aprovadas
              </TabsTrigger>
              <TabsTrigger
                value="rejected"
                className="data-[state=active]:bg-red-500 data-[state=active]:text-white rounded-lg"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Recusadas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-0">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma solicitação pendente!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pendingRequests.map((request) => (
                    <RequestCard key={request.id} request={request} showActions />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved" className="mt-0">
              {approvedRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma solicitação aprovada ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {approvedRequests.map((request) => (
                    <RequestCard key={request.id} request={request} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="mt-0">
              {rejectedRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma solicitação recusada.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rejectedRequests.map((request) => (
                    <RequestCard key={request.id} request={request} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Aprovar Férias
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Tem certeza que deseja aprovar as férias de <strong>{selectedRequest?.user_name}</strong>?</p>
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
              onClick={() => selectedRequest && approveMutation.mutate(selectedRequest.id)}
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
              <p>Tem certeza que deseja recusar a solicitação de férias de <strong>{selectedRequest?.user_name}</strong>?</p>
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Motivo da recusa (opcional)</Label>
                <Textarea
                  id="rejection-reason"
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
              onClick={() => selectedRequest && rejectMutation.mutate({ requestId: selectedRequest.id, reason: rejectionReason })}
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
