import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const decimalToHHMM = (decimal?: number | null): string => {
  if (!decimal || decimal === 0) return '-';
  const hours = Math.floor(Math.abs(decimal));
  const minutes = Math.round((Math.abs(decimal) - hours) * 60);
  const sign = decimal < 0 ? '-' : '';
  return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
};

interface LogbookEntry {
  id: string;
  entry_date: string;
  departure_aerodrome: string;
  arrival_aerodrome: string;
  pic_canac: string;
  pic_name?: string;
  sic_canac?: string;
  sic_name?: string;
  total_time: number;
  day_time?: number;
  night_hours?: number;
  ifr_time?: number;
  pousos?: number;
  fuel_added?: number;
  fuel_liters?: number;
  celula?: number;
  distance_nm?: number;
  passengers?: number;
  cargo_kg?: number;
  flight_nature?: string;
  ac_time?: string;
  dep_time?: string;
  pou_time?: string;
  cor_time?: string;
  client_id?: string;
  client_company_name?: string;
  partner_name?: string;
  is_equal_split?: boolean;
  is_loan?: boolean;
  daily_rate?: number;
}

interface LogbookMonthData {
  month: number;
  year: number;
  entries: LogbookEntry[];
  aircraft: {
    registration: string;
    model?: string;
  };
  client?: {
    company_name: string;
  };
}

interface ExportOptions {
  months: Array<{ month: number; year: number }>;
  aircraftRegistration: string;
  aircraftModel?: string;
  clientName?: string;
  entries: LogbookEntry[];
  logoUrl?: string;
}

const generateCoverPage = (doc: jsPDF, options: ExportOptions, logoDataUrl?: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Logo
  if (logoDataUrl) {
    const logoSize = 50;
    const x = (pageWidth - logoSize) / 2;
    doc.addImage(logoDataUrl, 'PNG', x, 30, logoSize, logoSize);
  }

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('DIÁRIO DE BORDO', pageWidth / 2, 100, { align: 'center' });

  // Informações principais
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Aeronave: ${options.aircraftRegistration}`, pageWidth / 2, 130, { align: 'center' });

  if (options.aircraftModel) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(options.aircraftModel, pageWidth / 2, 140, { align: 'center' });
  }

  // Período
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const monthsText = options.months
    .map(m => `${MONTHS[m.month - 1]}/${m.year}`)
    .join(', ');
  doc.text(`Período: ${monthsText}`, pageWidth / 2, 160, { align: 'center' });
};

const generateLogbookPage = (doc: jsPDF, entries: LogbookEntry[], month: number, year: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Adicionar nova página
  doc.addPage();

  // Cabeçalho da página
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${MONTHS[month - 1]} de ${year}`, pageWidth / 2, 15, { align: 'center' });

  // Preparar dados da tabela
  const tableData = entries
    .filter(e => {
      const date = new Date(e.entry_date);
      return date.getUTCMonth() + 1 === month && date.getUTCFullYear() === year;
    })
    .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
    .map(entry => [
      formatDateBR(entry.entry_date),
      entry.departure_aerodrome || '-',
      entry.arrival_aerodrome || '-',
      entry.pic_name || entry.pic_canac || '-',
      entry.sic_name || entry.sic_canac || '-',
      entry.client_company_name || entry.partner_name || '-',
      decimalToHHMM(entry.total_time),
      decimalToHHMM(entry.day_time),
      decimalToHHMM(entry.night_hours),
      decimalToHHMM(entry.ifr_time),
      entry.pousos ? entry.pousos.toString() : '-',
      entry.fuel_added ? `${entry.fuel_added}L` : '-',
      decimalToHHMM(entry.celula),
      entry.daily_rate ? `R$ ${entry.daily_rate.toFixed(2)}` : '-'
    ]);

  // Criar tabela
  autoTable(doc, {
    startY: 25,
    head: [
      [
        'Data',
        'Origem',
        'Destino',
        'PIC',
        'SIC',
        'Cliente',
        'Tempo Voo',
        'Diurno',
        'Noturno',
        'IFR',
        'Pousos',
        'Combustível',
        'Célula',
        'Diária'
      ]
    ],
    body: tableData,
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
      lineColor: [200, 200, 200],
      lineWidth: 0.5
    },
    bodyStyles: {
      fontSize: 9,
      halign: 'center',
      lineColor: [220, 220, 220],
      lineWidth: 0.3
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 16 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'left', cellWidth: 22 },
      4: { halign: 'left', cellWidth: 22 },
      5: { halign: 'left', cellWidth: 28 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'center', cellWidth: 16 },
      8: { halign: 'center', cellWidth: 16 },
      9: { halign: 'center', cellWidth: 14 },
      10: { halign: 'center', cellWidth: 14 },
      11: { halign: 'center', cellWidth: 16 },
      12: { halign: 'center', cellWidth: 16 },
      13: { halign: 'center', cellWidth: 18 }
    },
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      // Rodapé
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      const pageWidth = pageSize.getWidth();
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Página ${doc.internal.pages.length - 1}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  });
};

