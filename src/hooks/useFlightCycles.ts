// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FlightCycle, FlightExpense, EXPENSE_TYPES, ExpenseCategory } from '@/types/flightCycle';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';

// ---- Mapping helpers (DB PT-BR <-> UI EN) ----
const expenseTypeName = (key: string) =>
  (EXPENSE_TYPES as any)[key]?.name ?? (EXPENSE_TYPES as any)[key]?.nome ?? key;

const mapCycleToDb = (c: Partial<FlightCycle>): any => {
  const out: any = {};
  if (c.client_id !== undefined) out.cliente_id = c.client_id;
  if (c.aeronave_id !== undefined) out.aeronave_id = c.aeronave_id;
  if ((c as any).partner_id !== undefined) out.socio_id = (c as any).partner_id;
  if (c.origin_icao !== undefined) out.icao_origem = c.origin_icao;
  if (c.destination_icao !== undefined) out.icao_destino = c.destination_icao;
  if (c.flight_date !== undefined) out.data_voo = c.flight_date;
  if (c.return_date !== undefined) out.data_retorno = c.return_date;
  if (c.flight_type !== undefined) out.tipo_voo = c.flight_type;
  if (c.has_overnight !== undefined) out.pernoite = c.has_overnight;
  if (c.is_controlled_airport !== undefined) out.aeroporto_controlado = c.is_controlled_airport;
  if (c.has_private_hangar !== undefined) out.hangar_privado = c.has_private_hangar;
  if (c.flight_duration_hours !== undefined) out.duracao_horas = c.flight_duration_hours;
  if (c.status !== undefined) out.status = c.status;
  if (c.responsible_user_id !== undefined) out.responsavel_id = c.responsible_user_id;
  if (c.observations !== undefined) out.observacoes = c.observations;
  if (c.pic_name !== undefined) out.nome_pic = c.pic_name;
  if (c.sic_name !== undefined) out.nome_sic = c.sic_name;
  if (c.partner_name !== undefined) out.nome_socio = c.partner_name;
  if ((c as any).started_at !== undefined) out.iniciado_em = (c as any).started_at;
  if ((c as any).completed_at !== undefined) out.concluido_em = (c as any).completed_at;
  if ((c as any).finalized_at !== undefined) out.finalizado_em = (c as any).finalized_at;
  return out;
};

const mapCycleFromDb = (r: any): FlightCycle => ({
  id: r.id,
  client_id: r.cliente_id ?? null,
  partner_id: r.socio_id ?? null,
  aeronave_id: r.aeronave_id ?? null,
  origin_icao: r.icao_origem ?? '',
  destination_icao: r.icao_destino ?? '',
  flight_date: r.data_voo,
  return_date: r.data_retorno ?? null,
  flight_type: r.tipo_voo,
  has_overnight: !!r.pernoite,
  is_controlled_airport: !!r.aeroporto_controlado,
  has_private_hangar: !!r.hangar_privado,
  flight_duration_hours: r.duracao_horas ?? null,
  status: r.status,
  responsible_user_id: r.responsavel_id ?? null,
  observations: r.observacoes ?? null,
  pic_name: r.nome_pic ?? null,
  sic_name: r.nome_sic ?? null,
  partner_name: r.nome_socio ?? null,
  created_at: r.criado_em,
  updated_at: r.atualizado_em,
  started_at: r.iniciado_em ?? null,
  completed_at: r.concluido_em ?? null,
  finalized_at: r.finalizado_em ?? null,
  client: r.client
    ? { company_name: r.client.razao_social, proprietario: r.client.proprietario }
    : undefined,
  aircraft: r.aircraft
    ? { matricula: r.aircraft.matricula, modelo: r.aircraft.modelo }
    : undefined,
  expenses: (r.expenses || []).map(mapExpenseFromDb),
});

