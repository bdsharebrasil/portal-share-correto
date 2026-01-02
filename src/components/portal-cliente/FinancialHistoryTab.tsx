import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, AlertCircle, FileText, Receipt, Paperclip, Download } from "lucide-react";
import { toast } from "sonner";

interface FinancialRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  type: "bank_reconciliation" | "rateio_despesas" | "receipt";
  category?: string;
  grupo_categoria?: string;
  observacoes?: string;
  percentual?: number;
  aircraft_registration?: string;
  boleto_url?: string;
  nf_url?: string;
  pdf_url?: string;
  payment_term?: string;
  receipt_number?: string;
  tem_rateio?: boolean;
}

interface FinancialHistoryTabProps {
  clientId: string;
  aircraftId: string;
}

export function FinancialHistoryTab({ clientId, aircraftId }: FinancialHistoryTabProps) {
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'reembolsos' | 'rateios' | 'outros'>('todos');

  useEffect(() => {
    loadFinancialHistory();
  }, [clientId, aircraftId]);

  const loadFinancialHistory = async () => {
    try {
      setLoading(true);

      // 1. Carregar conciliações bancárias (incluindo reembolsos)
      const { data: bankData } = await supabase
        .from("bank_reconciliations")
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (
            id,
            nome,
            grupo_categoria,
            cor,
            icone
          )
        `)
        .eq("client_id", clientId)
        .eq("aircraft_id", aircraftId)
        .order("date", { ascending: false });

      // 2. Carregar rateios de despesas
      const { data: rateioData } = await supabase
        .from("rateio_despesas")
        .select("*")
        .eq("client_id", clientId)
        .eq("aeronave_id", aircraftId)
        .order("criado_em", { ascending: false });

      // 3. Carregar recibos diretamente
      const { data: receiptsData } = await supabase
        .from("receipts")
        .select("*")
        .eq("client_id", clientId)
        .eq("receipt_type", "reembolso")
        .order("issue_date", { ascending: false });

      const mergedRecords: FinancialRecord[] = [];

      // Adicionar conciliações bancárias
      if (bankData) {
        bankData.forEach((record: any) => {
          const isReembolso = record.tipo_documento === 'recibo' ||
            record.description?.includes('REEMBOLSO') ||
            record.description?.includes('RESSARCIMENTO') ||
            record.categorias_movimentacao?.grupo_categoria === 'DESPESAS REEMBOLSÁVEIS';

          mergedRecords.push({
            id: `bank-${record.id}`,
            date: record.date,
            description: record.description,
            amount: Math.abs(record.amount || 0),
            status: record.status,
            type: "bank_reconciliation",
            category: record.categorias_movimentacao?.nome || record.category,
            grupo_categoria: record.categorias_movimentacao?.grupo_categoria,
            percentual: record.percentual ? parseFloat(record.percentual) : undefined,
            boleto_url: record.boleto_url,
            nf_url: record.nf_url,
            payment_term: record.payment_term,
            tem_rateio: record.percentual && parseFloat(record.percentual) < 100,
          });
        });
      }

      // Adicionar rateios de despesas
      if (rateioData) {
        rateioData.forEach((record: any) => {
          mergedRecords.push({
            id: `rateio-${record.id}`,
            date: record.data_pagamento || record.criado_em,
            description: `Rateio de Despesa - ${record.observacoes || "Despesa compartilhada"}`,
            amount: Math.abs(record.valor_rateado || record.valor || 0),
            status: record.status || "pendente",
            type: "rateio_despesas",
            observacoes: record.observacoes,
            percentual: record.percentual,
            aircraft_registration: record.aeronave_registro,
            boleto_url: record.boleto,
            nf_url: record.nota_fiscal,
            tem_rateio: true,
          });
        });
      }

      // Adicionar recibos
      if (receiptsData) {
        receiptsData.forEach((record: any) => {
          // Verificar se já não existe na conciliação
          const jaExiste = mergedRecords.some(r =>
            r.description?.includes(record.receipt_number)
          );

          if (!jaExiste) {
            mergedRecords.push({
              id: `receipt-${record.id}`,
              date: record.issue_date,
              description: `REEMBOLSO - ${record.service_description}`,
              amount: Math.abs(record.amount || 0),
              status: "pendente", // Status padrão para recibos sem conciliação
              type: "receipt",
              category: "RESSARCIMENTOS PAGOS",
              grupo_categoria: "DESPESAS REEMBOLSÁVEIS",
              boleto_url: record.boleto_url,
              nf_url: record.nf_url,
              pdf_url: record.pdf_url,
              payment_term: record.max_payment_date,
              receipt_number: record.receipt_number,
            });
          }
        });
      }

      // Ordenar por data (mais recente primeiro)
      mergedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRecords(mergedRecords);
    } catch (error) {
      console.error("Error loading financial history:", error);
      toast.error("Erro ao carregar histórico financeiro");
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

  const getTypeLabel = (type: string) => {
    if (type === "bank_reconciliation") return "Conciliação Bancária";
    if (type === "rateio_despesas") return "Rateio de Despesas";
    if (type === "receipt") return "Recibo de Reembolso";
    return type;
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

  // Filtrar registros
  const filteredRecords = records.filter(record => {
    if (filter === 'todos') return true;
    if (filter === 'reembolsos') {
      return record.type === 'receipt' ||
        record.type === 'bank_reconciliation' && (
          record.description?.includes('REEMBOLSO') ||
          record.description?.includes('RESSARCIMENTO') ||
          record.grupo_categoria === 'DESPESAS REEMBOLSÁVEIS'
        );
    }
    if (filter === 'rateios') return record.type === 'rateio_despesas';
    if (filter === 'outros') {
      return record.type === 'bank_reconciliation' &&
        !record.description?.includes('REEMBOLSO') &&
        !record.description?.includes('RESSARCIMENTO') &&
        record.grupo_categoria !== 'DESPESAS REEMBOLSÁVEIS';
    }
    return true;
  });

  if (loading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Carregando histórico financeiro...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <DollarSign className="h-5 w-5 text-primary" />
          Histórico Financeiro
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Reembolsos, rateios e movimentações financeiras
        </CardDescription>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            size="sm"
            variant={filter === 'todos' ? 'default' : 'outline'}
            onClick={() => setFilter('todos')}
          >
            Todos ({records.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'reembolsos' ? 'default' : 'outline'}
            onClick={() => setFilter('reembolsos')}
          >
            Reembolsos ({records.filter(r =>
              r.type === 'receipt' ||
              (r.type === 'bank_reconciliation' && (
                r.description?.includes('REEMBOLSO') ||
                r.grupo_categoria === 'DESPESAS REEMBOLSÁVEIS'
              ))
            ).length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'rateios' ? 'default' : 'outline'}
            onClick={() => setFilter('rateios')}
          >
            Rateios ({records.filter(r => r.type === 'rateio_despesas').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'outros' ? 'default' : 'outline'}
            onClick={() => setFilter('outros')}
          >
            Outros
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-8 w-8" />
              <p>Nenhuma movimentação encontrada</p>
            </div>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div
              key={record.id}
              className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
            >
              <div className="space-y-3">
                {/* Cabeçalho */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <p className="font-semibold text-foreground">{record.description}</p>
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                        {getTypeLabel(record.type)}
                      </Badge>
                      {record.receipt_number && (
                        <Badge variant="secondary" className="text-xs">
                          {record.receipt_number}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      📅 {new Date(record.date + 'T12:00:00').toLocaleDateString("pt-BR")}
                    </p>
                    {record.payment_term && (
                      <p className="text-sm text-amber-400 mt-1">
                        ⏰ Prazo: {new Date(record.payment_term + 'T12:00:00').toLocaleDateString("pt-BR")}
                      </p>
                    )}
                    {record.observacoes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        📝 {record.observacoes}
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
                      <div className="flex flex-col gap-0.5">
                        {record.grupo_categoria && (
                          <p className="text-[10px] text-purple-400 font-bold uppercase">
                            {record.grupo_categoria}
                          </p>
                        )}
                        <p className="text-sm text-foreground font-medium">
                          {record.category.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                  )}

                  {record.percentual !== undefined && (
                    <div className="bg-background/50 p-3 rounded">
                      <p className="text-xs text-muted-foreground font-semibold mb-1">
                        {record.tem_rateio ? 'RATEIO' : 'PERCENTUAL'}
                      </p>
                      <p className="text-sm text-foreground font-medium flex items-center gap-1">
                        {record.percentual}%
                        {record.tem_rateio && <DollarSign className="h-3 w-3 text-amber-400" />}
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
                            onClick={() => downloadFile(record.pdf_url!, `Recibo-${record.receipt_number || record.id}.pdf`)}
                            title="Baixar Recibo"
                          >
                            <FileText className="h-4 w-4 text-cyan-400" />
                          </Button>
                        )}
                        {record.boleto_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => downloadFile(record.boleto_url!, `Boleto-${record.id}.pdf`)}
                            title="Baixar Boleto"
                          >
                            <Receipt className="h-4 w-4 text-blue-400" />
                          </Button>
                        )}
                        {record.nf_url && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => downloadFile(record.nf_url!, `NF-${record.id}.pdf`)}
                            title="Baixar Nota Fiscal"
                          >
                            <Paperclip className="h-4 w-4 text-green-400" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {record.aircraft_registration && (
                    <div className="bg-background/50 p-3 rounded">
                      <p className="text-xs text-muted-foreground font-semibold mb-1">AERONAVE</p>
                      <p className="text-sm text-foreground font-medium">
                        {record.aircraft_registration}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}