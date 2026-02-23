import React, { JSX } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Importar páginas conforme forem movidas
// import Aeronaves from './pages/Aeronaves';
// import Aerodromos from './pages/Aerodromos';

export default function AtivoAereosRoutes(): JSX.Element {
  const renderProtected = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

  return (
    <>
      {/* 
        Adicione as rotas conforme as páginas forem migradas
        <Route path="/aeronaves" element={renderProtected(<Aeronaves />)} />
        <Route path="/aerodromos" element={renderProtected(<Aerodromos />)} />
      */}
    </>
  );
}