import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, PieChart, BarChart3, Download, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export function RelatorioFinanceiro() {
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedDay, setSelectedDay] = useState("");
  const [viewMode, setViewMode] = useState<"mes" | "trimestre" | "ano">("mes");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [movRes, agendRes] = await Promise.all([
        supabase.from("movimentacoes").select("*").order("data", { ascending: true }),
        supabase.from("agendamento_pagamentos").select("*").order("data_agendamento", { ascending: true })
      ]);

      if (movRes.error) throw movRes.error;
      if (agendRes.error) throw agendRes.error;

      setMovimentacoes(movRes.data || []);
      setAgendamentos(agendRes.data || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar dados");
    }
    setIsLoading(false);
  };

  const getDateRange = () => {
    const baseDate = new Date(selectedMonth + "-01");
    switch (viewMode) {
      case "trimestre":
        return { start: subMonths(baseDate, 2), end: endOfMonth(baseDate) };
      case "ano":
        return { start: new Date(baseDate.getFullYear(), 0, 1), end: new Date(baseDate.getFullYear(), 11, 31) };
      default:
        return { start: startOfMonth(baseDate), end: endOfMonth(baseDate) };
    }
  };

  const filteredData = useMemo(() => {
    const { start, end } = getDateRange();
    return movimentacoes.filter(m => {
      const date = new Date(m.data);
      const matchesDateRange = date >= start && date <= end;

      if (!matchesDateRange) return false;

      if (selectedDay) {
        const dayNumber = parseInt(selectedDay);
        return date.getDate() === dayNumber;
      }

      return true;
    });
  }, [movimentacoes, selectedMonth, selectedDay, viewMode]);

  const totals = useMemo(() => {
    const entradas = filteredData
      .filter(m => m.tipo_movimento === "entrada")
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const saidas = filteredData
      .filter(m => m.tipo_movimento === "saída")
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const pendentes = agendamentos
      .filter(a => a.status === 'agendado')
      .reduce((sum, a) => sum + parseFloat(a.valor), 0);

    return { entradas, saidas, saldo: entradas - saidas, pendentes };
  }, [filteredData, agendamentos]);

  const categoriaData = useMemo(() => {
    const categorias: Record<string, { entrada: number; saida: number }> = {};
    
    filteredData.forEach(m => {
      if (!categorias[m.categoria]) {
        categorias[m.categoria] = { entrada: 0, saida: 0 };
      }
      if (m.tipo_movimento === "entrada") {
        categorias[m.categoria].entrada += parseFloat(m.valor);
      } else {
        categorias[m.categoria].saida += parseFloat(m.valor);
      }
    });

    return Object.entries(categorias).map(([name, values]) => ({
      name,
      entrada: values.entrada,
      saida: values.saida
    }));
  }, [filteredData]);

  const pieData = useMemo(() => {
    const saidas = filteredData.filter(m => m.tipo_movimento === "saída");
    const categorias: Record<string, number> = {};
    
    saidas.forEach(m => {
      categorias[m.categoria] = (categorias[m.categoria] || 0) + parseFloat(m.valor);
    });

    return Object.entries(categorias).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const monthlyTrendData = useMemo(() => {
    const months: Record<string, { mes: string; entradas: number; saidas: number }> = {};
    
    movimentacoes.forEach(m => {
      const monthKey = m.data.substring(0, 7);
      if (!months[monthKey]) {
        months[monthKey] = { mes: monthKey, entradas: 0, saidas: 0 };
      }
      if (m.tipo_movimento === "entrada") {
        months[monthKey].entradas += parseFloat(m.valor);
      } else {
        months[monthKey].saidas += parseFloat(m.valor);
      }
    });

    return Object.values(months)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6)
      .map(m => ({
        ...m,
        mes: format(new Date(m.mes + "-01"), "MMM/yy", { locale: ptBR })
      }));
  }, [movimentacoes]);

  const exportReport = () => {
    const { start, end } = getDateRange();
    const reportData = filteredData.map(m => ({
      Data: format(new Date(m.data), "dd/MM/yyyy"),
      Descrição: m.descricao,
      Categoria: m.categoria,
      Tipo: m.tipo_movimento,
      Valor: parseFloat(m.valor).toFixed(2),
      Status: m.status
    }));

    const csv = [
      Object.keys(reportData[0] || {}).join(","),
      ...reportData.map(row => Object.values(row).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_financeiro_${selectedMonth}.csv`;
    a.click();
    
    toast.success("Relatório exportado com sucesso!");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">Carregando relatórios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="text-foreground flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Relatório Financeiro
            </CardTitle>
            <div className="flex gap-4 items-center flex-wrap">
              <Select value={viewMode} onValueChange={(v: "mes" | "trimestre" | "ano") => setViewMode(v)}>
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Mês</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                  <SelectItem value="ano">Ano</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40 bg-background"
              />
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger className="w-40 bg-background">
                  <SelectValue placeholder="Todos os dias" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      Dia {String(day).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={exportReport} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              R$ {totals.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredData.filter(m => m.tipo_movimento === "entrada").length} transações
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              R$ {totals.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredData.filter(m => m.tipo_movimento === "saída").length} transações
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Período</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.saldo >= 0 ? "text-primary" : "text-orange-500"}`}>
              R$ {totals.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.saldo >= 0 ? "Positivo" : "Negativo"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagamentos Pendentes</CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              R$ {totals.pendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {agendamentos.filter(a => a.status === 'agendado').length} agendados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Tendência Mensal */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Tendência Mensal (Últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="entradas" stroke="#10b981" name="Entradas" strokeWidth={2} />
                  <Line type="monotone" dataKey="saidas" stroke="#ef4444" name="Saídas" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Despesas por Categoria */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))'
                      }}
                      formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Sem dados de despesas no período</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras - Por Categoria */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Entradas vs Saídas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            {categoriaData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoriaData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="nome" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  />
                  <Legend />
                  <Bar dataKey="entrada" fill="#10b981" name="Entradas" />
                  <Bar dataKey="saida" fill="#ef4444" name="Saídas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Sem dados no período selecionado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
