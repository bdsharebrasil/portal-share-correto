import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReceitas: 0,
    totalDespesas: 0,
    contasVencidas: 0,
    recebimentosVencidos: 0,
    totalConferido: 0,
    totalPendente: 0,
    totalInadimplencia: 0,
    contasReceber: [],
    contasPagar: [],
    inadimplentes: [],
  });

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthYear = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);

      try {
        // Buscar contas a receber
        const { data: contasReceber } = await supabase
          .from("contas_receber")
          .select("*")
          .eq("user_id", user.id);

        // Buscar contas a pagar
        const { data: contasPagar } = await supabase
          .from("contas_pagar")
          .select("*")
          .eq("user_id", user.id);

        // Buscar reconciliações bancárias
        const { data: reconciliations } = await supabase.from("bank_reconciliations").select("*").eq("user_id", user.id);

        // Calcular totais
        let totalReceitas = 0;
        let totalDespesas = 0;
        let contasVencidas = 0;
        let recebimentosVencidos = 0;
        let totalConferido = 0;
        let totalPendente = 0;

        if (contasReceber) {
          totalReceitas = contasReceber
            .filter((c) => c.status !== "recebido")
            .reduce((acc, c) => acc + Number(c.valor), 0);

          recebimentosVencidos = contasReceber.filter((c) => {
            const vencimento = new Date(c.data_vencimento);
            return vencimento < new Date() && c.status !== "recebido";
          }).length;
        }

        if (contasPagar) {
          totalDespesas = contasPagar
            .filter((c) => c.status !== "pago")
            .reduce((acc, c) => acc + Number(c.valor), 0);

          contasVencidas = contasPagar.filter((c) => {
            const vencimento = new Date(c.data_vencimento);
            return vencimento < new Date() && c.status !== "pago";
          }).length;
        }

        if (reconciliations) {
          const reconciliationsMonth = reconciliations.filter((r) => {
            const recDate = new Date(r.date);
            return (
              recDate.getMonth() === currentDate.getMonth() &&
              recDate.getFullYear() === currentDate.getFullYear()
            );
          });

          totalConferido = reconciliationsMonth
            .filter((r) => r.status?.toLowerCase() === "conferido")
            .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);

          totalPendente = reconciliationsMonth
            .filter((r) => r.status?.toLowerCase() === "pendente")
            .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);
        }

        setStats({
          totalReceitas,
          totalDespesas,
          contasVencidas,
          recebimentosVencidos,
          totalConferido,
          totalPendente,
          totalInadimplencia: 0,
          contasReceber: contasReceber || [],
          contasPagar: contasPagar || [],
          inadimplentes: [],
        });
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, currentDate]);

  const saldoGeral = stats.totalReceitas - stats.totalDespesas;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
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
                  <p className="text-2xl font-bold text-green-400 mt-2">{formatCurrency(stats.totalReceitas)}</p>
                  <p className="text-xs text-green-300 mt-1">{stats.contasReceber.length} contas</p>
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
                  <p className="text-2xl font-bold text-red-400 mt-2">{formatCurrency(stats.totalDespesas)}</p>
                  <p className="text-xs text-red-300 mt-1">{stats.contasVencidas} vencidas</p>
                </div>
                <div className="p-3 rounded-xl bg-red-500/20">
                  <TrendingDown className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saldo */}
          <Card
            className={`bg-gradient-to-br ${
              saldoGeral >= 0 ? "from-blue-900/40 to-blue-900/20 border-blue-800" : "from-orange-900/40 to-orange-900/20 border-orange-800"
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${saldoGeral >= 0 ? "text-blue-300" : "text-orange-300"}`}>
                    Saldo Geral
                  </p>
                  <p className={`text-2xl font-bold mt-2 ${saldoGeral >= 0 ? "text-blue-400" : "text-orange-400"}`}>
                    {formatCurrency(saldoGeral)}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-xl ${saldoGeral >= 0 ? "bg-blue-500/20" : "bg-orange-500/20"}`}
                >
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
                  <p className="text-2xl font-bold text-cyan-400 mt-2">{formatCurrency(stats.totalConferido)}</p>
                  <p className="text-xs text-cyan-300 mt-1">
                    {stats.totalPendente > 0
                      ? `${formatCurrency(stats.totalPendente)} pendente`
                      : "Tudo conferido"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/20">
                  <CheckCircle className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contas Vencidas */}
          <Card className="bg-gradient-to-br from-orange-900/40 to-orange-900/20 border-orange-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-300 text-sm font-medium">Contas Vencidas</p>
                  <p className="text-2xl font-bold text-orange-400 mt-2">{stats.contasVencidas + stats.recebimentosVencidos}</p>
                  <p className="text-xs text-orange-300 mt-1">Atenção necessária</p>
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
            <TabsTrigger
              value="overview"
              className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="receitas"
              className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Receitas
            </TabsTrigger>
            <TabsTrigger
              value="despesas"
              className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Despesas
            </TabsTrigger>
            <TabsTrigger
              value="alertas"
              className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Alertas
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
                    {stats.contasReceber
                      .filter((conta) => conta.status !== "recebido")
                      .slice(0, 10)
                      .map((conta) => {
                        const isOverdue = new Date(conta.data_vencimento) < new Date();
                        return (
                          <TableRow key={conta.id} className="border-gray-700">
                            <TableCell className="text-white font-medium">{conta.cliente_nome}</TableCell>
                            <TableCell className="text-gray-300">
                              {new Date(conta.data_vencimento).toLocaleDateString("pt-BR")}
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
                    {stats.contasReceber.filter((c) => c.status !== "recebido").length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                          Nenhuma conta a receber
                        </TableCell>
                      </TableRow>
                    )}
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
                  <p className="text-2xl font-bold text-red-400 mt-2">{formatCurrency(stats.totalDespesas)}</p>
                </CardContent>
              </Card>
              <Card className="bg-orange-900/20 border-orange-800">
                <CardContent className="p-6">
                  <p className="text-orange-300 text-sm font-medium">Contas Vencidas</p>
                  <p className="text-2xl font-bold text-orange-400 mt-2">{stats.contasVencidas}</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-900/20 border-blue-800">
                <CardContent className="p-6">
                  <p className="text-blue-300 text-sm font-medium">Contas Pendentes</p>
                  <p className="text-2xl font-bold text-blue-400 mt-2">
                    {stats.contasPagar.filter((c) => c.status !== "pago").length}
                  </p>
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
                    {stats.contasPagar
                      .filter((conta) => conta.status !== "pago")
                      .slice(0, 10)
                      .map((conta) => {
                        const isOverdue = new Date(conta.data_vencimento) < new Date();
                        return (
                          <TableRow key={conta.id} className="border-gray-700">
                            <TableCell className="text-white font-medium">{conta.fornecedor_nome}</TableCell>
                            <TableCell className="text-gray-300">
                              {new Date(conta.data_vencimento).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-red-400 font-semibold">
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
                    {stats.contasPagar.filter((c) => c.status !== "pago").length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                          Nenhuma conta a pagar
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alertas */}
          <TabsContent value="alertas" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Alertas de Receitas */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    Recebimentos Vencidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-yellow-400">{stats.recebimentosVencidos}</p>
                  <p className="text-sm text-gray-400 mt-2">Contas que venceram e não foram recebidas</p>
                </CardContent>
              </Card>

              {/* Alertas de Despesas */}
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    Pagamentos Vencidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-400">{stats.contasVencidas}</p>
                  <p className="text-sm text-gray-400 mt-2">Contas que venceram e não foram pagas</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
