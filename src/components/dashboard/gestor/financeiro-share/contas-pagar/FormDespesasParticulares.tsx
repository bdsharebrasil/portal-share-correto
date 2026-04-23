import React from "react";
import { FornecedorSelect } from "./FornecedorSelect";
import { ValorVencimentoFields, BoletoSection, NFSection, ObservacaoField } from "./SharedFormFields";

interface Props {
  form: any;
  setForm: (f: any) => void;
  fornecedores: any[];
  onReloadFornecedores?: () => void;
}

export function FormDespesasParticulares({ form, setForm, fornecedores, onReloadFornecedores }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Despesas Particulares</h3>
      <FornecedorSelect
        fornecedores={fornecedores}
        categoriaFilter="particular"
        value={form.fornecedor_favorito_id}
        onChange={(nome, forn) => {
  setForm({
    ...form,
    fornecedor_nome: nome,
    fornecedor_favorito_id: forn?.id || null,
    conta_pagamento_fornecedor: forn?.conta_pagamento || "", // ← adicionar isso
  });
}}
        contaPagamento={form.conta_pagamento_fornecedor}
        onFornecedorAdded={onReloadFornecedores}
      />
      <ValorVencimentoFields form={form} setForm={setForm} />
      <BoletoSection form={form} setForm={setForm} />
      <NFSection form={form} setForm={setForm} />
      <ObservacaoField form={form} setForm={setForm} />
    </div>
  );
}
