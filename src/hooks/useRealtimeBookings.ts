import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

export function useRealtimeBookings() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Canal para flight_booking_requests
    const bookingsChannel = supabase
      .channel('realtime-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flight_booking_requests',
        },
        (payload: any) => {
          console.log('Booking change:', payload);
          
          // Invalidar queries relacionadas
          queryClient.invalidateQueries({ queryKey: ['flight-booking-requests'] });
          
          // Notificações baseadas no evento
          if (payload.eventType === 'INSERT') {
            toast({
              title: '✈️ Nova Solicitação de Voo',
              description: `${payload.new.origin} → ${payload.new.destination}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'confirmado' && payload.old?.status !== 'confirmado') {
              toast({
                title: '✅ Reserva Confirmada',
                description: 'Uma reserva foi aprovada',
              });
            } else if (payload.new.status === 'em_voo' && payload.old?.status !== 'em_voo') {
              toast({
                title: '🛫 Voo Iniciado',
                description: 'Ciclo de voo em andamento',
              });
            }
          }
        }
      )
      .subscribe();

    // Canal para blocked_flight_dates
    const blockedDatesChannel = supabase
      .channel('realtime-blocked-dates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_flight_dates',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['blocked-flight-dates'] });
        }
      )
      .subscribe();

    // Canal para aircraft_live_status
    const statusChannel = supabase
      .channel('realtime-aircraft-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aircraft_live_status',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['aircraft-live-status'] });
        }
      )
      .subscribe();

    // Canal para flight_cycles
    const cyclesChannel = supabase
      .channel('realtime-flight-cycles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flight_cycles',
        },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ['flight-cycles'] });
          queryClient.invalidateQueries({ queryKey: ['active-flight-cycles'] });
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: '🛫 Novo Ciclo de Voo Iniciado',
              description: `${payload.new.origin_icao} → ${payload.new.destination_icao}`,
            });
          }
        }
      )
      .subscribe();

    // Canal para logbook_entries
    const logbookChannel = supabase
      .channel('realtime-logbook')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logbook_entries',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['logbook-entries'] });
          queryClient.invalidateQueries({ queryKey: ['active-flight-cycles'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(blockedDatesChannel);
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(cyclesChannel);
      supabase.removeChannel(logbookChannel);
    };
  }, [queryClient]);
}
