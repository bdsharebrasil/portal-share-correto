import React, { useState, useEffect } from 'react';
import { BookOpen, Banknote, ArrowLeft, Zap, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import { LottieAirplaneSpinner } from '@/components/ui/lottie-airplane-spinner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Aircraft } from '@/types';
import DiarioBordoDetalhes from '../components/diario/DiarioBordoDetalhes';
import BancodeHoras from './BancodeHoras';
import { Layout } from '@/components/layout/Layout';

interface DiarioBordoProps {
  aircraftId: string | null;
  onBack: () => void;
}

interface LogbookMonthData {
  celula_anterior: number | null;
  celula_atual: number | null;
  celula_prox_revisao: number | null;
  celula_disponivel: number | null;
}

type ViewType = 'list' | 'diario' | 'banco';

const decimalToHM = (decimal?: number | null): string => {
  if (decimal === null || decimal === undefined || isNaN(decimal)) return '--:--';

  // Determinar se é negativo
  const isNegative = decimal < 0;
  const absDecimal = Math.abs(decimal);

  // Calcular horas e minutos do valor absoluto
  const totalMinutes = Math.round(absDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  // Aplicar sinal se necessário
  const sign = isNegative ? '-' : '';
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const DiarioBordo: React.FC<DiarioBordoProps> = ({ aircraftId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [logbookMonthData, setLogbookMonthData] = useState<Record<string, LogbookMonthData | null>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchAircraft();

    // Refetch dados quando a página volta ao foco
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchAircraft();
      }
    };

    // Subscribe to realtime changes in logbook_months
    const subscription = supabase
      .channel('logbook-months-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logbook_months'
        },
        () => {
          // Refetch when logbook_months changes
          fetchAircraft();
        }
      )
      .subscribe();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchAircraft = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('aircraft')
        .select('*')
        .eq('status', 'ativa')
        .order('registration', { ascending: true });

      if (error) throw error;
      if (data) {
        setAircraft(data);
        // Buscar dados de logbook_months para cada aeronave (mais recente com dados válidos)
        const monthDataMap: Record<string, LogbookMonthData | null> = {};
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const currentYear = new Date().getFullYear();

        for (const ac of data) {
          try {
            // Primeiro, tentar buscar o mês atual
            let { data: currentMonthData } = await supabase
              .from('logbook_months')
              .select('celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, year, month')
              .eq('aircraft_id', ac.id)
              .eq('year', currentYear)
              .eq('month', currentMonth)
              .maybeSingle();

            // Se existe e tem dados válidos (celula_atual > 0), usar
            if (currentMonthData && (currentMonthData.celula_atual || 0) > 0) {
              monthDataMap[ac.id] = currentMonthData;
              console.log(`Dados do mês atual para ${ac.registration}:`, currentMonthData);
            } else {
              // Caso contrário, buscar o último mês com dados válidos
              const { data: monthsData, error: monthError } = await supabase
                .from('logbook_months')
                .select('celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, year, month')
                .eq('aircraft_id', ac.id)
                .gt('celula_atual', 0)
                .order('year', { ascending: false })
                .order('month', { ascending: false })
                .limit(1);

              if (monthError) {
                console.warn(`Erro ao carregar logbook_months para ${ac.registration}:`, monthError);
                monthDataMap[ac.id] = null;
              } else if (monthsData && monthsData.length > 0) {
                monthDataMap[ac.id] = monthsData[0];
                console.log(`Dados carregados para ${ac.registration}:`, monthsData[0]);
              } else {
                console.log(`Nenhum dado de logbook_months para ${ac.registration}`);
                monthDataMap[ac.id] = null;
              }
            }
          } catch (err) {
            console.error(`Erro ao carregar logbook_months para ${ac.registration}:`, err);
            monthDataMap[ac.id] = null;
          }
        }

        setLogbookMonthData(monthDataMap);
      }
    } catch (error) {
      console.error('Erro ao carregar aeronaves:', error);
    } finally {
      setLoading(false);
    }
  };

  if (selectedAircraftId && currentView === 'diario') {
    return (
      <DiarioBordoDetalhes
        aircraftId={selectedAircraftId}
        onBack={() => {
          setCurrentView('list');
          fetchAircraft(); // Recarrega dados ao voltar
        }}
      />
    );
  }

  if (selectedAircraftId && currentView === 'banco') {
    return (
      <BancodeHoras
        aircraftId={selectedAircraftId}
        onBack={() => {
          setCurrentView('diario');
          fetchAircraft(); // Recarrega dados ao voltar
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <LottieAirplaneSpinner size="md" text="Carregando diário de bordo..." />
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 pb-20">
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
        <h1 className="text-3xl font-black text-white uppercase mb-1">Diário de Bordo</h1>
        <p className="text-slate-500 text-xs">Selecione uma aeronave para visualizar o histórico de voos</p>
      </header>

      {aircraft.length === 0 ? (
        <div className="flex items-center justify-center h-96 bg-slate-900 rounded-[2rem] border border-slate-800">
          <p className="text-slate-500">Nenhuma aeronave encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {aircraft.map(ac => (
            <div
              key={ac.id}
              className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 cursor-pointer hover:border-slate-700 hover:shadow-lg transition-all duration-300 hover:scale-102"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-sky-500/20 rounded-lg">
                  <BookOpen className="w-5 h-5 text-sky-500" />
                </div>
                {ac.status === 'Ativo' && (
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg uppercase">
                    Ativa
                  </span>
                )}
              </div>

              <div className="mb-4">
                <h3 className="text-xl font-black text-white mb-0.5">{ac.registration}</h3>
                <p className="text-slate-500 text-xs uppercase">{ac.model}</p>
              </div>

              <div className="space-y-2 mb-4">
                {logbookMonthData[ac.id] ? (
                  <>
                    <div className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-emerald-600 text-xs uppercase">Célula Atual</p>
                        <p className="text-emerald-400 font-semibold text-base">
                          {decimalToHM(logbookMonthData[ac.id]?.celula_atual)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded">
                      <AlertCircle className="w-3 h-3 text-orange-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-orange-600 text-xs uppercase">Próx. Revisão</p>
                        <p className="text-orange-400 font-semibold text-sm">
                          {decimalToHM(logbookMonthData[ac.id]?.celula_prox_revisao)}
                        </p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 p-2 rounded border ${
                      (logbookMonthData[ac.id]?.celula_disponivel || 0) < 0
                        ? 'bg-red-500/15 border-2 border-red-500 shadow-md shadow-red-500/30'
                        : 'bg-blue-500/10 border border-blue-500/20'
                    }`}>
                      <CheckCircle className={`w-3 h-3 ${
                        (logbookMonthData[ac.id]?.celula_disponivel || 0) < 0
                          ? 'text-red-400'
                          : 'text-blue-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs uppercase ${
                          (logbookMonthData[ac.id]?.celula_disponivel || 0) < 0
                            ? 'text-red-600'
                            : 'text-blue-600'
                        }`}>Disponível</p>
                        <p className={`font-semibold text-sm ${
                          (logbookMonthData[ac.id]?.celula_disponivel || 0) < 0
                            ? 'text-red-400'
                            : 'text-blue-400'
                        }`}>
                          {decimalToHM(logbookMonthData[ac.id]?.celula_disponivel)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded">
                    <BookOpen className="w-3 h-3 text-slate-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-500 text-xs uppercase">Célula Atual</p>
                      <p className="text-emerald-400 font-semibold text-base">
                        {decimalToHM(ac.cell_hours_current)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedAircraftId(ac.id); setCurrentView('diario'); }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-sky-500 text-white font-semibold rounded-lg hover:bg-sky-600 transition-colors"
                >
                  <BookOpen className="w-3 h-3" />
                  Diário
                </button>
                <button
                  onClick={() => { setSelectedAircraftId(ac.id); setCurrentView('banco'); }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-slate-800 text-slate-400 font-semibold rounded-lg hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  <Banknote className="w-3 h-3" />
                  Banco
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </Layout>
  );
};

export default DiarioBordo;
