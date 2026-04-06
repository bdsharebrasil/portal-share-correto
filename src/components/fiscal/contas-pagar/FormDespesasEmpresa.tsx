import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FornecedorSelect } from "./FornecedorSelect";
import { ValorVencimentoFields, BoletoSection, NFSection, ObservacaoField } from "./SharedFormFields";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";

interface Props {
  form: any;
  setForm: (f: any) => void;
  fornecedores: any[];
  onReloadFornecedores?: () => void;
}

const CATEGORIAS_EMPRESA = [
  "ALUGUEL - SHARE",
  "CARTÃO ALIMENTAÇÃO - share",
  "CARTÃO COMBUSTIVEL - share",
  "COMISSARIA",
  "CONTABILIDADE - mensal",
  "DESPESAS SHARE",
  "DESPESAS SHARE - RH",
  "ENERGIA ELETRICA",
  "INTERNET - share",
  "PADARIA",
  "TAG PEGAGIO - share",
  "TELEFONIA MOVEL",
  "WEBSITE"
];

export function FormDespesasEmpresa({ form, setForm, fornecedores, onReloadFornecedores }: Props) {
  const [empresas, setEmpresas] = useState<any[]>([]);

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    const { data, error } = await (supabase as any)
      .from("empresas")
      .select("id, razao_social, cnpj");

    if (!error) setEmpresas(data || []);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Despesas Empresa (SHARE)</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Número do Documento */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase block">Nº Documento</label>
          <Input
            placeholder="Ex: NF 123"
            value={form.numero_doc || ""}
            onChange={e => setForm({ ...form, numero_doc: e.target.value })}
            className="h-10"
          />
        </div>

        {/* Categoria Específica */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground uppercase block">Categoria *</label>
          <RegularSelect
            value={form.categoria}
            onValueChange={v => setForm({ ...form, categoria: v })}
          >
            <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a categoria..." /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS_EMPRESA.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </RegularSelect>
        </div>
      </div>

      {/* FornecedorSelect agora passa conta_pagamento_fornecedor corretamente */}
      <FornecedorSelect
        fornecedores={fornecedores}
        categoriaFilter="share"
        value={form.fornecedor_favorito_id}
        onChange={(nome, forn) => {
          setForm({
            ...form,
            fornecedor_nome: nome,
            fornecedor_favorito_id: forn?.id || null,
            fornecedor_cnpj: forn?.documento || "",
            conta_pagamento_fornecedor: forn?.conta_pagamento || "", // ← corrigido
          });
        }}
        contaPagamento={form.conta_pagamento_fornecedor} // ← corrigido (era form.banco)
        onFornecedorAdded={onReloadFornecedores}
      />

      <ValorVencimentoFields form={form} setForm={setForm} />

      <BoletoSection form={form} setForm={setForm} />
      <NFSection form={form} setForm={setForm} />
      <ObservacaoField form={form} setForm={setForm} />
    </div>
  );
}