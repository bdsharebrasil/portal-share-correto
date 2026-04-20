import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ManutencaoOption {
  id: string;
  tipo: string;
  numero_os?: string | null;
  numero_oas?: string | null;
  data_programada: string;
  etapa: string;
  oficina: string | null;
  custo_estimado: number | null;
  aeronave_id: string | null;
}

export interface DespesaManutencao {
  id: string;
  manutencao_id: string;
  aeronave_id: string | null;
  client_id: string | null;
  descricao: string;
  valor: number;
  tipo_rateio: "igual" | "por_uso" | "manual";
  partner_expense_id: string | null;
  created_at: string;
}

export interface DespesaManutencaoRateio {
  id: string;
  despesa_manutencao_id: string;
  client_partner_id: string;
  percentual: number;
  valor: number;
  status_pagamento: string;
}

/**
 * Busca manutenções de uma aeronave para seleção no formulário de despesa
 */
export function useAircraftMaintenances(aircraftId: string | null) {
  return useQuery({
    queryKey: ["aircraft-maintenances", aircraftId],
    queryFn: async () => {
      if (!aircraftId) return [];
      const { data, error } = await supabase
        .from("manutencoes")
        .select("id, tipo, numero_oas, data_programada, etapa, oficina, custo_estimado, aeronave_id")
        .eq("aeronave_id", aircraftId)
        .order("data_programada", { ascending: false });
      if (error) throw error;
      return (data || []) as ManutencaoOption[];
    },
    enabled: !!aircraftId,
  });
}

/**
 * Busca despesas vinculadas a uma manutenção
 */
export function useMaintenanceExpenses(manutencaoId: string | null) {
  return useQuery({
    queryKey: ["maintenance-expenses", manutencaoId],
    queryFn: async () => {
      if (!manutencaoId) return [];
      const { data, error } = await supabase
        .from("despesas_manutencao")
        .select("*")
        .eq("manutencao_id", manutencaoId)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as DespesaManutencao[];
    },
    enabled: !!manutencaoId,
  });
}

/**
 * Busca rateios de uma despesa de manutenção
 */
export function useMaintenanceExpenseSharing(despesaManutencaoId: string | null) {
  return useQuery({
    queryKey: ["maintenance-expense-sharing", despesaManutencaoId],
    queryFn: async () => {
      if (!despesaManutencaoId) return [];
      const { data, error } = await supabase
        .from("despesas_manutencao_rateio")
        .select("*")
        .eq("despesa_manutencao_id", despesaManutencaoId);
      if (error) throw error;
      return (data || []) as DespesaManutencaoRateio[];
    },
    enabled: !!despesaManutencaoId,
  });
}

/**
 * Cria uma despesa de manutenção com rateio entre sócios
 */
export function useCreateMaintenanceExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      manutencaoId: string;
      aircraftId: string | null;
      clientId: string;
      descricao: string;
      valor: number;
      tipoRateio: "igual" | "por_uso" | "manual";
      partnerExpenseId?: string | null;
      rateios: Array<{
        clientPartnerId: string;
        percentual: number;
        valor: number;
      }>;
    }) => {
      // 1. Criar despesa de manutenção
      const { data: despesa, error: despesaError } = await supabase
        .from("despesas_manutencao")
        .insert({
          manutencao_id: data.manutencaoId,
          aeronave_id: data.aeronaveId,
          client_id: data.clientId,
          descricao: data.descricao,
          valor: data.valor,
          tipo_rateio: data.tipoRateio,
          partner_expense_id: data.partnerExpenseId || null,
        })
        .select()
        .single();

      if (despesaError) throw despesaError;

      // 2. Criar rateios por sócio
      if (data.rateios.length > 0) {
        const rateioRecords = data.rateios.map((r) => ({
          despesa_manutencao_id: despesa.id,
          client_partner_id: r.clientPartnerId,
          percentual: r.percentual,
          valor: r.valor,
          status_pagamento: "pendente",
        }));

        const { error: rateioError } = await supabase
          .from("despesas_manutencao_rateio")
          .insert(rateioRecords);

        if (rateioError) throw rateioError;
      }

      return despesa;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-expense-sharing"] });
    },
  });
}

/**
 * Dados consolidados para o relatório de manutenção
 */
export interface MaintenanceReportData {
  manutencao: ManutencaoOption & {
    observacoes?: string | null;
    mecanico?: string | null;
  };
  aircraft: { id: string; registration: string; model: string } | null;
  serviceOrders: any[];
  parts: any[];
  services: any[];
  costSharing: any[];
  maintenanceItems: any[];
  oilAnalysis: any[];
  despesas: (DespesaManutencao & { rateios: DespesaManutencaoRateio[] })[];
  partners: Array<{ id: string; name: string; cpf: string; percentual_sociedade: number | null }>;
  totals: {
    totalParts: number;
    totalServices: number;
    totalDespesas: number;
    grandTotal: number;
    byPartner: Record<string, number>;
  };
}

