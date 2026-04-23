// @ts-nocheck
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Users, BarChart3, TrendingUp, TrendingDown, Minus, Calendar, Filter, Fuel, ChevronRight } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { usePartnerExpenses, useAllClientsWithPartners } from "@/hooks/usePartnerExpenses";
import { useAbastecimentosByPeriod } from "@/hooks/useAbastecimentos";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatPercentage = (value: number) => {
  return `${value.toFixed(2)}%`;
};

interface PartnerExpenseReportProps {
  defaultClientId?: string;
  defaultAircraftId?: string;
}

export function PartnerExpenseReport({ defaultClientId, defaultAircraftId }: PartnerExpenseReportProps) {
  const navigate = useNavigate();
  const [selectedClientId, setSelectedClientId] = useState<string>(defaultClientId || "");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const startDate = startOfMonth(new Date(selectedYear, selectedMonth));
  const endDate = endOfMonth(new Date(selectedYear, selectedMonth));

  const { data: clientsWithPartners, isLoading: loadingClients } = useAllClientsWithPartners();
  const { data: expenseSummary, isLoading: loadingExpenses } = usePartnerExpenses({
    clientId: selectedClientId || null,
    aircraftId: defaultAircraftId,
    startDate,
    endDate
  });
  const { data: abastecimentos = [], isLoading: loadingAbastecimentos } = useAbastecimentosByPeriod(
    selectedClientId || null,
    format(startDate, 'yyyy-MM-dd'),
    format(endDate, 'yyyy-MM-dd')
  );

  // Generate last 12 months for selection
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      month: date.getMonth(),
      year: date.getFullYear(),
      label: format(date, 'MMMM yyyy', { locale: ptBR })
    };
  });

  const getDifferenceIndicator = (diff: number) => {
    if (diff > 1) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (diff < -1) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getDifferenceColor = (diff: number) => {
    if (diff > 1) return "text-red-500";
    if (diff < -1) return "text-green-500";
    return "text-muted-foreground";
  };

  if (loadingClients) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando clientes...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Cliente (CNPJ)</label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(clientsWithPartners || []).map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[200px]">
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select 
                value={`${selectedMonth}-${selectedYear}`}
                onValueChange={(val) => {
                  const [month, year] = val.split('-').map(Number);
                  setSelectedMonth(month);
                  setSelectedYear(year);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={`${opt.month}-${opt.year}`} value={`${opt.month}-${opt.year}`}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedClientId ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione um cliente para visualizar o relatório de gastos por sócio</p>
          </CardContent>
        </Card>
      ) : loadingExpenses ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Carregando dados...
          </CardContent>
        </Card>
      ) : !expenseSummary || expenseSummary.partners.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Este cliente não possui sócios cadastrados ou não há gastos no período</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="cnpj" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="cnpj" className="gap-2">
              <Building className="h-4 w-4" />
              Visão CNPJ
            </TabsTrigger>
            <TabsTrigger value="partners" className="gap-2">
              <Users className="h-4 w-4" />
              Por Sócio
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Comparativo
            </TabsTrigger>
            <TabsTrigger value="fuels" className="gap-2">
              <Fuel className="h-4 w-4" />
              Abastecimentos
            </TabsTrigger>
          </TabsList>

          {/* CNPJ Overview */}
          <TabsContent value="cnpj" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{expenseSummary.client.razao_social}</CardTitle>
                    <p className="text-sm text-muted-foreground font-mono mt-1">
                      CNPJ: {expenseSummary.client.cnpj}
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(startDate, 'MMM yyyy', { locale: ptBR })}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm text-muted-foreground">Total de Gastos</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(expenseSummary.totalExpenses)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Gastos Compartilhados</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(expenseSummary.sharedExpenses)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Gastos Diretos (Sócios)</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(expenseSummary.totalExpenses - expenseSummary.sharedExpenses)}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">Sócios Cadastrados</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {expenseSummary.partners.map(partner => (
                      <div key={partner.index} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{partner.nome}</span>
                          <Badge variant="secondary">{formatPercentage(partner.percentage)}</Badge>
                        </div>
                        {partner.cpf && (
                          <p className="text-xs text-muted-foreground font-mono">
                            CPF: {partner.cpf}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Per Partner View */}
          <TabsContent value="partners" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {expenseSummary.partnerSummaries.map(summary => (
                <Card key={summary.partner.index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{summary.partner.nome}</CardTitle>
                      <Badge variant="outline">Sócio {summary.partner.index}</Badge>
                    </div>
                    {summary.partner.cpf && (
                      <p className="text-xs text-muted-foreground font-mono">
                        CPF: {summary.partner.cpf}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Participação Definida</span>
                        <span className="font-medium">{formatPercentage(summary.partner.percentage)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Gastos Diretos</span>
                        <span className="font-medium">{formatCurrency(summary.directExpenses)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Rateio ({formatPercentage(summary.partner.percentage)})</span>
                        <span className="font-medium">{formatCurrency(summary.sharedExpenses)}</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between">
                          <span className="font-semibold">Total</span>
                          <span className="font-bold text-primary">{formatCurrency(summary.totalExpenses)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">% Real de Uso</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{formatPercentage(summary.realPercentage)}</span>
                          {getDifferenceIndicator(summary.difference)}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">Diferença</span>
                        <span className={`text-sm font-medium ${getDifferenceColor(summary.difference)}`}>
                          {summary.difference > 0 ? '+' : ''}{formatPercentage(summary.difference)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Comparison Table */}
          <TabsContent value="comparison" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comparativo entre Sócios</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sócio</TableHead>
                      <TableHead className="text-center">% Rateio</TableHead>
                      <TableHead className="text-right">Gastos Diretos</TableHead>
                      <TableHead className="text-right">Rateio</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">% Uso Real</TableHead>
                      <TableHead className="text-center">Diferença</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseSummary.partnerSummaries.map(summary => (
                      <TableRow key={summary.partner.index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{summary.partner.nome}</p>
                            {summary.partner.cpf && (
                              <p className="text-xs text-muted-foreground font-mono">{summary.partner.cpf}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{formatPercentage(summary.partner.percentage)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(summary.directExpenses)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(summary.sharedExpenses)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {formatCurrency(summary.totalExpenses)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{formatPercentage(summary.realPercentage)}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getDifferenceIndicator(summary.difference)}
                            <span className={`text-sm font-medium ${getDifferenceColor(summary.difference)}`}>
                              {summary.difference > 0 ? '+' : ''}{formatPercentage(summary.difference)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-center">100%</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(expenseSummary.totalExpenses - expenseSummary.sharedExpenses)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(expenseSummary.sharedExpenses)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-primary">
                        {formatCurrency(expenseSummary.totalExpenses)}
                      </TableCell>
                      <TableCell className="text-center">100%</TableCell>
                      <TableCell className="text-center">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fuels/Abastecimentos Table */}
          <TabsContent value="fuels" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Fuel className="h-5 w-5" />
                  Abastecimentos
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  Clique em um abastecimento para visualizar detalhes no controle de abastecimento
                </p>
              </CardHeader>
              <CardContent>
                {loadingAbastecimentos ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando abastecimentos...
                  </div>
                ) : abastecimentos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Fuel className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum abastecimento encontrado neste período</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Rota</TableHead>
                          <TableHead>Local</TableHead>
                          <TableHead className="text-right">Litros</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Sócio</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {abastecimentos.map((fuel) => (
                          <TableRow
                            key={fuel.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            <TableCell className="font-medium">
                              {format(new Date(fuel.data), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {fuel.trecho || '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {fuel.local || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {fuel.litros.toFixed(2)}L
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(fuel.valor_total)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {fuel.nome_socio || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Navegar para a página de controle de abastecimento
                                  // com o abastecimento selecionado
                                  navigate('/abastecimento', {
                                    state: {
                                      selectedAbastecimentoId: fuel.id,
                                      fromRelatorio: true,
                                      clientId: selectedClientId
                                    }
                                  });
                                }}
                                className="gap-1"
                              >
                                Ver
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
