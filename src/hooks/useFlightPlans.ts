import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface FlightPlan {
  id: string;
  flight_date: string;
  departure_airport: string;
  arrival_airport: string;
  aeronave_id: string | null;
  pilot_in_command: string;
  alternate_airport: string | null;
  cruise_altitude: string | null;
  estimated_time: string | null;
  fuel_endurance: string | null;
  route: string | null;
  remarks: string | null;
  status: 'draft' | 'filed' | 'approved' | 'completed' | 'cancelled';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  flight_schedule_id: string | null;
  
  // Campos calculados (salvos como JSON em remarks ou nova coluna)
  calculations?: {
    distance: number;
    bearing: number;
    time: number;
    ete: string;
    fuelRequired: number;
    fuelReserve: number;
    totalFuel: number;
    suggestedAlt: string;
    altitudeWarnings: string[];
    alternatives: string[];
  };
  
  validation?: {
    valid: boolean;
    warnings: string[];
    notams: any;
    originStatus: any;
    destinationStatus: any;
    restrictions: any[];
  };
  
  weather?: {
    origin: any;
    destination: any;
    timestamp: number;
  };
}

export interface CreateFlightPlanInput {
  flight_date: string;
  departure_airport: string;
  arrival_airport: string;
  aeronave_id?: string;
  pilot_in_command: string;
  alternate_airport?: string;
  cruise_altitude?: string;
  estimated_time?: string;
  fuel_endurance?: string;
  route?: string;
  remarks?: string;
  status?: 'draft' | 'filed' | 'approved' | 'completed' | 'cancelled';
  calculations?: any;
  validation?: any;
  weather?: any;
}

