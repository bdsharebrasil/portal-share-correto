import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Loader2 } from "lucide-react";
import { fetchAircrafts, createMaintenance, updateMaintenance } from "@/services/maintenance";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Manutencao {
  id: string;
  tipo: string;
  aeronave_id: string | null;
  data_programada: string;
  mecanico: string;
  etapa: string;
  oficina?: string | null;
  observacoes?: string | null;
  custo_estimado?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface Aircraft {
  id: string;
  registration: string;
}

interface Oficina {
  id: string;
  razao_social: string;
}

interface ManutencaoDialogProps {
  manutencao?: Manutencao;
  onSave: (manutencao: Manutencao) => void;
  mode?: "create" | "edit";
}

export function ManutencaoDialog({ manutencao, onSave, mode = "create" }: ManutencaoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<Manutencao>(
    manutencao || {
      id: "",
      tipo: "",
      aeronave_id: null,
      data_programada: "",
      mecanico: "",
      etapa: "aguardando",
      oficina: "",
      observacoes: "",
      custo_estimado: 0,
    }
  );

  useEffect(() => {
    if (open) {
      loadAircrafts();
      loadOficinas();
      // Inicializar formData com os dados da manutenção existente se em modo edit
      if (manutencao) {
        setFormData(manutencao);
      }
    }
  }, [open]);

  const loadAircrafts = async () => {
    try {
      const list = await fetchAircrafts();
      setAircrafts(list);
    } catch (error) {
      console.error("Erro ao carregar aeronaves:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as aeronaves.",
        variant: "destructive",
      });
    }
  };

  const loadOficinas = async () => {
    try {
      const { data, error } = await supabase
        .from("oficinas")
        .select("id, razao_social")
        .eq("ativo", true)
        .order("razao_social");

      if (error) throw error;
      setOficinas(data || []);
    } catch (error) {
      console.error("Erro ao carregar oficinas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as oficinas.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.tipo || !formData.data_programada || !formData.mecanico) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const payload = {
        tipo: formData.tipo,
        aeronave_id: formData.aeronave_id,
        data_programada: formData.data_programada,
        mecanico: formData.mecanico,
        etapa: formData.etapa,
        oficina: formData.oficina,
        observacoes: formData.observacoes,
        custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado.toString()) : null,
      };

      if (mode === "edit" && manutencao?.id) {
        await updateMaintenance(manutencao.id, payload as any);

        toast({
          title: "Sucesso",
          description: "Manutenção atualizada com sucesso.",
        });
      } else {
        const data = await createMaintenance(payload as any) as any[];
        if (data && data[0]?.id) {
          (formData as any).id = data[0].id;
        }

        toast({
          title: "Sucesso",
          description: "Manutenção criada com sucesso.",
        });
      }

      onSave(formData);
      setOpen(false);
    } catch (error) {
      console.error("Erro ao salvar manutenção:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a manutenção.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "edit" ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Manutenção
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar Manutenção" : "Nova Manutenção"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Manutenção*</Label>
              <Input
                id="tipo"
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                placeholder="Ex: Inspeção 50h"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aeronave_id">Aeronave</Label>
              <Select
                value={formData.aeronave_id || ""}
                onValueChange={(value) => setFormData({ ...formData, aeronave_id: value })}
              >
                <SelectTrigger id="aeronave_id">
                  <SelectValue placeholder="Selecione uma aeronave" />
                </SelectTrigger>
                <SelectContent>
                  {aircrafts.map((aircraft) => (
                    <SelectItem key={aircraft.id} value={aircraft.id}>
                      {aircraft.registration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataProgramada">Data Programada*</Label>
              <Input
                id="dataProgramada"
                type="date"
                value={formData.data_programada}
                onChange={(e) => setFormData({ ...formData, data_programada: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mecanico">Mecânico Responsável*</Label>
              <Input
                id="mecanico"
                value={formData.mecanico}
                onChange={(e) => setFormData({ ...formData, mecanico: e.target.value })}
                placeholder="Nome do mecânico"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="etapa">Etapa</Label>
              <Select value={formData.etapa} onValueChange={(value) => setFormData({ ...formData, etapa: value })}>
                <SelectTrigger id="etapa">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aguardando">Aguardando</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oficina">Oficina</Label>
              <Select
                value={formData.oficina || ""}
                onValueChange={(value) => setFormData({ ...formData, oficina: value })}
              >
                <SelectTrigger id="oficina">
                  <SelectValue placeholder="Selecione uma oficina" />
                </SelectTrigger>
                <SelectContent>
                  {oficinas.map((oficina) => (
                    <SelectItem key={oficina.id} value={oficina.razao_social}>
                      {oficina.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custoEstimado">Custo Estimado (R$)</Label>
            <Input
              id="custoEstimado"
              type="number"
              value={formData.custo_estimado || ""}
              onChange={(e) => setFormData({ ...formData, custo_estimado: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes || ""}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Adicione observações importantes sobre esta manutenção..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
