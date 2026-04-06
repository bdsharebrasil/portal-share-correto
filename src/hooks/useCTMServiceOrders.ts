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
  created_at?: string;
}

export interface Oficina {
  id: string;
  razao_social: string;
  cnpj?: string | null;
  endereco?: string | null;
  telefone: string | null;
  mecanico_responsavel: string | null;
  tipo_aeronave?: string | null;
  dados_pagamento?: string | null;
  ativo?: boolean;
}

export interface CTMServiceOrder {
  id: string;
  aeronave_id: string;
  numero: string;
  os_oficina?: string;
  horas_celula?: number;
  tipo_manutencao: 'CORRETIVA' | 'PREVENTIVA' | 'REVISÃO';
  periodo?: string;
  objetivo?: string;
  oficina_nome?: string;
  oficina_contato?: string;
  dias_previstos?: number;
  dias_efetivos?: number;
  data_entrada?: string;
  data_saida?: string;
  status?: string;
  situacao?: string;
  observacoes?: string;
  vencimento_id?: string;
  total_mao_obra?: number;
  total_pecas?: number;
  total_geral?: number;
  tipo_rateio?: 'HORAS' | 'PERCENTUAL';
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Campos de aprovação
  approval_status?: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_for_approval_at?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  // Período
  periodo_inicio?: string;
  periodo_fim?: string;
}

export interface CTMService {
  id: string;
  service_order_id: string;
  descricao: string;
  fornecedor?: string;
  periodo?: string;
  valor?: number;
  categoria?: string;
  nota_fiscal?: string;
  data_execucao?: string;
  observacoes?: string;
  created_at: string;
  modelo?: string;
  modo_pagamento?: string;
  dados_pagamento?: string;
  quantidade?: number;
  valor_unitario?: number;
  fornecedor_id?: string;
  condicoes_pagamento?: string;
  status?: 'pendente' | 'aprovado' | 'rejeitado' | 'concluido';
  quantidade_items?: number;
  p_n?: string;
  n_s?: string;
  numero_servico?: string;
  // Aprovação
  approval_status?: 'pendente' | 'aprovado' | 'rejeitado';
  submitted_at?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  // Financeiro
  payment_status?: string;
  payment_type?: string;
  financial_reference_id?: string;
  financial_reference_table?: string;
  // Cliente
  client_id?: string;
  client_partner_id?: string;
}

export interface CTMPart {
  id: string;
  service_order_id: string;
  descricao: string;
  part_number?: string;
  serial_number?: string;
  fornecedor?: string;
  quantidade?: number;
  valor_unitario?: number;
  valor_total?: number;
  nota_fiscal?: string;
  data_compra?: string;
  garantia_meses?: number;
  observacoes?: string;
  created_at: string;
  modelo?: string;
  modo_pagamento?: string;
  dados_pagamento?: string;
}

export interface CTMFlightReport {
  id: string;
  service_order_id: string;
  mes: string;
  ano: number;
  horas_oficina?: number;
  created_at: string;
}

export interface CTMCostSharing {
  id: string;
  service_order_id: string;
  client_id: string;
  horas_voadas?: number;
  percentual?: number;
  valor?: number;
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
          .from('service_orders')
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
            .from('service_orders')
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
          order: orderRes.data as CTMServiceOrder | null,
          services: (servicesRes.data || []) as CTMService[],
          parts: (partsRes.data || []) as CTMPart[],
          flightReports: (flightReportsRes.data || []) as CTMFlightReport[],
          costSharing: (costSharingRes.data || []) as CTMCostSharing[],
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
        .from('service_orders')
        .insert([data as any])
        .select()
        .single();

      if (error) throw error;

      // Sincronização com manutencoes
      if (newOrder && data.aeronave_id) {
        const maintenanceType = data.tipo_manutencao || data.objetivo || 'MANUTENÇÃO';
        const dataEntrada = data.data_entrada || new Date().toISOString().split('T')[0];

        const { error: manutencaoError } = await supabase
          .from('manutencoes')
          .insert([
            {
              aeronave_id: data.aeronave_id,
              tipo: maintenanceType,
              data_programada: dataEntrada,
              mecanico: 'A designar',
              etapa: 'em_andamento',
              oficina: data.oficina_nome || null,
              observacoes: data.observacoes || null,
              custo_estimado: data.total_geral || null,
              vencimento_tipo: 'horas',
              vencimento_horas: data.horas_celula || null,
            },
          ]);

        if (manutencaoError) {
          console.error('Erro ao criar registro em manutencoes:', manutencaoError);
        }
      }

