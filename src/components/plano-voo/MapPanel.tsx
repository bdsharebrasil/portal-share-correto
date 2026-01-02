import React, { useEffect, useState, useRef } from 'react';
import { Plus, Minus, Pause, Play, Settings, RotateCcw, Wind, Eye, Globe, Clock, Cloud } from 'lucide-react';
import type { FlightPlanData } from './FlightPlanWizard';

interface MapPanelProps {
  flightPlan: FlightPlanData;
}

interface WeatherData {
  temp: string;
  wind: string;
  visibility: string;
  condition: string;
  pressure: string;
  utcOffset: string;
  lastUpdated: string;
}

interface WaypointDetails {
  code: string;
  name: string;
  type: string;
  frequencies?: string[];
  runways?: string[];
  coordinates?: string;
  navaid?: string;
  elevation?: string;
}

interface AircraftState {
  x: number;
  y: number;
  rotation: number;
  progress: number;
}

interface AircraftSettings {
  type: 'jet' | 'prop' | 'heli';
  color: string;
}

const AIRCRAFT_COLORS = [
  { name: 'Branco', value: '#ffffff' },
  { name: 'Ciano', value: '#22d3ee' },
  { name: 'Ouro', value: '#fbbf24' },
  { name: 'Esmeralda', value: '#10b981' },
  { name: 'Rosa', value: '#f472b6' }
];

