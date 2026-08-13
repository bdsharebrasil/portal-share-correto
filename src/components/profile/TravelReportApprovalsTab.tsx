import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, XCircle, FileText, Loader2, Calendar, DollarSign } from "lucide-react";

interface TravelReportApprovalsTabProps {
  userId: string;
}

interface TravelReport {
  id: string;
  numero_relatorio: string;
  data_inicio: string;
  data_fim: string;
  total_valor: number | null;
  crew_approval_status: string | null;
  crew_approved_at: string | null;
  crew_approval_notes: string | null;
  crew2_approval_status?: string | null;
  crew2_approved_at?: string | null;
  crew2_approval_notes?: string | null;
  total_trip?: number | null;
  total_trip2?: number | null;
  tripulacao_id?: string | null;
  tripulante_id2?: string | null;
  nome_tripulante: string | null;
  nome_tripulante_2: string | null;
  rota: string | null;
  cliente?: { razao_social: string } | null;
  /** Slot do tripulante logado neste relatório */
  slot?: 1 | 2;
  myStatus?: string | null;
  myNotes?: string | null;
  myValue?: number | null;
}

export function TravelReportApprovalsTab({ userId }: TravelReportApprovalsTabProps) {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<TravelReport | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(null);

  // Buscar ID do tripulante baseado no user_id
  const { data: crewMember } = useQuery({
    queryKey: ["crew_member", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_tripulacao")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Buscar relatórios pendentes de aprovação
  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ["pending_travel_approvals", crewMember?.id],
    enabled: !!crewMember?.id,
    queryFn: async () => {
      if (!crewMember?.id) return [];

      const { data, error } = await supabase
        .from("travel_expense_reports")
        .select(
          "id, numero_relatorio, data_inicio, data_fim, total_valor, total_trip, total_trip2, tripulacao_id, tripulante_id2, crew_approval_status, crew_approved_at, crew_approval_notes, crew2_approval_status, crew2_approved_at, crew2_approval_notes, nome_tripulante, nome_tripulante_2, rota, cliente:clientes_id(razao_social)"
        )
        .or(`tripulacao_id.eq.${crewMember.id},tripulante_id2.eq.${crewMember.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar relatórios:", error);
        return [];
      }

      // Cada tripulante aprova SOMENTE o seu próprio slot/valor
      return ((data as any[]) || [])
        .map((r) => {
          const slot: 1 | 2 = r.tripulante_id2 === crewMember.id && r.tripulacao_id !== crewMember.id ? 2 : 1;
          return {
            ...r,
            slot,
            myStatus: slot === 2 ? r.crew2_approval_status : r.crew_approval_status,
            myNotes: slot === 2 ? r.crew2_approval_notes : r.crew_approval_notes,
            myValue: slot === 2 ? r.total_trip2 : r.total_trip,
          } as TravelReport;
        })
        .filter((r) => r.myStatus === "pending" || r.myStatus === "rejected");
    },
  });

  const handleApprove = async () => {
    if (!selectedReport) return;

    setSubmitting(true);
    try {
      const isSlot2 = selectedReport.slot === 2;
      const { error } = await supabase
        .from("travel_expense_reports")
        .update(
          isSlot2
            ? {
                crew2_approval_status: "approved",
                crew2_approved_at: new Date().toISOString(),
                crew2_approval_notes: approvalNotes || null,
              }
            : {
                crew_approval_status: "approved",
                crew_approved_at: new Date().toISOString(),
                crew_approval_notes: approvalNotes || null,
              },
        )
        .eq("id", selectedReport.id);

      if (error) throw error;

      toast({
        title: "Relatório aprovado",
        description: `Relatório ${selectedReport.numero_relatorio} foi aprovado com sucesso.`,
      });

      setSelectedReport(null);
      setApprovalNotes("");
      setDialogAction(null);
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao aprovar";
      toast({
        title: "Erro ao aprovar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReport) return;

    setSubmitting(true);
    try {
      const isSlot2 = selectedReport.slot === 2;
      const { error } = await supabase
        .from("travel_expense_reports")
        .update(
          isSlot2
            ? {
                crew2_approval_status: "rejected",
                crew2_approval_notes: approvalNotes || null,
              }
            : {
                crew_approval_status: "rejected",
                crew_approval_notes: approvalNotes || null,
              },
        )
        .eq("id", selectedReport.id);

      if (error) throw error;

      toast({
        title: "Relatório rejeitado",
        description: `Relatório ${selectedReport.numero_relatorio} foi rejeitado.`,
      });

      setSelectedReport(null);
      setApprovalNotes("");
      setDialogAction(null);
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao rejeitar";
      toast({
        title: "Erro ao rejeitar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-700 border-green-500/30 flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" />
            Aprovado
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-700 border-red-500/30 flex items-center gap-1 w-fit">
            <XCircle className="h-3 w-3" />
            Rejeitado
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 flex items-center gap-1 w-fit">
            <AlertCircle className="h-3 w-3" />
            Pendente
          </Badge>
        );
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  if (isLoading || !crewMember) {
    return (
      <Card className="border-border shadow-elevated rounded-xl">
        <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando relatórios...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Aprovações de Relatórios de Viagem</h2>
        <p className="text-muted-foreground">
          Revise e aprove os relatórios de viagem que você criou
        </p>
      </div>

      {reports.length === 0 ? (
        <Card className="border-border shadow-elevated rounded-xl">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum relatório pendente de aprovação</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card
              key={report.id}
              className="border-border shadow-elevated rounded-xl hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5 text-primary" />
                      Relatório {report.numero_relatorio}
                    </CardTitle>
                    {report.cliente?.razao_social && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Cliente: {report.cliente.razao_social}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(report.myStatus ?? null)}
                    <Badge variant="outline" className="text-[10px]">
                      Tripulante {report.slot ?? 1}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Informações principais */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Período</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {formatDate(report.data_inicio)} a {formatDate(report.data_fim)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Valor Total</p>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{formatCurrency(report.total_valor)}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Seu reembolso</p>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold text-primary">{formatCurrency(report.myValue ?? null)}</p>
                    </div>
                  </div>

                  {report.rota && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Rota</p>
                      <p className="text-sm font-medium">{report.rota}</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Tripulação</p>
                    <p className="text-sm font-medium">
                      {report.nome_tripulante}
                      {report.nome_tripulante_2 && ` / ${report.nome_tripulante_2}`}
                    </p>
                  </div>
                </div>

                {/* Notas anteriores de aprovação */}
                {report.myNotes && report.myStatus !== "pending" && (
                  <Alert className="border-blue-500/50 bg-blue-500/5">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      <p className="font-semibold text-sm mb-1">Observação anterior:</p>
                      <p className="text-sm">{report.myNotes}</p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Botões de ação */}
                {report.myStatus === "pending" && (
                  <div className="flex gap-3 justify-end pt-2 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedReport(report);
                        setDialogAction("reject");
                        setApprovalNotes("");
                      }}
                      className="flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedReport(report);
                        setDialogAction("approve");
                        setApprovalNotes("");
                      }}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Aprovar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de aprovação/rejeição */}
      <Dialog
        open={dialogAction !== null && selectedReport !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDialogAction(null);
            setSelectedReport(null);
            setApprovalNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "approve" ? "Aprovar Relatório" : "Rejeitar Relatório"}
            </DialogTitle>
            <DialogDescription>
              {selectedReport && (
                <div className="mt-3 space-y-2 text-sm text-foreground">
                  <p>
                    <span className="font-medium">Relatório:</span> {selectedReport.numero_relatorio}
                  </p>
                  <p>
                    <span className="font-medium">Período:</span> {formatDate(selectedReport.data_inicio)} a{" "}
                    {formatDate(selectedReport.data_fim)}
                  </p>
                  <p>
                    <span className="font-medium">Seu valor:</span>{" "}
                    {formatCurrency(selectedReport.myValue ?? selectedReport.total_valor)}
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialogAction === "reject" && (
              <Alert className="border-yellow-500/50 bg-yellow-500/5">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm">
                  Você está rejeitando este relatório. Considere adicionar uma observação sobre o motivo.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="approval-notes" className="text-sm font-medium">
                Observações{" "}
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="approval-notes"
                placeholder="Adicione suas observações aqui..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={4}
                className="rounded-lg border border-border"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogAction(null);
                setSelectedReport(null);
                setApprovalNotes("");
              }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={dialogAction === "approve" ? handleApprove : handleReject}
              disabled={submitting}
              className={`flex items-center gap-2 ${
                dialogAction === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  {dialogAction === "approve" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Aprovar
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
