import React, { JSX } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Importar páginas conforme forem movidas
// import Clientes from './pages/Clientes';
// import ClienteDetalhes from './pages/ClienteDetalhes';

export default function ClientesRoutes(): JSX.Element {
  const renderProtected = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

  return (
    <>
      {/* 
        Adicione as rotas conforme as páginas forem migradas
        <Route path="/clientes" element={renderProtected(<Clientes />)} />
        <Route path="/clientes/:id" element={renderProtected(<ClienteDetalhes />)} />
      */}
    </>
  );
}