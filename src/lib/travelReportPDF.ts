import jsPDF from 'jspdf';

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

// Função auxiliar para calcular totais separados por tripulante a partir das despesas
const calculateCrewTotals = (despesas: TravelExpense[]) => {
  let total_tripulante1 = 0;
  let total_tripulante2 = 0;

  despesas.forEach(d => {
    const valor = Number(d.valor) || 0;
    const pagoPor = d.pago_por || '';

    if (pagoPor === 'Tripulante 1' || pagoPor === 'Tripulante') {
      total_tripulante1 += valor;
    } else if (pagoPor === 'Tripulante 2') {
      total_tripulante2 += valor;
    }
  });

  return { total_tripulante1, total_tripulante2 };
};

const formatCurrency = (value: number): string => {
  return (value || 0).toFixed(2).replace('.', ',');
};

// Gera PDF usando jsPDF diretamente (mais confiável que html2pdf)
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

  // Calcular dias
  const calcDays = () => {
    if (report?.data_inicio && report?.data_fim) {
      const inicio = parseLocalDate(report.data_inicio);
      const fim = parseLocalDate(report.data_fim);
      const diffTime = Math.abs(fim.getTime() - inicio.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    return 1;
  };

  // Calcular totais de tripulantes
  const crewTotals = calculateCrewTotals(report.despesas);
  const total_tripulante1 = report.total_tripulante1 || crewTotals.total_tripulante1;
  const total_tripulante2 = report.total_tripulante2 || crewTotals.total_tripulante2;
  const hasSecondCrew = report.tripulante2 && report.tripulante2.trim() !== '';

  // === BORDA VERDE ===
  doc.setDrawColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.setLineWidth(1);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

  // === CABEÇALHO ===
  doc.setFontSize(16);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE DESPESA DE VIAGEM', pageWidth / 2, y + 5, { align: 'center' });

  y += 12;
  doc.setFontSize(11);
  doc.text(`${report.numero || 'N/A'} - ${(report.cliente_nome || 'N/A').toUpperCase()}`, pageWidth / 2, y, { align: 'center' });

  // Linha separadora
  y += 8;
  doc.setDrawColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // === INFORMAÇÕES DO RELATÓRIO ===
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFont('helvetica', 'normal');

  const infoLineHeight = 6;
  
  // Cliente e Aeronave
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Cliente:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text((report.cliente_nome || 'N/A').toUpperCase(), margin + 20, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Aeronave:', pageWidth / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text(report.aeronave || 'N/A', pageWidth / 2 + 25, y);

  y += infoLineHeight;

  // Tripulantes
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Tripulante 1:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text((report.tripulante || 'N/A').toUpperCase(), margin + 28, y);

  if (hasSecondCrew) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('Tripulante 2:', pageWidth / 2, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text((report.tripulante2 || '').toUpperCase(), pageWidth / 2 + 28, y);
  }

  y += infoLineHeight;

  // Trecho e Período
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Trecho:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.text(report.trecho || report.destino || 'N/A', margin + 18, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('Período:', pageWidth / 2, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  const periodo = `${formatDateBR(report.data_inicio)} a ${formatDateBR(report.data_fim)} (${calcDays()} dias)`;
  doc.text(periodo, pageWidth / 2 + 20, y);

  // === TABELA DE DESPESAS ===
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFontSize(11);
  doc.text('DETALHES DAS DESPESAS', margin, y);

  y += 6;

  // Cabeçalho da tabela
  const colWidths = [35, 65, 30, 40];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);
  const startX = margin;

  doc.setFillColor(232, 232, 232);
  doc.rect(startX, y, tableWidth, 8, 'F');
  doc.setDrawColor(153, 153, 153);
  doc.rect(startX, y, tableWidth, 8, 'S');

  doc.setFontSize(9);
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.setFont('helvetica', 'bold');

  let xPos = startX + 2;
  doc.text('Categoria', xPos, y + 5.5);
  xPos += colWidths[0];
  doc.text('Descrição', xPos, y + 5.5);
  xPos += colWidths[1];
  doc.text('Valor (R$)', xPos, y + 5.5);
  xPos += colWidths[2];
  doc.text('Pago Por', xPos, y + 5.5);

  y += 8;

  // Linhas da tabela
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textGray[0], textGray[1], textGray[2]);
  doc.setFontSize(8);

  const validExpenses = report.despesas.filter(d => d.categoria && Number(d.valor) > 0);

  validExpenses.forEach((expense, index) => {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }

    const rowHeight = 7;
    
    // Fundo alternado
    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(startX, y, tableWidth, rowHeight, 'F');
    }
    doc.setDrawColor(200, 200, 200);
    doc.rect(startX, y, tableWidth, rowHeight, 'S');

    xPos = startX + 2;
    doc.text(expense.categoria || 'Outros', xPos, y + 5);
    xPos += colWidths[0];
    
    // Truncar descrição se muito longa
    const descricao = (expense.descricao || 'N/A').substring(0, 40);
    doc.text(descricao, xPos, y + 5);
    xPos += colWidths[1];
    
    doc.text(formatCurrency(expense.valor), xPos, y + 5);
    xPos += colWidths[2];
    doc.text(expense.pago_por || 'N/A', xPos, y + 5);

    y += rowHeight;
  });

  // === TOTAIS ===
  y += 10;

  if (y > pageHeight - 80) {
    doc.addPage();
    y = margin;
  }

  // Box de totais por categoria
  const boxWidth = (tableWidth - 5) / 2;
  const boxStartX = startX;

  // Totais por Categoria
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(153, 153, 153);
  doc.rect(boxStartX, y, boxWidth, 55, 'S');

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
    { label: 'Transporte:', value: report.total_transporte },
    { label: 'Outros:', value: report.total_outros },
  ];

  categories.forEach(cat => {
    doc.text(cat.label, boxStartX + 3, ty);
    doc.text(formatCurrency(cat.value), boxStartX + boxWidth - 25, ty);
    ty += 6;
  });

  // Total geral categoria
  doc.setDrawColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.line(boxStartX + 3, ty - 2, boxStartX + boxWidth - 3, ty - 2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('TOTAL GERAL:', boxStartX + 3, ty + 4);
  doc.setTextColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.text(formatCurrency(report.valor_total), boxStartX + boxWidth - 25, ty + 4);

  // Totais por Pagador
  const box2X = boxStartX + boxWidth + 5;
  doc.setDrawColor(153, 153, 153);
  doc.rect(box2X, y, boxWidth, 55, 'S');

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
  doc.text(formatCurrency(total_tripulante1), box2X + boxWidth - 25, ty);
  ty += 6;

  // Tripulante 2 (se houver)
  if (hasSecondCrew) {
    const tripLabel2 = `Tripulante 2 (${report.tripulante2}):`;
    doc.text(tripLabel2.substring(0, 25), box2X + 3, ty);
    doc.text(formatCurrency(total_tripulante2), box2X + boxWidth - 25, ty);
    ty += 6;
  }

  // Cliente
  doc.text('Cliente:', box2X + 3, ty);
  doc.text(formatCurrency(report.total_cliente), box2X + boxWidth - 25, ty);
  ty += 6;

  // ShareBrasil
  doc.text('ShareBrasil:', box2X + 3, ty);
  doc.text(formatCurrency(report.total_sharebrasil), box2X + boxWidth - 25, ty);
  ty += 6;

  // Total geral pagador
  doc.setDrawColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.line(box2X + 3, ty - 2, box2X + boxWidth - 3, ty - 2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.text('TOTAL GERAL:', box2X + 3, ty + 4);
  doc.setTextColor(accentGreen[0], accentGreen[1], accentGreen[2]);
  doc.text(formatCurrency(report.valor_total), box2X + boxWidth - 25, ty + 4);

  // === RODAPÉ ===
  y = pageHeight - 15;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(102, 102, 102);
  doc.setFontSize(8);
  doc.text(`Gerado por: ${currentFullName}`, pageWidth - margin, y, { align: 'right' });
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, y);

  // Retorna como Blob
  return doc.output('blob');
};

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
      printWindow.print();
    };
  }
};

