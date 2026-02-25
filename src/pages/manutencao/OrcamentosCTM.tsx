import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { CTMBudgetManagement } from "@/components/manutencao/CTMBudgetManagement";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Aircraft {
  id: string;
  registration: string;
  model: string;
}

export default function OrcamentosCTM() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);

  const aircraftId = searchParams.get("aircraftId");

  useEffect(() => {
    if (!aircraftId) {
      toast.error("ID da aeronave não encontrado");
      navigate("/manutencao/ctm");
      return;
    }

    loadAircraft();
  }, [aircraftId]);

  const loadAircraft = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, model")
        .eq("id", aircraftId)
        .single();

      if (error) throw error;
      setAircraft(data);
    } catch (error: any) {
      console.error("Error loading aircraft:", error);
      toast.error("Erro ao carregar aeronave");
      navigate("/manutencao/ctm");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!aircraft || !aircraftId) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[600px]">
          <p className="text-muted-foreground mb-4">Aeronave não encontrada</p>
          <Button onClick={() => navigate("/manutencao/ctm")}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/manutencao/ctm")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Orçamentos para Manutenção</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestão de orçamentos para {aircraft.registration} ({aircraft.model})
              </p>
            </div>
          </div>
        </div>

        {/* Budget Management Component */}
        <Card className="bg-gradient-card border-border p-6">
          <CTMBudgetManagement
            aircraftId={aircraftId}
            aircraftRegistration={aircraft.registration}
          />
        </Card>
      </div>
    </Layout>
  );
}
