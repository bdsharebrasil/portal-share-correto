import React, { JSX, useEffect } from "react";
import { HashRouter, Route, Routes, useParams, useNavigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleProtected } from "@/components/auth/RoleProtected";
import { useAuth } from "@/contexts/AuthContext";

// Import das páginas (movidas aqui para limpar App.tsx)
import AgendaHub from "@/pages/AgendaHub";
import Agendamento from "@/pages/Agendamento";
import Aniversarios from "@/pages/agenda/Aniversarios";
import Clientes from "@/pages/agenda/Clientes";
import Contatos from "@/pages/agenda/Contatos";
import ControleVencimentos from "@/pages/ControleVencimentos";
import DiarioBordo from "@/pages/DiarioBordo";
import BancodeHoras from "@/pages/BancodeHoras";
import GestaoTripulacao from "@/pages/GestaoTripulacao";
import Login from "@/pages/Login";
import Documentos from "@/pages/Documentos";
import NotFound from "@/pages/NotFound";
import Perfil from "@/pages/Perfil";
import PlanoVoo from "@/pages/PlanoVoo";
import ProgramacaoManutencao from "@/pages/ProgramacaoManutencao";
import Recados from "@/pages/Recados";
import RelatoriosTecnicos from "@/pages/RelatoriosTecnicos";
import MinhasTarefas from "@/pages/MinhasTarefas";
import TripulanteDetalhes from "@/pages/TripulanteDetalhes";
import ValeAlimentacao from "@/pages/ValeAlimentacao";
import ValeCombustivel from "@/pages/ValeCombustivel";
import PortalCliente from "@/pages/PortalCliente";
import PortalClienteDashboard from "@/pages/PortalClienteDashboard";
import Aerodromos from "@/pages/Aerodromos";
import Aeronaves from "@/pages/Aeronaves";
import AeronaveDetalhes from "@/pages/AeronaveDetalhes";
import GestaoSalarios from "@/pages/GestaoSalarios";
import GerenciarUsuarios from "@/pages/GerenciarUsuarios";
import GestaoFuncionarios from "@/pages/GestaoFuncionarios";
import GestaoCTM from "@/pages/GestaoCTM";
import CTMDetailPage from "@/pages/manutencao/CTMDetailPage";
import OrcamentosCTM from "@/pages/manutencao/OrcamentosCTM";
import ControleAbastecimento from "@/pages/ControleAbastecimento";
import Ferias from "@/pages/Ferias";
import Senhas from "@/pages/Senhas";
import CalendarioFerias from "@/pages/CalendarioFerias";
import DashboardOperacoes from "@/pages/DashboardOperacoes";
import DashboardGestorPage from "@/pages/DashboardGestorPage";
import AprovacaoAgendamentos from "@/pages/AprovacaoAgendamentos";
import PainelAgendamentos from "@/pages/PainelAgendamentos";
import CartoesCorporativos from "@/pages/CartoesCorporativos";
// BalancoCliente movido para modules/core-finance
import MapaComponentes from "@/pages/MapaComponentes";
import ManutencaoPreventiva from "@/pages/ManutencaoPreventiva";
import ManutencaoAeronave from "@/pages/ManutencaoAeronave";
import VencimentosTripulacao from "@/pages/VencimentosTripulacao";
import VencimentosDocumentos from "@/pages/VencimentosDocumentos";
import RelatoriosFinanceiros from "@/modules/core-finance/pages/RelatoriosFinanceiros";
import CoreFinanceRoutes from "@/modules/core-finance/routes";

// Módulo Sócios - exportado por src/modules/socios
import { SociosPage, RelatorioTransacoesSocios } from "@/modules/socios";

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
      navigate("/operacoes", { replace: true });
    }
  }, [roles, isLoading, navigate]);

  // Global loader fica no AppProviders
  return null;
};

const DiarioBordoWrapper = () => {
  const navigate = useNavigate();
  return <DiarioBordo onBack={() => navigate("/")} />;
};

const BancoHorasWrapper = () => {
  const { aircraftId } = useParams<{ aircraftId: string }>();
  const navigate = useNavigate();

  if (!aircraftId) {
    navigate("/diario-bordo");
    return null;
  }

  return <BancodeHoras aircraftId={aircraftId} onBack={() => navigate("/diario-bordo")} />;
};

export default function AppRouter() {
  const renderProtected = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={renderProtected(<HomeRedirect />)} />
        <Route path="/operacoes" element={renderProtected(<DashboardOperacoes />)} />
        {CoreFinanceRoutes()}
        <Route path="/relatorios" element={renderProtected(<RelatoriosFinanceiros />)} />
        <Route
          path="/gestor"
          element={
            renderProtected(
              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                <DashboardGestorPage />
              </RoleProtected>
            )
          }
        />
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
        <Route
          path="/gerenciar-usuarios"
          element={
            renderProtected(
              <RoleProtected allowedRoles={["admin", "gestor_master"]}>
                <GerenciarUsuarios />
              </RoleProtected>
            )
          }
        />
        <Route
          path="/gestao-salarios"
          element={
            renderProtected(
              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                <GestaoSalarios />
              </RoleProtected>
            )
          }
        />
        <Route
          path="/gestao-funcionarios"
          element={
            renderProtected(
              <RoleProtected allowedRoles={["admin", "gestor_master", "financeiro_master"]}>
                <GestaoFuncionarios />
              </RoleProtected>
            )
          }
        />
        <Route path="/abastecimento" element={renderProtected(<ControleAbastecimento />)} />

        <Route path="/diario-bordo" element={renderProtected(<DiarioBordoWrapper />)} />
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
  );
}
