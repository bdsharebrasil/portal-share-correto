import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, DollarSign, FileText, Loader2, ArrowLeft, Download } from "lucide-react";
import { useInadimplencia } from "@/hooks/useInadimplencia";
import { format, parseISO, differenceInDays } from "date-fns";
import { createFilenameWithTimestamp, exportElementToPDF } from "@/utils/exportToPDF";
import { toast } from "sonner";
import { useState } from "react";

interface InadimplenciaProps {
  onBack?: () => void;
  isStandalone?: boolean;
}

export function Inadimplencia({ onBack, isStandalone = true }: InadimplenciaProps) {
  const { data: inadimplentes, isLoading, error } = useInadimplencia();
  const [isExporting, setIsExporting] = useState(false);

  const calcularDiasAtraso = (vencimento: string) => {
    return differenceInDays(new Date(), parseISO(vencimento));
  };

  const totalInadimplencia = inadimplentes?.reduce((acc, item) => acc + Number(item.valor), 0) || 0;
  
  const atraso30Dias = inadimplentes
    ?.filter(item => calcularDiasAtraso(item.data_vencimento) > 30)
    .reduce((acc, item) => acc + Number(item.valor), 0) || 0;
  
  const atraso60Dias = inadimplentes
    ?.filter(item => calcularDiasAtraso(item.data_vencimento) > 60)
    .reduce((acc, item) => acc + Number(item.valor), 0) || 0;

  const handleNotificar = (cliente: string) => {
    console.log(`Notificando cliente: ${cliente}`);
  };

  const handleDarBaixa = (id: string, cliente: string) => {
    console.log(`Dando baixa na conta do cliente: ${cliente} (ID: ${id})`);
  };

  const handleExportarPDF = async () => {
    try {
      setIsExporting(true);
      const filename = createFilenameWithTimestamp('relatorio_inadimplencia');
      
      await exportElementToPDF('relatorio-inadimplencia-content', {
        filename,
        title: 'Relatório de Inadimplência',
        includeTimestamp: true,
        orientation: 'landscape'
      });

      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar relatório para PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const getBadgeVariant = (diasAtraso: number) => {
    if (diasAtraso > 60) return "destructive";
    if (diasAtraso > 30) return "secondary";
    return "default";
  };

  const getBadgeText = (diasAtraso: number) => {
    if (diasAtraso > 60) return "Crítico";
    if (diasAtraso > 30) return "Alerta";
    return "Recente";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Inadimplência</h1>
          <p className="text-muted-foreground mt-1">Controle de contas em atraso</p>
        </div>
        <div className="text-center text-destructive p-8">
          Erro ao carregar dados de inadimplência. Verifique suas permissões.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {isStandalone && onBack && (
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
          {isStandalone && (
            <div>
              <h1 className="text-3xl font-bold">Inadimplência</h1>
              <p className="text-muted-foreground mt-1">Controle de contas em atraso</p>
            </div>
          )}
        </div>
        <Button 
          onClick={handleExportarPDF} 
          disabled={isExporting}
          className="gap-2"
          variant="outline"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Exportar PDF
            </>
          )}
        </Button>
      </div>

      <div id="relatorio-inadimplencia-content" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-destructive text-sm font-medium">Total em Atraso</p>
                  <p className="text-2xl font-bold text-destructive mt-2">
                    R$ {totalInadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-warning/10 border-warning/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-warning text-sm font-medium">Atraso {'>'}30 dias</p>
                  <p className="text-2xl font-bold text-warning mt-2">
                    R$ {atraso30Dias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-destructive/20 border-destructive/40">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-destructive text-sm font-medium">Atraso {'>'}60 dias</p>
                  <p className="text-2xl font-bold text-destructive mt-2">
                    R$ {atraso60Dias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary text-sm font-medium">Total Clientes</p>
                  <p className="text-2xl font-bold text-primary mt-2">{inadimplentes?.length || 0}</p>
                </div>
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Contas Vencidas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Dias de Atraso</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  {isStandalone && <TableHead>Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {inadimplentes?.map((item) => {
                  const diasAtraso = calcularDiasAtraso(item.data_vencimento);
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{item.cliente_nome}</TableCell>
                      <TableCell>
                        {format(parseISO(item.data_vencimento), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-destructive font-semibold">{diasAtraso} dias</TableCell>
                      <TableCell className="text-destructive font-semibold">
                        R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{item.descricao || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(diasAtraso)}>
                          {getBadgeText(diasAtraso)}
                        </Badge>
                      </TableCell>
                      {isStandalone && (
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0"
                              onClick={() => handleNotificar(item.cliente_nome)}
                              title="Notificar cliente"
                            >
                              <Bell className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0"
                              onClick={() => handleDarBaixa(item.id, item.cliente_nome)}
                              title="Dar baixa"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {(!inadimplentes || inadimplentes.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={isStandalone ? 7 : 6} className="text-center text-muted-foreground py-8">
                      Nenhuma conta em atraso encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
