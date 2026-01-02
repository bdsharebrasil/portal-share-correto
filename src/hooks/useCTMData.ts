import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Component } from "@/types/ctm";

export interface CTMTracking {
  id: string;
  aircraft_id: string | null;
  client_id: string | null;
  item_name: string;
  control_type: string;
  last_change_date: string | null;
  last_change_hours: number | null;
  hours_after: number | null;
  remaining_hours: number | null;
  left_value: string | null;
  right_value: string | null;
  service_order_number: string | null;
  invoice_number: string | null;
  month: number;
  year: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface CTMServiceOrder {
  id: string;
  aircraft_id: string;
  numero: string | null;
  os_oficina: string | null;
  horas_celula: number | null;
  tipo_manutencao: string | null;
  periodo: string | null;
  objetivo: string | null;
  oficina_nome: string | null;
  oficina_contato: string | null;
  dias_previstos: number | null;
  dias_efetivos: number | null;
  data_entrada: string | null;
  data_saida: string | null;
  status: string | null;
  observacoes: string | null;
  vencimento_id: string | null;
  total_mao_obra: number | null;
  total_pecas: number | null;
  total_geral: number | null;
  tipo_rateio: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
}

export interface CTMCostSharing {
  id: string;
  service_order_id: string;
  client_id: string;
  horas_voadas: number | null;
  percentual: number | null;
  valor: number | null;
  status_pagamento: string | null;
  data_pagamento: string | null;
  comprovante_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  client?: {
    id: string;
    company_name: string | null;
    proprietario: string | null;
  };
}

export interface AircraftDetails {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
  status: string | null;
  cell_hours_current: number | null;
  cell_hours_prev: number | null;
  celula_prox_revisao: number | null;
  horimeter_active: number | null;
  horimeter_start: number | null;
  horimeter_end: number | null;
}

export function useCTMData(aircraftId: string) {
  // Fetch aircraft details
  const { data: aircraft, isLoading: loadingAircraft } = useQuery({
    queryKey: ["ctm-aircraft", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, model, manufacturer, status, cell_hours_current, cell_hours_prev, celula_prox_revisao, horimeter_active, horimeter_start, horimeter_end")
        .eq("id", aircraftId)
        .single();

      if (error) throw error;
      return data as AircraftDetails;
    },
    enabled: !!aircraftId,
  });

  // Fetch CTM tracking items (components)
  const { data: ctmTracking, isLoading: loadingTracking, refetch: refetchTracking } = useQuery({
    queryKey: ["ctm-tracking", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctm_tracking")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .order("item_name");

      if (error) throw error;
      return (data || []) as CTMTracking[];
    },
    enabled: !!aircraftId,
  });

  // Fetch service orders
  const { data: serviceOrders, isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ["ctm-service-orders", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctm_service_orders")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CTMServiceOrder[];
    },
    enabled: !!aircraftId,
  });

  // Fetch cost sharing for all service orders
  const { data: costSharing, isLoading: loadingCostSharing, refetch: refetchCostSharing } = useQuery({
    queryKey: ["ctm-cost-sharing", aircraftId],
    queryFn: async () => {
      if (!serviceOrders || serviceOrders.length === 0) return [];

      const orderIds = serviceOrders.map((o) => o.id);
      const { data, error } = await supabase
        .from("ctm_cost_sharing")
        .select(`
          *,
          client:clients(id, company_name, proprietario)
        `)
        .in("service_order_id", orderIds);

      if (error) throw error;
      return (data || []) as CTMCostSharing[];
    },
    enabled: !!serviceOrders && serviceOrders.length > 0,
  });

