import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, AlertCircle, CheckCircle, Clock, Plus, Send } from "lucide-react";

export default function Cobranca() {
  const cobrancas = [
    {
      id: 1,
      cliente: "Empresa ABC Ltda",
      valor: 2500.00,
      vencimento: "15/02/2024",
      status: "Pendente",
      servico: "Fretamento Executivo",
    },
    {
      id: 2,
      cliente: "Indústria XYZ S.A.",
      valor: 4200.00,
      vencimento: "10/02/2024",
      status: "Vencida",
      servico: "Transporte de Cargas",
    },
    {
      id: 3,
      cliente: "Comercial 123",
      valor: 1800.00,
      vencimento: "20/02/2024",
      status: "Paga",
      servico: "Voo Turístico",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Paga":
        return <Badge className="bg-green-100 text-green-800">Paga</Badge>;
      case "Pendente":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case "Vencida":
        return <Badge className="bg-red-100 text-red-800">Vencida</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Paga":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "Pendente":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "Vencida":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cobrança</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie e acompanhe as cobranças dos seus clientes
            </p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Cobrança
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total a Receber</p>
                  <p className="text-2xl font-bold text-primary">R$ 15.8K</p>
                </div>
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">R$ 6.7K</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vencidas</p>
                  <p className="text-2xl font-bold text-red-600">R$ 4.2K</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pagas</p>
                  <p className="text-2xl font-bold text-green-600">R$ 12.3K</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Cobranças Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.map((cobranca) => (
                  <TableRow key={cobranca.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(cobranca.status)}
                        {cobranca.cliente}
                      </div>
                    </TableCell>
                    <TableCell>{cobranca.servico}</TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(cobranca.valor)}
                    </TableCell>
                    <TableCell>{cobranca.vencimento}</TableCell>
                    <TableCell>{getStatusBadge(cobranca.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Ver Detalhes
                        </Button>
                        {cobranca.status !== "Paga" && (
                          <Button variant="default" size="sm">
                            <Send className="h-3 w-3 mr-1" />
                            Enviar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}