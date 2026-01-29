import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtected } from "@/components/auth/RoleProtected";
import { AuthProvider } from "@/contexts/AuthContext";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { GlobalLoader } from "@/components/ui/global-loader";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
import SolicitacaoCompras from "./pages/financeiro/SolicitacaoCompras";
import ControlFinanceiro from "./pages/financeiro/ControlFinanceiro";
import AgendamentoPagamentos from "./pages/financeiro/AgendamentoPagamentos";
import Invoices from "./pages/financeiro/Invoices";
import ConciliacaoBancaria from "./pages/ConciliacaoBancaria";
import ControleVencimentos from "./pages/ControleVencimentos";
import DiarioBordo from "./pages/DiarioBordo";
import GestaoTripulacao from "./pages/GestaoTripulacao";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Documentos from "./pages/Documentos";
import NotFound from "./pages/NotFound";
import Perfil from "./pages/Perfil";
import PlanoVoo from "./pages/PlanoVoo";
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
import DashboardGestor from "./pages/financeiro/DashboardGestor";
import ConfigMovimentacoes from "./pages/financeiro/ConfigMovimentacoes";
import CalendarioFerias from "./pages/CalendarioFerias";
import DashboardOperacoes from "./pages/DashboardOperacoes";
import DashboardFinanceiro from "./pages/DashboardFinanceiro";
import DashboardGestorPage from "./pages/DashboardGestorPage";
import AprovacaoAgendamentos from "./pages/AprovacaoAgendamentos";
import PainelAgendamentos from "./pages/PainelAgendamentos";
import CartoesCorporativos from "./pages/CartoesCorporativos";
import BancodeHoras from './pages/BancodeHoras';
import BalancoCliente from "./pages/BalancoCliente";
import MapaComponentes from "./pages/MapaComponentes";
import ManutencaoPreventiva from "./pages/ManutencaoPreventiva";
import VencimentosTripulacao from "./pages/VencimentosTripulacao";
import VencimentosDocumentos from "./pages/VencimentosDocumentos";
const queryClient = new QueryClient();

const App = () => {
  // Configurar PDF worker apenas no cliente
  useEffect(() => {
    // Dynamic import para evitar carregar react-pdf no servidor
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

  // Wrappers para capturar params da URL e onBack
  const DiarioBordoWrapper = () => {
    const navigate = useNavigate();
    return <DiarioBordo aircraftId="" onBack={() => navigate(-1)} />;
  };

  const BancoHorasWrapper = () => {
    const { aircraftId } = useParams<{ aircraftId: string }>();
    const navigate = useNavigate();
    return <BancodeHoras aircraftId={aircraftId!} onBack={() => navigate(-1)} />;
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LoadingProvider>
            <ViewModeProvider>
              <TooltipProvider>
                <Toaster />
                <GlobalLoader />
                <InstallPrompt />
                <HashRouter>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={renderProtected(<Index />)} />
                    <Route path="/operacoes" element={renderProtected(<DashboardOperacoes />)} />
                    <Route path="/financeiro" element={renderProtected(<DashboardFinanceiro />)} />
                    <Route path="/gestor" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <DashboardGestorPage />
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
                    <Route path="/financeiro/conciliacao" element={renderProtected(<ConciliacaoBancaria />)} />
                    <Route path="/financeiro/config" element={renderProtected(<ConfigEmpresa />)} />
                    <Route path="/financeiro/recibo" element={renderProtected(<EmissaoRecibo />)} />
                    <Route path="/financeiro/viagem" element={renderProtected(<RelatorioViagem />)} />
                    <Route path="/financeiro/compras" element={renderProtected(<SolicitacaoCompras />)} />
                    <Route path="/financeiro/controle-financeiro" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <ControlFinanceiro />
                        </RoleProtected>
                      )
                    } />
                    <Route path="/financeiro/config-movimentacoes" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <ConfigMovimentacoes />
                        </RoleProtected>
                      )
                    } />
                    <Route path="/financeiro/agendamento-contas" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <AgendamentoPagamentos />
                        </RoleProtected>
                      )
                    } />
                    <Route path="/financeiro/notas-fiscais" element={renderProtected(<Invoices />)} />
                    <Route path="/financeiro/gestao-fiscal" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <GestaoFiscal />
                        </RoleProtected>
                      )
                    } />
                    <Route path="/financeiro/gestor" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <DashboardGestor />
                        </RoleProtected>
                      )
                    } />
                    <Route path="/financeiro/balanco-cliente" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <BalancoCliente />
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
                        <RoleProtected allowedRoles={["admin","gestor_master"]}>
                          <GerenciarUsuarios />
                        </RoleProtected>
                      )
                    } />
                    <Route path="/gestao-salarios" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <GestaoSalarios />
                        </RoleProtected>
                      )
                    } />
                    <Route path="/gestao-funcionarios" element={
                      renderProtected(
                        <RoleProtected allowedRoles={["admin","gestor_master","financeiro_master"]}>
                          <GestaoFuncionarios />
                        </RoleProtected>
                      )
                    } />
                    <Route path="/abastecimento" element={renderProtected(<ControleAbastecimento />)} />
                    
                    {/* Diário de Bordo */}
                    <Route path="/diario-bordo" element={renderProtected(<DiarioBordoWrapper />)} />
                    <Route path="/diario-bordo/:aircraftId" element={renderProtected(<DiarioBordoWrapper />)} />
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
                    <Route path="/ferias" element={renderProtected(<Ferias />)} />

                    <Route path="*" element={renderProtected(<NotFound />)} />
                  </Routes>
                </HashRouter>
              </TooltipProvider>
            </ViewModeProvider>
          </LoadingProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
