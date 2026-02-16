import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FlightCategory, Partner } from '../types';

export function usePartners(
  clientId: string,
  borrowerClientId: string,
  flightCategory: FlightCategory
) {
  // Partners do cliente (voo normal)
  const { data: clientPartners = [], isLoading: loadingClientPartners } = useQuery({
    queryKey: ['client-partners', clientId],
    queryFn: async (): Promise<Partner[]> => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage, client_id')
        .eq('client_id', clientId)
        .order('name');

      if (error) {
        console.error('Erro ao buscar parceiros do cliente:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!clientId && flightCategory === 'cliente',
  });

  // Partners do lender (empréstimo)
  const { data: lenderPartners = [], isLoading: loadingLenderPartners } = useQuery({
    queryKey: ['lender-partners', clientId],
    queryFn: async (): Promise<Partner[]> => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage, client_id')
        .eq('client_id', clientId)
        .order('name');

      if (error) {
        console.error('Erro ao buscar parceiros do lender:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!clientId && flightCategory === 'emprestimo',
  });

  // Partners do borrower (empréstimo)
  const { data: borrowerPartners = [], isLoading: loadingBorrowerPartners } = useQuery({
    queryKey: ['borrower-partners', borrowerClientId],
    queryFn: async (): Promise<Partner[]> => {
      if (!borrowerClientId) return [];

      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage, client_id')
        .eq('client_id', borrowerClientId)
        .order('name');

      if (error) {
        console.error('Erro ao buscar parceiros do borrower:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!borrowerClientId && flightCategory === 'emprestimo',
  });

  return {
    clientPartners,
    lenderPartners,
    borrowerPartners,
    isLoading: loadingClientPartners || loadingLenderPartners || loadingBorrowerPartners,
  };
}
