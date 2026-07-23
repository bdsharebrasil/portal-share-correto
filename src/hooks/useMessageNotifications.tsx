import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export const useMessageNotifications = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { roles, user } = useAuth();

  useEffect(() => {
    if (user) setCurrentUserId(user.id);
  }, [user]);

  useEffect(() => {
    if (!currentUserId) return;
    if (!supabase || typeof supabase.channel !== 'function') return;

    const channel = supabase
      .channel('recados-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'recados' },
        async (payload) => {
          const recado = payload.new as any;
          if (!recado) return;
          // Skip pinned messages — those live on the mural and don't ping
          if (recado.fixado) return;
          // Skip own posts
          if (recado.autor_id === currentUserId) return;

          const dept = (recado.departamento || 'todos').toLowerCase();
          const isForMe =
            dept === 'todos' ||
            dept.split(',').some((r: string) => (roles ?? []).includes(r.trim() as any));
          if (!isForMe) return;

          // Fetch author name
          let autorNome = 'Novo recado';
          try {
            const { data } = await (supabase as any)
              .from('user_profiles')
              .select('nome_completo, full_name')
              .eq('id', recado.autor_id)
              .single();
            const nome = data?.nome_completo || data?.full_name;
            if (nome) autorNome = nome;
          } catch {
            /* ignore */
          }

          toast.info(autorNome, {
            description: recado.mensagem?.substring(0, 140) ?? '',
            duration: 6000,
            action: {
              label: 'Ver',
              onClick: () => (window.location.hash = '#/recados'),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, roles]);
};
