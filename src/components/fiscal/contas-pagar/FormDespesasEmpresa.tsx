import React from "react";
import { Input } from "@/components/ui/input";
import { Select as RegularSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FornecedorSelect } from "./FornecedorSelect";
import { ValorVencimentoFields, BoletoSection, NFSection, ObservacaoField } from "./SharedFormFields";

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
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Despesas Empresa (SHARE)</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Número do Documento - Campo Novo do Schema */}
        <div className="space-y-1">
          <label className="text-xs font-bold mb-1 block">Nº DOCUMENTO / DOC</label>
          <Input 
            placeholder="Ex: NF 123, Recibo..." 
            value={form.numero_doc || ""} 
            onChange={e => setForm({ ...form, numero_doc: e.target.value })}
          />
        </div>

        {/* Categoria Específica */}
        <div className="space-y-1">
          <label className="text-xs font-bold mb-1 block">CATEGORIA *</label>
          <RegularSelect 
            value={form.categoria} 
            onValueChange={v => setForm({ ...form, categoria: v })}
          >
            <SelectTrigger><SelectValue placeholder="Selecione a categoria..." /></SelectTrigger>
            <SelectContent>
              {CATEGORIAS_EMPRESA.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </RegularSelect>
        </div>
      </div>

      <FornecedorSelect
        fornecedores={fornecedores}
        categoriaFilter="share"
        value={form.fornecedor_favorito_id}
        onChange={(nome, forn) => {
          setForm({
            ...form,
            fornecedor_nome: nome,
            fornecedor_favorito_id: forn?.id || null,
            // No seu novo schema usamos 'banco' para a conta de pagamento
            banco: forn?.conta_pagamento || form.banco,
            empresa: "SHARE" // Opcional: define a empresa automaticamente
          });
        }}
        contaPagamento={form.banco}
        onFornecedorAdded={onReloadFornecedores}
      />

      <ValorVencimentoFields form={form} setForm={setForm} />
      <BoletoSection form={form} setForm={setForm} />
      <NFSection form={form} setForm={setForm} />
      <ObservacaoField form={form} setForm={setForm} />
    </div>
  );
}
