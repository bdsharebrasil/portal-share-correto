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

  if (options.clientName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Cliente: ${options.clientName}`, pageWidth / 2, 160, { align: 'center' });
  }

  // Período
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const monthsText = options.months
    .map(m => `${MONTHS[m.month - 1]}/${m.year}`)
    .join(', ');
  doc.text(`Período: ${monthsText}`, pageWidth / 2, 185, { align: 'center' });

  // Data de emissão
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  doc.text(`Emitido em: ${dateStr}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
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
      entry.ac_time || '-',
      entry.dep_time || '-',
      entry.pou_time || '-',
      entry.cor_time || '-',
      decimalToHHMM(entry.total_time),
      decimalToHHMM(entry.day_time),
      decimalToHHMM(entry.night_hours),
      decimalToHHMM(entry.ifr_time),
      entry.pousos ? entry.pousos.toString() : '-',
      entry.fuel_added ? `${entry.fuel_added}L` : '-',
      decimalToHHMM(entry.celula),
      entry.distance_nm ? `${entry.distance_nm}nm` : '-'
    ]);

  // Criar tabela
  autoTable(doc, {
    startY: 25,
    head: [
      [
        'Data',
        'Origem',
        'Destino',
        'AC',
        'DEP',
        'POU',
        'COR',
        'Tempo Voo',
        'Diurno',
        'Noturno',
        'IFR',
        'Pousos',
        'Combustível',
        'Célula',
        'Distância'
      ]
    ],
    body: tableData,
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 16 },
      8: { halign: 'center', cellWidth: 16 },
      9: { halign: 'center', cellWidth: 16 },
      10: { halign: 'center', cellWidth: 12 },
      11: { halign: 'center', cellWidth: 12 },
      12: { halign: 'center', cellWidth: 16 },
      13: { halign: 'center', cellWidth: 16 },
      14: { halign: 'center', cellWidth: 16 }
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

      const generateDocument = () => {
        // Gerar capa
        generateCoverPage(doc, options, logoDataUrl);

        // Gerar páginas do diário para cada mês
        options.months.forEach(({ month, year }) => {
          generateLogbookPage(doc, options.entries, month, year);
        });

        // Converter para blob
        doc.output('blob').then(blob => {
          resolve(blob);
        }).catch(reject);
      };
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
