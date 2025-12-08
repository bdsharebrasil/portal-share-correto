import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Plane,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  FileText,
  Calendar,
  Fuel,
  MapPin,
  Download
} from "lucide-react";
import { toast } from "sonner";

interface Client {
  id: string;
  company_name: string;
  share_percentage: number;
  aircraft_id: string;
  aircraft?: {
    id: string;
    registration: string;
    manufacturer: string;
    model: string;
    year: string;
  };
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
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [flightActivity, setFlightActivity] = useState<FlightActivity>({
    total_flights: 0,
    total_hours: 0,
    total_landings: 0,
    recent_destinations: []
  });
  const [pendingPayments, setPendingPayments] = useState<PendingItem>({ count: 0, total_amount: 0 });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadClientData();
    }
  }, [selectedClient]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('client_aircraft')
        .select(`
          client_id,
          aircraft_id,
          share_percentage,
          client:client_id (
            id,
            company_name
          ),
          aircraft:aircraft_id (
            id,
            registration,
            manufacturer,
            model,
            year
          )
        `) as any;

      if (error) throw error;
      
      const formattedClients = (data || []).map((item: any) => ({
        id: item.client?.id,
        company_name: item.client?.company_name,
        share_percentage: item.share_percentage,
        aircraft_id: item.aircraft_id,
        aircraft: item.aircraft
      }));
      
      setClients(formattedClients);
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const loadClientData = async () => {
    if (!selectedClient?.aircraft_id) return;

    try {
      setLoading(true);

      // Load aircraft details
      const { data: aircraftData } = await supabase
        .from('aircraft')
        .select('*')
        .eq('id', selectedClient.aircraft_id)
        .single();

      if (aircraftData) setAircraft(aircraftData);

      // Load flight activity from logbook
      const { data: logbookData } = await supabase
        .from('logbook_entries')
        .select('total_time, pousos, arrival_aerodrome')
        .eq('aircraft_id', selectedClient.aircraft_id)
        .order('entry_date', { ascending: false })
        .limit(10) as any;

      if (logbookData) {
        const totalHours = logbookData.reduce((sum: number, entry: any) => sum + (entry.total_time || 0), 0);
        const totalLandings = logbookData.reduce((sum: number, entry: any) => sum + (entry.pousos || 0), 0);
        const destinations = [...new Set(logbookData.map((e: any) => e.arrival_aerodrome).filter(Boolean))].slice(0, 5);

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
          total_amount: paymentsData.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
        });
      }

      // Load aircraft documents  
      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .eq('folder_id', selectedClient.aircraft_id)
        .order('created_at', { ascending: false })
        .limit(5) as any;

      if (docsData) setDocuments(docsData);

      // Generate alerts
      const alertsList: MaintenanceAlert[] = [];

      if (docsData) {
        const expiringSoon = docsData.filter(doc => {
          const daysUntilExpiry = Math.floor((new Date(doc.valid_until).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return daysUntilExpiry <= 60 && daysUntilExpiry >= 0;
        });

        if (expiringSoon.length > 0) {
          alertsList.push({
            type: 'Revisão Programada',
            message: `Próxima revisão em ${new Date(expiringSoon[0].valid_until).toLocaleDateString('pt-BR')}`,
            severity: 'warning',
            date: expiringSoon[0].valid_until
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

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
  };

  const handleBack = () => {
    setSelectedClient(null);
    setAircraft(null);
    setFlightActivity({ total_flights: 0, total_hours: 0, total_landings: 0, recent_destinations: [] });
    setPendingPayments({ count: 0, total_amount: 0 });
    setDocuments([]);
    setAlerts([]);
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
        <div className="container mx-auto px-4 py-8">
          {!selectedClient ? (
            // Client Selection View
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Portal do Cliente</h1>
                <p className="text-muted-foreground">Selecione um cliente para acessar as informações</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map((client) => (
                  <Card
                    key={client.id}
                    className="hover:shadow-lg transition-smooth cursor-pointer border-border bg-card"
                    onClick={() => handleClientSelect(client)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg mb-1">{client.company_name}</CardTitle>
                          <CardDescription className="text-sm">
                            {client.aircraft?.registration} - {client.aircraft?.manufacturer} {client.aircraft?.model}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {client.share_percentage}%
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Participação:</span>
                          <span className="font-semibold">{client.share_percentage}%</span>
                        </div>
                        <Button className="w-full mt-4" variant="default">
                          <Plane className="mr-2 h-4 w-4" />
                          Acessar Portal
                        </Button>
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
                <Button variant="outline" onClick={handleBack} className="mb-4">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Plane className="h-8 w-8 text-primary" />
                    <div>
                      <h1 className="text-3xl font-bold text-foreground">{selectedClient.company_name}</h1>
                      <p className="text-muted-foreground">
                        {aircraft?.registration} • {aircraft?.manufacturer} {aircraft?.model}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {selectedClient.share_percentage}% de Participação
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Aircraft Information */}
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plane className="h-5 w-5" />
                      Informações da Aeronave
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Matrícula</p>
                        <p className="font-semibold text-lg">{aircraft?.registration}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Ano</p>
                        <p className="font-semibold text-lg">{aircraft?.year}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total de Horas</p>
                        <p className="font-semibold text-lg">{aircraft?.total_hours || 0}h</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge variant={aircraft?.status === 'Ativa' ? 'default' : 'secondary'}>
                          {aircraft?.status || 'Ativa'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Flight Activity */}
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Atividade de Voo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Voos Este Mês</p>
                        <p className="font-semibold text-2xl text-primary">{flightActivity.total_flights}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Horas Este Mês</p>
                        <p className="font-semibold text-2xl text-primary">{flightActivity.total_hours.toFixed(1)}h</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Pousos</p>
                        <p className="font-semibold text-2xl text-primary">{flightActivity.total_landings}</p>
                      </div>
                    </div>

                    {flightActivity.recent_destinations.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Destinos Recentes:</p>
                        <div className="flex flex-wrap gap-2">
                          {flightActivity.recent_destinations.map((dest, idx) => (
                            <Badge key={idx} variant="outline">
                              <MapPin className="h-3 w-3 mr-1" />
                              {dest}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Payments and Invoices */}
              <Card className="border-border bg-card mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Pagamentos e Faturas
                    </CardTitle>
                    {pendingPayments.count > 0 && (
                      <Badge variant="destructive">
                        {pendingPayments.count} pendente(s)
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {pendingPayments.count > 0 ? (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">Total Pendente:</p>
                      <p className="text-2xl font-bold text-destructive">
                        R$ {pendingPayments.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {pendingPayments.count} pagamento(s) pendente(s) no valor total de R$ {pendingPayments.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-success/10 border border-success/20 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle className="h-8 w-8 text-success" />
                      <div>
                        <p className="font-semibold">Sem Pendências</p>
                        <p className="text-sm text-muted-foreground">Todos os pagamentos estão em dia</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Documents */}
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Documentos da Aeronave
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Válido até: {new Date(doc.valid_until).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={doc.status === 'Válido' ? 'default' : 'destructive'}>
                              {doc.status}
                            </Badge>
                            {doc.document_url && (
                              <Button size="sm" variant="ghost">
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Alerts and Notifications */}
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Alertas e Notificações
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${alert.severity === 'error'
                              ? 'bg-destructive/10 border-destructive/20'
                              : alert.severity === 'warning'
                                ? 'bg-warning/10 border-warning/20'
                                : 'bg-success/10 border-success/20'
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            {alert.severity === 'error' && <XCircle className="h-5 w-5 text-destructive mt-0.5" />}
                            {alert.severity === 'warning' && <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />}
                            {alert.severity === 'info' && <CheckCircle className="h-5 w-5 text-success mt-0.5" />}
                            <div>
                              <p className="font-semibold">{alert.type}</p>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                              {alert.date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(alert.date).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
