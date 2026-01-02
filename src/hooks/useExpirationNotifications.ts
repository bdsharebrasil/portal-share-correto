import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExpirationAlert {
  type: 'maintenance' | 'ad' | 'sb' | 'component';
  title: string;
  daysUntilExpiry: number;
  severity: 'expired' | 'critical' | 'warning' | 'info';
}

export function useExpirationNotifications(aircraftId: string) {
  const checkExpirations = useCallback(async () => {
    if (!aircraftId) return;

    try {
      const today = new Date();
      const alerts: ExpirationAlert[] = [];

      // Check maintenance items
      const { data: maintenanceItems } = await supabase
        .from('maintenance_items')
        .select('*')
        .eq('aircraft_id', aircraftId);

      if (maintenanceItems) {
        maintenanceItems.forEach((item: any) => {
          if (item.next_due_date) {
            const dueDate = new Date(item.next_due_date);
            const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntil < 0) {
              alerts.push({
                type: 'maintenance',
                title: `Inspeção Vencida: ${item.description}`,
                daysUntilExpiry: daysUntil,
                severity: 'expired',
              });
            } else if (daysUntil <= 7) {
              alerts.push({
                type: 'maintenance',
                title: `Inspeção Crítica: ${item.description} (${daysUntil} dias)`,
                daysUntilExpiry: daysUntil,
                severity: 'critical',
              });
            } else if (daysUntil <= 30) {
              alerts.push({
                type: 'maintenance',
                title: `Inspeção Próxima: ${item.description} (${daysUntil} dias)`,
                daysUntilExpiry: daysUntil,
                severity: 'warning',
              });
            }
          }
        });
      }

      // Check Airworthiness Directives
      const { data: ads } = await supabase
        .from('airworthiness_directives')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .eq('status', 'pendente');

      if (ads) {
        ads.forEach((ad: any) => {
          if (ad.due_date) {
            const dueDate = new Date(ad.due_date);
            const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntil < 0) {
              alerts.push({
                type: 'ad',
                title: `AD Vencida: ${ad.ad_number}`,
                daysUntilExpiry: daysUntil,
                severity: 'expired',
              });
            } else if (daysUntil <= 14) {
              alerts.push({
                type: 'ad',
                title: `AD Crítica: ${ad.ad_number} (${daysUntil} dias)`,
                daysUntilExpiry: daysUntil,
                severity: 'critical',
              });
            }
          }
        });
      }

      // Check Service Bulletins
      const { data: sbs } = await supabase
        .from('service_bulletins')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .eq('status', 'pendente');

      if (sbs) {
        sbs.forEach((sb: any) => {
          if (sb.due_date) {
            const dueDate = new Date(sb.due_date);
            const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntil < 0) {
              alerts.push({
                type: 'sb',
                title: `SB Vencida: ${sb.sb_number}`,
                daysUntilExpiry: daysUntil,
                severity: 'expired',
              });
            } else if (daysUntil <= 14) {
              alerts.push({
                type: 'sb',
                title: `SB Crítica: ${sb.sb_number} (${daysUntil} dias)`,
                daysUntilExpiry: daysUntil,
                severity: 'critical',
              });
            }
          }
        });
      }

      // Check Components
      const { data: components } = await supabase
        .from('aircraft_components')
        .select('*')
        .eq('aircraft_id', aircraftId);

      if (components) {
        components.forEach((comp: any) => {
          const lifePercentage = (comp.current_life / comp.total_life) * 100;

          if (lifePercentage >= 80) {
            alerts.push({
              type: 'component',
              title: `Componente Crítico: ${comp.name} (${lifePercentage.toFixed(0)}%)`,
              daysUntilExpiry: 0,
              severity: 'warning',
            });
          }
        });
      }

      // Show notifications
      showNotifications(alerts);
    } catch (error) {
      console.error('Error checking expirations:', error);
    }
  }, [aircraftId]);

  const showNotifications = useCallback((alerts: ExpirationAlert[]) => {
    if (alerts.length === 0) return;

    // Group by severity
    const expired = alerts.filter((a) => a.severity === 'expired');
    const critical = alerts.filter((a) => a.severity === 'critical');
    const warnings = alerts.filter((a) => a.severity === 'warning');

    // Show notifications
    if (expired.length > 0) {
      toast.error(
        `⚠️ ${expired.length} item(ns) VENCIDO(S)! Ação imediata necessária!`,
        { duration: 8000 }
      );
      expired.forEach((alert) => {
        console.warn(`[EXPIRED] ${alert.title}`);
      });
    }

    if (critical.length > 0) {
      toast.warning(
        `🔴 ${critical.length} item(ns) CRÍTICO(S)! Vencimento próximo`,
        { duration: 7000 }
      );
      critical.forEach((alert) => {
        console.warn(`[CRITICAL] ${alert.title}`);
      });
    }

    if (warnings.length > 0 && expired.length === 0 && critical.length === 0) {
      toast.info(
        `⚠️ ${warnings.length} item(ns) requer(em) atenção`,
        { duration: 5000 }
      );
    }
  }, []);

  // Check on component mount and set interval
  useEffect(() => {
    checkExpirations();

    // Check every 30 minutes
    const interval = setInterval(checkExpirations, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [aircraftId, checkExpirations]);

  return { checkExpirations };
}
