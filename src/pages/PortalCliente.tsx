import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Clock, MapPin, DollarSign, Building, Phone, Mail, MapIcon, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { ClientDataTabs } from "@/components/portal-cliente/ClientDataTabs";
import { ClientSelectionCards } from "@/components/portal-cliente/ClientSelectionCards";
import { ClientProfileHeader } from "@/components/portal-cliente/ClientProfileHeader";
import { AircraftSelector } from "@/components/portal-cliente/AircraftSelector";
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
  status: string;
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

interface LogbookMonthData {
  celula_atual: number | null;
  celula_prox_revisao: number | null;
  celula_disponivel: number | null;
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

const decimalToHM = (decimal?: number | null): string => {
  if (decimal === null || decimal === undefined || isNaN(decimal)) return '--:--';
  const isNegative = decimal < 0;
  const absDecimal = Math.abs(decimal);
  const totalMinutes = Math.round(absDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const sign = isNegative ? '-' : '';
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
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
  const [pendingPayments, setPendingPayments] = useState<PendingItem>({
    count: 0,
    total_amount: 0
  });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [logbookMonthData, setLogbookMonthData] = useState<LogbookMonthData | null>(null);
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
      const {
        data,
        error
      } = await supabase.from('clients').select(`
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
        `).eq('status', 'ativo').order('company_name', {
        ascending: true
      });
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
      const {
        data: aircraftData
      } = await supabase.from('aircraft').select('*').eq('id', selectedAircraft.aircraft_id).single();
      if (aircraftData) setAircraft(aircraftData);

      // Load logbook month data (latest)
      const {
        data: monthData
      } = await supabase.from('logbook_months').select('celula_atual, celula_prox_revisao, celula_disponivel').eq('aircraft_id', selectedAircraft.aircraft_id).order('year', {
        ascending: false
      }).order('month', {
        ascending: false
      }).limit(1);
      if (monthData && monthData.length > 0) {
        setLogbookMonthData(monthData[0] as LogbookMonthData);
      }

      // Load flight activity from logbook
      const {
        data: logbookData
      } = await supabase.from('logbook_entries').select('total_time, pousos, arrival_aerodrome').eq('aircraft_id', selectedAircraft.aircraft_id).order('entry_date', {
        ascending: false
      }).limit(10);
      if (logbookData) {
        const totalHours = logbookData.reduce((sum: number, entry: any) => sum + Number(entry.total_time || 0), 0);
        const totalLandings = logbookData.reduce((sum: number, entry: any) => sum + Number(entry.pousos || 0), 0);
        const destinations = [...new Set(logbookData.map(e => e.arrival_aerodrome).filter(Boolean))].slice(0, 5);
        setFlightActivity({
          total_flights: logbookData.length,
          total_hours: totalHours,
          total_landings: totalLandings,
          recent_destinations: destinations as string[]
        });
      }

      // Load pending payments
      const {
        data: paymentsData
      } = (await supabase.from('bank_reconciliations').select('amount').eq('client_id', selectedClient.id).eq('status', 'pendente')) as any;
      if (paymentsData) {
        const totalAmount = paymentsData.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
        setPendingPayments({
          count: paymentsData.length,
          total_amount: totalAmount
        });
      }

      // Load aircraft documents (fixed query)
      const {
        data: docsData
      } = (await supabase.from('documents').select('*').order('created_at', {
        ascending: false
      }).limit(5)) as any;
      if (docsData) setDocuments(docsData as any);

      // Generate alerts
      const alertsList: MaintenanceAlert[] = [];
      if (docsData && docsData.length > 0) {
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
      if (paymentsData && paymentsData.length > 0) {
        const totalPaymentsAmount = paymentsData.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
        alertsList.push({
          type: 'Pagamentos Pendentes',
          message: `${paymentsData.length} pagamento(s) pendente(s) no valor total de R$ ${totalPaymentsAmount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2
          })}`,
          severity: 'error'
        });
      }
      if (documents && documents.length > 0 && documents.every(doc => doc.status === 'Válido')) {
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
    setFlightActivity({
      total_flights: 0,
      total_hours: 0,
      total_landings: 0,
      recent_destinations: []
    });
    setPendingPayments({
      count: 0,
      total_amount: 0
    });
    setDocuments([]);
    setAlerts([]);
    setLogbookMonthData(null);
  };
  const handleAircraftChange = (aircraftRelation: ClientAircraft) => {
    setSelectedAircraft(aircraftRelation);
  };
  if (loading && !selectedClient) {
    return <Layout>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    </Layout>;
  }
  return <Layout>
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-10">
        {!selectedClient ?
          // Client Selection View
          <>
            <div className="mb-10">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Portal do Cliente</h1>
              <p className="text-muted-foreground text-base">Selecione uma empresa para visualizar detalhes, aeronaves e histórico</p>
            </div>

            <ClientSelectionCards clients={clients} onSelectClient={handleClientSelect} loading={loading} />
          </> :
          // Client Profile View
          <>
            <ClientProfileHeader clientName={selectedClient.company_name} clientStatus={selectedClient.status} onBack={handleBack} onEditProfile={() => toast.info("Função de edição em desenvolvimento")} onGenerateReport={() => toast.info("Função de relatório em desenvolvimento")} />

            <AircraftSelector aircrafts={selectedClient.client_aircraft || []} selectedAircraftId={selectedAircraft?.aircraft_id || ""} onSelect={handleAircraftChange}>
              {/* Dados da Empresa Table */}
              <Card className="border border-white/10 bg-slate-800/30 backdrop-blur-sm mb-8">
                <CardHeader className="pb-4 border-b border-white/10">
                  <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                    <Building className="h-5 w-5 text-blue-400" />
                    Dados da Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome Fantasia</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CNPJ</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inscrição Estadual</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4 text-foreground font-medium">{selectedClient.company_name}</td>
                          <td className="py-4 px-4 text-foreground">—</td>
                          <td className="py-4 px-4 text-foreground">—</td>
                          <td className="py-4 px-4 text-foreground">—</td>
                          <td className="py-4 px-4 text-foreground">—</td>
                          <td className="py-4 px-4">
                            <Badge className={selectedClient.status === 'ativo' ? 'bg-emerald-500' : 'bg-slate-500'}>
                              {selectedClient.status === 'ativo' ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Client & Aircraft Info Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
                {/* Additional Info Card */}
                <div className="lg:col-span-2">
                  <Card className="border border-white/10 bg-slate-800/30 backdrop-blur-sm h-full">
                    <CardHeader className="pb-4 border-b border-white/10">
                      <CardTitle className="text-foreground text-lg">Mais Informações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                      <div className="pb-4 border-b border-white/10">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contato Financeiro</p>
                        <p className="text-foreground font-medium">—</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Proprietário</p>
                        <p className="text-foreground font-medium">—</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Aircraft Data Card */}
                {aircraft && <div className="lg:col-span-3">
                  <Card className="border border-white/10 bg-slate-800/30 backdrop-blur-sm h-full">
                    <CardHeader className="pb-4 border-b border-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Aeronave</p>
                          <CardTitle className="text-foreground text-lg">
                            <span className="text-2xl font-bold text-blue-400">{aircraft.registration}</span>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-2">{aircraft.manufacturer} {aircraft.model} - {aircraft.year}</p>
                        </div>
                        {selectedAircraft && <Badge className="bg-emerald-500 text-white h-fit">
                          {selectedAircraft.share_percentage}% Cota
                        </Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="flex flex-col">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Horas Voo</p>
                          <p className="text-2xl font-bold text-emerald-400">{Number(flightActivity.total_hours || 0).toFixed(1)}h</p>
                          <p className="text-xs text-muted-foreground mt-1">{flightActivity.total_flights} voo{flightActivity.total_flights !== 1 ? 's' : ''}</p>
                        </div>

                        <div className="flex flex-col">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pousos</p>
                          <p className="text-2xl font-bold text-blue-400">{Number(flightActivity.total_landings || 0)}</p>
                          <p className="text-xs text-muted-foreground mt-1">{flightActivity.recent_destinations.length} destino{flightActivity.recent_destinations.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>}
              </div>

              {/* CTM Info - Célula Atual, Próx. Revisão, Disponível */}
              {logbookMonthData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Célula Atual</p>
                      <p className="text-2xl font-bold text-emerald-400">{decimalToHM(logbookMonthData.celula_atual)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">Próx. Revisão</p>
                      <p className="text-2xl font-bold text-orange-400">{decimalToHM(logbookMonthData.celula_prox_revisao)}</p>
                    </div>
                  </div>

                  <div className={`flex items-center gap-2 p-4 rounded-lg border ${(logbookMonthData.celula_disponivel || 0) < 0
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-blue-500/10 border-blue-500/20'
                    }`}>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${(logbookMonthData.celula_disponivel || 0) < 0
                          ? 'text-red-600'
                          : 'text-blue-600'
                        }`}>Disponível</p>
                      <p className={`text-2xl font-bold ${(logbookMonthData.celula_disponivel || 0) < 0
                          ? 'text-red-400'
                          : 'text-blue-400'
                        }`}>
                        {decimalToHM(logbookMonthData.celula_disponivel)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Summary Card */}
              <div className="grid grid-cols-1 mb-8">
                <Card className="border border-white/20 bg-gradient-to-br from-white/10 via-white/5 to-white/10 dark:from-slate-800/30 dark:via-slate-800/20 dark:to-slate-800/30 backdrop-blur-md">
                  <CardContent className="pt-6">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Saldo Devedor</p>
                    <p className={`text-3xl font-bold mb-1 ${Number(pendingPayments.total_amount || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      R$ {Number(pendingPayments.total_amount || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pendingPayments.count} item{pendingPayments.count !== 1 ? 'ns' : ''} pendente{pendingPayments.count !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs with Financial History, Flight History, and Documents */}
              <div className="mb-6">
                <ClientDataTabs clientId={selectedClient.id} clientName={selectedClient.company_name} aircraftId={selectedAircraft?.aircraft_id || ""} aircraftRegistration={selectedAircraft?.aircraft?.registration || ""} isAdmin={false} />
              </div>
            </AircraftSelector>
          </>}
      </div>
    </div>
  </Layout>;
}
