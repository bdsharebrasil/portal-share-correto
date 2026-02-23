import { supabase } from '@/integrations/supabase/client';

export async function fetchCategorias() {
  const { data, error } = await supabase
    .from('categorias_movimentacao')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (error) throw error;
  return (data || []).map((cat: any) => ({
    id: cat.id,
    nome: cat.nome,
    tipo: cat.tipo,
    grupo_categoria: cat.grupo_categoria || null,
    descricao: cat.descricao || undefined,
    ativo: cat.ativo ?? true,
    reembolsavel: cat.reembolsavel ?? false,
  }));
}

export async function addCategoriaService(categoria: any, userId: string) {
  const { error } = await supabase
    .from('categorias_movimentacao')
    .insert([{
      nome: categoria.nome,
      tipo: categoria.tipo,
      grupo_categoria: categoria.grupo_categoria || null,
      descricao: categoria.descricao || null,
      ativo: true,
      reembolsavel: categoria.reembolsavel ?? false,
      criado_por: userId,
    }]);

  if (error) throw error;
  return true;
}

export async function updateCategoriaService(id: string, updates: any) {
  const updateData: any = {};
  if (updates.nome !== undefined) updateData.nome = updates.nome;
  if (updates.tipo !== undefined) updateData.tipo = updates.tipo;
  if (updates.grupo_categoria !== undefined) updateData.grupo_categoria = updates.grupo_categoria || null;
  if (updates.descricao !== undefined) updateData.descricao = updates.descricao || null;
  if (updates.reembolsavel !== undefined) updateData.reembolsavel = updates.reembolsavel;

  const { error } = await supabase
    .from('categorias_movimentacao')
    .update(updateData)
    .eq('id', id);

  if (error) throw error;
  return true;
}

export async function deleteCategoriaService(id: string) {
  const { error } = await supabase
    .from('categorias_movimentacao')
    .update({ ativo: false })
    .eq('id', id);

  if (error) throw error;
  return true;
}
