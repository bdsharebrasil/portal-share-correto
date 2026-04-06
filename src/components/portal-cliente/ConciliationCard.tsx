import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Receipt, Download, Paperclip, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BankReconciliation {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  category: string | null;
  client_id: string | null;
  aeronave_id: string | null;
  prazo_pagamento: string | null;
  boleto_url?: string;
  nf_url?: string;
  pdf_url?: string;
  type: string;
  percentual?: string;
  tipo_documento?: string;
  reference_type?: string;
  reference_id?: string;
  categorias_movimentacao?: {
    id: string;
    nome: string;
    grupo_categoria: string | null;
    cor?: string;
    icone?: string;
  } | null;
}

interface ConciliationCardProps {
  reconciliations: BankReconciliation[];
  loading?: boolean;
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

const getStatusColor = (status: string) => {
  const s = status?.toLowerCase() || "";
  if (s === "pago" || s === "recebido" || s === "conferido") {
    return "bg-green-500/20 text-green-300 border border-green-500/20";
  }
  if (s === "enviado") {
    return "bg-blue-500/20 text-blue-300 border border-blue-500/20";
  }
  if (s === "atrasado") {
    return "bg-red-500/20 text-red-300 border border-red-500/20";
  }
  return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/20";
};

const getStatusLabel = (status: string) => {
  const s = status?.toLowerCase() || "";
  if (s === "pago" || s === "recebido" || s === "conferido") return "✓ Pago";
  if (s === "enviado") return "↗️ Enviado";
  if (s === "atrasado") return "⚠️ Atrasado";
  return "⏳ Pendente";
};

const downloadFile = async (url: string, fileName: string) => {
  try {
    if (!url) {
      toast.error("Arquivo não disponível");
      return;
    }

    // Se for uma URL pública do Supabase Storage
    if (url.includes("supabase") || url.startsWith("http")) {
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
    } else {
      // Se for um path do storage
      const { data, error } = await supabase.storage
        .from("n.f-boletos-clients")
        .download(url);

      if (error) throw error;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(data);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }

    toast.success("Arquivo baixado com sucesso");
  } catch (error) {
    console.error("Error downloading file:", error);
    toast.error("Erro ao baixar arquivo");
  }
};

export function ConciliationCard({ reconciliations, loading }: ConciliationCardProps) {
  if (loading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Carregando conciliações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="h-5 w-5 text-primary" />
          Conciliação Financeira
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Visualize boletos, notas fiscais e histórico de pagamentos
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {reconciliations.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            Nenhuma conciliação registrada
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="p-3 text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-lg mx-6 mt-4 mb-2">
              ℹ️ Os status são atualizados automaticamente. Clique nos ícones para visualizar documentos anexados.
            </div>
            <table className="w-full mt-4">
              <thead>
                <tr className="border-t border-b border-border bg-muted/30">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Rateio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Vencimento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                    Anexos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reconciliations.map((item) => {
                  const isReembolso = item.tipo_documento === 'recibo' ||
                    item.descricao?.includes('REEMBOLSO') ||
                    item.descricao?.includes('RESSARCIMENTO') ||
                    item.categorias_movimentacao?.grupo_categoria === 'DESPESAS REEMBOLSÁVEIS';

                  const temRateio = item.percentual && parseFloat(item.percentual) < 100;

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-muted/30 transition-colors ${isReembolso ? 'bg-purple-500/5' : ''}`}
                    >
                      <td className="px-6 py-4 text-sm text-foreground font-medium whitespace-nowrap">
                        {formatDateCorrectly(item.data)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium text-foreground">
                            {item.descricao}
                          </p>
                          {isReembolso && (
                            <Badge variant="outline" className="text-[10px] w-fit bg-purple-500/10 text-purple-400 border-purple-500/30">
                              REEMBOLSO
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {item.categorias_movimentacao ? (
                          <div className="flex flex-col gap-0.5">
                            {item.categorias_movimentacao.grupo_categoria && (
                              <Badge variant="secondary" className="text-[9px] w-fit bg-purple-500/20 text-purple-300 font-bold uppercase tracking-wide mb-0.5">
                                {item.categorias_movimentacao.grupo_categoria}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs w-fit">
                              {item.categorias_movimentacao.nome}
                            </Badge>
                          </div>
                        ) : item.categoria ? (
                          <Badge variant="secondary" className="text-xs">
                            {item.categoria.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">—</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {temRateio ? (
                          <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 w-fit">
                            <DollarSign className="h-3 w-3" />
                            {item.percentual}%
                          </Badge>
                        ) : item.percentual ? (
                          <span className="text-xs text-muted-foreground">{item.percentual}%</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                        {item.prazo_pagamento
                          ? formatDateCorrectly(item.prazo_pagamento)
                          : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`text-xs font-medium whitespace-nowrap ${getStatusColor(item.situacao)}`}>
                          {getStatusLabel(item.situacao)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                          R$ {Math.abs(Number(item.valor)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1">
                          {item.pdf_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-cyan-500/20"
                              onClick={() =>
                                downloadFile(
                                  item.pdf_url!,
                                  `Recibo-${item.id}.pdf`
                                )
                              }
                              title="Baixar Recibo PDF"
                            >
                              <FileText className="h-4 w-4 text-cyan-400" />
                            </Button>
                          )}
                          {item.nf_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-green-500/20"
                              onClick={() =>
                                downloadFile(
                                  item.nf_url!,
                                  `NF-${item.id}.pdf`
                                )
                              }
                              title="Baixar Nota Fiscal"
                            >
                              <Paperclip className="h-4 w-4 text-green-400" />
                            </Button>
                          )}
                          {item.boleto_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-blue-500/20"
                              onClick={() =>
                                downloadFile(
                                  item.boleto_url!,
                                  `Boleto-${item.id}.pdf`
                                )
                              }
                              title="Baixar Boleto"
                            >
                              <Receipt className="h-4 w-4 text-blue-400" />
                            </Button>
                          )}
                          {!item.pdf_url && !item.nf_url && !item.boleto_url && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
