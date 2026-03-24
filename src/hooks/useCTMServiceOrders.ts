import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fromUntyped } from '@/lib/supabase-helpers';
import { toast } from 'sonner';

export interface CTMMaintenanceCategory {
  id: string;
  nome: string;
  descricao?: string;
  intervalo_horas?: number;
  intervalo_meses?: number;
  cor?: string;
  icone?: string;
  ativo?: boolean;
}

export interface CTMServiceOrder {
  id: string;
  aircraft_id: string;
  numero: string;
  os_oficina?: string;
  horas_celula?: number;
  tipo_manutencao: 'CORRETIVA' | 'PREVENTIVA' | 'REVISÃO';
  periodo?: string;
  objetivo?: 'CÉLULA' | 'MOTOR' | 'AVIONICS' | 'ESTRUTURA' | string;
  oficina_nome?: string;
  oficina_contato?: string;
  dias_previstos?: number;
  dias_efetivos?: number;
  data_entrada?: string;
  data_saida?: string;
  status?: string;
  observacoes?: string;
  description?: string;
  assigned_to?: string;
  scheduled_date?: string;
  completion_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  vencimento_id?: string;
  total_mao_obra?: number;
  total_pecas?: number;
  total_geral?: number;
  tipo_rateio?: 'HORAS' | 'PERCENTUAL';
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface CTMService {
  id: string;
  service_order_id: string;
  descricao: string;
  description?: string;
  fornecedor?: string;
  periodo?: string;
  valor?: number;
  cost?: number;
  hours?: number;
  completed?: boolean;
  categoria?: string;
  nota_fiscal?: string;
  data_execucao?: string;
  observacoes?: string;
  created_at: string;
}

export interface CTMPart {
  id: string;
  service_order_id: string;
  descricao: string;
  description?: string;
  part_number?: string;
  serial_number?: string;
  fornecedor?: string;
  quantidade?: number;
  quantity?: number;
  valor_unitario?: number;
  unit_cost?: number;
  valor_total?: number;
  total_cost?: number;
  nota_fiscal?: string;
  data_compra?: string;
  garantia_meses?: number;
  observacoes?: string;
  created_at: string;
}

export interface CTMFlightReport {
  id: string;
  aircraft_id: string;
  flight_date?: string;
  date?: string;
  pilot?: string;
  pilot_name?: string;
  flight_hours?: number;
  observations?: string;
  created_at: string;
}

export interface CTMCostSharing {
  id: string;
  service_order_id: string;
  client_id: string;
  horas_voadas?: number;
  percentual?: number;
  percentage?: number;
  valor?: number;
  amount?: number;
  status_pagamento?: 'pendente' | 'pago' | 'cancelado';
  data_pagamento?: string;
  comprovante_url?: string;
  created_at: string;
  updated_at: string;
}

export function useCTMServiceOrders() {
  const loadCategories = useCallback(async (): Promise<CTMMaintenanceCategory[]> => {
    try {
      const { data, error } = await supabase
        .from('ctm_maintenance_categories')
        .select('id, nome, descricao, intervalo_horas, intervalo_meses, cor, icone, ativo')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error loading categories:', errorMessage);
      toast.error('Erro ao carregar categorias de manutenção');
      return [];
    }
  }, []);

  const loadServiceOrders = useCallback(
    async (aircraftId: string): Promise<CTMServiceOrder[]> => {
      try {
        const { data, error } = await supabase
          .from('ctm_service_orders')
          .select('*')
          .eq('aircraft_id', aircraftId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []) as CTMServiceOrder[];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error loading service orders:', errorMessage);
        toast.error('Erro ao carregar ordens de serviço');
        return [];
      }
    },
    []
  );

  const loadServiceOrderDetails = useCallback(
    async (serviceOrderId: string) => {
      try {
        const [orderRes, servicesRes, partsRes, flightReportsRes, costSharingRes] = await Promise.all([
          supabase
            .from('ctm_service_orders')
            .select('*')
            .eq('id', serviceOrderId)
            .single(),
          supabase
            .from('ctm_services')
            .select('*')
            .eq('service_order_id', serviceOrderId),
          supabase
            .from('ctm_parts')
            .select('*')
            .eq('service_order_id', serviceOrderId),
          supabase
            .from('ctm_flight_reports')
            .select('*')
            .eq('service_order_id', serviceOrderId),
          supabase
            .from('ctm_cost_sharing')
            .select('*')
            .eq('service_order_id', serviceOrderId),
        ]);

        if (orderRes.error) throw orderRes.error;

        return {
          order: orderRes.data,
          services: servicesRes.data || [],
          parts: partsRes.data || [],
          flightReports: flightReportsRes.data || [],
          costSharing: costSharingRes.data || [],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error loading service order details:', errorMessage);
        toast.error('Erro ao carregar detalhes da ordem de serviço');
        return {
          order: null,
          services: [],
          parts: [],
          flightReports: [],
          costSharing: [],
        };
      }
    },
    []
  );

  const createServiceOrder = useCallback(async (data: Partial<CTMServiceOrder>) => {
    try {
      // 1. Create in ctm_service_orders
      const { data: newOrder, error } = await supabase
        .from('ctm_service_orders')
        .insert([data as any])
        .select()
        .single();

      if (error) throw error;

      // 2. Create synchronization record in manutencoes
      if (newOrder && data.aircraft_id) {
        const maintenanceType = data.tipo_manutencao || data.objetivo || 'MANUTENÇÃO';
        const dataEntrada = data.data_entrada || new Date().toISOString().split('T')[0];

        const { error: manutencaoError } = await supabase
          .from('manutencoes')
          .insert([
            {
              aeronave_id: data.aircraft_id,
              tipo: maintenanceType,
              data_programada: dataEntrada,
              mecanico: data.assigned_to || 'A designar',
              etapa: 'em_andamento',
              oficina: data.oficina_nome || null,
              observacoes: data.observacoes || null,
              custo_estimado: data.total_geral || null,
              vencimento_tipo: 'horas',
              vencimento_horas: data.horas_celula || data.estimated_hours || null,
            }
          ]);

        if (manutencaoError) {
          console.error('Erro ao criar registro em manutencoes:', manutencaoError);
        }
      }

      // 3. Create synchronization record in aircraft_maintenance_records
      if (newOrder && data.aircraft_id) {
        // Map OAS maintenance type to valid aircraft_maintenance_records types (50h, 100h, 150h, 200h)
        const mapMaintenanceType = (tipo?: string, horas?: number): string => {
          if (!tipo && !horas) return '100h'; // default

          // If tipo contains hour info, extract it
          if (tipo?.includes('50')) return '50h';
          if (tipo?.includes('100')) return '100h';
          if (tipo?.includes('150')) return '150h';
          if (tipo?.includes('200')) return '200h';

          // If horas is provided, map accordingly
          if (horas) {
            if (horas <= 50) return '50h';
            if (horas <= 100) return '100h';
            if (horas <= 150) return '150h';
            return '200h';
          }

          return '100h'; // default fallback
        };

        const performedHours = data.horas_celula || data.estimated_hours || 0;
        const maintenanceType = mapMaintenanceType(data.tipo_manutencao, performedHours);

        const { error: recordError } = await supabase
          .from('aircraft_maintenance_records')
          .insert([
            {
              aircraft_id: data.aircraft_id,
              maintenance_type: maintenanceType,
              performed_at_hours: performedHours,
              performed_date: data.data_entrada || new Date().toISOString().split('T')[0],
              next_due_hours: performedHours + 50, // próxima manutenção será em 50h a mais
              mechanic_name: data.assigned_to || 'A designar',
              maintenance_center: data.oficina_nome || null,
              service_order_number: data.numero || null,
              description: data.observacoes || null,
              cost: data.total_geral || null,
            }
          ]);

        if (recordError) {
          console.error('Erro ao criar registro em aircraft_maintenance_records:', recordError);
        }
      }

      toast.success('Ordem de serviço criada com sucesso');
      return newOrder;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error creating service order:', errorMessage);
      toast.error('Erro ao criar ordem de serviço');
      return null;
    }
  }, []);

  const updateServiceOrder = useCallback(async (id: string, data: Partial<CTMServiceOrder>) => {
    try {
      const { data: updated, error } = await supabase
        .from('ctm_service_orders')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Ordem de serviço atualizada com sucesso');
      return updated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error updating service order:', errorMessage);
      toast.error('Erro ao atualizar ordem de serviço');
      return null;
    }
  }, []);

  const deleteServiceOrder = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('ctm_service_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Ordem de serviço deletada com sucesso');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error deleting service order:', errorMessage);
      toast.error('Erro ao deletar ordem de serviço');
      return false;
    }
  }, []);

  const generateBudgetFromOAS = useCallback(
    async (oasId: string, userId?: string) => {
      try {
        // Load OAS details
        const { data: order, error: orderError } = await supabase
          .from('ctm_service_orders')
          .select('*')
          .eq('id', oasId)
          .single();

        if (orderError) throw orderError;

        // Create new budget with data from OAS
        const { data: newBudget, error: budgetError } = await fromUntyped('ctm_budgets')
          .insert([
            {
              aircraft_id: order.aircraft_id,
              description: `Orçamento - OAS ${order.numero}`,
              status: 'draft',
              total_value: order.total_geral || 0,
              created_by: userId,
              service_order_id: oasId,
            },
          ])
          .select()
          .single();

        if (budgetError) throw budgetError;

        // Create linking record
        if (newBudget) {
          const { error: linkError } = await fromUntyped('ctm_service_order_budgets')
            .insert([
              {
                service_order_id: oasId,
                budget_id: newBudget.id,
                status: 'draft',
                version: 1,
                created_by: userId,
              },
            ]);

          if (linkError) throw linkError;
        }

        toast.success('Orçamento gerado a partir da OAS com sucesso');
        return newBudget;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error generating budget from OAS:', errorMessage);
        toast.error('Erro ao gerar orçamento a partir da OAS');
        return null;
      }
    },
    []
  );

  const linkBudgetToOAS = useCallback(
    async (oasId: string, budgetId: string, version: number = 1, userId?: string, notes?: string) => {
      try {
        // Check if linking already exists
        const { data: existing } = await fromUntyped('ctm_service_order_budgets')
          .select('id')
          .eq('service_order_id', oasId)
          .eq('budget_id', budgetId)
          .single();

        if (existing) {
          toast.error('Este orçamento já está linkado a esta OAS');
          return null;
        }

        // Create linking record
        const { data, error } = await fromUntyped('ctm_service_order_budgets')
          .insert([
            {
              service_order_id: oasId,
              budget_id: budgetId,
              status: 'draft',
              version,
              created_by: userId,
              approval_notes: notes,
            },
          ])
          .select()
          .single();

        if (error) throw error;

        toast.success('Orçamento linkado a OAS com sucesso');
        return data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error linking budget to OAS:', errorMessage);
        toast.error('Erro ao linkar orçamento a OAS');
        return null;
      }
    },
    []
  );

  const getLinkedBudgets = useCallback(
    async (oasId: string) => {
      try {
        const { data, error } = await fromUntyped('ctm_service_order_budgets')
          .select('*, budget:ctm_budgets(*)')
          .eq('service_order_id', oasId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error('Error loading linked budgets:', errorMessage);
        return [];
      }
    },
    []
  );

  return {
    loadCategories,
    loadServiceOrders,
    loadServiceOrderDetails,
    createServiceOrder,
    updateServiceOrder,
    deleteServiceOrder,
    generateBudgetFromOAS,
    linkBudgetToOAS,
    getLinkedBudgets,
  };
}
