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
import { GlobalLoader } from "@/components/ui/global-loader";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Layout as Layout } from "@/components/layout/Layout";
import { RouteChangeListener } from "@/components/RouteChangeListener";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, useParams, useNavigate } from "react-router-dom";

// Import das páginas
import AgendaHub from "./pages/AgendaHub";
import Agendamento from "./pages/Agendamento";
import Aniversarios from "./pages/agenda/Aniversarios";
import Clientes from "./pages/agenda/Clientes";
import Contatos from "./pages/agenda/Contatos";
import ConfigEmpresa from "./pages/financeiro/ConfigEmpresa";
import EmissaoRecibo from "./pages/financeiro/EmissaoRecibo";
import RelatorioViagem from "./pages/financeiro/RelatorioViagem";
import AprovarRelatorioViagem from "./pages/financeiro/AprovarRelatorioViagem";
import RelatoriosClienteDetalhes from "./pages/financeiro/RelatoriosClienteDetalhes";
import SolicitacaoCompras from "./pages/financeiro/SolicitacaoCompras";
import ControlFinanceiro from "./pages/financeiro/ControlFinanceiro";
import AgendamentoPagamentos from "./pages/financeiro/AgendamentoPagamentos";
import Invoices from "./pages/financeiro/Invoices";
import ConciliacaoBancaria from "./pages/ConciliacaoBancaria";
import ControleVencimentos from "./pages/ControleVencimentos";
import DiarioBordo from "./pages/DiarioBordo";
import DiarioBordoDetalhes from "./components/diario/DiarioBordoDetalhes";
import BancodeHoras from './pages/BancodeHoras';
import GestaoTripulacao from "./pages/GestaoTripulacao";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Documentos from "./pages/Documentos";
import NotFound from "./pages/NotFound";
import Perfil from "./pages/Perfil";
import PlanoVoo from "./pages/PlanoVoo";
import FlightMapView from "./pages/FlightMapView";
import ProgramacaoManutencao from "./pages/ProgramacaoManutencao";
import Recados from "./pages/Recados";
import RelatoriosTecnicos from "./pages/RelatoriosTecnicos";
import MinhasTarefas from "./pages/MinhasTarefas";
import TripulanteDetalhes from "./pages/TripulanteDetalhes";
import ValeAlimentacao from "./pages/ValeAlimentacao";
import ValeCombustivel from "./pages/ValeCombustivel";
import PortalCliente from "./pages/PortalCliente";
import PortalClienteDashboard from "./pages/PortalClienteDashboard";
import Aerodromos from "./pages/Aerodromos";
import Aeronaves from "./pages/Aeronaves";
import AeronaveDetalhes from "./pages/AeronaveDetalhes";
import GestaoSalarios from "./pages/GestaoSalarios";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import GestaoFuncionarios from "./pages/GestaoFuncionarios";
import GestaoCTM from "./pages/GestaoCTM";
import CTMDetailPage from "./pages/manutencao/CTMDetailPage";
import OrcamentosCTM from "./pages/manutencao/OrcamentosCTM";
import ControleAbastecimento from "./pages/ControleAbastecimento";
import Ferias from "./pages/Ferias";
import Senhas from "./pages/Senhas";
import GestaoFiscal from "./pages/financeiro/GestaoFiscal";
import ConfiguracoesFiscais from "./pages/financeiro/ConfiguracoesFiscais";
import Master from "./pages/financeiro/Master";
import MasterColaboradores from "./pages/financeiro/MasterColaboradores";
import ConfigMovimentacoes from "./pages/financeiro/ConfigMovimentacoes";
import CalendarioFerias from "./pages/CalendarioFerias";
import DashboardOperacoes from "./pages/DashboardOperacoes";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import DashboardGestorPage from "./pages/DashboardGestorPage";
import AprovacaoAgendamentos from "./pages/AprovacaoAgendamentos";
import AprovacoesorOrcamentos from "./pages/gestor/AprovacoesorOrcamentos";
import PainelAgendamentos from "./pages/PainelAgendamentos";
import CartoesCorporativos from "./pages/CartoesCorporativos";
import BalancoCliente from "./pages/BalancoCliente";
import MapaComponentes from "./pages/MapaComponentes";
import ManutencaoPreventiva from "./pages/ManutencaoPreventiva";
import ManutencaoAeronave from "./pages/ManutencaoAeronave";
import VencimentosTripulacao from "./pages/VencimentosTripulacao";
import VencimentosDocumentos from "./pages/VencimentosDocumentos";
import FinanceiroSocios from "./pages/FinanceiroSocios";
import RelatorioTransacoesSocios from "./pages/RelatorioTransacoesSocios";
import RelatoriosFinanceiros from "./pages/RelatoriosFinanceiros";
import RelatorioMensal from "./pages/RelatorioMensal";
import CentroLancamentoCustos from "./pages/CentroLancamentoCustos";

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
                    <TooltipProvider>
                      <Toaster />
                      <GlobalLoader />
                      <InstallPrompt />
                      <HashRouter>
                        <RouteChangeListener />
                        <Routes>
                          <Route path="/login" element={<Login />} />
                          <Route path="/" element={renderProtected(<HomeRedirect />)} />
                          <Route path="/operacoes" element={renderProtected(<DashboardOperacoes />)} />
                          <Route path="/financeiro" element={renderProtected(<DashboardFinanceiro />)} />
                          <Route path="/relatorios" element={renderProtected(<Layout><RelatoriosFinanceiros /></Layout>)} />
                          <Route path="/gestor" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <DashboardGestorPage />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestor/aprovacoes-orcamentos" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <AprovacoesorOrcamentos />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/agenda" element={renderProtected(<AgendaHub />)} />
                          <Route path="/agenda/contatos" element={renderProtected(<Contatos />)} />
                          <Route path="/agenda/clientes" element={renderProtected(<Clientes />)} />
                          <Route path="/agenda/aniversarios" element={renderProtected(<Aniversarios />)} />
                          <Route path="/agenda/calendario-ferias" element={renderProtected(<CalendarioFerias />)} />
                          <Route path="/documentos" element={renderProtected(<Documentos />)} />
                          <Route path="/senhas" element={renderProtected(<Senhas />)} />
                          <Route path="/agendamento" element={renderProtected(<Agendamento />)} />
                          <Route path="/aprovacao-agendamentos" element={renderProtected(<AprovacaoAgendamentos />)} />
                          <Route path="/painel-agendamentos" element={renderProtected(<PainelAgendamentos />)} />
                          <Route path="/plano-voo" element={renderProtected(<PlanoVoo />)} />
                          <Route path="/flight-map-view" element={renderProtected(<FlightMapView />)} />
                          <Route path="/financeiro/conciliacao" element={renderProtected(<ConciliacaoBancaria />)} />
                          <Route path="/financeiro/config" element={renderProtected(<ConfigEmpresa />)} />
                          <Route path="/financeiro/recibo" element={renderProtected(<EmissaoRecibo />)} />
                          <Route path="/financeiro/viagem" element={renderProtected(<RelatorioViagem />)} />
                          <Route path="/financeiro/relatorio-viagem" element={renderProtected(<RelatorioViagem />)} />
                          <Route path="/aprovar-relatorio/:token" element={<AprovarRelatorioViagem />} />
                          <Route path="/financeiro/relatorios-cliente/:clientId" element={renderProtected(<RelatoriosClienteDetalhes />)} />
                          <Route path="/financeiro/compras" element={renderProtected(<SolicitacaoCompras />)} />
                          <Route path="/financeiro/controle-financeiro" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <ControlFinanceiro />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/config-movimentacoes" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <ConfigMovimentacoes />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/agendamento-contas" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <AgendamentoPagamentos />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/notas-fiscais" element={renderProtected(<Invoices />)} />
                          <Route path="/financeiro/gestao-fiscal" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <GestaoFiscal />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/configuracoes-fiscais" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <ConfiguracoesFiscais />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/master" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master"]}>
                                <Master />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/master/colaboradores" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master"]}>
                                <MasterColaboradores />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/balanco-cliente" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <BalancoCliente />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/financeiro-socios" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <FinanceiroSocios />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/relatorio-socios/:clienteId" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <RelatorioTransacoesSocios />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/relatorio-mensal/:clienteId" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <RelatorioMensal />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/financeiro/centro-custos/:clienteId" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <CentroLancamentoCustos />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/cartoes-corporativos" element={renderProtected(<CartoesCorporativos />)} />
                          <Route path="/cartao/alimentacao" element={renderProtected(<ValeAlimentacao />)} />
                          <Route path="/cartao/combustivel" element={renderProtected(<ValeCombustivel />)} />
                          <Route path="/recados" element={renderProtected(<Recados />)} />
                          <Route path="/minhas-tarefas" element={renderProtected(<MinhasTarefas />)} />
                          <Route path="/perfil" element={renderProtected(<Perfil />)} />
                          <Route path="/portal-cliente" element={renderProtected(<PortalCliente />)} />
                          <Route path="/portal-cliente/dashboard" element={renderProtected(<PortalClienteDashboard />)} />
                          <Route path="/tripulacao" element={renderProtected(<GestaoTripulacao />)} />
                          <Route path="/tripulacao/:id" element={renderProtected(<TripulanteDetalhes />)} />
                          <Route path="/gerenciar-usuarios" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master"]}>
                                <GerenciarUsuarios />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestao-salarios" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <GestaoSalarios />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/gestao-funcionarios" element={
                            renderProtected(
                              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                                <GestaoFuncionarios />
                              </RoleProtected>
                            )
                          } />
                          <Route path="/abastecimento" element={renderProtected(<ControleAbastecimento />)} />
                          <Route path="/controle-abastecimento" element={renderProtected(<ControleAbastecimento />)} />

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

                          <Route path="/aerodromos" element={renderProtected(<Aerodromos />)} />
                          <Route path="/aeronaves" element={renderProtected(<Aeronaves />)} />
                          <Route path="/aeronaves/:id" element={renderProtected(<AeronaveDetalhes />)} />
                          <Route path="/vencimentos" element={renderProtected(<ControleVencimentos />)} />
                          <Route path="/vencimentos/tripulacao" element={renderProtected(<VencimentosTripulacao />)} />
                          <Route path="/vencimentos/documentos" element={renderProtected(<VencimentosDocumentos />)} />
                          <Route path="/manutencao/vencimentos" element={renderProtected(<ControleVencimentos />)} />
                          <Route path="/manutencao/programacao" element={renderProtected(<ProgramacaoManutencao />)} />
                          <Route path="/manutencao/relatorios" element={renderProtected(<RelatoriosTecnicos />)} />
                          <Route path="/manutencao/mapa-componentes" element={renderProtected(<MapaComponentes />)} />
                          <Route path="/manutencao/ctm" element={renderProtected(<GestaoCTM />)} />
                          <Route path="/manutencao/ctm-detail" element={renderProtected(<CTMDetailPage />)} />
                          <Route path="/manutencao/orcamentos" element={renderProtected(<OrcamentosCTM />)} />
                          <Route path="/manutencao/preventiva" element={renderProtected(<ManutencaoPreventiva />)} />
                          <Route path="/manutencao/aeronaves" element={renderProtected(<ManutencaoAeronave />)} />
                          <Route path="/ferias" element={renderProtected(<Ferias />)} />
                          <Route path="*" element={renderProtected(<NotFound />)} />
                        </Routes>
                      </HashRouter>
                    </TooltipProvider>
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
