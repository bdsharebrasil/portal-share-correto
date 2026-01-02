import React, { useState, useCallback } from 'react';
import { FlightPlanFormPanel, type RouteMethod } from './FlightPlanFormPanel';
import { SkyVectorMap } from './SkyVectorMap';
import { useFlightPlanCalcs, type Waypoint, defaultPerformance } from '@/hooks/useFlightPlanCalcs';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface SkyVectorPageProps {
  initialWaypoints?: Waypoint[];
}

export const SkyVectorPage: React.FC<SkyVectorPageProps> = ({ initialWaypoints = [] }) => {
  const navigate = useNavigate();
  
  // State do plano de voo
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialWaypoints);
  const [selectedAircraft, setSelectedAircraft] = useState<string>('');
  const [cruiseSpeed, setCruiseSpeed] = useState<number>(150);
  const [altitude, setAltitude] = useState<number>(8000);
  const [fuelOnBoard, setFuelOnBoard] = useState<number>(200);
  const [routeMethod, setRouteMethod] = useState<RouteMethod>('direct');

  // Cálculos de navegação
  const calcs = useFlightPlanCalcs(waypoints, {
    cruiseSpeedKnots: cruiseSpeed,
    fuelBurnLitersPerHour: 50,
  });

  // Handlers
  const handleSavePlan = useCallback(() => {
    if (waypoints.length < 2) {
      toast.error('Adicione ao menos origem e destino');
      return;
    }

    const plan = {
      id: Date.now().toString(),
      waypoints,
      aircraft: selectedAircraft,
      cruiseSpeed,
      altitude,
      fuelOnBoard,
      routeMethod,
      createdAt: new Date().toISOString(),
    };

    const saved = JSON.parse(localStorage.getItem('flightPlans') || '[]');
    saved.unshift(plan);
    localStorage.setItem('flightPlans', JSON.stringify(saved.slice(0, 20)));
    
    toast.success('Plano de voo salvo!');
  }, [waypoints, selectedAircraft, cruiseSpeed, altitude, fuelOnBoard, routeMethod]);

  const handleLoadPlan = useCallback(() => {
    const saved = JSON.parse(localStorage.getItem('flightPlans') || '[]');
    if (saved.length === 0) {
      toast.info('Nenhum plano salvo');
      return;
    }
    
    const plan = saved[0];
    setWaypoints(plan.waypoints || []);
    setSelectedAircraft(plan.aircraft || '');
    setCruiseSpeed(plan.cruiseSpeed || 150);
    setAltitude(plan.altitude || 8000);
    setFuelOnBoard(plan.fuelOnBoard || 200);
    setRouteMethod(plan.routeMethod || 'direct');
    
    toast.success('Plano carregado!');
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    console.log('Map clicked:', lat, lng);
  }, []);

  return (
    <div className="h-screen w-screen bg-background-dark flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-12 bg-surface-dark/90 border-b border-border-dark flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-text-secondary hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-display font-bold text-white">
            SkyVector <span className="text-primary">Flight Planner</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="font-mono">{new Date().toLocaleTimeString('pt-BR', { hour12: false })}</span>
          <span>UTC-3</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Form */}
        <FlightPlanFormPanel
          waypoints={waypoints}
          setWaypoints={setWaypoints}
          selectedAircraft={selectedAircraft}
          setSelectedAircraft={setSelectedAircraft}
          cruiseSpeed={cruiseSpeed}
          setCruiseSpeed={setCruiseSpeed}
          altitude={altitude}
          setAltitude={setAltitude}
          fuelOnBoard={fuelOnBoard}
          setFuelOnBoard={setFuelOnBoard}
          routeMethod={routeMethod}
          setRouteMethod={setRouteMethod}
          calcs={calcs}
          onSavePlan={handleSavePlan}
          onLoadPlan={handleLoadPlan}
        />

        {/* Right Panel - Map with Leaflet */}
        <div className="flex-1 relative">
          <SkyVectorMap
            waypoints={waypoints}
            legs={calcs.legs}
            onMapClick={handleMapClick}
          />
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="h-8 bg-surface-dark/90 border-t border-border-dark flex items-center justify-between px-4 text-xs text-text-secondary shrink-0">
        <div className="flex items-center gap-4">
          <span>Route: <span className="text-white font-mono uppercase">{routeMethod}</span></span>
          {waypoints.length >= 2 && (
            <>
              <span>|</span>
              <span className="font-mono text-primary">
                {waypoints[0]?.icao} → {waypoints[waypoints.length - 1]?.icao}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>Dist: <span className="text-white font-mono">{calcs.totalDistanceNM.toFixed(1)} NM</span></span>
          <span>|</span>
          <span>ETE: <span className="text-white font-mono">{Math.floor(calcs.estimatedTimeMinutes / 60)}h{Math.round(calcs.estimatedTimeMinutes % 60)}m</span></span>
          <span>|</span>
          <span>Fuel: <span className="text-white font-mono">{calcs.fuelBurnLiters.toFixed(0)} L</span></span>
        </div>
      </div>
    </div>
  );
};

export default SkyVectorPage;
