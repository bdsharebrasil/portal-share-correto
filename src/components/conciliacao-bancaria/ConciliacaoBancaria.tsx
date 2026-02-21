import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Clock, Send, Users, User, Loader2, ChevronLeft, ChevronRight, Landmark } from "lucide-react";
import { useBankReconciliations } from "@/hooks/useBankReconciliations";
import { format, parseISO } from "date-fns";

export function ConciliacaoBancaria() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: allReconciliations, isLoading } = useBankReconciliations();

  // Filter by month
  const reconciliations = allReconciliations?.filter(rec => {
    const recDate = new Date(rec.date);
    return recDate.getMonth() === currentDate.getMonth() && 
           recDate.getFullYear() === currentDate.getFullYear();
  }) || [];

  const clienteReconciliations = reconciliations.filter(r => r.type === 'cliente');
  const colaboradorReconciliations = reconciliations.filter(r => r.type === 'colaborador');

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = new Date();
  const isCurrentMonth = currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() === today.getMonth();

  const monthYear = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).charAt(0).toUpperCase() +
    currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).slice(1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "conferido":
      case "pago":
        return <Badge className="bg-green-100 text-green-800">Conferido</Badge>;
      case "enviado":
        return <Badge className="bg-blue-100 text-blue-800">Enviado</Badge>;
      case "pendente":
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case "conferido":
      case "pago":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "enviado":
        return <Send className="h-4 w-4 text-blue-600" />;
      case "pendente":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  // Stats for clientes
  const clienteStats = {
    totalConferido: clienteReconciliations
      .filter(r => r.status?.toLowerCase() === 'conferido')
      .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0),
    totalEnviado: clienteReconciliations
      .filter(r => r.status?.toLowerCase() === 'enviado')
      .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0),
    totalPendente: clienteReconciliations
      .filter(r => r.status?.toLowerCase() === 'pendente')
      .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0),
  };

  // Stats for colaboradores
  const colaboradorStats = {
    totalPago: colaboradorReconciliations
      .filter(r => r.status?.toLowerCase() === 'pago' || r.status?.toLowerCase() === 'conferido')
      .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0),
    totalEnviado: colaboradorReconciliations
      .filter(r => r.status?.toLowerCase() === 'enviado')
      .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0),
    totalPendente: colaboradorReconciliations
      .filter(r => r.status?.toLowerCase() === 'pendente')
      .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Conciliação Bancária</h1>
          <p className="text-gray-400 mt-1">Controle de pagamentos e recebimentos</p>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={previousMonth}
          className="border-gray-600"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-40 text-center text-white">
          {monthYear}
          {isCurrentMonth && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-md">Atual</span>}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={nextMonth}
          className="border-gray-600"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="clientes" className="space-y-6">
        <TabsList className="bg-gray-800 border border-gray-700">
          <TabsTrigger value="clientes" className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Users className="w-4 h-4 mr-2" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="colaboradores" className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <User className="w-4 h-4 mr-2" />
            Colaboradores
          </TabsTrigger>
        </TabsList>

        {/* Clientes Tab */}
        <TabsContent value="clientes" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Conferido</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(clienteStats.totalConferido)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/20">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Enviado</p>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(clienteStats.totalEnviado)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/20">
                    <Send className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Pendente</p>
                    <p className="text-2xl font-bold text-yellow-400">{formatCurrency(clienteStats.totalPendente)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-yellow-500/20">
                    <Clock className="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Conciliação com Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Data</TableHead>
                    <TableHead className="text-gray-300">Descrição</TableHead>
                    <TableHead className="text-gray-300">Cliente</TableHead>
                    <TableHead className="text-gray-300">Aeronave</TableHead>
                    <TableHead className="text-gray-300">Categoria</TableHead>
                    <TableHead className="text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clienteReconciliations.map((item) => (
                    <TableRow key={item.id} className="border-gray-700 hover:bg-gray-700/50">
                      <TableCell className="text-gray-300">
                        {format(parseISO(item.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-white font-medium max-w-xs">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className="truncate">{item.description}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">{item.clients?.company_name || '-'}</TableCell>
                      <TableCell>
                        {item.aircraft?.registration ? (
                          <Badge variant="outline" className="border-gray-600">{item.aircraft.registration}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-gray-300">{item.category || '-'}</TableCell>
                      <TableCell className="text-green-400 font-semibold">
                        {formatCurrency(Math.abs(Number(item.amount)))}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                    </TableRow>
                  ))}
                  {clienteReconciliations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                        Nenhuma conciliação de cliente encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colaboradores Tab */}
        <TabsContent value="colaboradores" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Pago</p>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(colaboradorStats.totalPago)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/20">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Enviado</p>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(colaboradorStats.totalEnviado)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/20">
                    <Send className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Total Pendente</p>
                    <p className="text-2xl font-bold text-yellow-400">{formatCurrency(colaboradorStats.totalPendente)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-yellow-500/20">
                    <Clock className="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5" />
                Conciliação com Colaboradores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Data</TableHead>
                    <TableHead className="text-gray-300">Descrição</TableHead>
                    <TableHead className="text-gray-300">Colaborador</TableHead>
                    <TableHead className="text-gray-300">Categoria</TableHead>
                    <TableHead className="text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradorReconciliations.map((item) => (
                    <TableRow key={item.id} className="border-gray-700 hover:bg-gray-700/50">
                      <TableCell className="text-gray-300">
                        {format(parseISO(item.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-white font-medium max-w-xs">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className="truncate">{item.description}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">{item.user_profiles?.full_name || '-'}</TableCell>
                      <TableCell className="text-gray-300">{item.category || '-'}</TableCell>
                      <TableCell className="text-red-400 font-semibold">
                        {formatCurrency(Math.abs(Number(item.amount)))}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                    </TableRow>
                  ))}
                  {colaboradorReconciliations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                        Nenhuma conciliação de colaborador encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
