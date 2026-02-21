import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download, FileText, Filter, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCategorias } from "@/hooks/useCategorias";

interface RelatorioItem {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  valor: number;
  mes: string;
  tipo: "Entrada" | "Saída";
}

const mesesNomes = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function RelatoriosAvancados() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMes, setFilterMes] = useState("Todos");
  const [filterCategoria, setFilterCategoria] = useState("Todas");
  const [filterTipo, setFilterTipo] = useState("Todos");
  const { toast } = useToast();
  const { data: categoriasData } = useCategorias();

  const getCategoriaName = (id: string | null) => {
    if (!id || !categoriasData) return "Sem categoria";
    return categoriasData.find(c => c.id === id)?.nome || "Sem categoria";
  };

  // Buscar dados reais do controle bancário
  const { data: relatorios = [], isLoading } = useQuery({
    queryKey: ["relatorios-financeiros"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("*")
        .order("data", { ascending: false });

      if (error) throw error;

      return (data || []).map((item): RelatorioItem => {
        const dataObj = new Date(item.data);
        const mesIndex = dataObj.getMonth();

        return {
          id: item.id,
          data: item.data,
          categoria: getCategoriaName(item.categoria_id),
          descricao: item.descricao,
          valor: Math.abs(item.valor),
          mes: mesesNomes[mesIndex],
          tipo: item.tipo_movimento === "entrada" ? "Entrada" : "Saída"
        };
      });
    }
  });

  // Extrair categorias e meses únicos dos dados reais
  const categorias = useMemo(() => {
    const cats = new Set(relatorios.map(item => item.categoria));
    return ["Todas", ...Array.from(cats)];
  }, [relatorios]);

  const meses = useMemo(() => {
    const m = new Set(relatorios.map(item => item.mes));
    return ["Todos", ...Array.from(m)];
  }, [relatorios]);

  const filteredRelatorios = useMemo(() => {
    return relatorios.filter(item => {
      const matchesSearch = item.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMes = filterMes === "Todos" || item.mes === filterMes;
      const matchesCategoria = filterCategoria === "Todas" || item.categoria === filterCategoria;
      const matchesTipo = filterTipo === "Todos" || item.tipo === filterTipo;
      return matchesSearch && matchesMes && matchesCategoria && matchesTipo;
    });
  }, [relatorios, searchTerm, filterMes, filterCategoria, filterTipo]);

  const totalEntradas = useMemo(() => 
    filteredRelatorios
      .filter(item => item.tipo === "Entrada")
      .reduce((sum, item) => sum + item.valor, 0),
    [filteredRelatorios]
  );

  const totalSaidas = useMemo(() => 
    filteredRelatorios
      .filter(item => item.tipo === "Saída")
      .reduce((sum, item) => sum + item.valor, 0),
    [filteredRelatorios]
  );

  const saldoTotal = totalEntradas - totalSaidas;

  const handleExportPDF = () => {
    toast({
      title: "Exportando PDF",
      description: "O relatório está sendo gerado e será baixado em breve.",
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando relatórios...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-foreground flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filtros de Relatório
            </CardTitle>
            <Button 
              onClick={handleExportPDF}
              variant="destructive"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterMes} onValueChange={setFilterMes}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por mês" />
              </SelectTrigger>
              <SelectContent>
                {meses.map(mes => (
                  <SelectItem key={mes} value={mes}>{mes}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map(categoria => (
                  <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os tipos</SelectItem>
                <SelectItem value="Entrada">Entrada</SelectItem>
                <SelectItem value="Saída">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-green-600/20 border-green-600/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-400">Total de Entradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-600/20 border-red-600/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-400">Total de Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className={`${saldoTotal >= 0 ? 'bg-blue-600/20 border-blue-600/50' : 'bg-orange-600/20 border-orange-600/50'}`}>
          <CardHeader className="pb-2">
            <CardTitle className={`text-sm ${saldoTotal >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              Saldo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoTotal >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              R$ {saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {filteredRelatorios.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Relatórios */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            Relatórios Financeiros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRelatorios.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">{formatDate(item.data)}</TableCell>
                  <TableCell className="text-muted-foreground">{item.mes}</TableCell>
                  <TableCell className="text-muted-foreground">{item.categoria}</TableCell>
                  <TableCell className="text-foreground font-medium">{item.descricao}</TableCell>
                  <TableCell>
                    <Badge variant={item.tipo === "Entrada" ? "default" : "destructive"}>
                      {item.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-semibold ${item.tipo === "Entrada" ? "text-green-400" : "text-red-400"}`}>
                    R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredRelatorios.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum relatório encontrado com os filtros aplicados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
