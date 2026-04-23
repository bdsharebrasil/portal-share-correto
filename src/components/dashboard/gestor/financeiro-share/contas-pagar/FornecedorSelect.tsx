import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
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
  onFornecedorAdded?: () => void;
}

export function FornecedorSelect({ fornecedores, categoriaFilter, value, onChange, contaPagamento, onFornecedorAdded }: FornecedorSelectProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [customSearchValue, setCustomSearchValue] = useState("");

  const filtered = categoriaFilter
    ? fornecedores.filter(f => f.categoria === categoriaFilter)
    : fornecedores;

  const items = filtered.map(f => ({
    id: f.id,
    label: f.apelido ? `${f.nome_completo} (${f.apelido})` : f.nome_completo
  }));

  const selectedFornecedor = fornecedores.find(f => f.id === value);

  // Check if typed value is not in the list
  const isUnknownFornecedor = customSearchValue.trim().length > 2 &&
    !fornecedores.some(f => f.nome_completo.toLowerCase() === customSearchValue.trim().toLowerCase());

  const handleValueChange = (selectedId: string, label: string) => {
    if (selectedId) {
      const forn = fornecedores.find(f => f.id === selectedId);
      if (forn) {
        onChange(forn.nome_completo, forn);
        setCustomSearchValue(forn.nome_completo);
      }
    } else {
      onChange("");
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold mb-1 block">Fornecedor *</label>
      <SearchableCombobox
        items={items}
        value={value || ""}
        onChange={handleValueChange}
        placeholder="Selecione um fornecedor..."
        searchPlaceholder="Buscar fornecedor..."
        emptyMessage="Nenhum fornecedor encontrado."
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
        initialName={customSearchValue}
        onSaved={(forn) => {
          onChange(forn.nome_completo, {
            id: forn.id,
            nome_completo: forn.nome_completo,
            conta_pagamento: forn.conta_pagamento,
            categoria: forn.categoria
          });
        }}
        onFornecedorAdded={onFornecedorAdded}
      />
    </div>
  );
}
