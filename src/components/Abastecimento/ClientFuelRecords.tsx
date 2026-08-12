import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, ChevronLeft, Building2, Plane, Plus, Search, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const [activeClientTab, setActiveClientTab] = useState<"owned" | "loaned">("owned");
  const [borrowedRecords, setBorrowedRecords] = useState<any[]>([]);
  const [borrowedAircraftOptions, setBorrowedAircraftOptions] = useState<Aircraft[]>([]);
  const [isLoanedDialogOpen, setIsLoanedDialogOpen] = useState(false);
  const [selectedLoanedAircraftId, setSelectedLoanedAircraftId] = useState<string>("");
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
      loadBorrowedRecords();
      loadBorrowedAircraftOptions();
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

  const loadBorrowedRecords = async () => {
    if (!selectedClient) {
      setBorrowedRecords([]);
      return;
    }

    const ownedAircraftIds = selectedClient.cotistas_aeronave?.map(ca => ca.id_aeronave) || [];

    const { data, error } = await supabase
      .from('abastecimentos')
      .select(
        'id, data, trecho, local, comanda, litros, valor_total, abastecimento_galoes, aeronave_id'
      )
      .eq('id_clientes', selectedClient.id)
      .order('data', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar registros de empréstimo');
      setBorrowedRecords([]);
      return;
    }

    const borrowed = (data || []).filter((record: any) => !ownedAircraftIds.includes(record.aeronave_id));
    if (borrowed.length === 0) {
      setBorrowedRecords([]);
      return;
    }

    const borrowedAircraftIds = Array.from(new Set(borrowed.map((record: any) => record.aeronave_id).filter(Boolean)));
    const { data: aircraftData, error: aircraftError } = await supabase
      .from('aeronave')
      .select('id, matricula, modelo, ano')
      .in('id', borrowedAircraftIds);

    if (aircraftError) {
      console.error('Erro ao carregar aeronaves dos registros emprestados:', aircraftError);
      setBorrowedRecords(borrowed);
      return;
    }

    const aircraftMap = new Map((aircraftData || []).map((aircraft: any) => [aircraft.id, aircraft]));
    const mappedRecords = borrowed.map((record: any) => ({
      ...record,
      aeronave: aircraftMap.get(record.aeronave_id) || null,
    }));

    setBorrowedRecords(mappedRecords);
  };

  const loadBorrowedAircraftOptions = async () => {
    if (!selectedClient) {
      setBorrowedAircraftOptions([]);
      return;
    }

    const ownedAircraftIds = selectedClient.cotistas_aeronave?.map(ca => ca.id_aeronave) || [];
    const { data, error } = await supabase
      .from('aeronave')
      .select('id, matricula, modelo, ano')
      .neq('status', 'inativa')
      .order('matricula', { ascending: true });

    if (error) {
      toast.error('Erro ao carregar aeronaves disponíveis para empréstimo');
      setBorrowedAircraftOptions([]);
      return;
    }

    const available = (data || [])
      .filter((aircraft: any) => !ownedAircraftIds.includes(aircraft.id))
      .map((aircraft: any) => ({
        id: aircraft.id,
        matricula: aircraft.matricula,
        modelo: aircraft.modelo,
        ano: aircraft.ano ? parseInt(aircraft.ano) : null,
      }));

    setBorrowedAircraftOptions(available);
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setSelectedAircraft(null);
    setActiveClientTab('owned');
    setSelectedLoanedAircraftId('');
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

  const formatDateBrazil = (value?: string | null): string => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR');
  };

  const handleLoanedAircraftSelect = () => {
    if (!selectedLoanedAircraftId) {
      toast.error('Selecione uma aeronave para continuar');
      return;
    }
    const found = borrowedAircraftOptions.find(a => a.id === selectedLoanedAircraftId);
    if (!found) {
      toast.error('Aeronave selecionada inválida');
      return;
    }
    setSelectedAircraft(found);
    setIsLoanedDialogOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!selectedClient ? (
        <>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                <Building2 className="h-7 w-7 text-primary" />
                Selecione um Cliente
              </h2>
              <p className="text-muted-foreground mt-1.5">{filteredClients.length} cliente(s) disponível(is)</p>
            </div>
            
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50 border-border/60 shadow-sm focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <Card className="border-dashed border-2 border-border/50 bg-transparent">
              <CardContent className="py-20 text-center flex flex-col items-center justify-center">
                <div className="bg-muted/50 p-4 rounded-full mb-4">
                  <Building2 className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="font-semibold text-lg text-foreground">
                  {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                </p>
                <p className="text-muted-foreground mt-1">
                  {searchTerm ? "Tente outro termo de busca ou limpe o filtro" : "Crie um cliente primeiro para começar"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredClients.map((client) => (
                <Card
                  key={client.id}
                  className="group cursor-pointer overflow-hidden border border-border/40 bg-card hover:bg-accent/5 transition-all duration-300 hover:border-primary/40 hover:shadow-md rounded-2xl"
                  onClick={() => handleClientClick(client)}
                >
                  <CardContent className="p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="rounded-xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5">
                        <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Aeronaves
                        </span>
                        <span className="font-mono text-sm font-bold text-foreground ml-1">
                          {String(client.cotistas_aeronave?.length || 0).padStart(2, "0")}
                        </span>
                      </div>
                    </div>

                    <p className="text-lg font-bold uppercase tracking-tight text-foreground line-clamp-1 mb-2">
                      {client.razao_social}
                    </p>

                    <div className="flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0">
                      Ver detalhes
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-5 border-b border-border/40 pb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar para clientes
            </Button>
            
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                <Building2 className="h-7 w-7 text-primary" />
                {selectedClient.razao_social}
              </h2>
            </div>
          </div>

          <Tabs value={activeClientTab} onValueChange={(value) => setActiveClientTab(value as "owned" | "loaned")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] h-12 bg-muted/40 p-1 rounded-xl">
              <TabsTrigger value="owned" className="gap-2 text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Plane className="h-4 w-4" /> Aeronaves
              </TabsTrigger>
              <TabsTrigger value="loaned" className="gap-2 text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                Voos de Empréstimo
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {activeClientTab === 'owned' ? (
            <div className="mt-4">
              {aircrafts.length === 0 ? (
                <Card className="border-dashed border-2 border-border/50 bg-transparent mt-6">
                  <CardContent className="py-16 text-center flex flex-col items-center">
                    <div className="bg-muted/50 p-4 rounded-full mb-4">
                      <Plane className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <p className="font-semibold text-lg text-foreground">Nenhuma aeronave cadastrada</p>
                    <p className="text-muted-foreground mt-1">Este cliente não possui aeronaves vinculadas em sociedade.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                  {aircrafts.map((aircraft) => (
                    <Card
                      key={aircraft.id}
                      className="group cursor-pointer overflow-hidden border border-border/40 bg-card hover:bg-accent/5 transition-all duration-300 hover:border-primary/40 hover:shadow-md rounded-2xl"
                      onClick={() => handleAircraftClick(aircraft)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-3 mb-5">
                          <span className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 font-mono text-base font-bold tracking-wider text-primary">
                            {aircraft.matricula}
                          </span>
                          <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground">
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="space-y-2.5">
                          {aircraft.modelo && (
                            <div className="flex items-center justify-between text-sm bg-muted/20 px-3 py-2 rounded-lg">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Modelo</span>
                              <span className="font-medium text-foreground">{aircraft.modelo}</span>
                            </div>
                          )}
                          {aircraft.ano && (
                            <div className="flex items-center justify-between text-sm bg-muted/20 px-3 py-2 rounded-lg">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ano</span>
                              <span className="font-medium text-foreground">{aircraft.ano}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Histórico de Empréstimos</h3>
                  <p className="text-sm text-muted-foreground mt-1">Abastecimentos em aeronaves em que o cliente não é cotista.</p>
                </div>
                <Button onClick={() => setIsLoanedDialogOpen(true)} className="gap-2 rounded-xl shadow-sm">
                  <Plus className="h-4 w-4" />
                  Novo Registro
                </Button>
              </div>

              {borrowedRecords.length === 0 ? (
                <Card className="border-dashed border-2 border-border/50 bg-transparent">
                  <CardContent className="py-16 text-center flex flex-col items-center">
                    <div className="bg-muted/50 p-4 rounded-full mb-4">
                      <Plane className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                    <p className="font-semibold text-lg text-foreground">Nenhum registro encontrado</p>
                    <p className="text-muted-foreground mt-1">Registros de abastecimento em aeronaves de terceiros aparecerão aqui.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="w-full">
                    <table className="w-full table-fixed border-collapse">
                      <caption className="sr-only">Abastecimentos em aeronaves emprestadas</caption>
                      <thead className="bg-ink-900">
                        <tr className="border-b border-line">
                          <th className="w-28 px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground">Data</th>
                          <th className="w-40 px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground">Trecho</th>
                          <th className="w-40 px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground">Local</th>
                          <th className="w-28 px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground">Comanda</th>
                          <th className="w-20 px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground">N.F</th>
                          <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground">Fornecedor</th>
                          <th className="w-32 px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground">Sócio</th>
                          <th className="w-28 px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground">Status</th>
                          <th className="w-24 px-4 py-3 text-right text-[10px] font-semibold uppercase text-muted-foreground">Litros</th>
                          <th className="w-24 px-4 py-3 text-right text-[10px] font-semibold uppercase text-muted-foreground">Valor Unit.</th>
                          <th className="w-28 px-4 py-3 text-right text-[10px] font-semibold uppercase text-muted-foreground">Valor Total</th>
                          <th className="w-10 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {borrowedRecords.map((record) => {
                          const aircraft = record.aeronave || { matricula: record.aeronave_id };
                          const socio = (record as any).socioNome || (record as any).socio_nome || '—';
                          const status = (record as any).status || (record as any).st || (record as any).pagamento_status || 'pendente';
                          const litros = record.litros ?? record.litros_total ?? 0;
                          const valorUnit = (record as any).valor_unitario ?? (record as any).valor_unit ?? (record as any).valor ?? 0;
                          const valor = record.valor_total ?? record.valorTotal ?? valorUnit * litros;
                          const comanda = (record as any).comanda || (record as any).comanda_num || '—';
                          const nf = (record as any).nf || (record as any).nf_num || (record as any).nota_fiscal || '—';
                          const fornecedor = (record as any).fornecedor || (record as any).fornecedor_nome || (record as any).supplier || '—';
                          const fornecedor_sub = (record as any).fornecedor_sub || (record as any).fornecedor_info || '';
                          return (
                            <tr key={record.id} className="cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-ink-800/60" onClick={() => aircraft && setSelectedAircraft(aircraft)}>
                              <td className="px-4 py-3 align-top">
                                <div className="text-sm font-semibold text-foreground">{formatDateBrazil(record.data)}</div>
                                <div className="text-xs text-muted-foreground mt-1">{new Date(record.data || '').toLocaleTimeString ? '' : ''}</div>
                              </td>
                              <td className="px-4 py-3 align-top text-sm font-medium text-foreground">{(record as any).trecho || '—'}</td>
                              <td className="px-4 py-3 align-top text-sm text-muted-foreground">{(record as any).local || '—'}</td>
                              <td className="px-4 py-3 align-top text-sm font-mono text-muted-foreground">{comanda}</td>
                              <td className="px-4 py-3 align-top text-sm font-mono text-muted-foreground">{nf}</td>
                              <td className="px-4 py-3 align-top">
                                <div className="text-sm font-semibold text-foreground">{fornecedor}</div>
                                {fornecedor_sub && <div className="text-[11px] text-muted-foreground mt-0.5">{fornecedor_sub}</div>}
                              </td>
                              <td className="px-4 py-3 align-top text-sm text-muted-foreground">{socio}</td>
                              <td className="px-4 py-3 align-top">
                                {status === 'recebido' || status === 'pago' ? (
                                  <Badge className="bg-green-600/10 border-green-600/20 text-green-600">Pago</Badge>
                                ) : (
                                  <Badge className="bg-yellow-500/10 border-yellow-500/20 text-yellow-500">Em aberto</Badge>
                                )}
                              </td>
                              <td className="w-24 px-4 py-3 text-right font-mono text-sm text-foreground">{Number(litros).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                              <td className="w-24 px-4 py-3 text-right font-mono text-sm text-muted-foreground">{Number(valorUnit).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td className="w-28 px-4 py-3 text-right font-mono text-sm font-semibold text-foreground">{Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                              <td className="px-3 py-3 text-right">
                                <Button variant="ghost" size="sm" className="p-1">
                                  <Edit className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              <Dialog open={isLoanedDialogOpen} onOpenChange={(open) => {
                setIsLoanedDialogOpen(open);
                if (!open) setSelectedLoanedAircraftId('');
              }}>
                <DialogContent className="max-w-md w-[95vw] rounded-2xl">
                  <div className="space-y-5 pt-2">
                    <div>
                      <h4 className="text-xl font-semibold text-foreground">Aeronave Terceirizada</h4>
                      <p className="text-sm text-muted-foreground mt-1.5">Escolha a aeronave de outro proprietário para registrar o abastecimento deste cliente.</p>
                    </div>
                    <SearchableCombobox
                      items={borrowedAircraftOptions.map((aircraft) => ({
                        id: aircraft.id,
                        label: `${aircraft.matricula}${aircraft.modelo ? ` • ${aircraft.modelo}` : ''}`
                      }))}
                      value={selectedLoanedAircraftId}
                      onChange={(value) => setSelectedLoanedAircraftId(value)}
                      placeholder="Selecionar aeronave..."
                      searchPlaceholder="Buscar por matrícula..."
                      emptyMessage="Nenhuma aeronave encontrada"
                    />
                    <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
                      <Button variant="ghost" onClick={() => setIsLoanedDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleLoanedAircraftSelect} className="shadow-sm">Continuar</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </>
      )}
    </div>
  );
}