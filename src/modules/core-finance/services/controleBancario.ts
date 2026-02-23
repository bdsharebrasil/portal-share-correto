import { supabase } from '@/integrations/supabase/client';

export async function fetchControleBancario() {
  const { data, error } = await supabase
    .from('controle_bancario')
    .select(`
      *,
      categorias_movimentacao:categoria_id(id, nome, tipo, grupo_categoria)
    `)
    .order('data', { ascending: false });

  if (error) throw error;
  return data || [];
}
