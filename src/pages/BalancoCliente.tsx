import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Receipt, AlertCircle, Plane, FileBarChart, ArrowLeft, Users, User, KeyRound, Share2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { BalancoVisaoGeral } from '@/components/balanco-cliente/BalancoVisaoGeral';
import { HistoricoRateioConsolidado } from '@/components/balanco-cliente/HistoricoRateioConsolidado';
import { PendenciasFinanceiras } from '@/components/balanco-cliente/PendenciasFinanceiras';
import { BalancoAeronave } from '@/components/balanco-cliente/BalancoAeronave';
import { RelatoriosExportacao } from '@/components/balanco-cliente/RelatoriosExportacao';
import { GerenciarAcessoPortal } from '@/components/balanco-cliente/GerenciarAcessoPortal';
import { GestaoCompartilhamento } from '@/components/balanco-cliente/GestaoCompartilhamento';
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

  useEffect(() => {
    if (queryClienteId && queryClienteId !== clienteId) {
      setClienteId(queryClienteId);
    }
  }, [queryClienteId]);

  const { data: clientesComSocios = [], isLoading: loadingClientes } = useClientesComSocios();

  const clienteAtual = clientesComSocios.find(c => c.id === clienteId);
  const socioAtual = clienteAtual?.socios.find(s => s.id === socioId);

  const { data: aeronaves = [] } = useQuery({
    queryKey: ['aeronaves-balanco', clienteId],
    queryFn: async () => {
      let query = supabase.from('aircraft').select('id, registration, model').eq('status', 'ativa');
      if (clienteId) {
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

  // Contar pendências reais: bank_reconciliations + despesas_cliente_direto + abastecimentos
  const { data: pendenciasCount = 0 } = useQuery({
    queryKey: ['pendencias-count', clienteId, aeronaveId],
    queryFn: async () => {
      if (!clienteId) return 0;
      let total = 0;

      // 1) bank_reconciliations aguardando_reembolso (matching PendenciasFinanceiras)
      let q1 = supabase
        .from('bank_reconciliations')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clienteId)
        .eq('status', 'aguardando_reembolso');
      if (aeronaveId) q1 = q1.eq('aircraft_id', aeronaveId);
      const { count: c1 } = await q1;
      total += c1 || 0;

      // 2) despesas_cliente_direto pendentes
      let q2 = supabase
        .from('despesas_cliente_direto')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clienteId)
        .in('status', ['enviado', 'visualizado_cliente', 'aguardando_pagamento', 'atrasado']);
      if (aeronaveId) q2 = q2.eq('aeronave_id', aeronaveId);
      const { count: c2 } = await q2;
      total += c2 || 0;

      // 3) abastecimentos não pagos
      let q3 = supabase
        .from('abastecimentos')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clienteId)
        .neq('status_pagamento', 'pago');
      if (aeronaveId) q3 = q3.eq('aeronave_id', aeronaveId);
      const { count: c3 } = await q3;
      total += c3 || 0;

      return total;
    },
    enabled: !!clienteId,
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group"
      >
        <ArrowLeft className="h-5 w-5 text-primary group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Voltar</span>
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/20">
          <LayoutDashboard className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Balanço Cliente</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento financeiro completo, pendências e balanço operacional
          </p>
        </div>
      </div>

      {/* Filtros Globais */}
      <Card className="border border-border/50 bg-card/80 backdrop-blur-sm rounded-2xl shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription className="text-xs">Selecione o cliente e período para análise</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {/* Seletor de Cliente/Sócio */}
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="cliente-filter" className="text-xs font-medium">Cliente / Sócio</Label>
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
                <SelectTrigger id="cliente-filter" className="rounded-xl">
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
              <div className="space-y-1.5">
                <Label htmlFor="aeronave-filter" className="text-xs font-medium">Aeronave</Label>
                <Select value={aeronaveId || "__all__"} onValueChange={(val) => setAeronaveId(val === "__all__" ? "" : val)}>
                  <SelectTrigger id="aeronave-filter" className="rounded-xl">
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

            <div className="space-y-1.5">
              <Label htmlFor="data-inicio" className="text-xs font-medium">Data Início</Label>
              <input
                id="data-inicio"
                type="date"
                value={periodo.inicio}
                onChange={(e) => setPeriodo(p => ({ ...p, inicio: e.target.value }))}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data-fim" className="text-xs font-medium">Data Fim</Label>
              <input
                id="data-fim"
                type="date"
                value={periodo.fim}
                onChange={(e) => setPeriodo(p => ({ ...p, fim: e.target.value }))}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full gap-1 p-1.5 bg-card/80 border border-border/60 rounded-2xl shadow-lg backdrop-blur-sm h-auto flex-wrap">
          <TabsTrigger
            value="visao-geral"
            className="gap-2 px-4 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger
            value="despesas"
            className="gap-2 px-4 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all"
          >
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Despesas</span>
          </TabsTrigger>
          <TabsTrigger
            value="pendencias"
            className="gap-2 px-4 py-2.5 rounded-xl data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:shadow-md font-medium transition-all relative"
          >
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Pendências</span>
            {pendenciasCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 p-0 px-1 flex items-center justify-center text-[10px] font-bold rounded-full animate-pulse">
                {pendenciasCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="aeronave"
            className="gap-2 px-4 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all"
          >
            <Plane className="h-4 w-4" />
            <span className="hidden sm:inline">Aeronave</span>
          </TabsTrigger>
          <TabsTrigger
            value="compartilhamento"
            className="gap-2 px-4 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Compartilhamento</span>
          </TabsTrigger>
          <TabsTrigger
            value="acesso-portal"
            className="gap-2 px-4 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all"
          >
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Acesso Portal</span>
          </TabsTrigger>
          <TabsTrigger
            value="relatorios"
            className="gap-2 px-4 py-2.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md font-medium transition-all"
          >
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          {clienteId && aeronaveId ? (
            <BalancoVisaoGeral
              clienteId={clienteId}
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
              onNavigateTab={setActiveTab}
            />
          ) : (
            <Card className="border border-border/50 bg-card/60 rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente e uma aeronave para visualizar o balanço
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="despesas" className="space-y-6">
          {clienteId && aeronaveId ? (
            <HistoricoRateioConsolidado
              clienteId={clienteId}
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
            />
          ) : (
            <Card className="border border-border/50 bg-card/60 rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente e uma aeronave para visualizar as despesas
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pendencias" className="space-y-6">
          {clienteId && aeronaveId ? (
            <PendenciasFinanceiras
              clienteId={clienteId}
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
            />
          ) : (
            <Card className="border border-border/50 bg-card/60 rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente e uma aeronave para visualizar as pendências
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="aeronave" className="space-y-6">
          {clienteId && aeronaveId ? (
            <BalancoAeronave
              clienteId={clienteId}
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
            />
          ) : (
            <Card className="border border-border/50 bg-card/60 rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente e uma aeronave para visualizar o balanço da aeronave
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compartilhamento" className="space-y-6">
          {clienteId && aeronaveId ? (
            <GestaoCompartilhamento
              clienteId={clienteId}
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
            />
          ) : (
            <Card className="border border-border/50 bg-card/60 rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente e uma aeronave para visualizar o compartilhamento
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
            <Card className="border border-border/50 bg-card/60 rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente para gerenciar o acesso ao portal
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          {clienteId && aeronaveId ? (
            <RelatoriosExportacao
              clienteId={clienteId}
              socioId={socioId}
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
            />
          ) : (
            <Card className="border border-border/50 bg-card/60 rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Selecione um cliente e uma aeronave para gerar relatórios
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
