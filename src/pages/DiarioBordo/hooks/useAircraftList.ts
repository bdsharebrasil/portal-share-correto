// hooks/useAircraftList.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Aircraft } from '@/types';

export function useAircraftList() {
  const [loading, setLoading] = useState(true);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);

  const fetchAircraft = useCallback(async () => {
    setLoading(true);
    try {
      // Tenta carregar todas as aeronaves
      const { data, error } = await supabase
        .from('aeronave')
        .select('*')
        .order('matricula', { ascending: true });

      if (error) {
        console.error('Erro ao carregar aeronaves com filtro ativa:', error);
        throw error;
      }

      if (data) {
        console.log('Aeronaves carregadas com sucesso:', data.length);
        setAircraft(data);
      } else {
        console.warn('Nenhuma aeronave retornada da query');
        setAircraft([]);
      }
    } catch (error) {
      console.error('Erro ao carregar aeronaves:', error);
      // Fallback: tenta sem filtro
      try {
        const { data: allData, error: fallbackError } = await supabase
          .from('aeronave')
          .select('*')
          .order('matricula', { ascending: true });

        if (fallbackError) {
          console.error('Erro no fallback:', fallbackError);
        } else {
          console.log('Aeronaves carregadas (sem filtro):', allData?.length || 0);
          setAircraft(allData || []);
        }
      } catch (fallbackErr) {
        console.error('Erro fatal ao carregar aeronaves:', fallbackErr);
        setAircraft([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [fetchAircraft]);

  return {
    aircraft,
    loading,
    refetch: fetchAircraft,
  };
}

// Backward compatibility
export function useAeronaveList() {
  return useAircraftList();
}
