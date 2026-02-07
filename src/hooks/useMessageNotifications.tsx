import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export const useMessageNotifications = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { roles, user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Prefer user from AuthContext, fallback to Supabase if available
    if (user) {
      setCurrentUserId(user.id);
      return;
    }

    // Get current user from supabase if supported
    const getCurrentUser = async () => {
      try {
        if (!supabase || !supabase.auth || typeof supabase.auth.getUser !== 'function') return;
        const result = await supabase.auth.getUser();
        const userData = (result && (result as any).data && (result as any).data.user) || null;
        if (userData) setCurrentUserId(userData.id);
      } catch (e) {
        // ignore
      }
    };

    void getCurrentUser();
  }, [user]);

  useEffect(() => {
    if (!currentUserId) return;

    if (!supabase || typeof supabase.channel !== 'function') return;

    // Messages table disabled - table does not exist in Supabase
    // Subscribe to new messages - disabled
    // const channel = supabase
    //   .channel('new-messages-notifications')
    //   .on(
    //     'postgres_changes',
    //     {
    //       event: 'INSERT',
    //       schema: 'public',
    //       table: 'messages'
    //     },
    //     async (payload) => {
    //       const newMessage = payload.new as any;
    //       if (newMessage.author_id === currentUserId) return;
    //       const isForMe = await checkIfMessageIsForUser(newMessage, currentUserId, roles ?? []);
    //       if (isForMe) {
    //         toast.info(newMessage.author_name, {
    //           description: newMessage.content,
    //           duration: 5000,
    //           action: {
    //             label: 'Ver',
    //             onClick: () => window.location.href = '/recados'
    //           }
    //         });
    //       }
    //     }
    //   )
    //   .subscribe();

    return () => {
      // cleanup disabled
    };
  }, [currentUserId, roles]);
};

async function checkIfMessageIsForUser(message: any, userId: string, userRolesList: string[]): Promise<boolean> {
  // Message for all users
  if (message.target_type === 'all') return true;

  // Message for specific user
  if (message.target_type === 'user' && message.target_user_id === userId) {
    return true;
  }

  // Message for specific roles
  if (message.target_type === 'role' && message.target_roles && message.target_roles.length > 0) {
    return message.target_roles.some((role: any) => userRolesList.includes(role));
  }

  return false;
}
