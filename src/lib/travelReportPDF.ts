// src/lib/travelReportPDF.ts
import jsPDF from 'jspdf';
import type { SupabaseClient } from '@supabase/supabase-js';

// Adicione aqui a importação da logo se ela estiver em Base64 ou se precisar de um resolvedor.
// Se a imagem estiver na pasta 'public/', você pode precisar de um conversor Base64 
// ou ter a imagem já convertida para inclusão direta no jsPDF.
// Para este exemplo, vou simular o carregamento de uma URL ou usar uma string base64 placeholder.
// OBS: Você pode precisar de uma função auxiliar no seu ambiente para converter assets em Base64.
const LOGO_BASE64_PLACEHOLDER = 'data:image/png;base64,...'; // SUBSTITUA PELO BASE64 REAL DA SUA LOGO

// =========================================================================
// CONSTANTES E INTERFACES (MANTIDAS)
// =========================================================================

export const CATEGORIAS_DESPESA = [
  "Combustível",
  "Hospedagem",
  "Alimentação",
  "Transporte",
  "Outros"
];

export const PAGADORES = [
  "Tripulante 1",
  "Tripulante 2",
  "Cliente",
  "ShareBrasil"
];

export interface TravelExpense {
  categoria: string;
  descricao: string;
  valor: number;
  pago_por: string;
  comprovante_url?: string;
}

export interface TravelReport {
  numero: string;
  cliente_nome: string;
  aeronave: string;
  tripulante: string;
  tripulante2?: string;
  trecho?: string;
  destino: string;
  data_inicio: string;
  data_fim: string;
  observacoes?: string;
  despesas: TravelExpense[];
  total_combustivel: number;
  total_hospedagem: number;
  total_alimentacao: number;
  total_transporte: number;
  total_outros: number;
  total_tripulante: number;
  total_tripulante1: number;
  total_tripulante2: number;
  total_cliente: number;
  total_sharebrasil: number;
  valor_total: number;
}

// =========================================================================
// FUNÇÕES DE UTILIDADE E CÁLCULO (MANTIDAS E RELEVANTES)
// =========================================================================

