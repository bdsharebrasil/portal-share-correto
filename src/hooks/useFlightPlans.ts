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
  solicitacao_id: string | null;
  numero_voo: string | null;
  flight_rule: 'V' | 'I' | 'Y' | 'Z' | null;
  calculations?: any;
  validation?: any;
  weather?: any;
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
  solicitacao_id?: string;
  numero_voo?: string;
  flight_rule?: 'V' | 'I' | 'Y' | 'Z';
}

// Table is named `planos_voo` in DB with Portuguese columns.
const TABLE = 'planos_voo' as any;

function rowToPlan(row: any): FlightPlan {
  return {
    id: row.id,
    flight_date: row.data_voo,
    departure_airport: row.aeroporto_partida,
    arrival_airport: row.aeroporto_chegada,
    aeronave_id: row.aeronave_id ?? null,
    pilot_in_command: row.comandante,
    alternate_airport: row.aeroporto_alternativa ?? null,
    cruise_altitude: row.altitude_cruzeiro ?? null,
    estimated_time: row.tempo_estimado ?? null,
    fuel_endurance: row.autonomia_combustivel ?? null,
    route: row.rota ?? null,
    remarks: row.observacoes ?? null,
    status: (row.status as FlightPlan['status']) || 'draft',
    created_by: row.criado_por ?? null,
    created_at: row.criado_em,
    updated_at: row.atualizado_em,
    flight_schedule_id: row.ciclo_voo_id ?? null,
    solicitacao_id: row.solicitacao_id ?? null,
    numero_voo: row.numero_voo ?? null,
    flight_rule: row.regra_voo ?? null,
    calculations: row.calculos ?? undefined,
    validation: row.dados_validacao ?? undefined,
    weather: row.dados_meteorologicos ?? undefined,
  };
}

function inputToRow(input: Partial<CreateFlightPlanInput>): Record<string, any> {
  const out: Record<string, any> = {};
  if (input.flight_date !== undefined) out.data_voo = input.flight_date;
  if (input.departure_airport !== undefined) out.aeroporto_partida = input.departure_airport;
  if (input.arrival_airport !== undefined) out.aeroporto_chegada = input.arrival_airport;
  if (input.aeronave_id !== undefined) out.aeronave_id = input.aeronave_id || null;
  if (input.pilot_in_command !== undefined) out.comandante = input.pilot_in_command;
  if (input.alternate_airport !== undefined) out.aeroporto_alternativa = input.alternate_airport || null;
  if (input.cruise_altitude !== undefined) out.altitude_cruzeiro = input.cruise_altitude || null;
  if (input.estimated_time !== undefined) out.tempo_estimado = input.estimated_time || null;
  if (input.fuel_endurance !== undefined) out.autonomia_combustivel = input.fuel_endurance || null;
  if (input.route !== undefined) out.rota = input.route || null;
  if (input.remarks !== undefined) out.observacoes = input.remarks || null;
  if (input.status !== undefined) out.status = input.status;
  if (input.calculations !== undefined) out.calculos = input.calculations;
  if (input.validation !== undefined) out.dados_validacao = input.validation;
  if (input.weather !== undefined) out.dados_meteorologicos = input.weather;
  if (input.solicitacao_id !== undefined) out.solicitacao_id = input.solicitacao_id || null;
  if (input.numero_voo !== undefined) out.numero_voo = input.numero_voo || null;
  if (input.flight_rule !== undefined) out.regra_voo = input.flight_rule || null;
  return out;
}

export function useFlightPlans() {
  const { user } = useAuth();
  const [flightPlans, setFlightPlans] = useState<FlightPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlightPlans = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await (supabase as any)
        .from(TABLE)
        .select('*')
        .eq('criado_por', user.id)
        .order('criado_em', { ascending: false });
      if (fetchError) throw fetchError;
      setFlightPlans((data || []).map(rowToPlan));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar planos de voo';
      setError(msg);
      console.error('Error fetching flight plans:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createFlightPlan = useCallback(async (input: CreateFlightPlanInput): Promise<FlightPlan | null> => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const row = { ...inputToRow(input), criado_por: user.id };
      const { data, error: insertError } = await (supabase as any)
        .from(TABLE)
        .insert([row])
        .select()
        .single();
      if (insertError) throw insertError;
      toast.success('Plano de voo salvo com sucesso!');
      await fetchFlightPlans();
      return rowToPlan(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar plano de voo';
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, fetchFlightPlans]);

  const updateFlightPlan = useCallback(async (id: string, updates: Partial<CreateFlightPlanInput>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const row = { ...inputToRow(updates), atualizado_em: new Date().toISOString() };
      const { error: updateError } = await (supabase as any).from(TABLE).update(row).eq('id', id);
      if (updateError) throw updateError;
      toast.success('Plano de voo atualizado!');
      await fetchFlightPlans();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar plano de voo';
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFlightPlans]);

  const deleteFlightPlan = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await (supabase as any).from(TABLE).delete().eq('id', id);
      if (deleteError) throw deleteError;
      toast.success('Plano de voo excluído!');
      await fetchFlightPlans();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir plano de voo';
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchFlightPlans]);

  const getFlightPlanById = useCallback(async (id: string): Promise<FlightPlan | null> => {
    try {
      const { data, error: fetchError } = await (supabase as any).from(TABLE).select('*').eq('id', id).single();
      if (fetchError) throw fetchError;
      return rowToPlan(data);
    } catch (err) {
      console.error('Error fetching flight plan:', err);
      return null;
    }
  }, []);

  const getFlightPlansByStatus = useCallback(async (status: FlightPlan['status']): Promise<FlightPlan[]> => {
    if (!user) return [];
    try {
      const { data, error: fetchError } = await (supabase as any)
        .from(TABLE).select('*').eq('criado_por', user.id).eq('status', status).order('criado_em', { ascending: false });
      if (fetchError) throw fetchError;
      return (data || []).map(rowToPlan);
    } catch (err) {
      console.error('Error fetching flight plans by status:', err);
      return [];
    }
  }, [user]);

  const getFlightPlansByAirport = useCallback(async (airport: string, type: 'departure' | 'arrival' = 'departure'): Promise<FlightPlan[]> => {
    if (!user) return [];
    try {
      const column = type === 'departure' ? 'aeroporto_partida' : 'aeroporto_chegada';
      const { data, error: fetchError } = await (supabase as any)
        .from(TABLE).select('*').eq('criado_por', user.id).eq(column, airport).order('data_voo', { ascending: false });
      if (fetchError) throw fetchError;
      return (data || []).map(rowToPlan);
    } catch (err) {
      console.error('Error fetching flight plans by airport:', err);
      return [];
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchFlightPlans();
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
