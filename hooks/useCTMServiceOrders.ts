import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data: newOrder, error } = await supabase
        .from('ctm_service_orders')
        .insert([data as any])
        .select()
        .single();

      if (error) throw error;
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

  return {
    loadCategories,
    loadServiceOrders,
    loadServiceOrderDetails,
    createServiceOrder,
    updateServiceOrder,
    deleteServiceOrder,
  };
}
