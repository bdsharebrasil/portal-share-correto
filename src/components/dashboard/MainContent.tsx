import { useViewMode } from "@/contexts/ViewModeContext";
import { DashboardHero } from "./operador/DashboardHero";
import { FleetStatusCards } from "./operador/FleetStatusCards";
import { OperationsTools } from "./operador/OperationsTools";
import { MessagesPanel } from "./operador/MessagesPanel";
import { FinanceiroDashboard } from "./FinanceiroDashboard";
import { GestorDashboard } from "./GestorDashboard";

import PortalClienteDashboard from "@/pages/PortalClienteDashboard";

export function MainContent() {
  const { viewMode } = useViewMode();

  if (viewMode === 'financeiro') {
    return <FinanceiroDashboard />;
  }

 

  if (viewMode === 'portal-cliente') {
    return <PortalClienteDashboard />;
  }

  if (viewMode === 'gestor') {
    return <GestorDashboard />;
  }

  // Operações view (default)
  return (
    <main className="flex-1 p-6 space-y-6">
      {/* Hero Section */}
      <DashboardHero />

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-max">
        {/* Operations Tools - Full Width */}
        <div className="md:col-span-2 lg:col-span-4">
          <h3 className="text-lg font-semibold text-foreground mb-4">Ferramentas de Operações</h3>
          <OperationsTools />
        </div>

        {/* Fleet Status Cards - Takes 2 columns on lg */}
        <div className="md:col-span-2 lg:col-span-2">
          <FleetStatusCards />
        </div>

        {/* Messages Panel - Takes 2 columns on lg */}
        <div className="md:col-span-2 lg:col-span-2">
          <MessagesPanel />
        </div>

      </div>
    </main>
  );
}
