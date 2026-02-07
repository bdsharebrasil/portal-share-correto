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
        .from('crew_members')
        .select('id, user_id, canac, full_name, birth_date, phone, avatar_url, status')
        .eq('status', 'ativo')
        .order('full_name', { ascending: true });

      if (fetchError) throw fetchError;
      
      setCrewMembers((data || []) as CrewMember[]);
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
