import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VencimentoDialogProps {
  onAdd?: (vencimento: any) => void;
}

export function VencimentoDialog({ onAdd }: VencimentoDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    aeronave: "",
    item: "",
    dataVencimento: "",
    periodoTipo: "horas",
    periodoValor: "",
    diasAlerta: "7"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.aeronave || !formData.item || !formData.dataVencimento) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const novoVencimento = {
      id: Date.now(),
      aeronave: formData.aeronave,
      item: formData.item,
      dataVencimento: formData.dataVencimento,
      periodoTipo: formData.periodoTipo,
      periodoValor: formData.periodoValor ? parseInt(formData.periodoValor) : null,
      diasAlerta: parseInt(formData.diasAlerta),
      status: "pendente",
      diasRestantes: Math.ceil((new Date(formData.dataVencimento).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    };

    onAdd?.(novoVencimento);
    
    toast({
      title: "Vencimento cadastrado",
      description: "O vencimento foi adicionado com sucesso"
    });

    setFormData({
      aeronave: "",
      item: "",
      dataVencimento: "",
      periodoTipo: "horas",
      periodoValor: "",
      diasAlerta: "7"
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Vencimento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Vencimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aeronave">Aeronave *</Label>
            <Input
              id="aeronave"
              placeholder="Ex: PT-ABC"
              value={formData.aeronave}
              onChange={(e) => setFormData({ ...formData, aeronave: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item">Nome da Manutenção *</Label>
            <Input
              id="item"
              placeholder="Ex: Inspeção 100h"
              value={formData.item}
              onChange={(e) => setFormData({ ...formData, item: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataVencimento">Data de Vencimento *</Label>
            <Input
              id="dataVencimento"
              type="date"
              value={formData.dataVencimento}
              onChange={(e) => setFormData({ ...formData, dataVencimento: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodoTipo">Tipo de Período</Label>
              <Select
                value={formData.periodoTipo}
                onValueChange={(value) => setFormData({ ...formData, periodoTipo: value })}
              >
                <SelectTrigger id="periodoTipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horas">Horas de Voo</SelectItem>
                  <SelectItem value="dias">Dias Corridos</SelectItem>
                  <SelectItem value="meses">Meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="periodoValor">Periodicidade</Label>
              <Input
                id="periodoValor"
                type="number"
                placeholder="Ex: 50, 100"
                value={formData.periodoValor}
                onChange={(e) => setFormData({ ...formData, periodoValor: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diasAlerta">Alertar com quantos dias de antecedência?</Label>
            <Select
              value={formData.diasAlerta}
              onValueChange={(value) => setFormData({ ...formData, diasAlerta: value })}
            >
              <SelectTrigger id="diasAlerta">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 dias</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Cadastrar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
