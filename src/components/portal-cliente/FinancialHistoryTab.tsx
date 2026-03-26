import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentViewer } from "@/components/DocumentViewer";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, AlertCircle, FileText, Receipt, Paperclip } from "lucide-react";
import { toast } from "sonner";

interface ReembolsoRecord {
  id: string;
  date: string;
  amount: number;
  status: string;
  category?: string;
  grupo_categoria?: string;
  percentual?: number;
  boleto_url?: string;
  nf_url?: string;
  pdf_url?: string;
  prazo_pagamento?: string;
  receipt_number?: string;
  tem_rateio?: boolean;
}

interface FinancialHistoryTabProps {
  clientId: string;
  aircraftId: string;
}

// Função corrigida para converter data sem problemas de timezone
const formatDateCorrectly = (dateString: string): string => {
  if (!dateString) return "";
  try {
    // Parse apenas a data sem adicionar horário
    const [year, month, day] = dateString.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString("pt-BR");
  } catch {
    return dateString;
  }
};

export function FinancialHistoryTab({ clientId, aircraftId }: FinancialHistoryTabProps) {
  const [records, setRecords] = useState<ReembolsoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string>("");
  const [viewerFileName, setViewerFileName] = useState<string>("");
  const [viewerFileType, setViewerFileType] = useState<string>("application/pdf");

  useEffect(() => {
    loadReembolsos();
  }, [clientId, aircraftId]);

  const loadReembolsos = async () => {
    try {
      setLoading(true);

      const reembolsoRecords: ReembolsoRecord[] = [];

      // 1. Carregar despesas lançadas ao cliente de bank_reconciliations
      // Filtra por client_id E aircraft_id quando disponível
      let bankQuery = supabase
        .from("bank_reconciliations")
        .select("*")
        .eq("client_id", clientId)
        .eq("type", "cliente");
      
      // Só adiciona filtro de aircraft_id se foi passado
      if (aircraftId) {
        bankQuery = bankQuery.eq("aircraft_id", aircraftId);
      }
      
      const { data: bankData } = await bankQuery.order("date", { ascending: false });

      if (bankData) {
        bankData.forEach((record: any) => {
          reembolsoRecords.push({
            id: record.id,
            date: record.date,
            amount: Math.abs(record.saldo_pendente ?? record.amount ?? 0),
            status: record.status || "pendente",
            category: record.category || record.description || "Despesa",
            grupo_categoria: "DESPESAS",
            boleto_url: record.boleto_url,
            nf_url: record.nf_url,
            pdf_url: record.comprovante_url,
            prazo_pagamento: record.prazo_pagamento,
            receipt_number: undefined,
            percentual: record.percentual ? parseFloat(record.percentual) : undefined,
            tem_rateio: !!record.percentual,
          });
        });
      }

      // Coletar IDs de reference_id que já vieram de bank_reconciliations (para evitar duplicatas)
      const bankReferenceIds = new Set(
        (bankData || [])
          .filter((r: any) => r.reference_id)
          .map((r: any) => r.reference_id)
      );

      // 2. Carregar recibos de reembolso da tabela receipts (exceto os que já estão em bank_reconciliations)
      let receiptsQuery = supabase
        .from("receipts")
        .select("*")
        .eq("client_id", clientId)
        .eq("receipt_type", "reembolso");

      // Só adiciona filtro de aircraft_id se foi passado
      if (aircraftId) {
        receiptsQuery = receiptsQuery.eq("aircraft_id", aircraftId);
      }

      const { data: receiptsData } = await receiptsQuery.order("issue_date", { ascending: false });

      if (receiptsData) {
        receiptsData.forEach((record: any) => {
          // Pular se já existe em bank_reconciliations via reference_id
          if (bankReferenceIds.has(record.id)) return;

          reembolsoRecords.push({
            id: record.id,
            date: record.issue_date,
            amount: Math.abs(record.amount || 0),
            status: record.status || "pendente",
            category: record.category_name || record.doc_number || "REEMBOLSO",
            grupo_categoria: "DESPESAS REEMBOLSÁVEIS",
            boleto_url: record.boleto_url,
            nf_url: record.nf_url,
            pdf_url: record.pdf_url,
            prazo_pagamento: record.max_payment_date,
            receipt_number: record.receipt_number,
            percentual: record.percentage,
            tem_rateio: record.is_shared,
          });
        });
      }

      // Ordenar por data decrescente
      reembolsoRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRecords(reembolsoRecords);
    } catch (error) {
      console.error("Error loading reembolsos:", error);
      toast.error("Erro ao carregar reembolsos");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower === "pago" || statusLower === "conferido" || statusLower === "recebido") {
      return "bg-green-500/20 text-green-300 border-green-500/30";
    }
    if (statusLower === "pendente") {
      return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    }
    if (statusLower === "enviado") {
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    }
    return "bg-slate-500/20 text-slate-300 border-slate-500/30";
  };

  const downloadFile = async (url: string, fileName: string) => {
    try {
      if (!url) {
        toast.error("Arquivo não disponível");
        return;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao baixar arquivo");

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success("Arquivo baixado com sucesso");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const openViewer = (url: string, fileName: string, fileType: string = "application/pdf") => {
    if (!url) {
      toast.error("Arquivo não disponível");
      return;
    }
    setViewerUrl(url);
    setViewerFileName(fileName);
    setViewerFileType(fileType);
    setViewerOpen(true);
  };

  if (loading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Carregando reembolsos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <DollarSign className="h-5 w-5 text-primary" />
            Histórico de Reembolsos
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Recibos de reembolso emitidos
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {records.length === 0 ? (
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-8 w-8" />
                <p>Nenhum reembolso encontrado</p>
              </div>
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="space-y-3">
                  {/* Cabeçalho com valor e número do recibo */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {record.receipt_number && (
                          <Badge variant="secondary" className="text-sm font-bold">
                            {record.receipt_number}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                          Reembolso
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        📅 {formatDateCorrectly(record.date)}
                      </p>
                      {record.prazo_pagamento && (
                        <p className="text-sm text-amber-400 mt-1">
                          ⏰ Prazo: {formatDateCorrectly(record.prazo_pagamento)}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-green-400">
                        R$ {Number(record.amount).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Detalhes */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-border">
                    <div className="bg-background/50 p-3 rounded">
                      <p className="text-xs text-muted-foreground font-semibold mb-1">STATUS</p>
                      <Badge className={`w-full justify-center py-2 ${getStatusColor(record.status)}`}>
                        {record.status?.charAt(0).toUpperCase() + record.status?.slice(1).toLowerCase()}
                      </Badge>
                    </div>

                    {record.category && (
                      <div className="bg-background/50 p-3 rounded">
                        <p className="text-xs text-muted-foreground font-semibold mb-1">CATEGORIA</p>
                        <p className="text-sm text-foreground font-medium">
                          {record.category.replace(/_/g, " ")}
                        </p>
                      </div>
                    )}

                    {record.percentual !== undefined && record.tem_rateio && (
                      <div className="bg-background/50 p-3 rounded">
                        <p className="text-xs text-muted-foreground font-semibold mb-1">RATEIO</p>
                        <p className="text-sm text-foreground font-medium flex items-center gap-1">
                          {record.percentual}%
                          <DollarSign className="h-3 w-3 text-amber-400" />
                        </p>
                      </div>
                    )}

                    {/* Anexos */}
                    {(record.boleto_url || record.nf_url || record.pdf_url) && (
                      <div className="bg-background/50 p-3 rounded">
                        <p className="text-xs text-muted-foreground font-semibold mb-2">ANEXOS</p>
                        <div className="flex gap-2">
                          {record.pdf_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => openViewer(record.pdf_url!, `Recibo-${record.receipt_number || record.id}.pdf`)}
                              title="Visualizar Recibo"
                            >
                              <FileText className="h-4 w-4 text-cyan-400" />
                            </Button>
                          )}
                          {record.boleto_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => openViewer(record.boleto_url!, `Boleto-${record.id}.pdf`)}
                              title="Visualizar Boleto"
                            >
                              <Receipt className="h-4 w-4 text-blue-400" />
                            </Button>
                          )}
                          {record.nf_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => openViewer(record.nf_url!, `NF-${record.id}.pdf`)}
                              title="Visualizar Nota Fiscal"
                            >
                              <Paperclip className="h-4 w-4 text-green-400" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="w-[95vw] max-w-[1300px] max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{viewerFileName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <DocumentViewer
              url={viewerUrl}
              fileName={viewerFileName}
              fileType={viewerFileType}
              onDownload={() => downloadFile(viewerUrl, viewerFileName)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
