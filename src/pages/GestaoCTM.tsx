import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plane, ChevronDown, ChevronRight } from "lucide-react";
import { CTMAircraftDetail } from "@/components/ctm/CTMAircraftDetail";

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status?: string | null;
}

export default function GestaoCTM() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadAircraft();
  }, []);

  const loadAircraft = async () => {
    try {
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, model, status")
        .order("registration");

      if (error) throw error;
      setAircraft(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar aeronaves: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAircraft = (aircraftId: string) => {
    setSelectedAircraft(aircraftId);
  };

  const handleBack = () => {
    setSelectedAircraft("");
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </Layout>
    );
  }

  // If aircraft is selected, show the detail view
  if (selectedAircraft) {
    const selectedAircraftData = aircraft.find(ac => ac.id === selectedAircraft);
    if (!selectedAircraftData) return null;

    return (
      <Layout>
        <div className="p-6">
          <CTMAircraftDetail aircraft={selectedAircraftData} onBack={handleBack} />
        </div>
      </Layout>
    );
  }

  // Otherwise, show the aircraft selection view
  const normalizeStatus = (s: string | null | undefined) => (s ?? "").toString().trim().toLowerCase();
  const isActiveStatus = (s: string | null | undefined) => ["ativo", "ativa", "active"].includes(normalizeStatus(s));
  const isInactiveStatus = (s: string | null | undefined) => ["inativo", "inativa", "inactive"].includes(normalizeStatus(s));
  const activeAircraft = aircraft.filter((a) => isActiveStatus(a.status));
  const inactiveAircraft = aircraft.filter((a) => isInactiveStatus(a.status));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gestão CTM - Controle Técnico de Manutenção
          </h1>
          <p className="text-muted-foreground">
            Selecione uma aeronave para visualizar e gerenciar o controle técnico de manutenção
          </p>
        </div>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              Aeronaves Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {activeAircraft.map((ac) => (
                <Button
                  key={ac.id}
                  variant="outline"
                  onClick={() => handleSelectAircraft(ac.id)}
                  className="uppercase"
                >
                  {ac.registration} - {ac.model}
                </Button>
              ))}
              {activeAircraft.length === 0 && (
                <span className="text-muted-foreground">Nenhuma aeronave ativa.</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {showInactive ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              Aeronaves Inativas
              <span className="text-sm text-muted-foreground">({inactiveAircraft.length})</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowInactive((s) => !s)}>
              {showInactive ? "Ocultar" : "Mostrar"}
            </Button>
          </CardHeader>
          {showInactive && (
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {inactiveAircraft.map((ac) => (
                  <Button
                    key={ac.id}
                    variant="outline"
                    onClick={() => handleSelectAircraft(ac.id)}
                    className="uppercase"
                  >
                    {ac.registration} - {ac.model}
                  </Button>
                ))}
                {inactiveAircraft.length === 0 && (
                  <span className="text-muted-foreground">Nenhuma aeronave inativa.</span>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </Layout>
  );
}
