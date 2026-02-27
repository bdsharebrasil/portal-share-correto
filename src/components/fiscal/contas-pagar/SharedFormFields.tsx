import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Boleto section
export function BoletoSection({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const [uploading, setUploading] = React.useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 100);
      const fileExt = sanitizedFileName.split('.').pop();
      const fileName = `boleto_${timestamp}.${fileExt}`;
      const { error } = await supabase.storage.from("nfs-share-recebidas").upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from("nfs-share-recebidas").getPublicUrl(fileName);
      setForm({ ...form, boleto_url: data.publicUrl });
      toast.success("Boleto anexado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={form.possui_boleto}
          onCheckedChange={(checked) => setForm({ ...form, possui_boleto: !!checked })}
        />
        <label className="text-sm font-medium">Despesa possui boleto?</label>
      </div>
      {form.possui_boleto && (
        <div className="space-y-3 pl-6 border-l-2 border-primary/20">
          {form.boleto_url ? (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border/50">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <a href={form.boleto_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex-1 truncate">Boleto anexado</a>
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, boleto_url: "" })} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={uploading} className="hidden" id="boleto-upload" />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('boleto-upload')?.click()} disabled={uploading}>
                <Upload className="h-3 w-3 mr-1" />{uploading ? "Enviando..." : "Anexar Boleto"}
              </Button>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Data recebimento boleto</label>
              <Input type="date" value={form.data_recebimento_boleto || ""} onChange={e => setForm({ ...form, data_recebimento_boleto: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Prazo máximo pagamento</label>
              <Input type="date" value={form.data_prazo_pagamento || ""} onChange={e => setForm({ ...form, data_prazo_pagamento: e.target.value })} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Código de barras do boleto</label>
            <Input value={form.codigo_barras || ""} onChange={e => setForm({ ...form, codigo_barras: e.target.value })} placeholder="Digite o código de barras" className="h-9 text-sm font-mono" />
          </div>
        </div>
      )}
    </div>
  );
}

// NF Section
export function NFSection({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  const [uploading, setUploading] = React.useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const timestamp = Date.now();
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9.\-_]/g, "_")
        .substring(0, 100);
      const fileExt = sanitizedFileName.split('.').pop();
      const fileName = `nf_${timestamp}.${fileExt}`;
      const { error } = await supabase.storage.from("nfs-share-recebidas").upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from("nfs-share-recebidas").getPublicUrl(fileName);
      setForm({ ...form, nf_url: data.publicUrl });
      toast.success("Nota Fiscal anexada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={form.possui_nf}
          onCheckedChange={(checked) => setForm({ ...form, possui_nf: !!checked })}
        />
        <label className="text-sm font-medium">Possui Nota Fiscal?</label>
      </div>
      {form.possui_nf && (
        <div className="space-y-3 pl-6 border-l-2 border-primary/20">
          {form.nf_url ? (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border/50">
              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
              <a href={form.nf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex-1 truncate">NF anexada</a>
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, nf_url: "" })} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={uploading} className="hidden" id="nf-upload" />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('nf-upload')?.click()} disabled={uploading}>
                <Upload className="h-3 w-3 mr-1" />{uploading ? "Enviando..." : "Anexar NF"}
              </Button>
            </>
          )}
          <div>
            <label className="text-xs font-medium mb-1 block">Número da Nota Fiscal</label>
            <Input value={form.nf_numero || ""} onChange={e => setForm({ ...form, nf_numero: e.target.value })} placeholder="Nº da NF" className="h-9 text-sm" />
          </div>
        </div>
      )}
    </div>
  );
}

// Valor + Vencimento
export function ValorVencimentoFields({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-sm font-semibold mb-1 block">Valor *</label>
        <Input type="number" step="0.01" min="0" placeholder="0.00" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} className="h-9" />
      </div>
      <div>
        <label className="text-sm font-semibold mb-1 block">Data de Vencimento *</label>
        <Input type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} className="h-9" />
      </div>
    </div>
  );
}

// Observação
export function ObservacaoField({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div>
      <label className="text-sm font-semibold mb-1 block">Observação</label>
      <Input value={form.observacoes || ""} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Observação opcional..." className="h-9" />
    </div>
  );
}
