import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { FlightPlanWizard } from "./FlightPlanWizard";
import { fetchFlightSchedulesWithDetails, type FlightScheduleWithDetails } from "@/services/flightSchedules";
import { Loader2 } from "lucide-react";

export function PlanoVooForm() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedFlight, setSelectedFlight] = useState<FlightScheduleWithDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlight = async () => {
      try {
        if (!scheduleId) {
          setError("ID de agendamento não fornecido");
          setLoading(false);
          return;
        }

        const data = await fetchFlightSchedulesWithDetails({});
        const flight = data.find(f => f.id === scheduleId);
        
        if (!flight) {
          setError("Agendamento não encontrado");
        } else {
          setSelectedFlight(flight);
        }
      } catch (error) {
        console.error("Error fetching flight schedule:", error);
        setError("Erro ao carregar agendamento");
      } finally {
        setLoading(false);
      }
    };

    fetchFlight();
  }, [scheduleId]);

  const handleBack = () => {
    navigate("/plano-voo");
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#0f121a] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-cyan-400 animate-spin" />
            <p className="text-cyan-400 font-medium">Carregando agendamento...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="min-h-screen bg-[#0f121a] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-red-400 font-medium">{error}</p>
            <button
              onClick={handleBack}
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              Voltar para Plano de Voo
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#0f121a]">
        <FlightPlanWizard selectedFlight={selectedFlight} onBack={handleBack} />
      </div>
    </Layout>
  );
}
