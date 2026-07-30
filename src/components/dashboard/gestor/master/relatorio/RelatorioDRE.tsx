// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCategorias } from "@/hooks/useCategorias";
import { exportElementToPDF, createFilenameWithTimestamp } from "@/utils/exportToPDF";
import { toast } from "sonner";

interface RelatorioDREProps {
  onBack?: () => void;
  isStandalone?: boolean;
}

export const RelatorioDRE = ({ onBack, isStandalone = true }: RelatorioDREProps) => {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [isExporting, setIsExporting] = useState(false);
  const { data: categoriasData } = useCategorias();

  const getCategoriaName = (id: string | null) => {
    if (!id || !categoriasData) return "Outros";
    return categoriasData.find(c => c.id === id)?.nome || "Outros";
  };

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["dre-data", selectedMonth],
    queryFn: async () => {
      const [year, month] = selectedMonth.split("-");
      const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const endDate = endOfMonth(startDate);

      const { data, error } = await supabase
        .from("controle_bancario")
        .select("*")
        .gte("data", format(startDate, "yyyy-MM-dd"))
        .lte("data", format(endDate, "yyyy-MM-dd"));

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

  const dreData = useMemo(() => {
    if (!transacoes) return null;

    const receitas = transacoes
      .filter((t) => t.tipo_movimento === "entrada")
      .reduce((acc, t) => acc + Number(t.valor), 0);

    const despesas = transacoes
      .filter((t) => t.tipo_movimento === "saida")
      .reduce((acc, t) => acc + Number(t.valor), 0);

    // Agrupar por categoria
    const receitasPorCategoria: Record<string, number> = {};
    const despesasPorCategoria: Record<string, number> = {};

    transacoes.forEach((t) => {
      const categoria = getCategoriaName(t.categoria_id);
      if (t.tipo_movimento === "entrada") {
        receitasPorCategoria[categoria] = (receitasPorCategoria[categoria] || 0) + Number(t.valor);
      } else {
        despesasPorCategoria[categoria] = (despesasPorCategoria[categoria] || 0) + Number(t.valor);
      }
    });

    return {
      receitas,
      despesas,
      resultado: receitas - despesas,
      receitasPorCategoria,
      despesasPorCategoria,
    };
  }, [transacoes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      const filename = createFilenameWithTimestamp('relatorio_dre');
      
      await exportElementToPDF('relatorio-dre-content', {
        filename,
        title: `Demonstração de Resultado (DRE) - ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}`,
        includeTimestamp: true,
        orientation: 'portrait'
      });

      toast.success('Relatório DRE exportado com sucesso!');
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
            <h2 className="text-2xl font-bold">Demonstração de Resultado (DRE)</h2>
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

      <div id="relatorio-dre-content" className="space-y-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Receitas Operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dreData && Object.entries(dreData.receitasPorCategoria).map(([categoria, valor]) => (
              <div key={categoria} className="flex justify-between text-muted-foreground">
                <span>{categoria}</span>
                <span className="text-green-600 dark:text-green-400">{formatCurrency(valor)}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-4">
              <div className="flex justify-between font-bold text-foreground">
                <span>Total Receitas</span>
                <span className="text-green-600 dark:text-green-400">{formatCurrency(dreData?.receitas || 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Despesas Operacionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dreData && Object.entries(dreData.despesasPorCategoria).map(([categoria, valor]) => (
              <div key={categoria} className="flex justify-between text-muted-foreground">
                <span>{categoria}</span>
                <span className="text-red-600 dark:text-red-400">({formatCurrency(valor)})</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-4">
              <div className="flex justify-between font-bold text-foreground">
                <span>Total Despesas</span>
                <span className="text-red-600 dark:text-red-400">({formatCurrency(dreData?.despesas || 0)})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex justify-between text-xl font-bold">
              <span className="text-foreground">Resultado do Período</span>
              <span className={dreData && dreData.resultado >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                {formatCurrency(dreData?.resultado || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  };
