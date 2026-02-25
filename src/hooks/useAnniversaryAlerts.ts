import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AnniversaryAlert {
  id: string;
  person_id: string;
  person_type: 'crew_member' | 'employee' | 'contact' | 'client';
  person_name: string;
  birth_date: string;
  days_until_birthday: number;
  is_today: boolean;
  is_upcoming: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserAnniversaryPreference {
  id: string;
  user_id: string;
  alert_id: string;
  action: 'dismissed' | 'acknowledged';
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useAnniversaryAlerts(userId: string | null) {
  const [alerts, setAlerts] = useState<AnniversaryAlert[]>([]);
  const [visibleAlerts, setVisibleAlerts] = useState<AnniversaryAlert[]>([]);
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

      // Fetch all active birthday alerts for the next 60 days
      const { data: allAlerts, error: alertsError } = await supabase
        .from('anniversary_alerts')
        .select('*')
        .lte('days_until_birthday', 60)
        .gte('days_until_birthday', -1)
        .order('days_until_birthday', { ascending: true });

      if (alertsError) {
        const errorMsg = alertsError.message || JSON.stringify(alertsError);
        throw new Error(`Erro ao buscar alertas de aniversário: ${errorMsg}`);
      }

      // Fetch user preferences
      const { data: userPrefs, error: prefsError } = await supabase
        .from('user_anniversary_preferences')
        .select('*')
        .eq('user_id', userId);

      if (prefsError) {
        const errorMsg = prefsError.message || JSON.stringify(prefsError);
        throw new Error(`Erro ao buscar preferências de aniversário: ${errorMsg}`);
      }

      // Filter alerts based on user preferences
      const filteredAlerts = (allAlerts || []).filter((alert) => {
        const userPref = userPrefs?.find((p) => p.alert_id === alert.id);

        // If no preference, show the alert
        if (!userPref) return true;

        // If dismissed, don't show
        if (userPref.action === 'dismissed') return false;

        // If acknowledged, show anyway (birthday alerts should always be visible)
        return true;
      });

      setAlerts(allAlerts || []);
      setVisibleAlerts(filteredAlerts);
    } catch (err) {
      console.error('Error fetching anniversary alerts:', err);
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
          .from('user_anniversary_preferences')
          .upsert(
            {
              user_id: userId,
              alert_id: alertId,
              action: 'dismissed',
              acknowledged_at: null,
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

  // Acknowledge alert (mark as seen)
  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      if (!userId) return;

      try {
        const { error } = await supabase
          .from('user_anniversary_preferences')
          .upsert(
            {
              user_id: userId,
              alert_id: alertId,
              action: 'acknowledged',
              acknowledged_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,alert_id',
            }
          );

        if (error) throw error;

        // Keep alert visible but mark as acknowledged
        setVisibleAlerts((prev) =>
          prev.map((a) =>
            a.id === alertId ? { ...a, acknowledged: true } : a
          )
        );
      } catch (err) {
        console.error('Error acknowledging alert:', err);
        throw err;
      }
    },
    [userId]
  );

  // Get today's birthdays
  const getTodaysBirthdays = useCallback(() => {
    return visibleAlerts.filter((a) => a.is_today);
  }, [visibleAlerts]);

  // Get upcoming birthdays (next 7 days)
  const getUpcomingBirthdays = useCallback(() => {
    return visibleAlerts.filter((a) => a.days_until_birthday > 0 && a.days_until_birthday <= 7);
  }, [visibleAlerts]);

  // Get all upcoming (next 30 days)
  const getAllUpcoming = useCallback(() => {
    return visibleAlerts.filter((a) => a.days_until_birthday > 0 && a.days_until_birthday <= 30);
  }, [visibleAlerts]);

  // Initial load and setup polling
  useEffect(() => {
    if (userId) {
      fetchAlerts();

      // Poll for new alerts every 30 minutes
      const interval = setInterval(fetchAlerts, 30 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [userId, fetchAlerts]);

  // Listen for real-time updates
  useEffect(() => {
    if (!userId) return;

    // Subscribe to changes in anniversary_alerts
    const alertsSubscription = supabase
      .channel('anniversary_alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'anniversary_alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    // Subscribe to changes in user_anniversary_preferences
    const prefsSubscription = supabase
      .channel('user_anniversary_preferences')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_anniversary_preferences',
          filter: `user_id=eq.${userId}`,
        },
        () => {
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
    acknowledgeAlert,
    getTodaysBirthdays,
    getUpcomingBirthdays,
    getAllUpcoming,
    refetch: fetchAlerts,
  };
}
