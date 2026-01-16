import React, { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  HistoricoRateioConsolidado,
  HorasMensaisConsolidadas,
  RelatorioCustosCliente,
  BalancoClienteAeronave,
} from '@/components/consolidation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, FileText, Clock, BarChart3, ArrowLeft, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function RateioCustoConsolidadoContent() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('balanco');
  const [clienteId, setClienteId] = useState('');
  const [aeronaveId, setAeronaveId] = useState('');

  // Carregar clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-rateio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, proprietario')
        .order('company_name');
      if (error) throw error;
      return data || [];
    },
  });

  // Carregar aeronaves
  const { data: aeronaves = [] } = useQuery({
    queryKey: ['aeronaves-rateio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aircraft')
        .select('id, registration, model')
        .order('registration');
      if (error) throw error;
      return data || [];
    },
  });

  // Status de conciliação (calculado localmente)
  const { data: conciliacaoStatus } = useQuery({
    queryKey: ['status-conciliacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select('status, amount');
      if (error) throw error;
      
      const pendentes = data?.filter(r => r.status === 'pendente') || [];
      const conciliadas = data?.filter(r => r.status === 'conciliado') || [];
      const consolidadas = data?.filter(r => r.status === 'consolidado') || [];
      
      return {
        pendentes: pendentes.length,
        valor_pendente: pendentes.reduce((sum, r) => sum + (r.amount || 0), 0),
        conciliadas: conciliadas.length,
        valor_conciliado: conciliadas.reduce((sum, r) => sum + (r.amount || 0), 0),
        consolidadas: consolidadas.length,
        valor_consolidado: consolidadas.reduce((sum, r) => sum + (r.amount || 0), 0),
        total: data?.length || 0
      };
    },
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
        <h1 className="text-4xl font-bold text-foreground mb-2">Rateio de Custos Consolidado</h1>
        <p className="text-lg text-muted-foreground">
          Gerenciar e acompanhar a consolidação de despesas e rateios entre clientes
        </p>
      </div>

      {/* Status Cards */}
      {conciliacaoStatus && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 mb-8">
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
              <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Pendentes</p>
                <p className="text-3xl font-bold text-amber-500">{conciliacaoStatus.pendentes}</p>
                <p className="text-xs text-slate-400 mt-1">
                    R$ {conciliacaoStatus.valor_pendente.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>

          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Conciliadas</p>
                <p className="text-3xl font-bold text-blue-500">{conciliacaoStatus.conciliadas}</p>
                <p className="text-xs text-slate-400 mt-1">
                    R$ {conciliacaoStatus.valor_conciliado.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>

          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Consolidadas</p>
                <p className="text-3xl font-bold text-green-500">{conciliacaoStatus.consolidadas}</p>
                <p className="text-xs text-slate-400 mt-1">
                    R$ {conciliacaoStatus.valor_consolidado.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>

          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total</p>
                <p className="text-3xl font-bold text-foreground">{conciliacaoStatus.total}</p>
                <p className="text-xs text-slate-400 mt-1">
                    R$ {(
                      conciliacaoStatus.valor_pendente +
                      conciliacaoStatus.valor_conciliado +
                      conciliacaoStatus.valor_consolidado
                    ).toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      {/* Info Alert */}
      <Card className="mb-8 border-blue-900/50 bg-blue-950/60 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex gap-3 items-start">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-400 mb-1">Fluxo de Consolidação</h3>
              <ol className="text-sm text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Despesa registrada como <strong>Pendente</strong></li>
                  <li>Rateio criado entre clientes</li>
                  <li>Transação bancária importada e conciliada → Status <strong>Conciliado</strong></li>
                  <li>Consolidação no histórico permanente → Status <strong>Consolidado</strong></li>
                  <li>Horas mensais são agregadas automaticamente</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto bg-slate-800/60 border border-slate-700/50">
            <TabsTrigger value="balanco" className="gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Balanço</span>
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
            <TabsTrigger value="horas" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Horas Mensais</span>
            </TabsTrigger>
            <TabsTrigger value="relatorio" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
          </TabsList>

        {/* Aba 0: Balanço Completo Cliente/Aeronave */}
        <TabsContent value="balanco" className="space-y-6">
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Selecione Cliente e Aeronave</CardTitle>
              <CardDescription>Visualize o balanço financeiro e operacional completo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cliente-balanco" className="text-foreground">Cliente</Label>
                  <Select value={clienteId} onValueChange={(val) => { setClienteId(val); setAeronaveId(''); }}>
                    <SelectTrigger id="cliente-balanco" className="border-slate-700/50 bg-slate-700/60">
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
                    <Label htmlFor="aeronave-balanco" className="text-foreground">Aeronave</Label>
                    <Select value={aeronaveId || "__all__"} onValueChange={(val) => setAeronaveId(val === "__all__" ? "" : val)}>
                      <SelectTrigger id="aeronave-balanco" className="border-slate-700/50 bg-slate-700/60">
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
              </div>
            </CardContent>
          </Card>

          {clienteId && (
            <BalancoClienteAeronave 
              clienteId={clienteId} 
              aeronaveId={aeronaveId || undefined} 
            />
          )}
        </TabsContent>

        {/* Aba 1: Histórico Consolidado */}
        <TabsContent value="historico" className="space-y-6">
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="cliente-filter" className="text-foreground">Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger id="cliente-filter" className="border-slate-700/50 bg-slate-700/60">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente: any) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {clienteId && <HistoricoRateioConsolidado clienteId={clienteId} />}
          </TabsContent>

        {/* Aba 2: Consolidação de Horas */}
        <TabsContent value="horas" className="space-y-6">
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="aeronave-filter" className="text-foreground">Aeronave</Label>
                  <Select value={aeronaveId} onValueChange={setAeronaveId}>
                    <SelectTrigger id="aeronave-filter" className="border-slate-700/50 bg-slate-700/60">
                      <SelectValue placeholder="Selecione uma aeronave" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(aeronaves) && aeronaves.map((aeronave: any) => (
                        <SelectItem key={aeronave.id} value={aeronave.id}>
                          {aeronave.registration}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>

                {aeronaveId && (
                  <div className="space-y-2">
                    <Label htmlFor="cliente-horas" className="text-foreground">Cliente (Opcional)</Label>
                    <Select value={clienteId || "__all__"} onValueChange={(val) => setClienteId(val === "__all__" ? "" : val)}>
                      <SelectTrigger id="cliente-horas" className="border-slate-700/50 bg-slate-700/60">
                        <SelectValue placeholder="Todos os clientes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos os clientes</SelectItem>
                        {clientes.map((cliente: any) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.company_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {aeronaveId && (
              <HorasMensaisConsolidadas aeronaveId={aeronaveId} clienteId={clienteId || undefined} />
            )}
          </TabsContent>

        {/* Aba 3: Relatórios */}
        <TabsContent value="relatorio" className="space-y-6">
          <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="cliente-relatorio" className="text-foreground">Cliente</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger id="cliente-relatorio" className="border-slate-700/50 bg-slate-700/60">
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente: any) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {clienteId && (
              <RelatorioCustosCliente
                clienteId={clienteId}
                showPendencias={true}
                showAnaliseAnual={true}
              />
            )}
          </TabsContent>
        </Tabs>

      {/* Footer Info */}
      <Card className="mt-8 border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
        <CardContent className="pt-6">
          <p className="text-sm text-slate-300">
            <strong>Nota:</strong> O sistema de consolidação rastreia todas as despesas desde o lançamento inicial,
            passando pela conciliação bancária, até o histórico permanente. As horas voadas são usadas para calcular
            o percentual de uso de cada cliente e garantir um rateio justo e proporcional.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RateioCustoConsolidado() {
  return (
    <Layout>
      <RateioCustoConsolidadoContent />
    </Layout>
  );
}
