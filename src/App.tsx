import { JSX, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtected } from "@/components/auth/RoleProtected";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { VencimentosSyncProvider } from "@/contexts/VencimentosSyncContext";
import { ExpirationAlertsProvider } from "@/contexts/ExpirationAlertsContext";
import { AnniversaryAlertsProvider } from "@/contexts/AnniversaryAlertsContext";
import { UpdateCheckProvider } from "@/contexts/UpdateCheckContext";
import { GlobalLoader } from "@/components/ui/global-loader";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { UpdateNotificationModal } from "@/components/UpdateNotificationModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Layout as Layout } from "@/components/layout/Layout";
import { RouteChangeListener } from "@/components/RouteChangeListener";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, useParams, useNavigate } from "react-router-dom";

// Import das páginas
import AgendaHub from "./pages/AgendaHub";
import ChecklistPreVoo from "./pages/ChecklistPreVoo";

import ConfigEmpresa from "./pages/financeiro/ConfigEmpresa";
import EmissaoRecibo from "./pages/financeiro/EmissaoRecibo";
import RelatorioViagem from "./pages/financeiro/RelatorioViagem";
import AprovarRelatorioViagem from "./pages/financeiro/AprovarRelatorioViagem";
import RelatoriosClienteDetalhes from "./pages/financeiro/RelatoriosClienteDetalhes";
import SolicitacaoCompras from "./pages/financeiro/SolicitacaoCompras";
import AgendamentoPagamentos from "./components/dashboard/gestor/financeiro-share/agendamento-pagamentos/AgendamentoPagamentos";
import Invoices from "./pages/financeiro/Invoices";
import EmailsPage from "./pages/financeiro/Emails";
import HistoricoProgramacaoPagamentos from "./pages/financeiro/HistoricoProgramacaoPagamentos";
import ControleVencimentos from "./pages/ControleVencimentos";
import DiarioBordoDetalhes from "./components/diario/DiarioBordoDetalhes";
import DiarioBordo from "./pages/DiarioBordo";
import BancodeHoras from './pages/DiarioBordo/BancodeHoras';
import GestaoTripulacao from "./pages/GestaoTripulacao";
import Login from "./pages/Login";
import Documentos from "./pages/Documentos";
import NotFound from "./pages/NotFound";
import Perfil from "./pages/Perfil";
import PlanoVoo from "./pages/PlanoVoo";
import PlanosVooSalvos from "./pages/PlanosVooSalvos";
import Recados from "./pages/Recados";
import MinhasTarefas from "./pages/MinhasTarefas";
import TripulanteDetalhes from "./pages/TripulanteDetalhes";
import ValeAlimentacao from "./pages/ValeAlimentacao";
import ValeCombustivel from "./pages/ValeCombustivel";
import PortalCliente from "./pages/PortalCliente";
import Aerodromos from "./pages/Aerodromos";
import CTM from "./pages/CTM";
import Aeronaves from "./pages/Aeronaves";
import AeronaveDetalhes from "./pages/AeronaveDetalhes";
import GestaoSalarios from "./pages/GestaoSalarios";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import GestaoFuncionarios from "./pages/GestaoFuncionarios";
import ControleAbastecimento from "./pages/ControleAbastecimento";
import Ferias from "./pages/Ferias";
import Senhas from "./pages/Senhas";
import Mensagens from "./pages/Mensagens";
import GestaoFiscal from "./components/dashboard/gestor/financeiro-share/Index";
import MasterRelatorios from "./components/dashboard/gestor/master/MasterRelatorios";
import AprovacoesOrcamentos from "./pages/gestor/AprovacoesOrcamentos";
import ConfiguracoesFiscais from "./components/dashboard/gestor/financeiro-share/ConfiguracoesFiscais";

import Master from "./components/dashboard/gestor/master/Master";
import MasterColaboradores from "./components/dashboard/gestor/master/MasterColaboradores";
import CriarProposta from "./components/dashboard/gestor/master/CriarProposta";

import ComparativoAeronaves from "./pages/gestor/ComparativoAeronaves";

