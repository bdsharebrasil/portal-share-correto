import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, BarChart3, PieChart, TrendingUp, Calendar, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface RelatoriosExportacaoProps {
  clienteId: string;
  socioId?: string;
  aeronaveId?: string;
  periodo: { inicio: string; fim: string };
}

interface PreviewState {
  tipo: string | null;
  pdfBlob: Blob | null;
  pdfUrl: string | null;
}

const MESES_NOMES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

// Mapeia categoria/grupo para colunas do resumo geral
function mapearGrupoParaColuna(categoriaOuGrupo: string | null): string {
  if (!categoriaOuGrupo) return 'EXTRAS';

  const texto = categoriaOuGrupo.toUpperCase();

  if (texto.includes('ADM') || texto.includes('TRIP') || texto.includes('PILOT') || texto.includes('FOLHA') || texto.includes('ADMINISTRATIVO')) return 'ADM/TRIP';
  if (texto.includes('HANGAR')) return 'HANGARAGEM';
  if (texto.includes('MANUT') && (texto.includes('FIX') || texto.includes('PERIOD') || texto.includes('PREVENT'))) return 'MANUT.FIXA';
  if (texto.includes('COMBUST') || texto.includes('FUEL')) return 'COMBUSTÍVEL';
  if (texto.includes('MANUT') && (texto.includes('HORA') || texto.includes('VAR') || texto.includes('CORRET'))) return 'MANUT.P/HORA';
  if (texto.includes('TAXA') || texto.includes('AEROPORT') || texto.includes('POUSO') || texto.includes('NAVEGA')) return 'TAXAS VOO';
  if (texto.includes('HOTEL') || texto.includes('ALIM') || texto.includes('HOSPED') || texto.includes('DIÁRI')) return 'HOTÉIS/ALIM';

  return 'EXTRAS';
}

