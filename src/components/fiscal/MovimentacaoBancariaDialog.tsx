import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoriasConta } from "@/hooks/useCategoriasFinanceiro";
import { toast } from "sonner";
import { format } from "date-fns";

interface MovimentacaoBancariaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimentacao?: any;
  onSuccess: () => void;
}

export function MovimentacaoBancariaDialog({
  open,
  onOpenChange,
  movimentacao,
  onSuccess,
}: MovimentacaoBancariaDialogProps) {
  const { user } = useAuth();
  const { categorias } = useCategoriasConta();
  const [isLoading, setIsLoading] = useState(false);
  const [dataCalendarOpen, setDataCalendarOpen] = useState(false);
  const [formData, setFormData] = useState({
    descricao: "",
    valor: "",
    tipo_movimento: "entrada",
    categoria: "",
    data: new Date().toISOString().split("T")[0],
    observacoes: "",
    numero_documento: "",
  });

  useEffect(() => {
    if (movimentacao) {
      setFormData({
        descricao: movimentacao.descricao || "",
        valor: movimentacao.valor?.toString() || "",
        tipo_movimento: movimentacao.tipo_movimento || "entrada",
        categoria: movimentacao.categoria || "",
        data: movimentacao.data || new Date().toISOString().split("T")[0],
        observacoes: movimentacao.observacoes || "",
        numero_documento: movimentacao.numero_documento || "",
      });
    } else {
      setFormData({
        descricao: "",
        valor: "",
        tipo_movimento: "entrada",
        categoria: "",
        data: new Date().toISOString().split("T")[0],
        observacoes: "",
        numero_documento: "",
      });
    }
  }, [movimentacao, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      const payload = {
        descricao: formData.descricao,
        valor: parseFloat(formData.valor),
        tipo_movimento: formData.tipo_movimento,
        categoria: formData.categoria,
        data: formData.data,
        observacoes: formData.observacoes || null,
        numero_documento: formData.numero_documento || null,
        criado_por: user.id,
      };

      if (movimentacao?.id) {
        const { error } = await supabase
          .from("controle_bancario")
          .update(payload)
          .eq("id", movimentacao.id);
        if (error) throw error;
        toast.success("Movimentação atualizada com sucesso!");
      } else {
        const { error } = await (supabase.from("controle_bancario") as any).insert(payload);
        if (error) throw error;
        toast.success("Movimentação criada com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar movimentação:", error);
      toast.error("Erro ao salvar movimentação");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {movimentacao ? "Editar Movimentação" : "Nova Movimentação"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo_movimento}
                onValueChange={(value) => setFormData({ ...formData, tipo_movimento: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.nome}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Popover open={dataCalendarOpen} onOpenChange={setDataCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {formData.data ? format(new Date(formData.data + "T00:00:00"), "dd/MM/yyyy") : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 border-0">
                  <DatePickerCalendar
                    value={formData.data ? new Date(formData.data + "T00:00:00") : undefined}
                    onChange={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const day = String(date.getDate()).padStart(2, "0");
                        setFormData({ ...formData, data: `${year}-${month}-${day}` });
                        setDataCalendarOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numero_documento">Nº Documento</Label>
            <Input
              id="numero_documento"
              value={formData.numero_documento}
              onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