import DashboardOperacoes from "./pages/DashboardOperacoes";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import DashboardGestorPage from "./pages/DashboardGestorPage";
import AprovacaoAgendamentos from "./components/AgendamentoVoo/AprovacaoAgendamentos";
import PainelAgendamentos from "./pages/PainelAgendamentos";
import CartoesCorporativos from "./pages/CartoesCorporativos";
import VencimentosTripulacao from "./pages/VencimentosTripulacao";
import VencimentosDocumentos from "./pages/VencimentosDocumentos";
import { FinanceiroCotistas, FinanceiroCotistaDetalhe } from "./components/dashboard/gestor/FinanceiroCotista";
import LancamentoForm from "./components/dashboard/gestor/FinanceiroCotista/LancamentoForm";
import { CostSimulator } from "./components/dashboard/CostSimulator";
import ManualSistema from "./pages/ManualSistema";

// Componentes wrapper definidos FORA do App para evitar conflitos com hooks

const HomeRedirect = () => {
  const { roles, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (
      roles.includes("admin") ||
      roles.includes("gestor_master") ||
      roles.includes("financeiro_master")
    ) {
      navigate("/gestor", { replace: true });
    } else if (roles.includes("financeiro")) {
      navigate("/financeiro", { replace: true });
    } else {
      // coordenador_de_voo, piloto_chefe, tripulante e demais
      navigate("/operacoes", { replace: true });
    }
  }, [roles, isLoading, navigate]);

  return <GlobalLoader />;
};

const DiarioBordoWrapper = () => {
  return <DiarioBordo />;
};

const BancoHorasWrapper = () => {
  const { aircraftId } = useParams<{ aircraftId: string }>();
  const navigate = useNavigate();

  if (!aircraftId) {
    navigate('/diario-bordo');
    return null;
  }

  return <BancodeHoras aircraftId={aircraftId} onBack={() => navigate('/diario-bordo')} />;
};

