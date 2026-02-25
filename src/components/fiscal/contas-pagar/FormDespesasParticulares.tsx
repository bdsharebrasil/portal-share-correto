import React from "react";
import { FornecedorSelect } from "./FornecedorSelect";
import { ValorVencimentoFields, BoletoSection, NFSection, ObservacaoField } from "./SharedFormFields";

interface Props {
  form: any;
  setForm: (f: any) => void;
  fornecedores: any[];
}

export function FormDespesasParticulares({ form, setForm, fornecedores }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Despesas Particulares</h3>
      <FornecedorSelect
        fornecedores={fornecedores}
        categoriaFilter="pessoal"
        value={form.fornecedor_nome}
        onChange={(nome, forn) => {
          setForm({
            ...form,
            fornecedor_nome: nome,
            fornecedor_favorito_id: forn?.id || null,
            fornecedor_cnpj: forn?.documento || "",
            conta_pagamento_fornecedor: forn?.conta_pagamento || ""
          });
        }}
        contaPagamento={form.conta_pagamento_fornecedor}
      />
      <ValorVencimentoFields form={form} setForm={setForm} />
      <BoletoSection form={form} setForm={setForm} />
      <NFSection form={form} setForm={setForm} />
      <ObservacaoField form={form} setForm={setForm} />
    </div>
  );
}
