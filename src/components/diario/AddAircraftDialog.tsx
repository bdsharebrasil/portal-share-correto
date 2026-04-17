import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddAircraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraft: any;
}

export function AddAircraftDialog({
  open,
  onOpenChange,
  aircraft,
}: AddAircraftDialogProps) {
  const [matricula, setMatricula] = useState("");
  const [modelo, setModelo] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [status, setStatus] = useState("ativa");
  const [ano, setAno] = useState("");
  const [base, setBase] = useState("");
  const [consumoCombustivel, setConsumoCombustivel] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [nomeProprietario, setNomeProprietario] = useState("");
  const [precoHora, setPrecoHora] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (aircraft) {
      setMatricula(aircraft.matricula || "");
      setModelo(aircraft.modelo || "");
      setFabricante(aircraft.fabricante || "");
      setStatus(aircraft.status || "ativa");
      setAno(aircraft.ano || "");
      setBase(aircraft.base || "");
      setConsumoCombustivel(aircraft.consumo_combustivel || "");
      setNumeroSerie(aircraft.numero_serie || "");
      setNomeProprietario(aircraft.nome_proprietario || "");
      setPrecoHora(aircraft.preco_hora || "");
    }
  }, [aircraft, open]);

  const handleSave = async () => {
    if (!matricula) {
      toast.error("Informe a matrícula da aeronave");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("aeronave")
        .update({
          matricula,
          modelo,
          fabricante,
          status,
          ano: ano ? parseInt(ano) : null,
          base,
          consumo_combustivel: consumoCombustivel ? parseFloat(consumoCombustivel) : null,
          numero_serie: numeroSerie,
          nome_proprietario: nomeProprietario,
          preco_hora: precoHora ? parseFloat(precoHora) : null,
        })
        .eq("id", aircraft.id);

      if (error) throw error;

      toast.success("Aeronave atualizada com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar aeronave");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Aeronave</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula *</Label>
              <Input
                id="matricula"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                placeholder="ex: PT-ABC"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fabricante">Fabricante</Label>
              <Input
                id="fabricante"
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                placeholder="ex: Cessna"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo</Label>
              <Input
                id="modelo"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="ex: 172"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ano">Ano de Fabricação</Label>
              <Input
                id="ano"
                type="number"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="ex: 2020"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroSerie">Número de Série</Label>
              <Input
                id="numeroSerie"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomeProprietario">Nome do Proprietário</Label>
            <Input
              id="nomeProprietario"
              value={nomeProprietario}
              onChange={(e) => setNomeProprietario(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base">Base</Label>
              <Input
                id="base"
                value={base}
                onChange={(e) => setBase(e.target.value.toUpperCase())}
                placeholder="ex: SDVG"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="consumo">Consumo Combustível (L/H)</Label>
              <Input
                id="consumo"
                type="number"
                step="0.1"
                value={consumoCombustivel}
                onChange={(e) => setConsumoCombustivel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="precoHora">Valor da Hora (R$)</Label>
            <Input
              id="precoHora"
              type="number"
              step="0.01"
              value={precoHora}
              onChange={(e) => setPrecoHora(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
