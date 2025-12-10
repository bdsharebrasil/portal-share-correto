import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, Building2, Plane, Search, X } from "lucide-react";
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

interface FuelSupplier {
  id: string;
  supplier_name: string;
  city_name: string;
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
    <div className="space-y-6">
      {!selectedClient ? (
        <>
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Selecione um Cliente
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{clients.length} cliente(s) disponível(is)</p>
          </div>

          {clients.length === 0 ? (
            <Card className="border border-border/50">
              <CardContent className="py-16 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium text-foreground">Nenhum cliente cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">Crie um cliente primeiro para começar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => (
                <Card
                  key={client.id}
                  className="cursor-pointer border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                  onClick={() => handleClientClick(client)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <p className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors">
                            {client.company_name}
                          </p>
                        </div>
                        {client.client_aircraft && client.client_aircraft.length > 0 && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                            <Plane className="h-3.5 w-3.5" />
                            {client.client_aircraft.length} aeronave{client.client_aircraft.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Plane className="h-6 w-6 text-primary" />
                Aeronaves
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">{selectedClient.company_name}</p>
            </div>
          </div>

          {aircrafts.length === 0 ? (
            <Card className="border border-border/50">
              <CardContent className="py-16 text-center">
                <Plane className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium text-foreground">Nenhuma aeronave cadastrada</p>
                <p className="text-sm text-muted-foreground mt-1">Este cliente não possui aeronaves vinculadas</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aircrafts.map((aircraft) => (
                <Card
                  key={aircraft.id}
                  className="cursor-pointer border border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-200 group"
                  onClick={() => handleAircraftClick(aircraft)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <Plane className="h-4 w-4 text-primary" />
                          <p className="font-bold text-foreground text-lg group-hover:text-primary transition-colors font-mono">
                            {aircraft.registration}
                          </p>
                        </div>
                        {aircraft.model && (
                          <p className="text-sm text-muted-foreground">{aircraft.model}</p>
                        )}
                        {aircraft.year && (
                          <p className="text-xs text-muted-foreground mt-1">Ano: {aircraft.year}</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
