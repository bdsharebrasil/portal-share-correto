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

// Opções mapeadas de acordo com a Check Constraint do banco de dados
const COMPONENT_STATUS = [
  { value: "ok", label: "OK (Normal)" },
  { value: "attention", label: "Atenção (Próximo ao Vencimento)" },
  { value: "urgent", label: "Urgente" },
  { value: "expired", label: "Vencido" },
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
    
    // Limites
    total_life_hours: "",
    total_life_cycles: "",
    
    // Controle de Horas
    current_life_hours: "", // TSN
    tso: "", // Tempo desde Revisão
    
    // Controle de Ciclos
    csn: "", // Ciclos desde Novo
    cso: "", // Ciclos desde Revisão
    
    // Instalação e Datas
    installed_date: format(new Date(), "yyyy-MM-dd"),
    due_date: "", // Vencimento Calendário
    installed_hours: "",
    installed_cycles: "",
    
    status: "ok",
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
        total_life_cycles: formData.total_life_cycles ? parseInt(formData.total_life_cycles, 10) : null,
        
        current_life_hours: formData.current_life_hours ? parseFloat(formData.current_life_hours) : 0, // TSN
        tso: formData.tso !== "" ? parseFloat(formData.tso) : null,
        
        csn: formData.csn !== "" ? parseInt(formData.csn, 10) : null,
        cso: formData.cso !== "" ? parseInt(formData.cso, 10) : null,

        installed_date: formData.installed_date || null,
        due_date: formData.due_date || null,
        installed_hours: formData.installed_hours ? parseFloat(formData.installed_hours) : null,
        installed_cycles: formData.installed_cycles ? parseInt(formData.installed_cycles, 10) : null,
        
        status: formData.status || 'ok',
        observations: formData.observations || null,
      };

      const { data, error } = await supabase
        .from("components")
        .insert([componentData])
        .select()
        .single();

      if (error) throw error;

      toast.success(`Componente "${formData.name}" cadastrado com sucesso!`);
      onComponentCreated?.(data as unknown as Component);
      
      // Reset form
      setFormData({
        name: "", part_number: "", serial_number: "", category: "motor",
        manufacturer: "", location: "", total_life_hours: "", total_life_cycles: "",
        current_life_hours: "", tso: "", csn: "", cso: "",
        installed_date: format(new Date(), "yyyy-MM-dd"), due_date: "",
        installed_hours: "", installed_cycles: "", status: "ok", observations: "",
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Componente Aeronáutico</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Identificação do Componente */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Identificação do Componente</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Label htmlFor="nome">Nome do Componente *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Motor PT6A-42A"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="part_number">Part Number (P/N) *</Label>
                <Input
                  id="part_number"
                  placeholder="Ex: PT6A-42A"
                  value={formData.part_number}
                  onChange={(e) => handleChange("part_number", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="serial_number">Serial Number (S/N) *</Label>
                <Input
                  id="serial_number"
                  placeholder="Ex: PCE-RM0767"
                  value={formData.serial_number}
                  onChange={(e) => handleChange("serial_number", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Select value={formData.category} onValueChange={(val) => handleChange("category", val)}>
                  <SelectTrigger id="categoria">
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
              <div>
                <Label htmlFor="location">Posição / Localização</Label>
                <Input
                  id="location"
                  placeholder="Ex: Motor #1"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Limites de Vida Útil (TBO) */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Limites de Vida Útil (TBO)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="total_life_hours">TBO (Limite em Horas)</Label>
                <Input
                  id="total_life_hours"
                  type="number"
                  placeholder="Ex: 3600"
                  value={formData.total_life_hours}
                  onChange={(e) => handleChange("total_life_hours", e.target.value)}
                  min="0" step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="total_life_cycles">Limite de Ciclos</Label>
                <Input
                  id="total_life_cycles"
                  type="number"
                  placeholder="Ex: 10000"
                  value={formData.total_life_cycles}
                  onChange={(e) => handleChange("total_life_cycles", e.target.value)}
                  min="0" step="1"
                />
              </div>
            </div>
          </div>

          {/* Controle de Horas e Ciclos (Aeronáutico) */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Controle de Horas e Ciclos Atuais</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="current_life_hours">TSN (Horas Totais)</Label>
                <Input
                  id="current_life_hours"
                  type="number"
                  placeholder="Ex: 908.3"
                  value={formData.current_life_hours}
                  onChange={(e) => handleChange("current_life_hours", e.target.value)}
                  min="0" step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="tso">TSO (Horas Após Revisão)</Label>
                <Input
                  id="tso"
                  type="number"
                  placeholder="0 = NOVO"
                  value={formData.tso}
                  onChange={(e) => handleChange("tso", e.target.value)}
                  min="0" step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="csn">CSN (Ciclos Totais)</Label>
                <Input
                  id="csn"
                  type="number"
                  placeholder="Ex: 856"
                  value={formData.csn}
                  onChange={(e) => handleChange("csn", e.target.value)}
                  min="0" step="1"
                />
              </div>
              <div>
                <Label htmlFor="cso">CSO (Ciclos Após Revisão)</Label>
                <Input
                  id="cso"
                  type="number"
                  placeholder="0 = NOVO"
                  value={formData.cso}
                  onChange={(e) => handleChange("cso", e.target.value)}
                  min="0" step="1"
                />
              </div>
            </div>
          </div>

          {/* Datas e Vencimentos */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Instalação e Vencimento Calendário</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="installed_date">Data de Instalação na Célula</Label>
                <Input
                  id="installed_date"
                  type="data"
                  value={formData.installed_date}
                  onChange={(e) => handleChange("installed_date", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="data_vencimento">Data de Vencimento (Itens por Tempo)</Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => handleChange("due_date", e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ex: CVA, Extintor, ELT (Deixe em branco se controlado só por horas)
                </p>
              </div>
            </div>
          </div>

          {/* Status e Observações */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Status Operacional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="situacao">Condição do Componente</Label>
                <Select value={formData.status} onValueChange={(val) => handleChange("status", val)}>
                  <SelectTrigger id="situacao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPONENT_STATUS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="observacoes">Observações (MICCA / Etiqueta)</Label>
              <Textarea
                id="observacoes"
                placeholder="Insira notas sobre a etiqueta 8130-3, Ficha de Histórico ou observações gerais..."
                value={formData.observations}
                onChange={(e) => handleChange("observations", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Botões */}
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Componente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