      // Sincronização com aircraft_maintenance_records
      if (newOrder && data.aeronave_id) {
        const mapMaintenanceType = (tipo?: string, horas?: number): string => {
          if (!tipo && !horas) return '100h';
          if (tipo?.includes('50')) return '50h';
          if (tipo?.includes('100')) return '100h';
          if (tipo?.includes('150')) return '150h';
          if (tipo?.includes('200')) return '200h';
          if (horas) {
            if (horas <= 50) return '50h';
            if (horas <= 100) return '100h';
            if (horas <= 150) return '150h';
            return '200h';
          }
          return '100h';
        };

        const performedHours = data.horas_celula || 0;
        const maintenanceType = mapMaintenanceType(data.tipo_manutencao, performedHours);

        const { error: recordError } = await supabase
          .from('registros_manutencao_aeronave')
          .insert([
            {
              aeronave_id: data.aeronave_id,
              maintenance_type: maintenanceType,
              performed_at_hours: performedHours,
              performed_date: data.data_entrada || new Date().toISOString().split('T')[0],
              next_due_hours: performedHours + 50,
              mechanic_name: 'A designar',
              maintenance_center: data.oficina_nome || null,
              service_order_number: data.numero || null,
              description: data.observacoes || null,
              cost: data.total_geral || null,
            },
          ]);

        if (recordError) {
          console.error('Erro ao criar registro em aircraft_maintenance_records:', recordError);
        }
      }

      toast.success('Ordem de serviço criada com sucesso');
      return newOrder as CTMServiceOrder;
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
        .from('service_orders')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Ordem de serviço atualizada com sucesso');
      return updated as CTMServiceOrder;
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
        .from('service_orders')
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
        const { data: order, error: orderError } = await supabase
          .from('service_orders')
          .select('*')
          .eq('id', oasId)
          .single();

        if (orderError) throw orderError;

        const { data: newBudget, error: budgetError } = await fromUntyped('ctm_budgets')
          .insert([
            {
              aeronave_id: order.aeronave_id,
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
        const { data: existing } = await fromUntyped('ctm_service_order_budgets')
          .select('id')
          .eq('service_order_id', oasId)
          .eq('budget_id', budgetId)
          .single();

        if (existing) {
          toast.error('Este orçamento já está linkado a esta OAS');
          return null;
        }

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

  const loadOficinas = useCallback(async (): Promise<Oficina[]> => {
    try {
      const { data, error } = await supabase
        .from('oficinas')
        .select('id, razao_social, telefone, mecanico_responsavel, ativo')
        .eq('ativo', true)
        .order('razao_social');

      if (error) throw error;
      return data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error loading oficinas:', errorMessage);
      return [];
    }
  }, []);

  const createOficina = useCallback(async (oficina: Partial<Oficina>) => {
    try {
      const { data: newOficina, error } = await supabase
        .from('oficinas')
        .insert([
          {
            razao_social: oficina.razao_social,
            telefone: oficina.telefone || null,
            mecanico_responsavel: oficina.mecanico_responsavel || null,
            ativo: true,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      toast.success('Oficina criada com sucesso');
      return newOficina as Oficina;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error creating oficina:', errorMessage);
      toast.error('Erro ao criar oficina');
      return null;
    }
  }, []);

  // ─── CTMService CRUD ───────────────────────────────────────────────────────

  const createService = useCallback(async (data: Partial<CTMService>) => {
    try {
      const { data: newService, error } = await supabase
        .from('ctm_services')
        .insert([data as any])
        .select()
        .single();

      if (error) throw error;
      toast.success('Serviço adicionado com sucesso');
      return newService as CTMService;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error creating service:', errorMessage);
      toast.error('Erro ao adicionar serviço');
      return null;
    }
  }, []);

  const updateService = useCallback(async (id: string, data: Partial<CTMService>) => {
    try {
      const { data: updated, error } = await supabase
        .from('ctm_services')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Serviço atualizado com sucesso');
      return updated as CTMService;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error updating service:', errorMessage);
      toast.error('Erro ao atualizar serviço');
      return null;
    }
  }, []);

  const deleteService = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('ctm_services').delete().eq('id', id);
      if (error) throw error;
      toast.success('Serviço removido com sucesso');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error deleting service:', errorMessage);
      toast.error('Erro ao remover serviço');
      return false;
    }
  }, []);

  // ─── CTMPart CRUD ──────────────────────────────────────────────────────────

  const createPart = useCallback(async (data: Partial<CTMPart>) => {
    try {
      const { data: newPart, error } = await supabase
        .from('ctm_parts')
        .insert([data as any])
        .select()
        .single();

      if (error) throw error;
      toast.success('Peça adicionada com sucesso');
      return newPart as CTMPart;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error creating part:', errorMessage);
      toast.error('Erro ao adicionar peça');
      return null;
    }
  }, []);

  const updatePart = useCallback(async (id: string, data: Partial<CTMPart>) => {
    try {
      const { data: updated, error } = await supabase
        .from('ctm_parts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Peça atualizada com sucesso');
      return updated as CTMPart;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error updating part:', errorMessage);
      toast.error('Erro ao atualizar peça');
      return null;
    }
  }, []);

  const deletePart = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('ctm_parts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Peça removida com sucesso');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error deleting part:', errorMessage);
      toast.error('Erro ao remover peça');
      return false;
    }
  }, []);

