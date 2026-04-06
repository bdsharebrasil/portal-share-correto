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
  time?: number;
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
  client_partner_id?: string;
  is_equal_split?: boolean;
  is_loan?: boolean;
  daily_rate?: number;
  loan_recipient_client_id?: string;
  loan_recipient_client_name?: string;
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

  if (logoDataUrl) {
    const logoSize = 50;
    const x = (pageWidth - logoSize) / 2;
    doc.addImage(logoDataUrl, 'PNG', x, 30, logoSize, logoSize);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('DIÁRIO DE BORDO', pageWidth / 2, 100, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Aeronave: ${options.aeronaveRegistration}`, pageWidth / 2, 130, { align: 'center' });

  if (options.aeronaveModel) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(options.aeronaveModel, pageWidth / 2, 140, { align: 'center' });
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const monthsText = options.months
    .map(m => `${MONTHS[m.month - 1]}/${m.year}`)
    .join(', ');
  doc.text(`Período: ${monthsText}`, pageWidth / 2, 160, { align: 'center' });
};

const generateLogbookPage = (doc: jsPDF, entries: LogbookEntry[], month: number, year: number): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.addPage();

  doc.setFillColor(30, 58, 138);
  doc.rect(10, 10, pageWidth - 20, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${MONTHS[month - 1]} de ${year} - Diário de Bordo`, pageWidth / 2, 17, { align: 'center' });

  const filteredEntries = entries
    .filter(e => {
      const date = new Date(e.entry_date);
      return date.getUTCMonth() + 1 === month && date.getUTCFullYear() === year;
    })
    .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

  const tableData = filteredEntries.map(entry => [
    formatDateBR(entry.entry_date),
    entry.departure_aerodrome || '-',
    entry.arrival_aerodrome || '-',
    entry.ac_time ? entry.ac_time.substring(0, 5) : '-',
    entry.dep_time ? entry.dep_time.substring(0, 5) : '-',
    entry.pou_time ? entry.pou_time.substring(0, 5) : '-',
    entry.cor_time ? entry.cor_time.substring(0, 5) : '-',
    decimalToHHMM(entry.time || entry.total_time),
    decimalToHHMM(entry.day_time),
    decimalToHHMM(entry.night_hours),
    decimalToHHMM(entry.ifr_time),
    entry.pousos || '0',
    entry.fuel_added ? `${entry.fuel_added}L` : '-',
    entry.celula ? entry.celula.toFixed(1) : '-',
    entry.pic_name || '-',
    entry.client_company_name || entry.nome_socio || '-',
  ]);

  let finalY = 25;

  autoTable(doc, {
    startY: 25,
    head: [[
      'DATA', 'DE', 'PARA', 'AC', 'DEP', 'POU', 'COR', 'T.VOO', 'DIA', 'NOITE', 'IFR', 'PSOS', 'FUEL', 'CÉLULA', 'PIC', 'VOO PARA'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 6.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.1,
      cellPadding: 1.5,
    },
    bodyStyles: {
      fontSize: 6.5,
      halign: 'center',
      textColor: [50, 50, 50],
      cellPadding: 1.2,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250]
    },
    columnStyles: {
      0: { cellWidth: 11 },
      1: { cellWidth: 11 },
      2: { cellWidth: 11 },
      3: { cellWidth: 11 },
      4: { cellWidth: 11 },
      5: { cellWidth: 11 },
      6: { cellWidth: 11 },
      7: { cellWidth: 12 },
      8: { cellWidth: 11 },
      9: { cellWidth: 11 },
      10: { cellWidth: 11 },
      11: { cellWidth: 9 },
      12: { cellWidth: 12 },
      13: { cellWidth: 14 },
      14: { cellWidth: 28, halign: 'left', fontSize: 6 },
      15: { cellWidth: 'auto', halign: 'left', fontSize: 6 },
    },
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${pageCount}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 10);
    },
    didParseCell: () => {
      // Reset text color after header
      doc.setTextColor(0, 0, 0);
    }
  });

  // Get finalY from autoTable
  finalY = (doc as any).lastAutoTable?.finalY || 25;

  // --- Draw partner/client summary below the table if space available ---
  const pageHeight = doc.internal.pageSize.getHeight();
  const spaceNeeded = 35; // approximate space for summary section

  // Calculate partner totals for this month
  const partnerTotals: Record<string, { name: string; hours: number; voos: number }> = {};
  const clientTotals: Record<string, { name: string; hours: number; voos: number }> = {};
  let hasPartners = false;

  filteredEntries.forEach(entry => {
    const partnerName = entry.nome_socio;
    if (partnerName) {
      hasPartners = true;
      const key = partnerName;
      if (!partnerTotals[key]) {
        partnerTotals[key] = { name: partnerName, hours: 0, voos: 0 };
      }
      partnerTotals[key].hours += entry.total_time || 0;
      partnerTotals[key].voos += 1;
    } else {
      // For loans, use the recipient client; otherwise the owner client
      const clientId = entry.is_loan ? entry.loan_recipient_client_id : entry.cliente_id;
      const clientName = entry.is_loan
        ? (entry.loan_recipient_client_name || entry.client_company_name || 'Sem Cliente')
        : (entry.client_company_name || 'Sem Cliente');

      if (!clientTotals[clientId]) {
        clientTotals[clientId] = { name: clientName, hours: 0, voos: 0 };
      }
      clientTotals[clientId].hours += entry.total_time || 0;
      clientTotals[clientId].voos += 1;
    }
  });

  // Merge: if has partners, use partnerTotals; otherwise clientTotals
  const summaryData = hasPartners ? partnerTotals : clientTotals;
  const summaryEntries = Object.values(summaryData).sort((a, b) => b.hours - a.hours);

  if (summaryEntries.length > 0 && (finalY + spaceNeeded) < pageHeight - 15) {
    const summaryStartY = finalY + 8;

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Section header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(hasPartners ? 'HORAS POR SÓCIO' : 'HORAS POR CLIENTE', 10, summaryStartY);

    // Draw summary as small table
    const summaryTableData = summaryEntries.map(s => [
      s.nome,
      s.voos.toString(),
      decimalToHHMM(s.hours)
    ]);

    // Total row
    const totalHours = summaryEntries.reduce((sum, s) => sum + s.hours, 0);
    const totalFlights = summaryEntries.reduce((sum, s) => sum + s.voos, 0);
    summaryTableData.push(['TOTAL', totalFlights.toString(), decimalToHHMM(totalHours)]);

    autoTable(doc, {
      startY: summaryStartY + 3,
      head: [[hasPartners ? 'Sócio' : 'Cliente', 'Voos', 'Horas']],
      body: summaryTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        halign: 'center',
        textColor: [50, 50, 50],
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 80 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 25 },
      },
      tableWidth: 130,
      margin: { left: 10 },
    });
  }

  return finalY;
};

export const generateLogbookPDF = async (options: ExportOptions): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      let logoDataUrl: string | undefined;

      const generateDocument = () => {
        generateCoverPage(doc, options, logoDataUrl);

        options.months.forEach(({ month, year }) => {
          generateLogbookPage(doc, options.entries, month, year);
        });

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
          generateDocument();
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
    a.download = `diario-bordo-${options.aeronaveRegistration}-${monthsStr}.pdf`;
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
