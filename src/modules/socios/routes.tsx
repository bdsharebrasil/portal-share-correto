import React, { JSX } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleProtected } from '@/components/auth/RoleProtected';

import { SociosPage, RelatorioTransacoesSocios } from './pages';

export default function SociosRoutes(): JSX.Element {
  const renderProtected = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

  return (
    <>
      <Route
        path="/socios"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <SociosPage />
            </RoleProtected>
          )
        }
      />
      <Route
        path="/financeiro/relatorio-socios/:clienteId"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <RelatorioTransacoesSocios />
            </RoleProtected>
          )
        }
      />
      <Route
        path="/socios/relatorio/:clienteId"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <RelatorioTransacoesSocios />
            </RoleProtected>
          )
        }
      />
    </>
  );
}