import React, { JSX } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { RoleProtected } from '@/components/auth/RoleProtected';

import DashboardFinanceiro from './pages/DashboardFinanceiro';
import ConciliacaoBancaria from './pages/ConciliacaoBancaria';
import ConfigEmpresa from './pages/ConfigEmpresa';
import EmissaoRecibo from './pages/EmissaoRecibo';
import RelatorioViagem from './pages/RelatorioViagem';
import SolicitacaoCompras from './pages/SolicitacaoCompras';
import ControlFinanceiro from './pages/ControlFinanceiro';
import AgendamentoPagamentos from './pages/AgendamentoPagamentos';
import Invoices from './pages/Invoices';
import GestaoFiscal from './pages/GestaoFiscal';
import DashboardGestor from './pages/DashboardGestor';
import ConfigMovimentacoes from './pages/ConfigMovimentacoes';
import BalancoCliente from './pages/BalancoCliente';

export default function CoreFinanceRoutes(): JSX.Element {
  const renderProtected = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

  return (
    <>
      <Route path="/financeiro" element={renderProtected(<DashboardFinanceiro />)} />
      <Route path="/financeiro/conciliacao" element={renderProtected(<ConciliacaoBancaria />)} />
      <Route path="/financeiro/config" element={renderProtected(<ConfigEmpresa />)} />
      <Route path="/financeiro/recibo" element={renderProtected(<EmissaoRecibo />)} />
      <Route path="/financeiro/viagem" element={renderProtected(<RelatorioViagem />)} />
      <Route path="/financeiro/compras" element={renderProtected(<SolicitacaoCompras />)} />
      <Route
        path="/financeiro/controle-financeiro"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <ControlFinanceiro />
            </RoleProtected>
          )
        }
      />
      <Route
        path="/financeiro/config-movimentacoes"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <ConfigMovimentacoes />
            </RoleProtected>
          )
        }
      />
      <Route
        path="/financeiro/agendamento-contas"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <AgendamentoPagamentos />
            </RoleProtected>
          )
        }
      />
      <Route path="/financeiro/notas-fiscais" element={renderProtected(<Invoices />)} />
      <Route
        path="/financeiro/gestao-fiscal"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <GestaoFiscal />
            </RoleProtected>
          )
        }
      />
      <Route
        path="/financeiro/gestor"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <DashboardGestor />
            </RoleProtected>
          )
        }
      />
      <Route
        path="/financeiro/balanco-cliente"
        element={
          renderProtected(
            <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
              <BalancoCliente />
            </RoleProtected>
          )
        }
      />
      {/* Rotas de sócios são mantidas no módulo `socios` por enquanto */}
    </>
  );
}
