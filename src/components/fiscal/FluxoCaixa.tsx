import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, Filter, Trash2, Edit2, TrendingUp, TrendingDown, Wallet, ChevronDown, FileText, ExternalLink, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FluxoCaixaInlineForm } from "@/components/fiscal/FluxoCaixaInlineForm";

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function FluxoCaixa() {
  const { user } = useAuth();
  const { categorias: allCategorias } = useCategoriasFinanceiro();
  const categoriaNomes = allCategorias.map(c => c.nome);

  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Initialize with current month using explicit year/month to avoid timezone issues
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getCurrentYear = () => {
    return new Date().getFullYear().toString();
  };

  const [filters, setFilters] = useState({
    searchTerm: "",
    tipo: "all",
    categoria: "all",
    status: "all",
    periodo: "mes", // "mes" | "ano"
    mes: getCurrentMonth(),
    ano: getCurrentYear()
  });

  useEffect(() => {
    loadMovimentacoes();
  }, []);

  const loadMovimentacoes = async () => {
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

      // Period match - either month or year
      let periodoMatch = true;
      if (filters.periodo === "mes") {
        periodoMatch = mov.data.startsWith(filters.mes);
      } else if (filters.periodo === "ano") {
        periodoMatch = mov.data.startsWith(filters.ano);
      }

      return searchMatch && tipoMatch && categoriaMatch && statusMatch && periodoMatch;
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

  const handleOpenForm = (movimentacao?: any) => {
    setEditingMovimentacao(movimentacao || null);
    setShowInlineForm(true);
    setExpandedRows(new Set());
  };

  const handleCloseForm = () => {
    setShowInlineForm(false);
    setEditingMovimentacao(null);
  };

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "recebido":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pago":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "cancelado":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string, tipo: string) => {
    if (status === "recebido") return "Recebido";
    if (status === "pago") return "Pago";
    if (status === "cancelado") return "Cancelado";
    // Fallback para registros antigos
    if (status === "confirmado") return tipo === "entrada" ? "Recebido" : "Pago";
    if (status === "pendente") return tipo === "entrada" ? "Recebido" : "Pago";
    return status;
  };

  return (
    <div className="space-y-6 w-full">
      {/* Cards de Totais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <Card className="bg-card/50 border-2 border-blue-600/60 hover:border-blue-500/80 hover:bg-card/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:scale-102">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4 md:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground/90">Entradas</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/15">
              <TrendingUp className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 pb-4">
            <div className="text-2xl md:text-3xl font-bold text-blue-500">
              R$ {totals.entradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground/80 mt-2">Receitas do período</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-2 border-red-600/60 hover:border-red-500/80 hover:bg-card/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:scale-102">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4 md:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground/90">Saídas</CardTitle>
            <div className="p-2 rounded-lg bg-red-500/15">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 pb-4">
            <div className="text-2xl md:text-3xl font-bold text-red-500">
              R$ {totals.saidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground/80 mt-2">Despesas do período</p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-2 border-cyan-600/60 hover:border-cyan-500/80 hover:bg-card/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:scale-102">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-4 px-4 md:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground/90">Saldo do Mês</CardTitle>
            <div className="p-2 rounded-lg bg-cyan-500/15">
              <Wallet className="h-5 w-5 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 pb-4">
            <div className={`text-2xl md:text-3xl font-bold ${totals.saldo >= 0 ? "text-cyan-500" : "text-orange-500"}`}>
              R$ {totals.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground/80 mt-2">Diferença entre entradas e saídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <Card className="bg-gradient-to-br from-slate-900/50 to-slate-950/50 backdrop-blur-xl border-slate-700/50 w-full">
        <CardHeader className="pb-4 pt-5 px-4 sm:px-6 border-b border-slate-700/40">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/15">
                <Filter className="w-4 sm:w-5 h-4 sm:h-5 text-blue-400" />
              </div>
              <span>Filtros e Período</span>
            </CardTitle>
            <Button
              onClick={() => handleOpenForm()}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/30 transition-all duration-300 w-full sm:w-auto text-sm"
              disabled={showInlineForm}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Movimentação
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5 px-4 sm:px-6">
          {/* Período - Destaque */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 bg-slate-800/30 rounded-lg sm:rounded-xl border border-slate-700/40 backdrop-blur-sm">
            <span className="text-xs sm:text-sm font-medium text-foreground/90 whitespace-nowrap">Período:</span>
            <div className="flex gap-2">
              <Button
                variant={filters.periodo === "mes" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, periodo: "mes" }))}
                className={`text-xs min-w-[70px] transition-all duration-300 ${
                  filters.periodo === "mes"
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30"
                    : "border-slate-700/60 hover:bg-slate-800/50 text-foreground/80"
                }`}
              >
                Mês
              </Button>
              <Button
                variant={filters.periodo === "ano" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters(prev => ({ ...prev, periodo: "ano" }))}
                className={`text-xs min-w-[70px] transition-all duration-300 ${
                  filters.periodo === "ano"
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30"
                    : "border-slate-700/60 hover:bg-slate-800/50 text-foreground/80"
                }`}
              >
                Ano
              </Button>
            </div>

            {filters.periodo === "mes" ? (
              <Input
                type="month"
                value={filters.mes}
                onChange={(e) => setFilters(prev => ({ ...prev, mes: e.target.value }))}
                className="bg-slate-800/50 border-slate-700/60 text-foreground w-full sm:w-auto sm:min-w-[160px] text-xs sm:text-sm h-9 focus:border-blue-500/60"
              />
            ) : (
              <Select value={filters.ano} onValueChange={(value) => setFilters(prev => ({ ...prev, ano: value }))}>
                <SelectTrigger className="bg-slate-800/50 border-slate-700/60 text-foreground w-full sm:w-[130px] h-9 text-xs sm:text-sm focus:border-blue-500/60">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900/95 border-slate-700/50 backdrop-blur-xl">
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Outros Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="Buscar descrição..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="pl-10 bg-slate-800/50 border-slate-700/60 text-foreground placeholder:text-muted-foreground/50 focus:border-blue-500/60 h-11"
              />
            </div>

            <Select value={filters.tipo} onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value }))}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700/60 text-foreground h-11 focus:border-blue-500/60">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900/95 border-slate-700/50 backdrop-blur-xl">
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saída">Saída</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.categoria} onValueChange={(value) => setFilters(prev => ({ ...prev, categoria: value }))}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700/60 text-foreground h-11 focus:border-blue-500/60">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900/95 border-slate-700/50 backdrop-blur-xl">
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categoriaNomes.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700/60 text-foreground h-11 focus:border-blue-500/60">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900/95 border-slate-700/50 backdrop-blur-xl">
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Movimentações */}
      <Card className="bg-gradient-to-br from-slate-900/50 to-slate-950/50 backdrop-blur-xl border-slate-700/50 w-full">
        <CardHeader className="pb-4 pt-5 px-4 sm:px-6 border-b border-slate-700/40">
          <CardTitle className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/15">
              <Wallet className="w-5 h-5 text-cyan-400" />
            </div>
            Movimentações - {(() => {
              if (filters.periodo === "ano") {
                return `Ano ${filters.ano}`;
              }
              const [year, month] = filters.mes.split("-");
              return format(new Date(parseInt(year), parseInt(month) - 1, 15), "MMMM 'de' yyyy", { locale: ptBR });
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 w-full overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-muted-foreground text-sm">Carregando...</p>
            </div>
          ) : (
            <div className="space-y-0 w-full">
              {/* Cabeçalho Fixo - Desktop */}
              <div className="hidden lg:flex items-center gap-4 px-6 py-4 bg-slate-800/30 border-b border-slate-700/40 font-semibold text-sm text-muted-foreground/80 sticky top-0 z-10 backdrop-blur-sm">
                <div className="w-24 flex-shrink-0">Data Pgto</div>
                <div className="w-24 flex-shrink-0">Criação</div>
                <div className="flex-1 min-w-[180px]">Descrição</div>
                <div className="w-28 flex-shrink-0">Categoria</div>
                <div className="w-20 flex-shrink-0 text-center">Tipo</div>
                <div className="w-32 flex-shrink-0 text-right">Valor</div>
                <div className="w-24 flex-shrink-0">Banco</div>
                <div className="w-24 flex-shrink-0">Aeronave</div>
                <div className="w-20 flex-shrink-0 text-center">Status</div>
                <div className="w-28 flex-shrink-0 text-right">Ações</div>
              </div>

              {showInlineForm && (
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-700/40 bg-slate-800/20 space-y-4 backdrop-blur-sm">
                  <FluxoCaixaInlineForm
                    onSuccess={() => {
                      handleCloseForm();
                      loadMovimentacoes();
                    }}
                    onCancel={handleCloseForm}
                    movimentacao={editingMovimentacao}
                  />
                </div>
              )}

              {filteredMovimentacoes.length === 0 ? (
                <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
                  <Wallet className="w-16 sm:w-20 h-16 sm:h-20 text-muted-foreground/20 mx-auto mb-4 sm:mb-6" />
                  <p className="text-muted-foreground text-base sm:text-lg font-medium">Nenhuma movimentação encontrada</p>
                  <p className="text-muted-foreground text-xs sm:text-sm mt-2">Clique em "Nova Movimentação" para adicionar</p>
                </div>
              ) : (
                filteredMovimentacoes.map((mov) => {
                  const isExpanded = expandedRows.has(mov.id);
                  return (
                    <div key={mov.id} className="border-b border-slate-700/40 hover:bg-slate-800/30 transition-colors last:border-b-0 backdrop-blur-sm">
                      {/* Desktop Layout - Flex */}
                      <div className="hidden lg:flex items-center gap-4 px-6 py-4 text-sm">
                        <div className="w-24 flex-shrink-0 text-foreground font-medium">
                          {format(parseLocalDate(mov.data), "dd/MM/yyyy")}
                        </div>
                        <div className="w-24 flex-shrink-0 text-muted-foreground text-xs">
                          {mov.criado_em ? format(new Date(mov.criado_em), "dd/MM/yyyy") : "-"}
                        </div>
                        <div className="flex-1 min-w-[180px] font-medium text-foreground truncate" title={mov.descricao}>
                          {mov.descricao}
                        </div>
                        <div className="w-28 flex-shrink-0 text-muted-foreground/80 text-xs truncate" title={mov.categoria}>
                          {mov.categoria}
                        </div>
                        <div className="w-20 flex-shrink-0 flex justify-center">
                          <Badge className={`text-xs whitespace-nowrap font-medium ${
                            mov.tipo_movimento === "entrada"
                              ? "bg-blue-950/40 text-blue-400 border-blue-700/40"
                              : "bg-red-950/40 text-red-400 border-red-700/40"
                          }`}>
                            {mov.tipo_movimento === "entrada" ? "Entrada" : "Saída"}
                          </Badge>
                        </div>
                        <div className={`w-32 flex-shrink-0 text-right font-semibold whitespace-nowrap ${mov.tipo_movimento === "entrada" ? "text-blue-500" : "text-red-500"}`}>
                          {mov.tipo_movimento === "entrada" ? "+" : "-"}R$ {parseFloat(mov.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="w-24 flex-shrink-0 text-muted-foreground/80 text-xs truncate" title={mov.conta_banco || "-"}>
                          {mov.conta_banco || "-"}
                        </div>
                        <div className="w-24 flex-shrink-0 text-muted-foreground/80 text-xs">
                          {mov.aeronave || "-"}
                        </div>
                        <div className="w-20 flex-shrink-0 flex justify-center">
                          <Badge className={`text-xs whitespace-nowrap font-medium border ${getStatusColor(mov.status)}`}>
                            {getStatusLabel(mov.status, mov.tipo_movimento)}
                          </Badge>
                        </div>
                        <div className="w-28 flex-shrink-0 flex gap-1 justify-end items-center">
                          {mov.referencia && (mov.referencia.startsWith('nf_entrada_') || mov.referencia.startsWith('nf_saida_')) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const isEntrada = mov.referencia.startsWith('nf_entrada_');
                                toast.info(`Origem: ${isEntrada ? 'Nota Fiscal de Entrada' : 'Nota Fiscal de Saída'}`, {
                                  description: `Documento: ${mov.numero_documento || 'N/A'}`
                                });
                              }}
                              className="h-8 w-8 p-0 text-blue-500 hover:bg-blue-500/15 hover:text-blue-400 transition-all duration-300"
                              title={mov.referencia.startsWith('nf_entrada_') ? 'Ver NF Entrada' : 'Ver NF Saída'}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          {mov.comprovante_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(mov.comprovante_url, '_blank')}
                              className="h-8 w-8 p-0 text-cyan-500 hover:bg-cyan-500/15 hover:text-cyan-400 transition-all duration-300"
                              title="Ver comprovante"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenForm(mov)}
                            className="h-8 w-8 p-0 text-muted-foreground/80 hover:text-foreground hover:bg-slate-700/30 transition-all duration-300"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/15 hover:text-red-400 transition-all duration-300"
                            onClick={() => setDeleteConfirmId(mov.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Mobile/Tablet Layout - Card */}
                      <div className="lg:hidden px-4 py-4">
                        <button
                          onClick={() => toggleRowExpand(mov.id)}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-sm mb-2 line-clamp-2">
                                {mov.descricao}
                              </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <span>Pgto: {format(parseLocalDate(mov.data), "dd/MM/yyyy")}</span>
                                {mov.criado_em && (
                                  <>
                                    <span>•</span>
                                    <span>Criação: {format(new Date(mov.criado_em), "dd/MM/yy")}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 ml-2 flex-shrink-0">
                              <span className={`font-semibold text-sm whitespace-nowrap ${mov.tipo_movimento === "entrada" ? "text-blue-500" : "text-red-500"}`}>
                                {mov.tipo_movimento === "entrada" ? "+" : "-"}R$ {parseFloat(mov.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <Badge className={`${getStatusColor(mov.status)} text-xs`}>
                                {getStatusLabel(mov.status, mov.tipo_movimento)}
                              </Badge>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform mt-1 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                        </button>

                        {/* Expanded Details - Mobile/Tablet */}
                        {isExpanded && (
                          <div className="mt-3 pt-4 border-t border-slate-700/40 space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground/80 font-medium mb-1">Tipo</p>
                                <Badge className={`text-xs font-medium border ${
                                  mov.tipo_movimento === "entrada"
                                    ? "bg-blue-950/40 text-blue-400 border-blue-700/40"
                                    : "bg-red-950/40 text-red-400 border-red-700/40"
                                }`}>
                                  {mov.tipo_movimento === "entrada" ? "Entrada" : "Saída"}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-muted-foreground/80 font-medium mb-1">Banco</p>
                                <p className="text-foreground text-xs">{mov.conta_banco || "-"}</p>
                              </div>
                            </div>

                            {mov.numero_documento && (
                              <div>
                                <p className="text-muted-foreground/80 text-xs font-medium mb-1">Nº Documento</p>
                                <p className="text-foreground text-xs">{mov.numero_documento}</p>
                              </div>
                            )}

                            {mov.referencia && (
                              <div>
                                <p className="text-muted-foreground/80 text-xs font-medium mb-1">Referência</p>
                                <p className="text-foreground text-xs">{mov.referencia}</p>
                              </div>
                            )}

                            {mov.aeronave && (
                              <div>
                                <p className="text-muted-foreground/80 text-xs font-medium mb-1">Aeronave</p>
                                <p className="text-foreground text-xs">{mov.aeronave}</p>
                              </div>
                            )}

                            {mov.observacoes && (
                              <div>
                                <p className="text-muted-foreground/80 text-xs font-medium mb-1">Observações</p>
                                <p className="text-foreground text-xs">{mov.observacoes}</p>
                              </div>
                            )}

                            <div className="flex gap-2 pt-3 border-t border-slate-700/40">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenForm(mov)}
                                className="flex-1 text-xs h-8 border-slate-700/60 hover:bg-slate-800/50"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-10 p-0 border-red-700/40 text-red-500 hover:bg-red-500/15 hover:text-red-400"
                                onClick={() => setDeleteConfirmId(mov.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="w-[90%] sm:w-full bg-gradient-to-br from-slate-900/95 to-slate-950/95 border-slate-700/50 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <span>Confirmar Exclusão</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground/80 text-sm">Deseja realmente deletar esta movimentação? Esta ação não pode ser desfeita.</p>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="w-full sm:w-auto border-slate-700/60 hover:bg-slate-800/50 text-foreground/80"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-500/30 transition-all duration-300"
            >
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
