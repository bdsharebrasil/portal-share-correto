import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FlightCategory, Partner } from '../types';

export function usePartners(
  clientId: string,
  borrowerClientId: string,
  flightCategory: FlightCategory
) {
  const { data: clientPartners = [] } = useQuery<Partner[]>({
    queryKey: ['client-partners', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage')
        .eq('client_id', clientId)
        .order('name');
      if (error) {
        console.error('Erro ao buscar parceiros do cliente:', error);
        return [];
      }
      return (data || []) as Partner[];
    },
    enabled: !!clientId && flightCategory === 'cliente',
  });

  const { data: lenderPartners = [] } = useQuery<Partner[]>({
    queryKey: ['lender-partners', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage')
        .eq('client_id', clientId)
        .order('name');
      if (error) {
        console.error('Erro ao buscar parceiros do lender:', error);
        return [];
      }
      return (data || []) as Partner[];
    },
    enabled: !!clientId && flightCategory === 'emprestimo',
  });

  const { data: borrowerPartners = [] } = useQuery<Partner[]>({
    queryKey: ['borrower-partners', borrowerClientId],
    queryFn: async () => {
      if (!borrowerClientId) return [];
      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage')
        .eq('client_id', borrowerClientId)
        .order('name');
      if (error) {
        console.error('Erro ao buscar parceiros do borrower:', error);
        return [];
      }
      return (data || []) as Partner[];
    },
    enabled: !!borrowerClientId && flightCategory === 'emprestimo',
  });

  return { clientPartners, lenderPartners, borrowerPartners };
}
