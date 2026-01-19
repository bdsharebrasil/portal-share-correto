import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Building, ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { ClientDataTabs } from "@/components/portal-cliente/ClientDataTabs";
import { ClientSelectionCards } from "@/components/portal-cliente/ClientSelectionCards";
import { AircraftSelector } from "@/components/portal-cliente/AircraftSelector";
import { SaldosDevedoresResume } from "@/components/portal-cliente/SaldosDevedoresResume";
import { PartnerSelector, type PartnerInfo } from "@/components/portal-cliente/PartnerSelector";

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
  cnpj?: string;
  inscricao_estadual?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  uf?: string;
  proprietario?: string;
  financial_contact?: string;
  observations?: string;
  logo_url?: string;
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
  const [selectedPartner, setSelectedPartner] = useState<PartnerInfo | null | undefined>(undefined);
  const [selectedAircraft, setSelectedAircraft] = useState<ClientAircraft | null>(null);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [flightActivity, setFlightActivity] = useState<FlightActivity>({
    total_flights: 0,
    total_hours: 0,
    total_landings: 0,
    recent_destinations: []
  });
  const [logbookMonthData, setLogbookMonthData] = useState<LogbookMonthData | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient && !selectedAircraft && selectedClient.client_aircraft && selectedClient.client_aircraft.length > 0) {
      setSelectedAircraft(selectedClient.client_aircraft[0]);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient && selectedAircraft) {
      loadClientData();
    }
  }, [selectedClient, selectedAircraft]);

  useEffect(() => {
    if (!selectedAircraft?.aircraft_id) return;

    const interval = setInterval(() => {
      if (logbookMonthData) {
        loadClientData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedAircraft?.aircraft_id, logbookMonthData]);

  useEffect(() => {
    if (!selectedAircraft?.aircraft_id) return;

    const subscription = supabase
      .channel(`logbook_months_${selectedAircraft.aircraft_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logbook_months',
          filter: `aircraft_id=eq.${selectedAircraft.aircraft_id}`
        },
        () => {
          loadClientData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedAircraft?.aircraft_id]);

  const loadClients = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          status,
          cnpj,
          inscricao_estadual,
          email,
          phone,
          address,
          city,
          uf,
          proprietario,
          financial_contact,
          observations,
          logo_url,
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
        .order('company_name', { ascending: true });

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        throw error;
      }

      setClients(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      toast.error(`Erro ao carregar clientes: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadClientData = async () => {
    if (!selectedAircraft?.aircraft_id) return;
    
    try {
      setLoading(true);

      const { data: aircraftData } = await supabase
        .from('aircraft')
        .select('*')
        .eq('id', selectedAircraft.aircraft_id)
        .single();
      
      if (aircraftData) setAircraft(aircraftData);

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      let monthData: any = null;
      
      try {
        const { data } = await supabase
          .from('logbook_months')
          .select('id, celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, month, year')
          .eq('aircraft_id', selectedAircraft.aircraft_id)
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .single();
        monthData = data;
      } catch (err) {
        console.log('Mês atual não encontrado, buscando último mês...');
      }

      if (!monthData) {
        const { data: latestMonth } = await supabase
          .from('logbook_months')
          .select('id, celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, month, year')
          .eq('aircraft_id', selectedAircraft.aircraft_id)
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .limit(1);

        monthData = latestMonth && latestMonth.length > 0 ? latestMonth[0] : null;
      }

      if (monthData && monthData.id) {
        const { data: allEntries } = await supabase
          .from('logbook_entries')
          .select('total_time, entry_date')
          .eq('aircraft_id', selectedAircraft.aircraft_id)
          .order('entry_date', { ascending: true });

        if (allEntries && allEntries.length > 0) {
          const currentMonthEntries = allEntries.filter(e => {
            const entryDate = new Date(e.entry_date);
            const entryMonth = entryDate.getUTCMonth() + 1;
            const entryYear = entryDate.getUTCFullYear();
            return entryYear === monthData.year && entryMonth === monthData.month;
          });

          const totalFlightTimeThisMonth = currentMonthEntries.reduce((sum: number, entry: any) =>
            sum + (Number(entry.total_time) || 0), 0);

          const recalculatedCelulaAtual = parseFloat(
            ((monthData.celula_anterior ?? 0) + totalFlightTimeThisMonth).toFixed(2)
          );
          const recalculatedCelulaDisponivel = parseFloat(
            ((monthData.celula_prox_revisao ?? 0) - recalculatedCelulaAtual).toFixed(2)
          );

          if (Math.abs((monthData.celula_atual ?? 0) - recalculatedCelulaAtual) > 0.01 ||
              Math.abs((monthData.celula_disponivel ?? 0) - recalculatedCelulaDisponivel) > 0.01) {
            try {
              await supabase
                .from('logbook_months')
                .update({
                  celula_atual: recalculatedCelulaAtual,
                  celula_disponivel: recalculatedCelulaDisponivel
                })
                .eq('id', monthData.id);
            } catch (err) {
              console.error('Erro ao sincronizar célula:', err);
            }
          }

          setLogbookMonthData({
            celula_atual: recalculatedCelulaAtual,
            celula_prox_revisao: monthData.celula_prox_revisao,
            celula_disponivel: recalculatedCelulaDisponivel
          });
        } else {
          setLogbookMonthData(monthData as LogbookMonthData);
        }
      }

      const { data: logbookData } = await supabase
        .from('logbook_entries')
        .select('total_time, pousos, arrival_aerodrome')
        .eq('aircraft_id', selectedAircraft.aircraft_id)
        .order('entry_date', { ascending: false })
        .limit(10);

      if (logbookData) {
        const totalHours = logbookData.reduce((sum: number, entry: any) => 
          sum + Number(entry.total_time || 0), 0);
        const totalLandings = logbookData.reduce((sum: number, entry: any) => 
          sum + Number(entry.pousos || 0), 0);
        const destinations = [...new Set(logbookData.map(e => e.arrival_aerodrome).filter(Boolean))].slice(0, 5);
        
        setFlightActivity({
          total_flights: logbookData.length,
          total_hours: totalHours,
          total_landings: totalLandings,
          recent_destinations: destinations as string[]
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
      toast.error('Erro ao carregar dados do cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client, aircraftRelation: ClientAircraft) => {
    setSelectedClient(client);
    setSelectedAircraft(aircraftRelation);
  };

  const handlePartnerSelect = (partner: PartnerInfo | null) => {
    setSelectedPartner(partner);
  };

  const handleBack = () => {
    setSelectedClient(null);
    setSelectedPartner(undefined);
    setSelectedAircraft(null);
    setAircraft(null);
    setFlightActivity({
      total_flights: 0,
      total_hours: 0,
      total_landings: 0,
      recent_destinations: []
    });
    setLogbookMonthData(null);
  };

  const handleBackFromPartnerSelection = () => {
    setSelectedClient(null);
    setSelectedPartner(undefined);
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
      <style>{`
        .portal-cliente-outer {
          background-color: rgb(15, 18, 26);
          min-height: 545px;
        }

        @media (max-width: 991px) {
          .portal-cliente-outer {
            border-radius: 17px;
            overflow: hidden;
          }

          .portal-cliente-container {
            background-color: rgba(11, 11, 23, 1);
            border-radius: 26px;
            overflow: hidden;
          }
        }
      `}</style>
      <div className="portal-cliente-outer">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-10 portal-cliente-container">
          {!selectedClient ? (
            // Seleção de cliente
            <>
              <div className="mb-10">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Portal do Cliente</h1>
                <p className="text-muted-foreground text-base">Selecione uma empresa para visualizar detalhes, aeronaves e histórico</p>
              </div>

              <ClientSelectionCards 
                clients={clients} 
                onSelectClient={handleClientSelect} 
                loading={loading} 
              />
            </>
          ) : selectedPartner === undefined ? (
            // Seleção de sócio (se o cliente tiver sócios)
            <PartnerSelector
              clientId={selectedClient.id}
              clientName={selectedClient.company_name}
              onSelectPartner={handlePartnerSelect}
              onBack={handleBackFromPartnerSelection}
            />
          ) : (
            <>
              {/* Header com logo e nome do cliente */}
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleBack}
                    className="h-10 w-10"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  
                  {selectedClient.logo_url && (
                    <img 
                      src={selectedClient.logo_url} 
                      alt={selectedClient.company_name}
                      className="h-16 w-16 object-contain rounded-lg bg-white p-2"
                    />
                  )}
                  
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                      {selectedClient.company_name}
                    </h1>
                    {selectedClient.proprietario && (
                      <p className="text-sm text-muted-foreground">
                        Proprietário: {selectedClient.proprietario}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => toast.info("Função de relatório em desenvolvimento")}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Gerar Relatório
                </Button>
              </div>

              <AircraftSelector
                aircrafts={selectedClient.client_aircraft || []}
                selectedAircraftId={selectedAircraft?.aircraft_id || ""}
                onSelect={handleAircraftChange}
              >
                {/* Dados da Empresa ou Sócio */}
                <Card className="border border-white/10 bg-slate-800/30 backdrop-blur-sm mb-8">
                  <CardHeader className="pb-4 border-b border-white/10">
                    <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                      <Building className="h-5 w-5 text-blue-400" />
                      {selectedPartner ? 'Dados do Sócio' : 'Dados da Empresa'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                      {selectedPartner ? (
                        // Dados do Sócio Selecionado
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Sócio</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CPF</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-4 px-4 text-foreground font-medium">{selectedPartner.name}</td>
                              <td className="py-4 px-4 text-foreground">{selectedPartner.cpf || '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        // Dados Consolidados da Empresa
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome Fantasia</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CNPJ</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inscrição Estadual</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefone</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-4 px-4 text-foreground font-medium">{selectedClient.company_name}</td>
                              <td className="py-4 px-4 text-foreground">{selectedClient.cnpj || '—'}</td>
                              <td className="py-4 px-4 text-foreground">{selectedClient.inscricao_estadual || '—'}</td>
                              <td className="py-4 px-4 text-foreground">{selectedClient.email || '—'}</td>
                              <td className="py-4 px-4 text-foreground">{selectedClient.phone || '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Informações Adicionais e Aeronave */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
                  <div className="lg:col-span-2">
                    <Card className="border border-white/10 bg-slate-800/30 backdrop-blur-sm h-full">
                      <CardHeader className="pb-4 border-b border-white/10">
                        <CardTitle className="text-foreground text-lg">Mais Informações</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-6">
                        <div className="pb-4 border-b border-white/10">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contato Financeiro</p>
                          <p className="text-foreground font-medium">{selectedClient.financial_contact || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Proprietário</p>
                          <p className="text-foreground font-medium">{selectedClient.proprietario || '—'}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {aircraft && (
                    <div className="lg:col-span-3">
                      <Card className="border border-white/10 bg-slate-800/30 backdrop-blur-sm h-full">
                        <CardHeader className="pb-4 border-b border-white/10">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Aeronave</p>
                              <CardTitle className="text-foreground text-lg">
                                <span className="text-2xl font-bold text-blue-400">{aircraft.registration}</span>
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-2">
                                {aircraft.manufacturer} {aircraft.model} - {aircraft.year}
                              </p>
                            </div>
                            {selectedAircraft && (
                              <Badge className="bg-emerald-500 text-white h-fit">
                                {selectedPartner ? selectedPartner.percentage : selectedAircraft.share_percentage}% Cota
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                          <div className="grid grid-cols-2 gap-6">
                            <div className="flex flex-col">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Horas Voo</p>
                              <p className="text-2xl font-bold text-emerald-400">
                                {Number(flightActivity.total_hours || 0).toFixed(1)}h
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {flightActivity.total_flights} voo{flightActivity.total_flights !== 1 ? 's' : ''}
                              </p>
                            </div>

                            <div className="flex flex-col">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pousos</p>
                              <p className="text-2xl font-bold text-blue-400">
                                {Number(flightActivity.total_landings || 0)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {flightActivity.recent_destinations.length} destino{flightActivity.recent_destinations.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>

                {/* CTM Info - Célula Atual, Próx. Revisão, Disponível */}
                {logbookMonthData && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="flex items-center gap-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Célula Atual</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {decimalToHM(logbookMonthData.celula_atual)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">Próx. Revisão</p>
                        <p className="text-2xl font-bold text-orange-400">
                          {decimalToHM(logbookMonthData.celula_prox_revisao)}
                        </p>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 p-4 rounded-lg border ${
                      (logbookMonthData.celula_disponivel || 0) < 0
                        ? 'bg-red-500/10 border-red-500/20'
                        : 'bg-blue-500/10 border-blue-500/20'
                    }`}>
                      <div className="flex-1">
                        <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                          (logbookMonthData.celula_disponivel || 0) < 0
                            ? 'text-red-600'
                            : 'text-blue-600'
                        }`}>Disponível</p>
                        <p className={`text-2xl font-bold ${
                          (logbookMonthData.celula_disponivel || 0) < 0
                            ? 'text-red-400'
                            : 'text-blue-400'
                        }`}>
                          {decimalToHM(logbookMonthData.celula_disponivel)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Saldos Devedores */}
                <div className="mb-8">
                  <SaldosDevedoresResume clienteId={selectedClient.id} />
                </div>

                {/* Tabs com Histórico Financeiro, Voos e Documentos */}
                <div className="mb-6">
                  <ClientDataTabs
                    clientId={selectedClient.id}
                    clientName={selectedClient.company_name}
                    aircraftId={selectedAircraft?.aircraft_id || ""}
                    aircraftRegistration={selectedAircraft?.aircraft?.registration || ""}
                    isAdmin={false}
                    selectedPartner={selectedPartner}
                  />
                </div>
              </AircraftSelector>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
