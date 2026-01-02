import { useMemo } from "react";
import { useCategoriasFinanceiro } from "./useCategoriasFinanceiro";

export interface GroupedCategory {
  grupo: string | null;
  categorias: Array<{
    id: string;
    nome: string;
    reembolsavel?: boolean;
  }>;
}

export function useGroupedCategories(tipo: "receita" | "despesa", onlyReembolsavel?: boolean) {
  const { categorias } = useCategoriasFinanceiro();

  return useMemo(() => {
    let filtered = categorias.filter(cat => cat.tipo === tipo);

    if (onlyReembolsavel) {
      filtered = filtered.filter(cat => cat.reembolsavel === true);
    }

    const grouped = filtered.reduce((acc, cat) => {
      const grupo = cat.grupo_categoria || "Sem Grupo";
      const existing = acc.find(g => g.grupo === grupo);

      if (existing) {
        existing.categorias.push({
          id: cat.id,
          nome: cat.nome,
          reembolsavel: cat.reembolsavel
        });
      } else {
        acc.push({
          grupo,
          categorias: [{
            id: cat.id,
            nome: cat.nome,
            reembolsavel: cat.reembolsavel
          }]
        });
      }

      return acc;
    }, [] as GroupedCategory[]);

    return grouped.sort((a, b) => {
      if (a.grupo === "Sem Grupo") return 1;
      if (b.grupo === "Sem Grupo") return -1;
      return (a.grupo || "").localeCompare(b.grupo || "");
    });
  }, [categorias, tipo, onlyReembolsavel]);
}
