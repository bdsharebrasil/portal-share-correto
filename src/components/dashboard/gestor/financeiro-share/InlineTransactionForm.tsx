import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePickerCalendar } from "@/components/ui/date-picker-calendar";
import { X, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface InlineTransactionFormProps {
  onClose: () => void;
}

export function InlineTransactionForm({ onClose }: InlineTransactionFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [dataCalendarOpen, setDataCalendarOpen] = useState(false);

  const [form, setForm] = useState({
    descricao: "",
    valor: "",
    tipo: "saida",
    data: new Date().toISOString().split("T")[0],
    status: "pendente",
    grupo_categoria: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao || !form.valor) {
      toast.error("Preencha descrição e valor");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase.from("controle_bancario") as any).insert({
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        tipo: form.tipo,
        data: form.data,
        status: form.status,
        grupo_categoria: form.grupo_categoria || null,
        criado_por: user?.id || "",
      });

      if (error) throw error;

      toast.success("Movimentação criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["controle_bancario"] });
      onClose();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border animate-in slide-in-from-top-2">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">Nova Movimentação</h3>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Descrição *</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Pagamento fornecedor"
              />
            </div>
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Data</Label>
              <Popover open={dataCalendarOpen} onOpenChange={setDataCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    {form.data ? format(new Date(form.data + "T00:00:00"), "dd/MM/yyyy") : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0 border-0">
                  <DatePickerCalendar
                    value={form.data ? new Date(form.data + "T00:00:00") : undefined}
                    onChange={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const day = String(date.getDate()).padStart(2, "0");
                        setForm({ ...form, data: `${year}-${month}-${day}` });
                        setDataCalendarOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Input
                value={form.grupo_categoria}
                onChange={(e) => setForm({ ...form, grupo_categoria: e.target.value })}
                placeholder="Ex: Operacional"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
