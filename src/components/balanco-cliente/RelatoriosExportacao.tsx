import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, BarChart3, TrendingUp, Calendar, Eye, X, ArrowLeft } from 'lucide-react';
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

type InlineViewType = 'mensal' | 'despesas' | 'pendencias' | 'completo' | null;

export function RelatoriosExportacao({ clienteId, socioId, aeronaveId, periodo }: RelatoriosExportacaoProps) {
  const [gerando, setGerando] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({ tipo: null, pdfBlob: null, pdfUrl: null });
  const [inlineView, setInlineView] = useState<InlineViewType>(null);

  const { data: cliente } = useQuery({
    queryKey: ['cliente-info', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', clienteId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  const { data: socioInfo } = useQuery({
    queryKey: ['socio-info', socioId],
    queryFn: async () => {
      if (!socioId) return null;
      const { data, error } = await supabase.from('client_partners').select('*').eq('id', socioId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!socioId,
  });

  const { data: aeronaveInfo } = useQuery({
    queryKey: ['aeronave-info-relatorio', aeronaveId],
    queryFn: async () => {
      if (!aeronaveId) return null;
      const { data } = await supabase.from('aircraft').select('registration, model').eq('id', aeronaveId).single();
      return data;
    },
    enabled: !!aeronaveId,
  });

  const { data: despesas = [] } = useQuery({
    queryKey: ['despesas-relatorio', clienteId, aeronaveId, periodo, socioId],
    queryFn: async () => {
      let query = supabase
        .from('bank_reconciliations')
        .select(`*, categorias_movimentacao:categoria_movimentacao_id (nome, grupo_categoria), aircraft:aircraft_id (registration)`)
        .eq('client_id', clienteId)
        .gte('date', periodo.inicio)
        .lte('date', periodo.fim)
        .order('date', { ascending: false });
      if (aeronaveId) query = query.eq('aircraft_id', aeronaveId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  const { data: horasConsolidadas = [] } = useQuery({
    queryKey: ['horas-relatorio', clienteId, aeronaveId, periodo, socioId],
    queryFn: async () => {
      // Se há sócio específico, buscar do logbook_entries
      if (socioId) {
        // Voos do sócio
        let qOwned = supabase
          .from('logbook_entries')
          .select('entry_date, total_time, aircraft_id')
          .eq('client_id', clienteId)
          .eq('client_partner_id', socioId)
          .gte('entry_date', periodo.inicio)
          .lte('entry_date', periodo.fim);

        if (aeronaveId) {
          qOwned = qOwned.eq('aircraft_id', aeronaveId);
        }

        // Voos compartilhados
        let qShared = supabase
          .from('logbook_entries')
          .select('entry_date, total_time, aircraft_id')
          .eq('client_id', clienteId)
          .is('client_partner_id', null)
          .gte('entry_date', periodo.inicio)
          .lte('entry_date', periodo.fim);

        if (aeronaveId) {
          qShared = qShared.eq('aircraft_id', aeronaveId);
        }

        const [ownedRes, sharedRes] = await Promise.all([qOwned, qShared]);
        const ownedHoras = (ownedRes.data || []).reduce((s: number, e: any) => s + (e.total_time || 0), 0);
        const sharedHoras = (sharedRes.data || []).reduce((s: number, e: any) => s + (e.total_time || 0), 0);

        // Calcular mês a mês
        const result = [];
        const anoInicio = new Date(periodo.inicio).getFullYear();
        const mesInicio = new Date(periodo.inicio).getMonth() + 1;
        const anoFim = new Date(periodo.fim).getFullYear();
        const mesFim = new Date(periodo.fim).getMonth() + 1;

        for (let ano = anoInicio; ano <= anoFim; ano++) {
          const mIni = ano === anoInicio ? mesInicio : 1;
          const mFim = ano === anoFim ? mesFim : 12;
          for (let mes = mIni; mes <= mFim; mes++) {
            const fator = socioInfo?.share_percentage ? socioInfo.share_percentage / 100 : 0.333;
            result.push({
              ano,
              mes,
              horas_voadas: ownedHoras + (sharedHoras * fator),
              percentual_uso: 100,
              aeronave_registro: '-'
            });
          }
        }
        return result;
      }

      // Sem sócio: usar consolidadas
      let query = supabase
        .from('horas_mensais_consolidadas')
        .select('ano, mes, horas_voadas, percentual_uso, aeronave_registro')
        .eq('cliente_id', clienteId);
      if (aeronaveId) query = query.eq('aeronave_id', aeronaveId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  const { data: abastecimentos = [] } = useQuery({
    queryKey: ['abast-relatorio', clienteId, aeronaveId, periodo, socioId],
    queryFn: async () => {
      let query = supabase
        .from('abastecimentos')
        .select('data, litros, valor_total')
        .eq('client_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim);
      if (aeronaveId) query = query.eq('aeronave_id', aeronaveId);
      const { data, error } = await query;
      if (error) throw error;

      // Se há sócio, aplicar proporção
      if (socioId && data) {
        const fator = socioInfo?.share_percentage ? socioInfo.share_percentage / 100 : 0.333;
        return data.map((a: any) => ({
          ...a,
          litros: a.litros * fator,
          valor_total: a.valor_total * fator
        }));
      }
      return data || [];
    },
    enabled: !!clienteId,
  });

  const { data: despesasControle = [] } = useQuery({
    queryKey: ['despesas-controle-relatorio', clienteId, aeronaveId, periodo, socioId],
    queryFn: async () => {
      let aeronaveRegistro: string | null = null;
      if (aeronaveId) {
        const { data: a } = await supabase.from('aircraft').select('registration').eq('id', aeronaveId).single();
        aeronaveRegistro = a?.registration ?? null;
      }
      let query = supabase
        .from('vw_extrato_cliente')
        .select('data, valor, valor_total, categoria, aeronave_registro')
        .eq('cliente_id', clienteId)
        .gte('data', periodo.inicio)
        .lte('data', periodo.fim);
      if (aeronaveRegistro) query = query.eq('aeronave_registro', aeronaveRegistro);
      const { data, error } = await query;
      if (error) throw error;

      // Se há sócio, aplicar proporção
      if (socioId && data) {
        const fator = socioInfo?.share_percentage ? socioInfo.share_percentage / 100 : 0.333;
        return (data || []).map((d: any) => ({
          ...d,
          valor: d.valor ? d.valor * fator : d.valor,
          valor_total: d.valor_total ? d.valor_total * fator : d.valor_total
        }));
      }
      return data || [];
    },
    enabled: !!clienteId,
  });

  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const buildMensalData = () => {
    const anoInicio = new Date(periodo.inicio).getFullYear();
    const mesInicio = new Date(periodo.inicio).getMonth() + 1;
    const anoFim = new Date(periodo.fim).getFullYear();
    const mesFim = new Date(periodo.fim).getMonth() + 1;

    const horasFiltradas = horasConsolidadas.filter((h: any) => {
      const val = h.ano * 100 + h.mes;
      return val >= anoInicio * 100 + mesInicio && val <= anoFim * 100 + mesFim;
    });

    type MesData = { admTrip: number; hangaragem: number; manutFixa: number; combustivel: number; manutHora: number; taxasVoo: number; hoteisAlim: number; extras: number; litros: number; horasVoadas: number; };
    const mesesData: Record<number, MesData> = {};
    for (let m = 1; m <= 12; m++) {
      mesesData[m] = { admTrip: 0, hangaragem: 0, manutFixa: 0, combustivel: 0, manutHora: 0, taxasVoo: 0, hoteisAlim: 0, extras: 0, litros: 0, horasVoadas: 0 };
    }

    horasFiltradas.forEach((h: any) => { if (h.mes >= 1 && h.mes <= 12) mesesData[h.mes].horasVoadas += h.horas_voadas || 0; });
    abastecimentos.forEach((a: any) => {
      const mes = new Date(a.data).getMonth() + 1;
      if (mes >= 1 && mes <= 12) { mesesData[mes].litros += a.litros || 0; mesesData[mes].combustivel += a.valor_total || 0; }
    });
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

    return mesesData;
  };

  // Helper para obter nome exibição (cliente ou sócio)
  const getNomeExibicao = () => {
    if (socioId && socioInfo?.name) {
      return `${cliente?.company_name || cliente?.proprietario || '-'} - Sócio: ${socioInfo.name}`;
    }
    return cliente?.company_name || cliente?.proprietario || '-';
  };

  const gerarPDFMensalCompleto = (): jsPDF => {
    const ano = new Date(periodo.inicio).getFullYear();
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const nomeExibicao = getNomeExibicao();
    const aeronaveReg = aeronaveInfo?.registration || horasConsolidadas[0]?.aeronave_registro || '-';

    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('RESUMO GERAL', 148, 12, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${nomeExibicao}     ${aeronaveReg}     ${ano}`, 148, 19, { align: 'center' });

    const mesesData = buildMensalData();
    const totais = { admTrip: 0, hangaragem: 0, manutFixa: 0, combustivel: 0, manutHora: 0, taxasVoo: 0, hoteisAlim: 0, extras: 0, litros: 0, horasVoadas: 0 };
    const colunas = ['MÊS', 'ADM/TRIP.', 'HANGARAGEM', 'MANUT. FIXA', 'COMBUSTÍVEL', 'MANUT.P/HORA', 'TAXAS VOO', 'HOTÉIS/ALIM.', 'EXTRAS', 'TOTAL MÊS', 'ABST. L'];
    const linhas: any[][] = [];

    for (let m = 1; m <= 12; m++) {
      const d = mesesData[m];
      const totalMes = d.admTrip + d.hangaragem + d.manutFixa + d.combustivel + d.manutHora + d.taxasVoo + d.hoteisAlim + d.extras;
      Object.keys(totais).forEach(k => (totais as any)[k] += (d as any)[k]);
      const hasData = totalMes > 0 || d.litros > 0 || d.horasVoadas > 0;
      linhas.push([
        MESES_NOMES[m - 1],
        hasData && d.admTrip > 0 ? fmtCurrency(d.admTrip) : '', hasData && d.hangaragem > 0 ? fmtCurrency(d.hangaragem) : '',
        hasData && d.manutFixa > 0 ? fmtCurrency(d.manutFixa) : '', hasData && d.combustivel > 0 ? fmtCurrency(d.combustivel) : '',
        hasData && d.manutHora > 0 ? fmtCurrency(d.manutHora) : '', hasData && d.taxasVoo > 0 ? fmtCurrency(d.taxasVoo) : '',
        hasData && d.hoteisAlim > 0 ? fmtCurrency(d.hoteisAlim) : '', hasData && d.extras > 0 ? fmtCurrency(d.extras) : '',
        hasData && totalMes > 0 ? fmtCurrency(totalMes) : '', hasData && d.litros > 0 ? d.litros.toFixed(1) : '',
      ]);
    }

    const totalGeral = totais.admTrip + totais.hangaragem + totais.manutFixa + totais.combustivel + totais.manutHora + totais.taxasVoo + totais.hoteisAlim + totais.extras;
    const mesesComDados = Object.values(mesesData).filter(d => d.admTrip + d.hangaragem + d.manutFixa + d.combustivel + d.manutHora + d.taxasVoo + d.hoteisAlim + d.extras > 0).length || 1;

    linhas.push(['TOTAL', totais.admTrip > 0 ? fmtCurrency(totais.admTrip) : '', totais.hangaragem > 0 ? fmtCurrency(totais.hangaragem) : '', totais.manutFixa > 0 ? fmtCurrency(totais.manutFixa) : '', totais.combustivel > 0 ? fmtCurrency(totais.combustivel) : '', totais.manutHora > 0 ? fmtCurrency(totais.manutHora) : '', totais.taxasVoo > 0 ? fmtCurrency(totais.taxasVoo) : '', totais.hoteisAlim > 0 ? fmtCurrency(totais.hoteisAlim) : '', totais.extras > 0 ? fmtCurrency(totais.extras) : '', fmtCurrency(totalGeral), totais.litros > 0 ? totais.litros.toFixed(1) : '']);
    linhas.push(['MÉDIA MÊS', totais.admTrip > 0 ? fmtCurrency(totais.admTrip / mesesComDados) : '', totais.hangaragem > 0 ? fmtCurrency(totais.hangaragem / mesesComDados) : '', totais.manutFixa > 0 ? fmtCurrency(totais.manutFixa / mesesComDados) : '', totais.combustivel > 0 ? fmtCurrency(totais.combustivel / mesesComDados) : '', totais.manutHora > 0 ? fmtCurrency(totais.manutHora / mesesComDados) : '', totais.taxasVoo > 0 ? fmtCurrency(totais.taxasVoo / mesesComDados) : '', totais.hoteisAlim > 0 ? fmtCurrency(totais.hoteisAlim / mesesComDados) : '', totais.extras > 0 ? fmtCurrency(totais.extras / mesesComDados) : '', fmtCurrency(totalGeral / mesesComDados), totais.litros > 0 ? (totais.litros / mesesComDados).toFixed(1) : '']);

    autoTable(doc, {
      startY: 25, head: [colunas], body: linhas, theme: 'grid',
      headStyles: { fillColor: [139, 90, 43], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
      bodyStyles: { fontSize: 7, halign: 'right' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 25 } },
      styles: { cellPadding: 2 },
      didParseCell: (data: any) => { if (data.row.index >= 12) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = data.row.index === 12 ? [255, 235, 205] : [230, 230, 250]; } },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      const pageW = doc.internal.pageSize.getWidth(); const pageH = doc.internal.pageSize.getHeight();
      doc.text(`${nomeExibicao} | ${aeronaveReg} | Período: ${format(new Date(periodo.inicio), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim), 'dd/MM/yyyy')}`, 14, pageH - 8);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, pageW / 2, pageH - 8, { align: 'center' });
      doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 8, { align: 'right' });
    }
    return doc;
  };

  const gerarPDFDocumento = (tipo: string): jsPDF => {
    if (tipo === 'mensal') return gerarPDFMensalCompleto();
    const doc = new jsPDF();
    const nomeExibicao = getNomeExibicao();
    doc.setFontSize(20); doc.text('Balanço Cliente', 14, 20);
    doc.setFontSize(12); doc.text(`Cliente: ${nomeExibicao}`, 14, 30);
    doc.text(`Período: ${format(new Date(periodo.inicio), 'dd/MM/yyyy')} a ${format(new Date(periodo.fim), 'dd/MM/yyyy')}`, 14, 36);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 42);
    let yPos = 55;

    if (tipo === 'completo') {
      doc.setFontSize(14); doc.text('Resumo Financeiro', 14, yPos); yPos += 10;
      const pendentes = despesas.filter((d: any) => d.status === 'pendente');
      const pagos = despesas.filter((d: any) => ['pago', 'conciliado'].includes(d.status));
      const aguardando = despesas.filter((d: any) => d.status === 'aguardando_reembolso');
      autoTable(doc, { startY: yPos, head: [['Status', 'Quantidade', 'Valor Total']], body: [
        ['Pendente de Envio', pendentes.length.toString(), fmtCurrency(pendentes.reduce((s: number, d: any) => s + (d.amount || 0), 0))],
        ['Pago', pagos.length.toString(), fmtCurrency(pagos.reduce((s: number, d: any) => s + (d.amount || 0), 0))],
        ['Aguardando Reembolso', aguardando.length.toString(), fmtCurrency(aguardando.reduce((s: number, d: any) => s + (d.amount || 0), 0))],
      ], theme: 'striped', headStyles: { fillColor: [59, 130, 246] } });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    if (tipo === 'despesas' || tipo === 'completo') {
      doc.setFontSize(14); doc.text('Despesas Detalhadas', 14, yPos); yPos += 10;
      const despesasData = despesas.slice(0, 50).map((d: any) => [format(new Date(d.date), 'dd/MM/yy'), (d as any).categorias_movimentacao?.nome || '-', (d.description || '-').substring(0, 30), fmtCurrency(d.amount || 0), d.status]);
      autoTable(doc, { startY: yPos, head: [['Data', 'Categoria', 'Descrição', 'Valor', 'Status']], body: despesasData, theme: 'striped', headStyles: { fillColor: [59, 130, 246] }, styles: { fontSize: 9 } });
    }

    if (tipo === 'pendencias') {
      doc.setFontSize(14); doc.text('Pendências Financeiras', 14, yPos); yPos += 10;
      const pendencias = despesas.filter((d: any) => ['pendente', 'aguardando_reembolso'].includes(d.status));
      const pendenciasData = pendencias.map((d: any) => [format(new Date(d.date), 'dd/MM/yy'), (d as any).categorias_movimentacao?.nome || '-', (d.description || '-').substring(0, 30), fmtCurrency(d.amount || 0), d.status === 'pendente' ? 'Pend. Envio' : 'Aguard. Reembolso']);
      autoTable(doc, { startY: yPos, head: [['Data', 'Categoria', 'Descrição', 'Valor', 'Status']], body: pendenciasData.length > 0 ? pendenciasData : [['', '', 'Nenhuma pendência encontrada', '', '']], theme: 'striped', headStyles: { fillColor: [239, 68, 68] }, styles: { fontSize: 9 } });
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' }); }
    return doc;
  };

  const exportarPDF = (tipo: string) => {
    try {
      setGerando(tipo);
      const doc = gerarPDFDocumento(tipo);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPreview({ tipo, pdfBlob, pdfUrl });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGerando(null);
    }
  };

  const fazerDownloadPDF = () => {
    if (!preview.pdfBlob || !preview.tipo) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(preview.pdfBlob);
    link.download = `balanco_cliente_${preview.tipo}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    link.click();
    toast.success('Relatório baixado com sucesso!');
    setPreview({ tipo: null, pdfBlob: null, pdfUrl: null });
  };

  const fecharPreview = () => {
    if (preview.pdfUrl) URL.revokeObjectURL(preview.pdfUrl);
    setPreview({ tipo: null, pdfBlob: null, pdfUrl: null });
  };

  const relatorios = [
    { id: 'mensal' as const, titulo: 'Balanço Mensal Completo', descricao: 'Resumo Geral com custos fixos, variáveis, horas e litros', icone: Calendar },
    { id: 'despesas' as const, titulo: 'Relatório de Despesas', descricao: 'Lista detalhada de todas as despesas', icone: FileText },
    { id: 'pendencias' as const, titulo: 'Relatório de Pendências', descricao: 'Valores pendentes de envio e reembolso', icone: TrendingUp },
    { id: 'completo' as const, titulo: 'Relatório Completo', descricao: 'Todas as informações consolidadas', icone: BarChart3 },
  ];

  const renderInlineMensal = () => {
    const mesesData = buildMensalData();
    const totais = { admTrip: 0, hangaragem: 0, manutFixa: 0, combustivel: 0, manutHora: 0, taxasVoo: 0, hoteisAlim: 0, extras: 0, litros: 0, horasVoadas: 0 };
    Object.values(mesesData).forEach(d => Object.keys(totais).forEach(k => (totais as any)[k] += (d as any)[k]));

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-[10px]">
              <TableHead className="font-bold">MÊS</TableHead>
              <TableHead className="text-right text-purple-400">ADM/TRIP.</TableHead>
              <TableHead className="text-right text-blue-400">HANGAR.</TableHead>
              <TableHead className="text-right text-cyan-400">MANUT.FIXA</TableHead>
              <TableHead className="text-right text-green-400">COMBUSTÍVEL</TableHead>
              <TableHead className="text-right text-yellow-400">MANUT.P/HORA</TableHead>
              <TableHead className="text-right text-orange-400">TAXAS VOO</TableHead>
              <TableHead className="text-right text-pink-400">HOTÉIS/ALIM.</TableHead>
              <TableHead className="text-right text-red-400">EXTRAS</TableHead>
              <TableHead className="text-right text-emerald-400">ABST. L</TableHead>
              <TableHead className="text-right text-cyan-400">HORAS</TableHead>
              <TableHead className="text-right font-bold text-foreground">TOTAL R$</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
              const d = mesesData[m];
              const total = d.admTrip + d.hangaragem + d.manutFixa + d.combustivel + d.manutHora + d.taxasVoo + d.hoteisAlim + d.extras;
              const hasData = total > 0 || d.litros > 0 || d.horasVoadas > 0;
              if (!hasData) return null;
              return (
                <TableRow key={m} className="text-xs">
                  <TableCell className="font-medium">{MESES_NOMES[m - 1]}</TableCell>
                  <TableCell className="text-right">{d.admTrip > 0 ? fmtCurrency(d.admTrip) : '-'}</TableCell>
                  <TableCell className="text-right">{d.hangaragem > 0 ? fmtCurrency(d.hangaragem) : '-'}</TableCell>
                  <TableCell className="text-right">{d.manutFixa > 0 ? fmtCurrency(d.manutFixa) : '-'}</TableCell>
                  <TableCell className="text-right">{d.combustivel > 0 ? fmtCurrency(d.combustivel) : '-'}</TableCell>
                  <TableCell className="text-right">{d.manutHora > 0 ? fmtCurrency(d.manutHora) : '-'}</TableCell>
                  <TableCell className="text-right">{d.taxasVoo > 0 ? fmtCurrency(d.taxasVoo) : '-'}</TableCell>
                  <TableCell className="text-right">{d.hoteisAlim > 0 ? fmtCurrency(d.hoteisAlim) : '-'}</TableCell>
                  <TableCell className="text-right">{d.extras > 0 ? fmtCurrency(d.extras) : '-'}</TableCell>
                  <TableCell className="text-right">{d.litros > 0 ? d.litros.toFixed(0) : '-'}</TableCell>
                  <TableCell className="text-right">{d.horasVoadas > 0 ? d.horasVoadas.toFixed(1) : '-'}</TableCell>
                  <TableCell className="text-right font-bold">{total > 0 ? fmtCurrency(total) : '-'}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="text-xs font-bold border-t-2 border-primary/30 bg-primary/5">
              <TableCell>TOTAL</TableCell>
              <TableCell className="text-right">{totais.admTrip > 0 ? fmtCurrency(totais.admTrip) : '-'}</TableCell>
              <TableCell className="text-right">{totais.hangaragem > 0 ? fmtCurrency(totais.hangaragem) : '-'}</TableCell>
              <TableCell className="text-right">{totais.manutFixa > 0 ? fmtCurrency(totais.manutFixa) : '-'}</TableCell>
              <TableCell className="text-right">{totais.combustivel > 0 ? fmtCurrency(totais.combustivel) : '-'}</TableCell>
              <TableCell className="text-right">{totais.manutHora > 0 ? fmtCurrency(totais.manutHora) : '-'}</TableCell>
              <TableCell className="text-right">{totais.taxasVoo > 0 ? fmtCurrency(totais.taxasVoo) : '-'}</TableCell>
              <TableCell className="text-right">{totais.hoteisAlim > 0 ? fmtCurrency(totais.hoteisAlim) : '-'}</TableCell>
              <TableCell className="text-right">{totais.extras > 0 ? fmtCurrency(totais.extras) : '-'}</TableCell>
              <TableCell className="text-right">{totais.litros > 0 ? totais.litros.toFixed(0) : '-'}</TableCell>
              <TableCell className="text-right">{totais.horasVoadas > 0 ? totais.horasVoadas.toFixed(1) : '-'}</TableCell>
              <TableCell className="text-right">{fmtCurrency(totais.admTrip + totais.hangaragem + totais.manutFixa + totais.combustivel + totais.manutHora + totais.taxasVoo + totais.hoteisAlim + totais.extras)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderInlineDespesas = () => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead>Data</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {despesas.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma despesa encontrada</TableCell></TableRow>
          ) : despesas.map((d: any) => (
            <TableRow key={d.id} className="text-xs">
              <TableCell>{format(new Date(d.date), 'dd/MM/yyyy')}</TableCell>
              <TableCell>{d.categorias_movimentacao?.nome || '-'}</TableCell>
              <TableCell className="max-w-[250px] truncate">{d.description || '-'}</TableCell>
              <TableCell className="text-right font-medium">{fmtCurrency(d.amount || 0)}</TableCell>
              <TableCell><span className={`text-[10px] px-1.5 py-0.5 rounded ${d.status === 'pago' ? 'bg-emerald-500/10 text-emerald-400' : d.status === 'pendente' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{d.status}</span></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-2 text-right text-sm font-bold">
        Total: {fmtCurrency(despesas.reduce((s: number, d: any) => s + (d.amount || 0), 0))}
      </div>
    </div>
  );

  const renderInlinePendencias = () => {
    const pendencias = despesas.filter((d: any) => ['pendente', 'aguardando_reembolso'].includes(d.status));
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Data</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendencias.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma pendência encontrada</TableCell></TableRow>
            ) : pendencias.map((d: any) => (
              <TableRow key={d.id} className="text-xs">
                <TableCell>{format(new Date(d.date), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{(d as any).categorias_movimentacao?.nome || '-'}</TableCell>
                <TableCell className="max-w-[250px] truncate">{d.description || '-'}</TableCell>
                <TableCell className="text-right font-medium">{fmtCurrency(d.amount || 0)}</TableCell>
                <TableCell><span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">{d.status === 'pendente' ? 'Pend. Envio' : 'Aguard. Reembolso'}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pendencias.length > 0 && (
          <div className="mt-2 text-right text-sm font-bold">
            Total: {fmtCurrency(pendencias.reduce((s: number, d: any) => s + (d.amount || 0), 0))}
          </div>
        )}
      </div>
    );
  };

  if (inlineView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setInlineView(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Voltar aos relatórios
          </button>
          <Button onClick={() => exportarPDF(inlineView)} disabled={gerando !== null} size="sm">
            <Download className="h-4 w-4 mr-2" />
            {gerando ? 'Gerando...' : 'Exportar PDF'}
          </Button>
        </div>

        <Card className="border border-border/50 bg-card/80 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{relatorios.find(r => r.id === inlineView)?.titulo}</CardTitle>
            <CardDescription className="text-xs">
              {cliente?.company_name || '-'} • {aeronaveInfo?.registration || '-'} • {format(new Date(periodo.inicio), 'dd/MM/yyyy')} a {format(new Date(periodo.fim), 'dd/MM/yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inlineView === 'mensal' && renderInlineMensal()}
            {inlineView === 'despesas' && renderInlineDespesas()}
            {inlineView === 'pendencias' && renderInlinePendencias()}
            {inlineView === 'completo' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Resumo Financeiro</h3>
                  {renderInlineDespesas()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!preview.pdfUrl} onOpenChange={fecharPreview}>
          <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl">Pré-visualização do PDF</DialogTitle>
              <DialogDescription>Revise e faça o download</DialogDescription>
            </DialogHeader>
            {preview.pdfUrl && (
              <div className="flex-1 overflow-hidden bg-muted/30 rounded-lg border border-border min-h-[500px]">
                <iframe src={preview.pdfUrl} title="PDF Preview" className="w-full h-full min-h-[500px] border-none" />
              </div>
            )}
            <DialogFooter className="gap-2 border-t pt-4">
              <Button variant="outline" onClick={fecharPreview}><X className="h-4 w-4 mr-2" />Fechar</Button>
              <Button onClick={fazerDownloadPDF}><Download className="h-4 w-4 mr-2" />Fazer Download</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Relatórios e Exportação</h2>
        <p className="text-sm text-muted-foreground">
          Clique em "Visualizar" para ver a planilha no layout. Clique em "Exportar PDF" para gerar e baixar o documento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {relatorios.map((rel) => {
          const Icone = rel.icone;
          return (
            <Card key={rel.id} className="border border-border/50 bg-card/80 rounded-2xl hover:border-primary/50 transition-all">
              <CardContent className="pt-5 pb-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Icone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{rel.titulo}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{rel.descricao}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setInlineView(rel.id)} size="sm" variant="outline" className="flex-1 rounded-xl">
                      <Eye className="h-4 w-4 mr-1.5" />
                      Visualizar
                    </Button>
                    <Button onClick={() => exportarPDF(rel.id)} disabled={gerando !== null} size="sm" className="flex-1 rounded-xl">
                      <Download className="h-4 w-4 mr-1.5" />
                      {gerando === rel.id ? 'Gerando...' : 'Exportar PDF'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!preview.pdfUrl} onOpenChange={fecharPreview}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl">Pré-visualização do PDF</DialogTitle>
            <DialogDescription>Revise e faça o download</DialogDescription>
          </DialogHeader>
          {preview.pdfUrl && (
            <div className="flex-1 overflow-hidden bg-muted/30 rounded-lg border border-border min-h-[500px]">
              <iframe src={preview.pdfUrl} title="PDF Preview" className="w-full h-full min-h-[500px] border-none" />
            </div>
          )}
          <DialogFooter className="gap-2 border-t pt-4">
            <Button variant="outline" onClick={fecharPreview}><X className="h-4 w-4 mr-2" />Fechar</Button>
            <Button onClick={fazerDownloadPDF}><Download className="h-4 w-4 mr-2" />Fazer Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
