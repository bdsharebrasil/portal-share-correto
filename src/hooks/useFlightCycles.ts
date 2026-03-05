import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FlightCycle, FlightExpense, EXPENSE_TYPES, ExpenseCategory } from '@/types/flightCycle';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';

export function useFlightCycles() {
  const [cycles, setCycles] = useState<FlightCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('flight_cycles')
        .select(`
          *,
          client:clients(company_name, proprietario),
          aircraft:aircraft(registration, model),
          expenses:flight_expenses(*)
        `)
        .order('flight_date', { ascending: false });

      if (error) throw error;
      setCycles((data || []) as FlightCycle[]);
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
      const { data: cycle, error } = await supabase
        .from('flight_cycles')
        .insert([cycleData as any])
        .select()
        .single();

      if (error) throw error;

      // Generate automatic checklist
      await generateChecklist(cycle as FlightCycle);
      
      toast.success('Ciclo de voo criado com sucesso!');
      await fetchCycles();
      return cycle;
    } catch (err: any) {
      toast.error('Erro ao criar ciclo de voo');
      throw err;
    }
  };

  const generateChecklist = async (cycle: FlightCycle) => {
    const expenses: Partial<FlightExpense>[] = [];
    const flightDate = new Date(cycle.flight_date);

    // SEMPRE adiciona Tarifa DECEA
    expenses.push({
      flight_cycle_id: cycle.id,
      expense_type: 'tarifa_decea',
      expense_category: 'regulatoria',
      expense_name: EXPENSE_TYPES.tarifa_decea.name,
      status: 'aguardando',
      expected_date: format(addDays(flightDate, 30), 'yyyy-MM-dd'),
      deadline_days: 30,
    });

    // SE aeroporto controlado → Adiciona Tarifa Infraero
    if (cycle.is_controlled_airport) {
      expenses.push({
        flight_cycle_id: cycle.id,
        expense_type: 'tarifa_infraero',
        expense_category: 'regulatoria',
        expense_name: EXPENSE_TYPES.tarifa_infraero.name,
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 30), 'yyyy-MM-dd'),
        deadline_days: 30,
      });
    }

    // SE pernoite → Adiciona Hospedagem e Alimentação
    if (cycle.has_overnight || cycle.flight_type === 'pernoite') {
      expenses.push({
        flight_cycle_id: cycle.id,
        expense_type: 'hospedagem',
        expense_category: 'relatorio_viagem',
        expense_name: EXPENSE_TYPES.hospedagem.name,
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 3), 'yyyy-MM-dd'),
        deadline_days: 3,
      });
      expenses.push({
        flight_cycle_id: cycle.id,
        expense_type: 'alimentacao',
        expense_category: 'relatorio_viagem',
        expense_name: EXPENSE_TYPES.alimentacao.name,
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 3), 'yyyy-MM-dd'),
        deadline_days: 3,
      });
    }

    // SE hangar particular → Adiciona Diária de Hangar
    if (cycle.has_private_hangar) {
      expenses.push({
        flight_cycle_id: cycle.id,
        expense_type: 'hangar_particular',
        expense_category: 'variavel',
        expense_name: EXPENSE_TYPES.hangar_particular.name,
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 5), 'yyyy-MM-dd'),
        deadline_days: 5,
      });
    }

    // SE duração > 4 horas → Adiciona Combustível Adicional
    if (cycle.flight_duration_hours && cycle.flight_duration_hours > 4) {
      expenses.push({
        flight_cycle_id: cycle.id,
        expense_type: 'combustivel_emergencia',
        expense_category: 'imediata',
        expense_name: EXPENSE_TYPES.combustivel_emergencia.name,
        status: 'aguardando',
        expected_date: format(addDays(flightDate, 7), 'yyyy-MM-dd'),
        deadline_days: 7,
      });
    }

    if (expenses.length > 0) {
      const { error } = await supabase.from('flight_expenses').insert(expenses as any[]);
      if (error) console.error('Error creating expenses:', error);
    }
  };

  const updateCycleStatus = async (cycleId: string, status: FlightCycle['status']) => {
    try {
      const updateData: any = { status };
      
      if (status === 'em_execucao') updateData.started_at = new Date().toISOString();
      if (status === 'concluido') updateData.completed_at = new Date().toISOString();
      if (status === 'aguardando_despesas') {
        updateData.completed_at = new Date().toISOString();
        updateData.return_date = new Date().toISOString().split('T')[0];
      }
      if (status === 'finalizado') updateData.finalized_at = new Date().toISOString();

      const { error } = await supabase
        .from('flight_cycles')
        .update(updateData)
        .eq('id', cycleId);

      if (error) throw error;
      
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao atualizar status');
    }
  };

  const updateExpenseStatus = async (expenseId: string, status: FlightExpense['status'], additionalData?: Partial<FlightExpense>) => {
    try {
      const updateData: any = { status, ...additionalData };
      
      if (status === 'recebida' && !additionalData?.received_date) {
        updateData.received_date = format(new Date(), 'yyyy-MM-dd');
      }
      if (status === 'enviada' && !additionalData?.sent_to_client_date) {
        updateData.sent_to_client_date = format(new Date(), 'yyyy-MM-dd');
      }
      if (status === 'paga' && !additionalData?.payment_date) {
        updateData.payment_date = format(new Date(), 'yyyy-MM-dd');
      }

      const { error } = await supabase
        .from('flight_expenses')
        .update(updateData)
        .eq('id', expenseId);

      if (error) throw error;
      
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao atualizar despesa');
    }
  };

  const addManualExpense = async (cycleId: string, expenseData: Partial<FlightExpense>) => {
    try {
      const { error } = await supabase
        .from('flight_expenses')
        .insert([{
          flight_cycle_id: cycleId,
          ...expenseData,
        } as any]);

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
        .from('flight_cycles')
        .update(updates)
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
      const { error } = await supabase
        .from('flight_cycles')
        .delete()
        .eq('id', cycleId);

      if (error) throw error;

      toast.success('Ciclo excluído!');
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao excluir ciclo');
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase
        .from('flight_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      toast.success('Despesa excluída!');
      await fetchCycles();
    } catch (err: any) {
      toast.error('Erro ao excluir despesa');
    }
  };

  // Calculate statistics
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
