import React, { useState } from "react";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { AddFornecedorDialog } from "./AddFornecedorDialog";

interface FornecedorOption {
  id: string;
  nome_completo: string;
  documento?: string;
  categoria?: string;
  apelido?: string;
  conta_pagamento?: string;
}

interface FornecedorSelectProps {
  fornecedores: FornecedorOption[];
  categoriaFilter?: string; // 'share' or 'pessoal'
  value: string;
  onChange: (nome: string, fornecedor?: FornecedorOption) => void;
  contaPagamento?: string;
}

export function FornecedorSelect({ fornecedores, categoriaFilter, value, onChange, contaPagamento }: FornecedorSelectProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchValue, setSearchValue] = useState(value);

  const filtered = categoriaFilter
    ? fornecedores.filter(f => f.categoria === categoriaFilter)
    : fornecedores;

  const options = filtered.map(f => ({
    id: f.id,
    label: f.apelido ? `${f.nome_completo} (${f.apelido})` : f.nome_completo
  }));

  const handleTypedValue = (val: string) => {
    setSearchValue(val);
    onChange(val);
  };

  const handleSelect = (option: { id: string; label: string }) => {
    const forn = fornecedores.find(f => f.id === option.id);
    if (forn) {
      setSearchValue(forn.nome_completo);
      onChange(forn.nome_completo, forn);
    }
  };

  // Check if typed value is not in the list
  const isUnknownFornecedor = searchValue.trim().length > 2 &&
    !fornecedores.some(f => f.nome_completo.toLowerCase() === searchValue.trim().toLowerCase());

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold mb-1 block">Fornecedor *</label>
      <AutocompleteInput
        value={searchValue}
        onChange={handleTypedValue}
        onSelect={handleSelect}
        options={options}
        placeholder="Buscar fornecedor..."
      />
      {contaPagamento && (
        <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-xs text-green-600 font-medium">💳 Conta pagamento: {contaPagamento}</p>
        </div>
      )}
      {isUnknownFornecedor && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-600 flex-1">Fornecedor não encontrado nos favoritos.</p>
          <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} className="h-7 text-xs">
            <UserPlus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
      )}
      <AddFornecedorDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        initialName={searchValue}
        onSaved={(forn) => {
          setSearchValue(forn.nome_completo);
          onChange(forn.nome_completo, {
            id: forn.id,
            nome_completo: forn.nome_completo,
            conta_pagamento: forn.conta_pagamento,
            categoria: forn.categoria
          });
        }}
      />
    </div>
  );
}
