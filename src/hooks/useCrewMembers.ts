import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CrewMember } from '@/types/flightCycle';

export function useCrewMembers() {
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCrewMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('membros_tripulacao')
        .select('id, user_id, canac, nome_completo, data_nascimento, telefone, url_avatar, status')
        .eq('status', 'ativo')
        .order('nome_completo', { ascending: true });

      if (fetchError) throw fetchError;
      
      const mappedData = (data || []).map(item => ({
        id: item.id,
        user_id: item.user_id,
        canac: item.canac,
        full_name: item.nome_completo,
        birth_date: item.data_nascimento,
        phone: item.telefone,
        avatar_url: item.url_avatar,
        status: item.status,
      })) as CrewMember[];
      
      setCrewMembers(mappedData);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching crew members:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    crewMembers,
    loading,
    error,
    fetchCrewMembers,
  };
}
