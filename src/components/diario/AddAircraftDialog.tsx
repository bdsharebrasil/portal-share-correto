import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Trash2, AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

interface AddAircraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraft?: Database["public"]["Tables"]["aeronave"]["Row"] | null;
}

export function AddAircraftDialog({ open, onOpenChange, aircraft }: AddAircraftDialogProps) {
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    registration: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    owner_name: "",
    year: "",
    status: "ativa",
    fuel_consumption: "",
    base: "",
  });

  useEffect(() => {
    if (aircraft) {
      setFormData({
        registration: aircraft.matricula ?? "",
        manufacturer: aircraft.fabricante ?? "",
        model: aircraft.modelo ?? "",
        serial_number: aircraft.numero_serie ?? "",
        owner_name: aircraft.nome_proprietario ?? "",
        year: aircraft.ano ?? "",
        status: aircraft.status ?? "ativa",
        fuel_consumption: aircraft.consumo_combustivel != null ? String(aircraft.consumo_combustivel) : "",
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
        status: "ativa",
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
          .from('aeronave')
          .update({
            matricula: formData.registration,
            fabricante: formData.manufacturer,
            modelo: formData.model,
            numero_serie: formData.serial_number,
            nome_proprietario: formData.owner_name,
            status: formData.status,
            consumo_combustivel: formData.fuel_consumption ? parseFloat(formData.fuel_consumption) : null,
            base: formData.base || null,
          })
          .eq('id', aircraft.id);
        if (error) throw error;
        toast({ title: "Sucesso!", description: "Aeronave atualizada com sucesso." });
      } else {
        const { data: insertedAircraft, error } = await supabase.from('aeronave').insert([{
          matricula: formData.registration,
          fabricante: formData.manufacturer,
          modelo: formData.model,
          numero_serie: formData.serial_number,
          nome_proprietario: formData.owner_name,
          ano: formData.year || null,
          status: formData.status,
          consumo_combustivel: formData.fuel_consumption ? parseFloat(formData.fuel_consumption) : null,
          base: formData.base || null,
        }]).select();

        if (error) throw error;

        toast({ title: "Sucesso!", description: "Aeronave cadastrada com sucesso. Agora configure os diários de bordo conforme necessário." });
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

  const handleDelete = async () => {
    if (!aircraft?.id) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('aeronave')
        .delete()
        .eq('id', aircraft.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Aeronave excluída com sucesso."
      });

      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      setDeleteConfirm(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir aeronave.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (deleteConfirm) return; // Impede fechar se o alert está aberto
        onOpenChange(newOpen);
      }}>
        <DialogContent className="w-[90vw] max-w-[520px] sm:max-w-[520px] max-h-[80vh] overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 border border-slate-700/50 backdrop-blur-xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none rounded-lg" />
          <DialogHeader className="relative">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {aircraft ? '✏️ Editar Aeronave' : '➕ Adicionar Nova Aeronave'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 relative">
          <div className="space-y-2">
            <Label htmlFor="registration" className="text-slate-300">Matrícula *</Label>
            <Input
              id="registration"
              value={formData.registration}
              onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
              placeholder="PT-ABC"
              className="bg-slate-900 border-slate-600 focus:border-cyan-500 text-white placeholder-slate-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer" className="text-slate-300">Fabricante *</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="Cessna"
                className="bg-slate-900 border-slate-600 focus:border-cyan-500 text-white placeholder-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model" className="text-slate-300">Modelo *</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="172"
                className="bg-slate-900 border-slate-600 focus:border-cyan-500 text-white placeholder-slate-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="serial_number" className="text-slate-300">Número de Série *</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                placeholder="12345"
                className="bg-slate-900 border-slate-600 focus:border-cyan-500 text-white placeholder-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year" className="text-slate-300">Ano</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value.replace(/[^0-9]/g, '').slice(0,4) })}
                placeholder="2020"
                className="bg-slate-900 border-slate-600 focus:border-cyan-500 text-white placeholder-slate-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="owner_name" className="text-slate-300">Proprietário *</Label>
            <Input
              id="owner_name"
              value={formData.owner_name}
              onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
              placeholder="Nome do Proprietário"
              className="bg-slate-900 border-slate-600 focus:border-cyan-500 text-white placeholder-slate-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base" className="text-slate-300">Base</Label>
            <Input
              id="base"
              value={formData.base}
              onChange={(e) => setFormData({ ...formData, base: e.target.value })}
              placeholder="Ex.: SBRJ, SBCY ou cidade"
              className="bg-slate-900 border-slate-600 focus:border-cyan-500 text-white placeholder-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-slate-300">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-600">
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="inativa">Inativa</SelectItem>
                <SelectItem value="manutenção">Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fuel_consumption" className="text-slate-300">Consumo Médio (L/H)</Label>
            <Input
              id="fuel_consumption"
              type="number"
              step="0.1"
              value={formData.fuel_consumption}
              onChange={(e) => setFormData({ ...formData, fuel_consumption: e.target.value })}
              placeholder="83"
              className="bg-slate-900 border-slate-600 focus:border-cyan-500 text-white placeholder-slate-500"
            />
          </div>

          <DialogFooter className="flex gap-3 pt-4 justify-between">
            <div className="flex gap-2">
              {aircraft && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteConfirm(true)}
                  className="bg-red-600/80 hover:bg-red-700 text-white gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300 hover:bg-slate-800">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white shadow-lg">
                {loading ? (aircraft ? "Salvando..." : "Salvando...") : (aircraft ? "✓ Atualizar" : "✓ Salvar")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Dialog de Confirmação de Exclusão - Aninhado */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm bg-slate-900 border border-slate-700 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              Excluir Aeronave
            </DialogTitle>
          </DialogHeader>

          <p className="text-slate-300 text-sm">
            Tem certeza que deseja excluir a aeronave <span className="font-bold text-white">{aircraft?.matricula || 'N/A'}</span>? Esta ação não pode ser desfeita.
          </p>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirm(false)}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
    </>
  );
}
