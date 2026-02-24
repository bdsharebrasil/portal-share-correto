import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Component, COMPONENT_CATEGORIES, ComponentCategory } from "@/types/ctm";
import { format } from "date-fns";

interface NewComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  onComponentCreated?: (component: Component) => void;
}

const COMPONENT_STATUS = [
  "NOVO",
  "INSTALADO",
  "FUNCIONANDO",
  "DESGASTADO",
  "DANIFICADO",
  "EM_REPARO",
  "INATIVO",
];

export function NewComponentDialog({
  open,
  onOpenChange,
  aircraftId,
  onComponentCreated,
}: NewComponentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    part_number: "",
    serial_number: "",
    category: "motor" as ComponentCategory,
    manufacturer: "",
    location: "",
    total_life_hours: "",
    total_life_cycles: "",
    installed_date: format(new Date(), "yyyy-MM-dd"),
    installed_hours: "",
    installed_cycles: "",
    current_life_hours: "",
    current_life_cycles: "",
    status: "NOVO",
    observations: "",
  });

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name) {
      toast.error("Nome do componente é obrigatório");
      return false;
    }
    if (!formData.part_number) {
      toast.error("Número de peça (P/N) é obrigatório");
      return false;
    }
    if (!formData.serial_number) {
      toast.error("Número de série (S/N) é obrigatório");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const componentData = {
        aircraft_id: aircraftId,
        name: formData.name,
        part_number: formData.part_number,
        serial_number: formData.serial_number,
        category: formData.category || null,
        manufacturer: formData.manufacturer || null,
        location: formData.location || null,
        total_life_hours: formData.total_life_hours ? parseFloat(formData.total_life_hours) : null,
        total_life_cycles: formData.total_life_cycles ? parseFloat(formData.total_life_cycles) : null,
        installed_date: formData.installed_date,
        installed_hours: formData.installed_hours ? parseFloat(formData.installed_hours) : null,
        installed_cycles: formData.installed_cycles ? parseFloat(formData.installed_cycles) : null,
        current_life_hours: formData.current_life_hours ? parseFloat(formData.current_life_hours) : null,
        current_life_cycles: formData.current_life_cycles ? parseFloat(formData.current_life_cycles) : null,
        status: formData.status || null,
        observations: formData.observations || null,
      };

      const { data, error } = await supabase
        .from("components")
        .insert([componentData])
        .select()
        .single();

      if (error) throw error;

      toast.success(`Componente "${formData.name}" cadastrado com sucesso!`);
      onComponentCreated?.(data as Component);
      
      // Reset form
      setFormData({
        name: "",
        part_number: "",
        serial_number: "",
        category: "motor",
        manufacturer: "",
        location: "",
        total_life_hours: "",
        total_life_cycles: "",
        installed_date: format(new Date(), "yyyy-MM-dd"),
        installed_hours: "",
        installed_cycles: "",
        current_life_hours: "",
        current_life_cycles: "",
        status: "NOVO",
        observations: "",
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao cadastrar componente:", error);
      toast.error(error.message || "Erro ao cadastrar componente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Componente Aeronáutico</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação do Componente */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Identificação do Componente</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="name">Nome do Componente *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Motor PT6A-20"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="part_number">Número de Peça (P/N) *</Label>
                <Input
                  id="part_number"
                  placeholder="Ex: PT6A-20"
                  value={formData.part_number}
                  onChange={(e) => handleChange("part_number", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="serial_number">Número de Série (S/N) *</Label>
                <Input
                  id="serial_number"
                  placeholder="Ex: PSE-7X1234"
                  value={formData.serial_number}
                  onChange={(e) => handleChange("serial_number", e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Informações Técnicas */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Informações Técnicas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Categoria do Componente</Label>
                <Select value={formData.category} onValueChange={(val) => handleChange("category", val)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="manufacturer">Fabricante</Label>
                <Input
                  id="manufacturer"
                  placeholder="Ex: Pratt & Whitney"
                  value={formData.manufacturer}
                  onChange={(e) => handleChange("manufacturer", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="location">Localização na Aeronave</Label>
              <Input
                id="location"
                placeholder="Ex: Pylon Esquerdo"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
              />
            </div>
          </div>

          {/* Vida Útil Total */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Vida Útil Total (TBO)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="total_life_hours">TBO em Horas</Label>
                <Input
                  id="total_life_hours"
                  type="number"
                  placeholder="Ex: 2000"
                  value={formData.total_life_hours}
                  onChange={(e) => handleChange("total_life_hours", e.target.value)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="total_life_cycles">TBO em Ciclos</Label>
                <Input
                  id="total_life_cycles"
                  type="number"
                  placeholder="Ex: 5000"
                  value={formData.total_life_cycles}
                  onChange={(e) => handleChange("total_life_cycles", e.target.value)}
                  min="0"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* Instalação */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Dados de Instalação</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="installed_date">Data de Instalação *</Label>
                <Input
                  id="installed_date"
                  type="date"
                  value={formData.installed_date}
                  onChange={(e) => handleChange("installed_date", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="installed_hours">Horas na Instalação</Label>
                <Input
                  id="installed_hours"
                  type="number"
                  placeholder="Ex: 1000"
                  value={formData.installed_hours}
                  onChange={(e) => handleChange("installed_hours", e.target.value)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="installed_cycles">Ciclos na Instalação</Label>
                <Input
                  id="installed_cycles"
                  type="number"
                  placeholder="Ex: 500"
                  value={formData.installed_cycles}
                  onChange={(e) => handleChange("installed_cycles", e.target.value)}
                  min="0"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* Horas e Ciclos Atuais */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Horas e Ciclos Atuais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="current_life_hours">Total de Horas (TSN)</Label>
                <Input
                  id="current_life_hours"
                  type="number"
                  placeholder="Ex: 1500"
                  value={formData.current_life_hours}
                  onChange={(e) => handleChange("current_life_hours", e.target.value)}
                  min="0"
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="current_life_cycles">Total de Ciclos (CSN)</Label>
                <Input
                  id="current_life_cycles"
                  type="number"
                  placeholder="Ex: 750"
                  value={formData.current_life_cycles}
                  onChange={(e) => handleChange("current_life_cycles", e.target.value)}
                  min="0"
                  step="1"
                />
              </div>
            </div>
          </div>

          {/* Status e Observações */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Status do Componente</Label>
                <Select value={formData.status} onValueChange={(val) => handleChange("status", val)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_STATUS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="observations">Observações</Label>
              <Textarea
                id="observations"
                placeholder="Adicione observações relevantes sobre o componente..."
                value={formData.observations}
                onChange={(e) => handleChange("observations", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Botões */}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar Componente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
