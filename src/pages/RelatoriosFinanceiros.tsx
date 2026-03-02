import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Download, Loader2, TrendingUp, TrendingDown, Wallet, BarChart3, PieChart, Users, Filter, X } from "lucide-react";
import { useRelatorioFinanceiro } from "@/hooks/useRelatorioFinanceiro";
import { exportElementToPDF, createFilenameWithTimestamp } from "@/utils/exportToPDF";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Area, AreaChart,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
  "hsl(340 82% 52%)",
  "hsl(25 95% 53%)",
  "hsl(173 80% 40%)",
  "hsl(291 64% 42%)",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatCompact = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

export default function RelatoriosFinanceiros() {
  const rel = useRelatorioFinanceiro();
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleExportPDF = async (elementId: string, title: string) => {
    try {
      setIsExporting(true);
      const filename = createFilenameWithTimestamp(title.replace(/\s+/g, "_").toLowerCase());
      await exportElementToPDF(elementId, { filename, title, includeTimestamp: true, orientation: "landscape" });
      toast.success(`Relatório "${title}" exportado com sucesso!`);
    } catch {
      toast.error("Erro ao exportar relatório para PDF");
    } finally {
      setIsExporting(false);
    }
  };

  if (rel.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <span>Carregando relatórios...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios Financeiros</h1>
            <p className="text-sm text-muted-foreground">Análise completa de receitas, despesas e resultados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
            {(rel.categoriasFiltro.length > 0 || rel.tipoFiltro !== "todos") && (
              <Badge variant="secondary" className="ml-1">{rel.categoriasFiltro.length + (rel.tipoFiltro !== "todos" ? 1 : 0)}</Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportPDF("relatorio-completo", "Relatorio_Financeiro")}
            disabled={isExporting}
            className="gap-2"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card className="border-border animate-in fade-in slide-in-from-top-2 duration-200">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Mês Início</label>
                <Select value={rel.mesInicio} onValueChange={rel.setMesInicio}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rel.mesesDisponiveis.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Mês Fim</label>
                <Select value={rel.mesFim} onValueChange={rel.setMesFim}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {rel.mesesDisponiveis.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Tipo</label>
                <Select value={rel.tipoFiltro} onValueChange={(v) => rel.setTipoFiltro(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="entrada">Receitas</SelectItem>
                    <SelectItem value="saida">Despesas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {rel.categoriasDisponiveis.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Categorias</label>
                  {rel.categoriasFiltro.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => rel.setCategoriasFiltro([])} className="h-6 text-xs gap-1">
                      <X className="h-3 w-3" /> Limpar
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                  {rel.categoriasDisponiveis.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-2">
                      <Checkbox
                        id={cat.id}
                        checked={rel.categoriasFiltro.includes(cat.id)}
                        onCheckedChange={(checked) => {
                          if (checked) rel.setCategoriasFiltro([...rel.categoriasFiltro, cat.id]);
                          else rel.setCategoriasFiltro(rel.categoriasFiltro.filter((c) => c !== cat.id));
                        }}
                      />
                      <label htmlFor={cat.id} className="text-xs text-muted-foreground cursor-pointer truncate">
                        {cat.nome}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div id="relatorio-completo" className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Receitas</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(rel.resumoGeral.receitas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <TrendingDown className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Despesas</p>
                  <p className="text-xl font-bold text-destructive">{formatCurrency(rel.resumoGeral.despesas)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Resultado</p>
                  <p className={`text-xl font-bold ${rel.resumoGeral.resultado >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    {formatCurrency(rel.resumoGeral.resultado)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Transações</p>
                  <p className="text-xl font-bold text-foreground">{rel.resumoGeral.totalTransacoes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="visao-geral" className="space-y-4">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
            <TabsTrigger value="visao-geral" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Visão Geral</TabsTrigger>
            <TabsTrigger value="receitas" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Receitas</TabsTrigger>
            <TabsTrigger value="despesas" className="gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Despesas</TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5"><Users className="h-3.5 w-3.5" />Por Cliente</TabsTrigger>
            <TabsTrigger value="comparativo" className="gap-1.5"><PieChart className="h-3.5 w-3.5" />Comparativo</TabsTrigger>
          </TabsList>

          {/* VISÃO GERAL */}
          <TabsContent value="visao-geral" className="space-y-6">
            {/* Gráfico Receitas vs Despesas mensal */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Receitas vs Despesas — Evolução Mensal</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={rel.comparacaoMensal} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mesLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend formatter={(v) => (v === "receitas" ? "Receitas" : v === "despesas" ? "Despesas" : "Resultado")} />
                    <Bar dataKey="receitas" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Resultado mensal - linha */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Resultado Mensal (Receitas - Despesas)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={rel.comparacaoMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mesLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Area type="monotone" dataKey="resultado" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RECEITAS */}
          <TabsContent value="receitas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico Pizza Receitas */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Receitas por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {rel.receitasPorCategoria.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={rel.receitasPorCategoria.map((c) => ({ name: c.nome, value: c.total }))}
                          cx="50%" cy="50%" outerRadius={100} innerRadius={40}
                          dataKey="value" nameKey="name"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                          fontSize={10}
                        >
                          {rel.receitasPorCategoria.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-center py-12">Nenhuma receita no período</p>
                  )}
                </CardContent>
              </Card>

              {/* Tabela Receitas */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Detalhamento das Receitas</CardTitle>
                </CardHeader>
                <CardContent>
                  {rel.receitasPorCategoria.length > 0 ? (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto">
                      {rel.receitasPorCategoria.map((cat) => (
                        <div key={cat.nome} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-foreground">{cat.nome}</p>
                            <p className="text-xs text-muted-foreground">{cat.quantidade} transações · {cat.percentual.toFixed(1)}%</p>
                          </div>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(cat.total)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <span className="font-bold text-foreground">Total Receitas</span>
                        <span className="font-bold text-green-600 dark:text-green-400">{formatCurrency(rel.resumoGeral.receitas)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-12">Nenhuma receita no período</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* DESPESAS */}
          <TabsContent value="despesas" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico Pizza Despesas */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {rel.despesasPorCategoria.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={rel.despesasPorCategoria.map((c) => ({ name: c.nome, value: c.total }))}
                          cx="50%" cy="50%" outerRadius={100} innerRadius={40}
                          dataKey="value" nameKey="name"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                          fontSize={10}
                        >
                          {rel.despesasPorCategoria.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-center py-12">Nenhuma despesa no período</p>
                  )}
                </CardContent>
              </Card>

              {/* Tabela Despesas por Categoria */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Detalhamento das Despesas</CardTitle>
                </CardHeader>
                <CardContent>
                  {rel.despesasPorCategoria.length > 0 ? (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto">
                      {rel.despesasPorCategoria.map((cat) => (
                        <div key={cat.nome} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div>
                            <p className="text-sm font-medium text-foreground">{cat.nome}</p>
                            <p className="text-xs text-muted-foreground">{cat.quantidade} transações · {cat.percentual.toFixed(1)}%</p>
                          </div>
                          <span className="text-sm font-semibold text-destructive">{formatCurrency(cat.total)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <span className="font-bold text-foreground">Total Despesas</span>
                        <span className="font-bold text-destructive">{formatCurrency(rel.resumoGeral.despesas)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-12">Nenhuma despesa no período</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Despesas por Grupo */}
            {rel.despesasPorGrupo.length > 0 && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Despesas por Grupo de Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(200, rel.despesasPorGrupo.length * 50)}>
                    <BarChart data={rel.despesasPorGrupo} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatCompact(v)} />
                      <YAxis type="category" dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={11} width={180} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="total" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* POR CLIENTE */}
          <TabsContent value="clientes" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Resultado por Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                {rel.porCliente.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Cliente</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Receitas</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Despesas</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Resultado</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Transações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rel.porCliente.map((c) => (
                          <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 text-foreground font-medium text-sm">{c.nome}</td>
                            <td className="py-3 px-4 text-right text-sm text-green-600 dark:text-green-400">{c.receitas > 0 ? formatCurrency(c.receitas) : "-"}</td>
                            <td className="py-3 px-4 text-right text-sm text-destructive">{c.despesas > 0 ? formatCurrency(c.despesas) : "-"}</td>
                            <td className={`py-3 px-4 text-right text-sm font-semibold ${c.saldo >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                              {formatCurrency(c.saldo)}
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-muted-foreground">{c.quantidade}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border">
                          <td className="py-3 px-4 font-bold text-foreground">TOTAL</td>
                          <td className="py-3 px-4 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(rel.resumoGeral.receitas)}</td>
                          <td className="py-3 px-4 text-right font-bold text-destructive">{formatCurrency(rel.resumoGeral.despesas)}</td>
                          <td className={`py-3 px-4 text-right font-bold ${rel.resumoGeral.resultado >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                            {formatCurrency(rel.resumoGeral.resultado)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-muted-foreground">{rel.resumoGeral.totalTransacoes}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">Nenhum dado por cliente no período</p>
                )}
              </CardContent>
            </Card>

            {/* Gráfico top clientes */}
            {rel.porCliente.filter((c) => c.nome !== "Sem Cliente").length > 0 && (
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Top Clientes — Receita vs Despesa</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={rel.porCliente.filter((c) => c.nome !== "Sem Cliente").slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} angle={-20} textAnchor="end" height={60} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend formatter={(v) => (v === "receitas" ? "Receitas" : "Despesas")} />
                      <Bar dataKey="receitas" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* COMPARATIVO */}
          <TabsContent value="comparativo" className="space-y-6">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Comparativo Mensal Detalhado</CardTitle>
              </CardHeader>
              <CardContent>
                {rel.comparacaoMensal.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-muted-foreground font-medium text-sm">Mês</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Receitas</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Despesas</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Resultado</th>
                          <th className="text-right py-3 px-4 text-muted-foreground font-medium text-sm">Margem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rel.comparacaoMensal.map((m) => {
                          const margem = m.receitas > 0 ? ((m.resultado / m.receitas) * 100) : 0;
                          return (
                            <tr key={m.mes} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-4 text-foreground font-medium text-sm capitalize">{m.mesLabel}</td>
                              <td className="py-3 px-4 text-right text-sm text-green-600 dark:text-green-400">{formatCurrency(m.receitas)}</td>
                              <td className="py-3 px-4 text-right text-sm text-destructive">{formatCurrency(m.despesas)}</td>
                              <td className={`py-3 px-4 text-right text-sm font-semibold ${m.resultado >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                                {formatCurrency(m.resultado)}
                              </td>
                              <td className={`py-3 px-4 text-right text-sm ${margem >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                                {margem.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">Nenhum dado disponível</p>
                )}
              </CardContent>
            </Card>

            {/* Evolução do resultado */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Evolução Receitas vs Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={rel.comparacaoMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mesLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => formatCompact(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend formatter={(v) => (v === "receitas" ? "Receitas" : v === "despesas" ? "Despesas" : "Resultado")} />
                    <Line type="monotone" dataKey="receitas" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="despesas" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="resultado" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
