import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { FuelRecordsByAircraft } from "./FuelRecordsByAircraft";

interface Client {
  id: string;
  company_name: string;
  client_aircraft?: Array<{
    aircraft_id: string;
    share_percentage: number;
  }>;
}

interface Aircraft {
  id: string;
  registration: string;
  year: number | null;
  model?: string;
}

export function ClientFuelRecords() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadClientAircrafts();
    }
  }, [selectedClient]);

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id, 
        company_name,
        client_aircraft (
          aircraft_id,
          share_percentage
        )
      `)
      .order('company_name', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar clientes');
      return;
    }

    setClients(data || []);
  };

  const loadClientAircrafts = async () => {
    if (!selectedClient?.client_aircraft || selectedClient.client_aircraft.length === 0) {
      setAircrafts([]);
      return;
    }

    const aircraftIds = selectedClient.client_aircraft.map(ca => ca.aircraft_id);

    const { data, error } = await supabase
      .from('aircraft')
      .select('id, registration, model, year')
      .in('id', aircraftIds)
      .order('registration', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar aeronaves');
      return;
    }

    const mappedAircrafts = (data || []).map(a => ({
      id: a.id,
      registration: a.registration,
      model: a.model,
      year: a.year ? parseInt(a.year) : null,
    }));

    setAircrafts(mappedAircrafts);
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setSelectedAircraft(null);
  };

  const handleAircraftClick = (aircraft: Aircraft) => {
    setSelectedAircraft(aircraft);
  };

  const handleBack = () => {
    if (selectedAircraft) {
      setSelectedAircraft(null);
    } else if (selectedClient) {
      setSelectedClient(null);
      setAircrafts([]);
    }
  };

  if (selectedAircraft && selectedClient) {
    return (
      <FuelRecordsByAircraft
        client={selectedClient}
        aircraft={selectedAircraft}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="space-y-4">
      {selectedClient && (
        <Button variant="outline" onClick={handleBack}>
          Voltar
        </Button>
      )}

      {!selectedClient ? (
        <Card>
          <CardHeader>
            <CardTitle>Selecione um Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {clients.map((client) => (
                <Card
                  key={client.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleClientClick(client)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{client.company_name}</p>
                        {client.client_aircraft && client.client_aircraft.length > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {client.client_aircraft.length} aeronave(s)
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {clients.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum cliente cadastrado
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Aeronaves de {selectedClient.company_name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aircrafts.map((aircraft) => (
                <Card
                  key={aircraft.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleAircraftClick(aircraft)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-lg">{aircraft.registration}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {aircrafts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma aeronave cadastrada para este cliente
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
