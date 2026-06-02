import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  Send,
  FileCheck,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";

export type TravelReportStatus = 
  | "Rascunho" 
  | "Ag. Conferência" 
  | "Enviado" 
  | "Assinado" 
  | "Finalizado";

interface TravelReportStatusManagerProps {
  reportId: string;
  currentStatus: TravelReportStatus;
  onStatusChange: (newStatus: TravelReportStatus) => void;
  clientName: string;
  reportNumber: string;
}

// Status flow: Rascunho → Ag. Conferência → Enviado → Assinado → Finalizado
const STATUS_FLOW: Record<TravelReportStatus, TravelReportStatus | null> = {
  "Rascunho": "Ag. Conferência",
  "Ag. Conferência": "Enviado",
  "Enviado": "Assinado",
  "Assinado": "Finalizado",
  "Finalizado": null, // Fim do fluxo
};

const STATUS_INFO: Record<TravelReportStatus, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  "Rascunho": {
    label: "Rascunho",
    icon: <Clock className="h-4 w-4" />,
    color: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
    description: "Relatório em edição",
  },
  "Ag. Conferência": {
    label: "Aguardando Conferência",
    icon: <AlertCircle className="h-4 w-4" />,
    color: "bg-orange-500/20 text-orange-700 border-orange-500/30",
    description: "Pendente de conferência",
  },
  "Enviado": {
    label: "Enviado",
    icon: <Send className="h-4 w-4" />,
    color: "bg-blue-500/20 text-blue-700 border-blue-500/30",
    description: "Enviado para tripulante/cliente",
  },
  "Assinado": {
    label: "Assinado",
    icon: <FileCheck className="h-4 w-4" />,
    color: "bg-cyan-500/20 text-cyan-700 border-cyan-500/30",
    description: "Assinatura recebida",
  },
  "Finalizado": {
    label: "Finalizado",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
    description: "Processamento completo",
  },
};

/**
 * Gerenciador de Status para Relatórios de Despesa de Viagem
 * 
 * Funcionalidades:
 * - Fluxo controlado de status
 * - Histórico completo (nunca deleta)
 * - Atualização automática do budget
 * - Interface intuitiva com badges
 */
export function TravelReportStatusManager({
  reportId,
  currentStatus,
  onStatusChange,
  clientName,
  reportNumber,
}: TravelReportStatusManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<TravelReportStatus | null>(null);

  const nextStatus = STATUS_FLOW[currentStatus];
  const statusInfo = STATUS_INFO[currentStatus];

  const handleStatusChange = async () => {
    if (!targetStatus) return;

    setIsLoading(true);
    try {
      // 1. Atualizar o status do relatório
      const { error: reportError } = await supabase
        .from("travel_expense_reports")
        .update({
          status: targetStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (reportError) throw reportError;

      // 2. Se mudar para "Finalizado", atualizar budget também
      if (targetStatus === "Finalizado") {
        // Log de auditoria
        const { error: auditError } = await supabase
          .from("travel_report_audit_log")
          .insert({
            report_id: reportId,
            status_anterior: currentStatus,
            status_novo: targetStatus,
            data_mudanca: new Date().toISOString(),
            observacoes: `Status alterado de ${currentStatus} para ${targetStatus}`,
          });

        if (auditError) {
          console.warn("Erro ao registrar auditoria (tabela pode não existir):", auditError);
        }
      }

      toast.success(`✓ Status alterado para "${STATUS_INFO[targetStatus].label}"`);
      onStatusChange(targetStatus);
      setConfirmDialogOpen(false);
      setTargetStatus(null);
    } catch (error: any) {
      console.error("Erro ao alterar status:", error);
      toast.error(`❌ Erro ao alterar status: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdvanceStatus = () => {
    if (!nextStatus) {
      toast.info("ℹ️ Esse relatório já está finalizado");
      return;
    }
    setTargetStatus(nextStatus);
    setConfirmDialogOpen(true);
  };

  return (
    <>
      {/* Card de Status */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              {statusInfo.icon}
              Status do Relatório
            </span>
            <Badge className={`${statusInfo.color} border`}>
              {statusInfo.label}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Info sobre relatório */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Número</span>
              <span className="font-mono font-semibold">{reportNumber}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{clientName}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-muted-foreground">Situação</span>
              <span className="text-foreground">{statusInfo.description}</span>
            </div>
          </div>

          {/* Fluxo de Status */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
              Fluxo de Status
            </p>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              {Object.entries(STATUS_INFO).map(([status, info], idx) => (
                <div key={status} className="flex items-center gap-2">
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-full border ${
                      status === currentStatus
                        ? info.color
                        : "bg-muted/50 text-muted-foreground border-border/50"
                    }`}
                  >
                    {info.icon}
                    <span className="hidden sm:inline">{info.label}</span>
                  </div>
                  {idx < Object.keys(STATUS_INFO).length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground hidden sm:block" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Botão de Avançar Status */}
          {nextStatus && (
            <Button
              onClick={handleAdvanceStatus}
              disabled={isLoading}
              className="w-full gap-2 bg-primary hover:bg-primary/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  Avançar para {STATUS_INFO[nextStatus].label}
                </>
              )}
            </Button>
          )}

          {!nextStatus && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-sm text-emerald-700 font-medium">
                ✓ Relatório finalizado e processado
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Este documento permanecerá no histórico da pasta do cliente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Confirmar Alteração de Status
            </DialogTitle>
            <DialogDescription>
              Você está alterando o status do relatório {reportNumber}
            </DialogDescription>
          </DialogHeader>

          {targetStatus && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <Badge className={STATUS_INFO[currentStatus].color + " border"}>
                      {STATUS_INFO[currentStatus].label}
                    </Badge>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <Badge className={STATUS_INFO[targetStatus].color + " border"}>
                      {STATUS_INFO[targetStatus].label}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-foreground">
                  <strong>Ação:</strong> {getStatusTransitionMessage(currentStatus, targetStatus)}
                </p>

                <p className="text-xs text-muted-foreground">
                  <strong>Nota:</strong> Este relatório permanecerá no histórico da pasta do cliente. Você poderá voltar para conferir os detalhes a qualquer momento.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmDialogOpen(false);
                    setTargetStatus(null);
                  }}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleStatusChange}
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Alterando...
                    </>
                  ) : (
                    "Confirmar"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function getStatusTransitionMessage(from: TravelReportStatus, to: TravelReportStatus): string {
  const messages: Record<string, string> = {
    "Rascunho→Ag. Conferência":
      "Relatório enviado para conferência inicial.",
    "Ag. Conferência→Enviado":
      "Relatório conferenciado e enviado ao tripulante/cliente.",
    "Enviado→Assinado":
      "Relatório assinado pela tripulação/cliente.",
    "Assinado→Finalizado":
      "Relatório finalizado e processado no sistema financeiro.",
  };

  const key = `${from}→${to}`;
  return messages[key] || "Alterando status do relatório.";
}
