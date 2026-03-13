import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTripulantes } from '@/hooks/useTripulantes';
import type { Aerodrome } from '@/types';
import type { CrewMember } from '../types';

export function useFlightQueries(aircraftId: string, logbookMonthId?: string | null) {
  const { tripulantes } = useTripulantes();

  const { data: crewPersons = [] } = useQuery({
    queryKey: ['crew'],
    queryFn: async () => {
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
    },
  });

  const allCrew: CrewMember[] = [
    ...tripulantes,
    ...crewPersons.map((person: any) => ({
      id: person.id,
      full_name: person.full_name,
      canac: person.canac,
      status: person.status,
    })),
  ];

  const { data: aerodromes = [] } = useQuery({
    queryKey: ['aerodromes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aerodromes')
        .select('id, designativo, name, coordenadas')
        .order('designativo');
      if (error) throw error;
      return data as Aerodrome[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['aircraft-clients', aircraftId],
    queryFn: async () => {
      // Primeiro buscar os client_ids vinculados à aeronave
      const { data: clientAircraft, error: caError } = await supabase
        .from('client_aircraft')
        .select('client_id, share_percentage')
        .eq('aircraft_id', aircraftId);

      if (caError) {
        console.error('Erro ao buscar client_aircraft:', caError);
        throw caError;
      }
      if (!clientAircraft || clientAircraft.length === 0) {
        console.warn('Nenhum cliente encontrado para a aeronave:', aircraftId);
        return [];
      }

      // Depois buscar os dados completos dos clientes
      const clientIds = clientAircraft.map((ca: any) => ca.client_id);
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name, proprietario')
        .in('id', clientIds);

      if (clientsError) {
        console.error('Erro ao buscar dados dos clientes:', clientsError);
        throw clientsError;
      }

      // Mapear os dados combinados
      const clientsMap: Record<string, any> = {};
      (clientsData || []).forEach((c: any) => {
        clientsMap[c.id] = c;
      });

      const result = clientAircraft.map((ca: any) => ({
        client_id: ca.client_id,
        share_percentage: ca.share_percentage,
        clients: clientsMap[ca.client_id] || null
      }));

      console.log('✅ Clientes da aeronave carregados:', result);
      return result;
    },
    enabled: !!aircraftId,
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ['all-clients-for-loan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, proprietario')
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: logbookMonth } = useQuery({
    queryKey: ['logbook-month', logbookMonthId],
    queryFn: async () => {
      if (!logbookMonthId) return null;
      const { data, error } = await supabase
        .from('logbook_months')
        .select('base_aerodrome, daily_rate, has_daily_rate')
        .eq('id', logbookMonthId)
        .single();
      if (error) {
        console.error('Erro ao buscar logbook month:', error);
        return null;
      }
      return data;
    },
    enabled: !!logbookMonthId,
  });

  const getClientName = (clientId: string) => {
    const client = clients.find((c: any) => c.client_id === clientId);
    if (!client?.clients) return 'Cliente não encontrado';
    const clientData = client.clients as any;
    return clientData.company_name || clientData.proprietario || 'Sem nome';
  };

  return {
    allCrew,
    aerodromes,
    clients,
    allClients,
    logbookMonth,
    getClientName,
  };
}
