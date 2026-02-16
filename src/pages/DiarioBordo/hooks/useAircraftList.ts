// hooks/useAircraftList.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Aircraft } from '@/types';

export function useAircraftList() {
  const [loading, setLoading] = useState(true);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);

  const fetchAircraft = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('aircraft')
        .select('*')
        .eq('status', 'ativa')
        .order('registration', { ascending: true });

      if (error) throw error;
      if (data) {
        setAircraft(data);
      }
    } catch (error) {
      console.error('Erro ao carregar aeronaves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAircraft();

    // Refetch quando a página volta ao foco
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchAircraft();
      }
    };

    // Subscribe to realtime changes in logbook_months
    const subscription = supabase
      .channel('logbook-months-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logbook_months'
        },
        () => {
          fetchAircraft();
        }
      )
      .subscribe();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(subscription);
    };
  }, []);

  return {
    aircraft,
    loading,
    refetch: fetchAircraft,
  };
}