// @ts-nocheck
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
  DollarSign,
} from "lucide-react";

export type TravelReportStatus =
  | "Rascunho"
  | "Finalizado"
  | "Enviado Tripulante"
  | "Assinado"
  | "Enviado Cliente"
  | "Pago";

interface TravelReportStatusManagerProps {
  reportId: string;
  currentStatus: TravelReportStatus | string;
  onStatusChange: (newStatus: TravelReportStatus) => void;
  clientName: string;
  reportNumber: string;
}

interface StepInfo {
  label: string;
  icon: React.ReactNode;
  color: string; // badge classes
  description: string;
}

const STATUS_INFO: Record<TravelReportStatus, StepInfo> = {
  "Rascunho": {
    label: "Rascunho",
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
    description: "Em edição",
  },
  "Finalizado": {
    label: "Finalizado",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    description: "Pronto para envio ao tripulante",
  },
  "Enviado Tripulante": {
    label: "Aguardando Conferência",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    color: "bg-orange-500/15 text-orange-700 border-orange-500/30",
    description: "Enviado ao tripulante para conferência/assinatura",
  },
  "Assinado": {
    label: "Assinado",
    icon: <FileCheck className="h-3.5 w-3.5" />,
    color: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
    description: "Pronto para envio ao cliente",
  },
  "Enviado Cliente": {
    label: "Aguardando Pagamento",
    icon: <Send className="h-3.5 w-3.5" />,
    color: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    description: "Enviado ao portal do cliente",
  },
  "Pago": {
    label: "Pago",
    icon: <DollarSign className="h-3.5 w-3.5" />,
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    description: "Reembolso recebido do cliente",
  },
};

const FLOW_ORDER: TravelReportStatus[] = [
  "Rascunho",
  "Finalizado",
  "Enviado Tripulante",
  "Assinado",
  "Enviado Cliente",
  "Pago",
];

function normalizeStatus(s: string | undefined | null): TravelReportStatus {
  const v = String(s ?? "").trim().toLowerCase();
  if (v === "pago" || v === "paid" || v === "recebido") return "Pago";
  if (v === "enviado cliente" || v === "enviado ao cliente" || v === "aguardando pagamento") return "Enviado Cliente";
  if (v === "assinado") return "Assinado";
  if (v === "enviado tripulante" || v === "enviado" || v === "ag. conferência" || v === "ag. conferencia" || v === "aguardando conferencia" || v === "aguardando conferência") return "Enviado Tripulante";
  if (v === "finalizado") return "Finalizado";
  return "Rascunho";
}

