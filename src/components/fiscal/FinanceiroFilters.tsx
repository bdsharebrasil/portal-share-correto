// @ts-nocheck
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, SlidersHorizontal, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

export interface FinanceiroFilterState {
  search: string;
  status: string;
  dateRange: DateRange | undefined;
  amountRange: [number, number];
  source: string;
}

interface FinanceiroFiltersProps {
  filters: FinanceiroFilterState;
  onFiltersChange: (filters: FinanceiroFilterState) => void;
  resultCount: number;
  maxAmount: number;
  isMobile?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pago', label: 'Pago' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'aguardando_reembolso', label: 'Aguardando' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'cancelado', label: 'Cancelado' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'Entrada e Saída' },
  { value: 'entrada', label: 'Entrada' },
  { value: 'saída', label: 'Saída' },
];

export const FinanceiroFilters = ({
  filters,
  onFiltersChange,
  resultCount,
  maxAmount,
  isMobile: isMobileProps,
}: FinanceiroFiltersProps) => {
  const [searchInput, setSearchInput] = useState(filters.search);
  const debouncedSearch = useDebounce(searchInput, 300);
  const [isMobile, setIsMobile] = useState(isMobileProps ?? false);

  useEffect(() => {
    if (!isMobileProps) {
      setIsMobile(window.innerWidth < 768);
      const handler = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handler);
      return () => window.removeEventListener('resize', handler);
    }
  }, [isMobileProps]);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFiltersChange({ ...filters, search: debouncedSearch });
    }
  }, [debouncedSearch, filters, onFiltersChange]);

  const activeFilterCount = [
    filters.status !== 'all',
    filters.dateRange?.from,
    filters.amountRange[0] > 0 || filters.amountRange[1] < maxAmount,
    filters.source !== 'all',
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchInput('');
    onFiltersChange({
      search: '',
      status: 'all',
      dateRange: undefined,
      amountRange: [0, maxAmount],
      source: 'all',
    });
  };

  const removeFilter = (key: keyof FinanceiroFilterState) => {
    const updated = { ...filters };
    if (key === 'status') updated.status = 'all';
    if (key === 'dateRange') updated.dateRange = undefined;
    if (key === 'amountRange') updated.amountRange = [0, maxAmount];
    if (key === 'source') updated.source = 'all';
    onFiltersChange(updated);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const FilterControls = () => (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
          Tipo
        </label>
        <Select value={filters.source} onValueChange={(v) => onFiltersChange({ ...filters, source: v })}>
          <SelectTrigger className="bg-card/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
          Status
        </label>
        <Select value={filters.status} onValueChange={(v) => onFiltersChange({ ...filters, status: v })}>
          <SelectTrigger className="bg-card/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
          Faixa de Valor: {formatCurrency(filters.amountRange[0])} — {formatCurrency(filters.amountRange[1])}
        </label>
        <Slider
          min={0}
          max={maxAmount || 100000}
          step={100}
          value={filters.amountRange}
          onValueChange={(v: number[]) => onFiltersChange({ ...filters, amountRange: v as [number, number] })}
          className="mt-3"
        />
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
          Período
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left bg-card/50 border-border/50">
              <CalendarDays className="h-4 w-4 mr-2" />
              {filters.dateRange?.from
                ? `${format(filters.dateRange.from, 'dd/MM/yy', { locale: ptBR })} — ${filters.dateRange?.to
                  ? format(filters.dateRange.to, 'dd/MM/yy', { locale: ptBR })
                  : '...'
                }`
                : 'Selecionar período'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={filters.dateRange}
              onSelect={(range) => onFiltersChange({ ...filters, dateRange: range })}
              numberOfMonths={isMobile ? 1 : 2}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Search bar + Filter button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar descrição ou documento..."
            className="pl-10 bg-card/50 border-border/50 backdrop-blur-sm"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {isMobile ? (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative bg-card/50 border-border/50">
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filtros</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterControls />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 bg-card/50 border-border/50">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <FilterControls />
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Active filter chips + result count */}
      <div className="flex items-center gap-2 flex-wrap">
        <motion.span
          key={resultCount}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xs text-muted-foreground"
        >
          <span className="font-semibold text-foreground">{resultCount}</span> transações encontradas
        </motion.span>

        <AnimatePresence>
          {filters.source !== 'all' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => removeFilter('source')}
              >
                Tipo: {SOURCE_OPTIONS.find((o) => o.value === filters.source)?.label}
                <X className="h-3 w-3" />
              </Badge>
            </motion.div>
          )}
          {filters.status !== 'all' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => removeFilter('status')}
              >
                Status: {STATUS_OPTIONS.find((o) => o.value === filters.status)?.label}
                <X className="h-3 w-3" />
              </Badge>
            </motion.div>
          )}
          {filters.dataRange?.from && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => removeFilter('dateRange')}
              >
                Período: {format(filters.dataRange.from, 'dd/MM', { locale: ptBR })} —{' '}
                {filters.dataRange.to ? format(filters.dataRange.to, 'dd/MM', { locale: ptBR }) : '...'}
                <X className="h-3 w-3" />
              </Badge>
            </motion.div>
          )}
          {(filters.valorRange[0] > 0 || filters.valorRange[1] < maxAmount) && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Badge
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => removeFilter('amountRange')}
              >
                Valor: {formatCurrency(filters.valorRange[0])} — {formatCurrency(filters.valorRange[1])}
                <X className="h-3 w-3" />
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={clearAllFilters}>
            Limpar todos
          </Button>
        )}
      </div>
    </div>
  );
};