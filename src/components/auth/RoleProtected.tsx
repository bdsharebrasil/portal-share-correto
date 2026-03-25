import React from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { AirplaneSpinner } from "@/components/ui/airplane-spinner";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RoleProtectedProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export function RoleProtected({ children, allowedRoles }: RoleProtectedProps) {
  const { userRoles, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <AirplaneSpinner size="md" />
      </div>
    );
  }

  const hasAny = allowedRoles.some(r => (userRoles as string[]).includes(r));

  if (!hasAny) {
    // Mostrar mensagem de Acesso Negado dentro do layout
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

  return <>{children}</>;
}
