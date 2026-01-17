import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';

interface CTMSearchFilterProps {
  onSearch: (query: string) => void;
  onStatusFilter: (status: string) => void;
  onTypeFilter: (type: string) => void;
  onReset: () => void;
}

export function CTMSearchFilter({
  onSearch,
  onStatusFilter,
  onTypeFilter,
  onReset,
}: CTMSearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    onStatusFilter(value);
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    onTypeFilter(value);
  };

  const handleReset = () => {
    setSearchQuery('');
    setStatusFilter('');
    setTypeFilter('');
    onReset();
  };

  const hasFilters = searchQuery || statusFilter || typeFilter;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por número de OS, descrição, ou mecânico..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowFilters(!showFilters)}
        className="gap-2"
      >
        <Filter className="h-4 w-4" />
        Filtros
        {hasFilters && <span className="ml-1 text-xs font-bold">({[searchQuery, statusFilter, typeFilter].filter(Boolean).length})</span>}
      </Button>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select value={typeFilter} onValueChange={handleTypeChange}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="corretiva">Corretiva</SelectItem>
                  <SelectItem value="preventiva">Preventiva</SelectItem>
                  <SelectItem value="revisao">Revisão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Button */}
            {hasFilters && (
              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="w-full text-xs"
                >
                  Limpar Filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
