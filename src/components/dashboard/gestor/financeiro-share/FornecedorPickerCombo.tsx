import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { Plus, Loader2, Fuel, Star } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value: string;
  onChange: (nome: string) => void;
  className?: string;
}

/**
 * Combobox de fornecedores para editores do caixa cliente/share.
 * Busca em `fornecedores_favoritos` e `fornecedores_combustivel`, permite
 * digitação livre e adicionar rapidamente como favorito ou combustível.
 */
export default function FornecedorPickerCombo({ value, onChange }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<null | "fav" | "comb">(null);

  const { data: fav = [] } = useQuery({
    queryKey: ["fornecedores-favoritos-picker"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("fornecedores_favoritos")
        .select("id, nome_completo")
        .order("nome_completo");
      return (data ?? []) as { id: string; nome_completo: string }[];
    },
  });

  const { data: comb = [] } = useQuery({
    queryKey: ["fornecedores-combustivel-picker"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("fornecedores_combustivel")
        .select("id, nome_fornecedor")
        .order("nome_fornecedor");
      return (data ?? []) as { id: string; nome_fornecedor: string }[];
    },
  });

  const items = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    fav.forEach((f) => map.set(f.nome_completo, { id: f.nome_completo, label: `⭐ ${f.nome_completo}` }));
    comb.forEach((c) => {
      if (!map.has(c.nome_fornecedor))
        map.set(c.nome_fornecedor, { id: c.nome_fornecedor, label: `⛽ ${c.nome_fornecedor}` });
    });
    return Array.from(map.values());
  }, [fav, comb]);

  const isKnown = items.some((i) => i.id.toLowerCase() === (value || "").toLowerCase());

  const addFavorito = async () => {
    if (!value.trim()) return;
    setAdding("fav");
    try {
      const { error } = await (supabase as any)
        .from("fornecedores_favoritos")
        .insert({ nome_completo: value.trim() });
      if (error) throw error;
      toast.success("Fornecedor salvo em favoritos");
      qc.invalidateQueries({ queryKey: ["fornecedores-favoritos-picker"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar favorito");
    } finally {
      setAdding(null);
    }
  };

  const addCombustivel = async () => {
    if (!value.trim()) return;
    setAdding("comb");
    try {
      const { error } = await (supabase as any)
        .from("fornecedores_combustivel")
        .insert({ nome_fornecedor: value.trim() });
      if (error) throw error;
      toast.success("Fornecedor salvo em combustível");
      qc.invalidateQueries({ queryKey: ["fornecedores-combustivel-picker"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar combustível");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <SearchableCombobox
        items={items}
        value={value || ""}
        onChange={(v) => onChange(v)}
        placeholder="Selecione ou digite um fornecedor..."
        searchPlaceholder="Buscar / digitar fornecedor..."
        emptyMessage="Nenhum fornecedor. Digite para usar manualmente."
        allowFreeText
      />
      {value.trim() && !isKnown && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={addFavorito}
            disabled={adding !== null}
            className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10.5px] font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {adding === "fav" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
            + Favorito
          </button>
          <button
            type="button"
            onClick={addCombustivel}
            disabled={adding !== null}
            className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[10.5px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
          >
            {adding === "comb" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Fuel className="h-3 w-3" />}
            + Combustível
          </button>
        </div>
      )}
    </div>
  );
}
