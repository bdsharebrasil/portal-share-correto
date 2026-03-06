import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { fetchAircrafts, createMaintenance } from "@/services/maintenance";
import { useToast } from "@/hooks/use-toast";

interface Aircraft {
  id: string;
  registration: string;
}

interface NovoVencimentoDialogProps {
  onSave?: () => void;
}

export function NovoVencimentoDialog({ onSave }: NovoVencimentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    aeronave_id: "",
    tipo: "",
    dataVencimento: "",
    diasAlerta: "30",
    vencimentoTipo: "data", // "data" ou "horas"
    vencimentoHoras: "",
  });

  useEffect(() => {
    if (open) {
      loadAircrafts();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.aeronave_id || !formData.tipo) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos obrigatórios.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Validar campos específicos por tipo
      if (formData.vencimentoTipo === "data" && !formData.dataVencimento) {
        toast({
          title: "Erro",
          description: "Informe a data de vencimento.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (formData.vencimentoTipo === "horas" && !formData.vencimentoHoras) {
        toast({
          title: "Erro",
          description: "Informe as horas até a próxima revisão.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      await createMaintenance({
        aeronave_id: formData.aeronave_id,
        tipo: formData.tipo,
        data_programada: formData.vencimentoTipo === "data" ? formData.dataVencimento : undefined,
        mecanico: "Sistema",
        etapa: "aguardando",
        vencimento_tipo: formData.vencimentoTipo,
        vencimento_horas: formData.vencimentoTipo === "horas" ? parseFloat(formData.vencimentoHoras) : undefined,
      });

      toast({
        title: "Sucesso",
        description: "Vencimento cadastrado com sucesso.",
      });

      setFormData({
        aeronave_id: "",
        tipo: "",
        dataVencimento: "",
        diasAlerta: "30",
        vencimentoTipo: "data",
        vencimentoHoras: "",
      });

      onSave?.();
      setOpen(false);
    } catch (error) {
      console.error("Erro ao salvar vencimento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o vencimento.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Vencimento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-slate-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Novo Vencimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="aeronave" className="text-gray-300">
              Aeronave *
            </Label>
            <Select
              value={formData.aeronave_id}
              onValueChange={(value) =>
                setFormData({ ...formData, aeronave_id: value })
              }
            >
              <SelectTrigger
                id="aeronave"
                className="bg-slate-800 border-white/10 text-white"
              >
                <SelectValue placeholder="Selecione uma aeronave" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-white/10">
                {aircrafts.map((aircraft) => (
                  <SelectItem
                    key={aircraft.id}
                    value={aircraft.id}
                    className="text-white"
                  >
                    {aircraft.registration}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-gray-300">
              Descrição do Vencimento *
            </Label>
            <Input
              id="tipo"
              placeholder="Ex: Seguro, CA, RVSM, Inspeção 100h"
              value={formData.tipo}
              onChange={(e) =>
                setFormData({ ...formData, tipo: e.target.value })
              }
              className="bg-slate-800 border-white/10 text-white placeholder-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">
              Tipo de Vencimento *
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.vencimentoTipo === "data" ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, vencimentoTipo: "data" })}
                className="flex-1"
              >
                Por Data
              </Button>
              <Button
                type="button"
                variant={formData.vencimentoTipo === "horas" ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, vencimentoTipo: "horas" })}
                className="flex-1"
              >
                Por Horas
              </Button>
            </div>
          </div>

          {formData.vencimentoTipo === "data" && (
            <div className="space-y-2">
              <Label htmlFor="dataVencimento" className="text-gray-300">
                Data de Vencimento *
              </Label>
              <Input
                id="dataVencimento"
                type="date"
                value={formData.dataVencimento}
                onChange={(e) =>
                  setFormData({ ...formData, dataVencimento: e.target.value })
                }
                className="bg-slate-800 border-white/10 text-white"
              />
            </div>
          )}

          {formData.vencimentoTipo === "horas" && (
            <div className="space-y-2">
              <Label htmlFor="vencimentoHoras" className="text-gray-300">
                Horas até Próxima Revisão *
              </Label>
              <Input
                id="vencimentoHoras"
                type="number"
                step="0.1"
                placeholder="Ex: 100, 500, 2000"
                value={formData.vencimentoHoras}
                onChange={(e) =>
                  setFormData({ ...formData, vencimentoHoras: e.target.value })
                }
                className="bg-slate-800 border-white/10 text-white placeholder-gray-500"
              />
              <p className="text-xs text-gray-400">
                Valor total de horas até a próxima manutenção programada
              </p>
            </div>
          )}

          {formData.vencimentoTipo === "data" && (
            <div className="space-y-2">
              <Label htmlFor="diasAlerta" className="text-gray-300">
                Alertar com quantos dias?
              </Label>
              <Select
                value={formData.diasAlerta}
                onValueChange={(value) =>
                  setFormData({ ...formData, diasAlerta: value })
                }
              >
                <SelectTrigger
                  id="diasAlerta"
                  className="bg-slate-800 border-white/10 text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/10">
                  <SelectItem value="7" className="text-white">
                    7 dias
                  </SelectItem>
                  <SelectItem value="15" className="text-white">
                    15 dias
                  </SelectItem>
                  <SelectItem value="30" className="text-white">
                    30 dias
                  </SelectItem>
                  <SelectItem value="60" className="text-white">
                    60 dias
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="bg-slate-800 border-white/10 text-gray-300 hover:bg-slate-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {loading ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
