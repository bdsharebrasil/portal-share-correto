import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface FilterSectionProps {
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (date: string) => void;
  onDataFimChange: (date: string) => void;
  categorias: string[];
  categoriasPermitidas: Set<string>;
  onCategoriaChange: (categoria: string, checked: boolean) => void;
  onClearFilters: () => void;
}

export function FilterSection({
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
  categorias,
  categoriasPermitidas,
  onCategoriaChange,
  onClearFilters,
}: FilterSectionProps) {
  return (
    <Card className="bg-card/80 border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtro de Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Data Inicial</Label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => onDataInicioChange(e.target.value)}
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground">Data Final</Label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => onDataFimChange(e.target.value)}
              className="bg-background border-border"
            />
          </div>
        </div>

        {/* Filtro de Categorias */}
        <div className="space-y-3">
          <Label className="text-muted-foreground">Categorias</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categorias.map((categoria) => (
              <div key={categoria} className="flex items-center space-x-2">
                <Checkbox
                  id={categoria}
                  checked={categoriasPermitidas.has(categoria)}
                  onCheckedChange={(checked) =>
                    onCategoriaChange(categoria, checked as boolean)
                  }
                />
                <label
                  htmlFor={categoria}
                  className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                >
                  {categoria}
                </label>
              </div>
            ))}
          </div>
          {categorias.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Nenhuma categoria disponível
            </p>
          )}
        </div>

        {/* Botão para limpar filtros */}
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="border-border"
        >
          Limpar Filtros
        </Button>
      </CardContent>
    </Card>
  );
}
