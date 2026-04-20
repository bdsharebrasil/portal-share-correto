import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AircraftMetricsFormProps {
  aircraftId: string;
  isReadOnly?: boolean;
}

export function AircraftMetricsForm({ aircraftId, isReadOnly = false }: AircraftMetricsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [metrics, setMetrics] = useState({
    cell_hours_before: 0,
    cell_hours_current: 0,
    cell_hours_prev: 0,
    horimeter_start: 0,
    horimeter_end: 0,
    horimeter_active: 0,
  });

  useEffect(() => {
    loadMetrics();
  }, [aircraftId]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('aircraft')
        .select('cell_hours_before, cell_hours_current, cell_hours_prev, horimeter_start, horimeter_end, horimeter_active')
        .eq('id', aircraftId)
        .single();

      if (error) throw error;
      if (data) setMetrics(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar métricas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('aircraft')
        .update(metrics)
        .eq('id', aircraftId);

      if (error) throw error;

      toast({
        title: "Métricas salvas",
        description: "As informações foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Informações da Aeronave</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cell_before" className="text-xs font-bold">CÉLULA ANTERIOR</Label>
            <Input
              id="cell_before"
              type="number"
              step="0.1"
              value={metrics.cell_hours_before}
              onChange={(e) => setMetrics({ ...metrics, cell_hours_before: parseFloat(e.target.value) || 0 })}
              disabled={isReadOnly}
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cell_current" className="text-xs font-bold">CÉLULA ATUAL</Label>
            <Input
              id="cell_current"
              type="number"
              step="0.1"
              value={metrics.cell_hours_current}
              onChange={(e) => setMetrics({ ...metrics, cell_hours_current: parseFloat(e.target.value) || 0 })}
              disabled={isReadOnly}
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cell_prev" className="text-xs font-bold">CÉLULA PREV.</Label>
            <Input
              id="cell_prev"
              type="number"
              step="0.1"
              value={metrics.cell_hours_prev}
              onChange={(e) => setMetrics({ ...metrics, cell_hours_prev: parseFloat(e.target.value) || 0 })}
              disabled={isReadOnly}
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horim_start" className="text-xs font-bold">HORÍMETRO INÍCIO</Label>
            <Input
              id="horim_start"
              type="number"
              step="0.1"
              value={metrics.horimeter_start}
              onChange={(e) => setMetrics({ ...metrics, horimeter_start: parseFloat(e.target.value) || 0 })}
              disabled={isReadOnly}
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horim_end" className="text-xs font-bold">HORÍMETRO FINAL</Label>
            <Input
              id="horim_end"
              type="number"
              step="0.1"
              value={metrics.horimeter_end}
              onChange={(e) => setMetrics({ ...metrics, horimeter_end: parseFloat(e.target.value) || 0 })}
              disabled={isReadOnly}
              className="h-8"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="horim_active" className="text-xs font-bold">HORÍMETRO ATIVO</Label>
            <Input
              id="horim_active"
              type="number"
              step="0.1"
              value={metrics.horimeter_active}
              onChange={(e) => setMetrics({ ...metrics, horimeter_active: parseFloat(e.target.value) || 0 })}
              disabled={isReadOnly}
              className="h-8"
            />
          </div>
        </div>
        {!isReadOnly && (
          <div className="mt-4">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Informações
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
