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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Aerodrome {
  id?: string;
  designativo: string;
  nome: string;
  coordenadas: string;
  [key: string]: any;
}

interface AddAerodromeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aerodrome?: Aerodrome | null;
  onSuccess?: () => void;
}

export function AddAerodromeDialog({
  open,
  onOpenChange,
  aerodrome,
  onSuccess,
}: AddAerodromeDialogProps) {
  const [designativo, setDesignativo] = useState("");
  const [nome, setNome] = useState("");
  const [coordenadas, setCoordenadas] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (aerodrome) {
      setDesignativo(aerodrome.designativo || "");
      setNome(aerodrome.nome || "");
      setCoordenadas(aerodrome.coordenadas || "");
    } else {
      setDesignativo("");
      setNome("");
      setCoordenadas("");
    }
  }, [aerodrome, open]);

  const handleSave = async () => {
    if (!designativo.trim()) {
      toast.error("Informe o designativo do aeródromo");
      return;
    }

    setIsLoading(true);
    try {
      if (aerodrome?.id) {
        // Update existing
        const { error } = await supabase
          .from("aerodromes")
          .update({
            designativo: designativo.toUpperCase(),
            nome: nome.trim(),
            coordenadas: coordenadas.trim(),
          })
          .eq("id", aerodrome.id);

        if (error) throw error;
        toast.success("Aeródromo atualizado com sucesso!");
      } else {
        // Insert new
        const { error } = await supabase.from("aerodromes").insert([
          {
            designativo: designativo.toUpperCase(),
            nome: nome.trim(),
            coordenadas: coordenadas.trim(),
          },
        ]);

        if (error) throw error;
        toast.success("Aeródromo adicionado com sucesso!");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar aeródromo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {aerodrome?.id ? "Editar Aeródromo" : "Novo Aeródromo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="designativo">Designativo (ICAO) *</Label>
            <Input
              id="designativo"
              value={designativo}
              onChange={(e) => setDesignativo(e.target.value.toUpperCase())}
              placeholder="ex: SBGR"
              maxLength={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Aeródromo</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex: Congonhas"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coordenadas">Coordenadas (DMS ou DD)</Label>
            <Textarea
              id="coordenadas"
              value={coordenadas}
              onChange={(e) => setCoordenadas(e.target.value)}
              placeholder="ex: 23°37'20.7&quot;S 046°28'47.1&quot;W"
              className="resize-none"
              rows={3}
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
