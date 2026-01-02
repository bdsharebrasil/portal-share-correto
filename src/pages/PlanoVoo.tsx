import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { FlightPlanWizard } from "@/components/plano-voo/FlightPlanWizard";
import { SkyVectorMap } from "@/components/plano-voo/SkyVectorMap";
import { ConfirmedFlightsPrompt } from "@/components/plano-voo/ConfirmedFlightsPrompt";
import { fetchFlightSchedulesWithDetails, type FlightScheduleWithDetails } from "@/services/flightSchedules";
import { getAirportCoordinates } from "@/services/airports";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import type { FlightPlanData } from "@/components/plano-voo/FlightPlanWizard";
import type { Waypoint, LegInfo } from "@/hooks/useFlightPlanCalcs";

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to calculate bearing between two points
function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const lat1Rad = lat1 * (Math.PI / 180);
  const lat2Rad = lat2 * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

export default function PlanoVooProfissional() {
  const [loading, setLoading] = useState(true);
  const [confirmedFlights, setConfirmedFlights] = useState<FlightScheduleWithDetails[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightScheduleWithDetails | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [completedFlightPlan, setCompletedFlightPlan] = useState<FlightPlanData | null>(null);
  const [mapWaypoints, setMapWaypoints] = useState<Waypoint[]>([]);
  const [mapLegs, setMapLegs] = useState<LegInfo[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [returningFromMap, setReturningFromMap] = useState(false);

  useEffect(() => {
    fetchConfirmedFlights();
  }, []);

  const fetchConfirmedFlights = async () => {
    try {
      const data = await fetchFlightSchedulesWithDetails({
        status: "confirmado",
        includeFlightPlans: false
      });
      const flightsWithoutPlans = data.filter(f => !f.flight_plans || f.flight_plans.length === 0);
      setConfirmedFlights(flightsWithoutPlans);
    } catch (error) {
      console.error("Error fetching confirmed flights:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFlight = (flight: FlightScheduleWithDetails) => {
    setSelectedFlight(flight);
    setShowWizard(true);
  };

  const handleCreateNew = () => {
    setSelectedFlight(null);
    setShowWizard(true);
    setPromptDismissed(true);
  };

  const handleStep1Complete = async (flightPlan: FlightPlanData) => {
    // Only show map if we're not returning from the map view
    if (returningFromMap) {
      // If we're returning from map, just reset the flag and continue in wizard
      setReturningFromMap(false);
      return;
    }

    setCompletedFlightPlan(flightPlan);
    setShowWizard(false);
    setShowMapPanel(true);
    setMapLoading(true);

    try {
      // Get departure airport coordinates
      const departureInfo = flightPlan.departureAirport
        ? await getAirportCoordinates(flightPlan.departureAirport)
        : null;
      const destinationInfo = flightPlan.destinationAirport
        ? await getAirportCoordinates(flightPlan.destinationAirport)
        : null;

      // Create waypoints array
      const waypoints: Waypoint[] = [];

      if (departureInfo) {
        const altitudeStr = flightPlan.cruiseAltitude || 'A085';
        const altitudeNum = parseInt(altitudeStr.replace(/[^0-9]/g, '')) || 8500;
        waypoints.push({
          icao: departureInfo.icao,
          name: departureInfo.name,
          lat: departureInfo.lat,
          lng: departureInfo.lng,
          type: 'departure',
          altitude: altitudeNum,
        });
      }

      if (destinationInfo) {
        const altitudeStr = flightPlan.cruiseAltitude || 'A085';
        const altitudeNum = parseInt(altitudeStr.replace(/[^0-9]/g, '')) || 8500;
        waypoints.push({
          icao: destinationInfo.icao,
          name: destinationInfo.name,
          lat: destinationInfo.lat,
          lng: destinationInfo.lng,
          type: 'arrival',
          altitude: altitudeNum,
        });
      }

      // Calculate legs
      const legs: LegInfo[] = [];
      if (waypoints.length >= 2) {
        for (let i = 0; i < waypoints.length - 1; i++) {
          const from = waypoints[i];
          const to = waypoints[i + 1];
          const distanceNM = calculateDistance(from.lat, from.lng, to.lat, to.lng);
          const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);

          // Calculate estimated time based on cruise speed
          const speedStr = flightPlan.cruiseSpeed || 'N0250';
          const cruiseSpeedKnots = parseInt(speedStr.replace(/[^0-9]/g, '')) || 250;
          const estimatedTimeMinutes = cruiseSpeedKnots > 0 ? (distanceNM / cruiseSpeedKnots) * 60 : 0;

          legs.push({
            from: from.icao,
            to: to.icao,
            distanceNM,
            bearing,
            estimatedTimeMinutes,
          });
        }
      }

      setMapWaypoints(waypoints.length > 0 ? waypoints : []);
      setMapLegs(legs.length > 0 ? legs : []);
    } catch (error) {
      console.error("Error processing flight plan for map:", error);
    } finally {
      setMapLoading(false);
    }
  };

  const handleWizardComplete = async (flightPlan: FlightPlanData) => {
    // For full wizard completion (if needed in future)
    handleStep1Complete(flightPlan);
  };

  const handleBackFromMap = () => {
    setShowMapPanel(false);
    setShowWizard(true);
    setReturningFromMap(true);
    // Keep the completed flight plan so wizard can show the data
  };

  const handleBackFromWizard = () => {
    setShowWizard(false);
    setSelectedFlight(null);
    setPromptDismissed(false);
    setCompletedFlightPlan(null);
    setReturningFromMap(false);
  };

  const handleContinueFromMap = () => {
    setShowMapPanel(false);
    setShowWizard(true);
    setReturningFromMap(true);
    // The wizard will continue from step 2 with the completed form data
  };

  if (loading) {
    return <Layout>
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-primary font-medium">Carregando sistema de plano de voo...</p>
        </div>
      </div>
    </Layout>;
  }

  // Mostrar SkyVectorMap quando o plano de voo estiver completo
  if (showMapPanel && completedFlightPlan) {
    return (
      <Layout>
        <div className="h-[calc(100vh-4rem)] w-full overflow-hidden flex flex-col relative">
          {mapLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <p className="text-primary font-medium">Carregando mapa...</p>
              </div>
            </div>
          )}
          <SkyVectorMap waypoints={mapWaypoints} legs={mapLegs} />

          {/* Navegação - Barra superior com botões */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <button
              onClick={handleBackFromMap}
              className="flex items-center gap-2 px-4 py-2 bg-background/80 hover:bg-background text-foreground rounded-lg transition-colors border border-border/50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Voltar</span>
            </button>
            <button
              onClick={handleContinueFromMap}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium"
            >
              <span className="text-sm">Próximo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return <Layout>
    <div className="min-h-screen bg-background-dark">
      {!showWizard && !promptDismissed && confirmedFlights.length > 0 ? (
        <ConfirmedFlightsPrompt
          flights={confirmedFlights}
          onSelectFlight={handleSelectFlight}
          onCreateNew={handleCreateNew}
        />
      ) : (
        <FlightPlanWizard
          selectedFlight={selectedFlight}
          onBack={handleBackFromWizard}
          onComplete={handleWizardComplete}
          onStep1Complete={handleStep1Complete}
          initialFormData={completedFlightPlan || undefined}
          initialStep={completedFlightPlan ? 2 : 1}
        />
      )}
    </div>
  </Layout>;
}
