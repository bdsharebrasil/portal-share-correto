import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  Loader2,
  ChevronUp,
  ChevronDown,
  Trash2,
  BarChart3,
  Plus,
  Edit2,
  X,
  CreditCard,
  FileText,
  Receipt,
  Paperclip,
} from "lucide-react";
import { FilterCombobox } from "./FilterCombobox";
import { useControleBancario } from "@/hooks/useControleBancario";
import { useCategorias } from "@/hooks/useCategorias";
import { useCategoriasFinanceiro } from "@/hooks/useCategoriasFinanceiro";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAeronaves } from "@/hooks/useAeronaves";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FluxoCaixaInlineForm } from "./FluxoCaixaInlineForm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SortField = "data" | "tipo_movimento" | "valor" | null;
type SortDirection = "asc" | "desc";

export function FluxoCaixa() {
  const { user } = useAuth();
  const { data: transacoes, isLoading, error } = useControleBancario();
  const { data: categoriasData } = useCategorias();
  const { categorias: contasData } = useCategoriasFinanceiro();
  const { aeronaves } = useAeronaves();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipos, setFilterTipos] = useState<Set<string>>(new Set());
  const [filterCategorias, setFilterCategorias] = useState<Set<string>>(
    new Set()
  );
  const [filterGrupos, setFilterGrupos] = useState<Set<string>>(new Set());
  const [filterBancos, setFilterBancos] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showInlineForm, setShowInlineForm] = useState(false);
  const [editingMovimentacao, setEditingMovimentacao] = useState<any>(null);
  const [contasBancarias, setContasBancarias] = useState<any[]>([]);

  // Fetch contas bancárias para obter os bancos
  React.useEffect(() => {
    const fetchContasBancarias = async () => {
      const { data } = await supabase
        .from("contas_bancarias")
        .select("id, nome, banco")
        .eq("ativo", true)
        .order("banco");
      setContasBancarias(data || []);
    };
    fetchContasBancarias();
  }, []);

  // Grupos de categorias únicos
  const gruposCategorias = useMemo(() => {
    if (!Array.isArray(contasData)) return [];
    const grupos = [...new Set(contasData.map((c: any) => c.grupo_categoria).filter(Boolean))];
    return grupos.sort();
  }, [contasData]);

  // Categorias filtradas pelo grupo selecionado
  const categoriasDoGrupo = useMemo(() => {
    if (!Array.isArray(contasData)) return [];
    if (filterGrupos.size === 0) {
      return contasData.map((c: any) => c.nome);
    }
    return contasData
      .filter((c: any) => filterGrupos.has(c.grupo_categoria))
      .map((c: any) => c.nome);
  }, [contasData, filterGrupos]);

  const tipos: string[] = ["entrada", "saída"];
  // Bancos únicos da tabela contas_bancarias
  const bancos: string[] = useMemo(() => {
    const bancosUnicos = [...new Set(contasBancarias.map((c: any) => c.banco).filter(Boolean))];
    return bancosUnicos.sort();
  }, [contasBancarias]);
  const statusOptions: string[] = ["recebido", "pago", "pendente", "aguardando_reembolso", "cancelado"];

  const toggleFilter = (set: Set<string>, value: string) => {
    const newSet = new Set(set);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    return newSet;
  };

  const toggleSelectId = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (
      selectedIds.size === paginatedTransacoes.length &&
      paginatedTransacoes.length > 0
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransacoes.map((t: any) => t.id)));
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Mapeamento de conta para banco
  const contaToBanco = useMemo(() => {
    const mapping: Record<string, string> = {};
    contasBancarias.forEach((c: any) => {
      if (c.nome && c.banco) {
        mapping[c.nome] = c.banco;
      }
    });
    return mapping;
  }, [contasBancarias]);

  const filteredTransacoes = useMemo(() => {
    return (
      transacoes?.filter((transacao: any) => {
        const matchesSearch =
          transacao.descricao
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (transacao.numero_documento &&
            transacao.numero_documento
              .toLowerCase()
              .includes(searchTerm.toLowerCase()));
        const matchesTipo =
          filterTipos.size === 0 || filterTipos.has(transacao.tipo_movimento);
        const matchesGrupo =
          filterGrupos.size === 0 ||
          (transacao.grupo_categoria && filterGrupos.has(transacao.grupo_categoria));
        const matchesCategoria =
          filterCategorias.size === 0 ||
          filterCategorias.has(transacao.categoria);
        // Filtrar pelo banco usando o mapeamento conta -> banco
        const transacaoBanco = transacao.conta_banco ? contaToBanco[transacao.conta_banco] : null;
        const matchesBanco =
          filterBancos.size === 0 ||
          (transacaoBanco && filterBancos.has(transacaoBanco));
        const matchesStatus =
          filterStatus.size === 0 ||
          (transacao.status && filterStatus.has(transacao.status));

        return (
          matchesSearch &&
          matchesTipo &&
          matchesGrupo &&
          matchesCategoria &&
          matchesBanco &&
          matchesStatus
        );
      }) || []
    );
  }, [transacoes, searchTerm, filterTipos, filterGrupos, filterCategorias, filterBancos, filterStatus, contaToBanco]);

  const sortedTransacoes = useMemo(() => {
    const sorted = [...filteredTransacoes].sort((a: any, b: any) => {
      if (!sortField) return 0;

      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === "data") {
        aValue = new Date(a.data).getTime();
        bValue = new Date(b.data).getTime();
      } else if (sortField === "valor") {
        aValue = Number(a.valor);
        bValue = Number(b.valor);
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredTransacoes, sortField, sortDirection]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(sortedTransacoes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransacoes = sortedTransacoes.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const selectedTransacoes = sortedTransacoes.filter((t: any) =>
    selectedIds.has(t.id)
  );

  const getGroupedReport = () => {
    const grouped: {
      [key: string]: { total: number; count: number; status?: string };
    } = {};

    selectedTransacoes.forEach((t: any) => {
      const key = `${t.categoria} (${t.tipo_movimento})`;
      if (!grouped[key]) {
        grouped[key] = { total: 0, count: 0, status: t.status || "sem status" };
      }
      grouped[key].total += Number(t.valor);
      grouped[key].count += 1;
    });

    return grouped;
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("controle_bancario")
        .delete()
        .eq("id", id);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success("Movimentação deletada com sucesso!");
      setDeleteConfirmId(null);
      // Refetch data
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    }
  };

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return;

    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from("controle_bancario")
        .delete()
        .in("id", idsArray);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return;
      }

      toast.success(
        `${selectedIds.size} movimentação(ões) deletada(s) com sucesso!`
      );
      setSelectedIds(new Set());
      setCurrentPage(1);
      // Refetch data
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar movimentações");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "recebido":
        return "bg-purple-900/20 text-purple-400 border-purple-600";
      case "pago":
        return "bg-green-900/20 text-green-400 border-green-600";
      case "cancelado":
        return "bg-red-900/20 text-red-400 border-red-600";
      default:
        return "bg-gray-700 text-gray-300 border-gray-600";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 p-8">
        Erro ao carregar transações. Verifique suas permissões.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nova Movimentação Form */}
      {showInlineForm && (
        <Card className="bg-card/50 border-border/50 backdrop-blur-xl">
          <CardContent className="pt-6">
            <FluxoCaixaInlineForm
              onSuccess={() => {
                setShowInlineForm(false);
                setEditingMovimentacao(null);
                window.location.reload();
              }}
              onCancel={() => {
                setShowInlineForm(false);
                setEditingMovimentacao(null);
              }}
              movimentacao={editingMovimentacao}
            />
          </CardContent>
        </Card>
      )}

      {/* Filtros Card */}
      <Card className="bg-card/50 border-border/50 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg font-semibold text-foreground">
              Filtros
            </CardTitle>
            {!showInlineForm && (
              <Button
                onClick={() => setShowInlineForm(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                <Plus className="w-4 h-4" />
                Nova Movimentação
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar descrição ou documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50 border-border/60 text-foreground"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <FilterCombobox
              title="Tipo"
              options={tipos}
              selectedValues={filterTipos}
              onSelectionChange={(value) =>
                setFilterTipos(toggleFilter(filterTipos, value))
              }
              onClear={() => setFilterTipos(new Set())}
            />
            <FilterCombobox
              title="Grupo"
              options={gruposCategorias}
              selectedValues={filterGrupos}
              onSelectionChange={(value) =>
                setFilterGrupos(toggleFilter(filterGrupos, value))
              }
              onClear={() => setFilterGrupos(new Set())}
            />
            <FilterCombobox
              title="Categoria"
              options={categoriasDoGrupo}
              selectedValues={filterCategorias}
              onSelectionChange={(value) =>
                setFilterCategorias(toggleFilter(filterCategorias, value))
              }
              onClear={() => setFilterCategorias(new Set())}
            />
            <FilterCombobox
              title="Banco"
              options={bancos}
              selectedValues={filterBancos}
              onSelectionChange={(value) =>
                setFilterBancos(toggleFilter(filterBancos, value))
              }
              onClear={() => setFilterBancos(new Set())}
            />
            <FilterCombobox
              title="Status"
              options={statusOptions}
              selectedValues={filterStatus}
              onSelectionChange={(value) =>
                setFilterStatus(toggleFilter(filterStatus, value))
              }
              onClear={() => setFilterStatus(new Set())}
            />
          </div>
        </CardContent>
      </Card>

      {/* Transações Table Card */}
      <Card className="bg-card/50 border-border/50 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <CardTitle className="text-lg font-semibold text-foreground">
              Lista de Movimentações
            </CardTitle>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-blue-600 text-white">
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
                </Badge>
                <Button
                  onClick={() => setShowReport(!showReport)}
                  variant="outline"
                  className="bg-muted/50 border-border/60 text-foreground hover:bg-muted/80 gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Agrupar
                </Button>
                <Button
                  onClick={() => {
                    if (
                      confirm(
                        `Tem certeza que deseja excluir ${selectedIds.size} movimentação(ões)?`
                      )
                    ) {
                      handleDeleteMultiple();
                    }
                  }}
                  variant="outline"
                  className="bg-red-900/20 border-red-700/40 text-red-400 hover:bg-red-900/30 gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Deletar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showReport && selectedIds.size > 0 && (
            <div className="bg-blue-950/30 border border-blue-700/40 rounded-md p-4 mb-4">
              <h3 className="text-white font-semibold mb-3">Relatório Agrupado</h3>
              <div className="space-y-2">
                {Object.entries(getGroupedReport()).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between items-center bg-muted/30 p-2 rounded text-sm"
                  >
                    <span className="text-foreground/80">{key}</span>
                    <div className="flex gap-4 text-foreground">
                      <span>
                        {value.count} item{value.count !== 1 ? "ns" : ""}
                      </span>
                      <span className="font-semibold">
                        R${" "}
                        {value.total.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        paginatedTransacoes.length > 0 &&
                        selectedIds.size === paginatedTransacoes.length
                      }
                      onCheckedChange={() => toggleSelectAll()}
                      className="h-5 w-5"
                    />
                  </TableHead>
                  <TableHead
                    className="text-foreground/70 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("data")}
                  >
                    Data {renderSortIcon("data")}
                  </TableHead>
                  <TableHead
                    className="text-foreground/70 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("tipo_movimento")}
                  >
                    Tipo {renderSortIcon("tipo_movimento")}
                  </TableHead>
                  <TableHead className="text-foreground/70">Descrição</TableHead>
                  <TableHead className="text-foreground/70">Categoria</TableHead>
                  <TableHead
                    className="text-foreground/70 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort("valor")}
                  >
                    Valor {renderSortIcon("valor")}
                  </TableHead>
                  <TableHead className="text-foreground/70">Conta</TableHead>
                  <TableHead className="text-foreground/70">Aeronave</TableHead>
                  <TableHead className="text-foreground/70">Nº Doc</TableHead>
                  <TableHead className="text-foreground/70">Anexos</TableHead>
                  <TableHead className="text-foreground/70">Status</TableHead>
                  <TableHead className="text-right text-foreground/70">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransacoes.map((transacao: any) => {
                  const isEntrada =
                    transacao.tipo_movimento === "entrada";
                  const isSelected = selectedIds.has(transacao.id);

                  return (
                    <TableRow
                      key={transacao.id}
                      className={`border-border/40 ${
                        isSelected ? "bg-blue-900/20" : ""
                      }`}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectId(transacao.id)}
                          className="h-5 w-5"
                        />
                      </TableCell>
                      <TableCell className="text-foreground/80 whitespace-nowrap">
                        {(() => {
                          // Parse date string directly to avoid timezone issues
                          const dateStr = transacao.data;
                          if (dateStr && dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                            const [year, month, day] = dateStr.split('-').map(Number);
                            const date = new Date(year, month - 1, day);
                            return format(date, "dd/MM/yyyy", { locale: ptBR });
                          }
                          return format(new Date(transacao.data), "dd/MM/yyyy", { locale: ptBR });
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isEntrada ? (
                            <ArrowUpCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <ArrowDownCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span
                            className={
                              isEntrada
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {isEntrada ? "Entrada" : "Saída"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-white font-medium max-w-xs truncate">
                        {transacao.descricao}
                      </TableCell>
                      <TableCell className="text-foreground/80">
                        {transacao.categoria_nome || "-"}
                      </TableCell>
                      <TableCell
                        className={`font-semibold ${
                          isEntrada ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        R${" "}
                        {Number(transacao.valor).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-foreground/80">
                        {transacao.conta_banco ? (contaToBanco[transacao.conta_banco] || transacao.conta_banco) : "-"}
                      </TableCell>
                      <TableCell className="text-foreground/80">
                        {transacao.aeronave_registro || "-"}
                      </TableCell>
                      <TableCell className="text-foreground/80">
                        {transacao.numero_documento || "-"}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex items-center gap-1">
                            {transacao.comprovante_url && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a 
                                    href={transacao.comprovante_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                                  >
                                    <CreditCard className="w-4 h-4 text-green-400" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Comprovante</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {transacao.nf_url && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a 
                                    href={transacao.nf_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                                  >
                                    <FileText className="w-4 h-4 text-blue-400" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Nota Fiscal</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {transacao.recibo_url && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a 
                                    href={transacao.recibo_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                                  >
                                    <Receipt className="w-4 h-4 text-purple-400" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Recibo</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {transacao.boleto_url && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a 
                                    href={transacao.boleto_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-muted/50 transition-colors"
                                  >
                                    <Paperclip className="w-4 h-4 text-orange-400" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Boleto</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {!transacao.comprovante_url && !transacao.nf_url && !transacao.recibo_url && !transacao.boleto_url && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        {transacao.status ? (
                          <Badge
                            variant="outline"
                            className={getStatusColor(transacao.status)}
                          >
                            {transacao.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48"
                          >
                                            <DropdownMenuItem 
                                              className="cursor-pointer"
                                              onClick={() => {
                                                setEditingMovimentacao(transacao);
                                                setShowInlineForm(true);
                                              }}
                                            >
                                              <Edit2 className="w-4 h-4 mr-2" />
                                              <span>Editar</span>
                                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirmId(transacao.id)}
                              className="cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              <span>Deletar</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedTransacoes.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={12}
                      className="text-center text-foreground/40 py-8"
                    >
                      Nenhuma movimentação encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {sortedTransacoes.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-border/40">
              <div className="text-sm text-foreground/60">
                Exibindo {startIndex + 1} a{" "}
                {Math.min(startIndex + itemsPerPage, sortedTransacoes.length)} de{" "}
                {sortedTransacoes.length}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  className="bg-muted/30 border-border/60 hover:bg-muted/50"
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-2 px-4 py-2 text-foreground/80">
                  Página {currentPage} de {totalPages}
                </div>
                <Button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage >= totalPages}
                  variant="outline"
                  className="bg-muted/30 border-border/60 hover:bg-muted/50"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <span>Confirmar Exclusão</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-foreground/80 text-sm">
            Deseja realmente deletar esta movimentação? Esta ação não pode ser
            desfeita.
          </p>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="border-border/60 hover:bg-muted/50"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Deletar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
