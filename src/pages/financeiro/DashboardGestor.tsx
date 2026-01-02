import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  Area,
  AreaChart,
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
  Wallet,
  Calendar,
} from "lucide-react";
import { useDashboardGestorData } from "@/hooks/useDashboardGestorData";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Função para mapear status e cores
const getStatusBadgeConfig = (status: string) => {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'confirmado': { label: '✓ Confirmado', variant: 'secondary' },
    'recebido': { label: '✓ Recebido', variant: 'secondary' },
    'pago': { label: '✓ Pago', variant: 'secondary' },
    'reembolsado': { label: '✓ Reembolsado', variant: 'secondary' },
    'pendente': { label: '⏳ Pendente', variant: 'outline' },
    'aguardando_reembolso': { label: '⏳ Aguardando Reembolso', variant: 'outline' },
    'cancelado': { label: '✗ Cancelado', variant: 'destructive' },
  };
  return statusMap[status?.toLowerCase()] || { label: status || 'N/A', variant: 'outline' };
};

export default function DashboardGestor() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dataInicio, setDataInicio] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("overview");

  const {
    transacoes,
    monthlyData,
    categoryData,
    stats,
    contasReceber,
    contasPagar,
    isLoading,
  } = useDashboardGestorData(currentDate);

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthYear = format(currentDate, "MMMM yyyy", { locale: ptBR });

  // Get unique categories from transacoes
  const categoriasUnicas = Array.from(new Set(transacoes
    .map((t: any) => t.categorias_movimentacao?.nome || t.grupo_categoria)
    .filter(Boolean)
  )) as string[];

  const handleCategoriaChange = (categoria: string, checked: boolean) => {
    const novasCategorias = new Set(categoriasPermitidas);
    if (checked) {
      novasCategorias.add(categoria);
    } else {
      novasCategorias.delete(categoria);
    }
    setCategoriasPermitidas(novasCategorias);
  };

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

  // Verificar se há dados
  const hasData = transacoes.length > 0;
  const hasMonthlyData = monthlyData.some(m => m.receitas > 0 || m.despesas > 0);

  return (
    <Layout>
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard do Gestor</h1>
            <p className="text-muted-foreground mt-1 text-sm">Visão consolidada das operações financeiras</p>
          </div>
          <Button variant="outline" className="border-border w-full sm:w-auto" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* Month Selector */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <Button variant="outline" size="sm" onClick={previousMonth} className="border-border">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base sm:text-lg font-semibold text-center text-foreground capitalize min-w-32 sm:min-w-48">{monthYear}</h2>
          <Button variant="outline" size="sm" onClick={nextMonth} className="border-border">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Total Receitas */}
          <Card className="bg-card/80 border-success/30 overflow-hidden">
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between gap-3 flex-1">
                <div className="flex-1 min-w-0">
                  <p className="text-success text-xs font-medium uppercase tracking-wide">Receitas</p>
                  <p className="text-lg sm:text-xl font-bold text-success mt-2 truncate">{formatCurrency(stats.totalReceitas)}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {formatCurrency(stats.receitasConferidas)} conf.
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-success/20 flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Despesas */}
          <Card className="bg-card/80 border-destructive/30 overflow-hidden">
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between gap-3 flex-1">
                <div className="flex-1 min-w-0">
                  <p className="text-destructive text-xs font-medium uppercase tracking-wide">Despesas</p>
                  <p className="text-lg sm:text-xl font-bold text-destructive mt-2 truncate">{formatCurrency(stats.totalDespesas)}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {formatCurrency(stats.despesasConferidas)} conf.
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-destructive/20 flex-shrink-0">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saldo */}
          <Card className={`bg-card/80 overflow-hidden ${stats.saldoGeral >= 0 ? "border-primary/30" : "border-warning/30"}`}>
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between gap-3 flex-1">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium uppercase tracking-wide ${stats.saldoGeral >= 0 ? "text-primary" : "text-warning"}`}>
                    Saldo
                  </p>
                  <p className={`text-lg sm:text-xl font-bold mt-2 truncate ${stats.saldoGeral >= 0 ? "text-primary" : "text-warning"}`}>
                    {formatCurrency(stats.saldoGeral)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    Conferido
                  </p>
                </div>
                <div className={`p-2 rounded-lg flex-shrink-0 ${stats.saldoGeral >= 0 ? "bg-primary/20" : "bg-warning/20"}`}>
                  <DollarSign className={`w-5 h-5 ${stats.saldoGeral >= 0 ? "text-primary" : "text-warning"}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pendente */}
          <Card
            className="bg-card/80 border-warning/30 overflow-hidden cursor-pointer hover:border-warning/60 hover:shadow-lg transition-all"
            onClick={() => setActiveTab("alertas")}
          >
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between gap-3 flex-1">
                <div className="flex-1 min-w-0">
                  <p className="text-warning text-xs font-medium uppercase tracking-wide">Pendente</p>
                  <p className="text-lg sm:text-xl font-bold text-warning mt-2 truncate">{formatCurrency(stats.receitasPendentes + stats.despesasPendentes)}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    A conferir
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-warning/20 flex-shrink-0">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contas Vencidas */}
          <Card
            className="bg-card/80 border-warning/30 overflow-hidden cursor-pointer hover:border-warning/60 hover:shadow-lg transition-all"
            onClick={() => setActiveTab("alertas")}
          >
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start justify-between gap-3 flex-1">
                <div className="flex-1 min-w-0">
                  <p className="text-warning text-xs font-medium uppercase tracking-wide">Vencidas</p>
                  <p className="text-lg sm:text-xl font-bold text-warning mt-2">{stats.contasVencidas + stats.recebimentosVencidos}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">Atenção</p>
                </div>
                <div className="p-2 rounded-lg bg-warning/20 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="receitas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Receitas
            </TabsTrigger>
            <TabsTrigger value="despesas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Despesas
            </TabsTrigger>
            <TabsTrigger value="alertas" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Alertas
            </TabsTrigger>
            <TabsTrigger value="relatorio-anual" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Relatório Anual
            </TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Receitas vs Despesas */}
              <Card className="bg-card/80 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    Receitas vs Despesas (últimos 6 meses)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {hasMonthlyData ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="monthLabel" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))"
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend />
                        <Bar dataKey="receitas" fill="hsl(var(--success))" name="Receitas" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="despesas" fill="hsl(var(--destructive))" name="Despesas" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      <div className="text-center">
                        <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhum dado disponível para o período</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Distribuição de Despesas */}
              <Card className="bg-card/80 border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-destructive" />
                    Distribuição de Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${value}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--card))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                          formatter={(value: number) => `${value}%`}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      <div className="text-center">
                        <TrendingDown className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma despesa registrada</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tendência de Saldo */}
            <Card className="bg-card/80 border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Tendência de Saldo Mensal
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasMonthlyData ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthLabel" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))", 
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))"
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Area
                        type="monotone"
                        dataKey="saldo"
                        stroke="hsl(var(--primary))"
                        fill="url(#saldoGradient)"
                        strokeWidth={2}
                        name="Saldo"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    <div className="text-center">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum dado de tendência disponível</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receitas */}
          <TabsContent value="receitas" className="space-y-6">
            <Card className="bg-card/80 border-border overflow-hidden">
              <CardHeader>
                <CardTitle className="text-foreground">Todas as Entradas/Receitas</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-4">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Data</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Descrição</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Categoria</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Valor</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contasReceber.length > 0 ? (
                        contasReceber
                          .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())
                          .slice(0, 50)
                          .map((conta: any) => {
                            const statusConfig = getStatusBadgeConfig(conta.status);
                            return (
                              <TableRow key={conta.id} className="border-border hover:bg-muted/50">
                                <TableCell className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">
                                  {conta.data ? new Date(conta.data).toLocaleDateString("pt-BR") : "-"}
                                </TableCell>
                                <TableCell className="text-foreground font-medium text-xs sm:text-sm px-3 sm:px-4">{conta.descricao || "Sem descrição"}</TableCell>
                                <TableCell className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">{conta.categorias_movimentacao?.nome || conta.grupo_categoria || "-"}</TableCell>
                                <TableCell className="text-success font-semibold text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
                                  {formatCurrency(Math.abs(Number(conta.valor || 0)))}
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm px-3 sm:px-4">
                                  <Badge variant={statusConfig.variant} className="text-xs sm:text-sm">
                                    {statusConfig.label}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhuma receita registrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Despesas */}
          <TabsContent value="despesas" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-destructive/10 border-destructive/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <p className="text-destructive text-xs sm:text-sm font-medium uppercase tracking-wide">Total a Pagar</p>
                  <p className="text-xl sm:text-2xl font-bold text-destructive mt-2 truncate">{formatCurrency(stats.totalDespesas)}</p>
                </CardContent>
              </Card>
              <Card className="bg-warning/10 border-warning/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <p className="text-warning text-xs sm:text-sm font-medium uppercase tracking-wide">Contas Vencidas</p>
                  <p className="text-xl sm:text-2xl font-bold text-warning mt-2">{stats.contasVencidas}</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <p className="text-primary text-xs sm:text-sm font-medium uppercase tracking-wide">Total de Registros</p>
                  <p className="text-xl sm:text-2xl font-bold text-primary mt-2">{contasPagar.length}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card/80 border-border overflow-hidden">
              <CardHeader>
                <CardTitle className="text-foreground">Todas as Saídas/Despesas</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-4">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Data</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Descrição</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Categoria</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Valor</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contasPagar.length > 0 ? (
                        contasPagar
                          .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())
                          .slice(0, 50)
                          .map((conta: any) => {
                            const statusConfig = getStatusBadgeConfig(conta.status);
                            return (
                              <TableRow key={conta.id} className="border-border hover:bg-muted/50">
                                <TableCell className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">
                                  {conta.data ? new Date(conta.data).toLocaleDateString("pt-BR") : "-"}
                                </TableCell>
                                <TableCell className="text-foreground font-medium text-xs sm:text-sm px-3 sm:px-4">{conta.descricao || "Sem descrição"}</TableCell>
                                <TableCell className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">{conta.categorias_movimentacao?.nome || conta.grupo_categoria || "-"}</TableCell>
                                <TableCell className="text-destructive font-semibold text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap">
                                  {formatCurrency(Math.abs(Number(conta.valor || 0)))}
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm px-3 sm:px-4">
                                  <Badge variant={statusConfig.variant} className="text-xs sm:text-sm">
                                    {statusConfig.label}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhuma despesa registrada
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alertas */}
          <TabsContent value="alertas" className="space-y-6">
            {/* Resumo de Alertas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-warning/10 border-warning/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <p className="text-warning text-xs sm:text-sm font-medium uppercase tracking-wide">Recebimentos Vencidos</p>
                  <p className="text-2xl sm:text-3xl font-bold text-warning mt-2">{stats.recebimentosVencidos}</p>
                  <p className="text-xs text-muted-foreground mt-1">Contas não recebidas</p>
                </CardContent>
              </Card>

              <Card className="bg-destructive/10 border-destructive/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <p className="text-destructive text-xs sm:text-sm font-medium uppercase tracking-wide">Pagamentos Vencidos</p>
                  <p className="text-2xl sm:text-3xl font-bold text-destructive mt-2">{stats.contasVencidas}</p>
                  <p className="text-xs text-muted-foreground mt-1">Contas não pagas</p>
                </CardContent>
              </Card>

              <Card className="bg-warning/10 border-warning/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <p className="text-warning text-xs sm:text-sm font-medium uppercase tracking-wide">Receitas Pendentes</p>
                  <p className="text-2xl sm:text-3xl font-bold text-warning mt-2">{formatCurrency(stats.receitasPendentes)}</p>
                  <p className="text-xs text-muted-foreground mt-1">A conferir</p>
                </CardContent>
              </Card>

              <Card className="bg-destructive/10 border-destructive/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <p className="text-destructive text-xs sm:text-sm font-medium uppercase tracking-wide">Despesas Pendentes</p>
                  <p className="text-2xl sm:text-3xl font-bold text-destructive mt-2">{formatCurrency(stats.despesasPendentes)}</p>
                  <p className="text-xs text-muted-foreground mt-1">A conferir</p>
                </CardContent>
              </Card>
            </div>

            {/* Contas Vencidas */}
            <Card className="bg-card/80 border-border overflow-hidden">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Contas Vencidas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-4">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Data</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Descrição</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Tipo</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Valor</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...contasReceber, ...contasPagar]
                        .filter((conta: any) => conta.data && new Date(conta.data) < new Date())
                        .sort((a: any, b: any) => new Date(a.data).getTime() - new Date(b.data).getTime())
                        .slice(0, 20)
                        .map((conta: any, idx: number) => {
                          const statusConfig = getStatusBadgeConfig(conta.status);
                          const tipo = contasReceber.some((cr: any) => cr.id === conta.id) ? "Receita" : "Despesa";
                          const isReceita = tipo === "Receita";
                          return (
                            <TableRow key={conta.id || idx} className="border-border hover:bg-muted/50">
                              <TableCell className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">
                                {conta.data ? new Date(conta.data).toLocaleDateString("pt-BR") : "-"}
                              </TableCell>
                              <TableCell className="text-foreground font-medium text-xs sm:text-sm px-3 sm:px-4">{conta.descricao || "Sem descrição"}</TableCell>
                              <TableCell className="text-xs sm:text-sm px-3 sm:px-4">
                                <Badge variant={isReceita ? "secondary" : "outline"} className="text-xs">
                                  {tipo}
                                </Badge>
                              </TableCell>
                              <TableCell className={`font-semibold text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap ${isReceita ? "text-success" : "text-destructive"}`}>
                                {formatCurrency(Math.abs(Number(conta.valor || 0)))}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm px-3 sm:px-4">
                                <Badge variant={statusConfig.variant} className="text-xs">
                                  {statusConfig.label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {[...contasReceber, ...contasPagar].filter((conta: any) => conta.data && new Date(conta.data) < new Date()).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                            Nenhuma conta vencida 🎉
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Contas Pendentes */}
            <Card className="bg-card/80 border-border overflow-hidden">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning" />
                  Contas Pendentes (Não Conferidas)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-4">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Data</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Descrição</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Tipo</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Valor</TableHead>
                        <TableHead className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...contasReceber, ...contasPagar]
                        .filter((conta: any) => conta.status === "pendente")
                        .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())
                        .slice(0, 20)
                        .map((conta: any, idx: number) => {
                          const statusConfig = getStatusBadgeConfig(conta.status);
                          const tipo = contasReceber.some((cr: any) => cr.id === conta.id) ? "Receita" : "Despesa";
                          const isReceita = tipo === "Receita";
                          return (
                            <TableRow key={conta.id || idx} className="border-border hover:bg-muted/50">
                              <TableCell className="text-muted-foreground text-xs sm:text-sm px-3 sm:px-4">
                                {conta.data ? new Date(conta.data).toLocaleDateString("pt-BR") : "-"}
                              </TableCell>
                              <TableCell className="text-foreground font-medium text-xs sm:text-sm px-3 sm:px-4">{conta.descricao || "Sem descrição"}</TableCell>
                              <TableCell className="text-xs sm:text-sm px-3 sm:px-4">
                                <Badge variant={isReceita ? "secondary" : "outline"} className="text-xs">
                                  {tipo}
                                </Badge>
                              </TableCell>
                              <TableCell className={`font-semibold text-xs sm:text-sm px-3 sm:px-4 whitespace-nowrap ${isReceita ? "text-success" : "text-destructive"}`}>
                                {formatCurrency(Math.abs(Number(conta.valor || 0)))}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm px-3 sm:px-4">
                                <Badge variant={statusConfig.variant} className="text-xs">
                                  {statusConfig.label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {[...contasReceber, ...contasPagar].filter((conta: any) => conta.status === "pendente").length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                            Nenhuma conta pendente 🎉
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Relatório Anual */}
          <TabsContent value="relatorio-anual" className="space-y-6">
            {/* Filtros */}
            <Card className="bg-card/80 border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Filtro de Data */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Data Inicial</Label>
                    <Input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Data Final</Label>
                    <Input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                {/* Filtro de Categorias */}
                <div className="space-y-3">
                  <Label className="text-muted-foreground">Categorias</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categoriasUnicas.map((categoria) => (
                      <div key={categoria} className="flex items-center space-x-2">
                        <Checkbox
                          id={categoria}
                          checked={categoriasPermitidas.has(categoria)}
                          onCheckedChange={(checked) => handleCategoriaChange(categoria, checked as boolean)}
                        />
                        <label
                          htmlFor={categoria}
                          className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                        >
                          {categoria}
                        </label>
                      </div>
                    ))}
                  </div>
                  {categoriasUnicas.length === 0 && (
                    <p className="text-muted-foreground text-sm">Nenhuma categoria disponível</p>
                  )}
                </div>

                {/* Botão para limpar filtros */}
                <Button
                  variant="outline"
                  onClick={() => {
                    setDataInicio(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
                    setDataFim(new Date().toISOString().split('T')[0]);
                    setCategoriasPermitidas(new Set());
                  }}
                  className="border-border"
                >
                  Limpar Filtros
                </Button>
              </CardContent>
            </Card>

            {/* Resumo dos Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const transacoesFiltradas = transacoes.filter((t: any) => {
                  if (!t.data) return false;
                  const dataTrans = new Date(t.data).toISOString().split('T')[0];
                  const dentroData = dataTrans >= dataInicio && dataTrans <= dataFim;
                  const categoriaSelecionada = categoriasPermitidas.size === 0 || categoriasPermitidas.has(t.categorias_movimentacao?.nome || t.grupo_categoria || '');
                  return dentroData && categoriaSelecionada;
                });

                const totalReceitas = transacoesFiltradas
                  .filter((t: any) => t.tipo_movimento === "entrada")
                  .reduce((acc: number, t: any) => acc + Math.abs(Number(t.valor || 0)), 0);

                const totalDespesas = transacoesFiltradas
                  .filter((t: any) => t.tipo_movimento === "saida")
                  .reduce((acc: number, t: any) => acc + Math.abs(Number(t.valor || 0)), 0);

                const saldo = totalReceitas - totalDespesas;

                return (
                  <>
                    <Card className="bg-success/10 border-success/30 overflow-hidden">
                      <CardContent className="p-4 sm:p-5">
                        <p className="text-success text-xs sm:text-sm font-medium uppercase tracking-wide">Receitas</p>
                        <p className="text-xl sm:text-2xl font-bold text-success mt-2 truncate">{formatCurrency(totalReceitas)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-destructive/10 border-destructive/30 overflow-hidden">
                      <CardContent className="p-4 sm:p-5">
                        <p className="text-destructive text-xs sm:text-sm font-medium uppercase tracking-wide">Despesas</p>
                        <p className="text-xl sm:text-2xl font-bold text-destructive mt-2 truncate">{formatCurrency(totalDespesas)}</p>
                      </CardContent>
                    </Card>
                    <Card className={`overflow-hidden ${saldo >= 0 ? 'bg-primary/10 border-primary/30' : 'bg-warning/10 border-warning/30'}`}>
                      <CardContent className="p-4 sm:p-5">
                        <p className={`text-xs sm:text-sm font-medium uppercase tracking-wide ${saldo >= 0 ? 'text-primary' : 'text-warning'}`}>Saldo</p>
                        <p className={`text-xl sm:text-2xl font-bold mt-2 truncate ${saldo >= 0 ? 'text-primary' : 'text-warning'}`}>{formatCurrency(saldo)}</p>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>

            {/* Tabela de Transações Filtradas */}
            <Card className="bg-card/80 border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Transações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-muted-foreground">Data</TableHead>
                        <TableHead className="text-muted-foreground">Tipo</TableHead>
                        <TableHead className="text-muted-foreground">Descrição</TableHead>
                        <TableHead className="text-muted-foreground">Categoria</TableHead>
                        <TableHead className="text-muted-foreground">Valor</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const transacoesFiltradas = transacoes
                          .filter((t: any) => {
                            if (!t.data) return false;
                            const dataTrans = new Date(t.data).toISOString().split('T')[0];
                            const dentroData = dataTrans >= dataInicio && dataTrans <= dataFim;
                            const categoriaSelecionada = categoriasPermitidas.size === 0 || categoriasPermitidas.has(t.categorias_movimentacao?.nome || t.grupo_categoria || '');
                            return dentroData && categoriaSelecionada;
                          })
                          .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime())
                          .slice(0, 100);

                        if (transacoesFiltradas.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Nenhuma transação encontrada com os filtros aplicados
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return transacoesFiltradas.map((transacao: any) => {
                          const statusConfig = getStatusBadgeConfig(transacao.status);
                          return (
                            <TableRow key={transacao.id} className="border-border hover:bg-muted/50">
                              <TableCell className="text-muted-foreground">
                                {new Date(transacao.data).toLocaleDateString("pt-BR")}
                              </TableCell>
                              <TableCell>
                                <Badge variant={transacao.tipo_movimento === "entrada" ? "secondary" : "destructive"}>
                                  {transacao.tipo_movimento === "entrada" ? "Receita" : "Despesa"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-foreground font-medium">
                                {transacao.descricao || "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {transacao.categorias_movimentacao?.nome || transacao.grupo_categoria || "-"}
                              </TableCell>
                              <TableCell className={`font-semibold ${
                                transacao.tipo_movimento === "entrada" ? "text-success" : "text-destructive"
                              }`}>
                                {formatCurrency(Math.abs(Number(transacao.valor || 0)))}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusConfig.variant}>
                                  {statusConfig.label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