export const uploadPDFToStorage = async (
  report: TravelReport,
  supabaseClient: any,
  currentFullName?: string
): Promise<string> => {
  const blob = await generatePDF(report, currentFullName);

  console.log('PDF Blob size:', blob.size, 'bytes');
  console.log('PDF Blob type:', blob.type);

  if (!blob || blob.size < 1000) {
    console.error('PDF gerado parece estar vazio ou muito pequeno:', blob?.size);
    throw new Error('PDF gerado está vazio ou inválido.');
  }

  const fileName = `${report.numero.replace(/\//g, '-')}-${Date.now()}.pdf`;
  const filePath = `pdfs/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('travel-reports')
    .upload(filePath, blob, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabaseClient.storage
    .from('travel-reports')
    .getPublicUrl(filePath);

  return publicUrl;
};

// Exporta HTML para preview (mantido para compatibilidade)
export const getReportHTML = (report: TravelReport, currentFullName = 'Usuário') => {
  const crewTotals = calculateCrewTotals(report.despesas);
  const total_tripulante1 = report.total_tripulante1 || crewTotals.total_tripulante1;
  const total_tripulante2 = report.total_tripulante2 || crewTotals.total_tripulante2;
  const hasSecondCrew = report.tripulante2 && report.tripulante2.trim() !== '';

  const calcDays = () => {
    if (report?.data_inicio && report?.data_fim) {
      const inicio = parseLocalDate(report.data_inicio);
      const fim = parseLocalDate(report.data_fim);
      const diffTime = Math.abs(fim.getTime() - inicio.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    return 1;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Relatório de Viagem - ${report.numero}</title>
        <style>
            body { font-family: Arial; font-size: 12px; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #22c55e; padding-bottom: 10px; }
            .header h1 { color: #1e3a8a; margin: 0; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #e5e5e5; color: #1e3a8a; }
            .totals { display: flex; gap: 20px; margin-top: 20px; }
            .totals-box { flex: 1; border: 1px solid #ccc; padding: 15px; }
            .totals-box h3 { color: #22c55e; margin-top: 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>RELATÓRIO DE DESPESA DE VIAGEM</h1>
            <p><strong>${report.numero} - ${(report.cliente_nome || '').toUpperCase()}</strong></p>
        </div>
        <p><strong>Cliente:</strong> ${report.cliente_nome} | <strong>Aeronave:</strong> ${report.aeronave}</p>
        <p><strong>Tripulante 1:</strong> ${report.tripulante}${hasSecondCrew ? ` | <strong>Tripulante 2:</strong> ${report.tripulante2}` : ''}</p>
        <p><strong>Trecho:</strong> ${report.trecho || report.destino} | <strong>Período:</strong> ${formatDateBR(report.data_inicio)} a ${formatDateBR(report.data_fim)} (${calcDays()} dias)</p>
        
        <table>
            <thead><tr><th>Categoria</th><th>Descrição</th><th>Valor (R$)</th><th>Pago Por</th></tr></thead>
            <tbody>
                ${report.despesas.map(d => `<tr><td>${d.categoria}</td><td>${d.descricao}</td><td>${formatCurrency(d.valor)}</td><td>${d.pago_por}</td></tr>`).join('')}
            </tbody>
        </table>
        
        <div class="totals">
            <div class="totals-box">
                <h3>Totais por Categoria</h3>
                <p>Combustível: R$ ${formatCurrency(report.total_combustivel)}</p>
                <p>Hospedagem: R$ ${formatCurrency(report.total_hospedagem)}</p>
                <p>Alimentação: R$ ${formatCurrency(report.total_alimentacao)}</p>
                <p>Transporte: R$ ${formatCurrency(report.total_transporte)}</p>
                <p>Outros: R$ ${formatCurrency(report.total_outros)}</p>
                <p><strong>TOTAL: R$ ${formatCurrency(report.valor_total)}</strong></p>
            </div>
            <div class="totals-box">
                <h3>Totais por Pagador</h3>
                <p>Tripulante 1 (${report.tripulante}): R$ ${formatCurrency(total_tripulante1)}</p>
                ${hasSecondCrew ? `<p>Tripulante 2 (${report.tripulante2}): R$ ${formatCurrency(total_tripulante2)}</p>` : ''}
                <p>Cliente: R$ ${formatCurrency(report.total_cliente)}</p>
                <p>ShareBrasil: R$ ${formatCurrency(report.total_sharebrasil)}</p>
                <p><strong>TOTAL: R$ ${formatCurrency(report.valor_total)}</strong></p>
            </div>
        </div>
        <p style="text-align: right; margin-top: 30px; color: #666;">Gerado por: ${currentFullName}</p>
    </body>
    </html>
  `;
};

export const viewHTMLPreview = (report: TravelReport, currentFullName?: string) => {
  const htmlContent = getReportHTML(report, currentFullName);
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  }
};
