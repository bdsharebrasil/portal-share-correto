import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AeronaveParcerias {
  id: string;
  id_aeronave: string;
  id_clientes: string;
  percentual_sociedade: number;
  criado_em: string;
  atualizado_em: string;
}

export function useAeronaveParcerias(aeronaveId: string | null | undefined) {
  return useQuery({
    queryKey: ['aeronave-parcerias', aeronaveId],
    queryFn: async () => {
      if (!aeronaveId) return [];

      const { data, error } = await supabase
        .from('cotistas_aeronave')
        .select('*, clientes(id, razao_social)')
        .eq('id_aeronave', aeronaveId)
        .order('criado_em', { ascending: true });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!aeronaveId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAeronaveParcerias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<AeronaveParcerias, 'id' | 'criado_em' | 'atualizado_em'>) => {
      const { data: result, error } = await supabase
        .from('cotistas_aeronave')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['aeronave-parcerias', variables.id_aeronave] });
    },
  });
}

export function useUpdateAeronaveParcerias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<AeronaveParcerias> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('cotistas_aeronave')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['aeronave-parcerias'] });
    },
  });
}

export function useDeleteAeronaveParcerias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cotistas_aeronave')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aeronave-parcerias'] });
    },
  });
}

// Backward compatibility
export function useAircraftPartners(aircraftId: string | null | undefined) {
  return useAeronaveParcerias(aircraftId);
}

export function useCreateAircraftPartner() {
  return useCreateAeronaveParcerias();
}

export function useUpdateAircraftPartner() {
  return useUpdateAeronaveParcerias();
}

export function useDeleteAircraftPartner() {
  return useDeleteAeronaveParcerias();
}


