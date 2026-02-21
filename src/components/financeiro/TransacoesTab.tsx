import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ArrowUpCircle, ArrowDownCircle, Loader2, ChevronUp, ChevronDown, Trash2, BarChart3 } from "lucide-react";
import { NovaTransacaoDialog } from "./NovaTransacaoDialog";
import { FilterCombobox } from "./FilterCombobox";
import { useControleBancario } from "@/hooks/useControleBancario";
import { useCategorias } from "@/hooks/useCategorias";
import { useContasBancarias } from "@/hooks/useContasBancarias";
import { format, parseISO } from "date-fns";

type SortField = "data" | "tipo_movimento" | "valor" | null;
type SortDirection = "asc" | "desc";

export function TransacoesTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipos, setFilterTipos] = useState<Set<string>>(new Set());
  const [filterCategorias, setFilterCategorias] = useState<Set<string>>(new Set());
  const [filterBancos, setFilterBancos] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReport, setShowReport] = useState(false);

  const { data: transacoes, isLoading, error } = useControleBancario();
  const { data: categoriasData } = useCategorias();
  const { data: contasBancarias } = useContasBancarias();

  const categoriasNomes = [...new Set(categoriasData?.map(c => c.nome) || [])];
  const tipos = [...new Set(categoriasData?.map(c => c.tipo).filter(Boolean) || [])];
  const bancos = contasBancarias?.map(c => c.banco).filter(Boolean) as string[] || [];
  const statusOptions = ['pendente', 'confirmado', 'recebido', 'pago', 'cancelado'];

  // Helper para buscar categoria por ID
  const getCategoriaById = (id: string) => {
    return categoriasData?.find(c => c.id === id);
  };

  const filteredTransacoes = transacoes?.filter(transacao => {
    const matchesSearch = transacao.descricao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = filterTipos.size === 0 || filterTipos.has(transacao.tipo_movimento);
    const categoria = getCategoriaById(transacao.categoria_id);
    const matchesCategoria = filterCategorias.size === 0 || (categoria && filterCategorias.has(categoria.nome));
    const matchesBanco = filterBancos.size === 0 || filterBancos.has(transacao.conta_banco);
    const matchesStatus = filterStatus.size === 0 || (transacao.status && filterStatus.has(transacao.status));
    return matchesSearch && matchesTipo && matchesCategoria && matchesBanco && matchesStatus;
  }) || [];

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const sortedTransacoes = [...filteredTransacoes].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: any = a[sortField as keyof typeof a];
    let bValue: any = b[sortField as keyof typeof b];

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

  const itemsPerPage = 10;
  const totalPages = Math.ceil(sortedTransacoes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransacoes = sortedTransacoes.slice(startIndex, startIndex + itemsPerPage);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ?
      <ChevronUp className="w-4 h-4 inline ml-1" /> :
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const selectedTransacoes = sortedTransacoes.filter(t => selectedIds.has(t.id));

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTransacoes.length && paginatedTransacoes.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTransacoes.map(t => t.id)));
    }
  };

  const getGroupedReport = () => {
    const grouped: { [key: string]: { total: number; count: number; status?: string } } = {};

    selectedTransacoes.forEach(t => {
      const categoria = getCategoriaById(t.categoria_id);
      const categoriaNome = categoria?.nome || 'Sem categoria';
      const key = `${categoriaNome} (${t.tipo_movimento})`;
      if (!grouped[key]) {
        grouped[key] = { total: 0, count: 0, status: t.status || 'sem status' };
      }
      grouped[key].total += Number(t.valor);
      grouped[key].count += 1;
    });

    return grouped;
  };

  const handleNovaTransacao = () => {
    // Refresh will happen automatically via react-query
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
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white">Filtros</CardTitle>
            <NovaTransacaoDialog onTransacaoCreated={handleNovaTransacao} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FilterCombobox
                title="Tipo"
                options={tipos}
                selectedValues={filterTipos}
                onSelectionChange={(value) => setFilterTipos(toggleFilter(filterTipos, value))}
                onClear={() => setFilterTipos(new Set())}
              />
              <FilterCombobox
                title="Categoria"
                options={categoriasNomes}
                selectedValues={filterCategorias}
                onSelectionChange={(value) => setFilterCategorias(toggleFilter(filterCategorias, value))}
                onClear={() => setFilterCategorias(new Set())}
              />
              <FilterCombobox
                title="Banco"
                options={bancos}
                selectedValues={filterBancos}
                onSelectionChange={(value) => setFilterBancos(toggleFilter(filterBancos, value))}
                onClear={() => setFilterBancos(new Set())}
              />
              <FilterCombobox
                title="Status"
                options={statusOptions}
                selectedValues={filterStatus}
                onSelectionChange={(value) => setFilterStatus(toggleFilter(filterStatus, value))}
                onClear={() => setFilterStatus(new Set())}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white">Lista de Transações</CardTitle>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-blue-600 text-white">
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                </Badge>
                <Button
                  onClick={() => setShowReport(!showReport)}
                  variant="outline"
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Agrupar
                </Button>
                <Button
                  onClick={() => {
                    if (confirm(`Tem certeza que deseja excluir ${selectedIds.size} transação(ões)?`)) {
                      alert('Funcionalidade de exclusão será implementada em breve!');
                      setSelectedIds(new Set());
                    }
                  }}
                  variant="outline"
                  className="bg-red-900/30 border-red-700 text-red-400 hover:bg-red-900/50 gap-2"
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
            <div className="bg-blue-950/30 border border-blue-700 rounded-md p-4 mb-4">
              <h3 className="text-white font-semibold mb-3">Relatório Agrupado</h3>
              <div className="space-y-2">
                {Object.entries(getGroupedReport()).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
                    <span className="text-gray-300">{key}</span>
                    <div className="flex gap-4 text-white">
                      <span>{value.count} item{value.count !== 1 ? 'ns' : ''}</span>
                      <span className="font-semibold">R$ {value.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="w-12">
                  <Checkbox
                    checked={paginatedTransacoes.length > 0 && selectedIds.size === paginatedTransacoes.length}
                    onCheckedChange={() => toggleSelectAll()}
                    className="h-5 w-5"
                  />
                </TableHead>
                <TableHead
                  className="text-gray-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("data")}
                >
                  Data {renderSortIcon("data")}
                </TableHead>
                <TableHead
                  className="text-gray-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("tipo_movimento")}
                >
                  Tipo {renderSortIcon("tipo_movimento")}
                </TableHead>
                <TableHead className="text-gray-300">Descrição</TableHead>
                <TableHead className="text-gray-300">Categoria</TableHead>
                <TableHead
                  className="text-gray-300 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("valor")}
                >
                  Valor {renderSortIcon("valor")}
                </TableHead>
                <TableHead className="text-gray-300">Conta</TableHead>
                <TableHead className="text-gray-300">Aeronave</TableHead>
                <TableHead className="text-gray-300">Número Doc.</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransacoes.map((transacao) => {
                const isEntrada = transacao.tipo_movimento === "Entrada";
                const isSelected = selectedIds.has(transacao.id);
                return (
                  <TableRow
                    key={transacao.id}
                    className={`border-gray-700 ${isSelected ? 'bg-blue-900/20' : ''}`}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectId(transacao.id)}
                        className="h-5 w-5"
                      />
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {format(parseISO(transacao.data), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {isEntrada ? (
                          <ArrowUpCircle className="w-4 h-4 text-green-400 mr-2" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-red-400 mr-2" />
                        )}
                        <span className={isEntrada ? "text-green-400" : "text-red-400"}>
                          {transacao.tipo_movimento}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white font-medium">{transacao.descricao}</TableCell>
                    <TableCell className="text-gray-300">
                      {(() => {
                        const categoria = getCategoriaById(transacao.categoria_id);
                        if (categoria) {
                          return (
                            <div className="flex flex-col">
                              {categoria.grupo_categoria && (
                                <span className="text-xs text-gray-500">{categoria.grupo_categoria}</span>
                              )}
                              <span>{categoria.nome}</span>
                            </div>
                          );
                        }
                        return '-';
                      })()}
                    </TableCell>
                    <TableCell className={`font-semibold ${isEntrada ? "text-green-400" : "text-red-400"}`}>
                      R$ {Number(transacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-gray-300">{transacao.conta_banco || '-'}</TableCell>
                    <TableCell className="text-gray-300">{transacao.aeronave_registro || '-'}</TableCell>
                    <TableCell className="text-gray-300">{transacao.numero_documento || '-'}</TableCell>
                    <TableCell>
                      {transacao.status ? (
                        <Badge
                          variant="outline"
                          className={`${
                            transacao.status === 'pendente' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-600' :
                            transacao.status === 'confirmado' ? 'bg-blue-900/20 text-blue-400 border-blue-600' :
                            transacao.status === 'recebido' ? 'bg-purple-900/20 text-purple-400 border-purple-600' :
                            transacao.status === 'pago' ? 'bg-green-900/20 text-green-400 border-green-600' :
                            transacao.status === 'cancelado' ? 'bg-red-900/20 text-red-400 border-red-600' :
                            'bg-gray-700 text-gray-300 border-gray-600'
                          }`}
                        >
                          {transacao.status}
                        </Badge>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedTransacoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-400 py-8">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {sortedTransacoes.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                Exibindo {startIndex + 1} a {Math.min(startIndex + itemsPerPage, sortedTransacoes.length)} de {sortedTransacoes.length}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  Página Anterior
                </Button>
                <div className="flex items-center gap-2 px-4 py-2 text-white">
                  Página {currentPage} de {totalPages}
                </div>
                <Button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                >
                  Próxima Página
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
