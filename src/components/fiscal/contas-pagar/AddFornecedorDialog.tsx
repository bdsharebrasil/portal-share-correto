import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AddFornecedorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onSaved: (fornecedor: { id: string; nome_completo: string; conta_pagamento?: string; categoria?: string }) => void;
  onFornecedorAdded?: () => void;
}

export function AddFornecedorDialog({ open, onOpenChange, initialName = "", onSaved, onFornecedorAdded }: AddFornecedorDialogProps) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome_completo: initialName,
    documento: "",
    telefone: "",
    cidade: "",
    categoria: "share",
    apelido: "",
    conta_pagamento: ""
  });

  React.useEffect(() => {
    if (open) setForm(prev => ({ ...prev, nome_completo: initialName }));
  }, [open, initialName]);

  const handleSave = async () => {
    if (!form.nome_completo.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase.from("fornecedores_favoritos") as any)
        .insert([{
          nome_completo: form.nome_completo.trim(),
          documento: form.documento || null,
          telefone: form.telefone || null,
          cidade: form.cidade || null,
          categoria: form.categoria,
          apelido: form.apelido || null,
          conta_pagamento: form.conta_pagamento || null,
          criado_por: user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success("Fornecedor adicionado aos favoritos!");
      onSaved({
        id: data.id,
        nome_completo: data.nome_completo,
        conta_pagamento: data.conta_pagamento,
        categoria: data.categoria
      });
      // Recarregar lista de fornecedores no componente pai
      onFornecedorAdded?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar fornecedor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Fornecedor Favorito</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-semibold mb-1 block">Nome Completo *</label>
            <Input value={form.nome_completo} onChange={e => setForm(p => ({ ...p, nome_completo: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold mb-1 block">Documento (CPF/CNPJ)</label>
              <Input value={form.documentoumento} onChange={e => setForm(p => ({ ...p, documento: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Telefone</label>
              <Input value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold mb-1 block">Cidade</label>
              <Input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1 block">Categoria</label>
              <RegularSelect value={form.categoria} onValueChange={v => setForm(p => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="share">Share</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                </SelectContent>
              </RegularSelect>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Apelido</label>
            <Input value={form.apelido} onChange={e => setForm(p => ({ ...p, apelido: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-semibold mb-1 block">Conta para Pagamento</label>
            <Input value={form.conta_pagamento} onChange={e => setForm(p => ({ ...p, conta_pagamento: e.target.value }))} placeholder="Banco, Agência, Conta, PIX..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