const mapExpenseToDb = (e: Partial<FlightExpense>): any => {
  const out: any = {};
  if ((e as any).flight_cycle_id !== undefined) out.ciclo_voo_id = (e as any).flight_cycle_id;
  if (e.expense_type !== undefined) out.tipo_despesa = e.expense_type;
  if (e.expense_category !== undefined) out.categoria_despesa = e.expense_category;
  if (e.expense_name !== undefined) out.nome_despesa = e.expense_name;
  if (e.status !== undefined) out.status = e.status;
  if (e.expected_date !== undefined) out.data_prevista = e.expected_date;
  if (e.received_date !== undefined) out.data_recebida = e.received_date;
  if (e.sent_to_client_date !== undefined) out.data_envio_cliente = e.sent_to_client_date;
  if (e.payment_date !== undefined) out.data_pagamento = e.payment_date;
  if (e.amount !== undefined) out.valor = e.amount;
  if (e.observations !== undefined) out.observacoes = e.observations;
  if (e.attachment_url !== undefined) out.url_anexo = e.attachment_url;
  if (e.deadline_days !== undefined) out.prazo_dias = e.deadline_days;
  return out;
};

const mapExpenseFromDb = (r: any): FlightExpense => ({
  id: r.id,
  flight_cycle_id: r.ciclo_voo_id,
  expense_type: r.tipo_despesa,
  expense_category: r.categoria_despesa,
  expense_name: r.nome_despesa,
  status: r.status,
  expected_date: r.data_prevista ?? null,
  received_date: r.data_recebida ?? null,
  sent_to_client_date: r.data_envio_cliente ?? null,
  payment_date: r.data_pagamento ?? null,
  amount: r.valor ?? null,
  observations: r.observacoes ?? null,
  attachment_url: r.url_anexo ?? null,
  deadline_days: r.prazo_dias ?? 0,
  created_at: r.criado_em,
  updated_at: r.atualizado_em,
});

