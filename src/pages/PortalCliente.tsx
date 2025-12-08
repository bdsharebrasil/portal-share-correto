import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Plane,
  Clock,
  MapPin,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";
import { ClientDataTabs } from "@/components/portal-cliente/ClientDataTabs";

interface ClientAircraft {
  aircraft_id: string;
  share_percentage: number;
  aircraft: {
    id: string;
    registration: string;
    manufacturer: string;
    model: string;
    year: string;
  };
}

interface Client {
  id: string;
  company_name: string;
  client_aircraft?: ClientAircraft[];
}

interface Aircraft {
  id: string;
  registration: string;
  manufacturer: string;
  model: string;
  year: string;
  status: string;
  total_hours?: number;
}

interface FlightActivity {
  total_flights: number;
  total_hours: number;
  total_landings: number;
  recent_destinations: string[];
}

interface PendingItem {
  count: number;
  total_amount: number;
}

interface Document {
  id: string;
  name: string;
  valid_until: string;
  status: string;
  document_url?: string;
}

interface MaintenanceAlert {
  type: string;
  message: string;
  severity: 'warning' | 'error' | 'info';
  date?: string;
}

export default function PortalCliente() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<ClientAircraft | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [flightActivity, setFlightActivity] = useState<FlightActivity>({
    total_flights: 0,
    total_hours: 0,
    total_landings: 0,
    recent_destinations: []
  });
  const [fuelCost, setFuelCost] = useState(1700);
  const [pendingPayments, setPendingPayments] = useState<PendingItem>({ count: 0, total_amount: 0 });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient && !selectedAircraft && selectedClient.client_aircraft && selectedClient.client_aircraft.length > 0) {
      // Auto-select first aircraft when client is selected
      setSelectedAircraft(selectedClient.client_aircraft[0]);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient && selectedAircraft) {
      loadClientData();
    }
  }, [selectedClient, selectedAircraft]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          status,
          client_aircraft (
            aircraft_id,
            share_percentage,
            aircraft:aircraft_id (
              id,
              registration,
              manufacturer,
              model,
              year
            )
          )
        `)
        .eq('status', 'ativo')
        .order('company_name', { ascending: true });

      if (error) throw error;

      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const loadClientData = async () => {
    if (!selectedAircraft?.aircraft_id) return;

    try {
      setLoading(true);

      // Load aircraft details
      const { data: aircraftData } = await supabase
        .from('aircraft')
        .select('*')
        .eq('id', selectedAircraft.aircraft_id)
        .single();

      if (aircraftData) setAircraft(aircraftData);

      // Load flight activity from logbook
      const { data: logbookData } = await supabase
        .from('logbook_entries')
        .select('total_time, pousos, arrival_aerodrome')
        .eq('aircraft_id', selectedAircraft.aircraft_id)
        .order('entry_date', { ascending: false })
        .limit(10);

      if (logbookData) {
        const totalHours = logbookData.reduce((sum, entry) => sum + (entry.total_time || 0), 0);
        const totalLandings = logbookData.reduce((sum, entry) => sum + (entry.pousos || 0), 0);
        const destinations = [...new Set(logbookData.map(e => e.arrival_aerodrome).filter(Boolean))].slice(0, 5);

        setFlightActivity({
          total_flights: logbookData.length,
          total_hours: totalHours,
          total_landings: totalLandings,
          recent_destinations: destinations as string[]
        });
      }

      // Load pending payments
      const { data: paymentsData } = await supabase
        .from('bank_reconciliations')
        .select('amount')
        .eq('client_id', selectedClient.id)
        .eq('status', 'pendente') as any;

      if (paymentsData) {
        setPendingPayments({
          count: paymentsData.length,
          total_amount: paymentsData.reduce((sum, p) => sum + (p.amount || 0), 0)
        });
      }

      // Load aircraft documents (fixed query)
      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5) as any;

      if (docsData) setDocuments(docsData as any);

      // Generate alerts
      const alertsList: MaintenanceAlert[] = [];

      if (docsData) {
        const expiringSoon = docsData.filter((doc: any) => {
          if (!doc.created_at) return false;
          const daysUntilExpiry = Math.floor((new Date(doc.created_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return daysUntilExpiry <= 60 && daysUntilExpiry >= 0;
        });

        if (expiringSoon.length > 0) {
          alertsList.push({
            type: 'Revisão Programada',
            message: `Próxima revisão em ${new Date(expiringSoon[0].created_at).toLocaleDateString('pt-BR')}`,
            severity: 'warning',
            date: expiringSoon[0].created_at
          });
        }
      }

      if (pendingPayments.count > 0) {
        alertsList.push({
          type: 'Pagamentos Pendentes',
          message: `${pendingPayments.count} pagamento(s) pendente(s) no valor total de R$ ${pendingPayments.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          severity: 'error'
        });
      }

      if (documents.every(doc => doc.status === 'Válido')) {
        alertsList.push({
          type: 'Documentação em Dia',
          message: 'Todos os documentos obrigatórios estão válidos',
          severity: 'info'
        });
      }

      setAlerts(alertsList);

    } catch (error) {
      console.error('Error loading client data:', error);
      toast.error('Erro ao carregar dados do cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client, aircraftRelation: ClientAircraft) => {
    setSelectedClient(client);
    setSelectedAircraft(aircraftRelation);
  };

  const handleAccessPortal = (client: Client, aircraftRelation: ClientAircraft) => {
    localStorage.setItem('clientPortalSession', JSON.stringify({
      clientId: client.id,
      clientName: client.company_name,
      aircraftId: aircraftRelation.aircraft_id,
      aircraftInfo: aircraftRelation.aircraft,
      sharePercentage: aircraftRelation.share_percentage
    }));
    navigate('/portal-cliente/dashboard');
  };

  const handleBack = () => {
    setSelectedClient(null);
    setSelectedAircraft(null);
    setAircraft(null);
    setFlightActivity({ total_flights: 0, total_hours: 0, total_landings: 0, recent_destinations: [] });
    setPendingPayments({ count: 0, total_amount: 0 });
    setDocuments([]);
    setAlerts([]);
  };

  const handleAircraftChange = (aircraftRelation: ClientAircraft) => {
    setSelectedAircraft(aircraftRelation);
  };

  if (loading && !selectedClient) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Carregando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-6 py-10">
          {!selectedClient ? (
            // Client Selection View
            <>
              <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Portal do Cliente</h1>
                <p className="text-muted-foreground text-sm md:text-base">Selecione um cliente para acessar as informações</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients
                  .filter(client => client.client_aircraft && client.client_aircraft.length > 0)
                  .map((client) => (
                    <Card
                      key={client.id}
                      className="hover:shadow-lg transition-all duration-300 border-border bg-card"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-foreground">{client.company_name}</CardTitle>
                        <CardDescription className="text-muted-foreground text-xs mt-1">
                          {client.client_aircraft?.length || 0} aeronave{client.client_aircraft?.length !== 1 ? 's' : ''} vinculada{client.client_aircraft?.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {client.client_aircraft && client.client_aircraft.length === 1 ? (
                            client.client_aircraft.map((aircraftRelation, idx) => (
                              <div key={idx} className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                                <p className="font-medium text-sm text-foreground">
                                  {aircraftRelation.aircraft.registration}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {aircraftRelation.aircraft.manufacturer} {aircraftRelation.aircraft.model}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {aircraftRelation.share_percentage}% de participação
                                  </Badge>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="space-y-2 mb-4 max-h-32 overflow-y-auto">
                              {client.client_aircraft && client.client_aircraft.map((aircraftRelation, idx) => (
                                <div key={idx} className="p-2 rounded-md bg-muted/50 border border-border/50 text-xs">
                                  <p className="font-medium text-foreground">{aircraftRelation.aircraft.registration}</p>
                                  <p className="text-muted-foreground text-xs">{aircraftRelation.aircraft.manufacturer} {aircraftRelation.aircraft.model}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {client.client_aircraft && client.client_aircraft.map((aircraftRelation, idx) => (
                            <Button
                              key={idx}
                              onClick={() => handleAccessPortal(client, aircraftRelation)}
                              className="w-full mt-2"
                              variant="default"
                            >
                              <Plane className="mr-2 h-4 w-4" />
                              Acessar Portal
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </>
          ) : (
            // Client Dashboard View
            <>
              <div className="mb-8">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="mb-4"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>

                <div className="flex items-center gap-4">
                  <Plane className="h-6 w-6 text-primary" />
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">{selectedClient.company_name}</h1>
                  </div>
                </div>

                {/* Aircraft List */}
                <div className="mt-6 space-y-3">
                  <h2 className="text-base font-semibold text-foreground">Aeronaves Vinculadas</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedClient.client_aircraft && selectedClient.client_aircraft.length > 0 ? (
                      selectedClient.client_aircraft.map((aircraftRel, idx) => (
                        <Card
                          key={idx}
                          onClick={() => handleAircraftChange(aircraftRel)}
                          className={`border cursor-pointer transition-all duration-200 ${
                            selectedAircraft?.aircraft_id === aircraftRel.aircraft_id
                              ? 'border-primary bg-primary/10 shadow-md'
                              : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          <CardContent className="pt-4">
                            <p className="font-semibold text-foreground">{aircraftRel.aircraft.registration}</p>
                            <p className="text-muted-foreground text-xs mt-1">{aircraftRel.aircraft.manufacturer} {aircraftRel.aircraft.model}</p>
                            <Badge variant="secondary" className="mt-3">
                              {aircraftRel.share_percentage}%
                            </Badge>
                            {selectedAircraft?.aircraft_id === aircraftRel.aircraft_id && (
                              <div className="mt-3 pt-3 border-t border-primary/30">
                                <p className="text-primary text-xs font-semibold">✓ Selecionada</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">Nenhuma aeronave vinculada</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Flight Activity */}
                <Card className="border-border bg-card lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                      <Clock className="h-5 w-5 text-primary" />
                      Atividade de Voo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-muted-foreground text-xs">Voos Este Mês</p>
                        <p className="font-semibold text-2xl text-primary mt-1">{flightActivity.total_flights}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Horas Este Mês</p>
                        <p className="font-semibold text-2xl text-primary mt-1">{flightActivity.total_hours.toFixed(1)}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Pousos</p>
                        <p className="font-semibold text-2xl text-primary mt-1">{flightActivity.total_landings}</p>
                      </div>
                    </div>

                    {flightActivity.recent_destinations.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground mb-2">Destinos Recentes:</p>
                        <div className="flex flex-wrap gap-2">
                          {flightActivity.recent_destinations.map((dest, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <MapPin className="h-3 w-3 mr-1" />
                              {dest}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Situação Financeira
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-muted-foreground text-xs">Total Pendente</p>
                        <p className="text-2xl font-bold text-foreground mt-1">
                          R$ {pendingPayments.total_amount.toFixed(2)}
                        </p>
                      </div>
                      {pendingPayments.count > 0 && (
                        <Badge variant="secondary" className="text-xs w-fit">
                          {pendingPayments.count} pendente(s)
                        </Badge>
                      )}
                      {pendingPayments.count === 0 && (
                        <p className="text-xs text-green-600 font-medium">✓ Sem pendências</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Client Data Tabs */}
              <div className="mb-6">
                <ClientDataTabs 
                  clientId={selectedClient.id}
                  aircraftId={selectedAircraft?.aircraft_id || ""}
                  isAdmin={false}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
