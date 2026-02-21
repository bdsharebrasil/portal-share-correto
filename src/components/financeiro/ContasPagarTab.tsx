import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Bell, Loader2 } from "lucide-react";
import { useContasPagar } from "@/hooks/useContasPagar";
import { format, parseISO, isBefore } from "date-fns";

export function ContasPagarTab() {
  const { data: contasPagar, isLoading, error } = useContasPagar();

  const totalPendente = contasPagar
    ?.filter(conta => conta.status !== "Pago")
    .reduce((acc, conta) => acc + Number(conta.valor), 0) || 0;

  const contasVencidas = contasPagar?.filter(conta => {
    const vencimento = parseISO(conta.data_vencimento);
    return isBefore(vencimento, new Date()) && conta.status !== "Pago";
  }).length || 0;

  const proximoVencimento = contasPagar
    ?.filter(conta => conta.status !== "Pago")
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())[0];

  const getStatusVariant = (status: string, vencimento: string) => {
    if (status === "Pago") return "default";
    if (isBefore(parseISO(vencimento), new Date())) return "destructive";
    return "secondary";
  };

  const getStatusText = (status: string, vencimento: string) => {
    if (status === "Pago") return "Pago";
    if (isBefore(parseISO(vencimento), new Date())) return "Vencida";
    return "Pendente";
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
      <div className="text-center text-red-400 p-8">
        Erro ao carregar contas a pagar. Verifique suas permissões.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-300 text-sm font-medium">Total a Pagar</p>
                <p className="text-2xl font-bold text-red-400">
                  R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-900/20 border-orange-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-300 text-sm font-medium">Contas Vencidas</p>
                <p className="text-2xl font-bold text-orange-400">{contasVencidas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-900/20 border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm font-medium">Próximo Vencimento</p>
                <p className="text-lg font-bold text-blue-400">
                  {proximoVencimento 
                    ? format(parseISO(proximoVencimento.data_vencimento), 'dd/MM/yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white">Contas a Pagar</CardTitle>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-300">Vencimento</TableHead>
                <TableHead className="text-gray-300">Fornecedor</TableHead>
                <TableHead className="text-gray-300">Descrição</TableHead>
                <TableHead className="text-gray-300">Valor</TableHead>
                <TableHead className="text-gray-300">Categoria</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contasPagar?.map((conta) => (
                <TableRow key={conta.id} className="border-gray-700">
                  <TableCell className="text-gray-300">
                    {format(parseISO(conta.data_vencimento), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-white font-medium">{conta.fornecedor_nome}</TableCell>
                  <TableCell className="text-gray-300">{conta.descricao || '-'}</TableCell>
                  <TableCell className="text-red-400 font-semibold">
                    R$ {Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-gray-300">{conta.categoria}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(conta.status, conta.data_vencimento)}>
                      {getStatusText(conta.status, conta.data_vencimento)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" className="text-green-400 hover:text-green-300">
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300">
                        <Bell className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!contasPagar || contasPagar.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    Nenhuma conta a pagar encontrada
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