  // ─── CTMFlightReport CRUD ──────────────────────────────────────────────────

  const createFlightReport = useCallback(async (data: Partial<CTMFlightReport>) => {
    try {
      const { data: newReport, error } = await supabase
        .from('ctm_flight_reports')
        .insert([data as any])
        .select()
        .single();

      if (error) throw error;
      toast.success('Relatório de voo adicionado com sucesso');
      return newReport as CTMFlightReport;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error creating flight report:', errorMessage);
      toast.error('Erro ao adicionar relatório de voo');
      return null;
    }
  }, []);

  const updateFlightReport = useCallback(async (id: string, data: Partial<CTMFlightReport>) => {
    try {
      const { data: updated, error } = await supabase
        .from('ctm_flight_reports')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Relatório de voo atualizado com sucesso');
      return updated as CTMFlightReport;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error updating flight report:', errorMessage);
      toast.error('Erro ao atualizar relatório de voo');
      return null;
    }
  }, []);

  const deleteFlightReport = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('ctm_flight_reports').delete().eq('id', id);
      if (error) throw error;
      toast.success('Relatório de voo removido com sucesso');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error deleting flight report:', errorMessage);
      toast.error('Erro ao remover relatório de voo');
      return false;
    }
  }, []);

  // ─── CTMCostSharing CRUD ───────────────────────────────────────────────────

  const createCostSharing = useCallback(async (data: Partial<CTMCostSharing>) => {
    try {
      const { data: newSharing, error } = await supabase
        .from('ctm_cost_sharing')
        .insert([data as any])
        .select()
        .single();

      if (error) throw error;
      toast.success('Rateio adicionado com sucesso');
      return newSharing as CTMCostSharing;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error creating cost sharing:', errorMessage);
      toast.error('Erro ao adicionar rateio');
      return null;
    }
  }, []);

  const updateCostSharing = useCallback(async (id: string, data: Partial<CTMCostSharing>) => {
    try {
      const { data: updated, error } = await supabase
        .from('ctm_cost_sharing')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Rateio atualizado com sucesso');
      return updated as CTMCostSharing;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error updating cost sharing:', errorMessage);
      toast.error('Erro ao atualizar rateio');
      return null;
    }
  }, []);

  const deleteCostSharing = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('ctm_cost_sharing').delete().eq('id', id);
      if (error) throw error;
      toast.success('Rateio removido com sucesso');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('Error deleting cost sharing:', errorMessage);
      toast.error('Erro ao remover rateio');
      return false;
    }
  }, []);

  return {
    // Categorias
    loadCategories,
    // Ordens de serviço
    loadServiceOrders,
    loadServiceOrderDetails,
    createServiceOrder,
    updateServiceOrder,
    deleteServiceOrder,
    // Orçamentos
    generateBudgetFromOAS,
    linkBudgetToOAS,
    getLinkedBudgets,
    // Oficinas
    loadOficinas,
    createOficina,
    // Serviços
    createService,
    updateService,
    deleteService,
    // Peças
    createPart,
    updatePart,
    deletePart,
    // Relatórios de voo
    createFlightReport,
    updateFlightReport,
    deleteFlightReport,
    // Rateio de custos
    createCostSharing,
    updateCostSharing,
    deleteCostSharing,
  };
}
