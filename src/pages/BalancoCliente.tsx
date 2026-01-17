import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Receipt, AlertCircle, Plane, FileBarChart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { BalancoVisaoGeral } from '@/components/balanco-cliente/BalancoVisaoGeral';
import { DespesasDetalhadas } from '@/components/balanco-cliente/DespesasDetalhadas';
import { PendenciasFinanceiras } from '@/components/balanco-cliente/PendenciasFinanceiras';
import { BalancoAeronave } from '@/components/balanco-cliente/BalancoAeronave';
import { RelatoriosExportacao } from '@/components/balanco-cliente/RelatoriosExportacao';

function BalancoClienteContent() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [clienteId, setClienteId] = useState('');
  const [aeronaveId, setAeronaveId] = useState('');
  const [periodo, setPeriodo] = useState({
    inicio: format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'),
    fim: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // Carregar clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-balanco'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, proprietario')
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Carregar aeronaves do cliente
  const { data: aeronaves = [] } = useQuery({
    queryKey: ['aeronaves-balanco', clienteId],
    queryFn: async () => {
      let query = supabase.from('aircraft').select('id, registration, model');
      
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="cliente-filter">Cliente</Label>
              <Select value={clienteId} onValueChange={(val) => { setClienteId(val); setAeronaveId(''); }}>
                <SelectTrigger id="cliente-filter">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente: any) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.company_name || cliente.proprietario}
                    </SelectItem>
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
        <TabsList className="grid w-full grid-cols-5 lg:w-auto bg-muted/60 border border-border/50">
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
          <TabsTrigger value="relatorios" className="gap-2">
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6">
          {clienteId ? (
            <BalancoVisaoGeral 
              clienteId={clienteId} 
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
            <DespesasDetalhadas 
              clienteId={clienteId} 
              aeronaveId={aeronaveId || undefined}
              periodo={periodo}
            />
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

        <TabsContent value="relatorios" className="space-y-6">
          {clienteId ? (
            <RelatoriosExportacao 
              clienteId={clienteId} 
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
