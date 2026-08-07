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

export function formatarCategoriaParaLabel(categoria: { nome?: string | null; grupo_categoria?: string | null }) {
  const nome = String(categoria?.nome || '').trim();
  const grupo = String(categoria?.grupo_categoria || '').trim();
  return `${grupo || 'SEM GRUPO'} › ${nome || 'SEM NOME'}`;
}
