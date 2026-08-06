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
import { ChevronRight, ChevronLeft, Building2, Plane, Plus } from "lucide-react";
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
                  className="group cursor-pointer overflow-hidden border border-border/60 bg-gradient-to-br from-card to-muted/10 transition-all duration-200 hover:border-primary/50 hover:shadow-xl"
                  onClick={() => handleClientClick(client)}
                >
                  <CardContent className="p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1">
                        <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Aeronaves</span>
                        <span className="font-mono text-sm font-bold text-foreground">
                          {String(client.cotistas_aeronave?.length || 0).padStart(2, "0")}
                        </span>
                      </div>
                    </div>

                    <p className="text-lg font-bold uppercase tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {client.razao_social}
                    </p>

                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Ver detalhes
                      <ChevronRight className="h-3.5 w-3.5" />
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
                {activeClientTab === 'owned' ? 'Aeronaves' : 'Voos de Empréstimo'}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">{selectedClient.razao_social}</p>
            </div>
          </div>

          <Tabs value={activeClientTab} onValueChange={(value) => setActiveClientTab(value as "owned" | "loaned")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/50 p-1 rounded-lg mt-4">
              <TabsTrigger value="owned" className="gap-2 text-base">Aeronaves</TabsTrigger>
              <TabsTrigger value="loaned" className="gap-2 text-base">Voos de Empréstimo</TabsTrigger>
            </TabsList>
          </Tabs>

          {activeClientTab === 'owned' ? (
            <div className="mt-6">
              {aircrafts.length === 0 ? (
                <Card className="border border-border/50">
                  <CardContent className="py-16 text-center">
                    <Plane className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">Nenhuma aeronave cadastrada</p>
                    <p className="text-sm text-muted-foreground mt-1">Este cliente não possui aeronaves vinculadas</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {aircrafts.map((aircraft) => (
                    <Card
                      key={aircraft.id}
                      className="group cursor-pointer overflow-hidden border border-border/60 bg-gradient-to-br from-card to-muted/10 transition-all duration-200 hover:border-primary/50 hover:shadow-xl"
                      onClick={() => handleAircraftClick(aircraft)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-sm font-bold tracking-wider text-primary">
                            {aircraft.matricula}
                          </span>
                          <ChevronRight className="mt-1 h-5 w-5 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                        </div>
                        <div className="mt-4 space-y-1.5">
                          {aircraft.modelo && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Modelo</span>
                              <span className="font-medium text-foreground">{aircraft.modelo}</span>
                            </div>
                          )}
                          {aircraft.ano && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ano</span>
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
                  <h3 className="text-xl font-semibold text-foreground">Registros de Abastecimento</h3>
                  <p className="text-sm text-muted-foreground mt-1">Histórico de abastecimentos em aeronaves em que o cliente não é cotista.</p>
                </div>
                <Button onClick={() => setIsLoanedDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Registro
                </Button>
              </div>

              {borrowedRecords.length === 0 ? (
                <Card className="border border-border/50">
                  <CardContent className="py-16 text-center">
                    <Plane className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="font-medium text-foreground">Nenhum registro de empréstimo encontrado</p>
                    <p className="text-sm text-muted-foreground mt-1">Registros de abastecimento em aeronaves não vinculadas a este cliente serão exibidos aqui.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-x-auto border border-border/60 bg-card/60">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60 hover:bg-transparent">
                          <TableHead className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Data</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Aeronave</TableHead>
                          <TableHead className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Cliente</TableHead>
                          <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Litros</TableHead>
                          <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {borrowedRecords.map((record) => (
                          <TableRow key={record.id} className="border-border/40 hover:bg-muted/30">
                            <TableCell className="text-sm font-medium text-foreground">{formatDateBrazil(record.data)}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary">
                                {record.aeronave?.matricula || record.aeronave_id || '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm uppercase text-muted-foreground">{selectedClient.razao_social}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-foreground">{record.litros?.toFixed(2) ?? '—'} L</TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold text-foreground">
                              {record.valor_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <Dialog open={isLoanedDialogOpen} onOpenChange={(open) => {
                setIsLoanedDialogOpen(open);
                if (!open) setSelectedLoanedAircraftId('');
              }}>
                <DialogContent className="max-w-lg w-[95vw]">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">Selecione a aeronave emprestada</h4>
                      <p className="text-sm text-muted-foreground mt-1">Escolha a aeronave que será vinculada ao novo abastecimento.</p>
                    </div>
                    <SearchableCombobox
                      items={borrowedAircraftOptions.map((aircraft) => ({
                        id: aircraft.id,
                        label: `${aircraft.matricula}${aircraft.modelo ? ` • ${aircraft.modelo}` : ''}`
                      }))}
                      value={selectedLoanedAircraftId}
                      onChange={(value) => setSelectedLoanedAircraftId(value)}
                      placeholder="Selecionar aeronave"
                      searchPlaceholder="Buscar aeronave..."
                      emptyMessage="Nenhuma aeronave encontrada"
                    />
                    <div className="flex justify-end gap-3 pt-3 border-t border-border/50">
                      <Button variant="outline" onClick={() => setIsLoanedDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleLoanedAircraftSelect}>Continuar</Button>
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
