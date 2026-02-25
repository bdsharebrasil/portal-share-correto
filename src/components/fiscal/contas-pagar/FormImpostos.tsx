import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ObservacaoField } from "./SharedFormFields";

interface Props {
  form: any;
  setForm: (f: any) => void;
}

export function FormImpostos({ form, setForm }: Props) {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    const { data } = await supabase.from("company_settings").select("id, razao_social, cnpj, nome_fantasia");
    setEmpresas(data || []);
  };

  const handleSelectEmpresa = (empresaId: string) => {
    const emp = empresas.find(e => e.id === empresaId);
    if (emp) {
      setForm({
        ...form,
        empresa_id: emp.id,
        empresa: emp.razao_social,
        fornecedor_nome: emp.razao_social,
        fornecedor_cnpj: emp.cnpj
      });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `imposto_${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from("nfs-share-recebidas").upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from("nfs-share-recebidas").getPublicUrl(fileName);
      setForm({ ...form, documento_url: data.publicUrl });
      toast.success("Documento anexado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const selectedEmpresa = empresas.find(e => e.id === form.empresa_id);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Impostos</h3>

      {/* Empresa */}
      <div>
        <label className="text-sm font-semibold mb-1 block">Empresa *</label>
        <RegularSelect value={form.empresa_id || ""} onValueChange={handleSelectEmpresa}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
          <SelectContent>
            {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>)}
          </SelectContent>
        </RegularSelect>
      </div>

      {selectedEmpresa && (
        <div className="p-3 bg-muted/40 rounded-lg border border-border/50 space-y-1">
          <p className="text-xs"><strong>Razão Social:</strong> {selectedEmpresa.razao_social}</p>
          <p className="text-xs"><strong>CNPJ:</strong> {selectedEmpresa.cnpj}</p>
        </div>
      )}

      {/* Período de Apuração */}
      <div>
        <label className="text-sm font-semibold mb-1 block">Período de Apuração</label>
        <Input type="month" value={form.periodo_apuracao || ""} onChange={e => setForm({ ...form, periodo_apuracao: e.target.value })} className="h-9" />
      </div>

      {/* Valor e Vencimento */}
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

      {/* Documento */}
      <div>
        <label className="text-sm font-semibold mb-1 block">Anexar Documento</label>
        {form.documento_url ? (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border/50">
            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            <a href={form.documento_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex-1 truncate">Documento anexado</a>
            <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, documento_url: "" })} className="h-6 w-6 p-0"><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} disabled={uploading} className="hidden" id="doc-imposto-upload" />
            <Button variant="outline" size="sm" onClick={() => document.getElementById('doc-imposto-upload')?.click()} disabled={uploading}>
              <Upload className="h-3 w-3 mr-1" />{uploading ? "Enviando..." : "Anexar Documento"}
            </Button>
          </>
        )}
      </div>

      {/* Código de barras */}
      <div>
        <label className="text-sm font-semibold mb-1 block">Código de Barras</label>
        <Input value={form.codigo_barras || ""} onChange={e => setForm({ ...form, codigo_barras: e.target.value })} placeholder="Código de barras do boleto" className="h-9 font-mono text-sm" />
      </div>

      <ObservacaoField form={form} setForm={setForm} />
    </div>
  );
}
