import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { FlightPlanWizard } from "@/components/plano-voo/FlightPlanWizard";
import { ConfirmedFlightsPrompt } from "@/components/plano-voo/ConfirmedFlightsPrompt";
import { fetchFlightSchedulesWithDetails, type FlightScheduleWithDetails } from "@/services/flightSchedules";
import { Loader2 } from "lucide-react";
export default function PlanoVooProfissional() {
  const [loading, setLoading] = useState(true);
  const [confirmedFlights, setConfirmedFlights] = useState<FlightScheduleWithDetails[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightScheduleWithDetails | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);
  useEffect(() => {
    fetchConfirmedFlights();
  }, []);
  const fetchConfirmedFlights = async () => {
    try {
      const data = await fetchFlightSchedulesWithDetails({
        status: "confirmado",
        includeFlightPlans: false
      });
      // Filter flights without flight plans
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
  const handleBack = () => {
    setShowWizard(false);
    setSelectedFlight(null);
  };
  if (loading) {
    return <Layout>
        <div className="min-h-screen bg-[#0f121a] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-cyan-400 animate-spin" />
            <p className="text-cyan-400 font-medium">Carregando sistema de plano de voo...</p>
          </div>
        </div>
      </Layout>;
  }
  return <Layout>
      <div className="min-h-screen bg-[#0f121a]">
        {!showWizard && !promptDismissed && confirmedFlights.length > 0 ? <ConfirmedFlightsPrompt flights={confirmedFlights} onSelectFlight={handleSelectFlight} onCreateNew={handleCreateNew} /> : <FlightPlanWizard selectedFlight={selectedFlight} onBack={handleBack} />}
      </div>
    </Layout>;
}
