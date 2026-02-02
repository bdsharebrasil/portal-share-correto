import React, { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Filter, Trash2, Edit2, TrendingUp, TrendingDown, Calendar, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MovimentacaoBancariaDialog } from "@/components/fiscal/MovimentacaoBancariaDialog";

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function ControlFinanceiro() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isGestorMaster, isFinanceiroMaster } = useUserRole();
  const { categorias } = useCategoriasConta();
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    searchTerm: "",
    tipo: "all",
    categoria: "all",
    status: "all",
    mes: format(new Date(), "yyyy-MM")
  });

  const isAuthorized = isAdmin || isGestorMaster || isFinanceiroMaster;

  useEffect(() => {
    if (isAuthorized) {
      loadMovimentacoes();
    }
  }, [isAuthorized]);

  const loadMovimentacoes = async () => {
    if (!isAuthorized) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("*")
        .order("data", { ascending: false });

      if (error) {
        toast.error(`Erro ao carregar: ${error.message}`);
        return;
      }

      setMovimentacoes(data || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar movimentações");
    }
    setIsLoading(false);
  };

  const filteredMovimentacoes = useMemo(() => {
    return movimentacoes.filter(mov => {
      const searchMatch = filters.searchTerm === "" ||
        mov.descricao.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (mov.numero_documento && mov.numero_documento.toLowerCase().includes(filters.searchTerm.toLowerCase()));

      const tipoMatch = filters.tipo === "all" || mov.tipo_movimento === filters.tipo;
      const categoriaMatch = filters.categoria === "all" || mov.categoria === filters.categoria;
      const statusMatch = filters.status === "all" || mov.status === filters.status;
      const mesMatch = mov.data.startsWith(filters.mes);

      return searchMatch && tipoMatch && categoriaMatch && statusMatch && mesMatch;
    });
  }, [movimentacoes, filters]);

  const totals = useMemo(() => {
    const entradas = filteredMovimentacoes
      .filter(m => m.tipo_movimento === "entrada")
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    const saidas = filteredMovimentacoes
      .filter(m => m.tipo_movimento === "saída")
      .reduce((sum, m) => sum + parseFloat(m.valor), 0);

    return { entradas, saidas, saldo: entradas - saidas };
  }, [filteredMovimentacoes]);

  const handleEdit = (movimentacao: any) => {
    setEditingMovimentacao(movimentacao);
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      const { error } = await supabase
        .from("controle_bancario")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success("Movimentação deletada com sucesso!");
      setDeleteConfirmId(null);
      loadMovimentacoes();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const handleOpenDialog = (movimentacao?: any) => {
    setEditingMovimentacao(movimentacao || null);
    setShowDialog(true);
  };

  const getStatusColor = (status: string, tipoMovimento?: string) => {
    if (tipoMovimento === "entrada" && status === "pendente") {
      return "bg-orange-100 text-orange-800";
    }
    switch (status) {
      case "confirmado":
        return "bg-green-100 text-green-800";
      case "pendente":
        return "bg-yellow-100 text-yellow-800";
      case "cancelado":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!isAuthorized) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Card className="border-red-500">
            <CardContent className="pt-6">
              <p className="text-red-600 font-semibold">Acesso negado</p>
              <p className="text-sm text-gray-600 mt-2">Você não tem permissão para acessar esta página.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="bg-slate-800 text-white p-6 rounded-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Movimentações Bancárias</h1>
              <p className="text-blue-100 mt-1">Controle de entradas e saídas bancárias</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                onClick={() => navigate("/financeiro/config-movimentacoes")}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Configurar
              </Button>
              <Button
                onClick={() => handleOpenDialog()}
                className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Nova Movimentação
              </Button>
            </div>
          </div>
        </div>

        {/* Cards de Totais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entradas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {totals.entradas.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saídas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                R$ {totals.saidas.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totals.saldo >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                R$ {totals.saldo.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Filter className="w-5 h-5" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar descrição..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-10"
                />
              </div>

              <Select value={filters.tipo} onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saída">Saída</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.categoria} onValueChange={(value) => setFilters(prev => ({ ...prev, categoria: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {categorias.map(cat => (
                    <SelectItem key={cat.id} value={cat.nome}>{cat.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="month"
                value={filters.mes}
                onChange={(e) => setFilters(prev => ({ ...prev, mes: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Movimentações */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>
              Movimentações - {format(parseLocalDate(filters.mes + "-01"), "MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-32">
                <p className="text-gray-500">Carregando...</p>
              </div>
            ) : filteredMovimentacoes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Nenhuma movimentação encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovimentacoes.map((mov) => (
                        <tr
                          key={mov.id}
                          className="transition-colors"
                        >
                          <TableCell>{format(parseLocalDate(mov.data), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="font-medium">{mov.descricao}</TableCell>
                          <TableCell className="text-sm">{mov.categoria}</TableCell>
                          <TableCell>
                            <Badge variant={mov.tipo_movimento === "entrada" ? "default" : "destructive"}>
                              {mov.tipo_movimento === "entrada" ? "Entrada" : "Saída"}
                            </Badge>
                          </TableCell>
                          <TableCell className={`font-semibold ${mov.tipo_movimento === "entrada" ? "text-green-600" : "text-red-600"}`}>
                            {mov.tipo_movimento === "entrada" ? "+" : "-"}R$ {parseFloat(mov.valor).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(mov.status)}>
                              {mov.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(mov)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setDeleteConfirmId(mov.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </tr>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog para adicionar/editar */}
        <MovimentacaoBancariaDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          movimentacao={editingMovimentacao}
          onSuccess={loadMovimentacoes}
        />

        {/* Dialog de confirmação de exclusão */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">Deseja realmente deletar esta movimentação? Esta ação não pode ser desfeita.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Deletar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