export function useFlightCycles() {
  const [cycles, setCycles] = useState<FlightCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ciclos_voo')
        .select(`
          *,
          client:clientes(razao_social, proprietario),
          aircraft:aeronave(matricula, modelo),
          expenses:despesas_voo(*)
        `)
        .order('data_voo', { ascending: false });

      if (error) throw error;
      setCycles((data || []).map(mapCycleFromDb));
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching flight cycles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  const createCycle = async (cycleData: Partial<FlightCycle>) => {
    try {
      const { data: row, error } = await supabase
        .from('ciclos_voo')
        .insert([mapCycleToDb(cycleData)])
        .select()
        .single();

      if (error) throw error;

      const cycle = mapCycleFromDb(row);
      await generateChecklist(cycle);

      toast.success('Ciclo de voo criado com sucesso!');
      await fetchCycles();
      return cycle;
    } catch (err: any) {
      toast.error('Erro ao criar ciclo de voo');
      throw err;
    }
  };

  const generateChecklist = async (cycle: FlightCycle) => {
    const expenses: any[] = [];
    const flightDate = new Date(cycle.flight_date);

    expenses.push(mapExpenseToDb({
      flight_cycle_id: cycle.id,
      expense_type: 'tarifa_decea',
      expense_category: 'regulatoria',
      expense_name: expenseTypeName('tarifa_decea'),
      status: 'aguardando',
      expected_date: format(addDays(flightDate, 30), 'yyyy-MM-dd'),
      deadline_days: 30,
    }));

    if (cycle.is_controlled_airport) {
      expenses.push(mapExpenseToDb({
        flight_cycle_id: cycle.id,
        expense_type: 'tarifa_infraero',
        expense_category: 'regulatoria',
        expense_name: expenseTypeName('tarifa_infraero'),
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 30), 'yyyy-MM-dd'),
        deadline_days: 30,
      }));
    }

    if (cycle.has_overnight || cycle.flight_type === 'pernoite') {
      expenses.push(mapExpenseToDb({
        flight_cycle_id: cycle.id,
        expense_type: 'hospedagem',
        expense_category: 'relatorio_viagem',
        expense_name: expenseTypeName('hospedagem'),
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 3), 'yyyy-MM-dd'),
        deadline_days: 3,
      }));
      expenses.push(mapExpenseToDb({
        flight_cycle_id: cycle.id,
        expense_type: 'alimentacao',
        expense_category: 'relatorio_viagem',
        expense_name: expenseTypeName('alimentacao'),
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 3), 'yyyy-MM-dd'),
        deadline_days: 3,
      }));
    }

    if (cycle.has_private_hangar) {
      expenses.push(mapExpenseToDb({
        flight_cycle_id: cycle.id,
        expense_type: 'hangar_particular',
        expense_category: 'variavel',
        expense_name: expenseTypeName('hangar_particular'),
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 5), 'yyyy-MM-dd'),
        deadline_days: 5,
      }));
    }

    if (cycle.flight_duration_hours && cycle.flight_duration_hours > 4) {
      expenses.push(mapExpenseToDb({
        flight_cycle_id: cycle.id,
        expense_type: 'combustivel_emergencia',
        expense_category: 'imediata',
        expense_name: expenseTypeName('combustivel_emergencia'),
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 7), 'yyyy-MM-dd'),
        deadline_days: 7,
      }));
    }

    if (expenses.length > 0) {
      const { error } = await supabase.from('despesas_voo').insert(expenses);
      if (error) console.error('Error creating expenses:', error);
    }
  };

  const updateCycleStatus = async (cycleId: string, status: FlightCycle['status']) => {
    try {
      const updateData: any = { status };

      if (status === 'em_execucao') updateData.iniciado_em = new Date().toISOString();
      if (status === 'concluido') updateData.concluido_em = new Date().toISOString();
      if (status === 'aguardando_despesas') {
        updateData.concluido_em = new Date().toISOString();
        updateData.data_retorno = new Date().toISOString().split('T')[0];
      }
      if (status === 'finalizado') updateData.finalizado_em = new Date().toISOString();

      const { error } = await supabase
        .from('ciclos_voo')
        .update(updateData)
        .eq('id', cycleId);

      if (error) throw error;
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao atualizar status');
    }
  };

  const updateExpenseStatus = async (
    expenseId: string,
    status: FlightExpense['status'],
    additionalData?: Partial<FlightExpense>
  ) => {
    try {
      const merged: Partial<FlightExpense> = { status, ...additionalData };

      if (status === 'recebida' && !additionalData?.received_date) {
        merged.received_date = format(new Date(), 'yyyy-MM-dd');
      }
      if (status === 'enviada' && !additionalData?.sent_to_client_date) {
        merged.sent_to_client_date = format(new Date(), 'yyyy-MM-dd');
      }
      if (status === 'paga' && !additionalData?.payment_date) {
        merged.payment_date = format(new Date(), 'yyyy-MM-dd');
      }

      const { error } = await supabase
        .from('despesas_voo')
        .update(mapExpenseToDb(merged))
        .eq('id', expenseId);

      if (error) throw error;
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao atualizar despesa');
    }
  };

  const addManualExpense = async (cycleId: string, expenseData: Partial<FlightExpense>) => {
    try {
      const payload = mapExpenseToDb({ ...expenseData, flight_cycle_id: cycleId } as any);
      const { error } = await supabase.from('despesas_voo').insert([payload]);

      if (error) throw error;
      toast.success('Despesa adicionada!');
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao adicionar despesa');
    }
  };

  const updateCycle = async (cycleId: string, updates: Partial<FlightCycle>) => {
    try {
      const { error } = await supabase
        .from('ciclos_voo')
        .update(mapCycleToDb(updates))
        .eq('id', cycleId);

      if (error) throw error;
      toast.success('Ciclo atualizado com sucesso!');
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao atualizar ciclo');
      throw err;
    }
  };

  const deleteCycle = async (cycleId: string) => {
    try {
      const { error } = await supabase.from('ciclos_voo').delete().eq('id', cycleId);
      if (error) throw error;
      toast.success('Ciclo excluído!');
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao excluir ciclo');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase.from('despesas_voo').delete().eq('id', expenseId);
      if (error) throw error;
      toast.success('Despesa excluída!');
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao excluir despesa');
    }
  };

  const getStatistics = useCallback(() => {
    const activeFlights = cycles.filter(c => !['finalizado'].includes(c.status)).length;
    const completedFlights = cycles.filter(c => c.status === 'finalizado').length;

    let overdueExpenses = 0;
    let pendingExpenses = 0;

    cycles.forEach(cycle => {
      cycle.expenses?.forEach(expense => {
        if (expense.status === 'atrasada') overdueExpenses++;
        if (['aguardando', 'recebida', 'enviada'].includes(expense.status)) pendingExpenses++;
      });
    });

    return { activeFlights, completedFlights, overdueExpenses, pendingExpenses };
  }, [cycles]);

  return {
    cycles,
    loading,
    error,
    fetchCycles,
    createCycle,
    updateCycle,
    updateCycleStatus,
    updateExpenseStatus,
    addManualExpense,
    deleteExpense,
    deleteCycle,
    getStatistics,
  };
}
