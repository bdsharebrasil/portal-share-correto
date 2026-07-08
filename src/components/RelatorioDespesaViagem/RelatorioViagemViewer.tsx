// @ts-nocheck
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowLeft, Eye, Edit, Printer, Download } from "lucide-react";
import { TravelReportStatusManager, type TravelReportStatus } from "./TravelReportStatusManager";
import type { TravelReport } from "@/pages/financeiro/RelatorioViagem";

interface RelatorioViagemViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: TravelReport | null;
  onEdit?: (reportId: string) => void;
  onPrint?: (reportId: string) => void;
  onStatusChange?: (status: TravelReportStatus) => void;
}

/**
 * Visualizador de Relatório de Viagem
 * Mostra detalhes completos e gerenciador de status
 */
export function RelatorioViagemViewer({
  open,
  onOpenChange,
  report,
  onEdit,
  onPrint,
  onStatusChange,
}: RelatorioViagemViewerProps) {
  const [localReport, setLocalReport] = useState<TravelReport | null>(report);

  useEffect(() => {
    setLocalReport(report);
  }, [report]);

  if (!localReport) return null;

  const handleStatusChanged = (newStatus: TravelReportStatus) => {
    setLocalReport({
      ...localReport,
      status: newStatus as TravelReport['status'],
    });
    onStatusChange?.(newStatus);
  };

  const fmt = (val = 0) =>
    `R$ ${val.toFixed(2).replace(".", ",")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg flex items-center gap-2">
                Relatório de Viagem
                <Badge variant="outline">{localReport.numero_relatorio}</Badge>
              </DialogTitle>
              <DialogDescription className="mt-2">
                {localReport.client} • {localReport.matricula_aeronave}
              </DialogDescription>
            </div>
            <DialogClose />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Básica */}
          <Card className="border-border bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Informações da Viagem</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Tripulante</p>
                <p className="font-semibold">{localReport.nome_tripulante}</p>
                {localReport.nome_tripulante_2 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {localReport.nome_tripulante_2}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rota</p>
                <p className="font-semibold">{localReport.rota}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data Início</p>
                <p className="font-semibold">
                  {new Date(localReport.data_inicio).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data Fim</p>
                <p className="font-semibold">
                  {new Date(localReport.data_fim).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Despesas por Categoria */}
          <Card className="border-border bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Resumo de Despesas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Combustível</p>
                  <p className="font-bold text-primary">
                    {fmt(localReport.total_combustivel)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Hospedagem</p>
                  <p className="font-bold text-primary">
                    {fmt(localReport.total_hospedagem)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Alimentação</p>
                  <p className="font-bold text-primary">
                    {fmt(localReport.total_alimentacao)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Transporte</p>
                  <p className="font-bold text-primary">
                    {fmt(localReport.total_transporte)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Outros</p>
                  <p className="font-bold text-primary">
                    {fmt(localReport.total_outros)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold text-primary text-lg">
                    {fmt(localReport.total_valor)}
                  </p>
                </div>
              </div>

              {/* Distribuição */}
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Tripulante</p>
                  <p className="font-semibold text-emerald-600">
                    {fmt(localReport.total_tripulacao)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-semibold text-blue-600">
                    {fmt(localReport.total_clientes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ShareBrasil</p>
                  <p className="font-semibold text-orange-600">
                    {fmt(localReport.total_sharebrasil)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Manager */}
          <TravelReportStatusManager
            reportId={localReport.id || ""}
            currentStatus={localReport.status as TravelReportStatus}
            onStatusChange={handleStatusChanged}
            clientName={localReport.client || "Cliente"}
            reportNumber={localReport.numero_relatorio}
          />

          {/* Info Adicional */}
          {localReport.observacoes && (
            <Card className="border-border bg-card/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {localReport.observacoes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Relatório nunca sai do histórico - Info */}
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold">Histórico Permanente</p>
              <p className="text-xs mt-1">
                Este relatório permanecerá no histórico da pasta do cliente. Apenas o status pode mudar. Nenhum documento é removido do sistema.
              </p>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-4 border-t border-border">
          {onEdit && localReport.status === "Rascunho" && (
            <Button
              variant="outline"
              onClick={() => {
                onEdit(localReport.id || "");
                onOpenChange(false);
              }}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          )}

          {onPrint && (
            <Button
              variant="outline"
              onClick={() => {
                onPrint(localReport.id || "");
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          )}

          <DialogClose asChild>
            <Button variant="outline" className="ml-auto">
              Fechar
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
