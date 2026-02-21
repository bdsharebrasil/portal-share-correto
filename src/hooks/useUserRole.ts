import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          if (!error && data) {
            setRoles(data.map(r => r.role));
          }
        }
      } catch (error) {
        console.error('Erro ao buscar roles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoles();
  }, []);

  const isAdmin = roles.includes('admin');
  const isGestorMaster = roles.includes('gestor_master');
  const isFinanceiroMaster = roles.includes('financeiro_master');

  return {
    roles,
    loading,
    isAdmin,
    isGestorMaster,
    isFinanceiroMaster,
    canAccessGestor: isAdmin || isGestorMaster,
  };
}
