export function categoriaCorrespondeAoTipo(tipoSelecionado: string, categoriaTipo: string | null | undefined) {
  const tipo = (tipoSelecionado || '').toLowerCase();
  const categoria = (categoriaTipo || '').toLowerCase();

  if (tipo === 'despesa') return categoria === 'despesa';
  if (tipo === 'saida') return categoria === 'saida' || categoria === 'despesa';
  if (tipo === 'receita') return categoria === 'receita';
  if (tipo === 'entrada') return categoria === 'entrada' || categoria === 'receita';
  if (tipo === 'estorno') return categoria === 'receita' || categoria === 'entrada' || categoria === 'estorno';

  return false;
}

export function agruparCategoriasPorGrupo(
  categorias: Array<{ nome?: string | null; grupo_categoria?: string | null; tipo?: string | null }> = [],
  tipoSelecionado?: string,
) {
  const filtradas = categorias.filter((categoria) => {
    if (!tipoSelecionado) return true;
    return categoriaCorrespondeAoTipo(tipoSelecionado, categoria?.tipo ?? null);
  });

  const grupos = new Map<string, typeof filtradas>();

  filtradas.forEach((categoria) => {
    const grupo = String(categoria?.grupo_categoria || 'SEM GRUPO').trim() || 'SEM GRUPO';
    if (!grupos.has(grupo)) {
      grupos.set(grupo, []);
    }
    grupos.get(grupo)?.push(categoria);
  });

  return Array.from(grupos.entries())
    .map(([grupo, lista]) => ({
      grupo,
      categorias: [...lista].sort((a, b) =>
        String(a?.nome || '').localeCompare(String(b?.nome || '')),
      ),
    }))
    .sort((a, b) => a.grupo.localeCompare(b.grupo));
}

export function resolverSubcategoriasAtivas(
  subcategorias: Array<{ subcategoria_1?: string | null; subcategoria_2?: string | null; subcategoria_3?: string | null; subcategoria_4?: string | null }> = [],
  fallback: string[] = [],
) {
  const explicit = new Set<string>();

  subcategorias.forEach((item) => {
    [item.subcategoria_1, item.subcategoria_2, item.subcategoria_3, item.subcategoria_4].forEach((valor) => {
      const valorTrim = String(valor ?? '').trim();
      if (valorTrim) explicit.add(valorTrim);
    });
  });

  if (explicit.size > 0) {
    return Array.from(explicit);
  }

  return fallback.filter((item) => String(item ?? '').trim()).map((item) => String(item).trim());
}

export function formatarCategoriaParaLabel(categoria: { nome?: string | null; grupo_categoria?: string | null }) {
  const nome = String(categoria?.nome || '').trim();
  const grupo = String(categoria?.grupo_categoria || '').trim();
  return `${grupo || 'SEM GRUPO'} › ${nome || 'SEM NOME'}`;
}
