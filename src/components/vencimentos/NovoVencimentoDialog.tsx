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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Aircraft {
  id: string;
  registration: string;
}

interface Oficina {
  id: string;
  razao_social: string;
}

interface NovoVencimentoDialogProps {
  onSave?: () => void;
}

export function NovoVencimentoDialog({ onSave }: NovoVencimentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    aeronave_id: "",
    tipo: "",
    descricao: "",
    dataVencimento: "",
    diasAlerta: "30",
    vencimentoTipo: "data",
    vencimentoHoras: "",
    oficina: "",
    tipoManutencao: "PREVENTIVA" as string,
  });

  useEffect(() => {
    if (open) {
      loadAircrafts();
      loadOficinas();
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
      const { data, error } = await (supabase as any)
        .from("oficinas")
        .select("id, razao_social")
        .eq("ativo", true)
        .order("razao_social");
      if (error) throw error;
      setOficinas(data || []);
    } catch (error) {
      console.error("Erro ao carregar oficinas:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.aeronave_id || !formData.tipo) {
        toast({
          title: "Erro",
          description: "Preencha aeronave e tipo de vencimento.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

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

      // Get selected oficina name
      const selectedOficina = oficinas.find(o => o.id === formData.oficina);
      const oficinaNome = selectedOficina?.razao_social || "";

      // 1. Create maintenance record
      await createMaintenance({
        aeronave_id: formData.aeronave_id,
        tipo: formData.tipo,
        data_programada: formData.vencimentoTipo === "data" ? formData.dataVencimento : new Date().toISOString().split("T")[0],
        mecanico: "Sistema",
        etapa: formData.vencimentoTipo === "horas" ? "em_andamento" : "aguardando",
        oficina: oficinaNome || undefined,
        observacoes: `${formData.descricao || ''} | vencimento_tipo: ${formData.vencimentoTipo}${formData.vencimentoTipo === "horas" ? ` | vencimento_horas: ${formData.vencimentoHoras}` : ''}`,
      });

      // 2. Create CTM service order for hour-based maintenance
      if (formData.vencimentoTipo === "horas") {
        try {
          const aircraft = aircrafts.find(a => a.id === formData.aeronave_id);
          const horasValue = parseFloat(formData.vencimentoHoras);
          const osNumero = `MNT-${horasValue}H-${Date.now().toString().slice(-6)}`;

          const today = new Date();
          const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          const serviceOrderData = {
            aeronave_id: formData.aeronave_id,
            numero: osNumero,
            tipo_manutencao: formData.tipoManutencao,
            oficina_nome: oficinaNome || null,
            horas_celula: horasValue,
            objetivo: formData.tipo,
            observacoes: formData.descricao || `Manutenção de ${horasValue}h - ${formData.tipo}`,
            status: "EM_ANDAMENTO",
            data_entrada: todayString,
          };

          const { error: ctmError } = await supabase
            .from("service_orders")
            .insert([serviceOrderData]);

          if (ctmError) {
            console.error("Erro ao criar O.S. no CTM:", ctmError);
          } else {
            console.log(`✅ O.S. ${osNumero} criada no CTM para ${aircraft?.matricula}`);
          }
        } catch (ctmErr) {
          console.error("Erro ao registrar no CTM:", ctmErr);
        }
      }

      toast({
        title: "Sucesso",
        description: "Vencimento cadastrado com sucesso.",
      });

      setFormData({
        aeronave_id: "",
        tipo: "",
        descricao: "",
        dataVencimento: "",
        diasAlerta: "30",
        vencimentoTipo: "data",
        vencimentoHoras: "",
        oficina: "",
        tipoManutencao: "PREVENTIVA",
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
                    key={aeronave.id}
                    value={aeronave.id}
                    className="text-white"
                  >
                    {aeronave.matricula}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo" className="text-gray-300">
              Tipo de Vencimento *
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
            <Label htmlFor="descricao" className="text-gray-300">
              Descrição (opcional)
            </Label>
            <Input
              id="descricao"
              placeholder="Detalhes adicionais..."
              value={formData.descricao}
              onChange={(e) =>
                setFormData({ ...formData, descricao: e.target.value })
              }
              className="bg-slate-800 border-white/10 text-white placeholder-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Oficina</Label>
            <Select
              value={formData.oficina}
              onValueChange={(value) =>
                setFormData({ ...formData, oficina: value })
              }
            >
              <SelectTrigger className="bg-slate-800 border-white/10 text-white">
                <SelectValue placeholder="Selecione uma oficina" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-white/10">
                {oficinas.map((oficina) => (
                  <SelectItem
                    key={oficina.id}
                    value={oficina.id}
                    className="text-white"
                  >
                    {oficina.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Controle de Vencimento *</Label>
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

          {formData.vencimentoTipo === "horas" && (
            <div className="space-y-2">
              <Label className="text-gray-300">Tipo de Manutenção</Label>
              <Select
                value={formData.tipoManutencao}
                onValueChange={(value) =>
                  setFormData({ ...formData, tipoManutencao: value })
                }
              >
                <SelectTrigger className="bg-slate-800 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-white/10">
                  <SelectItem value="PREVENTIVA" className="text-white">Preventiva</SelectItem>
                  <SelectItem value="CORRETIVO" className="text-white">Corretiva</SelectItem>
                  <SelectItem value="50HORAS" className="text-white">50 Horas</SelectItem>
                  <SelectItem value="100HORAS" className="text-white">100 Horas</SelectItem>
                  <SelectItem value="REVISÃO" className="text-white">Revisão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.vencimentoTipo === "data" && (
            <div className="space-y-2">
              <Label htmlFor="dataVencimento" className="text-gray-300">
                Data de Vencimento *
              </Label>
              <Input
                id="dataVencimento"
                type="data"
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
                  <SelectItem value="7" className="text-white">7 dias</SelectItem>
                  <SelectItem value="15" className="text-white">15 dias</SelectItem>
                  <SelectItem value="30" className="text-white">30 dias</SelectItem>
                  <SelectItem value="60" className="text-white">60 dias</SelectItem>
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
