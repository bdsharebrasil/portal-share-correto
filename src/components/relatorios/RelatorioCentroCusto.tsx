import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Download, Plane } from "lucide-react";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCategorias } from "@/hooks/useCategorias";

interface RelatorioCentroCustoProps {
  onBack: () => void;
}

export const RelatorioCentroCusto = ({ onBack }: RelatorioCentroCustoProps) => {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const { data: categoriasData } = useCategorias();

  const getCategoriaName = (id: string | null) => {
    if (!id || !categoriasData) return "Outros";
    return categoriasData.find(c => c.id === id)?.nome || "Outros";
  };

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["centro-custo-data", selectedMonth],
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

  const { data: aeronaves } = useQuery({
    queryKey: ["aeronaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("*");

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

  const centroCustoData = useMemo(() => {
    if (!transacoes) return null;

    // Agrupar por aeronave (centro de custo)
    const porAeronave: Record<string, { entradas: number; saidas: number; categorias: Record<string, number> }> = {};
    
    transacoes.forEach((t) => {
      const aeronave = t.aeronave_registro || "Sem Centro de Custo";
      if (!porAeronave[aeronave]) {
        porAeronave[aeronave] = { entradas: 0, saidas: 0, categorias: {} };
      }

      const valor = Number(t.valor);
      if (t.tipo_movimento === "entrada") {
        porAeronave[aeronave].entradas += valor;
      } else {
        porAeronave[aeronave].saidas += valor;
        const categoria = getCategoriaName(t.categoria_id);
        porAeronave[aeronave].categorias[categoria] = (porAeronave[aeronave].categorias[categoria] || 0) + valor;
      }
    });

    const totalGeral = {
      entradas: Object.values(porAeronave).reduce((acc, a) => acc + a.entradas, 0),
      saidas: Object.values(porAeronave).reduce((acc, a) => acc + a.saidas, 0),
    };

    return {
      porAeronave,
      totalGeral,
    };
  }, [transacoes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getAeronaveInfo = (registration: string) => {
    const aeronave = aeronaves?.find((a) => a.registration === registration);
    return aeronave ? `${aeronave.registration} - ${aeronave.model}` : registration;
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
          <h2 className="text-2xl font-bold text-white">Análise por Centro de Custo</h2>
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

      {centroCustoData && centroCustoData.totalGeral && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-400">Total Entradas</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(centroCustoData.totalGeral.entradas)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-400">Total Saídas</p>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(centroCustoData.totalGeral.saidas)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-400">Resultado</p>
              <p className={`text-2xl font-bold ${centroCustoData.totalGeral.entradas - centroCustoData.totalGeral.saidas >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(centroCustoData.totalGeral.entradas - centroCustoData.totalGeral.saidas)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {centroCustoData && Object.keys(centroCustoData.porAeronave).length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(centroCustoData.porAeronave).map(([aeronave, dados]) => (
            <Card key={aeronave} className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Plane className="w-5 h-5 text-blue-400" />
                  {getAeronaveInfo(aeronave)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Entradas</p>
                    <p className="text-lg font-bold text-green-400">{formatCurrency(dados.entradas)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Saídas</p>
                    <p className="text-lg font-bold text-red-400">{formatCurrency(dados.saidas)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Resultado</p>
                    <p className={`text-lg font-bold ${dados.entradas - dados.saidas >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(dados.entradas - dados.saidas)}
                    </p>
                  </div>
                </div>

                {Object.keys(dados.categorias).length > 0 && (
                  <div className="border-t border-gray-700 pt-4">
                    <p className="text-sm text-gray-400 mb-2">Despesas por Categoria</p>
                    <div className="space-y-2">
                      {Object.entries(dados.categorias)
                        .sort(([, a], [, b]) => b - a)
                        .map(([categoria, valor]) => (
                          <div key={categoria} className="flex justify-between text-sm">
                            <span className="text-gray-300">{categoria}</span>
                            <span className="text-red-400">{formatCurrency(valor)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardContent className="pt-6">
            <p className="text-gray-400 text-center py-8">Nenhum dado encontrado neste período.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
