import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
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
  TrendingUp,
  TrendingDown,
  Loader2,
  Wallet,
  Calendar,
} from "lucide-react";
import { useDashboardGestorData } from "@/hooks/useDashboardGestorData";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Import new components
import { DashboardHeader } from "@/components/dashboard/gestor/DashboardHeader";
import { MonthSelector } from "@/components/dashboard/gestor/MonthSelector";
import { KPISection } from "@/components/dashboard/gestor/KPISection";
import { ChartCard } from "@/components/dashboard/gestor/ChartCard";
import { TransactionTable } from "@/components/dashboard/gestor/TransactionTable";
import { FilterSection } from "@/components/dashboard/gestor/FilterSection";

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
    'inadimplente': { label: '⚠ Inadimplente', variant: 'destructive' },
  };
  return statusMap[status?.toLowerCase()] || { label: status || 'N/A', variant: 'outline' };
};

export default function DashboardGestor() {
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dataInicio, setDataInicio] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [dataFim, setDataFim] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
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
        <DashboardHeader onExport={() => console.log("Export")} />

        {/* Month Selector */}
        <MonthSelector
          monthYear={monthYear}
          onPreviousMonth={previousMonth}
          onNextMonth={nextMonth}
        />

        {/* KPI Cards */}
        <KPISection
          totalReceitas={stats.totalReceitas}
          receitasConferidas={stats.receitasConferidas}
          totalDespesas={stats.totalDespesas}
          despesasConferidas={stats.despesasConferidas}
          saldoGeral={stats.saldoGeral}
          formatCurrency={formatCurrency}
        />

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
            <TabsTrigger value="relatorio-anual" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Relatório Anual
            </TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Receitas vs Despesas */}
              <ChartCard
                title="Receitas vs Despesas (últimos 6 meses)"
                icon={<Wallet className="w-5 h-5 text-primary" />}
              >
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
              </ChartCard>

              {/* Distribuição de Despesas */}
              <ChartCard
                title="Distribuição de Despesas por Categoria"
                icon={<TrendingDown className="w-5 h-5 text-destructive" />}
              >
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
              </ChartCard>
            </div>

            {/* Tendência de Saldo */}
            <ChartCard
              title="Tendência de Saldo Mensal"
              icon={<TrendingUp className="w-5 h-5 text-primary" />}
            >
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
            </ChartCard>
          </TabsContent>

          {/* Receitas */}
          <TabsContent value="receitas" className="space-y-6">
            <TransactionTable
              title="Todas as Entradas/Receitas"
              columns={[
                { key: "data", label: "Data" },
                { key: "descricao", label: "Descrição" },
                { key: "categoria", label: "Categoria" },
                { key: "valor", label: "Valor" },
                { key: "status", label: "Status" },
              ]}
              data={contasReceber
                .sort((a: any, b: any) => {
                  const dateA = typeof a.data === 'string' ? parseISO(a.data) : new Date(a.data);
                  const dateB = typeof b.data === 'string' ? parseISO(b.data) : new Date(b.data);
                  return dateB.getTime() - dateA.getTime();
                })
                .slice(0, 50)}
              emptyMessage="Nenhuma receita registrada"
              renderCell={(column, value, row) => {
                switch (column) {
                  case "data":
                    return row.data ? format(typeof row.data === 'string' ? parseISO(row.data) : new Date(row.data), "dd/MM/yyyy") : "-";
                  case "descricao":
                    return row.descricao || "Sem descrição";
                  case "categoria":
                    return row.categorias_movimentacao?.nome || row.grupo_categoria || "-";
                  case "valor":
                    return <span className="text-success font-semibold whitespace-nowrap">{formatCurrency(Math.abs(Number(row.valor || 0)))}</span>;
                  case "status":
                    const statusConfig = getStatusBadgeConfig(row.status);
                    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
                  default:
                    return value;
                }
              }}
            />
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

            <TransactionTable
              title="Todas as Saídas/Despesas"
              columns={[
                { key: "data", label: "Data" },
                { key: "descricao", label: "Descrição" },
                { key: "categoria", label: "Categoria" },
                { key: "valor", label: "Valor" },
                { key: "status", label: "Status" },
              ]}
              data={contasPagar
                .sort((a: any, b: any) => {
                  const dateA = typeof a.data === 'string' ? parseISO(a.data) : new Date(a.data);
                  const dateB = typeof b.data === 'string' ? parseISO(b.data) : new Date(b.data);
                  return dateB.getTime() - dateA.getTime();
                })
                .slice(0, 50)}
              emptyMessage="Nenhuma despesa registrada"
              renderCell={(column, value, row) => {
                switch (column) {
                  case "data":
                    return row.data ? format(typeof row.data === 'string' ? parseISO(row.data) : new Date(row.data), "dd/MM/yyyy") : "-";
                  case "descricao":
                    return row.descricao || "Sem descrição";
                  case "categoria":
                    return row.categorias_movimentacao?.nome || row.grupo_categoria || "-";
                  case "valor":
                    return <span className="text-destructive font-semibold whitespace-nowrap">{formatCurrency(Math.abs(Number(row.valor || 0)))}</span>;
                  case "status":
                    const statusConfig = getStatusBadgeConfig(row.status);
                    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
                  default:
                    return value;
                }
              }}
            />
          </TabsContent>


          {/* Relatório Anual */}
          <TabsContent value="relatorio-anual" className="space-y-6">
            {/* Filtros */}
            <FilterSection
              dataInicio={dataInicio}
              dataFim={dataFim}
              onDataInicioChange={setDataInicio}
              onDataFimChange={setDataFim}
              categorias={categoriasUnicas}
              categoriasPermitidas={categoriasPermitidas}
              onCategoriaChange={handleCategoriaChange}
              onClearFilters={() => {
                setDataInicio(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
                setDataFim(new Date().toISOString().split('T')[0]);
                setCategoriasPermitidas(new Set());
              }}
            />

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
                                {format(typeof transacao.data === 'string' ? parseISO(transacao.data) : new Date(transacao.data), "dd/MM/yyyy")}
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
