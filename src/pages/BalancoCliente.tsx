import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Receipt, AlertCircle, Plane, FileBarChart, ArrowLeft, Users, User, KeyRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { BalancoVisaoGeral } from '@/components/balanco-cliente/BalancoVisaoGeral';
import { DespesasDetalhadas } from '@/components/balanco-cliente/DespesasDetalhadas';
import { HistoricoRateioConsolidado } from '@/components/balanco-cliente/HistoricoRateioConsolidado';
import { PendenciasFinanceiras } from '@/components/balanco-cliente/PendenciasFinanceiras';
import { BalancoAeronave } from '@/components/balanco-cliente/BalancoAeronave';
import { RelatoriosExportacao } from '@/components/balanco-cliente/RelatoriosExportacao';
import { GerenciarAcessoPortal } from '@/components/balanco-cliente/GerenciarAcessoPortal';
import { useClientesComSocios, ClienteComSocios, Socio } from '@/hooks/useSocioBalanco';

function BalancoClienteContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClienteId = searchParams.get('clienteId') || '';

  const [activeTab, setActiveTab] = useState('visao-geral');
  const [clienteId, setClienteId] = useState(queryClienteId);
  const [socioId, setSocioId] = useState<string | undefined>(undefined);
  const [aeronaveId, setAeronaveId] = useState('');
  const [periodo, setPeriodo] = useState({
    inicio: format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'),
    fim: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // Sincronizar clienteId com query params
  useEffect(() => {
    if (queryClienteId && queryClienteId !== clienteId) {
      setClienteId(queryClienteId);
    }
  }, [queryClienteId]);

  // Carregar clientes com sócios
  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();

  // Cliente atual selecionado
  const clienteAtual = clientesComSocios.find(c => c.id === clienteId);
  const socioAtual = clienteAtual?.socios.find(s => s.id === socioId);

  // Carregar aeronaves do cliente
  const { data: aeronaves = [] } = useQuery({
    queryKey: ['aeronaves-balanco', clienteId],
    queryFn: async () => {
      let query = supabase.from('aircraft').select('id, registration, model').eq('status', 'ativa');

      if (clienteId) {
        // Buscar aeronaves vinculadas ao cliente
        const { data: clientAircraft } = await supabase
          .from('client_aircraft')
          .select('aircraft_id')
          .eq('client_id', clienteId);

        if (clientAircraft && clientAircraft.length > 0) {
          const aircraftIds = clientAircraft.map(ca => ca.aircraft_id);
          query = query.in('id', aircraftIds);
        }
      }

      const { data, error } = await query.order('registration');
      if (error) throw error;
      return data || [];
    },
    enabled: true,
  });

  // Contar pendências para badge
  const { data: pendenciasCount = 0 } = useQuery({
    queryKey: ['pendencias-count', clienteId, aeronaveId],
    queryFn: async () => {
      if (!clienteId) return 0;
      
      let query = supabase
        .from('bank_reconciliations')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clienteId)
        .in('status', ['pendente', 'aguardando_reembolso']);
      
      if (aeronaveId) {
        query = query.eq('aircraft_id', aeronaveId);
      }
      
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
    enabled: !!clienteId,
  });

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group"
      >
        <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm">Voltar</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Balanço Cliente</h1>
        <p className="text-lg text-muted-foreground">
          Acompanhamento financeiro completo, pendências e balanço operacional
        </p>
      </div>

      {/* Filtros Globais */}
      <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filtros</CardTitle>
          <CardDescription>Selecione o cliente e período para análise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {/* Seletor de Cliente/Sócio */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="cliente-filter">Cliente / Sócio</Label>
              <Select 
                value={socioId ? `${clienteId}:${socioId}` : clienteId} 
                onValueChange={(val) => { 
                  if (val.includes(':')) {
                    const [newClienteId, newSocioId] = val.split(':');
                    if (newClienteId !== clienteId) {
                      setClienteId(newClienteId);
                      setAeronaveId('');
                    }
                    setSocioId(newSocioId);
                  } else {
                    setClienteId(val);
                    setSocioId(undefined);
                    setAeronaveId('');
                  }
                }}
              >
                <SelectTrigger id="cliente-filter">
                  <SelectValue placeholder="Selecione cliente ou sócio">
                    {clienteAtual && (
                      <div className="flex items-center gap-2">
                        {socioAtual ? (
                          <>
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{socioAtual.nome}</span>
                            <Badge variant="secondary" className="ml-1 text-xs">
                              {socioAtual.percentual.toFixed(1)}%
                            </Badge>
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">
                              {clienteAtual.company_name || clienteAtual.proprietario}
                            </span>
                            {clienteAtual.temMultiplosSocios && (
                              <Badge variant="outline" className="ml-1 text-xs">
                                {clienteAtual.socios.length} sócios
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {clientesComSocios.map((cliente) => (
                    <React.Fragment key={cliente.id}>
                      {/* Cliente consolidado */}
                      <SelectItem value={cliente.id} className="py-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {cliente.company_name || cliente.proprietario}
                          </span>
                          {cliente.temMultiplosSocios && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              Consolidado
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                      {/* Sócios individuais */}
                      {cliente.temMultiplosSocios &&
                        cliente.socios.map((socio) => (
                          <SelectItem
                            key={socio.id}
                            value={`${cliente.id}:${socio.id}`}
                            className="py-2 pl-8"
                          >
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{socio.nome}</span>
                              <Badge variant="secondary" className="ml-1 text-xs font-normal">
                                {socio.percentual.toFixed(1)}%
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {clienteId && (
              <div className="space-y-2">
                <Label htmlFor="aeronave-filter">Aeronave</Label>
                <Select value={aeronaveId || "__all__"} onValueChange={(val) => setAeronaveId(val === "__all__" ? "" : val)}>
                  <SelectTrigger id="aeronave-filter">
                    <SelectValue placeholder="Todas as aeronaves" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as aeronaves</SelectItem>
                    {aeronaves.map((aeronave: any) => (
                      <SelectItem key={aeronave.id} value={aeronave.id}>
                        {aeronave.registration} - {aeronave.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="data-inicio">Data Início</Label>
              <input
                id="data-inicio"
                type="date"
                value={periodo.inicio}
                onChange={(e) => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-fim">Data Fim</Label>
              <input
                id="data-fim"
                type="date"
                value={periodo.fim}
                onChange={(e) => setPeriodo(p => ({ ...p, fim: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto bg-muted/60 border border-border/50">
          <TabsTrigger value="visao-geral" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="despesas" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Despesas</span>
          </TabsTrigger>
          <TabsTrigger value="pendencias" className="gap-2 relative">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Pendências</span>
            {pendenciasCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendenciasCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="aeronave" className="gap-2">
            <Plane className="h-4 w-4" />
            <span className="hidden sm:inline">Aeronave</span>
          </TabsTrigger>
          <TabsTrigger value="acesso-portal" className="gap-2">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Acesso Portal</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          {clienteId ? (
            <BalancoVisaoGeral 
              clienteId={clienteId} 
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
            />
          ) : (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente para visualizar o balanço
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="despesas" className="space-y-6">
          {clienteId ? (
            <div className="space-y-6">
              <DespesasDetalhadas
                clienteId={clienteId}
                socioId={socioId}
                aeronaveId={aeronaveId || undefined}
                periodo={periodo}
              />
              <HistoricoRateioConsolidado
                clienteId={clienteId}
                socioId={socioId}
                aeronaveId={aeronaveId || undefined}
                periodo={periodo}
              />
            </div>
          ) : (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente para visualizar as despesas
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pendencias" className="space-y-6">
          {clienteId ? (
            <PendenciasFinanceiras 
              clienteId={clienteId} 
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
            />
          ) : (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente para visualizar as pendências
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="aeronave" className="space-y-6">
          {clienteId ? (
            <BalancoAeronave 
              clienteId={clienteId} 
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
            />
          ) : (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente para visualizar o balanço da aeronave
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="acesso-portal" className="space-y-6">
          {clienteId ? (
            <GerenciarAcessoPortal 
              clienteId={clienteId} 
              socioId={socioId}
            />
          ) : (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente para gerenciar o acesso ao portal
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          {clienteId ? (
            <RelatoriosExportacao 
              clienteId={clienteId} 
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
            />
          ) : (
            <Card className="border-border/50 bg-card/60">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente para gerar relatórios
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function BalancoCliente() {
  return (
    <Layout>
      <BalancoClienteContent />
    </Layout>
  );
}