const MapPanel: React.FC<MapPanelProps> = ({ flightPlan }) => {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR', { hour12: false }));
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isPathHovered, setIsPathHovered] = useState(false);
  const [pathTotalLength, setPathTotalLength] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [waypointDetails, setWaypointDetails] = useState<WaypointDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [aircraft, setAircraft] = useState<AircraftState>({ x: 300, y: 500, rotation: -20, progress: 0 });
  const [isTracking, setIsTracking] = useState(true);
  const [aircraftSettings, setAircraftSettings] = useState<AircraftSettings>({ type: 'jet', color: '#22d3ee' });
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (pathRef.current) {
      setPathTotalLength(pathRef.current.getTotalLength());
    }
  }, [flightPlan]);

  useEffect(() => {
    let animationFrameId: number;

    const updatePosition = () => {
      if (!isTracking || !pathRef.current) return;

      setAircraft(prev => {
        const path = pathRef.current;
        if (!path) return prev;

        const totalLength = path.getTotalLength();
        const nextProgress = (prev.progress + 0.0003) % 1;
        const currentPos = path.getPointAtLength(nextProgress * totalLength);
        
        const lookAheadLength = Math.min(nextProgress * totalLength + 1, totalLength);
        const lookAheadPos = path.getPointAtLength(lookAheadLength);
        const angle = Math.atan2(lookAheadPos.y - currentPos.y, lookAheadPos.x - currentPos.x) * (180 / Math.PI);

        return {
          x: currentPos.x,
          y: currentPos.y,
          rotation: angle,
          progress: nextProgress
        };
      });

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    if (isTracking) {
      animationFrameId = requestAnimationFrame(updatePosition);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isTracking]);

  const fetchWeather = async () => {
    setIsLoadingWeather(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setWeather({
        temp: '22',
        wind: '120 @ 12 kt',
        visibility: '9999',
        pressure: '1013',
        condition: 'Clear',
        utcOffset: 'UTC-3',
        lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour12: false })
      });
    } catch (error) {
      console.error("Erro ao buscar clima:", error);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const renderAircraftIcon = () => {
    const color = aircraftSettings.color;
    
    if (aircraftSettings.type === 'heli') {
      return (
        <path 
          d="M12 2v2h-4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-4V2zM7 14h10l-1 4h-8l-1-4z" 
          fill={color}
          transform="scale(1.2) translate(-12, -10)"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      );
    }

    if (aircraftSettings.type === 'prop') {
      return (
        <path 
          d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" 
          fill={color}
          transform="scale(1.3) translate(-12, -12)"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      );
    }

    return (
      <path 
        d="M2 12h3L8 4h3l-3 8h3v2h-3l3 8H8l-3-8H2v-2z" 
        fill={color}
        transform="scale(1.5) translate(-6, -8)"
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    );
  };

  return (
    <section className="flex-1 relative bg-background-dark overflow-hidden group h-screen">
      {/* Mapa de Fundo */}
      <div className="absolute inset-0 z-0 opacity-80 mix-blend-normal">
        <img 
          alt="Mapa de Voo" 
          className="w-full h-full object-cover filter brightness-[0.4] saturate-[0.2] contrast-[1.2]" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBFNvBoW2DYNhjHZ7iD4MqM-5DKijCpR47jfEvDb5w6_-Wkn7X2wVwXtaDNYgnFt-VTlal7NiEBe7Xsmghinib57FkVJKro22-5ilwwXE443CqEEWwFRN7nzJoUk4uH_SGgRijaU4_EJp464Nv3dsMxiyFnBHtBCAY02Ah5ioo_i0Xl0qNrQC8dAukgJZj7zaFcCu7ReoLPEFik6l5Rn3clYHvzz4KbYpKl3WSSWRcXc2l8xK2Ec51zG1CpyAdvx5BQpL7St_MlxCGH"
        />
      </div>

      {/* Controles do Mapa (Topo Direito) */}
      <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
        <div className="bg-surface-dark/90 backdrop-blur-md border border-border-dark rounded-lg overflow-hidden shadow-lg flex flex-col">
          <button className="p-2 text-white hover:bg-white/10 transition-colors border-b border-border-dark" title="Ampliar">
            <Plus className="w-4 h-4" />
          </button>
          <button className="p-2 text-white hover:bg-white/10 transition-colors" title="Reduzir">
            <Minus className="w-4 h-4" />
          </button>
        </div>
        
        <button 
          onClick={() => setIsTracking(!isTracking)}
          className={`p-2 bg-surface-dark/90 backdrop-blur-md border rounded-lg transition-colors shadow-lg ${isTracking ? 'text-primary bg-primary/10 border-primary/50' : 'text-white hover:bg-white/10 border-border-dark'}`} 
          title={isTracking ? "Pausar Rastreamento" : "Iniciar Rastreamento"}
        >
          {isTracking ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 bg-surface-dark/90 backdrop-blur-md border rounded-lg transition-colors shadow-lg ${showSettings ? 'text-primary bg-primary/10 border-primary/50' : 'text-white hover:bg-white/10 border-border-dark'}`} 
          title="Configurações da Aeronave"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button 
          onClick={fetchWeather}
          className={`p-2 bg-surface-dark/90 backdrop-blur-md border border-border-dark rounded-lg text-white hover:bg-white/10 transition-colors shadow-lg ${isLoadingWeather ? 'animate-spin' : ''}`} 
          title="Atualizar Clima"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Menu de Customização da Aeronave */}
      {showSettings && (
        <div className="absolute top-6 right-20 z-20 w-64 animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="bg-surface-dark/90 backdrop-blur-xl border border-border-dark rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary font-display">Aeronave</h3>
              <button onClick={() => setShowSettings(false)} className="text-text-secondary hover:text-white transition-colors">
                <span className="text-sm">✕</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-text-secondary uppercase mb-2 block font-bold">Tipo de Ícone</label>
                <div className="flex gap-2">
                  {(['jet', 'prop', 'heli'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setAircraftSettings({ ...aircraftSettings, type })}
                      className={`flex-1 h-10 rounded-lg flex items-center justify-center border transition-all ${
                        aircraftSettings.type === type 
                          ? 'border-primary bg-primary/10 text-primary' 
                          : 'border-border-dark hover:border-gray-500 text-text-secondary'
                      }`}
                    >
                      <span className="text-lg">
                        {type === 'jet' ? '✈' : type === 'prop' ? '🛩' : '🚁'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-text-secondary uppercase mb-2 block font-bold">Cor da Rota</label>
                <div className="grid grid-cols-5 gap-2">
                  {AIRCRAFT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setAircraftSettings({ ...aircraftSettings, color: c.value })}
                      title={c.name}
                      className={`h-8 w-8 rounded-full border-2 transition-all hover:scale-110 active:scale-90 ${
                        aircraftSettings.color === c.value ? 'border-white ring-2 ring-primary/40 shadow-lg' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up de Informações do Waypoint */}
      {selectedWaypoint && (
        <div className="absolute top-6 right-20 z-20 w-80 animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="bg-surface-dark/80 backdrop-blur-2xl border border-primary/30 rounded-2xl p-5 shadow-2xl relative">
            <button 
              onClick={() => setSelectedWaypoint(null)}
              className="absolute top-4 right-4 text-text-secondary hover:text-white transition-colors"
            >
              <span className="text-base">✕</span>
            </button>

            {isLoadingDetails ? (
              <div className="py-12 flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-text-secondary font-mono animate-pulse uppercase tracking-widest">Escaneando Navaid...</p>
              </div>
            ) : waypointDetails ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-mono font-bold text-white leading-none">{waypointDetails.code}</span>
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-bold uppercase tracking-wider">{waypointDetails.type}</span>
                  </div>
                  <h4 className="text-sm font-medium text-text-secondary line-clamp-1">{waypointDetails.name}</h4>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-border-dark/50 py-3">
                  <div>
                    <div className="text-[10px] text-text-secondary uppercase mb-1">Elevação</div>
                    <div className="text-xs font-mono font-bold text-white">{waypointDetails.elevation || "--"}</div>
                    <div className="text-[10px] font-mono text-text-secondary truncate mt-0.5">{waypointDetails.coordinates || "--"}</div>
                  </div>
                  {waypointDetails.navaid && (
                    <div>
                      <div className="text-[10px] text-text-secondary uppercase mb-1">Navaid</div>
                      <div className="text-xs font-mono font-bold text-primary">{waypointDetails.navaid}</div>
                    </div>
                  )}
                </div>

                {waypointDetails.runways && waypointDetails.runways.length > 0 && (
                  <div>
                    <div className="text-[10px] text-text-secondary uppercase mb-2">Pistas</div>
                    <div className="space-y-1">
                      {waypointDetails.runways.map((rw, i) => (
                        <div key={i} className="text-xs font-mono flex items-center gap-2 text-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                          {rw}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {waypointDetails.frequencies && waypointDetails.frequencies.length > 0 && (
                  <div>
                    <div className="text-[10px] text-text-secondary uppercase mb-2">Frequências</div>
                    <div className="flex flex-wrap gap-2">
                      {waypointDetails.frequencies.map((freq, i) => (
                        <span key={i} className="text-[10px] font-mono bg-border-dark text-white px-2 py-1 rounded border border-white/5">
                          {freq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-text-secondary text-xs italic">
                Informações não disponíveis para {selectedWaypoint}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Painel de Inteligência de Voo */}
      <div className="absolute top-6 left-6 z-10 w-64 pointer-events-none">
        <div className="bg-surface-dark/40 backdrop-blur-xl border border-border-dark/50 rounded-2xl p-4 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary font-display">Flight Intel</h3>
              {isTracking && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
              )}
            </div>
            <span className={`w-2 h-2 rounded-full ${isLoadingWeather ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></span>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[10px] text-text-secondary uppercase mb-0.5">Aeronave</div>
                <div className="text-sm font-bold flex items-center gap-1 font-mono">
                  {flightPlan.aircraftRegistration || "---"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-text-secondary uppercase mb-0.5">Progresso</div>
                <div className="text-sm font-bold font-mono text-primary">{Math.round(aircraft.progress * 100)}%</div>
              </div>
            </div>

            <div className="w-full bg-border-dark h-1 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${aircraft.progress * 100}%`, backgroundColor: aircraftSettings.color }}></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-text-secondary uppercase mb-0.5">Temp Ext.</div>
                <div className="text-lg font-mono font-bold">{weather?.temp || "--"}°C</div>
              </div>
              <div>
                <div className="text-[10px] text-text-secondary uppercase mb-0.5">Pressão</div>
                <div className="text-sm font-mono font-bold">{weather?.pressure || "--"}</div>
              </div>
            </div>

            <div className="border-t border-border-dark pt-3">
              <div className="flex items-center gap-2 text-xs text-text-secondary mb-1">
                <Wind className="w-3 h-3" />
                <span>{weather?.wind || "Aguardando..."}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Eye className="w-3 h-3" />
                <span className="font-mono">Vis: {weather?.visibility || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Informações de Tempo e Clima (Inferior) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-max max-w-[90vw]">
        <div className="bg-surface-dark/80 backdrop-blur-md border border-border-dark rounded-full px-6 py-2 flex items-center gap-4 sm:gap-6 shadow-xl whitespace-nowrap overflow-x-auto">
          <div className="flex items-center gap-2">
            <Cloud className="text-yellow-400 w-4 h-4" />
            <span className="text-xs font-mono text-white">
              {weather ? `Vento: ${weather.wind}` : 'Calculando Vento...'}
            </span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-border-dark"></div>
          <div className="flex items-center gap-2">
            <Eye className="text-blue-400 w-4 h-4" />
            <span className="text-xs font-mono text-white">Vis: {weather?.visibility || "N/A"}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-border-dark"></div>
          <div className="flex items-center gap-2">
            <Globe className="text-primary w-4 h-4" />
            <span className="text-xs font-mono text-white">UTC: {weather?.utcOffset || "UTC-?"}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-border-dark"></div>
          <div className="flex items-center gap-2">
            <Clock className="text-text-secondary w-4 h-4" />
            <span className="text-xs font-mono text-white">{currentTime}</span>
          </div>
        </div>
      </div>

      {/* SVG da Rota e Aeronave */}
      <svg className="absolute inset-0 z-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="routeGradient" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" style={{ stopColor: aircraftSettings.color, stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: aircraftSettings.color, stopOpacity: 0.3 }} />
          </linearGradient>
          <filter id="glow" height="140%" width="140%" x="-20%" y="-20%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Caminho estático (Rota "fantasma") */}
        <path 
          d="M 300 500 Q 550 450 800 300" 
          fill="none" 
          stroke="#232f48" 
          strokeWidth="2" 
          strokeDasharray="4 4"
        />

        {/* Caminho tracejado fluindo (Energia da rota "ativa") */}
        <path 
          ref={pathRef}
          className="animate-route-dash transition-all duration-500 ease-out" 
          d="M 300 500 Q 550 450 800 300" 
          fill="none" 
          filter={isPathHovered ? "url(#glow)" : "none"} 
          stroke="url(#routeGradient)" 
          strokeDasharray="12 12" 
          strokeWidth={isPathHovered ? "5" : "3"} 
          opacity={isPathHovered ? "1" : "0.6"}
        />

        {/* Caminho de Progresso (Porção já percorrida) */}
        <path 
          d="M 300 500 Q 550 450 800 300" 
          fill="none" 
          stroke={aircraftSettings.color} 
          strokeWidth={isPathHovered ? "5" : "3"} 
          strokeDasharray={pathTotalLength}
          strokeDashoffset={pathTotalLength * (1 - aircraft.progress)}
          className="transition-all duration-300 ease-linear"
          opacity={isPathHovered ? "1" : "0.8"}
        />

        {/* Gatilho de Hover Invisível */}
        <path 
          d="M 300 500 Q 550 450 800 300" 
          fill="none" 
          stroke="transparent" 
          strokeWidth="24"
          className="pointer-events-auto cursor-pointer"
          onMouseEnter={() => setIsPathHovered(true)}
          onMouseLeave={() => setIsPathHovered(false)}
        />

        {/* Marcador de Origem */}
        <g 
          transform="translate(300, 500)" 
          className="cursor-pointer pointer-events-auto hover:brightness-125 transition-all"
          onClick={() => setSelectedWaypoint(flightPlan.departureAirport)}
        >
          <circle r="6" fill={aircraftSettings.color} stroke="white" strokeWidth="2" />
          <circle r="12" fill={aircraftSettings.color} opacity="0.1" className="animate-ping" />
          <rect x="-30" y="-45" width="60" height="24" rx="4" fill="#192233" stroke="#232f48" />
          <text x="0" y="-29" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Space Grotesk">
            {flightPlan.departureAirport || 'ORIG'}
          </text>
        </g>

        {/* Marcador de Destino */}
        <g 
          transform="translate(800, 300)" 
          className="cursor-pointer pointer-events-auto hover:brightness-125 transition-all"
          onClick={() => setSelectedWaypoint(flightPlan.destinationAirport)}
        >
          <circle r="6" fill="#ef4444" stroke="white" strokeWidth="2" />
          <rect x="-30" y="15" width="60" height="24" rx="4" fill="#192233" stroke="#232f48" />
          <text x="0" y="31" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Space Grotesk">
            {flightPlan.destinationAirport || 'DEST'}
          </text>
        </g>

        {/* Ícone da Aeronave Animada ao Longo da Rota */}
        <g transform={`translate(${aircraft.x}, ${aircraft.y}) rotate(${aircraft.rotation})`}>
          {renderAircraftIcon()}
          {/* Efeito de esteira sutil */}
          <circle r="2" fill={aircraftSettings.color} opacity="0.4" transform="translate(-15, 0)">
            <animate attributeName="opacity" values="0.4;0" dur="1s" repeatCount="indefinite" />
            <animate attributeName="r" values="2;8" dur="1s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </section>
  );
};

export { MapPanel };
