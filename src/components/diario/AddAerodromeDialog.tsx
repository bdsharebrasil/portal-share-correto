import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

interface AddAerodromeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aerodrome?: Database["public"]["Tables"]["aerodromes"]["Row"] | null;
}

export function AddAerodromeDialog({ open, onOpenChange, aerodrome }: AddAerodromeDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    designativo: "",
    coordenadas: "",
  });

  useEffect(() => {
    if (aerodrome) {
      setFormData({
        name: aerodrome.name ?? "",
        designativo: (aerodrome as any).designativo ?? "",
        coordenadas: (aerodrome as any).coordenadas ?? "",
      });
    } else if (open) {
      setFormData({ name: "", designativo: "", coordenadas: "" });
    }
  }, [aerodrome, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (aerodrome) {
        const { error } = await supabase
          .from('aerodromes')
          .update({
            name: formData.name,
            designativo: formData.designativo.toUpperCase(),
            coordenadas: formData.coordenadas || null,
          })
          .eq('id', aerodrome.id);
        if (error) throw error;
        toast({ title: "Sucesso!", description: "Aeródromo atualizado com sucesso." });
      } else {
        const { error } = await supabase.from('aerodromes').insert([{
          name: formData.name,
          designativo: formData.designativo.toUpperCase(),
          coordenadas: formData.coordenadas,
        }]);
        if (error) throw error;
        toast({ title: "Sucesso!", description: "Aeródromo adicionado com sucesso." });
      }

      queryClient.invalidateQueries({ queryKey: ['aerodromes'] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || (aerodrome ? "Erro ao atualizar aeródromo." : "Erro ao adicionar aeródromo."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{aerodrome ? 'Editar Aeródromo' : 'Adicionar Aeródromo'}</DialogTitle>
        </DialogHeader>
        
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Dica:</strong> Caso a localidade não possua indicativo OACI, deverá ser preenchido o respectivo campo com o código ZZZZ, seguido do nome da localidade (fazenda, pista, área, prédio, hospital, lote etc), no campo de observações.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="designativo">DESIGNATIVO *</Label>
            <Input
              id="designativo"
              value={formData.designativo}
              onChange={(e) => setFormData({ ...formData, designativo: e.target.value.toUpperCase() })}
              placeholder="SBSP"
              maxLength={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome do Aeródromo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Aeroporto de Congonhas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coordenadas">COORDENADAS *</Label>
            <Input
              id="coordenadas"
              value={formData.coordenadas}
              onChange={(e) => setFormData({ ...formData, coordenadas: e.target.value })}
              placeholder="S23 37.620 W046 39.300 ou -23.6269,-46.6563"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : (aerodrome ? 'Atualizar' : 'Salvar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
