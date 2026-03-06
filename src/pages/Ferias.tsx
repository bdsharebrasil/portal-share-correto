import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, XCircle, Clock, Plus, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VacationRequestDialog } from "@/components/vacation/VacationRequestDialog";
import { VacationApprovalDialog } from "@/components/vacation/VacationApprovalDialog";

export default function Ferias() {
  const { hasAnyRole } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  const canManageVacations = hasAnyRole(["admin", "gestor_master", "financeiro_master"]);
  const canViewAllRequests = hasAnyRole(["admin", "gestor_master", "financeiro", "financeiro_master"]);

  // Fetch user profiles for displaying names
  const { data: userProfiles = [] } = useQuery({
    queryKey: ["user-profiles-vacation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const getUserName = (userId: string) => {
    const profile = userProfiles.find((p: any) => p.id === userId);
    return profile?.full_name || "Usuário";
  };

  // Fetch current user's vacation requests
  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-vacation-requests"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch all vacation requests (for managers)
  const { data: allRequests = [] } = useQuery({
    queryKey: ["all-vacation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: canViewAllRequests,
  });

  // Fetch pending vacation requests (for managers)
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pending-vacation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: canViewAllRequests,
  });

  // Fetch vacation balances (for managers)
  const { data: balances = [] } = useQuery({
    queryKey: ["vacation-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vacation_balances")
        .select("*")
        .order("year", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: canViewAllRequests,
  });

  const approveRequestMutation = useMutation({
    mutationFn: async ({ id, approved, rejectionReason }: { id: string; approved: boolean; rejectionReason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const updateData: any = {
        status: approved ? "approved" : "rejected",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      };

      if (!approved && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      }

      const { error } = await supabase
        .from("vacation_requests")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-vacation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-vacation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["my-vacation-requests"] });
      toast.success("Solicitação processada com sucesso");
      setShowApprovalDialog(false);
      setSelectedRequest(null);
    },
    onError: () => {
      toast.error("Erro ao processar solicitação");
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Aprovado</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Recusado</Badge>;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestão de Férias</h1>
            <p className="text-muted-foreground">
              {canViewAllRequests 
                ? "Gerencie solicitações de férias dos funcionários" 
                : "Solicite e acompanhe suas férias"}
            </p>
          </div>
          <Button onClick={() => setShowRequestDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Solicitação
          </Button>
        </div>

        {/* Pending requests section - visible only to managers */}
        {canViewAllRequests && pendingRequests.length > 0 && (
          <Card className="border-yellow-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <Clock className="w-5 h-5" />
                Solicitações Pendentes ({pendingRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    {canManageVacations && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request: any) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          {getUserName(request.user_id)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(request.end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{request.days_requested} dias</TableCell>
                      <TableCell className="max-w-[200px] truncate">{request.reason || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(request.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      {canManageVacations && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/20"
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowApprovalDialog(true);
                              }}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border-red-500/20"
                              onClick={() => approveRequestMutation.mutate({ id: request.id, approved: false })}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Recusar
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* My requests section - visible to all users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Minhas Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myRequests.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Você ainda não fez nenhuma solicitação de férias.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRequests.map((request: any) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {format(new Date(request.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(request.end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{request.days_requested} dias</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{request.reason || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(request.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Vacation balances section - visible only to managers */}
        {canViewAllRequests && balances.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Saldo de Férias dos Funcionários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Dias Ganhos</TableHead>
                    <TableHead>Dias Usados</TableHead>
                    <TableHead>Dias Disponíveis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance: any) => (
                    <TableRow key={balance.id}>
                      <TableCell className="font-medium">
                        {getUserName(balance.user_id)}
                      </TableCell>
                      <TableCell>{balance.year}</TableCell>
                      <TableCell>{balance.days_earned} dias</TableCell>
                      <TableCell>{balance.days_used} dias</TableCell>
                      <TableCell>
                        <Badge variant={balance.days_available > 15 ? "default" : "destructive"}>
                          {balance.days_available} dias
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* All requests history - visible only to managers */}
        {canViewAllRequests && allRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Solicitações</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aprovado por</TableHead>
                    <TableHead>Data Aprovação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allRequests.map((request: any) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {getUserName(request.user_id)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(request.end_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{request.days_requested} dias</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.approved_by ? getUserName(request.approved_by) : "-"}
                      </TableCell>
                      <TableCell>
                        {request.approved_at ? format(new Date(request.approved_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <VacationRequestDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
      />

      {selectedRequest && (
        <VacationApprovalDialog
          open={showApprovalDialog}
          onOpenChange={setShowApprovalDialog}
          request={{
            ...selectedRequest,
            userName: getUserName(selectedRequest.user_id),
          }}
          onApprove={() => approveRequestMutation.mutate({ id: selectedRequest.id, approved: true })}
        />
      )}
    </Layout>
  );
}
