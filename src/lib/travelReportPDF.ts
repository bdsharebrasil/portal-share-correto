// Adicione esta função ao arquivo src/lib/travelReportPDF.ts

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import type { SupabaseClient } from '@supabase/supabase-js';

// ... (mantenha as interfaces e funções existentes)

/**
 * Gera o PDF e faz upload para o Supabase Storage
 * Retorna a URL pública do PDF salvo
 */
export async function uploadPDFToStorage(
  report: TravelReport,
  supabase: SupabaseClient,
  userName: string = 'Sistema'
): Promise<string> {
  // Gerar o PDF
  const doc = generatePDFDocument(report, userName);

  // Converter para Blob
  const pdfBlob = doc.output('blob');

  // Nome do arquivo
  const fileName = `${report.numero.replace(/\//g, '-')}-${Date.now()}.pdf`;
  const filePath = `reports/${fileName}`;

  // Upload para o Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('travel-reports')
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
  }

  // Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('travel-reports')
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Função auxiliar que gera o documento PDF (sem abrir/baixar)
 * Retorna o objeto jsPDF para ser usado em outras funções
 */
function generatePDFDocument(report: TravelReport, userName: string = 'Sistema'): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Logo e Cabeçalho
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SHAREBRASIL AVIAÇÃO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(16);
  doc.text('RELATÓRIO DE VIAGEM', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Número do Relatório
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Relatório: ${report.numero}`, 14, yPos);
  yPos += 8;

  // Informações Principais
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const infoLines = [
    `Cliente: ${report.cliente_nome}`,
    `Aeronave: ${report.aeronave}`,
    `Tripulante 1: ${report.tripulante}`,
  ];

  if (report.tripulante2) {
    infoLines.push(`Tripulante 2: ${report.tripulante2}`);
  }

  infoLines.push(
    `Trecho: ${report.trecho}`,
    `Período: ${formatDate(report.data_inicio)} a ${formatDate(report.data_fim)}`
  );

  infoLines.forEach(line => {
    doc.text(line, 14, yPos);
    yPos += 6;
  });

  yPos += 5;

  // Tabela de Despesas
  const tableData = report.despesas.map((d, idx) => [
    (idx + 1).toString(),
    d.categoria,
    d.descricao || '-',
    formatCurrency(d.valor),
    d.pago_por || '-',
    d.comprovante_url ? '✓' : '✗'
  ]);

  (doc as any).autoTable({
    startY: yPos,
    head: [['#', 'Categoria', 'Descrição', 'Valor', 'Pago Por', 'Comprovante']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 30 },
      2: { cellWidth: 60 },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 30 },
      5: { cellWidth: 20, halign: 'center' }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Totais por Categoria
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAIS POR CATEGORIA', 14, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const categoryTotals = [
    ['Combustível:', formatCurrency(report.total_combustivel)],
    ['Hospedagem:', formatCurrency(report.total_hospedagem)],
    ['Alimentação:', formatCurrency(report.total_alimentacao)],
    ['Transporte:', formatCurrency(report.total_transporte)],
    ['Outros:', formatCurrency(report.total_outros)]
  ];

  categoryTotals.forEach(([label, value]) => {
    doc.text(label, 14, yPos);
    doc.text(value, 80, yPos, { align: 'right' });
    yPos += 6;
  });

  yPos += 5;

  // Totais por Pagador
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAIS POR PAGADOR', 14, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const payerTotals = [];

  if (report.total_tripulante1 && report.total_tripulante1 > 0) {
    payerTotals.push([`Tripulante 1 (${report.tripulante}):`, formatCurrency(report.total_tripulante1)]);
  }

  if (report.total_tripulante2 && report.total_tripulante2 > 0 && report.tripulante2) {
    payerTotals.push([`Tripulante 2 (${report.tripulante2}):`, formatCurrency(report.total_tripulante2)]);
  }

  if (report.total_tripulante > 0 && !report.total_tripulante1) {
    // Compatibilidade com versão antiga
    payerTotals.push(['Tripulante(s):', formatCurrency(report.total_tripulante)]);
  }

  payerTotals.push(
    ['Cliente:', formatCurrency(report.total_cliente)],
    ['ShareBrasil:', formatCurrency(report.total_sharebrasil)]
  );

  payerTotals.forEach(([label, value]) => {
    doc.text(label, 14, yPos);
    doc.text(value, 80, yPos, { align: 'right' });
    yPos += 6;
  });

  // Valor Total
  yPos += 3;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, 80, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('VALOR TOTAL:', 14, yPos);
  doc.text(formatCurrency(report.valor_total), 80, yPos, { align: 'right' });

  // Observações
  if (report.observacoes && report.observacoes.trim()) {
    yPos += 12;
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('OBSERVAÇÕES:', 14, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(report.observacoes, pageWidth - 28);
    doc.text(obsLines, 14, yPos);
  }

  // Rodapé
  const footerY = pageHeight - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} por ${userName}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  return doc;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}