const parseLocalDate = (value: string | Date) => {
  const s = String(value).split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const formatDateBR = (value: string | Date) => {
  if (!value) return '';
  const s = String(value).split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  try { return new Date(value).toLocaleDateString('pt-BR'); } catch { return String(value); }
};

const formatCurrency = (value: number): string => {
  return (value || 0).toFixed(2).replace('.', ',');
};

const calculateCrewTotals = (despesas: TravelExpense[]) => {
  let total_tripulante1 = 0;
  let total_tripulante2 = 0;
  
  despesas.forEach(d => {
    const valor = Number(d.valor) || 0;
    const pagoPor = d.pago_por || '';

    if (pagoPor.includes('Tripulante 1') || pagoPor === 'Tripulante 1') {
      total_tripulante1 += valor;
    } else if (pagoPor.includes('Tripulante 2') || pagoPor === 'Tripulante 2') {
      total_tripulante2 += valor;
    }
  });
  
  return { total_tripulante1, total_tripulante2 };
};

const calculateDays = (report: TravelReport) => {
  if (report?.data_inicio && report?.data_fim) {
    const inicio = parseLocalDate(report.data_inicio);
    const fim = parseLocalDate(report.data_fim);
    const diffTime = Math.abs(fim.getTime() - inicio.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
  return 1;
};

// =========================================================================
// FUNÇÃO DE GERAÇÃO PRINCIPAL (LAYOUT CORRIGIDO)
// =========================================================================

export const generatePDF = async (report: TravelReport, currentFullName = 'Usuário'): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Cores
  const primaryBlue: [number, number, number] = [30, 58, 138];
  const accentGreen: [number, number, number] = [34, 197, 94];
  const textGray: [number, number, number] = [51, 51, 51];

  // Recalcular totais e dias
  const crewTotals = calculateCrewTotals(report.despesas);
  const total_tripulante1 = crewTotals.total_tripulante1;
  const total_tripulante2 = crewTotals.total_tripulante2;
  const hasSecondCrew = report.tripulante2 && report.tripulante2.trim() !== '';
  const days = calculateDays(report);
  const validExpenses = report.despesas.filter(d => d.categoria && Number(d.valor) > 0);

  // === BORDA VERDE ===
  doc.setDrawColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.setLineWidth(1);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
  doc.setDrawColor(textGray[0], textGray[1], textGray[2]); // Resetar cor

  // === INÍCIO DO CABEÇALHO ===

  // 2. INCLUIR LOGO (Posição 15, 8. Largura 20, Altura 8. Ajuste conforme sua logo)
  // Nota: Você deve carregar o conteúdo da imagem (em Base64) antes de chamar esta função.
  try {
    // Se você tiver a imagem logo.share.png na pasta public/, use uma função de carregamento
    // ou um Base64 hardcoded aqui. Este é um exemplo:
    // doc.addImage(LOGO_BASE64_PLACEHOLDER, 'PNG', margin, 8, 20, 8);
    // Para fins de demonstração, vou apenas reservar o espaço.
    // doc.setFontSize(10);
    // doc.text('SHAREBRASIL', margin + 25, 12);
    y = 20; // Posição de início para o texto

  } catch (e) {
    console.warn("Erro ao adicionar logo: Certifique-se de que a imagem está em Base64 válido.");
    y = 15; // Inicia mais alto se a logo falhar
  }

  // Título e Número do Relatório (Centralizado)
  doc.setFontSize(16);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Despesa de Viagem', pageWidth / 2, y, { align: 'center' });
  
  y += 5;
  doc.setFontSize(11);
  doc.text(`${report.numero || 'N/A'} - ${(report.cliente_nome || 'N/A').toUpperCase()}`, pageWidth / 2, y, { align: 'center' });

  // Linha separadora
  y += 5;
  doc.setDrawColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  
  // === 1. INFORMAÇÕES DO RELATÓRIO ORGANIZADAS ===
  y += 7;
  const infoLineHeight = 5.5;
  const col1Start = margin;
  const col2Start = pageWidth / 2 + 5; // Posição para Aeronave e Tripulante 2

  // Primeira Linha: Cliente e Aeronave
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Cliente:', col1Start, y);
  doc.text('Aeronave:', col2Start, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  // Cliente (Usamos x + 18 para deixar um espaço fixo)
  doc.text((report.cliente_nome || 'N/A').toUpperCase(), col1Start + 18, y); 
  // Aeronave
  doc.text(report.aeronave || 'N/A', col2Start + 22, y);

  y += infoLineHeight;

  // Segunda Linha: Tripulante 1 e Tripulante 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Tripulante 1:', col1Start, y);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text((report.tripulante || 'N/A').toUpperCase(), col1Start + 28, y);
  
  if (hasSecondCrew) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('Tripulante 2:', col2Start, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text((report.tripulante2 || '').toUpperCase(), col2Start + 28, y);
  }

  y += infoLineHeight;

  // Terceira Linha: Trecho e Período
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Trecho:', col1Start, y);
  doc.text('Período:', col2Start, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text(report.trecho || report.destino || 'N/A', col1Start + 18, y);
  const periodo = `${formatDateBR(report.data_inicio)} a ${formatDateBR(report.data_fim)} (${days} dias)`;
  doc.text(periodo, col2Start + 20, y);
  
  y += 10;
  
  // Detalhes da Tabela de Despesas (Início)
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFontSize(11);
  doc.text('Detalhes das Despesas', margin, y);

  y += 6;

  // Cabeçalho da tabela (Layout Manual)
  const colWidths = [40, 75, 30, 30]; // Ajustei as larguras
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = margin;
  const headerHeight = 8;

  doc.setFillColor(232, 232, 232); // Cor de fundo do cabeçalho
  doc.rect(startX, y, tableWidth, headerHeight, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFont('helvetica', 'bold');

  let xPos = startX + 2;
  doc.text('Categoria', xPos, y + 5.5);
  xPos += colWidths[0];
  doc.text('Descrição', xPos, y + 5.5);
  xPos += colWidths[1];
  doc.text('Valor (R$)', xPos, y + 5.5, { align: 'right' });
  xPos += colWidths[2];
  doc.text('Pago Por', xPos, y + 5.5);
  
  // 3. Linha separadora no cabeçalho
  doc.setDrawColor(153, 153, 153);
  doc.line(startX, y, startX + tableWidth, y); // Linha superior
  doc.line(startX, y + headerHeight, startX + tableWidth, y + headerHeight); // Linha inferior
  
  y += headerHeight;
  
  // Linhas da tabela (Corpo)
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);

  const rowHeight = 7;
  validExpenses.forEach((expense, index) => {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    // Fundo alternado
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(startX, y, tableWidth, rowHeight, 'F');
    }
    
    // 3. Linha separadora entre linhas
    doc.setDrawColor(200, 200, 200);
    doc.line(startX, y, startX + tableWidth, y);

    xPos = startX + 2;
    doc.text(expense.categoria || 'Outros', xPos, y + 5);
    xPos += colWidths[0];
    
    // Truncar descrição
    const descricao = (expense.descricao || 'N/A').substring(0, 40);
    doc.text(descricao, xPos, y + 5);
    xPos += colWidths[1];
    
    doc.text(formatCurrency(expense.valor), xPos + colWidths[2] - 4, y + 5, { align: 'right' }); // Ajuste para alinhar à direita
    xPos += colWidths[2];
    doc.text(expense.pago_por || 'N/A', xPos, y + 5);

    y += rowHeight;
  });
  
  // Linha final da tabela
  doc.setDrawColor(153, 153, 153);
  doc.line(startX, y, startX + tableWidth, y); 

  // === TOTAIS E OBSERVAÇÕES ===
  // ... (A lógica de Totais e Observações é mantida sem mudanças na estrutura, apenas continua após 'y')

  y += 10;

  if (y > pageHeight - 80) {
    doc.addPage();
    y = margin;
  }

  const totalsBoxWidth = (pageWidth - (margin * 2) - 10) / 2;
  const totalsBoxHeight = 55;
  const boxStartX = margin;
  const box2X = boxStartX + totalsBoxWidth + 10;

  // Box de totais por categoria
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(153, 153, 153);
  doc.rect(boxStartX, y, totalsBoxWidth, totalsBoxHeight, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.setFontSize(10);
  doc.text('Totais por Categoria (R$)', boxStartX + 3, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(9);

  let ty = y + 14;
  const categories = [
    { label: 'Combustível:', value: report.total_combustivel },
    { label: 'Hospedagem:', value: report.total_hospedagem },
    { label: 'Alimentação:', value: report.total_alimentacao },
    { label: 'Transporte:', value: report.total_transported },
    { label: 'Outros:', value: report.total_outros },
  ];

  categories.forEach(cat => {
    doc.text(cat.label, boxStartX + 3, ty);
    doc.text(formatCurrency(cat.value), boxStartX + totalsBoxWidth - 3, ty, { align: 'right' });
    ty += 6;
  });

  // Total geral categoria
  doc.setDrawColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.line(boxStartX + 3, ty - 2, boxStartX + totalsBoxWidth - 3, ty - 2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('TOTAL GERAL:', boxStartX + 3, ty + 4);
  doc.setTextColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.text(formatCurrency(report.valor_total), boxStartX + totalsBoxWidth - 3, ty + 4, { align: 'right' });

  // Totais por Pagador
  doc.setDrawColor(153, 153, 153);
  doc.rect(box2X, y, totalsBoxWidth, totalsBoxHeight, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.setFontSize(10);
  doc.text('Totais por Pagador (R$)', box2X + 3, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(9);

  ty = y + 14;
  
  // Tripulante 1
  const tripLabel1 = report.tripulante ? `Tripulante 1 (${report.tripulante}):` : 'Tripulante 1:';
  doc.text(tripLabel1.substring(0, 25), box2X + 3, ty);
  doc.text(formatCurrency(total_tripulante1), box2X + totalsBoxWidth - 3, ty, { align: 'right' });
  ty += 6;

  // Tripulante 2 (se houver)
  if (hasSecondCrew) {
    const tripLabel2 = report.tripulante2 ? `Tripulante 2 (${report.tripulante2}):` : 'Tripulante 2:';
    doc.text(tripLabel2.substring(0, 25), box2X + 3, ty);
    doc.text(formatCurrency(total_tripulante2), box2X + totalsBoxWidth - 3, ty, { align: 'right' });
    ty += 6;
  }
  
  // Cliente
  doc.text('Cliente:', box2X + 3, ty);
  doc.text(formatCurrency(report.total_cliente), box2X + totalsBoxWidth - 3, ty, { align: 'right' });
  ty += 6;

  // ShareBrasil
  doc.text('ShareBrasil:', box2X + 3, ty);
  doc.text(formatCurrency(report.total_sharebrasil), box2X + totalsBoxWidth - 3, ty, { align: 'right' });
  ty += 6;

  // Total geral pagador
  doc.setDrawColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.line(box2X + 3, ty - 2, box2X + totalsBoxWidth - 3, ty - 2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('TOTAL GERAL:', box2X + 3, ty + 4);
  doc.setTextColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.text(formatCurrency(report.valor_total), box2X + totalsBoxWidth - 3, ty + 4, { align: 'right' });

  // Observações
  let obsY = y + totalsBoxHeight + 10;
  if (report.observacoes && report.observacoes.trim()) {
    if (obsY > pageHeight - 40) {
        doc.addPage();
        obsY = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setFontSize(11);
    doc.text('OBSERVAÇÕES:', margin, obsY);
    obsY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(report.observacoes, pageWidth - (margin * 2));
    doc.text(obsLines, margin, obsY);
  } else {
    obsY = y + totalsBoxHeight + 5; // Mantém a posição se não houver observações
  }


  // === 4. COMPROVANTES (Nova Seção/Página) ===
  const comprovantes = validExpenses.filter(e => e.comprovante_url);

  if (comprovantes.length > 0) {
      let currentY = obsY;
      
      if (currentY > pageHeight - 30) {
          doc.addPage();
          currentY = margin;
      }
      
      // Título da Seção
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(accentGreen[0], accentGreen[1], accentGreen[2]);
      doc.setFontSize(12);
      doc.text('COMPROVANTES DE DESPESAS', margin, currentY + 10);
      currentY += 15;

      // Tabela de Comprovantes (Links)
      doc.setFontSize(9);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      
      comprovantes.forEach((expense, index) => {
          if (currentY > pageHeight - 20) {
              doc.addPage();
              currentY = margin;
          }
          
          doc.setFont('helvetica', 'bold');
          doc.text(`Item ${index + 1}: ${expense.categoria} - ${formatCurrency(expense.valor)}`, margin, currentY);
          currentY += 5;
          
          doc.setFont('helvetica', 'normal');
          // No PDF, não podemos exibir o comprovante, apenas o link
          doc.text(`Descrição: ${expense.descricao || 'N/A'}`, margin + 5, currentY);
          currentY += 5;
          
          doc.text(`Link: ${expense.comprovante_url}`, margin + 5, currentY);
          currentY += 8;
      });
  }


  // === RODAPÉ ===
  let footerY = pageHeight - 15;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(102, 102, 102);
  doc.setFontSize(8);
  doc.text(`Gerado por: ${currentFullName}`, pageWidth - margin, footerY, { align: 'right' });
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, footerY);

  // Retorna como Blob
  return doc.output('blob');
};

// =========================================================================
// FUNÇÕES DE EXPORTAÇÃO (DOWNLOAD, VISUALIZAR, UPLOAD)
// =========================================================================

export const downloadPDF = async (report: TravelReport, currentFullName?: string) => {
  const blob = await generatePDF(report, currentFullName);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.numero.replace(/\//g, '-')}-relatorio-viagem.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const openPDFInNewWindow = async (report: TravelReport, currentFullName?: string) => {
  const blob = await generatePDF(report, currentFullName);
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
};

export const previewPDFForPrint = async (report: TravelReport, currentFullName?: string) => {
  const blob = await generatePDF(report, currentFullName);
  const url = window.URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      // printWindow.print();
    };
  }
};

export const uploadPDFToStorage = async (
  report: TravelReport,
  supabaseClient: any,
  currentFullName?: string
): Promise<string> => {
  const blob = await generatePDF(report, currentFullName);

  if (!blob || blob.size < 1000) {
    console.error('PDF gerado está vazio ou inválido:', blob?.size);
    throw new Error('PDF gerado está vazio ou inválido. Verifique os dados do relatório.');
  }

  const fileName = `${report.numero.replace(/\//g, '-')}-${Date.now()}.pdf`;
  const filePath = `pdfs/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('travel-reports')
    .upload(filePath, blob, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabaseClient.storage
    .from('travel-reports')
    .getPublicUrl(filePath);

  return publicUrl;
};

// Exporta HTML para preview (mantido para compatibilidade, mas o PDF é o principal)
// ... (funções getReportHTML e viewHTMLPreview)