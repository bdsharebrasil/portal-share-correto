import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useBankReconciliations } from "@/hooks/useBankReconciliations";
import { useContasReceber } from "@/hooks/useContasReceber";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useInadimplencia } from "@/hooks/useContasReceber";
import { format, parseISO, isBefore } from "date-fns";

const monthData = [
  { month: "Jan", receitas: 12000, despesas: 8000 },
  { month: "Fev", receitas: 15000, despesas: 9000 },
  { month: "Mar", receitas: 18000, despesas: 10000 },
  { month: "Abr", receitas: 22000, despesas: 11000 },
  { month: "Mai", receitas: 25000, despesas: 12000 },
  { month: "Jun", receitas: 28000, despesas: 13000 },
];

const categoryData = [
  { name: "Despesas Fixas", value: 35, color: "#ef4444" },
  { name: "Folha Pagamento", value: 40, color: "#f97316" },
  { name: "Operacional", value: 15, color: "#eab308" },
  { name: "Outros", value: 10, color: "#6366f1" },
];

export default function DashboardGestor() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: allReconciliations, isLoading: loadingReconciliations } = useBankReconciliations();
  const { data: contasReceber, isLoading: loadingReceitas } = useContasReceber();
  const { data: contasPagar, isLoading: loadingDespesas } = useContasPagar();
  const { data: inadimplentes, isLoading: loadingInadimplencia } = useInadimplencia();

  const isLoading = loadingReconciliations || loadingReceitas || loadingDespesas || loadingInadimplencia;

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthYear = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Calcular totais de receitas
  const totalReceitas =
    contasReceber?.reduce((acc, conta) => {
      if (conta.status !== "Recebido") {
        return acc + Number(conta.valor);
      }
      return acc;
    }, 0) || 0;

  // Calcular totais de despesas
  const totalDespesas =
    contasPagar?.reduce((acc, conta) => {
      if (conta.status !== "Pago") {
        return acc + Number(conta.valor);
      }
      return acc;
    }, 0) || 0;

  // Contas vencidas
  const contasVencidas =
    contasPagar?.filter((conta) => {
      const vencimento = parseISO(conta.data_vencimento);
      return isBefore(vencimento, new Date()) && conta.status !== "Pago";
    }).length || 0;

  // Recebimentos vencidos
  const recebimentosVencidos =
    contasReceber?.filter((conta) => {
      const vencimento = parseISO(conta.data_vencimento);
      return isBefore(vencimento, new Date()) && conta.status !== "Recebido";
    }).length || 0;

  // Stats de conciliação
  const reconciliations = allReconciliations?.filter((rec) => {
    const recDate = new Date(rec.date);
    return recDate.getMonth() === currentDate.getMonth() && recDate.getFullYear() === currentDate.getFullYear();
  }) || [];

  const totalConferido = reconciliations
    .filter((r) => r.status?.toLowerCase() === "conferido")
    .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0) || 0;

  const totalPendente = reconciliations
    .filter((r) => r.status?.toLowerCase() === "pendente")
    .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0) || 0;

  // Inadimplência
  const totalInadimplencia = inadimplentes?.reduce((acc, item) => acc + Number(item.valor), 0) || 0;

  const saldoGeral = totalReceitas - totalDespesas;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">Dashboard do Gestor</h1>
          <p className="text-gray-400 mt-1">Visão consolidada das operações financeiras</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Download className="w-4 h-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={previousMonth} className="border-gray-600">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold min-w-40 text-center text-white capitalize">{monthYear}</h2>
        <Button variant="outline" size="sm" onClick={nextMonth} className="border-gray-600">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Receitas */}
        <Card className="bg-gradient-to-br from-green-900/40 to-green-900/20 border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-300 text-sm font-medium">Receitas a Receber</p>
                <p className="text-2xl font-bold text-green-400 mt-2">{formatCurrency(totalReceitas)}</p>
                <p className="text-xs text-green-300 mt-1">{contasReceber?.length || 0} contas</p>
              </div>
              <div className="p-3 rounded-xl bg-green-500/20">
                <TrendingUp className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card className="bg-gradient-to-br from-red-900/40 to-red-900/20 border-red-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-300 text-sm font-medium">Despesas a Pagar</p>
                <p className="text-2xl font-bold text-red-400 mt-2">{formatCurrency(totalDespesas)}</p>
                <p className="text-xs text-red-300 mt-1">{contasVencidas} vencidas</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/20">
                <TrendingDown className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo */}
        <Card className={`bg-gradient-to-br ${saldoGeral >= 0 ? "from-blue-900/40 to-blue-900/20 border-blue-800" : "from-orange-900/40 to-orange-900/20 border-orange-800"}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${saldoGeral >= 0 ? "text-blue-300" : "text-orange-300"}`}>Saldo Geral</p>
                <p className={`text-2xl font-bold mt-2 ${saldoGeral >= 0 ? "text-blue-400" : "text-orange-400"}`}>{formatCurrency(saldoGeral)}</p>
              </div>
              <div className={`p-3 rounded-xl ${saldoGeral >= 0 ? "bg-blue-500/20" : "bg-orange-500/20"}`}>
                <DollarSign className={`w-6 h-6 ${saldoGeral >= 0 ? "text-blue-400" : "text-orange-400"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conciliação */}
        <Card className="bg-gradient-to-br from-cyan-900/40 to-cyan-900/20 border-cyan-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-300 text-sm font-medium">Conferido</p>
                <p className="text-2xl font-bold text-cyan-400 mt-2">{formatCurrency(totalConferido)}</p>
                <p className="text-xs text-cyan-300 mt-1">{totalPendente > 0 ? `${formatCurrency(totalPendente)} pendente` : "Tudo conferido"}</p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/20">
                <CheckCircle className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inadimplência */}
        <Card className="bg-gradient-to-br from-orange-900/40 to-orange-900/20 border-orange-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-300 text-sm font-medium">Inadimplência</p>
                <p className="text-2xl font-bold text-orange-400 mt-2">{formatCurrency(totalInadimplencia)}</p>
                <p className="text-xs text-orange-300 mt-1">{inadimplentes?.length || 0} clientes</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-500/20">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-gray-800 border border-gray-700">
          <TabsTrigger value="overview" className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="receitas" className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Receitas
          </TabsTrigger>
          <TabsTrigger value="despesas" className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Despesas
          </TabsTrigger>
          <TabsTrigger value="inadimplencia" className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Inadimplência
          </TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Receitas vs Despesas */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Receitas vs Despesas (últimos 6 meses)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="month" stroke="#999" />
                    <YAxis stroke="#999" />
                    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #444" }} />
                    <Legend />
                    <Bar dataKey="receitas" fill="#10b981" name="Receitas" />
                    <Bar dataKey="despesas" fill="#ef4444" name="Despesas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribuição de Despesas */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Distribuição de Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tendência de Saldo */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Tendência de Saldo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="month" stroke="#999" />
                  <YAxis stroke="#999" />
                  <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #444" }} />
                  <Line
                    type="monotone"
                    dataKey={(data) => data.receitas - data.despesas}
                    stroke="#06b6d4"
                    name="Saldo"
                    dot={{ fill: "#06b6d4" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receitas */}
        <TabsContent value="receitas" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Contas a Receber Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Cliente</TableHead>
                    <TableHead className="text-gray-300">Vencimento</TableHead>
                    <TableHead className="text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasReceber
                    ?.filter((conta) => conta.status !== "Recebido")
                    .slice(0, 10)
                    .map((conta) => {
                      const isOverdue = isBefore(parseISO(conta.data_vencimento), new Date());
                      return (
                        <TableRow key={conta.id} className="border-gray-700">
                          <TableCell className="text-white font-medium">{conta.cliente_nome}</TableCell>
                          <TableCell className="text-gray-300">
                            {format(parseISO(conta.data_vencimento), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-green-400 font-semibold">
                            {formatCurrency(Number(conta.valor))}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isOverdue ? "destructive" : "secondary"}>
                              {isOverdue ? "Vencida" : "Pendente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Despesas */}
        <TabsContent value="despesas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-red-900/20 border-red-800">
              <CardContent className="p-6">
                <p className="text-red-300 text-sm font-medium">Total a Pagar</p>
                <p className="text-2xl font-bold text-red-400 mt-2">{formatCurrency(totalDespesas)}</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-900/20 border-orange-800">
              <CardContent className="p-6">
                <p className="text-orange-300 text-sm font-medium">Contas Vencidas</p>
                <p className="text-2xl font-bold text-orange-400 mt-2">{contasVencidas}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-900/20 border-blue-800">
              <CardContent className="p-6">
                <p className="text-blue-300 text-sm font-medium">Contas Pendentes</p>
                <p className="text-2xl font-bold text-blue-400 mt-2">{contasPagar?.filter((c) => c.status !== "Pago").length || 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Contas a Pagar Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Fornecedor</TableHead>
                    <TableHead className="text-gray-300">Vencimento</TableHead>
                    <TableHead className="text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasPagar
                    ?.filter((conta) => conta.status !== "Pago")
                    .slice(0, 10)
                    .map((conta) => {
                      const isOverdue = isBefore(parseISO(conta.data_vencimento), new Date());
                      return (
                        <TableRow key={conta.id} className="border-gray-700">
                          <TableCell className="text-white font-medium">{conta.fornecedor_nome}</TableCell>
                          <TableCell className="text-gray-300">
                            {format(parseISO(conta.data_vencimento), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-red-400 font-semibold">{formatCurrency(Number(conta.valor))}</TableCell>
                          <TableCell>
                            <Badge variant={isOverdue ? "destructive" : "secondary"}>
                              {isOverdue ? "Vencida" : "Pendente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inadimplência */}
        <TabsContent value="inadimplencia" className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                Clientes Inadimplentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead className="text-gray-300">Cliente</TableHead>
                    <TableHead className="text-gray-300">Vencimento</TableHead>
                    <TableHead className="text-gray-300">Dias Atraso</TableHead>
                    <TableHead className="text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inadimplentes
                    ?.slice(0, 10)
                    .map((item) => {
                      const diasAtraso = Math.floor(
                        (new Date().getTime() - new Date(item.data_vencimento).getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return (
                        <TableRow key={item.id} className="border-gray-700">
                          <TableCell className="text-white font-medium">{item.cliente_nome}</TableCell>
                          <TableCell className="text-gray-300">
                            {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-red-400 font-semibold">{diasAtraso} dias</TableCell>
                          <TableCell className="text-red-400 font-semibold">{formatCurrency(Number(item.valor))}</TableCell>
                          <TableCell>
                            <Badge
                              variant={diasAtraso > 60 ? "destructive" : diasAtraso > 30 ? "secondary" : "default"}
                            >
                              {diasAtraso > 60 ? "Crítico" : diasAtraso > 30 ? "Alerta" : "Recente"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
