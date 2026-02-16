// index.tsx
import { useState } from 'react';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { LottieAirplaneSpinner } from '@/components/ui/lottie-airplane-spinner';
import { Layout } from '@/components/layout/Layout';
import DiarioBordoDetalhes from '@/components/diario/DiarioBordoDetalhes';
import BancodeHoras from '../BancodeHoras';
import { AircraftCard } from './components/AircraftCard';
import { EmptyState } from './components/EmptyState';
import { useAircraftList } from './hooks/useAircraftList';
import { useLogbookMonthData } from './hooks/useLogbookMonthData';
import type { ViewType } from './types';

interface DiarioBordoProps {
  aircraftId: string | null;
  onBack: () => void;
}

const DiarioBordo: React.FC<DiarioBordoProps> = ({ aircraftId, onBack }) => {
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
    setSelectedAircraftId(id);
    setCurrentView('banco');
  };

  // Render different views
  if (selectedAircraftId && currentView === 'diario') {
    return (
      <DiarioBordoDetalhes
        aircraftId={selectedAircraftId}
        onBack={handleBackToList}
      />
    );
  }

  if (selectedAircraftId && currentView === 'banco') {
    return (
      <BancodeHoras
        aircraftId={selectedAircraftId}
        onBack={() => {
          setCurrentView('diario');
          refetchAircraft();
        }}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <LottieAirplaneSpinner size="md" text="Carregando diário de bordo..." />
      </div>
    );
  }

  // Main list view
  return (
    <Layout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-3 gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Dashboard
            </button>
            <button
              onClick={() => navigate('/aerodromos')}
              className="flex items-center gap-3 px-3 rounded-lg text-white hover:bg-emerald-700 transition-colors duration-200"
              style={{
                backgroundColor: 'rgba(2, 124, 87, 1)',
                fontSize: '15px',
                padding: '6px 12px 8px',
                justifyContent: 'flex-start',
                margin: '12px 28px 4px 11px'
              }}
            >
              <MapPin className="w-4 h-4" style={{ marginTop: '2px' }} />
              Aerodromos
            </button>
          </div>
          <h1 className="text-3xl font-black text-white uppercase mb-1">
            Diário de Bordo
          </h1>
          <p className="text-slate-500 text-xs">
            Selecione uma aeronave para visualizar o histórico de voos
          </p>
        </header>

        {/* Aircraft Grid */}
        {aircraft.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {aircraft.map(ac => (
              <AircraftCard
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
