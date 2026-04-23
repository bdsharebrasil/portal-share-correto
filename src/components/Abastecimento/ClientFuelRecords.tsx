import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, Building2, Plane } from "lucide-react";
import { FuelRecordsByAircraft } from "./FuelRecordsByAircraft";

interface Client {
  id: string;
  razao_social: string;
  cotistas_aeronave?: Array<{
    id_aeronave: string;
    percentual_sociedade: number;
  }>;
}

interface Aircraft {
  id: string;
  matricula: string;
  ano: number | null;
  modelo?: string;
}

interface ClientFuelRecordsProps {
  selectedAbastecimentoId?: string | null;
}

export function ClientFuelRecords({ selectedAbastecimentoId }: ClientFuelRecordsProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const [selectedAeronave, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [pendingAbastecimento, setPendingAbastecimento] = useState<{
    clientId?: string;
    aircraftId?: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = clients.filter(client => client.razao_social.toLowerCase().includes(searchTerm.toLowerCase()));

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadClientAircrafts();
    }
  }, [selectedClient]);

  // Buscar dados do abastecimento selecionado
  useEffect(() => {
    if (selectedAbastecimentoId && clients.length > 0) {
      loadAbastecimentoData();
    }
  }, [selectedAbastecimentoId, clients.length > 0]);

  // Selecionar cliente e aeronave quando dados forem carregados
  useEffect(() => {
    if (pendingAbastecimento?.clientId && clients.length > 0) {
      const clientToSelect = clients.find(c => c.id === pendingAbastecimento.clientId);
      if (clientToSelect) {
        setSelectedClient(clientToSelect);
      } else {
        toast.error('Cliente do abastecimento não encontrado');
        setPendingAbastecimento(null);
      }
    }
  }, [pendingAbastecimento?.clientId, clients.length > 0]);

  // Selecionar aeronave quando aircrafts forem carregados
  useEffect(() => {
    if (pendingAbastecimento?.aircraftId && aircrafts.length > 0) {
      const aircraftToSelect = aircrafts.find(a => a.id === pendingAbastecimento.aircraftId);
      if (aircraftToSelect) {
        setSelectedAircraft(aircraftToSelect);
        setPendingAbastecimento(null);
      } else {
        toast.error('Aeronave do abastecimento não encontrada');
        setPendingAbastecimento(null);
      }
    }
  }, [pendingAbastecimento?.aircraftId, aircrafts.length > 0]);

  const loadAbastecimentoData = async () => {
    try {
      const { data: abastecimento, error } = await supabase
        .from('abastecimentos')
        .select('id_clientes, aeronave_id')
        .eq('id', selectedAbastecimentoId)
        .single();

      if (error || !abastecimento) {
        toast.error('Abastecimento não encontrado');
        return;
      }

      // Armazenar os IDs para selecionar depois
      setPendingAbastecimento({
        clientId: (abastecimento as any).id_clientes,
        aircraftId: (abastecimento as any).aeronave_id
      });
    } catch (err) {
      console.error('Erro ao carregar abastecimento:', err);
      toast.error('Erro ao carregar abastecimento');
    }
  };

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select(`
        id,
        razao_social,
        cotistas_aeronave (
          id_aeronave,
          percentual_sociedade
        )
      `)
      .order('razao_social', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar clientes');
      return;
    }

    setClients((data || []) as any as Client[]);
  };

  const loadClientAircrafts = async () => {
    if (!selectedClient?.cotistas_aeronave || selectedClient.cotistas_aeronave.length === 0) {
      setAircrafts([]);
      return;
    }

    const aircraftIds = selectedClient.cotistas_aeronave.map(ca => ca.id_aeronave);

    const { data, error } = await supabase
      .from('aeronave')
      .select('id, matricula, modelo, ano')
      .in('id', aircraftIds)
      .order('matricula', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar aeronaves');
      return;
    }

    const mappedAircrafts = (data || []).map(a => ({
      id: a.id,
      matricula: a.matricula,
      modelo: a.modelo,
      ano: a.ano ? parseInt(a.ano) : null,
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
    if (selectedAeronave) {
      setSelectedAircraft(null);
    } else if (selectedClient) {
      setSelectedClient(null);
      setAircrafts([]);
    }
  };

  if (selectedAeronave && selectedClient) {
    return (
      <FuelRecordsByAircraft
        client={selectedClient}
        aircraft={selectedAeronave}
        onBack={handleBack}
        selectedAbastecimentoId={selectedAbastecimentoId}
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
            <p className="text-sm text-muted-foreground mt-1">{filteredClients.length} cliente(s) disponível(is)</p>
          </div>

          <div className="mb-4">
            <Input
              placeholder="Buscar cliente por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {filteredClients.length === 0 ? (
            <Card className="border border-border/50">
              <CardContent className="py-16 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="font-medium text-foreground">{searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</p>
                <p className="text-sm text-muted-foreground mt-1">{searchTerm ? "Tente outro termo de busca" : "Crie um cliente primeiro para começar"}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map((client) => (
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
                            {client.razao_social}
                          </p>
                        </div>
                        {client.cotistas_aeronave && client.cotistas_aeronave.length > 0 && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                            <Plane className="h-3.5 w-3.5" />
                            {client.cotistas_aeronave.length} aeronave{client.cotistas_aeronave.length > 1 ? 's' : ''}
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
              <p className="text-sm text-muted-foreground mt-0.5">{selectedClient.razao_social}</p>
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
                            {aircraft.matricula}
                          </p>
                        </div>
                        {aircraft.modelo && (
                          <p className="text-sm text-muted-foreground">{aircraft.modelo}</p>
                        )}
                        {aircraft.ano && (
                          <p className="text-xs text-muted-foreground mt-1">Ano: {aircraft.ano}</p>
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
