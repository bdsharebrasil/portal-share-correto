import React from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { LottieAirplaneSpinner } from "@/components/ui/lottie-airplane-spinner";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RoleProtectedProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export function RoleProtected({ children, allowedRoles }: RoleProtectedProps) {
  const { userRoles, isLoading } = useUserRole();

  console.log("[RoleProtected] Verificando acesso:", {
    isLoading,
    userRoles,
    allowedRoles,
    timestamp: new Date().toISOString(),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LottieAirplaneSpinner size="md" />
      </div>
    );
  }

  // Se não tem roles carregadas, negar acesso
  if (!userRoles || userRoles.length === 0) {
    console.warn("[RoleProtected] Acesso negado: usuário sem roles");
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Acesso negado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const hasAny = allowedRoles.some(r => userRoles.includes(r));

  console.log("[RoleProtected] Verificação de roles:", {
    hasAny,
    rolesDoUsuario: userRoles,
    rolesPermitidas: allowedRoles,
  });

  if (!hasAny) {
    // Mostrar mensagem de Acesso Negado dentro do layout
    console.warn("[RoleProtected] Acesso negado: role não autorizada");
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Acesso negado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  console.log("[RoleProtected] Acesso permitido");
  return <>{children}</>;
}
