import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Loader2 } from "lucide-react";
import { useContasReceber } from "@/hooks/useContasReceber";
import { format, parseISO, isBefore } from "date-fns";

export function ContasReceberTab() {
  const { data: contasReceber, isLoading, error } = useContasReceber();

  const totalReceber = contasReceber
    ?.filter(conta => conta.status !== "Recebido")
    .reduce((acc, conta) => acc + Number(conta.valor), 0) || 0;

  const contasPendentes = contasReceber?.filter(conta => conta.status !== "Recebido").length || 0;

  const proximoRecebimento = contasReceber
    ?.filter(conta => conta.status !== "Recebido")
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime())[0];

  const getStatusVariant = (status: string, vencimento: string) => {
    if (status === "Recebido") return "default";
    if (isBefore(parseISO(vencimento), new Date())) return "destructive";
    return "secondary";
  };

  const getStatusText = (status: string, vencimento: string) => {
    if (status === "Recebido") return "Recebido";
    if (isBefore(parseISO(vencimento), new Date())) return "Vencido";
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
        Erro ao carregar contas a receber. Verifique suas permissões.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-green-900/20 border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 text-sm font-medium">Total a Receber</p>
                <p className="text-2xl font-bold text-green-400">
                  R$ {totalReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-900/20 border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm font-medium">Contas Pendentes</p>
                <p className="text-2xl font-bold text-blue-400">{contasPendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-900/20 border-purple-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-300 text-sm font-medium">Próximo Recebimento</p>
                <p className="text-lg font-bold text-purple-400">
                  {proximoRecebimento 
                    ? format(parseISO(proximoRecebimento.data_vencimento), 'dd/MM/yyyy')
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
            <CardTitle className="text-white">Contas a Receber</CardTitle>
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
                <TableHead className="text-gray-300">Cliente</TableHead>
                <TableHead className="text-gray-300">Descrição</TableHead>
                <TableHead className="text-gray-300">Valor</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contasReceber?.map((conta) => (
                <TableRow key={conta.id} className="border-gray-700">
                  <TableCell className="text-gray-300">
                    {format(parseISO(conta.data_vencimento), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-white font-medium">{conta.cliente_nome}</TableCell>
                  <TableCell className="text-gray-300">{conta.descricao || '-'}</TableCell>
                  <TableCell className="text-green-400 font-semibold">
                    R$ {Number(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(conta.status, conta.data_vencimento)}>
                      {getStatusText(conta.status, conta.data_vencimento)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-green-400 hover:text-green-300"
                      disabled={conta.status === "Recebido"}
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Dar Baixa
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!contasReceber || contasReceber.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    Nenhuma conta a receber encontrada
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
