import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import ClientesPage from "./pages/ClientesPage";
import CentroCustosPage from "./pages/CentroCustosPage";
import NotasFiscaisPage from "./pages/NotasFiscaisPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import InadimplenciaPage from "./pages/InadimplenciaPage";
import ConciliacaoBancariaPage from "./pages/ConciliacaoBancariaPage";
import ColaboradoresPage from "./pages/ColaboradoresPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute><FinanceiroPage /></ProtectedRoute>} />
            <Route path="/clientes" element={<ProtectedRoute><ClientesPage /></ProtectedRoute>} />
            <Route path="/conciliacao-bancaria" element={<ProtectedRoute><ConciliacaoBancariaPage /></ProtectedRoute>} />
            <Route path="/colaboradores" element={<ProtectedRoute><ColaboradoresPage /></ProtectedRoute>} />
            <Route path="/inadimplencia" element={<ProtectedRoute><InadimplenciaPage /></ProtectedRoute>} />
            <Route path="/centro-custos" element={<ProtectedRoute><CentroCustosPage /></ProtectedRoute>} />
            <Route path="/notas-fiscais" element={<ProtectedRoute><NotasFiscaisPage /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <InstallBanner />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
