import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Fuel, Wrench, Building2, TrendingUp, TrendingDown, Scale,
  DollarSign, Users, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

interface CentroCustoProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

type TipoCusto = 'variavel' | 'manutencao' | 'fixo';

interface CategoriaClassificacao {
  nome: string;
  tipo: TipoCusto;
  formaRateio: 'horas' | 'igualitario';
}

// Classificação de categorias por tipo de custo
const CLASSIFICACAO_CATEGORIAS: Record<string, CategoriaClassificacao> = {
  'COMBUSTIVEL': { nome: 'COMBUSTÍVEL', tipo: 'variavel', formaRateio: 'horas' },
  'ABASTECIMENTO': { nome: 'ABASTECIMENTO', tipo: 'variavel', formaRateio: 'horas' },
  'TAXAS_AEROPORTUARIAS': { nome: 'TAXAS AEROPORTUÁRIAS', tipo: 'variavel', formaRateio: 'horas' },
  'TAXAS AEROPORTUÁRIAS': { nome: 'TAXAS AEROPORTUÁRIAS', tipo: 'variavel', formaRateio: 'horas' },
  'ATENDIMENTO_PISTA': { nome: 'ATENDIMENTO DE PISTA', tipo: 'variavel', formaRateio: 'horas' },
  'RELATORIOS_VOO': { nome: 'RELATÓRIOS DE VOO', tipo: 'variavel', formaRateio: 'horas' },
  'SERVIÇOS DE RAMPA / DIARIA HANGAR': { nome: 'SERVIÇOS DE RAMPA / DIÁRIA HANGAR', tipo: 'variavel', formaRateio: 'horas' },
  'SERVIÇOS_DE_RAMPA_/_DIARIA_HANGAR': { nome: 'SERVIÇOS DE RAMPA / DIÁRIA HANGAR', tipo: 'variavel', formaRateio: 'horas' },
  'OFICINA': { nome: 'OFICINA', tipo: 'manutencao', formaRateio: 'horas' },
  'PECAS': { nome: 'PEÇAS', tipo: 'manutencao', formaRateio: 'horas' },
  'MAO_DE_OBRA': { nome: 'MÃO DE OBRA', tipo: 'manutencao', formaRateio: 'horas' },
  'MANUTENCAO': { nome: 'MANUTENÇÃO', tipo: 'manutencao', formaRateio: 'horas' },
  'HANGAR': { nome: 'HANGAR', tipo: 'fixo', formaRateio: 'igualitario' },
  'SEGURO': { nome: 'SEGURO', tipo: 'fixo', formaRateio: 'igualitario' },
  'ADMINISTRACAO': { nome: 'ADMINISTRAÇÃO', tipo: 'fixo', formaRateio: 'igualitario' },
  'PILOTO': { nome: 'PILOTO', tipo: 'fixo', formaRateio: 'igualitario' },
  'TRIPULACAO': { nome: 'TRIPULAÇÃO', tipo: 'fixo', formaRateio: 'igualitario' },
  'DESPESAS AERONAVE': { nome: 'DESPESAS AERONAVE', tipo: 'fixo', formaRateio: 'igualitario' },
  'DESPESAS_AERONAVE': { nome: 'DESPESAS AERONAVE', tipo: 'fixo', formaRateio: 'igualitario' },
  'DESPESAS BANCARIAS': { nome: 'DESPESAS BANCÁRIAS', tipo: 'fixo', formaRateio: 'igualitario' },
  'DESPESAS_BANCARIAS': { nome: 'DESPESAS BANCÁRIAS', tipo: 'fixo', formaRateio: 'igualitario' },
};

