import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Aerodrome, ClientData, CrewMember, LogbookMonth } from '../types';

export function useFlightQueries(aircraftId: string, logbookMonthId?: string | null) {
  // Buscar aeródromos
  const { data: aerodromes = [], isLoading: loadingAerodromes } = useQuery({
    queryKey: ['aerodromes'],
    queryFn: async (): Promise<Aerodrome[]> => {
      const { data, error } = await supabase
        .from('aerodromes')
        .select('id, designativo, name, coordenadas')
        .order('designativo');

      if (error) throw error;
      return data as Aerodrome[];
    },
  });

  // Buscar clientes vinculados à aeronave
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['aircraft-clients', aircraftId],
    queryFn: async (): Promise<ClientData[]> => {
      const { data, error } = await supabase
        .from('client_aircraft')
        .select(`
          client_id,
          share_percentage,
          clients:client_id (
            id,
            company_name,
            proprietario
          )
        `)
        .eq('aircraft_id', aircraftId);

      if (error) throw error;
      return (data || []) as ClientData[];
    },
    enabled: !!aircraftId,
  });

  // Buscar TODOS os clientes (para empréstimo)
  const { data: allClients = [], isLoading: loadingAllClients } = useQuery({
    queryKey: ['all-clients-for-loan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, proprietario')
        .order('company_name');

      if (error) {
        console.error('Erro ao buscar clientes:', error);
        throw error;
      }

      return data || [];
    },
  });

  // Buscar tripulantes de crew_members
  const { data: crewMembers = [], isLoading: loadingCrewMembers } = useQuery({
    queryKey: ['crew_members'],
    queryFn: async (): Promise<CrewMember[]> => {
      const { data, error } = await supabase
        .from('crew_members')
        .select('*')
        .eq('status', 'ativo')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Erro ao buscar crew_members:', error);
        return [];
      }

      return data || [];
    }
  });

  // Buscar tripulantes externos da tabela crew
  const { data: crewPersons = [], isLoading: loadingCrewPersons } = useQuery({
    queryKey: ['crew'],
    queryFn: async (): Promise<CrewMember[]> => {
      const { data, error } = await supabase
        .from('crew')
        .select('id, full_name, canac, status')
        .eq('status', 'ativo')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Erro ao buscar crew:', error);
        return [];
      }

      return data || [];
    }
  });

  // Combinar tripulantes (deduplicar por ID)
  const allCrew: CrewMember[] = [
    ...crewMembers,
    ...crewPersons.filter(
      person => !crewMembers.some(member => member.id === person.id)
    )
  ];

  // Buscar dados do logbook_month
  const { data: logbookMonth, isLoading: loadingLogbookMonth } = useQuery({
    queryKey: ['logbook-month', logbookMonthId],
    queryFn: async (): Promise<LogbookMonth | null> => {
      if (!logbookMonthId) return null;

      const { data, error } = await supabase
        .from('logbook_months')
        .select('id, base_aerodrome, daily_rate, has_daily_rate')
        .eq('id', logbookMonthId)
        .single();

      if (error) {
        console.error('Erro ao buscar logbook month:', error);
        return null;
      }

      return data as LogbookMonth;
    },
    enabled: !!logbookMonthId,
  });

  return {
    aerodromes,
    clients,
    allClients,
    allCrew,
    logbookMonth,
    isLoading:
      loadingAerodromes ||
      loadingClients ||
      loadingAllClients ||
      loadingCrewMembers ||
      loadingCrewPersons ||
      loadingLogbookMonth,
  };
}
