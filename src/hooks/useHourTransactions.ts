import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HourTransaction, HourTransactionWithDetails } from '@/integrations/supabase/types-hour-bank';

export function useHourTransactions(aircraftId: string | null | undefined) {
  return useQuery({
    queryKey: ['hour-transactions', aircraftId],
    queryFn: async () => {
      if (!aircraftId) return [];

      const { data, error } = await supabase
        .from('hour_transactions')
        .select(`
          *,
          from_partner:clients!from_partner_id(id, company_name),
          to_partner:clients!to_partner_id(id, company_name)
        `)
        .eq('aircraft_id', aircraftId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as HourTransactionWithDetails[];
    },
    enabled: !!aircraftId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateHourTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<HourTransaction, 'id' | 'created_at' | 'created_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: result, error } = await supabase
        .from('hour_transactions')
        .insert([{
          ...data,
          created_by: user?.id,
        }])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hour-transactions', variables.aircraft_id] });
      queryClient.invalidateQueries({ queryKey: ['aircraft-partners', variables.aircraft_id] });
    },
  });
}

export function useDeleteHourTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from('hour_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hour-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft-partners'] });
    },
  });
}

export function useHourTransactionsByPartner(
  aircraftId: string | null | undefined,
  partnerId: string | null | undefined
) {
  return useQuery({
    queryKey: ['hour-transactions-partner', aircraftId, partnerId],
    queryFn: async () => {
      if (!aircraftId || !partnerId) return [];

      const { data, error } = await supabase
        .from('hour_transactions')
        .select(`
          *,
          from_partner:clients!from_partner_id(id, company_name),
          to_partner:clients!to_partner_id(id, company_name)
        `)
        .eq('aircraft_id', aircraftId)
        .or(`from_partner_id.eq.${partnerId},to_partner_id.eq.${partnerId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as HourTransactionWithDetails[];
    },
    enabled: !!aircraftId && !!partnerId,
  });
}
