import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  MaintenanceConfig,
  MaintenanceStatus,
  LastMaintenanceInfo,
  MaintenanceType,
  DEFAULT_CONFIGS,
  calculateAllMaintenanceStatuses,
  getMostCriticalStatus,
  hasBlockingMaintenance,
} from '@/lib/maintenance-alerts';

export interface MaintenanceRecord {
  id: string;
  aeronave_id: string;
  maintenance_type: MaintenanceType;
  performed_at_hours: number;
  performed_date: string;
  next_due_hours: number;
  mechanic_name?: string;
  maintenance_center?: string;
  service_order_number?: string;
  description?: string;
  cost?: number;
  observations?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceConfigRow {
  id: string;
  aeronave_id: string;
  maintenance_type: MaintenanceType;
  interval_hours: number;
  alert_green_threshold: number;
  alert_yellow_threshold: number;
  alert_orange_threshold: number;
  alert_red_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceNotification {
  id: string;
  aeronave_id: string;
  maintenance_type: string;
  alert_level: string;
  hours_remaining: number;
  message: string;
  is_read: boolean;
  notified_at: string;
  created_at: string;
}

export function useMaintenanceConfigs(aircraftId: string) {
  return useQuery({
    queryKey: ['maintenance-configs', aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aircraft_maintenance_config')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .eq('is_active', true);

      if (error) throw error;
      
      // Convert DB rows to MaintenanceConfig format
      if (data && data.length > 0) {
        return data.map((row: any): MaintenanceConfig => ({
          maintenanceType: row.maintenance_type as MaintenanceType,
          intervalHours: Number(row.interval_hours),
          alertGreenThreshold: Number(row.alert_green_threshold),
          alertYellowThreshold: Number(row.alert_yellow_threshold),
          alertOrangeThreshold: Number(row.alert_orange_threshold),
          alertRedThreshold: Number(row.alert_red_threshold),
        }));
      }
      
      // Return default configs if none exist
      return Object.values(DEFAULT_CONFIGS);
    },
    enabled: !!aircraftId,
  });
}

export function useMaintenanceRecords(aircraftId: string) {
  return useQuery({
    queryKey: ['maintenance-records', aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('registros_manutencao_aeronave')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('performed_at_hours', { ascending: false });

      if (error) throw error;
      return (data || []) as MaintenanceRecord[];
    },
    enabled: !!aircraftId,
  });
}

export function useMaintenanceNotifications(aircraftId?: string) {
  return useQuery({
    queryKey: ['maintenance-notifications', aircraftId],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (aircraftId) {
        query = query.eq('aircraft_id', aircraftId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MaintenanceNotification[];
    },
  });
}

export function useAircraftCurrentHours(aircraftId: string) {
  return useQuery({
    queryKey: ['aircraft-current-hours', aircraftId],
    queryFn: async () => {
      // Get the most recent diario_mes entry with valid data
      const { data, error } = await supabase
        .from('diario_mes')
        .select('celula_atual, celula_prox_revisao, ano, mes')
        .eq('aeronave_id', aircraftId)
        .gt('celula_atual', 0)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        return {
          currentHours: Number(data[0].celula_atual) || 0,
          nextRevisionHours: Number(data[0].celula_prox_revisao) || 0,
          year: data[0].ano,
          month: data[0].mes,
        };
      }
      
      return { currentHours: 0, nextRevisionHours: 0, year: null, month: null };
    },
    enabled: !!aircraftId,
  });
}

export function useMaintenanceStatuses(aircraftId: string) {
  const { data: configs, isLoading: configsLoading } = useMaintenanceConfigs(aircraftId);
  const { data: records, isLoading: recordsLoading } = useMaintenanceRecords(aircraftId);
  const { data: hoursData, isLoading: hoursLoading } = useAircraftCurrentHours(aircraftId);

  const isLoading = configsLoading || recordsLoading || hoursLoading;

  if (isLoading || !configs || !hoursData) {
    return { statuses: [], mostCritical: null, hasBlocking: false, isLoading };
  }

  // Convert records to LastMaintenanceInfo format - get last of each type
  const lastMaintenanceByType: Record<MaintenanceType, LastMaintenanceInfo> = {} as any;
  
  (records || []).forEach((record) => {
    const type = record.maintenance_type as MaintenanceType;
    if (!lastMaintenanceByType[type] || record.performed_at_hours > lastMaintenanceByType[type].performedAtHours) {
      lastMaintenanceByType[type] = {
        maintenanceType: type,
        performedAtHours: Number(record.performed_at_hours),
        performedDate: record.performed_date,
        nextDueHours: Number(record.next_due_hours),
      };
    }
  });

  const lastMaintenanceList = Object.values(lastMaintenanceByType);

  const statuses = calculateAllMaintenanceStatuses(
    hoursData.currentHours,
    lastMaintenanceList,
    configs
  );

  // Filtrar apenas 50h e 100h, removendo 150h e 200h
  const filteredStatuses = statuses.filter(s =>
    s.maintenanceType === '50h' || s.maintenanceType === '100h'
  );

  return {
    statuses: filteredStatuses,
    mostCritical: getMostCriticalStatus(filteredStatuses),
    hasBlocking: hasBlockingMaintenance(filteredStatuses),
    isLoading,
    currentHours: hoursData.currentHours,
  };
}

export function useAddMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: Omit<MaintenanceRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('registros_manutencao_aeronave')
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-records', variables.aeronave_id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-notifications'] });
    },
  });
}

export function useUpdateMaintenanceConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      aircraftId, 
      config 
    }: { 
      aircraftId: string; 
      config: Partial<MaintenanceConfigRow> & { maintenance_type: MaintenanceType } 
    }) => {
      const { data, error } = await supabase
        .from('aircraft_maintenance_config')
        .upsert({
          aeronave_id: aircraftId,
          maintenance_type: config.maintenance_type,
          interval_hours: config.interval_hours,
          alert_green_threshold: config.alert_green_threshold,
          alert_yellow_threshold: config.alert_yellow_threshold,
          alert_orange_threshold: config.alert_orange_threshold,
          alert_red_threshold: config.alert_red_threshold,
          is_active: config.is_active ?? true,
        }, {
          onConflict: 'aeronave_id,maintenance_type',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-configs', variables.aeronaveId] });
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('maintenance_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-notifications'] });
    },
  });
}
