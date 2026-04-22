import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const { data: userRoles = [] as string[], isLoading, error } = useQuery<string[]>({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        console.error("Erro ao carregar roles do usuário:", error);
        throw error;
      }

      const roles = (data || []).map((r) => r.role as string);
      console.log("Roles carregadas:", roles);
      return roles;
    },
    staleTime: 1 * 60 * 1000, // Reduzido de 5 para 1 minuto
    gcTime: 5 * 60 * 1000, // Reduzido de 10 para 5 minutos
    retry: 2,
  });

  const hasRole = (role: string) => {
    return (userRoles as string[]).includes(role);
  };

  const hasAnyRole = (roles: string[]) => {
    return roles.some(role => (userRoles as string[]).includes(role));
  };

  const isAdmin = hasRole("admin");
  const isFinanceiroMaster = hasRole("financeiro_master");
  const isGestorMaster = hasRole("gestor_master");
  const isPilotoChefe = hasRole("piloto_chefe");
  const isCoordenadorVoo = hasRole("coordenador_de_voo");
  const isTripulante = hasRole("tripulante");

  return {
    userRoles: userRoles as string[],
    hasRole,
    hasAnyRole,
    isAdmin,
    isFinanceiroMaster,
    isGestorMaster,
    isPilotoChefe,
    isCoordenadorVoo,
    isTripulante,
    isLoading,
  };
}