const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    import("@/lib/pdfWorkerConfig")
      .then(({ configurePDFWorker }) => {
        configurePDFWorker();
      })
      .catch((err) => {
        console.warn('Aviso: Não foi possível configurar o worker de PDF. Será carregado do CDN.', err);
      });
  }, []);

  const renderProtected = (element: JSX.Element) => (
    <ProtectedRoute>{element}</ProtectedRoute>
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LoadingProvider>
            <ViewModeProvider>
              <VencimentosSyncProvider>
                <ExpirationAlertsProvider>
                  <AnniversaryAlertsProvider>
                    <UpdateCheckProvider>
                      <TooltipProvider>
                        <Toaster />
                        <GlobalLoader />
                        <InstallPrompt />
                        <UpdateNotificationModal />
                        <HashRouter>
                        <RouteChangeListener />
                        <Routes>
                          <Route path="/login" element={<Login />} />
                          <Route path="/" element={renderProtected(<HomeRedirect />)} />
                          <Route path="/operacoes" element={renderProtected(<DashboardOperacoes />)} />
                          <Route path="/financeiro" element={renderProtected(<DashboardFinanceiro />)} />

                          <Route path="/gestor" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <DashboardGestorPage />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/simulador-custos" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <Layout>
                                  <CostSimulator />
                                </Layout>
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/aprovacoes-orcamentos" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <Layout>
                                  <AprovacoesOrcamentos />
                                </Layout>
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/financeiro-share" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <GestaoFiscal />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/funcionarios" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <GestaoFuncionarios />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/configuracoes" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <ConfiguracoesFiscais />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/financeiro-cotistas" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <FinanceiroCotistas />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/financeiro-cotistas/:clienteId" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <FinanceiroCotistaDetalhe />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/lancamento/:clienteId/:aeronaveId" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <LancamentoForm />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/master" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master"]}>
                                <Master />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/master/colaboradores" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master"]}>
                                <MasterColaboradores />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/master/relatorios" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <MasterRelatorios />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/master/aeronaves" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <ComparativoAeronaves />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/master/proposta" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <CriarProposta />
                              </RoleProtected>
                            )
                          } />


                          <Route path="/agenda" element={renderProtected(<AgendaHub />)} />
                          <Route path="/documentos" element={renderProtected(<Documentos />)} />
                          <Route path="/senhas" element={renderProtected(<Senhas />)} />
                          <Route path="/mensagens" element={renderProtected(<Mensagens />)} />
                          <Route path="/aprovacao-agendamentos" element={renderProtected(<AprovacaoAgendamentos />)} />
                         <Route path="/painel-agendamentos" element={renderProtected(<PainelAgendamentos />)} />
                         <Route path="/pre-voo/:solicitacaoId" element={renderProtected(<ChecklistPreVoo />)} />
                          <Route path="/plano-voo" element={renderProtected(<PlanoVoo />)} />
                          <Route path="/planos-voo-salvos" element={renderProtected(<PlanosVooSalvos />)} />
                          <Route path="/financeiro/config" element={renderProtected(<ConfigEmpresa />)} />
                          <Route path="/financeiro/recibo" element={renderProtected(<EmissaoRecibo />)} />
                          <Route path="/financeiro/emails" element={renderProtected(<EmailsPage />)} />
                          <Route path="/financeiro/historico-programacao-pagamentos" element={renderProtected(<HistoricoProgramacaoPagamentos />)} />
                          <Route path="/financeiro/viagem" element={renderProtected(<RelatorioViagem />)} />
                          <Route path="/financeiro/relatorio-viagem" element={renderProtected(<RelatorioViagem />)} />
                          <Route path="/aprovar-relatorio/:token" element={<AprovarRelatorioViagem />} />
                          <Route path="/financeiro/relatorios-cliente/:clientId" element={renderProtected(<RelatoriosClienteDetalhes />)} />
                          <Route path="/financeiro/compras" element={renderProtected(<SolicitacaoCompras />)} />
                          <Route path="/financeiro/agendamento-contas" element={renderProtected(<AgendamentoPagamentos />)} />
                          <Route path="/financeiro/notas-fiscais" element={renderProtected(<Invoices />)} />
                          <Route path="/ciclo-voo" element={renderProtected(<Invoices />)} />
                          <Route path="/historico-ponto" element={renderProtected(<Invoices />)} />

                          <Route path="/cartoes-corporativos" element={renderProtected(<CartoesCorporativos />)} />
                          <Route path="/cartao/alimentacao" element={renderProtected(<ValeAlimentacao />)} />
                          <Route path="/cartao/combustivel" element={renderProtected(<ValeCombustivel />)} />
                          <Route path="/recados" element={renderProtected(<Recados />)} />
                          <Route path="/minhas-tarefas" element={renderProtected(<MinhasTarefas />)} />
                          <Route path="/perfil" element={renderProtected(<Perfil />)} />
                          <Route path="/portal-cliente" element={renderProtected(<PortalCliente />)} />
                          <Route path="/portal-cliente/dashboard" element={renderProtected(<PortalCliente />)} />
                          <Route path="/tripulacao" element={renderProtected(<GestaoTripulacao />)} />
                          <Route path="/tripulacao/:id" element={renderProtected(<TripulanteDetalhes />)} />
                          <Route path="/gerenciar-usuarios" element={renderProtected(<GerenciarUsuarios />)} />
                          <Route path="/gestao-salarios" element={renderProtected(<GestaoSalarios />)} />
                          <Route path="/abastecimento" element={renderProtected(<ControleAbastecimento />)} />

                          {/* Diário de Bordo */}
                          <Route
                            path="/diario-bordo"
                            element={renderProtected(<DiarioBordoWrapper />)}
                          />
                          <Route
                            path="/diario-bordo/:aircraftId"
                            element={renderProtected(<DiarioBordoDetalhes />)}
                          />
                          <Route path="/hora-banco/:aircraftId" element={renderProtected(<BancoHorasWrapper />)} />

                          <Route path="/ctm" element={renderProtected(<CTM />)} />
                          <Route path="/ctm/:aircraftId" element={renderProtected(<CTM />)} />
                          <Route path="/aerodromos" element={renderProtected(<Aerodromos />)} />
                          <Route path="/aeronaves" element={renderProtected(<Aeronaves />)} />
                          <Route path="/aeronaves/:id" element={renderProtected(<AeronaveDetalhes />)} />
                          <Route path="/vencimentos" element={renderProtected(<ControleVencimentos />)} />
                          <Route path="/vencimentos/tripulacao" element={renderProtected(<VencimentosTripulacao />)} />
                          <Route path="/vencimentos/documentos" element={renderProtected(<VencimentosDocumentos />)} />
                          <Route path="/ferias" element={renderProtected(<Ferias />)} />
                          <Route path="/manual" element={renderProtected(<ManualSistema />)} />
                          <Route path="*" element={renderProtected(<NotFound />)} />
                        </Routes>
                        </HashRouter>
                      </TooltipProvider>
                    </UpdateCheckProvider>
                  </AnniversaryAlertsProvider>
                </ExpirationAlertsProvider>
              </VencimentosSyncProvider>
            </ViewModeProvider>
          </LoadingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