export function useFlightPlans() {
  const { user } = useAuth();
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Buscar todos os planos do usuário
  const fetchFlightPlans = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('flight_plans')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Mapear campos calculados diretamente
      const parsedPlans = (data || []).map(plan => ({
        ...plan,
        status: (plan.situacao as 'draft' | 'filed' | 'approved' | 'completed' | 'cancelled') || 'draft',
        calculations: plan.calculations as any,
        validation: plan.validation_data as any,
        weather: plan.weather_data as any,
      }));

      setFlightPlans(parsedPlans as FlightPlan[]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao buscar planos de voo';
      setError(errorMsg);
      console.error('Error fetching flight plans:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Criar novo plano
  const createFlightPlan = useCallback(async (input: CreateFlightPlanInput): Promise<FlightPlan | null> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const flightPlanData = {
        flight_date: input.flight_date,
        departure_airport: input.departure_airport,
        arrival_airport: input.arrival_airport,
        aeronave_id: input.aeronave_id || null,
        pilot_in_command: input.pilot_in_command,
        alternate_airport: input.alternate_airport || null,
        cruise_altitude: input.cruise_altitude || null,
        estimated_time: input.estimated_time || null,
        fuel_endurance: input.fuel_endurance || null,
        route: input.route || null,
        remarks: input.remarks || null,
        calculations: input.calculations || null,
        validation_data: input.validation || null,
        weather_data: input.weather || null,
        status: input.situacao || 'draft',
        created_by: user.id,
      };

      const { data, error: insertError } = await supabase
        .from('flight_plans')
        .insert([flightPlanData])
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Plano de voo salvo com sucesso!');

      // Atualizar lista local
      await fetchFlightPlans();

      return data as unknown as FlightPlan;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao criar plano de voo';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Error creating flight plan:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, fetchFlightPlans]);

  // Atualizar plano existente
  const updateFlightPlan = useCallback(async (
    id: string,
    updates: Partial<CreateFlightPlanInput>
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const updateData = {
        ...(updates.flight_date && { flight_date: updates.flight_date }),
        ...(updates.departure_airport && { departure_airport: updates.departure_airport }),
        ...(updates.arrival_airport && { arrival_airport: updates.arrival_airport }),
        ...(updates.aeronave_id && { aeronave_id: updates.aeronave_id }),
        ...(updates.pilot_in_command && { pilot_in_command: updates.pilot_in_command }),
        ...(updates.alternate_airport && { alternate_airport: updates.alternate_airport }),
        ...(updates.cruise_altitude && { cruise_altitude: updates.cruise_altitude }),
        ...(updates.estimated_time && { estimated_time: updates.estimated_time }),
        ...(updates.fuel_endurance && { fuel_endurance: updates.fuel_endurance }),
        ...(updates.route && { route: updates.route }),
        ...(updates.remarks && { remarks: updates.remarks }),
        ...(updates.situacao && { status: updates.situacao }),
        ...(updates.calculations && { calculations: updates.calculations }),
        ...(updates.validation && { validation_data: updates.validation }),
        ...(updates.weather && { weather_data: updates.weather }),
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('flight_plans')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      toast.success('Plano de voo atualizado!');

      // Atualizar lista local
      await fetchFlightPlans();

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao atualizar plano de voo';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Error updating flight plan:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFlightPlans]);

  // Deletar plano
  const deleteFlightPlan = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('flight_plans')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success('Plano de voo excluído!');
      
      // Atualizar lista local
      await fetchFlightPlans();

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao excluir plano de voo';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Error deleting flight plan:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFlightPlans]);

  // Buscar plano por ID
  const getFlightPlanById = useCallback(async (id: string): Promise<FlightPlan | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('flight_plans')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      return {
        ...data,
        status: (data.situacao as 'draft' | 'filed' | 'approved' | 'completed' | 'cancelled') || 'draft',
        calculations: data.calculations as any,
        validation: data.validation_data as any,
        weather: data.weather_data as any,
      } as FlightPlan;
    } catch (err) {
      console.error('Error fetching flight plan:', err);
      return null;
    }
  }, []);

  // Buscar planos por status
  const getFlightPlansByStatus = useCallback(async (
    status: 'draft' | 'filed' | 'approved' | 'completed' | 'cancelled'
  ): Promise<FlightPlan[]> => {
    if (!user) return [];

    try {
      const { data, error: fetchError } = await supabase
        .from('flight_plans')
        .select('*')
        .eq('created_by', user.id)
        .eq('situacao', status)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      return (data || []).map(plan => ({
        ...plan,
        status: (plan.situacao as 'draft' | 'filed' | 'approved' | 'completed' | 'cancelled') || 'draft',
        calculations: plan.calculations as any,
        validation: plan.validation_data as any,
        weather: plan.weather_data as any,
      } as FlightPlan));
    } catch (err) {
      console.error('Error fetching flight plans by status:', err);
      return [];
    }
  }, [user]);

  // Buscar planos por aeródromo
  const getFlightPlansByAirport = useCallback(async (
    airport: string,
    type: 'departure' | 'arrival' = 'departure'
  ): Promise<FlightPlan[]> => {
    if (!user) return [];

    try {
      const column = type === 'departure' ? 'departure_airport' : 'arrival_airport';

      const { data, error: fetchError } = await supabase
        .from('flight_plans')
        .select('*')
        .eq('created_by', user.id)
        .eq(column, airport)
        .order('flight_date', { ascending: false });

      if (fetchError) throw fetchError;

      return (data || []).map(plan => ({
        ...plan,
        status: (plan.situacao as 'draft' | 'filed' | 'approved' | 'completed' | 'cancelled') || 'draft',
        calculations: plan.calculations as any,
        validation: plan.validation_data as any,
        weather: plan.weather_data as any,
      } as FlightPlan));
    } catch (err) {
      console.error('Error fetching flight plans by airport:', err);
      return [];
    }
  }, [user]);

  // Carregar planos ao montar
  useEffect(() => {
    if (user) {
      fetchFlightPlans();
    }
  }, [user, fetchFlightPlans]);

  return {
    flightPlans,
    loading,
    error,
    createFlightPlan,
    updateFlightPlan,
    deleteFlightPlan,
    getFlightPlanById,
    getFlightPlansByStatus,
    getFlightPlansByAirport,
    refreshFlightPlans: fetchFlightPlans,
  };
}
