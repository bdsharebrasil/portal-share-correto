// src/lib/travelReportPDF.ts

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SupabaseClient } from '@supabase/supabase-js';

// =========================================================================
// INTERFACES (Definições simplificadas - ajuste com seus tipos reais)
// =========================================================================

export interface TravelExpense {
  id: string;
  categoria: 'Combustível' | 'Hospedagem' | 'Alimentação' | 'Transporte' | 'Outros';
  descricao: string | null;
  valor: number;
  pago_por: string | null; // Ex: 'Tripulante 1', 'Cliente', 'ShareBrasil'
  comprovante_url: string | null;
}

export interface TravelReport {
  id: string;
  numero: string;
  cliente_nome: string;
  aeronave: string;
  tripulante: string; // Nome do Tripulante 1
  tripulante2: string | null; // Nome do Tripulante 2
  trecho: string;
  data_inicio: string; // ISO Date string
  data_fim: string; // ISO Date string
  observacoes: string | null;

  // Despesas
  despesas: TravelExpense[];

  // Totais
  total_combustivel: number;
  total_hospedagem: number;
  total_alimentacao: number;
  total_transporte: number;
  total_outros: number;

  total_tripulante1: number;
  total_tripulante2: number;
  total_tripulante: number; // Campo de compatibilidade
  total_cliente: number;
  total_sharebrasil: number;
  valor_total: number;
}

// =========================================================================
// FUNÇÕES DE UTILIDADE E FORMATAÇÃO
// =========================================================================

/**
 * Formata a data de string ISO para padrão local (pt-BR).
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  // Adicionando 'T00:00:00' garante que o fuso horário local não cause desvios de dia.
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

/**
 * Formata o valor numérico para padrão de moeda BRL (R$).
 */
function formatCurrency(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return 'R$ 0,00';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}


// =========================================================================
// FUNÇÕES DE GERAÇÃO E MANIPULAÇÃO DO PDF
// =========================================================================

/**
 * Função auxiliar que gera o documento PDF (sem abrir/baixar).
 * Retorna o objeto jsPDF para ser usado em outras funções.
 */
function generatePDFDocument(report: TravelReport, userName: string = 'Sistema'): jsPDF {
  const doc = new jsPDF();
  autoTable(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  // Logo e Cabeçalho
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SHARE BRASIL', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(16);
  doc.text('RELATÓRIO DE DESPESA DE VIAGEM', pageWidth / 2, yPos, { align: 'center' });
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

  autoTable(doc, {
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


/**
 * 1. Gera o PDF e faz upload para o Supabase Storage.
 * Retorna a URL pública do PDF salvo (usado para salvar no banco de dados).
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
    .from('travel-reports') // VERIFIQUE O NOME DO SEU BUCKET
    .upload(filePath, pdfBlob, {
      contentType: 'application/pdf',
      upsert: true // Alterei para 'true' para permitir que relatórios atualizados substituam o anterior
    });

  if (uploadError) {
    console.error('Erro no upload para Supabase Storage:', uploadError);
    throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
  }

  // Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('travel-reports')
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * 2. Baixa o PDF diretamente no navegador (para o botão "Baixar PDF").
 * Cria um link temporário e simula o clique.
 */
export const downloadPDF = (report: TravelReport) => {
  const doc = generatePDFDocument(report, 'Usuário');
  const pdfBlob = doc.output('blob');

  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');

  // Nome do arquivo para download (CRÍTICO: impede o download vazio)
  link.download = `${report.numero.replace(/\//g, '-')}-relatorio-viagem.pdf`;
  link.href = url;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Limpar o objeto URL para liberar memória
  URL.revokeObjectURL(url);
};

/**
 * 3. Abre o PDF em uma nova aba do navegador (para o botão "Visualizar / Eye Icon").
 * Ideal para visualização, impressão e download nativo do navegador.
 */
export const previewPDFForPrint = (report: TravelReport, userName: string) => {
  const doc = generatePDFDocument(report, userName);
  const pdfBlob = doc.output('blob');

  const url = URL.createObjectURL(pdfBlob);

  // Abre em uma nova janela/aba
  const printWindow = window.open(url, '_blank');

  if (!printWindow) {
    console.error('Falha ao abrir janela de visualização. O bloqueador de pop-ups está ativo?');
    alert('Falha ao abrir a janela de visualização. Verifique o bloqueador de pop-ups e tente novamente.');
  }

  // Nota: O URL.revokeObjectURL(url) não é chamado aqui para que a nova janela 
  // possa continuar acessando o objeto Blob.
};
