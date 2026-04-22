import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const { data: userRoles = [] as string[], isLoading, error } = useQuery<string[]>({
    queryKey: ["user_roles"],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          console.warn("Nenhum usuário autenticado");
          return [];
        }

        console.log("Buscando roles para usuário:", user.id);

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (error) {
          console.error("Erro ao carregar roles do usuário:", error);
          throw error;
        }

        const roles = (data || []).map((r) => r.role as string);
        console.log("Roles carregadas com sucesso:", roles);

        if (roles.length === 0) {
          console.warn("Usuário não possui nenhuma role cadastrada!");
        }

        return roles;
      } catch (err) {
        console.error("Erro na função queryFn de roles:", err);
        throw err;
      }
    },
    staleTime: 0, // Sem cache - sempre buscar roles atualizadas
    gcTime: 1 * 60 * 1000, // Mínimo de cache
    retry: 3, // Aumentado para 3 tentativas
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
