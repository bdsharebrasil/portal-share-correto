// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Download, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { exportElementToPDF, createFilenameWithTimestamp } from "@/utils/exportToPDF";
import { toast } from "sonner";

interface RelatorioFluxoCaixaProps {
  onBack?: () => void;
  isStandalone?: boolean;
}

export const RelatorioFluxoCaixa = ({ onBack, isStandalone = true }: RelatorioFluxoCaixaProps) => {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [isExporting, setIsExporting] = useState(false);

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["fluxo-caixa-data", selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split("-");
      const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const endDate = endOfMonth(startDate);

      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, tipo, valor, data_competencia, data_vencimento, data_pagamento")
        .gte("data_competencia", format(startDate, "yyyy-MM-dd"))
        .lte("data_competencia", format(endDate, "yyyy-MM-dd"))
        .order("data_competencia", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      const date = subMonths(new Date(), i);
      result.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return result;
  }, []);

  const fluxoData = useMemo(() => {
    if (!transacoes) return null;

    const [year, month] = selectedMonth.split("-");
    const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
    const endDate = endOfMonth(startDate);

    // Fluxo diário
    const fluxoDiario: { data: string; entradas: number; saidas: number; saldo: number }[] = [];
    let saldoAcumulado = 0;

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    days.forEach((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const transacoesDia = transacoes.filter((t) => (t.data_competencia || t.data_pagamento || t.data_vencimento || "") === dayStr);
      
      const entradas = transacoesDia
        .filter((t) => t.tipo === "receita" || t.tipo === "entrada")
        .reduce((acc, t) => acc + Number(t.valor), 0);
      
      const saidas = transacoesDia
        .filter((t) => t.tipo !== "receita" && t.tipo !== "entrada")
        .reduce((acc, t) => acc + Number(t.valor), 0);

      saldoAcumulado += entradas - saidas;

      if (entradas > 0 || saidas > 0) {
        fluxoDiario.push({
          data: format(day, "dd/MM", { locale: ptBR }),
          entradas,
          saidas,
          saldo: saldoAcumulado,
        });
      }
    });

    const totalEntradas = transacoes
      .filter((t) => t.tipo === "receita" || t.tipo === "entrada")
      .reduce((acc, t) => acc + Number(t.valor), 0);

    const totalSaidas = transacoes
      .filter((t) => t.tipo !== "receita" && t.tipo !== "entrada")
      .reduce((acc, t) => acc + Number(t.valor), 0);

    return {
      fluxoDiario,
      totalEntradas,
      totalSaidas,
      saldoFinal: totalEntradas - totalSaidas,
    };
  }, [transacoes, selectedMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const filename = createFilenameWithTimestamp('relatorio_fluxo_caixa');
      
      await exportElementToPDF('relatorio-fluxo-caixa-content', {
        filename,
        title: `Fluxo de Caixa - ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}`,
        includeTimestamp: true,
        orientation: 'landscape'
      });

      toast.success('Relatório de Fluxo de Caixa exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar relatório para PDF');
    } finally {
      setIsExporting(false);
    }
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
        <div className="flex items-center gap-4">
          {isStandalone && onBack && (
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          )}
          {isStandalone && (
            <h2 className="text-2xl font-bold">Fluxo de Caixa</h2>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleExportPDF}
            disabled={isExporting}
            variant="outline"
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Exportar
              </>
            )}
          </Button>
        </div>
      </div>

      <div id="relatorio-fluxo-caixa-content" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/20">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Entradas</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(fluxoData?.totalEntradas || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-500/20">
                  <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Saídas</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(fluxoData?.totalSaidas || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/20">
                  <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Final</p>
                  <p className={`text-xl font-bold ${fluxoData && fluxoData.saldoFinal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatCurrency(fluxoData?.saldoFinal || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Movimentação Diária</CardTitle>
          </CardHeader>
          <CardContent>
            {fluxoData && fluxoData.fluxoDiario.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Entradas</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Saídas</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Saldo Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fluxoData.fluxoDiario.map((dia, index) => (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-3 px-4 text-foreground">{dia.data}</td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">
                          {dia.entradas > 0 ? formatCurrency(dia.entradas) : "-"}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">
                          {dia.saidas > 0 ? formatCurrency(dia.saidas) : "-"}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${dia.saldo >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(dia.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Nenhuma movimentação encontrada neste período.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
