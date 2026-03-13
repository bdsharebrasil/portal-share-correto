import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";

interface OS {
  id: number;
  numero: string;
  tipo: string;
  aeronave: string;
  data: string;
  mecanico: string;
  status: string;
  descricao: string;
}

interface OSDialogProps {
  os?: OS;
  onSave: (os: OS) => void;
  mode?: "create" | "edit";
}

export function OSDialog({ os, onSave, mode = "create" }: OSDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<OS>(
    os || {
      id: Date.now(),
      numero: "",
      tipo: "",
      aeronave: "",
      data: "",
      mecanico: "",
      status: "pendente",
      descricao: "",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setOpen(false);
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
            Nova O.S
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número da O.S*</Label>
              <Input
                id="numero"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="Ex: OS-2025-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Manutenção*</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manutenção Preventiva">Manutenção Preventiva</SelectItem>
                  <SelectItem value="Manutenção Corretiva">Manutenção Corretiva</SelectItem>
                  <SelectItem value="Inspeção">Inspeção</SelectItem>
                  <SelectItem value="Reparo">Reparo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="aeronave">Aeronave*</Label>
              <Input
                id="aeronave"
                value={formData.aeronave}
                onChange={(e) => setFormData({ ...formData, aeronave: e.target.value })}
                placeholder="Ex: PT-ABC"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data*</Label>
              <Input
                id="data"
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="status">Status*</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição*</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva os serviços realizados ou a realizar..."
              rows={4}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