export function RelatoriosExportacao({ clienteId, aeronaveId, periodo }: RelatoriosExportacaoProps) {
  const [incluirGraficos, setIncluirGraficos] = useState(true);
  const [gerando, setGerando] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ tipo: null, pdfBlob: null, pdfUrl: null });

  // Buscar dados do cliente
  const { data: cliente } = useQuery({
    queryKey: ['cliente-info', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clienteId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  // Buscar aeronave selecionada
  const { data: aeronaveInfo } = useQuery({
    queryKey: ['aeronave-info-relatorio', aeronaveId],
    queryFn: async () => {
      if (!aeronaveId) return null;
      const { data, error } = await supabase
        .from('aircraft')
        .select('registration, model')
        .eq('id', aeronaveId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!aeronaveId,
  });

  // Buscar despesas para relatório
  const { data: despesas = [] } = useQuery({
    queryKey: ['despesas-relatorio', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select(`
          *,
          categorias_movimentacao:categoria_movimentacao_id (nome, grupo_categoria),
          aircraft:aircraft_id (registration)
        `)
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim)
        .order('date', { ascending: false });

      if (aeronaveId) {
        query = query.eq('aircraft_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Buscar horas consolidadas
  const { data: horasConsolidadas = [] } = useQuery({
    queryKey: ['horas-relatorio', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('horas_mensais_consolidadas')
        .select('ano, mes, horas_voadas, percentual_uso, aeronave_registro')
        .eq('cliente_id', clienteId);

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Buscar abastecimentos
  const { data: abastecimentos = [] } = useQuery({
    queryKey: ['abast-relatorio', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let query = supabase
        .from('abastecimentos')
        .select('data, litros, valor_total')
        .eq('client_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim);

      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Buscar despesas consolidadas do extrato do cliente (categorias reais)
  const { data: despesasControle = [] } = useQuery({
    queryKey: ['despesas-controle-relatorio', clienteId, aeronaveId, periodo],
    queryFn: async () => {
      let aeronaveRegistro: string | null = null;

      if (aeronaveId) {
        const { data: aeronaveSelecionada } = await supabase
          .from('aircraft')
          .select('registration')
          .eq('id', aeronaveId)
          .single();

        aeronaveRegistro = aeronaveSelecionada?.registration ?? null;
      }

      let query = supabase
        .from('vw_extrato_cliente')
        .select('data, valor, valor_total, categoria, aeronave_registro')
        .eq('cliente_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim);

      if (aeronaveRegistro) {
        query = query.eq('aeronave_registro', aeronaveRegistro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Gerar PDF Mensal Completo no estilo da planilha
  const gerarPDFMensalCompleto = (): jsPDF => {
    const ano = new Date(periodo.inicio).getFullYear();
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });

    const clienteNome = cliente?.company_name || cliente?.proprietario || '-';
    const aeronaveReg = aeronaveInfo?.registration || horasConsolidadas[0]?.aeronave_registro || '-';

    // CABEÇALHO
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL', 148, 12, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${clienteNome}     ${aeronaveReg}     ${ano}`, 148, 19, { align: 'center' });

    // Filtrar horas e abastecimentos pelo ano do período
    const anoInicio = new Date(periodo.inicio).getFullYear();
    const mesInicio = new Date(periodo.inicio).getMonth() + 1;
    const anoFim = new Date(periodo.fim).getFullYear();
    const mesFim = new Date(periodo.fim).getMonth() + 1;

    const horasFiltradas = horasConsolidadas.filter((h: any) => {
      const val = h.ano * 100 + h.mes;
      return val >= anoInicio * 100 + mesInicio && val <= anoFim * 100 + mesFim;
    });

    // Montar dados por mês
    type MesData = {
      admTrip: number; hangaragem: number; manutFixa: number;
      combustivel: number; manutHora: number; taxasVoo: number;
      hoteisAlim: number; extras: number; litros: number;
      horasVoadas: number; percentualUso: number;
    };

    const mesesData: Record<number, MesData> = {};
    for (let m = 1; m <= 12; m++) {
      mesesData[m] = {
        admTrip: 0, hangaragem: 0, manutFixa: 0,
        combustivel: 0, manutHora: 0, taxasVoo: 0,
        hoteisAlim: 0, extras: 0, litros: 0,
        horasVoadas: 0, percentualUso: 0,
      };
    }

    // Preencher horas
    horasFiltradas.forEach((h: any) => {
      if (h.mes >= 1 && h.mes <= 12) {
        mesesData[h.mes].horasVoadas += h.horas_voadas || 0;
        mesesData[h.mes].percentualUso = h.percentual_uso || 0;
      }
    });

    // Preencher litros de abastecimento
    abastecimentos.forEach((a: any) => {
      const mes = new Date(a.data).getMonth() + 1;
      if (mes >= 1 && mes <= 12) {
        mesesData[mes].litros += a.litros || 0;
        mesesData[mes].combustivel += a.valor_total || 0;
      }
    });

    // Preencher despesas por categoria
    despesasControle.forEach((d: any) => {
      const mes = new Date(d.data).getMonth() + 1;
      if (mes < 1 || mes > 12) return;

      const coluna = mapearGrupoParaColuna(d.categoria || '');
      const valor = Number(d.valor_total ?? d.valor ?? 0);

      switch (coluna) {
        case 'ADM/TRIP': mesesData[mes].admTrip += valor; break;
        case 'HANGARAGEM': mesesData[mes].hangaragem += valor; break;
        case 'MANUT.FIXA': mesesData[mes].manutFixa += valor; break;
        case 'COMBUSTÍVEL': mesesData[mes].combustivel += valor; break;
        case 'MANUT.P/HORA': mesesData[mes].manutHora += valor; break;
        case 'TAXAS VOO': mesesData[mes].taxasVoo += valor; break;
        case 'HOTÉIS/ALIM': mesesData[mes].hoteisAlim += valor; break;
        default: mesesData[mes].extras += valor; break;
      }
    });

    // Calcular totais
    const totais: MesData = {
      admTrip: 0, hangaragem: 0, manutFixa: 0,
      combustivel: 0, manutHora: 0, taxasVoo: 0,
      hoteisAlim: 0, extras: 0, litros: 0,
      horasVoadas: 0, percentualUso: 0,
    };

    const colunas = [
      'MÊS', 'ADM/TRIP.', 'HANGARAGEM', 'MANUT. FIXA',
      'COMBUSTÍVEL', 'MANUT.P/HORA', 'TAXAS VOO', 'HOTÉIS/ALIM.',
      'EXTRAS', 'TOTAL MÊS', 'ABST. L'
    ];

    const linhas: any[][] = [];

    for (let m = 1; m <= 12; m++) {
      const d = mesesData[m];
      const totalMes = d.admTrip + d.hangaragem + d.manutFixa + d.combustivel + d.manutHora + d.taxasVoo + d.hoteisAlim + d.extras;

      totais.admTrip += d.admTrip;
      totais.hangaragem += d.hangaragem;
      totais.manutFixa += d.manutFixa;
      totais.combustivel += d.combustivel;
      totais.manutHora += d.manutHora;
      totais.taxasVoo += d.taxasVoo;
      totais.hoteisAlim += d.hoteisAlim;
      totais.extras += d.extras;
      totais.litros += d.litros;
      totais.horasVoadas += d.horasVoadas;

      const hasData = totalMes > 0 || d.litros > 0 || d.horasVoadas > 0;

      linhas.push([
        MESES_NOMES[m - 1],
        hasData && d.admTrip > 0 ? fmtCurrency(d.admTrip) : '',
        hasData && d.hangaragem > 0 ? fmtCurrency(d.hangaragem) : '',
        hasData && d.manutFixa > 0 ? fmtCurrency(d.manutFixa) : '',
        hasData && d.combustivel > 0 ? fmtCurrency(d.combustivel) : '',
        hasData && d.manutHora > 0 ? fmtCurrency(d.manutHora) : '',
        hasData && d.taxasVoo > 0 ? fmtCurrency(d.taxasVoo) : '',
        hasData && d.hoteisAlim > 0 ? fmtCurrency(d.hoteisAlim) : '',
        hasData && d.extras > 0 ? fmtCurrency(d.extras) : '',
        hasData && totalMes > 0 ? fmtCurrency(totalMes) : '',
        hasData && d.litros > 0 ? d.litros.toFixed(1) : '',
      ]);
    }

    const totalGeral = totais.admTrip + totais.hangaragem + totais.manutFixa + totais.combustivel + totais.manutHora + totais.taxasVoo + totais.hoteisAlim + totais.extras;
    const mesesComDados = Object.values(mesesData).filter(d => 
      d.admTrip + d.hangaragem + d.manutFixa + d.combustivel + d.manutHora + d.taxasVoo + d.hoteisAlim + d.extras > 0
    ).length || 1;

    // Linha TOTAL
    linhas.push([
      'TOTAL',
      totais.admTrip > 0 ? fmtCurrency(totais.admTrip) : '',
      totais.hangaragem > 0 ? fmtCurrency(totais.hangaragem) : '',
      totais.manutFixa > 0 ? fmtCurrency(totais.manutFixa) : '',
      totais.combustivel > 0 ? fmtCurrency(totais.combustivel) : '',
      totais.manutHora > 0 ? fmtCurrency(totais.manutHora) : '',
      totais.taxasVoo > 0 ? fmtCurrency(totais.taxasVoo) : '',
      totais.hoteisAlim > 0 ? fmtCurrency(totais.hoteisAlim) : '',
      totais.extras > 0 ? fmtCurrency(totais.extras) : '',
      fmtCurrency(totalGeral),
      totais.litros > 0 ? totais.litros.toFixed(1) : '',
    ]);

    // Linha MÉDIA MÊS
    linhas.push([
      'MÉDIA MÊS',
      totais.admTrip > 0 ? fmtCurrency(totais.admTrip / mesesComDados) : '',
      totais.hangaragem > 0 ? fmtCurrency(totais.hangaragem / mesesComDados) : '',
      totais.manutFixa > 0 ? fmtCurrency(totais.manutFixa / mesesComDados) : '',
      totais.combustivel > 0 ? fmtCurrency(totais.combustivel / mesesComDados) : '',
      totais.manutHora > 0 ? fmtCurrency(totais.manutHora / mesesComDados) : '',
      totais.taxasVoo > 0 ? fmtCurrency(totais.taxasVoo / mesesComDados) : '',
      totais.hoteisAlim > 0 ? fmtCurrency(totais.hoteisAlim / mesesComDados) : '',
      totais.extras > 0 ? fmtCurrency(totais.extras / mesesComDados) : '',
      fmtCurrency(totalGeral / mesesComDados),
      totais.litros > 0 ? (totais.litros / mesesComDados).toFixed(1) : '',
    ]);

    // Tabela RESUMO GERAL
    autoTable(doc, {
      startY: 25,
      head: [colunas],
      body: linhas,
      theme: 'grid',
      headStyles: {
        fillColor: [139, 90, 43],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
      },
      bodyStyles: { fontSize: 7, halign: 'right' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 25 },
      },
      styles: { cellPadding: 2 },
      didParseCell: (data: any) => {
        // Estilizar linhas TOTAL e MÉDIA
        if (data.row.index >= 12) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = data.row.index === 12 ? [255, 235, 205] : [230, 230, 250];
        }
      },
    });

    let yPos = (doc as any).lastAutoTable.finalY + 15;

    // SEÇÃO 2 — CUSTO POR HORA
    if (totais.horasVoadas > 0) {
      if (yPos > 160) {
        doc.addPage();
        yPos = 15;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('CUSTO POR HORA VOADA', 14, yPos);
      yPos += 8;

      const custosFixos = totais.admTrip + totais.hangaragem + totais.manutFixa;
      const custosVariaveis = totais.combustivel + totais.manutHora + totais.taxasVoo + totais.hoteisAlim;

      const custoHoraData = [
        ['Custos Fixos (ADM + Hangar + Manut. Fixa)', fmtCurrency(custosFixos), `${totais.horasVoadas.toFixed(1)}h`, fmtCurrency(custosFixos / totais.horasVoadas)],
        ['Custos Variáveis (Combust. + Manut/Hora + Taxas + Hotel)', fmtCurrency(custosVariaveis), `${totais.horasVoadas.toFixed(1)}h`, fmtCurrency(custosVariaveis / totais.horasVoadas)],
        ['Custos Extras', fmtCurrency(totais.extras), `${totais.horasVoadas.toFixed(1)}h`, fmtCurrency(totais.extras / totais.horasVoadas)],
        ['TOTAL', fmtCurrency(totalGeral), `${totais.horasVoadas.toFixed(1)}h`, fmtCurrency(totalGeral / totais.horasVoadas)],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Tipo de Custo', 'Total', 'Horas', 'Custo/Hora']],
        body: custoHoraData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        didParseCell: (data: any) => {
          if (data.row.index === 3) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 240, 255];
          }
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // SEÇÃO 3 — Horas voadas por mês
    if (yPos > 160) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('HORAS VOADAS POR MÊS', 14, yPos);
    yPos += 8;

    const horasLinhas = [];
    for (let m = 1; m <= 12; m++) {
      const d = mesesData[m];
      if (d.horasVoadas > 0) {
        const h = Math.floor(d.horasVoadas);
        const min = Math.round((d.horasVoadas - h) * 60);
        horasLinhas.push([
          MESES_NOMES[m - 1],
          `${h}h${min.toString().padStart(2, '0')}min`,
          d.horasVoadas.toFixed(2),
          `${d.percentualUso.toFixed(1)}%`,
          d.litros > 0 ? d.litros.toFixed(1) : '-',
          d.horasVoadas > 0 && d.litros > 0 ? (d.litros / d.horasVoadas).toFixed(1) : '-',
        ]);
      }
    }

    if (horasLinhas.length > 0) {
      const hTotal = Math.floor(totais.horasVoadas);
      const mTotal = Math.round((totais.horasVoadas - hTotal) * 60);
      horasLinhas.push([
        'TOTAL',
        `${hTotal}h${mTotal.toString().padStart(2, '0')}min`,
        totais.horasVoadas.toFixed(2),
        '-',
        totais.litros > 0 ? totais.litros.toFixed(1) : '-',
        totais.horasVoadas > 0 && totais.litros > 0 ? (totais.litros / totais.horasVoadas).toFixed(1) : '-',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Mês', 'Horas (HH:MM)', 'Decimal', '% Uso', 'Litros', 'L/Hora']],
        body: horasLinhas,
        theme: 'striped',
        headStyles: { fillColor: [34, 139, 34], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        didParseCell: (data: any) => {
          if (data.row.index === horasLinhas.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 255, 220];
          }
        },
      });
    }

    // RODAPÉ em todas as páginas
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      doc.text(`${clienteNome} | ${aeronaveReg} | Período: ${format(new Date(periodo.inicio), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim), 'dd/MM/yyyy')}`, 14, pageH - 8);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, pageW / 2, pageH - 8, { align: 'center' });
      doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' });
    }

    return doc;
  };

  // Função para gerar PDF de despesas e pendências
  const gerarPDFDocumento = (tipo: string): jsPDF => {
    if (tipo === 'mensal') {
      return gerarPDFMensalCompleto();
    }

    const doc = new jsPDF();
    const clienteNome = cliente?.company_name || cliente?.proprietario || '-';

    // Cabeçalho
    doc.setFontSize(20);
    doc.text('Balanço Cliente', 14, 20);
    doc.setFontSize(12);
    doc.text(`Cliente: ${clienteNome}`, 14, 30);
    doc.text(`Período: ${format(new Date(periodo.inicio), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim), 'dd/MM/yyyy')}`, 14, 36);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 42);

    let yPos = 55;

    if (tipo === 'completo') {
      // Resumo financeiro
      doc.setFontSize(14);
      doc.text('Resumo Financeiro', 14, yPos);
      yPos += 10;

      const pendentes = despesas.filter((d: any) => d.status === 'pendente');
      const pagos = despesas.filter((d: any) => ['pago', 'conciliado'].includes(d.status));
      const aguardando = despesas.filter((d: any) => d.status === 'aguardando_reembolso');

      autoTable(doc, {
        startY: yPos,
        head: [['Status', 'Quantidade', 'Valor Total']],
        body: [
          ['Pendente de Envio', pendentes.length.toString(), fmtCurrency(pendentes.reduce((s: number, d: any) => s + (d.amount || 0), 0))],
          ['Pago', pagos.length.toString(), fmtCurrency(pagos.reduce((s: number, d: any) => s + (d.amount || 0), 0))],
          ['Aguardando Reembolso', aguardando.length.toString(), fmtCurrency(aguardando.reduce((s: number, d: any) => s + (d.amount || 0), 0))],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    if (tipo === 'despesas' || tipo === 'completo') {
      doc.setFontSize(14);
      doc.text('Despesas Detalhadas', 14, yPos);
      yPos += 10;

      const despesasData = despesas.slice(0, 50).map((d: any) => [
        format(new Date(d.date), 'dd/MM/yy'),
        (d as any).categorias_movimentacao?.nome || '-',
        (d.description || '-').substring(0, 30),
        fmtCurrency(d.amount || 0),
        d.status
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Data', 'Categoria', 'Descrição', 'Valor', 'Status']],
        body: despesasData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 },
      });
    }

    if (tipo === 'pendencias') {
      doc.setFontSize(14);
      doc.text('Pendências Financeiras', 14, yPos);
      yPos += 10;

      const pendencias = despesas.filter((d: any) => ['pendente', 'aguardando_reembolso'].includes(d.status));
      const pendenciasData = pendencias.map((d: any) => [
        format(new Date(d.date), 'dd/MM/yy'),
        (d as any).categorias_movimentacao?.nome || '-',
        (d.description || '-').substring(0, 30),
        fmtCurrency(d.amount || 0),
        d.status === 'pendente' ? 'Pend. Envio' : 'Aguard. Reembolso'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Data', 'Categoria', 'Descrição', 'Valor', 'Status']],
        body: pendenciasData.length > 0 ? pendenciasData : [['', '', 'Nenhuma pendência encontrada', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] },
        styles: { fontSize: 9 },
      });
    }

    // Rodapé
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    return doc;
  };

  // Gerar prévia do PDF
  const visualizarPDF = async (tipo: string) => {
    try {
      setGerando(tipo);
      const doc = gerarPDFDocumento(tipo);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPreview({ tipo, pdfBlob, pdfUrl });
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
      toast.error('Erro ao gerar prévia do PDF');
    } finally {
      setGerando(null);
    }
  };

  const fazerDownloadPDF = (tipo: string, pdfBlob: Blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(pdfBlob);
    link.download = `balanco_cliente_${tipo}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    link.click();
    toast.success('Relatório baixado com sucesso!');
    setPreview({ tipo: null, pdfBlob: null, pdfUrl: null });
  };

  const fecharPreview = () => {
    if (preview.pdfUrl) URL.revokeObjectURL(preview.pdfUrl);
    setPreview({ tipo: null, pdfBlob: null, pdfUrl: null });
  };

  const relatorios = [
    {
      id: 'mensal',
      titulo: 'Balanço Mensal Completo',
      descricao: 'Resumo Geral estilo planilha Share Brasil com custos fixos, variáveis, horas e litros',
      icone: Calendar,
    },
    {
      id: 'despesas',
      titulo: 'Relatório de Despesas',
      descricao: 'Lista detalhada de todas as despesas',
      icone: FileText,
    },
    {
      id: 'pendencias',
      titulo: 'Relatório de Pendências',
      descricao: 'Valores pendentes de envio e reembolso',
      icone: TrendingUp,
    },
    {
      id: 'completo',
      titulo: 'Relatório Completo',
      descricao: 'Todas as informações consolidadas',
      icone: BarChart3,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Opções de Exportação */}
      <Card className="border-border/50 bg-card/60">
        <CardHeader>
          <CardTitle className="text-lg">Opções de Exportação</CardTitle>
          <CardDescription>Configure as opções do relatório</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="graficos" 
              checked={incluirGraficos}
              onCheckedChange={(checked) => setIncluirGraficos(checked as boolean)}
            />
            <Label htmlFor="graficos">Incluir gráficos no PDF</Label>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Relatórios */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {relatorios.map((rel) => {
          const Icone = rel.icone;
          return (
            <Card key={rel.id} className="border-border/50 bg-card/60 hover:border-primary/50 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Icone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{rel.titulo}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{rel.descricao}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => visualizarPDF(rel.id)}
                    disabled={gerando !== null}
                    size="sm"
                    variant="outline"
                  >
                    {gerando === rel.id ? (
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Visualizar
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de Prévia do PDF */}
      <Dialog open={!!preview.pdfUrl} onOpenChange={fecharPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prévia do Relatório</DialogTitle>
            <DialogDescription>
              Verifique a prévia do PDF antes de fazer download
            </DialogDescription>
          </DialogHeader>

          {preview.pdfUrl && (
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden border border-border">
              <iframe
                src={preview.pdfUrl}
                title="PDF Preview"
                className="w-full h-[500px] border-none"
                style={{ minHeight: '500px' }}
              />
            </div>
          )}

          <DialogFooter className="gap-2 flex justify-end">
            <Button variant="outline" onClick={fecharPreview}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (preview.pdfBlob && preview.tipo) {
                  fazerDownloadPDF(preview.tipo, preview.pdfBlob);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download do PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-medium text-blue-500">Sobre os Relatórios</p>
              <p className="text-sm text-muted-foreground mt-1">
                O "Balanço Mensal Completo" gera um PDF no estilo da planilha Share Brasil com custos fixos, 
                variáveis, horas voadas e litros de combustível mês a mês, incluindo totais e médias.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
