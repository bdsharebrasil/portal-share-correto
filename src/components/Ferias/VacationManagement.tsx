import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Calendar, CalendarCheck, CalendarX, CheckCircle2, Clock3, Palmtree, XCircle } from "lucide-react";

const statusLabel: Record<string, string> = { pending: "Pendente", approved: "Aprovado", scheduled: "Agendado", rejected: "Recusado" };
const statusClass: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  scheduled: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function VacationManagement() {
  const { hasAnyRole } = useUserRole();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const canManage = hasAnyRole(["admin", "gestor_master"]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["vacation-management-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_profiles").select("id, full_name, email, avatar_url, departamento, cargo, employment_status").eq("tipo", "colaborador").order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["vacation-requests-management"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vacation_requests").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const enriched = useMemo(() => requests.map((request: any) => ({
    ...request,
    employee: profiles.find((profile: any) => profile.id === request.user_id),
  })), [requests, profiles]);

  const pending = enriched.filter((request: any) => request.status === "pending");
  const approved = enriched.filter((request: any) => ["approved", "scheduled"].includes(request.status));
  const rejected = enriched.filter((request: any) => request.status === "rejected");

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("approve_vacation_request", { p_request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      queryClient.invalidateQueries({ queryKey: ["employee-vacation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["vacation-history"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-vacation-pending"] });
      toast.success("Férias aprovadas, agendadas e encaminhadas para a contabilidade.");
      setSelectedRequest(null);
      setShowApprove(false);
    },
    onError: (error: any) => toast.error(error?.message || "Não foi possível aprovar as férias."),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const { error } = await supabase.rpc("reject_vacation_request", { p_request_id: requestId, p_reason: reason || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      queryClient.invalidateQueries({ queryKey: ["employee-vacation-requests"] });
      toast.success("Solicitação recusada e colaborador notificado.");
      setSelectedRequest(null);
      setRejectionReason("");
      setShowReject(false);
    },
    onError: (error: any) => toast.error(error?.message || "Não foi possível recusar as férias."),
  });

  if (!canManage) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">A aprovação de férias é realizada pelo Gestor Master.</CardContent></Card>;
  }

  const RequestCard = ({ request, action }: { request: any; action?: boolean }) => (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-4">
            <Avatar className="h-12 w-12 shrink-0 border border-primary/20"><AvatarImage src={request.employee?.avatar_url || undefined} /><AvatarFallback>{(request.employee?.full_name || "C").split(" ").map((part: string) => part[0]).slice(0, 2).join("").toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0"><p className="truncate font-semibold">{request.employee?.full_name || "Colaborador"}</p><p className="text-xs text-muted-foreground">{request.employee?.cargo || request.employee?.departamento || "Colaborador"}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4 text-primary" />{format(new Date(`${request.start_date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })} → {format(new Date(`${request.end_date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}</span><Badge variant="outline">{request.days} dias</Badge><Badge variant="outline" className={statusClass[request.status]}>{statusLabel[request.status] || request.status}</Badge></div>{request.remarks && <p className="mt-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">{request.remarks}</p>}</div>
          </div>
          {action && <div className="flex gap-2"><Button onClick={() => { setSelectedRequest(request); setShowApprove(true); }} className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar</Button><Button variant="outline" onClick={() => { setSelectedRequest(request); setShowReject(true); }} className="rounded-xl border-red-300 text-red-600"><XCircle className="mr-2 h-4 w-4" />Recusar</Button></div>}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-500/10 p-3 text-amber-500"><Bell className="h-5 w-5" /></div><div><p className="text-2xl font-bold">{pending.length}</p><p className="text-xs text-muted-foreground">Aguardando decisão</p></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500"><CalendarCheck className="h-5 w-5" /></div><div><p className="text-2xl font-bold">{approved.length}</p><p className="text-xs text-muted-foreground">Aprovadas/agendadas</p></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-red-500/10 p-3 text-red-500"><CalendarX className="h-5 w-5" /></div><div><p className="text-2xl font-bold">{rejected.length}</p><p className="text-xs text-muted-foreground">Recusadas</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="rounded-2xl bg-muted/60 p-1"><TabsTrigger value="pending" className="rounded-xl">Pendentes</TabsTrigger><TabsTrigger value="approved" className="rounded-xl">Aprovadas</TabsTrigger><TabsTrigger value="rejected" className="rounded-xl">Recusadas</TabsTrigger></TabsList>
        <TabsContent value="pending" className="space-y-3">{isLoading ? <div className="py-12 text-center text-muted-foreground">Carregando...</div> : pending.length === 0 ? <Card><CardContent className="py-12 text-center text-muted-foreground"><Palmtree className="mx-auto mb-3 h-8 w-8" />Nenhum pedido pendente.</CardContent></Card> : pending.map((request: any) => <RequestCard key={request.id} request={request} action />)}</TabsContent>
        <TabsContent value="approved" className="space-y-3">{approved.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma férias aprovada.</p> : approved.map((request: any) => <RequestCard key={request.id} request={request} />)}</TabsContent>
        <TabsContent value="rejected" className="space-y-3">{rejected.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma solicitação recusada.</p> : rejected.map((request: any) => <RequestCard key={request.id} request={request} />)}</TabsContent>
      </Tabs>

      <AlertDialog open={showApprove} onOpenChange={setShowApprove}>
        <AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Aprovar e agendar férias</AlertDialogTitle><AlertDialogDescription>{selectedRequest && <>Confirme as férias de <strong>{selectedRequest.employee?.full_name}</strong> de <strong>{format(new Date(`${selectedRequest.start_date}T12:00:00`), "dd/MM/yyyy")}</strong> a <strong>{format(new Date(`${selectedRequest.end_date}T12:00:00`), "dd/MM/yyyy")}</strong>. A aprovação será registrada, o período será agendado e a contabilidade será notificada automaticamente.</>}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => selectedRequest && approveMutation.mutate(selectedRequest.id)} disabled={approveMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600">{approveMutation.isPending ? "Processando..." : "Aprovar"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReject} onOpenChange={setShowReject}>
        <AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500" />Recusar férias</AlertDialogTitle><AlertDialogDescription className="space-y-3">{selectedRequest && <p>Recusar a solicitação de <strong>{selectedRequest.employee?.full_name}</strong>.</p>}<div><Label htmlFor="rejection-reason">Motivo da recusa</Label><Textarea id="rejection-reason" className="mt-2" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Informe o motivo para o colaborador." /></div></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setRejectionReason("")}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => selectedRequest && rejectMutation.mutate({ requestId: selectedRequest.id, reason: rejectionReason })} disabled={rejectMutation.isPending} className="bg-red-500 hover:bg-red-600">{rejectMutation.isPending ? "Processando..." : "Recusar"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
