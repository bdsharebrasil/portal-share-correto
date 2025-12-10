import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtected } from "@/components/auth/RoleProtected";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import AgendaPage from "./pages/AgendaPage";
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
import DiarioBordoDetalhes from "./pages/DiarioBordoDetalhes";
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
import PortalClienteColaborador from "./pages/PortalClienteColaborador";
import Aerodromos from "./pages/Aerodromos";
import Aeronaves from "./pages/Aeronaves";
import AeronaveDetalhes from "./pages/AeronaveDetalhes";
import GestaoSalarios from "./pages/GestaoSalarios";
import GerenciarUsuarios from "./pages/GerenciarUsuarios";
import GestaoFuncionarios from "./pages/GestaoFuncionarios";
import GestaoCTM from "./pages/GestaoCTM";
import ControleAbastecimento from "./pages/ControleAbastecimento";
import Ferias from "./pages/Ferias";
import Senhas from "./pages/Senhas";
import GestaoFiscal from "./pages/financeiro/GestaoFiscal";
import ConfigMovimentacoes from "./pages/financeiro/ConfigMovimentacoes";
import CalendarioFerias from "./pages/CalendarioFerias";
import DashboardGestor from "./pages/financeiro/DashboardGestor";
import { configurePDFWorker } from "@/lib/pdfWorkerConfig";

const queryClient = new QueryClient();

// Configurar PDF worker uma única vez quando a aplicação inicia
try {
  configurePDFWorker();
} catch (err) {
  console.warn('Aviso: Não foi possível configurar o worker de PDF no boot da aplicação. O worker será carregado do CDN.');
}

const App = () => {
  const renderProtected = (element: JSX.Element) => (
    <ProtectedRoute>{element}</ProtectedRoute>
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <InstallPrompt />
            <HashRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={renderProtected(<Index />)} />
              <Route path="/agenda" element={renderProtected(<AgendaPage />)} />
              <Route path="/agenda/contatos" element={renderProtected(<Contatos />)} />
              <Route path="/agenda/clientes" element={renderProtected(<Clientes />)} />
              <Route path="/agenda/aniversarios" element={renderProtected(<Aniversarios />)} />
              <Route path="/agenda/calendario-ferias" element={renderProtected(<CalendarioFerias />)} />
              <Route path="/documentos" element={renderProtected(<Documentos />)} />
              <Route path="/senhas" element={renderProtected(<Senhas />)} />
              <Route path="/agendamento" element={renderProtected(<Agendamento />)} />
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
              <Route path="/financeiro/dashboard-gestor" element={
                renderProtected(
                  <RoleProtected allowedRoles={["admin","gestor_master"]}>
                    <DashboardGestor />
                  </RoleProtected>
                )
              } />
              <Route path="/cartao/alimentacao" element={renderProtected(<ValeAlimentacao />)} />
              
              <Route path="/cartao/combustivel" element={renderProtected(<ValeCombustivel />)} />
              <Route path="/recados" element={renderProtected(<Recados />)} />
              <Route path="/minhas-tarefas" element={renderProtected(<MinhasTarefas />)} />
              <Route path="/perfil" element={renderProtected(<Perfil />)} />
              <Route path="/portal-cliente" element={renderProtected(<PortalCliente />)} />
              <Route path="/portal-cliente/dashboard" element={renderProtected(<PortalClienteDashboard />)} />
              <Route path="/portal-cliente/colaborador" element={renderProtected(<PortalClienteColaborador />)} />
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
              <Route path="/diario-bordo" element={renderProtected(<DiarioBordo />)} />
              <Route path="/aerodromos" element={renderProtected(<Aerodromos />)} />
                <Route path="/aeronaves" element={renderProtected(<Aeronaves />)} />
                <Route path="/aeronaves/:id" element={renderProtected(<AeronaveDetalhes />)} />
              <Route path="/diario-bordo/:aircraftId" element={renderProtected(<DiarioBordoDetalhes />)} />
              <Route path="/manutencao/vencimentos" element={renderProtected(<ControleVencimentos />)} />
              <Route path="/manutencao/programacao" element={renderProtected(<ProgramacaoManutencao />)} />
              <Route path="/manutencao/relatorios" element={renderProtected(<RelatoriosTecnicos />)} />
              <Route path="/manutencao/ctm" element={renderProtected(<GestaoCTM />)} />
              <Route path="/ferias" element={renderProtected(<Ferias />)} />
              <Route path="*" element={renderProtected(<NotFound />)} />
            </Routes>
            </HashRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
