import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

interface AddAircraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraft?: Database["public"]["Tables"]["aircraft"]["Row"] | null;
}

export function AddAircraftDialog({ open, onOpenChange, aircraft }: AddAircraftDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    registration: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    owner_name: "",
    year: "",
    status: "Ativa",
    fuel_consumption: "",
    base: "",
  });

  useEffect(() => {
    if (aircraft) {
      setFormData({
        registration: aircraft.registration ?? "",
        manufacturer: aircraft.manufacturer ?? "",
        model: aircraft.model ?? "",
        serial_number: aircraft.serial_number ?? "",
        owner_name: aircraft.owner_name ?? "",
        year: "",
        status: aircraft.status ?? "Ativa",
        fuel_consumption: aircraft.fuel_consumption != null ? String(aircraft.fuel_consumption) : "",
        base: (aircraft as any).base ?? "",
      });
    } else if (open) {
      setFormData({
        registration: "",
        manufacturer: "",
        model: "",
        serial_number: "",
        owner_name: "",
        year: "",
        status: "Ativa",
        fuel_consumption: "",
        base: "",
      });
    }
  }, [aircraft, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (aircraft) {
        const { error } = await supabase
          .from('aircraft')
          .update({
            registration: formData.registration,
            manufacturer: formData.manufacturer,
            model: formData.model,
            serial_number: formData.serial_number,
            owner_name: formData.owner_name,
            status: formData.status,
            fuel_consumption: formData.fuel_consumption ? parseFloat(formData.fuel_consumption) : null,
            base: formData.base || null,
          })
          .eq('id', aircraft.id);
        if (error) throw error;
        toast({ title: "Sucesso!", description: "Aeronave atualizada com sucesso." });
      } else {
        const { error } = await supabase.from('aircraft').insert([{
          registration: formData.registration,
          manufacturer: formData.manufacturer,
          model: formData.model,
          serial_number: formData.serial_number,
          owner_name: formData.owner_name,
          year: formData.year || null,
          status: formData.status,
          fuel_consumption: formData.fuel_consumption ? parseFloat(formData.fuel_consumption) : null,
          base: formData.base || null,
        }]);
        if (error) throw error;
        toast({ title: "Sucesso!", description: "Aeronave cadastrada com sucesso." });
      }

      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || (aircraft ? "Erro ao atualizar aeronave." : "Erro ao cadastrar aeronave."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[520px] sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{aircraft ? 'Editar Aeronave' : 'Adicionar Nova Aeronave'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="registration">Matrícula *</Label>
            <Input
              id="registration"
              value={formData.registration}
              onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
              placeholder="PT-ABC"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante *</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="Cessna"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="172"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="serial_number">Número de Série *</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                placeholder="12345"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Ano</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value.replace(/[^0-9]/g, '').slice(0,4) })}
                placeholder="2020"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_name">Proprietário *</Label>
            <Input
              id="owner_name"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              placeholder="Nome do Proprietário"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base">Base</Label>
            <Input
              id="base"
              value={formData.base}
              onChange={(e) => setFormData({ ...formData, base: e.target.value })}
              placeholder="Ex.: SBRJ, SBCY ou cidade"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativa">Ativa</SelectItem>
                <SelectItem value="Inativa">Inativa</SelectItem>
                <SelectItem value="Manutenção">Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuel_consumption">Consumo Médio (L/H)</Label>
            <Input
              id="fuel_consumption"
              type="number"
              step="0.1"
              value={formData.fuel_consumption}
              onChange={(e) => setFormData({ ...formData, fuel_consumption: e.target.value })}
              placeholder="83"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (aircraft ? "Salvando..." : "Salvando...") : (aircraft ? "Atualizar" : "Salvar")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