  // Fetch last logbook entry for this aircraft
  const { data: lastFlight } = useQuery({
    queryKey: ["ctm-last-flight", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logbook_entries")
        .select("entry_date, departure_aerodrome, arrival_aerodrome, total_time, celula")
        .eq("aircraft_id", aircraftId)
        .order("entry_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!aircraftId,
  });

  // Fetch last maintenance record
  const { data: lastMaintenance } = useQuery({
    queryKey: ["ctm-last-maintenance", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manutencoes")
        .select("*")
        .eq("aeronave_id", aircraftId)
        .eq("etapa", "concluida")
        .order("data_programada", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!aircraftId,
  });

  // Calculate derived metrics - prioritize logbook celula, then aircraft fields
  const currentHours = lastFlight?.celula || aircraft?.cell_hours_current || aircraft?.horimeter_active || 0;
  const nextRevisionHours = aircraft?.celula_prox_revisao || 0;
  // If nextRevisionHours is set and > currentHours, calculate remaining; otherwise show 0 or "not set"
  const hoursRemaining = nextRevisionHours > 0 && nextRevisionHours > currentHours
    ? nextRevisionHours - currentHours
    : nextRevisionHours > 0 ? 0 : -1; // -1 means not configured

  // Calculate health percentage based on component status
  const componentHealth = ctmTracking?.reduce((acc, item) => {
    const remaining = item.remaining_hours || 0;
    if (remaining <= 10) acc.critical++;
    else if (remaining <= 50) acc.attention++;
    else acc.ok++;
    return acc;
  }, { ok: 0, attention: 0, critical: 0 }) || { ok: 0, attention: 0, critical: 0 };

  const totalComponents = componentHealth.ok + componentHealth.attention + componentHealth.critical;
  // If no components, show 100% (healthy) instead of calculating
  const healthPercentage = totalComponents > 0
    ? Math.round((componentHealth.ok / totalComponents) * 100)
    : 100; // No components = no issues = healthy

  // Group cost sharing by service order
  const costSharingByOrder = (costSharing || []).reduce((acc, cs) => {
    if (!acc[cs.service_order_id]) {
      acc[cs.service_order_id] = [];
    }
    acc[cs.service_order_id].push(cs);
    return acc;
  }, {} as Record<string, CTMCostSharing[]>);

  return {
    aircraft,
    ctmTracking: ctmTracking || [],
    serviceOrders: serviceOrders || [],
    costSharing: costSharing || [],
    costSharingByOrder,
    lastFlight,
    lastMaintenance,
    currentHours,
    nextRevisionHours,
    hoursRemaining,
    healthPercentage,
    componentHealth,
    isLoading: loadingAircraft || loadingTracking || loadingOrders,
    refetch: () => {
      refetchTracking();
      refetchOrders();
      refetchCostSharing();
    },
  };
}

export function useCTMClients(aircraftId: string) {
  return useQuery({
    queryKey: ["ctm-aircraft-clients", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_aircraft")
        .select(`
          *,
          client:clients(id, company_name, proprietario, share_percentage)
        `)
        .eq("aircraft_id", aircraftId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId,
  });
}

export interface ClientFlightHours {
  client_id: string;
  client_name: string;
  share_percentage: number;
  total_hours: number;
  percentage_used: number;
}

export function useClientFlightHours(aircraftId: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["ctm-client-flight-hours", aircraftId, startDate, endDate],
    queryFn: async () => {
      // First, get all clients for this aircraft
      const { data: clients, error: clientsError } = await supabase
        .from("client_aircraft")
        .select(`
          client_id,
          share_percentage,
          client:clients(id, company_name, proprietario)
        `)
        .eq("aircraft_id", aircraftId);

      if (clientsError) throw clientsError;

      // Then get flight hours from logbook for each client
      let query = supabase
        .from("logbook_entries")
        .select("client_id, total_time")
        .eq("aircraft_id", aircraftId)
        .not("client_id", "is", null);

      if (startDate) {
        query = query.gte("entry_date", startDate);
      }
      if (endDate) {
        query = query.lte("entry_date", endDate);
      }

      const { data: flights, error: flightsError } = await query;

      if (flightsError) throw flightsError;

      // Calculate hours per client
      const hoursMap = new Map<string, number>();
      let totalHoursAll = 0;

      (flights || []).forEach((flight) => {
        if (flight.client_id) {
          const current = hoursMap.get(flight.client_id) || 0;
          hoursMap.set(flight.client_id, current + (flight.total_time || 0));
          totalHoursAll += flight.total_time || 0;
        }
      });

      // Map clients with their hours
      const result: ClientFlightHours[] = (clients || []).map((ca: any) => ({
        client_id: ca.client_id,
        client_name: ca.client?.company_name || ca.client?.proprietario || "Cliente",
        share_percentage: ca.share_percentage || 0,
        total_hours: hoursMap.get(ca.client_id) || 0,
        percentage_used: totalHoursAll > 0
          ? Math.round(((hoursMap.get(ca.client_id) || 0) / totalHoursAll) * 100)
          : 0,
      }));

      return {
        clients: result,
        totalHours: totalHoursAll,
      };
    },
    enabled: !!aircraftId,
  });
}

export function useAircraftComponents(aircraftId: string) {
  return useQuery({
    queryKey: ["aircraft-components", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as Component[];
    },
    enabled: !!aircraftId,
  });
}

export function useCTMServiceOrders(aircraftId: string) {
  return useQuery({
    queryKey: ["ctm-service-orders", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctm_service_orders")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CTMServiceOrder[];
    },
    enabled: !!aircraftId,
  });
}

export interface PartnerFlightHours {
  client_id: string;
  client_name: string;
  share_percentage: number;
  total_hours: number;
}

export function usePartnerFlightHours(aircraftId: string) {
  return useQuery({
    queryKey: ["partner-flight-hours", aircraftId],
    queryFn: async () => {
      // Get clients and their share
      const { data: clients, error: clientsError } = await supabase
        .from("client_aircraft")
        .select(`
          client_id,
          share_percentage,
          client:clients(id, company_name, proprietario)
        `)
        .eq("aircraft_id", aircraftId);

      if (clientsError) throw clientsError;

      // Get flight hours
      const { data: flights, error: flightsError } = await supabase
        .from("logbook_entries")
        .select("client_id, total_time")
        .eq("aircraft_id", aircraftId)
        .not("client_id", "is", null);

      if (flightsError) throw flightsError;

      // Calculate hours per client
      const hoursMap = new Map<string, number>();
      (flights || []).forEach((flight) => {
        if (flight.client_id) {
          const current = hoursMap.get(flight.client_id) || 0;
          hoursMap.set(flight.client_id, current + (flight.total_time || 0));
        }
      });

      // Map to result
      return ((clients || []).map((ca: any) => ({
        client_id: ca.client_id,
        client_name: ca.client?.company_name || ca.client?.proprietario || "Cliente",
        share_percentage: ca.share_percentage || 0,
        total_hours: hoursMap.get(ca.client_id) || 0,
      })) || []) as PartnerFlightHours[];
    },
    enabled: !!aircraftId,
  });
}

export interface AircraftCellData {
  aircraft_id: string;
  cell_hours_current: number;
  cell_hours_prev?: number;
  celula_prox_revisao?: number;
}

export function useAircraftCellHours(aircraftId: string) {
  return useQuery({
    queryKey: ["aircraft-cell-hours", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, cell_hours_current, cell_hours_prev, celula_prox_revisao")
        .eq("id", aircraftId)
        .single();

      if (error) throw error;
      return data as AircraftCellData;
    },
    enabled: !!aircraftId,
  });
}

export function useRASReports(aircraftId: string) {
  return useQuery({
    queryKey: ["ras-reports", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ras_reports")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .order("data_relatorio", { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!aircraftId,
  });
}

export function useRASItems(rasId: string) {
  return useQuery({
    queryKey: ["ras-items", rasId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ras_items")
        .select("*")
        .eq("ras_id", rasId)
        .order("created_at");

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!rasId,
  });
}

export function useRASPhotos(rasId: string) {
  return useQuery({
    queryKey: ["ras-photos", rasId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ras_photos")
        .select("*")
        .eq("ras_id", rasId)
        .order("created_at");

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!rasId,
  });
}
