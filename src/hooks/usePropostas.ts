import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Item {
  id: string;
  nome: string;
  valor: string;
}

export interface PropostaSalva {
  id: string;
  nome: string;
  numero: string;
  cliente: string;
  aeronave?: string;
  base?: string;
  data?: string;
  validade: string;
  marca: string;
  abertura: string;
  fechamento: string;
  mostrarVantagens: boolean;
  vantagens: string;
  itens: Item[];
  semNota: boolean;
  desconto: string;
  criadoEm: string;
}

export interface PropostaPasta {
  id: string;
  nome: string;
  descricao?: string;
  propostas?: PropostaSalva[];
  criadoEm: string;
  atualizadoEm: string;
}

export function usePropostas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar todas as pastas do usuário
  const { data: pastas = [], isLoading: pastasLoading } = useQuery({
    queryKey: ['propostas-pastas', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('propostas_pastas')
        .select('*')
        .eq('user_id', user.id)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return data as unknown as PropostaPasta[];
    },
    enabled: !!user?.id,
  });

  // Buscar propostas de uma pasta
  const { data: propostas = {}, isLoading: propostasLoading } = useQuery({
    queryKey: ['propostas', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      const { data, error } = await supabase
        .from('propostas')
        .select('*')
        .eq('user_id', user.id)
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      
      // Agrupar propostas por pasta
      const grouped: Record<string, PropostaSalva[]> = {};
      (data as any[]).forEach(p => {
        if (!grouped[p.pasta_id]) grouped[p.pasta_id] = [];
        grouped[p.pasta_id].push({
          id: p.id,
          nome: p.nome,
          numero: p.numero,
          cliente: p.cliente,
          aeronave: p.aeronave,
          base: p.base,
          data: p.data,
          validade: String(p.validade),
          marca: p.marca,
          abertura: p.abertura,
          fechamento: p.fechamento,
          mostrarVantagens: p.mostrar_vantagens,
          vantagens: p.vantagens,
          itens: p.itens,
          semNota: p.sem_nota,
          desconto: String(p.desconto),
          criadoEm: p.criado_em,
        });
      });
      return grouped;
    },
    enabled: !!user?.id,
  });

  // Criar nova pasta
  const criarPasta = useMutation({
    mutationFn: async (nomePasta: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('propostas_pastas')
        .insert({ user_id: user.id, nome: nomePasta })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propostas-pastas', user?.id] });
      toast({ title: 'Pasta criada com sucesso' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao criar pasta',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Salvar proposta
  const salvarProposta = useMutation({
    mutationFn: async ({ pastaId, proposta }: { pastaId: string; proposta: PropostaSalva }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { data, error } = await supabase
        .from('propostas')
        .insert({
          pasta_id: pastaId,
          user_id: user.id,
          nome: proposta.nome,
          numero: proposta.numero,
          cliente: proposta.cliente,
          aeronave: proposta.aeronave,
          base: proposta.base,
          data: proposta.data,
          validade: parseInt(proposta.validade),
          marca: proposta.marca,
          abertura: proposta.abertura,
          fechamento: proposta.fechamento,
          mostrar_vantagens: proposta.mostrarVantagens,
          vantagens: proposta.vantagens,
          itens: proposta.itens,
          sem_nota: proposta.semNota,
          desconto: parseFloat(proposta.desconto),
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propostas', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pastas', user?.id] });
      toast({ title: 'Proposta salva com sucesso' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao salvar proposta',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Deletar proposta
  const deletarProposta = useMutation({
    mutationFn: async (propostaId: string) => {
      const { error } = await supabase
        .from('propostas')
        .delete()
        .eq('id', propostaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propostas', user?.id] });
      toast({ title: 'Proposta deletada' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao deletar proposta',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Deletar pasta
  const deletarPasta = useMutation({
    mutationFn: async (pastaId: string) => {
      const { error } = await supabase
        .from('propostas_pastas')
        .delete()
        .eq('id', pastaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propostas-pastas', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['propostas', user?.id] });
      toast({ title: 'Pasta deletada' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Erro ao deletar pasta',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const pastasComPropostas = pastas.map((p) => ({
    ...p,
    propostas: propostas[p.id] ?? [],
  }));

  return {
    pastas: pastasComPropostas,
    propostas,
    pastasLoading,
    propostasLoading,
    criarPasta,
    salvarProposta,
    deletarProposta,
    deletarPasta,
  };
}