const generateClientSummaryPage = (doc: jsPDF, entries: LogbookEntry[], months: Array<{ month: number; year: number }>) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Adicionar nova página
  doc.addPage();

  // Cabeçalho da página
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO DE HORAS POR CLIENTE', pageWidth / 2, 15, { align: 'center' });

  // Filtrar entradas do período selecionado
  const filteredEntries = entries.filter(e => {
    const date = new Date(e.entry_date);
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    return months.some(m => m.month === month && m.year === year);
  });

  // Agrupar por cliente e calcular horas totais
  const clientSummary: { [key: string]: { clientName: string; totalHours: number; flights: number } } = {};

  filteredEntries.forEach(entry => {
    const clientName = entry.client_company_name || entry.partner_name || 'Sem Cliente';
    const key = clientName;

    if (!clientSummary[key]) {
      clientSummary[key] = {
        clientName,
        totalHours: 0,
        flights: 0
      };
    }

    clientSummary[key].totalHours += entry.total_time || 0;
    clientSummary[key].flights += 1;
  });

  // Preparar dados da tabela
  const tableData = Object.values(clientSummary)
    .sort((a, b) => b.totalHours - a.totalHours)
    .map(client => [
      client.clientName,
      client.flights.toString(),
      decimalToHHMM(client.totalHours)
    ]);

  // Calcular total geral
  const totalFlights = tableData.reduce((sum, row) => sum + parseInt(row[1]), 0);
  const totalHours = Object.values(clientSummary).reduce((sum, client) => sum + client.totalHours, 0);

  // Adicionar linha de total
  tableData.push([
    'TOTAL',
    totalFlights.toString(),
    decimalToHHMM(totalHours)
  ]);

  // Criar tabela
  autoTable(doc, {
    startY: 30,
    head: [
      [
        'Cliente',
        'Voos',
        'Horas'
      ]
    ],
    body: tableData,
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 10,
      halign: 'center'
    },
    footStyles: {
      fillColor: [220, 220, 220],
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 100 },
      1: { halign: 'center', cellWidth: 40 },
      2: { halign: 'center', cellWidth: 40 }
    },
    margin: { left: 20, right: 20 },
    didDrawPage: (data) => {
      // Rodapé
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.getHeight();
      const pageWidth = pageSize.getWidth();
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Página ${doc.internal.pages.length - 1}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  });
};

export const generateLogbookPDF = async (options: ExportOptions): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Tentar carregar logo se fornecido
      let logoDataUrl: string | undefined;
      
      const generateDocument = () => {
        // Gerar capa
        generateCoverPage(doc, options, logoDataUrl);

        // Gerar páginas do diário para cada mês
        options.months.forEach(({ month, year }) => {
          generateLogbookPage(doc, options.entries, month, year);
        });

        // Gerar página de resumo por cliente
        generateClientSummaryPage(doc, options.entries, options.months);

        // Converter para blob
        const blob = doc.output('blob');
        resolve(blob);
      };

      if (options.logoUrl) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            logoDataUrl = canvas.toDataURL('image/png');
          }
          generateDocument();
        };
        img.onerror = () => {
          generateDocument(); // Continuar sem logo
        };
        img.crossOrigin = 'anonymous';
        img.src = options.logoUrl;
      } else {
        generateDocument();
      }
    } catch (error) {
      reject(error);
    }
  });
};

export const downloadLogbookPDF = async (options: ExportOptions) => {
  try {
    const blob = await generateLogbookPDF(options);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const monthsStr = options.months
      .map(m => `${m.month}-${m.year}`)
      .join('_');
    a.href = url;
    a.download = `diario-bordo-${options.aircraftRegistration}-${monthsStr}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro ao baixar PDF:', error);
    throw error;
  }
};

export const openLogbookPDFInNewWindow = async (options: ExportOptions) => {
  try {
    const blob = await generateLogbookPDF(options);
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (error) {
    console.error('Erro ao abrir PDF:', error);
    throw error;
  }
};
