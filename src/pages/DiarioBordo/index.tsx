import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ViewType } from "./types";
import { useAircraftList } from "./hooks/useAircraftList";
import { useLogbookMonthData } from "./hooks/useLogbookMonthData";
import DiarioBordoDetalhes from "@/components/diario/DiarioBordoDetalhes";
import { LottieAirplaneSpinner } from "@/components/ui/lottie-airplane-spinner";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { EmptyState } from "./components/EmptyState";
import { AeronaveCard } from "./components/AircraftCard";

// pages/DiarioBordo/index.tsx - FINAL
interface DiarioBordoProps {
  onBack: () => void;
}

const DiarioBordo: React.FC<DiarioBordoProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('list');

  // Custom hooks
  const { aircraft, loading: loadingAircraft, refetch: refetchAircraft } = useAircraftList();
  const { logbookMonthData, loading: loadingLogbook } = useLogbookMonthData(aircraft);

  const loading = loadingAircraft || loadingLogbook;

  // Handlers
  const handleBackToList = () => {
    setCurrentView('list');
    refetchAircraft();
  };

  const handleViewDiario = (id: string) => {
    setSelectedAircraftId(id);
    setCurrentView('diario');
  };

  const handleViewBanco = (id: string) => {
    navigate(`/hora-banco/${id}`);
  };

  const handleNavigateAerodromes = () => {
    navigate(`/aerodromos`);
  };

  // Views condicionais
  if (selectedAircraftId && currentView === 'diario') {
    return (
      <DiarioBordoDetalhes
        aircraftId={selectedAircraftId}
        onBack={handleBackToList}
      />
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <LottieAirplaneSpinner size="md" text="Carregando diário de bordo..." />
      </div>
    );
  }

  // Lista de aeronaves
  return (
    <Layout>
      <div className="space-y-6">
        <header className="mb-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Dashboard
            </button>
            <Button
              onClick={handleNavigateAerodromes}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white"
            >
              <MapPin className="w-4 h-4" />
              Aeródromos
            </Button>
          </div>
          <h1 className="text-3xl font-black text-white mb-1">Diário de Bordo</h1>
          <p className="text-slate-500 text-sm">Selecione uma aeronave para visualizar o histórico de voos</p>
        </header>

        {aircraft.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {aircraft.map(ac => (
              <AeronaveCard
                key={ac.id}
                aircraft={ac}
                logbookData={logbookMonthData[ac.id] || null}
                onViewDiario={() => handleViewDiario(ac.id)}
                onViewBanco={() => handleViewBanco(ac.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DiarioBordo;
