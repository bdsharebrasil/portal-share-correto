import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  Plane,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  FileDown,
  Calendar,
  Users,
  Fuel,
  Wrench,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BalancoClienteAeronaveProps {
  clienteId: string;
  aeronaveId?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export function BalancoClienteAeronave({ clienteId, aeronaveId }: BalancoClienteAeronaveProps) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState<number | null>(null); // null = ano completo
  const reportRef = useRef<HTMLDivElement>(null);

  // Dados do cliente
  const { data: cliente } = useQuery({
    queryKey: ['cliente-detalhe', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  // Aeronaves associadas ao cliente
  const { data: clienteAeronaves = [] } = useQuery({
    queryKey: ['cliente-aeronaves', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotistas_aeronave')
        .select(`
          *,
          aircraft:id_aeronave (id, registration, model, manufacturer)
        `)
        .eq('id_clientes', clienteId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Aeronave selecionada
  const { data: aeronave } = useQuery({
    queryKey: ['aeronave-detalhe', aeronaveId],
    queryFn: async () => {
      if (!aeronaveId) return null;
      const { data, error } = await supabase
        .from('aeronave')
        .select('*')
        .eq('id', aeronaveId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!aeronaveId,
  });

  // Horas voadas do cliente na aeronave
  const { data: horasVoadas = [], isLoading: loadingHoras } = useQuery({
    queryKey: ['horas-cliente-aeronave', clienteId, aeronaveId, ano, mes],
    queryFn: async () => {
      let query = supabase
        .from('logbook_entries')
        .select('*')
        .eq('clientes_id', clienteId);

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      // Filtro por ano
      const startDate = mes ? `${ano}-${String(mes).padStart(2, '0')}-01` : `${ano}-01-01`;
      const endDate = mes
        ? `${ano}-${String(mes).padStart(2, '0')}-31`
        : `${ano}-12-31`;

      query = query.gte('entry_date', startDate).lte('entry_date', endDate);

      const { data, error } = await query.order('entry_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Movimentações financeiras do cliente
  const { data: movimentacoes = [], isLoading: loadingMov } = useQuery({
    queryKey: ['movimentacoes-cliente', clienteId, aeronaveId, ano, mes],
    queryFn: async () => {
      let query = supabase
        .from('conciliacoes_bancarias')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (nome, grupo_categoria)
        `)
        .eq('clientes_id', clienteId);

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      // Filtro por data
      const startDate = mes ? `${ano}-${String(mes).padStart(2, '0')}-01` : `${ano}-01-01`;
      const endDate = mes
        ? `${ano}-${String(mes).padStart(2, '0')}-31`
        : `${ano}-12-31`;

      query = query.gte('date', startDate).lte('date', endDate);

      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Cálculos do balanço
  const totalHoras = horasVoadas.reduce((acc, entry) => acc + (entry.total_time || 0), 0);
  const totalVoos = horasVoadas.length;
  const totalPousos = horasVoadas.reduce((acc, entry) => acc + (entry.pousos || 0), 0);
  const totalCombustivel = horasVoadas.reduce((acc, entry) => acc + (entry.fuel_liters || 0), 0);

  // Tipos que representam despesas (saídas de caixa ou reembolsos a receber)
  const tiposDespesa = ['saida', 'despesa', 'cliente', 'reembolso'];
  const tiposReceita = ['entrada', 'receita', 'pagamento'];

  const despesas = movimentacoes.filter((m) => tiposDespesa.includes(m.tipo?.toLowerCase() || ''));
  const receitas = movimentacoes.filter((m) => tiposReceita.includes(m.tipo?.toLowerCase() || ''));

  const totalDespesas = despesas.reduce((acc, m) => acc + (m.valor || 0), 0);
  const totalReceitas = receitas.reduce((acc, m) => acc + (m.valor || 0), 0);
  const saldo = totalReceitas - totalDespesas;

  const despesasPendentes = movimentacoes.filter((m) => m.status === 'pendente' || m.status === 'aguardando_reembolso');
  const totalPendente = despesasPendentes.reduce((acc, m) => acc + (m.saldo_pendente || m.valor || 0), 0);

  // Dados agrupados por categoria
  const despesasPorCategoria = despesas.reduce((acc: any, m: any) => {
    const categoria = m.categorias_movimentacao?.grupo_categoria || m.categoria || 'Outros';
    acc[categoria] = (acc[categoria] || 0) + (m.valor || 0);
    return acc;
  }, {});

  const categoriaChartData = Object.entries(despesasPorCategoria).map(([name, value]) => ({
    name,
    value: value as number,
  }));

  // Dados mensais para gráfico de evolução
  const dadosMensais = Array.from({ length: 12 }, (_, i) => {
    const mesNum = i + 1;
    const horasMes = horasVoadas.filter((h) => {
      const entryMonth = new Date(h.entry_date).getMonth() + 1;
      return entryMonth === mesNum;
    });
    const despesasMes = despesas.filter((d) => {
      const despMonth = new Date(d.data).getMonth() + 1;
      return despMonth === mesNum;
    });

    return {
      mes: MESES[i].label.substring(0, 3),
      horas: horasMes.reduce((acc, h) => acc + (h.total_time || 0), 0),
      despesas: despesasMes.reduce((acc, d) => acc + (d.valor || 0), 0),
    };
  }).filter((d) => mes === null || MESES.findIndex((m) => m.label.startsWith(d.mes)) + 1 === mes);

  // Exportar PDF
  const exportarPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 64, 175);
    doc.text('Relatório de Balanço', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(
      `Cliente: ${cliente?.razao_social || cliente?.proprietario || 'N/A'}`,
      pageWidth / 2,
      30,
      { align: 'center' }
    );

    if (aeronave) {
      doc.text(`Aeronave: ${aeronave.matricula} - ${aeronave.modelo}`, pageWidth / 2, 38, {
        align: 'center',
      });
    }

    const periodoText = mes
      ? `Período: ${MESES[mes - 1].label}/${ano}`
      : `Período: Ano ${ano}`;
    doc.text(periodoText, pageWidth / 2, 46, { align: 'center' });

    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 54, {
      align: 'center',
    });

    // Resumo Operacional
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Resumo Operacional', 14, 70);

    autoTable(doc, {
      startY: 75,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Horas Voadas', `${totalHoras.toFixed(2)}h`],
        ['Total de Voos', totalVoos.toString()],
        ['Total de Pousos', totalPousos.toString()],
        ['Combustível Consumido', `${totalCombustivel.toFixed(2)} L`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Resumo Financeiro
    const finalY1 = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Resumo Financeiro', 14, finalY1);

    autoTable(doc, {
      startY: finalY1 + 5,
      head: [['Descrição', 'Valor']],
      body: [
        ['Total de Despesas', `R$ ${totalDespesas.toFixed(2)}`],
        ['Total de Receitas', `R$ ${totalReceitas.toFixed(2)}`],
        ['Saldo', `R$ ${saldo.toFixed(2)}`],
        ['Pendente de Reembolso', `R$ ${totalPendente.toFixed(2)}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
    });

    // Despesas por Categoria
    const finalY2 = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Despesas por Categoria', 14, finalY2);

    autoTable(doc, {
      startY: finalY2 + 5,
      head: [['Categoria', 'Valor']],
      body: categoriaChartData.map((c) => [c.name, `R$ ${(c.value as number).toFixed(2)}`]),
      theme: 'striped',
      headStyles: { fillColor: [249, 115, 22] },
    });

    // Últimas movimentações
    if (movimentacoes.length > 0) {
      const finalY3 = (doc as any).lastAutoTable.finalY + 10;

      if (finalY3 > 250) {
        doc.addPage();
        doc.text('Últimas Movimentações', 14, 20);
      } else {
        doc.text('Últimas Movimentações', 14, finalY3);
      }

      const startY4 = finalY3 > 250 ? 25 : finalY3 + 5;

      autoTable(doc, {
        startY: startY4,
        head: [['Data', 'Descrição', 'Tipo', 'Valor', 'Status']],
        body: movimentacoes.slice(0, 15).map((m) => [
          format(new Date(m.data), 'dd/MM/yyyy'),
          m.descricao.substring(0, 30),
          m.tipo === 'entrada' ? 'Entrada' : 'Saída',
          `R$ ${m.valor.toFixed(2)}`,
          m.status,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] },
        columnStyles: {
          1: { cellWidth: 50 },
        },
      });
    }

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(
      'Relatório gerado automaticamente',
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );

    const nomeArquivo = `balanco_${cliente?.razao_social?.replace(/\s/g, '_') || 'cliente'}_${aeronave?.matricula || 'todas'}_${ano}${mes ? `_${mes}` : ''}.pdf`;
    doc.save(nomeArquivo);
  };

  const isLoading = loadingHoras || loadingMov;

  return (
    <div className="space-y-6" ref={reportRef}>
      {/* Header com filtros */}
      <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                Balanço Completo
              </CardTitle>
              <CardDescription className="mt-1">
                {cliente?.razao_social || cliente?.proprietario || 'Cliente'}
                {aeronave && ` • ${aeronave.matricula}`}
              </CardDescription>
            </div>
            <Button onClick={exportarPDF} className="gap-2" variant="default">
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Aeronave</label>
              <Select
                value={aeronaveId || 'todas'}
                onValueChange={(val) => {
                  // Prop update should be handled by parent
                }}
                disabled
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as aeronaves</SelectItem>
                  {clienteAeronaves.map((ca: any) => (
                    <SelectItem key={ca.aeronave?.id} value={ca.aeronave?.id || ''}>
                      {ca.aeronave?.matricula} - {ca.aeronave?.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Ano</label>
              <Select value={ano.toString()} onValueChange={(val) => setAno(parseInt(val))}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i).map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Mês</label>
              <Select
                value={mes?.toString() || 'todos'}
                onValueChange={(val) => setMes(val === 'todos' ? null : parseInt(val))}
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Ano Completo</SelectItem>
                  {MESES.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Participação</label>
              <div className="h-10 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md flex items-center">
                <span className="text-sm">
                  {clienteAeronaves.find((ca: any) => ca.aeronave?.id === aeronaveId)?.percentual_sociedade || 100}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card className="border-slate-700/50 bg-slate-800/60">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-slate-700/50 bg-gradient-to-br from-blue-900/40 to-blue-950/60 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-300/70">Horas Voadas</p>
                    <p className="text-2xl font-bold text-blue-100">{totalHoras.toFixed(1)}h</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/50 bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 rounded-lg">
                    <Plane className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-300/70">Total de Voos</p>
                    <p className="text-2xl font-bold text-emerald-100">{totalVoos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/50 bg-gradient-to-br from-amber-900/40 to-amber-950/60 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Fuel className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-300/70">Combustível</p>
                    <p className="text-2xl font-bold text-amber-100">{totalCombustivel.toFixed(0)}L</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/50 bg-gradient-to-br from-purple-900/40 to-purple-950/60 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-purple-300/70">Total Despesas</p>
                    <p className="text-2xl font-bold text-purple-100">R$ {totalDespesas.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Balanço Financeiro */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Balanço Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-950/40 border border-green-800/50 rounded-lg">
                    <p className="text-xs text-green-400/70 mb-1">Receitas</p>
                    <p className="text-xl font-bold text-green-400">R$ {totalReceitas.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-lg">
                    <p className="text-xs text-red-400/70 mb-1">Despesas</p>
                    <p className="text-xl font-bold text-red-400">R$ {totalDespesas.toFixed(2)}</p>
                  </div>
                </div>

                <Separator className="bg-slate-700" />

                <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg">
                  <span className="font-medium">Saldo</span>
                  <span className={`text-xl font-bold ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    R$ {saldo.toFixed(2)}
                  </span>
                </div>

                {totalPendente > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-800/50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-300">Pendente de Reembolso</p>
                    </div>
                    <span className="font-bold text-amber-400">R$ {totalPendente.toFixed(2)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gráfico de Pizza - Despesas por Categoria */}
            <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                {categoriaChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoriaChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {categoriaChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    Sem dados disponíveis
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Evolução Mensal */}
          {mes === null && (
            <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  Evolução Mensal - {ano}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dadosMensais}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="mes" stroke="#94a3b8" />
                    <YAxis yAxisId="left" stroke="#94a3b8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) =>
                        name === 'horas' ? `${value.toFixed(1)}h` : `R$ ${value.toFixed(2)}`
                      }
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="horas" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Horas" />
                    <Bar yAxisId="right" dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela de Voos */}
          {horasVoadas.length > 0 && (
            <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plane className="h-5 w-5 text-blue-500" />
                  Últimos Voos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-300">Data</TableHead>
                        <TableHead className="text-slate-300">Trecho</TableHead>
                        <TableHead className="text-slate-300 text-right">Horas</TableHead>
                        <TableHead className="text-slate-300 text-right">Pousos</TableHead>
                        <TableHead className="text-slate-300 text-right">Combustível</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {horasVoadas.slice(0, 10).map((voo) => (
                        <TableRow key={voo.id} className="border-slate-700 hover:bg-slate-700/30">
                          <TableCell className="font-medium">
                            {format(new Date(voo.entry_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            {voo.departure_aerodrome} → {voo.arrival_aerodrome}
                          </TableCell>
                          <TableCell className="text-right">{(voo.total_time || 0).toFixed(2)}h</TableCell>
                          <TableCell className="text-right">{voo.pousos || 0}</TableCell>
                          <TableCell className="text-right">{(voo.fuel_liters || 0).toFixed(1)} L</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de Movimentações */}
          {movimentacoes.length > 0 && (
            <Card className="border-slate-700/50 bg-slate-800/60 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Movimentações Financeiras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-300">Data</TableHead>
                        <TableHead className="text-slate-300">Descrição</TableHead>
                        <TableHead className="text-slate-300">Categoria</TableHead>
                        <TableHead className="text-slate-300 text-right">Valor</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentacoes.slice(0, 15).map((mov: any) => (
                        <TableRow key={mov.id} className="border-slate-700 hover:bg-slate-700/30">
                          <TableCell className="font-medium">
                            {format(new Date(mov.data), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {mov.descricao}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {mov.categorias_movimentacao?.grupo_categoria || mov.categoria || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${mov.tipo === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                            {mov.tipo === 'entrada' ? '+' : '-'} R$ {mov.valor.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={mov.status === 'conciliado' || mov.status === 'reembolsado' ? 'default' : 'secondary'}
                              className={
                                mov.status === 'conciliado' || mov.status === 'reembolsado'
                                  ? 'bg-green-900/50 text-green-300 border-green-700'
                                  : mov.status === 'pendente'
                                    ? 'bg-amber-900/50 text-amber-300 border-amber-700'
                                    : ''
                              }
                            >
                              {mov.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}