export function TravelReportStatusManager({
  reportId,
  currentStatus,
  onStatusChange,
  clientName,
  reportNumber,
}: TravelReportStatusManagerProps) {
  const status = normalizeStatus(currentStatus as string);

  const [isLoading, setIsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<TravelReportStatus | null>(null);

  const updateStatus = async (newStatus: TravelReportStatus) => {
    setIsLoading(true);
    try {
      const updates: Record<string, any> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      const now = new Date().toISOString();
      if (newStatus === "Enviado Tripulante") updates.enviado_tripulante_em = now;
      if (newStatus === "Assinado") updates.assinado_em = now;
      if (newStatus === "Enviado Cliente") updates.enviado_cliente_em = now;

      const { error } = await supabase
        .from("travel_expense_reports")
        .update(updates)
        .eq("id", reportId);
      if (error) throw error;

      // Quando enviado ao cliente, dispara a função que cria contas a pagar/receber
      if (newStatus === "Enviado Cliente") {
        const { error: rpcError } = await supabase.rpc(
          "gerar_financeiro_relatorio_viagem" as any,
          { p_report_id: reportId } as any,
        );
        if (rpcError) {
          console.error("Erro ao gerar financeiro:", rpcError);
          toast.error(`Status atualizado, mas falhou ao gerar contas: ${rpcError.message}`);
        } else {
          toast.success("✓ Enviado ao cliente — contas a pagar e a receber geradas");
        }
      } else {
        toast.success(`✓ Status alterado para "${STATUS_INFO[newStatus].label}"`);
      }

      onStatusChange(newStatus);
      setConfirmOpen(false);
      setPendingTarget(null);
    } catch (err: any) {
      console.error("Erro ao alterar status:", err);
      toast.error(`❌ Erro ao alterar status: ${err.message ?? err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const requestStatusChange = (target: TravelReportStatus) => {
    setPendingTarget(target);
    setConfirmOpen(true);
  };

  const statusInfo = STATUS_INFO[status];
  const currentIndex = FLOW_ORDER.indexOf(status);

  // Botões de ação por estado
  const renderActions = () => {
    if (status === "Rascunho") {
      return (
        <Button
          onClick={() => requestStatusChange("Finalizado")}
          disabled={isLoading}
          className="w-full gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Finalizar Relatório
        </Button>
      );
    }

    if (status === "Finalizado") {
      return (
        <div className="space-y-2">
          <Button
            onClick={() => requestStatusChange("Enviado Tripulante")}
            disabled={isLoading}
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="h-4 w-4" />
            Enviar ao Tripulante
          </Button>
          <Button disabled variant="outline" className="w-full gap-2 opacity-60 cursor-not-allowed">
            <Send className="h-4 w-4" />
            Enviar ao Cliente
            <span className="text-xs ml-auto">aguarde assinatura</span>
          </Button>
        </div>
      );
    }

    if (status === "Enviado Tripulante") {
      return (
        <div className="space-y-2">
          <Button
            onClick={() => requestStatusChange("Assinado")}
            disabled={isLoading}
            className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <FileCheck className="h-4 w-4" />
            Marcar como Assinado
          </Button>
          <Button disabled variant="outline" className="w-full gap-2 opacity-60 cursor-not-allowed">
            <Send className="h-4 w-4" />
            Enviar ao Cliente
            <span className="text-xs ml-auto">aguarde assinatura</span>
          </Button>
        </div>
      );
    }

    if (status === "Assinado") {
      return (
        <Button
          onClick={() => requestStatusChange("Enviado Cliente")}
          disabled={isLoading}
          className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Send className="h-4 w-4" />
          Enviar ao Cliente (gera contas)
        </Button>
      );
    }

    if (status === "Enviado Cliente") {
      return (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-sm text-blue-700">
          <p className="font-semibold">Aguardando pagamento do cliente</p>
          <p className="text-xs mt-1 text-blue-600">
            Quando o contas a receber for marcado como pago, o relatório será atualizado automaticamente.
          </p>
        </div>
      );
    }

    // Pago
    return (
      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
        <p className="text-sm text-emerald-700 font-semibold">✓ Reembolso recebido</p>
        <p className="text-xs text-emerald-600 mt-1">Fluxo concluído.</p>
      </div>
    );
  };

  return (
    <>
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              {statusInfo.icon}
              Status do Relatório
            </span>
            <Badge className={`${statusInfo.color} border`}>{statusInfo.label}</Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Número</span><span className="font-mono font-semibold">{reportNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{clientName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Situação</span><span>{statusInfo.description}</span></div>
          </div>

          {/* Fluxo */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Fluxo</p>
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              {FLOW_ORDER.map((s, idx) => {
                const info = STATUS_INFO[s];
                const isCurrent = s === status;
                const isPast = idx < currentIndex;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-full border ${
                        isCurrent
                          ? info.color
                          : isPast
                          ? "bg-muted text-foreground/70 border-border"
                          : "bg-muted/30 text-muted-foreground border-border/50"
                      }`}
                    >
                      {info.icon}
                      <span className="hidden sm:inline">{info.label}</span>
                    </div>
                    {idx < FLOW_ORDER.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground hidden sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {renderActions()}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Confirmar Alteração de Status
            </DialogTitle>
            <DialogDescription>Relatório {reportNumber}</DialogDescription>
          </DialogHeader>

          {pendingTarget && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="text-sm flex items-center gap-2 flex-wrap">
                  <Badge className={STATUS_INFO[status].color + " border"}>{STATUS_INFO[status].label}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className={STATUS_INFO[pendingTarget].color + " border"}>{STATUS_INFO[pendingTarget].label}</Badge>
                </div>
                {pendingTarget === "Enviado Cliente" && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">Esta ação irá gerar automaticamente:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Contas a pagar para os tripulantes (valores Tripulante 1 e Tripulante 2)</li>
                      <li>Contas a receber do cliente (valor Share Brasil)</li>
                      <li>Valores marcados como “Cliente” serão ignorados (já pagos pelo cliente)</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button onClick={() => updateStatus(pendingTarget)} disabled={isLoading}>
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Alterando...</> : "Confirmar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