function classificarCategoria(categoriaNome: string): CategoriaClassificacao {
  const upper = categoriaNome?.toUpperCase().trim() || '';
  // Direct match first (handles space-separated names like "DESPESAS AERONAVE")
  if (CLASSIFICACAO_CATEGORIAS[upper]) return CLASSIFICACAO_CATEGORIAS[upper];
  // Try underscore version
  const key = upper.replace(/\s+/g, '_');
  if (CLASSIFICACAO_CATEGORIAS[key]) return CLASSIFICACAO_CATEGORIAS[key];
  // Partial match
  for (const [k, v] of Object.entries(CLASSIFICACAO_CATEGORIAS)) {
    if (upper.includes(k) || k.includes(upper)) return v;
  }
  return { nome: upper || 'OUTROS', tipo: 'fixo', formaRateio: 'igualitario' };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCategoriaNome(nome: string): string {
  return (nome || '').toUpperCase().replace(/_/g, ' ');
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
  'hsl(160, 60%, 45%)',
  'hsl(30, 80%, 55%)',
];

export function CentroCusto({ clienteId, aeronaveId, periodo, socioId }: CentroCustoProps) {
  const [tipoCustoFiltro, setTipoCustoFiltro] = useState<'todos' | TipoCusto>('todos');
  const [subTab, setSubTab] = useState('resumo');

  // 1. Fetch rateio_despesas
  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ['centro-custo-despesas', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = (supabase as any)
        .from('rateio_despesas')
        .select('*')
        .eq('clientes_id', clienteId)
        .gte('data_envio', periodo.inicio)
        .lte('data_envio', periodo.fim);

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query.order('data_envio', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // 2. Fetch all partners for this client
  const { data: socios = [] } = useQuery({
    queryKey: ['centro-custo-socios', clienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('partner_accounts')
        .select('id, partner_name, ownership_percentage, client_partner_id')
        .eq('clientes_id', clienteId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // 3. Process & classify
  const despesasClassificadas = useMemo(() => {
    return despesas.map((d: any) => {
      const catNome = d.categoria_custo || d.descricao_despesa || d.fonte_despesa || '';
      const classificacao = classificarCategoria(catNome);
      // Use periodicidade field to refine classification
      const periodicidade = (d.periodicidade || '').toUpperCase();
      let tipoFinal = classificacao.tipo;
      let formaRateioFinal = classificacao.formaRateio;
      if (periodicidade.includes('VARIAVEL POR VOO') || periodicidade.includes('VARIAVEL POR HORA')) {
        tipoFinal = 'variavel';
        formaRateioFinal = 'horas';
      } else if (periodicidade === 'MENSAL' || periodicidade === 'EXTRA') {
        // Keep from classification or default to fixo
      }
      return {
        ...d,
        categoria_nome_formatada: formatCategoriaNome(catNome),
        tipo_custo: tipoFinal,
        forma_rateio: formaRateioFinal,
      };
    });
  }, [despesas]);

  // 4. Filter
  const despesasFiltradas = useMemo(() => {
    if (tipoCustoFiltro === 'todos') return despesasClassificadas;
    return despesasClassificadas.filter((d: any) => d.tipo_custo === tipoCustoFiltro);
  }, [despesasClassificadas, tipoCustoFiltro]);

  // 5. Aggregate by type
  const resumoPorTipo = useMemo(() => {
    const r = { variavel: 0, manutencao: 0, fixo: 0 };
    despesasClassificadas.forEach((d: any) => {
      r[d.tipo_custo as TipoCusto] += Number(d.valor_rateado_por_uso) || 0;
    });
    return r;
  }, [despesasClassificadas]);

  const totalGeral = resumoPorTipo.variavel + resumoPorTipo.manutencao + resumoPorTipo.fixo;

  // 6. Aggregate by category
  const resumoPorCategoria = useMemo(() => {
    const map = new Map<string, { nome: string; tipo: TipoCusto; total: number; count: number }>();
    despesasClassificadas.forEach((d: any) => {
      const key = d.categoria_nome_formatada;
      const existing = map.get(key) || { nome: key, tipo: d.tipo_custo, total: 0, count: 0 };
      existing.total += Number(d.valor_rateado_por_uso) || 0;
      existing.count += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [despesasClassificadas]);

  // 7. Aggregate by partner (sócio)
  const resumoPorSocio = useMemo(() => {
    const map = new Map<string, {
      nome: string;
      totalDevido: number;
      totalPago: number;
      saldo: number;
      porTipo: { variavel: number; manutencao: number; fixo: number };
    }>();

    despesasClassificadas.forEach((d: any) => {
      const nome = d.nome_socio || d.client_name || 'Sem sócio';
      const existing = map.get(nome) || {
        nome,
        totalDevido: 0,
        totalPago: 0,
        saldo: 0,
        porTipo: { variavel: 0, manutencao: 0, fixo: 0 },
      };

      const valorDevido = Number(d.valor_rateado_por_uso) || 0;
      const valorPago = Number(d.valor_pago_real) || 0;

      existing.totalDevido += valorDevido;
      existing.totalPago += valorPago;
      existing.porTipo[d.tipo_custo as TipoCusto] += valorDevido;
      existing.saldo = existing.totalPago - existing.totalDevido;

      map.set(nome, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalDevido - a.totalDevido);
  }, [despesasClassificadas]);

  // Chart data
  const pieData = [
    { name: 'Variáveis', value: resumoPorTipo.variavel },
    { name: 'Manutenção', value: resumoPorTipo.manutencao },
    { name: 'Fixos', value: resumoPorTipo.fixo },
  ].filter(d => d.value > 0);

  const barDataCategoria = resumoPorCategoria.slice(0, 8).map((c, i) => ({
    nome: c.nome.length > 15 ? c.nome.substring(0, 15) + '...' : c.nome,
    valor: c.total,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (isLoading) {
    return (
      <Card className="border border-border/50 bg-card/60 rounded-2xl">
        <CardContent className="pt-6 text-center text-muted-foreground">
          Carregando centro de custo...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/50 bg-card/80 backdrop-blur-sm rounded-2xl">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Geral</p>
                <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalGeral)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/15">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 backdrop-blur-sm rounded-2xl cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setTipoCustoFiltro(tipoCustoFiltro === 'variavel' ? 'todos' : 'variavel')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custos Variáveis</p>
                <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(resumoPorTipo.variavel)}</p>
                <p className="text-xs text-muted-foreground">Rateio por horas</p>
              </div>
              <div className="p-2.5 rounded-xl bg-chart-2/15">
                <Fuel className="h-5 w-5 text-chart-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 backdrop-blur-sm rounded-2xl cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setTipoCustoFiltro(tipoCustoFiltro === 'manutencao' ? 'todos' : 'manutencao')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Manutenção</p>
                <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(resumoPorTipo.manutencao)}</p>
                <p className="text-xs text-muted-foreground">Por horas ou igual</p>
              </div>
              <div className="p-2.5 rounded-xl bg-chart-3/15">
                <Wrench className="h-5 w-5 text-chart-3" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/50 bg-card/80 backdrop-blur-sm rounded-2xl cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => setTipoCustoFiltro(tipoCustoFiltro === 'fixo' ? 'todos' : 'fixo')}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custos Fixos</p>
                <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(resumoPorTipo.fixo)}</p>
                <p className="text-xs text-muted-foreground">Rateio igualitário</p>
              </div>
              <div className="p-2.5 rounded-xl bg-chart-4/15">
                <Building2 className="h-5 w-5 text-chart-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter badge */}
      {tipoCustoFiltro !== 'todos' && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm cursor-pointer" onClick={() => setTipoCustoFiltro('todos')}>
            Filtrando: {tipoCustoFiltro === 'variavel' ? 'Custos Variáveis' : tipoCustoFiltro === 'manutencao' ? 'Manutenção' : 'Custos Fixos'}
            <span className="ml-2">✕</span>
          </Badge>
        </div>
      )}

      {/* Sub tabs */}
      <Tabs value={subTab} onValueChange={setSubTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-border/60 rounded-xl p-1 h-auto">
          <TabsTrigger value="resumo" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm px-4 py-2">
            Resumo
          </TabsTrigger>
          <TabsTrigger value="socios" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm px-4 py-2">
            <Users className="h-4 w-4 mr-1.5" />
            Sócios
          </TabsTrigger>
          <TabsTrigger value="detalhado" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm px-4 py-2">
            Detalhado
          </TabsTrigger>
        </TabsList>

        {/* Resumo Tab */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <Card className="border border-border/50 bg-card/80 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Sem dados no período</p>
                )}
              </CardContent>
            </Card>

            {/* Bar Chart by Category */}
            <Card className="border border-border/50 bg-card/80 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {barDataCategoria.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barDataCategoria} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                        {barDataCategoria.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Sem dados no período</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category breakdown table */}
          <Card className="border border-border/50 bg-card/80 rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhamento por Categoria</CardTitle>
              <CardDescription className="text-xs">O que foi gasto e como é dividido</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Forma de Rateio</TableHead>
                    <TableHead className="text-right">Lançamentos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">% do Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumoPorCategoria.filter(c =>
                    tipoCustoFiltro === 'todos' || c.tipo === tipoCustoFiltro
                  ).map((cat) => (
                    <TableRow key={cat.nome}>
                      <TableCell className="font-medium">{cat.nome}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {cat.tipo === 'variavel' ? '✈️ Variável' : cat.tipo === 'manutencao' ? '🔧 Manutenção' : '📊 Fixo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cat.tipo === 'variavel' ? 'Por horas' : cat.tipo === 'fixo' ? 'Igualitário' : 'Por horas/Igual'}
                      </TableCell>
                      <TableCell className="text-right">{cat.count}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(cat.total)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {totalGeral > 0 ? ((cat.total / totalGeral) * 100).toFixed(1) + '%' : '0%'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sócios Tab */}
        <TabsContent value="socios" className="space-y-6">
          {/* Saldo entre sócios */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {resumoPorSocio.map((socio) => (
              <Card key={socio.nome} className="border border-border/50 bg-card/80 rounded-2xl">
                <CardContent className="pt-5 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">{socio.nome}</h3>
                    {socio.saldo > 0 ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                        <ArrowUpRight className="h-3 w-3 mr-1" />Crédito
                      </Badge>
                    ) : socio.saldo < 0 ? (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs">
                        <ArrowDownRight className="h-3 w-3 mr-1" />Débito
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <Minus className="h-3 w-3 mr-1" />Zerado
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Deve</p>
                      <p className="font-semibold text-foreground">{formatCurrency(socio.totalDevido)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Pagou</p>
                      <p className="font-semibold text-foreground">{formatCurrency(socio.totalPago)}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Saldo</span>
                      <span className={`text-sm font-bold ${socio.saldo >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                        {formatCurrency(Math.abs(socio.saldo))}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown by type */}
                  <div className="grid grid-cols-3 gap-1 text-[10px] pt-1">
                    <div className="text-center p-1.5 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground">Variável</p>
                      <p className="font-medium">{formatCurrency(socio.porTipo.variavel)}</p>
                    </div>
                    <div className="text-center p-1.5 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground">Manutenção</p>
                      <p className="font-medium">{formatCurrency(socio.porTipo.manutencao)}</p>
                    </div>
                    <div className="text-center p-1.5 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground">Fixo</p>
                      <p className="font-medium">{formatCurrency(socio.porTipo.fixo)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {resumoPorSocio.length === 0 && (
            <Card className="border border-border/50 bg-card/60 rounded-2xl">
              <CardContent className="pt-6 text-center text-muted-foreground">
                Nenhum dado de rateio encontrado no período
              </CardContent>
            </Card>
          )}

          {/* Comparison table */}
          {resumoPorSocio.length > 0 && (
            <Card className="border border-border/50 bg-card/80 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  Balanço entre Sócios
                </CardTitle>
                <CardDescription className="text-xs">Quem deve pagar vs quem realmente pagou</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sócio</TableHead>
                      <TableHead className="text-right">Deve Pagar</TableHead>
                      <TableHead className="text-right">Já Pagou</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoPorSocio.map((socio) => (
                      <TableRow key={socio.nome}>
                        <TableCell className="font-medium">{socio.nome}</TableCell>
                        <TableCell className="text-right">{formatCurrency(socio.totalDevido)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(socio.totalPago)}</TableCell>
                        <TableCell className={`text-right font-semibold ${socio.saldo >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                          {socio.saldo >= 0 ? '+' : ''}{formatCurrency(socio.saldo)}
                        </TableCell>
                        <TableCell>
                          {socio.saldo > 0 ? (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Crédito</Badge>
                          ) : socio.saldo < 0 ? (
                            <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-xs">Débito</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Zerado</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Detalhado Tab */}
        <TabsContent value="detalhado" className="space-y-4">
          <Card className="border border-border/50 bg-card/80 rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Lançamentos Detalhados</CardTitle>
              <CardDescription className="text-xs">
                {despesasFiltradas.length} lançamento(s) — Total: {formatCurrency(
                  despesasFiltradas.reduce((s: number, d: any) => s + (Number(d.valor_rateado_por_uso) || 0), 0)
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[90px]">Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Sócio</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Valor Rateado</TableHead>
                      <TableHead className="text-right">Valor Pago</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despesasFiltradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhum lançamento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      despesasFiltradas.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs">
                            {d.data_pagamento ? format(new Date(d.data_pagamento), 'dd/MM/yy', { locale: ptBR }) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {d.tipo_custo === 'variavel' ? '✈️' : d.tipo_custo === 'manutencao' ? '🔧' : '📊'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{d.categoria_nome_formatada}</TableCell>
                          <TableCell className="text-xs">{d.nome_socio || d.client_name}</TableCell>
                          <TableCell className="text-right text-xs">
                            {d.forma_rateio === 'horas'
                              ? `${(d.percentual_voo || d.percentual || 0).toFixed(1)}%`
                              : `${(d.percentual || 0).toFixed(1)}%`
                            }
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium">{formatCurrency(Number(d.valor_rateado_por_uso) || 0)}</TableCell>
                          <TableCell className="text-right text-xs">{formatCurrency(Number(d.valor_pago_real) || 0)}</TableCell>
                          <TableCell>
                            {d.pago_diretamente ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Sim</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Não</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={d.status === 'pago' ? 'default' : 'secondary'} className="text-[10px]">
                              {(d.status || 'pendente').toUpperCase()}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
