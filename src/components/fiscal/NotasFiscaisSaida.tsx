import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Calendar, Loader2 } from "lucide-react";
import { NovaNotaFiscalDialog } from "./NovaNotaFiscalDialog";
import { useNotasFiscaisSaida } from "@/hooks/useNotasFiscaisSaida";
import { format, parseISO } from "date-fns";

export function NotasFiscais() {
  const { data: notasFiscais, isLoading: loadingNotas } = useNotasFiscaisSaida();

  const mockClientes = [
    { id: 1, nome: "WATT DISTRIBUIDORA", documento: "03.908.643/0001-26" },
    { id: 2, nome: "GA SERVICE", documento: "10.942.203/0001-50" },
    { id: 3, nome: "ENERGISA", documento: "03.467.321/0001-99" },
  ];

  const handleNovaNotaFiscal = () => {
    // Refresh will happen automatically via react-query
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "pago":
      case "recebido":
      case "conferido":
        return "bg-green-100 text-green-800";
      case "pendente":
        return "bg-yellow-100 text-yellow-800";
      case "enviado":
        return "bg-blue-100 text-blue-800";
      case "processando":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const totalFaturado = notasFiscais?.reduce((acc, nf) => acc + Number(nf.valor), 0) || 0;
  const pendentes = notasFiscais?.filter(nf => nf.status?.toLowerCase() === 'pendente').length || 0;
  const thisMonth = notasFiscais?.filter(nf => {
    const date = new Date(nf.data_criacao);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Gestão Fiscal</h1>
          <p className="text-gray-400 mt-1">Notas fiscais</p>
        </div>
      </div>

      <div className="flex justify-end">
        <NovaNotaFiscalDialog onSave={handleNovaNotaFiscal} clientes={mockClientes} />
      </div>

      {/* Invoice Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-4 rounded-xl bg-blue-500">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Este Mês</p>
                <p className="text-3xl font-bold text-white">{thisMonth}</p>
                <p className="text-sm text-gray-500">notas fiscais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-4 rounded-xl bg-green-500">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Faturado</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(totalFaturado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-4 rounded-xl bg-purple-500">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Pendentes</p>
                <p className="text-2xl font-bold text-white">{pendentes}</p>
                <p className="text-sm text-red-400">{pendentes > 0 ? 'Requer atenção' : 'Tudo em dia'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-4 rounded-xl bg-orange-500">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Notas</p>
                <p className="text-2xl font-bold text-white">{notasFiscais?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Notas Fiscais</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingNotas ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Número</TableHead>
                  <TableHead className="text-gray-300">Cliente</TableHead>
                  <TableHead className="text-gray-300">CNPJ</TableHead>
                  <TableHead className="text-gray-300">Valor</TableHead>
                  <TableHead className="text-gray-300">Emissão</TableHead>
                  <TableHead className="text-gray-300">Vencimento</TableHead>
                  <TableHead className="text-gray-300">Categoria</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notasFiscais?.map((nf) => (
                  <TableRow key={nf.id} className="border-gray-700 hover:bg-gray-700/50">
                    <TableCell className="font-medium text-blue-400">{nf.numero}</TableCell>
                    <TableCell className="text-gray-300">{nf.cliente_nome}</TableCell>
                    <TableCell className="text-gray-400 text-xs">{nf.cliente_cnpj}</TableCell>
                    <TableCell className="font-medium text-gray-300">
                      {formatCurrency(Number(nf.valor))}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {format(parseISO(nf.data_criacao), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {format(parseISO(nf.data_vencimento), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                        {nf.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getStatusColor(nf.status)}`}>
                        {nf.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" className="text-xs border-gray-600 text-gray-300 hover:bg-gray-700">
                          Ver
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!notasFiscais || notasFiscais.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                      Nenhuma nota fiscal encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
