import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExpirationAlert {
  id: string;
  alert_type: 'cma' | 'license' | 'maintenance' | 'document';
  reference_id: string;
  reference_table: string;
  title: string;
  description: string | null;
  entity_name: string | null;
  expiry_date: string;
  days_until_expiry: number;
  severity: 'info' | 'warning' | 'critical' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface UserAlertPreference {
  id: string;
  user_id: string;
  alert_id: string;
  action: 'dismissed' | 'snoozed';
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

export function useExpirationAlerts(userId: string | null) {
  const [alerts, setAlerts] = useState<ExpirationAlert[]>([]);
  const [visibleAlerts, setVisibleAlerts] = useState<ExpirationAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all alerts from database
  const fetchAlerts = useCallback(async () => {
    if (!userId) {
      setAlerts([]);
      setVisibleAlerts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all active alerts
      const { data: allAlerts, error: alertsError } = await supabase
        .from('expiration_alerts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (alertsError) {
        const errorMsg = alertsError.message || JSON.stringify(alertsError);
        throw new Error(`Erro ao buscar alertas de expiração: ${errorMsg}`);
      }

      // Fetch user preferences
      const { data: userPrefs, error: prefsError } = await supabase
        .from('user_alert_preferences')
        .select('*')
        .eq('user_id', userId);

      if (prefsError) {
        const errorMsg = prefsError.message || JSON.stringify(prefsError);
        throw new Error(`Erro ao buscar preferências de alertas: ${errorMsg}`);
      }

      // Filter alerts based on user preferences
      const now = new Date();
      const filteredAlerts = (allAlerts || []).filter((alert) => {
        const userPref = userPrefs?.find((p) => p.alert_id === alert.id);

        // If no preference, show the alert
        if (!userPref) return true;

        // If dismissed, don't show
        if (userPref.action === 'dismissed') return false;

        // If snoozed, check if snooze period has passed
        if (userPref.action === 'snoozed' && userPref.snoozed_until) {
          const snoozedUntil = new Date(userPref.snoozed_until);
          if (snoozedUntil > now) return false;
        }

        return true;
      });

      setAlerts(allAlerts || []);
      setVisibleAlerts(filteredAlerts);
    } catch (err) {
      console.error('Error fetching expiration alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Dismiss alert for user
  const dismissAlert = useCallback(
    async (alertId: string) => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from('user_alert_preferences')
          .upsert(
            {
              user_id: userId,
              alert_id: alertId,
              action: 'dismissed',
              snoozed_until: null,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,alert_id',
            }
          );

        if (error) throw error;

        // Update visible alerts
        setVisibleAlerts((prev) => prev.filter((a) => a.id !== alertId));
      } catch (err) {
        console.error('Error dismissing alert:', err);
        throw err;
      }
    },
    [userId]
  );

  // Snooze alert for specified days
  const snoozeAlert = useCallback(
    async (alertId: string, daysToSnooze: number) => {
      if (!userId) return;

      try {
        const snoozeUntil = new Date();
        snoozeUntil.setDate(snoozeUntil.getDate() + daysToSnooze);

        const { error } = await supabase
          .from('user_alert_preferences')
          .upsert(
            {
              user_id: userId,
              alert_id: alertId,
              action: 'snoozed',
              snoozed_until: snoozeUntil.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,alert_id',
            }
          );

        if (error) throw error;

        // Update visible alerts
        setVisibleAlerts((prev) => prev.filter((a) => a.id !== alertId));
      } catch (err) {
        console.error('Error snoozing alert:', err);
        throw err;
      }
    },
    [userId]
  );

  // Get alerts by severity
  const getAlertsBySeverity = useCallback(
    (severity: 'info' | 'warning' | 'critical' | 'expired') => {
      return visibleAlerts.filter((a) => a.severity === severity);
    },
    [visibleAlerts]
  );

  // Get alerts by type
  const getAlertsByType = useCallback(
    (type: 'cma' | 'license' | 'maintenance' | 'document') => {
      return visibleAlerts.filter((a) => a.alert_type === type);
    },
    [visibleAlerts]
  );

  // Initial load and setup polling
  useEffect(() => {
    if (userId) {
      fetchAlerts();

      // Poll for new alerts every 5 minutes
      const interval = setInterval(fetchAlerts, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [userId, fetchAlerts]);

  // Listen for real-time updates
  useEffect(() => {
    if (!userId) return;

    // Subscribe to changes in expiration_alerts
    const alertsSubscription = supabase
      .channel('expiration_alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expiration_alerts',
        },
        () => {
          // Refetch when alerts change
          fetchAlerts();
        }
      )
      .subscribe();

    // Subscribe to changes in user_alert_preferences
    const prefsSubscription = supabase
      .channel('user_alert_preferences')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_alert_preferences',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Refetch when user preferences change
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      alertsSubscription.unsubscribe();
      prefsSubscription.unsubscribe();
    };
  }, [userId, fetchAlerts]);

  return {
    alerts,
    visibleAlerts,
    isLoading,
    error,
    dismissAlert,
    snoozeAlert,
    getAlertsBySeverity,
    getAlertsByType,
    refetch: fetchAlerts,
  };
}
