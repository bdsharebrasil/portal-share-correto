import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AircraftPartner } from '@/integrations/supabase/types-hour-bank';

export function useAircraftPartners(aircraftId: string | null | undefined) {
  return useQuery({
    queryKey: ['aircraft-partners', aircraftId],
    queryFn: async () => {
      if (!aircraftId) return [];
      
      const { data, error } = await supabase
        .from('aircraft_partners')
        .select('*, partner:clients(id, company_name)')
        .eq('aircraft_id', aircraftId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!aircraftId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAircraftPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<AircraftPartner, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: result, error } = await supabase
        .from('aircraft_partners')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['aircraft-partners', variables.aircraft_id] });
    },
  });
}

export function useUpdateAircraftPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AircraftPartner> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('aircraft_partners')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['aircraft-partners'] });
    },
  });
}

export function useDeleteAircraftPartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('aircraft_partners')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft-partners'] });
    },
  });
}