export function useMaintenanceReport(manutencaoId: string | null) {
  return useQuery({
    queryKey: ["maintenance-report", manutencaoId],
    queryFn: async (): Promise<MaintenanceReportData | null> => {
      if (!manutencaoId) return null;

      // 1. Fetch the maintenance record
      const { data: manutencao, error: mError } = await supabase
        .from("manutencoes")
        .select("*")
        .eq("id", manutencaoId)
        .single();
      if (mError) throw mError;

      const aircraftId = manutencao.aeronave_id;

      // 2. Fetch aircraft info
      let aircraft = null;
      if (aircraftId) {
        const { data: ac } = await supabase
          .from('aeronave')
          .select('id, matricula, modelo')
          .eq("id", aircraftId)
          .single();
        aircraft = ac;
      }

      // 3. Fetch related CTM service orders
      let serviceOrders: any[] = [];
      if (aircraftId) {
        const { data } = await supabase
          .from("ctm_ordens_servico")
          .select("*")
          .eq("id_aeronave", aircraftId)
          .order("criado_em", { ascending: false });
        serviceOrders = data || [];
      }

      // 4. Fetch parts from all service orders
      let parts: any[] = [];
      if (serviceOrders.length > 0) {
        const soIds = serviceOrders.map((so: any) => so.id);
        const { data } = await supabase
          .from("ctm_parts")
          .select("*")
          .in("service_order_id", soIds);
        parts = data || [];
      }

      // 5. Fetch services from all service orders
      let services: any[] = [];
      if (serviceOrders.length > 0) {
        const soIds = serviceOrders.map((so: any) => so.id);
        const { data } = await supabase
          .from("ctm_services")
          .select("*")
          .in("service_order_id", soIds);
        services = data || [];
      }

      // 6. Fetch cost sharing
      let costSharing: any[] = [];
      if (serviceOrders.length > 0) {
        const soIds = serviceOrders.map((so: any) => so.id);
        const { data } = await supabase
          .from("ctm_cost_sharing")
          .select("*")
          .in("service_order_id", soIds);
        costSharing = data || [];
      }

      // 7. Fetch maintenance items
      let maintenanceItems: any[] = [];
      if (aircraftId) {
        const { data } = await supabase
          .from("maintenance_items")
          .select("*")
          .eq("id_aeronave", aircraftId);
        maintenanceItems = data || [];
      }

      // 8. Fetch oil analysis
      let oilAnalysis: any[] = [];
      if (aircraftId) {
        const { data } = await supabase
          .from("oil_analysis")
          .select("*")
          .eq("id_aeronave", aircraftId)
          .order("data", { ascending: false })
          .limit(10);
        oilAnalysis = data || [];
      }

      // 9. Fetch despesas_manutencao
      const { data: despesasData } = await supabase
        .from("despesas_manutencao")
        .select("*")
        .eq("manutencao_id", manutencaoId);
      const despesas = despesasData || [];

      // 10. Fetch rateios for each despesa
      const despesasWithRateios = [];
      for (const d of despesas) {
        const { data: rateios } = await supabase
          .from("despesas_manutencao_rateio")
          .select("*")
          .eq("despesa_manutencao_id", d.id);
        despesasWithRateios.push({ ...d, rateios: (rateios || []) as DespesaManutencaoRateio[] });
      }

      // 11. Fetch partners from client
      let partners: any[] = [];
      if (manutencao.aeronave_id) {
        // Find client through cotistas_aeronave
        const { data: ca } = await supabase
          .from("cotistas_aeronave")
          .select("id_clientes")
          .eq("id_aeronave", manutencao.aeronave_id)
          .limit(1)
          .single();
        if (ca?.id_clientes) {
          const { data: p } = await supabase
            .from("socios_cliente")
            .select("id, nome, cpf, percentual_participacao")
            .eq("cliente_id", ca.id_clientes)
            .order("nome");
          partners = p || [];
        }
      }

      // Calculate totals
      const totalParts = parts.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
      const totalServices = services.reduce((s: number, svc: any) => s + (svc.valor || 0), 0);
      const totalDespesas = despesasWithRateios.reduce((s, d) => s + (d.valor || 0), 0);
      const grandTotal = totalParts + totalServices + totalDespesas;

      // Calculate by partner
      const byPartner: Record<string, number> = {};
      for (const d of despesasWithRateios) {
        for (const r of d.rateios) {
          byPartner[r.socio_cliente_id_id] = (byPartner[r.socio_cliente_id_id] || 0) + r.valor;
        }
      }

      return {
        manutencao: manutencao as any,
        aircraft,
        serviceOrders,
        parts,
        services,
        costSharing,
        maintenanceItems,
        oilAnalysis,
        despesas: despesasWithRateios,
        partners,
        totals: { totalParts, totalServices, totalDespesas, grandTotal, byPartner },
      };
    },
    enabled: !!manutencaoId,
  });
}
