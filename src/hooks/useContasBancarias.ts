import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const CONTAS_BANCARIAS_QUERY_KEY = ['contas_bancarias'] as const;

export interface ContaBancaria {
  id: string;
  banco: string | null;
  numero_conta: string | null;
  tipo_conta: string | null;
  ativo: boolean | null;
}

export function useContasBancarias() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('contas-bancarias-atualizacoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_bancarias' }, () => {
        void queryClient.invalidateQueries({ queryKey: CONTAS_BANCARIAS_QUERY_KEY });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: CONTAS_BANCARIAS_QUERY_KEY,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_bancarias')
        .select('id, banco, numero_conta, tipo_conta, ativo')
        .eq('ativo', true)
        .order('banco');

      if (error) throw error;
      return (data ?? []) as ContaBancaria[];
    },
  });
}
