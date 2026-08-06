import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

/**
 * Realtime das tabelas de agendamento:
 * solicitacoes_reserva_voo, datas_bloqueadas_voo, status_tempo_real_aeronave,
 * ciclos_voo e lancamentos_diario_bordo.
 */
export function useRealtimeBookings() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateAgendamentos = () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-reserva-voo'] });
      queryClient.invalidateQueries({ queryKey: ['agv'] });
    };

    const bookingsChannel = supabase
      .channel('realtime-solicitacoes-reserva-voo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacoes_reserva_voo' },
        (payload: any) => {
          invalidateAgendamentos();

          if (payload.eventType === 'INSERT') {
            toast({
              title: '✈️ Nova Solicitação de Voo',
              description: `${payload.new?.origem ?? '?'} → ${payload.new?.destino ?? '?'}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new?.status === 'confirmado' && payload.old?.status !== 'confirmado') {
              toast({
                title: '✅ Reserva Confirmada',
                description: 'Uma reserva foi aprovada',
              });
            } else if (payload.new?.status === 'em_voo' && payload.old?.status !== 'em_voo') {
              toast({
                title: '🛫 Voo Iniciado',
                description: 'Ciclo de voo em andamento',
              });
            }
          }
        }
      )
      .subscribe();

    const blockedDatesChannel = supabase
      .channel('realtime-datas-bloqueadas-voo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'datas_bloqueadas_voo' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['datas-bloqueadas-voo'] });
          queryClient.invalidateQueries({ queryKey: ['agv'] });
        }
      )
      .subscribe();

    const statusChannel = supabase
      .channel('realtime-status-tempo-real-aeronave')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'status_tempo_real_aeronave' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['status-tempo-real-aeronave'] });
          queryClient.invalidateQueries({ queryKey: ['disponibilidade-aeronave'] });
          queryClient.invalidateQueries({ queryKey: ['agv'] });
        }
      )
      .subscribe();

    const cyclesChannel = supabase
      .channel('realtime-ciclos-voo')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ciclos_voo' },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ['ciclos-voo'] });
          queryClient.invalidateQueries({ queryKey: ['flight-cycles'] });
          queryClient.invalidateQueries({ queryKey: ['active-flight-cycles'] });

          if (payload.eventType === 'INSERT') {
            toast({
              title: '🛫 Novo Ciclo de Voo Iniciado',
              description: `${payload.new?.origem_icao ?? '?'} → ${payload.new?.destino_icao ?? '?'}`,
            });
          }
        }
      )
      .subscribe();

    const logbookChannel = supabase
      .channel('realtime-logbook')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lancamentos_diario_bordo' },
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
