import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Search, ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCategorias } from "@/hooks/useCategorias";

export function QuadroMensalTab() {
  const [mesAtual, setMesAtual] = useState(() => format(new Date(), "yyyy-MM"));
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("Todas");

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["quadro-mensal", mesAtual],
    queryFn: async () => {
      const [year, month] = mesAtual.split("-");
      const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const endDate = endOfMonth(startDate);

      const { data, error } = await supabase
        .from("controle_bancario")
        .select("*")
        .gte("data", format(startDate, "yyyy-MM-dd"))
        .lte("data", format(endDate, "yyyy-MM-dd"))
        .order("data", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: categoriasData } = useCategorias();

  const getCategoriaName = (id: string | null) => {
    if (!id || !categoriasData) return '-';
    const cat = categoriasData.find(c => c.id === id);
    return cat?.nome || '-';
  };

  const categorias = useMemo(() => {
    if (!transacoes || !categoriasData) return [];
    const uniqueIds = [...new Set(transacoes.map((t) => t.categoria_id))].filter(Boolean);
    return uniqueIds.map(id => {
      const cat = categoriasData.find(c => c.id === id);
      return { id, nome: cat?.nome || id };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [transacoes, categoriasData]);

  const transacoesFiltradas = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((transacao) => {
      const matchesSearch = transacao.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transacao.categoria_id?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategoria = filterCategoria === "Todas" || transacao.categoria_id === filterCategoria;
      return matchesSearch && matchesCategoria;
    });
  }, [transacoes, searchTerm, filterCategoria]);

  const totalReceitas = useMemo(() => {
    return transacoesFiltradas
      .filter((item) => item.tipo_movimento === "entrada")
      .reduce((acc, item) => acc + Number(item.valor), 0);
  }, [transacoesFiltradas]);

  const totalDespesas = useMemo(() => {
    return transacoesFiltradas
      .filter((item) => item.tipo_movimento === "saida")
      .reduce((acc, item) => acc + Number(item.valor), 0);
  }, [transacoesFiltradas]);

  const saldoLiquido = totalReceitas - totalDespesas;

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-green-900/20 border-green-800">
          <CardContent className="p-6">
            <div>
              <p className="text-green-300 text-sm font-medium">Total Receitas</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(totalReceitas)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-900/20 border-red-800">
          <CardContent className="p-6">
            <div>
              <p className="text-red-300 text-sm font-medium">Total Despesas</p>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(totalDespesas)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className={`${saldoLiquido >= 0 ? 'bg-blue-900/20 border-blue-800' : 'bg-red-900/20 border-red-800'}`}>
          <CardContent className="p-6">
            <div>
              <p className={`text-sm font-medium ${saldoLiquido >= 0 ? 'text-blue-300' : 'text-red-300'}`}>
                Saldo Líquido
              </p>
              <p className={`text-2xl font-bold ${saldoLiquido >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {formatCurrency(saldoLiquido)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white">Filtros</CardTitle>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              type="month"
              value={mesAtual}
              onChange={(e) => setMesAtual(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white"
              />
            </div>
            
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
            >
              <option value="Todas">Todas categorias</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            Transações do Mês ({format(new Date(mesAtual + "-01"), "MMMM yyyy", { locale: ptBR })})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transacoesFiltradas.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Nenhuma transação encontrada para este período.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Data</TableHead>
                  <TableHead className="text-gray-300">Tipo</TableHead>
                  <TableHead className="text-gray-300">Descrição</TableHead>
                  <TableHead className="text-gray-300">Categoria</TableHead>
                  <TableHead className="text-gray-300">Observações</TableHead>
                  <TableHead className="text-gray-300">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacoesFiltradas.map((transacao) => (
                  <TableRow key={transacao.id} className="border-gray-700">
                    <TableCell className="text-gray-300">
                      {format(new Date(transacao.data), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {transacao.tipo_movimento === "entrada" ? (
                          <ArrowUpCircle className="w-4 h-4 text-green-400 mr-2" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-red-400 mr-2" />
                        )}
                        <span className={transacao.tipo_movimento === "entrada" ? "text-green-400" : "text-red-400"}>
                          {transacao.tipo_movimento === "entrada" ? "Entrada" : "Saída"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white font-medium">{transacao.descricao}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-gray-600 text-gray-300">
                        {getCategoriaName(transacao.categoria_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">{transacao.observacoes || "-"}</TableCell>
                    <TableCell className={`font-semibold ${transacao.tipo_movimento === "entrada" ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(Number(transacao.valor))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
