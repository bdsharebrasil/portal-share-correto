import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, DollarSign, FileText, Loader2 } from "lucide-react";
import { useInadimplencia } from "@/hooks/useContasReceber";
import { format, parseISO, differenceInDays } from "date-fns";

export function Inadimplencia() {
  const { data: inadimplentes, isLoading, error } = useInadimplencia();

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

  const handleExportarPDF = () => {
    console.log("Exportando relatório de inadimplência em PDF");
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
          <h1 className="text-3xl font-bold text-white">Inadimplência</h1>
          <p className="text-gray-400 mt-1">Controle de contas em atraso</p>
        </div>
        <div className="text-center text-red-400 p-8">
          Erro ao carregar dados de inadimplência. Verifique suas permissões.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Inadimplência</h1>
          <p className="text-gray-400 mt-1">Controle de contas em atraso</p>
        </div>
        <Button onClick={handleExportarPDF} className="bg-blue-600 hover:bg-blue-700">
          <FileText className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-300 text-sm font-medium">Total em Atraso</p>
                <p className="text-2xl font-bold text-red-400">
                  R$ {totalInadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-900/20 border-orange-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-300 text-sm font-medium">Atraso {'>'}30 dias</p>
                <p className="text-2xl font-bold text-orange-400">
                  R$ {atraso30Dias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-900/30 border-red-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-300 text-sm font-medium">Atraso {'>'}60 dias</p>
                <p className="text-2xl font-bold text-red-400">
                  R$ {atraso60Dias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-900/20 border-yellow-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-300 text-sm font-medium">Total Clientes</p>
                <p className="text-2xl font-bold text-yellow-400">{inadimplentes?.length || 0}</p>
              </div>
              <DollarSign className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Contas Vencidas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Cliente</TableHead>
                <TableHead className="text-gray-300">Vencimento</TableHead>
                <TableHead className="text-gray-300">Dias de Atraso</TableHead>
                <TableHead className="text-gray-300">Valor</TableHead>
                <TableHead className="text-gray-300">Descrição</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inadimplentes?.map((item) => {
                const diasAtraso = calcularDiasAtraso(item.data_vencimento);
                return (
                  <TableRow key={item.id} className="border-gray-700">
                    <TableCell className="text-white font-medium">{item.cliente_nome}</TableCell>
                    <TableCell className="text-gray-300">
                      {format(parseISO(item.data_vencimento), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-red-400 font-semibold">{diasAtraso} dias</TableCell>
                    <TableCell className="text-red-400 font-semibold">
                      R$ {Number(item.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-gray-300">{item.descricao || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(diasAtraso)}>
                        {getBadgeText(diasAtraso)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-blue-400 hover:text-blue-300"
                          onClick={() => handleNotificar(item.cliente_nome)}
                        >
                          <Bell className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-green-400 hover:text-green-300"
                          onClick={() => handleDarBaixa(item.id, item.cliente_nome)}
                        >
                          <DollarSign className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!inadimplentes || inadimplentes.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    Nenhuma conta em atraso encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
