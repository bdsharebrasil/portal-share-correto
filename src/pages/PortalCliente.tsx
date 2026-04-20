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
import { AeronaveSelector } from "@/components/portal-cliente/AircraftSelector";
import { SaldosDevedoresResume } from "@/components/portal-cliente/SaldosDevedoresResume";
import { PartnerSelector, type PartnerInfo } from "@/components/portal-cliente/PartnerSelector";

interface ClientAircraft {
  id_aeronave: string;
  percentual_sociedade: number;
  aeronave: {
    id: string;
    matricula: string;
    fabricante: string;
    modelo: string;
    ano: string;
  };
}

interface Client {
  id: string;
  razao_social: string;
  status: string;
  cnpj?: string;
  inscricao_estadual?: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  proprietario?: string;
  contato_financeiro?: string;
  observacoes?: string;
  url_logo?: string;
  cotistas_aeronave?: ClientAircraft[];
}

interface Aircraft {
  id: string;
  matricula: string;
  fabricante: string;
  modelo: string;
  ano: string;
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
  const [selectedAeronave, setSelectedAircraft] = useState<ClientAircraft | null>(null);
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
    if (selectedClient && !selectedAeronave && selectedClient.cotistas_aeronave && selectedClient.cotistas_aeronave.length > 0) {
      setSelectedAircraft(selectedClient.cotistas_aeronave[0]);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedClient && selectedAeronave) {
      loadClientData();
    }
  }, [selectedClient, selectedAeronave]);

  useEffect(() => {
    if (!selectedAeronave?.id_aeronave) return;

    const interval = setInterval(() => {
      if (logbookMonthData) {
        loadClientData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedAeronave?.id_aeronave, logbookMonthData]);

  useEffect(() => {
    if (!selectedAeronave?.id_aeronave) return;

    const subscription = supabase
      .channel(`diario_mes_${selectedAeronave.aeronave_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'diario_mes',
          filter: `aeronave_id=eq.${selectedAeronave.aeronave_id}`
        },
        () => {
          loadClientData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedAeronave?.id_aeronave]);

  const loadClients = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id,
          razao_social,
          cnpj,
          inscricao_estadual,
          email,
          telefone,
          endereco,
          cidade,
          uf,
          proprietario,
          contato_financeiro,
          observacoes,
          url_logo
        `)
        .order('razao_social', { ascending: true });

      if (error) {
        console.error('Erro ao carregar clientes:', error);
        throw error;
      }

      // Buscar aeronaves de cada cliente separadamente
      const clientsWithAircraft = await Promise.all(
        (data || []).map(async (client) => {
          const { data: aircraftData, error: aircraftError } = await supabase
            .from('cotistas_aeronave')
            .select(`
              id_aeronave,
              percentual_sociedade,
              aeronave!id_aeronave (
                id,
                matricula,
                fabricante,
                modelo,
                ano
              )
            `)
            .eq('id_clientes', client.id);

          if (aircraftError) {
            console.warn(`Erro ao carregar aeronaves do cliente ${client.id}:`, aircraftError);
          }

          return {
            ...client,
            cotistas_aeronave: aircraftData || []
          };
        })
      );

      setClients(clientsWithAircraft);
    } catch (error: any) {
      console.error('Erro ao carregar clientes:', error);
      toast.error(`Erro ao carregar clientes: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadClientData = async () => {
    if (!selectedAeronave?.id_aeronave) return;

    try {
      setLoading(true);

      const { data: aircraftData } = await supabase
        .from('aeronave')
        .select('*')
        .eq('id', selectedAeronave.id_aeronave)
        .single();

      if (aircraftData) setAircraft(aircraftData);

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // ✅ FIX: .maybeSingle() em vez de .single() — não lança erro se o mês não existir ainda
      const { data: currentMonthData } = await supabase
        .from('diario_mes')
        .select('id, celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, mes, ano')
        .eq('aeronave_id', selectedAeronave.aeronave_id)
        .eq('mes', currentMonth)
        .eq('ano', currentYear)
        .maybeSingle();

      let monthData: any = currentMonthData;

      // Se não encontrou o mês atual, busca o mais recente
      if (!monthData) {
        console.log('Mês atual não encontrado, buscando último mês disponível...');
        const { data: latestMonths } = await supabase
          .from('diario_mes')
          .select('id, celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel, mes, ano')
          .eq('aeronave_id', selectedAeronave.aeronave_id)
          .order('ano', { ascending: false })
          .order('mes', { ascending: false })
          .limit(1);

        monthData = latestMonths && latestMonths.length > 0 ? latestMonths[0] : null;
      }

      // ✅ FIX: removido o recálculo e update de célula no frontend.
      // Os triggers do banco (trigger_consolidar_horas_logbook) já fazem isso automaticamente.
      // Fazer update aqui causava race conditions e duplicação de lógica.
      if (monthData) {
        setLogbookMonthData({
          celula_atual: monthData.celula_atual,
          celula_prox_revisao: monthData.celula_prox_revisao,
          celula_disponivel: monthData.celula_disponivel,
        });
      }

      const { data: logbookData } = await supabase
        .from('lancamentos_diario_bordo')
        .select('tempo_total, pousos_total, arrival_aerodrome')
        .eq('aeronave_id', selectedAeronave.aeronave_id)
        .order('data_registro', { ascending: false })
        .limit(10);

      if (logbookData) {
        const totalHours = logbookData.reduce((sum: number, entry: any) =>
          sum + Number(entry.tempo_total || 0), 0);
        const totalLandings = logbookData.reduce((sum: number, entry: any) =>
          sum + Number(entry.pousos_total || 0), 0);
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
          background-color: rgba(15, 18, 26, 0.03);
          min-height: 545px;
        }

        @media (max-width: 991px) {
          .portal-cliente-outer {
            border-radius: 17px;
            overflow: hidden;
          }

          .portal-cliente-container {
            background-color: rgb(15, 18, 26);
            border-radius: 26px;
            overflow: hidden;
          }
        }
      `}</style>
      <div className="portal-cliente-outer">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-10 portal-cliente-container">
          {!selectedClient ? (
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
            <PartnerSelector
              clientId={selectedClient.id}
              clientName={selectedClient.razao_social}
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

                  {selectedClient.url_logo && (
                    <img
                      src={selectedClient.url_logo}
                      alt={selectedClient.razao_social}
                      className="h-16 w-16 object-contain rounded-lg p-2 border"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderColor: 'rgba(5, 17, 42, 1)'
                      }}
                    />
                  )}

                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                      {selectedClient.razao_social}
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

              <AeronaveSelector
                aircrafts={selectedClient.cotistas_aeronave || []}
                selectedAircraftId={selectedAeronave?.id_aeronave || ""}
                onSelect={handleAircraftChange}
              >
                {/* Dados da Empresa ou Sócio */}
                <Card className="border border-white/10 bg-white/5 backdrop-blur-sm mb-8">
                  <CardHeader className="pb-4 border-b border-white/10">
                    <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                      <Building className="h-5 w-5 text-blue-400" />
                      {selectedPartner ? 'Dados do Sócio' : 'Dados da Empresa'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                      {selectedPartner ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Sócio</th>
                              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">CPF</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="py-4 px-4 text-foreground font-medium">{selectedPartner.nome}</td>
                              <td className="py-4 px-4 text-foreground">{selectedPartner.cpf || '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
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
                              <td className="py-4 px-4 text-foreground font-medium">{selectedClient.razao_social}</td>
                              <td className="py-4 px-4 text-foreground">{selectedClient.cnpj || '—'}</td>
                              <td className="py-4 px-4 text-foreground">{selectedClient.inscricao_estadual || '—'}</td>
                              <td className="py-4 px-4 text-foreground">{selectedClient.email || '—'}</td>
                              <td className="py-4 px-4 text-foreground">{selectedClient.telefone || '—'}</td>
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
                    <Card className="border border-white/10 bg-white/5 backdrop-blur-sm h-full">
                      <CardHeader className="pb-4 border-b border-white/10">
                        <CardTitle className="text-foreground text-lg">Mais Informações</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-6">
                        <div className="pb-4 border-b border-white/10">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contato Financeiro</p>
                          <p className="text-foreground font-medium">{selectedClient.contato_financeiro || '—'}</p>
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
                      <Card className="border border-white/10 bg-white/5 backdrop-blur-sm h-full">
                        <CardHeader className="pb-4 border-b border-white/10">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Aeronave</p>
                              <CardTitle className="text-foreground text-lg">
                                <span className="text-2xl font-bold text-blue-400">{aircraft.matricula}</span>
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-2">
                                {aircraft.fabricante} {aircraft.modelo} - {aircraft.ano}
                              </p>
                            </div>
                            {selectedAeronave && (
                              <Badge className="bg-emerald-500 text-white h-fit">
                                {selectedPartner ? selectedPartner.percentage : selectedAeronave.percentual_participacao}% Cota
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


                {/* Saldos Devedores */}
                <div className="mb-8">
                  <SaldosDevedoresResume clienteId={selectedClient.id} aircraftId={selectedAeronave?.id_aeronave || ""} />
                </div>

                {/* Tabs */}
                <div className="mb-6">
                  <ClientDataTabs
                    clientId={selectedClient.id}
                    clientName={selectedClient.razao_social}
                    aircraftId={selectedAeronave?.id_aeronave || ""}
                    aircraftRegistration={selectedAeronave?.aeronave?.matricula || ""}
                    isAdmin={false}
                    selectedPartner={selectedPartner}
                  />
                </div>
              </AeronaveSelector>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
