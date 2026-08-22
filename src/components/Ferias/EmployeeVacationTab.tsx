import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, CheckCircle2, Clock3, Palmtree, XCircle } from "lucide-react";

interface EmployeeVacationTabProps { employeeId: string; employeeName: string; }

const labels: Record<string, string> = { pending: "Pendente", approved: "Aprovado", scheduled: "Agendado", rejected: "Recusado" };
const colors: Record<string, string> = { pending: "bg-amber-500/10 text-amber-600 border-amber-500/20", approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", scheduled: "bg-sky-500/10 text-sky-600 border-sky-500/20", rejected: "bg-red-500/10 text-red-600 border-red-500/20" };

export function EmployeeVacationTab({ employeeId, employeeName }: EmployeeVacationTabProps) {
  const { hasAnyRole } = useUserRole();
  const queryClient = useQueryClient();
  const canManage = hasAnyRole(["admin", "gestor_master"]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["employee-vacation-requests", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vacation_requests").select("*").eq("user_id", employeeId).order("criado_em", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc("approve_vacation_request", { p_request_id: requestId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacation-requests", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-vacation-pending"] });
      toast.success("Férias aprovadas e agendadas.");
      setApproveOpen(false); setSelectedRequestId(null);
    },
    onError: (error: any) => toast.error(error?.message || "Não foi possível aprovar as férias."),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reasonText }: { requestId: string; reasonText: string }) => {
      const { error } = await supabase.rpc("reject_vacation_request", { p_request_id: requestId, p_reason: reasonText || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-vacation-requests", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["vacation-requests-management"] });
      toast.success("Solicitação recusada.");
      setRejectOpen(false); setSelectedRequestId(null); setReason("");
    },
    onError: (error: any) => toast.error(error?.message || "Não foi possível recusar as férias."),
  });

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Carregando histórico de férias...</div>;
  if (requests.length === 0) return <div className="flex min-h-64 flex-col items-center justify-center text-center"><Palmtree className="mb-3 h-10 w-10 text-primary/50" /><p className="font-semibold">Nenhuma solicitação de férias</p><p className="mt-1 text-sm text-muted-foreground">{employeeName} ainda não solicitou férias.</p></div>;

  return (
    <div className="space-y-3">
      {requests.map((request: any) => (
        <Card key={request.id} className="rounded-2xl border-border/70"><CardContent className="p-4"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={colors[request.status] || ""}>{request.status === "pending" ? <Clock3 className="mr-1 h-3 w-3" /> : request.status === "rejected" ? <XCircle className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}{labels[request.status] || request.status}</Badge><span className="text-xs text-muted-foreground">Solicitado em {request.criado_em ? format(new Date(request.criado_em), "dd/MM/yyyy", { locale: ptBR }) : "—"}</span></div><div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="inline-flex items-center gap-1.5 font-medium"><Calendar className="h-4 w-4 text-primary" />{format(new Date(`${request.start_date}T12:00:00`), "dd/MM/yyyy")} → {format(new Date(`${request.end_date}T12:00:00`), "dd/MM/yyyy")}</span><Badge variant="secondary">{request.days} dias</Badge></div>{request.remarks && <p className="mt-2 rounded-xl bg-muted/50 p-2 text-xs text-muted-foreground">{request.remarks}</p>}</div>{canManage && request.status === "pending" && <div className="flex gap-2"><Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-600" onClick={() => { setSelectedRequestId(request.id); setApproveOpen(true); }}><CheckCircle2 className="mr-1 h-4 w-4" />Aprovar</Button><Button size="sm" variant="outline" className="border-red-300 text-red-600" onClick={() => { setSelectedRequestId(request.id); setRejectOpen(true); }}><XCircle className="mr-1 h-4 w-4" />Recusar</Button></div>}</div></CardContent></Card>
      ))}

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Aprovar férias de {employeeName}?</AlertDialogTitle><AlertDialogDescription>A aprovação será registrada de forma atômica, criará o agendamento oficial e notificará a contabilidade.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => selectedRequestId && approveMutation.mutate(selectedRequestId)} disabled={approveMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600">{approveMutation.isPending ? "Processando..." : "Aprovar"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}><AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Recusar férias de {employeeName}</AlertDialogTitle><AlertDialogDescription><div className="space-y-2"><Label>Motivo</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explique a decisão para o colaborador." /></div></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setReason("")}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => selectedRequestId && rejectMutation.mutate({ requestId: selectedRequestId, reasonText: reason })} disabled={rejectMutation.isPending} className="bg-red-500 hover:bg-red-600">{rejectMutation.isPending ? "Processando..." : "Recusar"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
