import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { getDashboardRouteFromRoles } from "@/lib/dashboard-routing";

const Index = () => {
  const navigate = useNavigate();
  const { userRoles, isLoading } = useUserRole();

  useEffect(() => {
    if (!isLoading && userRoles.length > 0) {
      // Redirecionar para o dashboard correto baseado nas roles
      const { route } = getDashboardRouteFromRoles(userRoles);
      navigate(route, { replace: true });
    }
  }, [userRoles, isLoading, navigate]);

  // Enquanto carrega, mostrar um spinner simples
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Se não tiver roles, também mostrar spinner (não deveria acontecer)
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default Index;
