import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Component, COMPONENT_CATEGORIES, ComponentCategory } from "@/types/ctm";
import { useAircraftComponents } from "@/hooks/useCTMData";
import { NewComponentDialog } from "./NewComponentDialog";
import { Search, AlertTriangle, CheckCircle, Clock, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ComponentMapProps {
  aircraftId: string;
}

export function CTMComponentMap({ aircraftId }: ComponentMapProps) {
  const { data: components = [], isLoading, refetch: refetchComponents } = useAircraftComponents(aircraftId);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ComponentCategory | "all">("all");
  const [showNewComponent, setShowNewComponent] = useState(false);

  const handleComponentCreated = () => {
    refetchComponents();
  };

  const categorizedComponents = useMemo(() => {
    let filtered = components;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchLower) ||
        c.part_number.toLowerCase().includes(searchLower) ||
        c.serial_number.toLowerCase().includes(searchLower)
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(c => c.category === categoryFilter);
    }

    return filtered;
  }, [components, search, categoryFilter]);

  const getStatusColor = (percentage: number | null | undefined) => {
    if (percentage === null || percentage === undefined) return "bg-muted text-muted-foreground";
    if (percentage <= 10) return "bg-red-500/20 text-red-500";
    if (percentage <= 25) return "bg-yellow-500/20 text-yellow-500";
    return "bg-green-500/20 text-green-500";
  };

  const getStatusIcon = (percentage: number | null | undefined) => {
    if (percentage === null || percentage === undefined) return <Clock className="h-4 w-4 text-muted-foreground" />;
    if (percentage <= 10) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (percentage <= 25) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getRowBgClass = (percentage: number | null | undefined) => {
    if (percentage === null || percentage === undefined) return "";
    if (percentage <= 10) return "bg-red-500/5 hover:bg-red-500/10";
    if (percentage <= 25) return "bg-yellow-500/5 hover:bg-yellow-500/10";
    return "";
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <span className="text-muted-foreground">Carregando componentes...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Mapa de Componentes</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Controle de componentes aeronáuticos e TBO
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowNewComponent(true)}>
          <Plus className="h-4 w-4" />
          Novo Componente
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, P/N ou S/N..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ComponentCategory | "all")}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {COMPONENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Component Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <TableHead>Componente</TableHead>
                <TableHead>P/N</TableHead>
                <TableHead>S/N</TableHead>
                <TableHead className="text-center">TBO (h)</TableHead>
                <TableHead className="text-center">TSN (h)</TableHead>
                <TableHead className="text-center">Restante</TableHead>
                <TableHead>Data Instalação</TableHead>
                <TableHead>Fabricante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorizedComponents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {components.length === 0 
                      ? "Nenhum componente cadastrado para esta aeronave"
                      : "Nenhum componente encontrado com os filtros aplicados"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                categorizedComponents.map((comp) => (
                  <TableRow 
                    key={comp.id} 
                    className={`cursor-pointer ${getRowBgClass(comp.remaining_percentage)}`}
                  >
                    <TableCell>
                      {getStatusIcon(comp.remaining_percentage)}
                    </TableCell>
                    <TableCell className="font-medium">{comp.name}</TableCell>
                    <TableCell className="font-mono text-sm">{comp.part_number}</TableCell>
                    <TableCell className="font-mono text-sm">{comp.serial_number}</TableCell>
                    <TableCell className="text-center">
                      {comp.total_life_hours?.toLocaleString("pt-BR") || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {comp.current_life_hours?.toLocaleString("pt-BR", { minimumFractionDigits: 1 }) || "0"}
                    </TableCell>
                    <TableCell className="text-center">
                      {comp.remaining_hours !== null && comp.remaining_hours !== undefined ? (
                        <Badge className={getStatusColor(comp.remaining_percentage)}>
                          {comp.remaining_hours.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}h
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {comp.installed_date 
                        ? format(new Date(comp.installed_date), "dd/MM/yyyy", { locale: ptBR })
                        : "-"
                      }
                    </TableCell>
                    <TableCell className="text-muted-foreground">{comp.manufacturer || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>TBO &gt; 25%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>TBO 10-25%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>TBO &lt; 10%</span>
          </div>
        </div>
      </CardContent>

      {/* New Component Dialog */}
      <NewComponentDialog
        open={showNewComponent}
        onOpenChange={setShowNewComponent}
        aircraftId={aircraftId}
        onComponentCreated={handleComponentCreated}
      />
    </Card>
  );
}
