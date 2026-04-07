import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Landmark, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ObservacaoField } from "./SharedFormFields";

interface Props {
  form: any;
  setForm: (f: any) => void;
}

// Tipos de impostos definidos por você
const TIPOS_IMPOSTO = ["DAS", "FGTS", "DARF"];

export function FormImpostos({ form, setForm }: Props) {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    const { data, error } = await (supabase as any)
      .from("empresas")
      .select("id, razao_social, cnpj");
    
    if (error) {
      console.error("Erro ao carregar empresas:", error);
      return;
    }
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
        fornecedor_cnpj: emp.cnpj,
      });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `imposto_${form.categoria || 'geral'}_${timestamp}.${fileExt}`;

      const { error } = await supabase.storage
        .from("nfs-share-recebidas")
        .upload(fileName, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from("nfs-share-recebidas")
        .getPublicUrl(fileName);

      setForm({ ...form, arquivo_pdf_url: data.publicUrl });
      toast.success("Guia anexada!");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Landmark className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Impostos e Tributos</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Empresa */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">Empresa Pagadora *</label>
          <RegularSelect value={form.empresa_id || ""} onValueChange={handleSelectEmpresa}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Selecione a empresa..." />
            </SelectTrigger>
            <SelectContent>
              {empresas.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </RegularSelect>
        </div>

        {/* Tipo de Imposto (Vai para a coluna 'categoria') */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">Tipo de Imposto *</label>
          <RegularSelect 
            value={form.categoria} 
            onValueChange={(v) => setForm({ ...form, categoria: v })}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="DAS, FGTS, DARF..." />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_IMPOSTO.map(tipo => (
                <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
              ))}
            </SelectContent>
          </RegularSelect>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Referência/Doc */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">Nº Documento / Ref.</label>
          <Input 
            placeholder="Ex: Ref 01/2026" 
            value={form.numero_doc || ""} 
            onChange={e => setForm({ ...form, numero_doc: e.target.value })}
            className="h-10"
          />
        </div>

        {/* Valor */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">Valor R$ *</label>
          <Input 
            type="number" 
            step="0.01" 
            value={form.valor} 
            onChange={e => setForm({ ...form, valor: e.target.value })} 
            className="h-10" 
          />
        </div>

        {/* Vencimento */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase">Vencimento *</label>
          <Input 
            type="data" 
            value={form.data_vencimento} 
            onChange={e => setForm({ ...form, data_vencimento: e.target.value })} 
            className="h-10" 
          />
        </div>
      </div>

      {/* Código de barras - Essencial para impostos */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
          <Receipt className="h-3 w-3" /> Linha Digitável
        </label>
        <Input 
          value={form.codigo_barras || ""} 
          onChange={e => setForm({ ...form, codigo_barras: e.target.value })} 
          placeholder="Cole o código de barras da guia aqui" 
          className="h-10 font-mono text-xs" 
        />
      </div>

      {/* Upload da Guia */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-muted-foreground uppercase block">Anexar Guia de Imposto</label>
        {form.arquivo_pdf_url ? (
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium flex-1 truncate">Guia anexada</span>
            <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, arquivo_pdf_url: "" })} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="relative">
            <input 
              type="file" 
              accept=".pdf,.jpg,.jpeg,.png" 
              onChange={handleUpload} 
              disabled={uploading} 
              className="absolute inset-0 opacity-0 cursor-pointer" 
            />
            <Button variant="outline" className="w-full border-dashed border-2 h-14 flex flex-col" disabled={uploading}>
              <Upload className="h-4 w-4 mb-1 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {uploading ? "Enviando..." : "Anexar PDF da Guia"}
              </span>
            </Button>
          </div>
        )}
      </div>

      <ObservacaoField form={form} setForm={setForm} />
    </div>
  );
}
