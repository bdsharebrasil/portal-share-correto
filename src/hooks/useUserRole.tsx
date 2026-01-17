import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const { data: userRoles = [], isLoading } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      return data.map((r) => r.role);
    },
  });

  const hasRole = (role: string) => {
    return userRoles.includes(role as any);
  };

  const hasAnyRole = (roles: string[]) => {
    return roles.some(role => userRoles.includes(role as any));
  };

  const isAdmin = hasRole("admin");
  const isFinanceiroMaster = hasRole("financeiro_master");
  const isGestorMaster = hasRole("gestor_master");
  const isPilotoChefe = hasRole("piloto_chefe");

  return {
    userRoles,
    hasRole,
    hasAnyRole,
    isAdmin,
    isFinanceiroMaster,
    isGestorMaster,
    isPilotoChefe,
    isLoading,
  };
}
