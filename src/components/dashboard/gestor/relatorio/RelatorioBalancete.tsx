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

interface RelatorioBalanceteProps {
  onBack: () => void;
}

export const RelatorioBalancete = ({ onBack }: RelatorioBalanceteProps) => {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const { data: categoriasData } = useCategorias();

  const getCategoriaName = (id: string | null) => {
    if (!id || !categoriasData) return "Outros";
    return categoriasData.find(c => c.id === id)?.nome || "Outros";
  };

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["balancete-data", selectedMonth],
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

  const { data: contasBancarias } = useQuery({
    queryKey: ["contas-bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("ativo", true);

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

  const balanceteData = useMemo(() => {
    if (!transacoes) return null;

    // Agrupar por categoria
    const categorias: Record<string, { debito: number; credito: number }> = {};

    transacoes.forEach((t) => {
      const categoria = getCategoriaName(t.categoria_id);
      if (!categorias[categoria]) {
        categorias[categoria] = { debito: 0, credito: 0 };
      }

      if (t.tipo_movimento === "entrada") {
        categorias[categoria].credito += Number(t.valor);
      } else {
        categorias[categoria].debito += Number(t.valor);
      }
    });

    const totalDebito = Object.values(categorias).reduce((acc, c) => acc + c.debito, 0);
    const totalCredito = Object.values(categorias).reduce((acc, c) => acc + c.credito, 0);

    return {
      categorias,
      totalDebito,
      totalCredito,
      saldo: totalCredito - totalDebito,
    };
  }, [transacoes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
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
          <Button variant="ghost" onClick={onBack} className="text-gray-300">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h2 className="text-2xl font-bold text-white">Balancete Mensal</h2>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-white">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-gray-600 text-gray-300">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {contasBancarias && contasBancarias.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Contas Bancárias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contasBancarias.map((conta) => (
                <div key={conta.id} className="p-4 bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-400">{conta.banco || "Conta"}</p>
                  <p className="text-white font-medium">{conta.numero_conta || '-'}</p>
                  <p className="text-lg font-bold text-gray-300">
                    {conta.tipo_conta || '-'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Balancete por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          {balanceteData && Object.keys(balanceteData.categorias).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium">Conta/Categoria</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Débito</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Crédito</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(balanceteData.categorias).map(([categoria, valores]) => (
                    <tr key={categoria} className="border-b border-gray-700/50">
                      <td className="py-3 px-4 text-white">{categoria}</td>
                      <td className="py-3 px-4 text-right text-red-400">
                        {valores.debito > 0 ? formatCurrency(valores.debito) : "-"}
                      </td>
                      <td className="py-3 px-4 text-right text-green-400">
                        {valores.credito > 0 ? formatCurrency(valores.credito) : "-"}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${valores.credito - valores.debito >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {formatCurrency(valores.credito - valores.debito)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-600">
                    <td className="py-3 px-4 text-white font-bold">TOTAL</td>
                    <td className="py-3 px-4 text-right text-red-400 font-bold">
                      {formatCurrency(balanceteData.totalDebito)}
                    </td>
                    <td className="py-3 px-4 text-right text-green-400 font-bold">
                      {formatCurrency(balanceteData.totalCredito)}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${balanceteData.saldo >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(balanceteData.saldo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Nenhum dado encontrado neste período.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
