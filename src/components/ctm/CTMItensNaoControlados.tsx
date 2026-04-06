import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, Trash2 } from "lucide-react";

interface ItemNaoControlado {
  id: string;
  aeronave_id: string;
  tipo_controle: string;
  posicao: string | null;
  media_horas: number | null;
  marca: string | null;
  data_ultima_troca: string | null;
  horas_ultima_troca: number | null;
  ordem_servico: string | null;
  nota_fiscal: string | null;
  horas_apos: number | null;
  pousos_apos: number | null;
  horas_restantes: number | null;
  pousos_restantes: number | null;
  observacoes: string | null;
}

interface Props {
  aircraftId: string;
}

const TIPOS = [
  { value: "pneu_camara", label: "CONTROLE DE PNEUS E CÂMARAS", positions: ["NARIZ", "DIREITO", "ESQUERDO"] },
  { value: "vela_ignicao", label: "CONTROLE DE VELAS DE IGNIÇÃO (MOTOR PISTÃO)", positions: [] },
  { value: "pastilha_freio", label: "CONTROLE DE PASTILHAS DE FREIO", positions: ["LE", "LD"] },
  { value: "disco_freio", label: "CONTROLE DE DISCO DE FREIO", positions: ["LE", "LD"] },
];

export function CTMItensNaoControlados({ aircraftId }: Props) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ctm-itens-nao-controlados", aircraftId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ctm_itens_nao_controlados")
        .select("*")
        .eq("id_aeronave", aircraftId)
        .order("tipo_controle")
        .order("posicao");
      if (error) throw error;
      return (data || []) as ItemNaoControlado[];
    },
    enabled: !!aircraftId,
  });

  const getItemsForType = (tipo: string) => items.filter(i => i.tipo_controle === tipo);

  const handleSaveItem = async (item: Partial<ItemNaoControlado> & { id?: string }) => {
    try {
      setSaving(true);
      if (item.id) {
        const { error } = await (supabase as any)
          .from("ctm_itens_nao_controlados")
          .update({ ...item, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("ctm_itens_nao_controlados")
          .insert([{ ...item, aeronave_id: aircraftId }]);
        if (error) throw error;
      }
      toast.success("Salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ctm-itens-nao-controlados", aircraftId] });
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    try {
      const { error } = await (supabase as any)
        .from("ctm_itens_nao_controlados")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Item removido!");
      queryClient.invalidateQueries({ queryKey: ["ctm-itens-nao-controlados", aircraftId] });
    } catch (error: any) {
      toast.error("Erro ao remover");
    }
  };

  const handleAddItem = (tipo: string, posicao?: string) => {
    handleSaveItem({
      tipo_controle: tipo,
      posicao: posicao || null,
      media_horas: null,
      marca: null,
      data_ultima_troca: null,
      horas_ultima_troca: null,
      ordem_servico: null,
      nota_fiscal: null,
      horas_apos: null,
      pousos_apos: null,
      horas_restantes: null,
      pousos_restantes: null,
      observacoes: null,
    });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {TIPOS.map(tipo => {
        const typeItems = getItemsForType(tipo.value);
        return (
          <Card key={tipo.value} className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground uppercase tracking-wide bg-primary/20 px-3 py-1 rounded">
                  {tipo.label}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => handleAddItem(tipo.value, tipo.positions[0] || undefined)} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {typeItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro. Clique em Adicionar para inserir.</p>
              ) : (
                <div className="space-y-4">
                  {typeItems.map(item => (
                    <ItemForm key={item.id} item={item} onSave={handleSaveItem} onDelete={handleDeleteItem} saving={saving} hasPositions={tipo.positions.length > 0} positions={tipo.positions} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ItemForm({
  item,
  onSave,
  onDelete,
  saving,
  hasPositions,
  positions,
}: {
  item: ItemNaoControlado;
  onSave: (item: Partial<ItemNaoControlado> & { id: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving: boolean;
  hasPositions: boolean;
  positions: string[];
}) {
  const [form, setForm] = useState({ ...item });

  const update = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-4 rounded-lg border border-border bg-muted/10 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">
          {form.posicao ? `Posição: ${form.posicao}` : "Item"}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onSave({ ...form })}
            className="h-7 text-xs gap-1"
          >
            <Save className="h-3 w-3" /> Salvar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(item.id)}
            className="h-7 text-xs text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {hasPositions && (
          <div>
            <Label className="text-xs">Posição</Label>
            <Input className="h-8 text-xs" value={form.posicao || ""} onChange={e => update("posicao", e.target.value)} placeholder={positions.join(", ")} />
          </div>
        )}
        <div>
          <Label className="text-xs">Média de Horas</Label>
          <Input className="h-8 text-xs" type="number" value={form.media_horas ?? ""} onChange={e => update("media_horas", e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
        <div>
          <Label className="text-xs">Marca</Label>
          <Input className="h-8 text-xs" value={form.marca || ""} onChange={e => update("marca", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Data Última Troca</Label>
          <Input className="h-8 text-xs" type="data" value={form.data_ultima_troca || ""} onChange={e => update("data_ultima_troca", e.target.value || null)} />
        </div>
        <div>
          <Label className="text-xs">Horas Última Troca</Label>
          <Input className="h-8 text-xs" type="number" step="0.1" value={form.horas_ultima_troca ?? ""} onChange={e => update("horas_ultima_troca", e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
        <div>
          <Label className="text-xs">Ordem de Serviço</Label>
          <Input className="h-8 text-xs" value={form.ordem_servico || ""} onChange={e => update("ordem_servico", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Nota Fiscal</Label>
          <Input className="h-8 text-xs" value={form.nota_fiscal || ""} onChange={e => update("nota_fiscal", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Horas Após</Label>
          <Input className="h-8 text-xs" type="number" step="0.1" value={form.horas_apos ?? ""} onChange={e => update("horas_apos", e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
        <div>
          <Label className="text-xs">Pousos Após</Label>
          <Input className="h-8 text-xs" type="number" value={form.pousos_apos ?? ""} onChange={e => update("pousos_apos", e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
        <div>
          <Label className="text-xs">Horas Restantes</Label>
          <Input className="h-8 text-xs" type="number" step="0.1" value={form.horas_restantes ?? ""} onChange={e => update("horas_restantes", e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
        <div>
          <Label className="text-xs">Pousos Restantes</Label>
          <Input className="h-8 text-xs" type="number" value={form.pousos_restantes ?? ""} onChange={e => update("pousos_restantes", e.target.value ? parseFloat(e.target.value) : null)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Observações</Label>
        <Textarea className="text-xs min-h-[40px]" value={form.observacoes || ""} onChange={e => update("observacoes", e.target.value)} />
      </div>
    </div>
  );
}
