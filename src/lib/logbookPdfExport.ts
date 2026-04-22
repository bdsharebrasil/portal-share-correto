import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Cor primária (azul escuro semelhante ao da imagem de referência)
const HEADER_COLOR: [number, number, number] = [30, 58, 95];
const ALT_ROW_COLOR: [number, number, number] = [240, 244, 250];
const ACCENT_BLUE: [number, number, number] = [0, 119, 182];

const decimalToHHMM = (decimal?: number | null): string => {
  if (!decimal || decimal === 0) return '-';
  const total = Math.abs(decimal);
  const hours = Math.floor(total);
  const minutes = Math.round((total - hours) * 60);
  const sign = decimal < 0 ? '-' : '';
  return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const formatTime = (timeStr?: string | null): string => {
  if (!timeStr) return '-';
  // Pode vir como "HH:MM:SS" ou ISO timestamp
  if (typeof timeStr === 'string' && timeStr.includes('T')) {
    try {
      const d = new Date(timeStr);
      const h = d.getUTCHours().toString().padStart(2, '0');
      const m = d.getUTCMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    } catch {
      return '-';
    }
  }
  return timeStr.substring(0, 5);
};

const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
};

interface LogbookEntry {
  id: string;
  entry_date: string;
  departure_aerodrome?: string;
  arrival_aerodrome?: string;
  ac_time?: string;
  dep_time?: string;
  pou_time?: string;
  cor_time?: string;
  time?: number;
  day_time?: number;
  night_hours?: number;
  ifr_time?: number;
  total_time?: number;
  pousos?: number;
  fuel_added?: number;
  fuel_liters?: number;
  pic_canac?: string;
  sic_canac?: string;
  sic_name?: string;
  pic_name?: string;
  trecho?: string;
  client_id?: string;
  client_company_name?: string;
  partner_name?: string;
  is_loan?: boolean;
  is_equal_split?: boolean;
  loan_recipient_client_id?: string;
  loan_recipient_client_name?: string;
  daily_quantity?: number;
  daily_rate?: number;
}

interface ExportOptions {
  months: Array<{ month: number; year: number }>;
  aircraftRegistration: string;
  aircraftModel?: string;
  clientName?: string;
  entries: LogbookEntry[];
  logoUrl?: string;
}

const loadImageAsDataUrl = (url: string): Promise<string | undefined> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(undefined);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
};

// ============= COVER =============
const generateCoverPage = (
  doc: jsPDF,
  options: ExportOptions,
  logoDataUrl?: string
) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Logo centralizado no topo
  if (logoDataUrl) {
    const logoSize = 60;
    const x = (pageWidth - logoSize) / 2;
    doc.addImage(logoDataUrl, 'PNG', x, 50, logoSize, logoSize);
  }

  // Título "DIARIO DE BORDO"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.setTextColor(20, 30, 50);
  const titleY = logoDataUrl ? 130 : 90;
  doc.text('DIARIO DE BORDO', pageWidth / 2, titleY, { align: 'center' });

  // Matrícula em destaque
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(20, 30, 50);
  doc.text(options.aircraftRegistration || '-', pageWidth / 2, titleY + 18, {
    align: 'center',
  });

  // Período (mês e ano)
  const monthsText = options.months
    .map((m) => `${MONTHS[m.month - 1]}`)
    .join(' E ');
  const yearText =
    options.months.length > 0
      ? options.months[options.months.length - 1].year
      : '';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `MÊS ${monthsText.toUpperCase()} ${yearText}`,
    pageWidth / 2,
    titleY + 50,
    { align: 'center' }
  );

  if (options.aircraftModel) {
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text(options.aircraftModel, pageWidth / 2, titleY + 62, {
      align: 'center',
    });
  }
};

// ============= MONTH HEADER (top right) =============
const drawMonthHeader = (doc: jsPDF, month: number, year: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...HEADER_COLOR);
  doc.text(
    `${MONTHS[month - 1].toUpperCase()} / ${year}`,
    pageWidth - 14,
    18,
    { align: 'right' }
  );
};

// ============= MONTHLY DETAIL TABLE =============
const generateMonthDetailPage = (
  doc: jsPDF,
  entries: LogbookEntry[],
  month: number,
  year: number,
  hasDailyRate: boolean
): number => {
  doc.addPage('a4', 'landscape');
  drawMonthHeader(doc, month, year);

  const filtered = entries
    .filter((e) => {
      if (!e.entry_date) return false;
      const [y, m] = e.entry_date.split('-');
      return parseInt(m) === month && parseInt(y) === year;
    })
    .sort(
      (a, b) =>
        new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

  // Totais
  const totals = {
    tvoo: 0,
    tdia: 0,
    tnoit: 0,
    ifr: 0,
    pousos: 0,
    abast: 0,
    fuel: 0,
    diarias: 0,
    diariasValor: 0,
  };

  const tableData = filtered.map((entry, idx) => {
    const tvoo = entry.time || 0;
    const tdia = entry.day_time || 0;
    const tnoit = entry.night_hours || 0;
    const ifr = entry.ifr_time || 0;
    const pousos = entry.pousos || 0;
    const abast = entry.fuel_added || 0;
    const fuel = entry.fuel_liters || 0;
    const diarias = entry.daily_quantity || 0;
    const diariasValor = (entry.daily_rate || 0) * (diarias || 0);

    totals.tvoo += tvoo;
    totals.tdia += tdia;
    totals.tnoit += tnoit;
    totals.ifr += ifr;
    totals.pousos += pousos;
    totals.abast += abast;
    totals.fuel += fuel;
    totals.diarias += diarias;
    totals.diariasValor += diariasValor;

    const row = [
      String(idx + 1),
      formatDateBR(entry.entry_date),
      entry.departure_aerodrome || '-',
      entry.arrival_aerodrome || '-',
      formatTime(entry.ac_time),
      formatTime(entry.dep_time),
      formatTime(entry.pou_time),
      formatTime(entry.cor_time),
      decimalToHHMM(tvoo),
      decimalToHHMM(tdia),
      decimalToHHMM(tnoit),
      decimalToHHMM(ifr),
      pousos > 0 ? String(pousos) : '-',
      abast > 0 ? Math.round(abast).toString() : '0',
      fuel > 0 ? Math.round(fuel).toString() : '-',
      (entry.pic_name || '').split(' ')[0] || '-',
      (entry.sic_name || '').split(' ')[0] || '—',
      entry.client_company_name || '—',
    ];

    if (hasDailyRate) {
      row.push(diarias > 0 ? String(diarias) : '—');
    }

    return row;
  });

  // Linha de TOTAIS
  const totalsRow: any[] = [
    '',
    '',
    '',
    '',
    { content: 'TOTAIS', styles: { fontStyle: 'bold', halign: 'center' } },
    '',
    '',
    '',
    decimalToHHMM(totals.tvoo),
    decimalToHHMM(totals.tdia),
    decimalToHHMM(totals.tnoit),
    decimalToHHMM(totals.ifr),
    String(totals.pousos),
    Math.round(totals.abast).toLocaleString('pt-BR'),
    Math.round(totals.fuel).toLocaleString('pt-BR'),
    '',
    '',
    '',
  ];

  if (hasDailyRate) {
    totalsRow.push(
      `${totals.diarias} / R$${totals.diariasValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    );
  }

  const headers = [
    '#', 'DATA', 'DE', 'PARA', 'AC', 'DEP', 'POU', 'COR',
    'T VOO', 'T DIA', 'T NOIT', 'IFR', 'POUSOS', 'ABAST+', 'FUEL',
    'PIC', 'SIC', 'VOO PARA',
  ];

  if (hasDailyRate) headers.push('DIÁRIAS');

  autoTable(doc, {
    startY: 25,
    head: [headers],
    body: [...tableData, totalsRow],
    theme: 'grid',
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.1,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7,
      halign: 'center',
      textColor: [40, 40, 40],
      cellPadding: 1.5,
      lineColor: [220, 225, 235],
    },
    alternateRowStyles: { fillColor: ALT_ROW_COLOR },
    didParseCell: (data) => {
      // Última linha = totais
      const isLast = data.row.index === tableData.length;
      if (isLast && data.section === 'body') {
        data.cell.styles.fillColor = HEADER_COLOR;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
      // Cor azul nas colunas de tempo
      const timeCols = [4, 5, 6, 7, 8, 9, 10, 11];
      if (
        !isLast &&
        data.section === 'body' &&
        timeCols.includes(data.column.index)
      ) {
        data.cell.styles.textColor = ACCENT_BLUE;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 8, right: 8 },
  });

  return (doc as any).lastAutoTable?.finalY || 25;
};

// ============= MONTHLY TRECHO/SUMMARY =============
const generateMonthTrechoTable = (
  doc: jsPDF,
  entries: LogbookEntry[],
  month: number,
  year: number,
  startY: number,
  hasDailyRate: boolean
) => {
  const pageHeight = doc.internal.pageSize.getHeight();

  const filtered = entries
    .filter((e) => {
      if (!e.entry_date) return false;
      const [y, m] = e.entry_date.split('-');
      return parseInt(m) === month && parseInt(y) === year;
    })
    .sort(
      (a, b) =>
        new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

  // Se não há espaço, nova página
  let cursorY = startY + 12;
  if (cursorY > pageHeight - 60) {
    doc.addPage('a4', 'landscape');
    drawMonthHeader(doc, month, year);
    cursorY = 25;
  }

  const headers = ['#', 'DATA', 'TRECHO', 'DEP', 'POU', 'T VOO', 'VOO PARA'];
  if (hasDailyRate) headers.push('DIÁRIAS');

  const body = filtered.map((entry, idx) => {
    const row = [
      String(idx + 1),
      formatDateBR(entry.entry_date),
      entry.trecho || `${entry.departure_aerodrome || ''} x ${entry.arrival_aerodrome || ''}`,
      formatTime(entry.dep_time),
      formatTime(entry.pou_time),
      decimalToHHMM(entry.time),
      entry.client_company_name || '—',
    ];
    if (hasDailyRate) {
      const d = entry.daily_quantity || 0;
      row.push(d > 0 ? String(d) : '—');
    }
    return row;
  });

  autoTable(doc, {
    startY: cursorY,
    head: [headers],
    body,
    theme: 'grid',
    headStyles: {
      fillColor: ACCENT_BLUE,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      textColor: [40, 40, 40],
      cellPadding: 1.8,
    },
    alternateRowStyles: { fillColor: ALT_ROW_COLOR },
    columnStyles: {
      2: { halign: 'left', cellWidth: 'auto' },
      6: { halign: 'left' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = ACCENT_BLUE;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 8, right: 8 },
  });
};

// ============= FINAL CONSOLIDATED SUMMARY =============
const generateConsolidatedSummary = (
  doc: jsPDF,
  options: ExportOptions,
  hasDailyRate: boolean
) => {
  doc.addPage('a4', 'landscape');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...HEADER_COLOR);

  const monthsText = options.months
    .map((m) => `${MONTHS[m.month - 1].toUpperCase()}`)
    .join(' + ');
  const yearText =
    options.months.length > 0
      ? options.months[options.months.length - 1].year
      : '';

  doc.text(
    `RESUMO GERAL — ${monthsText} ${yearText}`,
    pageWidth / 2,
    18,
    { align: 'center' }
  );

  // ====== Tabela 1: por CLIENTE × MÊS ======
  type Bucket = {
    cliente: string;
    mes: string;
    voos: number;
    pousos: number;
    tvoo: number;
    tdia: number;
    ifr: number;
    abast: number;
    fuel: number;
    diariasValor: number;
  };

  // Agrupar por cliente + mês
  const buckets = new Map<string, Bucket>();
  const monthBuckets = new Map<string, Omit<Bucket, 'cliente'>>();

  options.months.forEach(({ month, year }) => {
    const filtered = options.entries.filter((e) => {
      if (!e.entry_date) return false;
      const [y, m] = e.entry_date.split('-');
      return parseInt(m) === month && parseInt(y) === year;
    });

    const monthLabel = `${MONTHS[month - 1]} ${year}`;

    // Por mês total
    const mb: Omit<Bucket, 'cliente'> = {
      mes: monthLabel,
      voos: 0,
      pousos: 0,
      tvoo: 0,
      tdia: 0,
      ifr: 0,
      abast: 0,
      fuel: 0,
      diariasValor: 0,
    };

    filtered.forEach((e) => {
      const cliente = e.client_company_name || 'Sem Cliente';
      const key = `${cliente}|${monthLabel}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          cliente,
          mes: monthLabel,
          voos: 0,
          pousos: 0,
          tvoo: 0,
          tdia: 0,
          ifr: 0,
          abast: 0,
          fuel: 0,
          diariasValor: 0,
        });
      }
      const b = buckets.get(key)!;
      b.voos += 1;
      b.pousos += e.pousos || 0;
      b.tvoo += e.time || 0;
      b.tdia += e.day_time || 0;
      b.ifr += e.ifr_time || 0;
      b.abast += e.fuel_added || 0;
      b.fuel += e.fuel_liters || 0;
      b.diariasValor += (e.daily_rate || 0) * (e.daily_quantity || 0);

      mb.voos += 1;
      mb.pousos += e.pousos || 0;
      mb.tvoo += e.time || 0;
      mb.tdia += e.day_time || 0;
      mb.ifr += e.ifr_time || 0;
      mb.abast += e.fuel_added || 0;
      mb.fuel += e.fuel_liters || 0;
      mb.diariasValor += (e.daily_rate || 0) * (e.daily_quantity || 0);
    });

    monthBuckets.set(monthLabel, mb);
  });

  // ----- Tabela 1: agrupado por cliente -----
  const headers1 = [
    'CLIENTE', 'MÊS', 'Nº VOOS', 'POUSOS',
    'T VOO (h)', 'T DIA (h)', 'IFR (h)',
    'ABAST+ (L)', 'FUEL (L)',
  ];
  if (hasDailyRate) headers1.push('DIÁRIAS (R$)');

  // Agrupar por cliente para gerar TOTAL por cliente
  const clientesMap = new Map<string, Bucket[]>();
  buckets.forEach((b) => {
    if (!clientesMap.has(b.cliente)) clientesMap.set(b.cliente, []);
    clientesMap.get(b.cliente)!.push(b);
  });

  const body1: any[] = [];
  Array.from(clientesMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([cliente, rows]) => {
      const sortedRows = rows.sort(
        (a, b) =>
          options.months.findIndex(
            (m) => `${MONTHS[m.month - 1]} ${m.year}` === a.mes
          ) -
          options.months.findIndex(
            (m) => `${MONTHS[m.month - 1]} ${m.year}` === b.mes
          )
      );
      sortedRows.forEach((b) => {
        const row: any[] = [
          b.cliente,
          b.mes,
          String(b.voos),
          String(b.pousos),
          decimalToHHMM(b.tvoo),
          decimalToHHMM(b.tdia),
          decimalToHHMM(b.ifr),
          Math.round(b.abast).toLocaleString('pt-BR'),
          Math.round(b.fuel).toLocaleString('pt-BR'),
        ];
        if (hasDailyRate) {
          row.push(`R$${b.diariasValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
        }
        body1.push(row);
      });

      // Total por cliente (se mais de 1 mês)
      if (sortedRows.length > 1) {
        const t = sortedRows.reduce(
          (acc, b) => ({
            voos: acc.voos + b.voos,
            pousos: acc.pousos + b.pousos,
            tvoo: acc.tvoo + b.tvoo,
            tdia: acc.tdia + b.tdia,
            ifr: acc.ifr + b.ifr,
            abast: acc.abast + b.abast,
            fuel: acc.fuel + b.fuel,
            diariasValor: acc.diariasValor + b.diariasValor,
          }),
          { voos: 0, pousos: 0, tvoo: 0, tdia: 0, ifr: 0, abast: 0, fuel: 0, diariasValor: 0 }
        );
        const totalRow: any[] = [
          { content: `${cliente} — TOTAL`, styles: { fontStyle: 'bold' } },
          '',
          String(t.voos),
          String(t.pousos),
          decimalToHHMM(t.tvoo),
          decimalToHHMM(t.tdia),
          decimalToHHMM(t.ifr),
          Math.round(t.abast).toLocaleString('pt-BR'),
          Math.round(t.fuel).toLocaleString('pt-BR'),
        ];
        if (hasDailyRate) {
          totalRow.push(`R$${t.diariasValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
        }
        body1.push(totalRow);
      }
    });

  autoTable(doc, {
    startY: 28,
    head: [headers1],
    body: body1,
    theme: 'grid',
    headStyles: {
      fillColor: HEADER_COLOR,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      textColor: [40, 40, 40],
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: ALT_ROW_COLOR },
    didParseCell: (data) => {
      const cellValue = data.cell.raw as any;
      const isTotal =
        typeof cellValue === 'object' &&
        cellValue?.content?.toString?.().includes('TOTAL');
      const rowData: any[] = (data.row.raw as any[]) || [];
      const rowHasTotal = rowData.some(
        (c: any) =>
          typeof c === 'object' &&
          c?.content?.toString?.().includes('TOTAL')
      );
      if (rowHasTotal && data.section === 'body') {
        data.cell.styles.fillColor = HEADER_COLOR;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ----- Tabela 2: TOTAL GERAL por mês -----
  const finalY1 = (doc as any).lastAutoTable?.finalY || 50;
  const headers2 = [
    'MÊS', 'Nº VOOS', 'POUSOS',
    'T VOO (h)', 'T DIA (h)', 'IFR (h)',
    'ABAST+ (L)', 'FUEL (L)',
  ];
  if (hasDailyRate) headers2.push('DIÁRIAS (R$)');

  const body2: any[] = [];
  let totalGeral = {
    voos: 0,
    pousos: 0,
    tvoo: 0,
    tdia: 0,
    ifr: 0,
    abast: 0,
    fuel: 0,
    diariasValor: 0,
  };

  options.months.forEach(({ month, year }) => {
    const monthLabel = `${MONTHS[month - 1]} ${year}`;
    const mb = monthBuckets.get(monthLabel);
    if (!mb) return;
    const row: any[] = [
      monthLabel,
      String(mb.voos),
      String(mb.pousos),
      decimalToHHMM(mb.tvoo),
      decimalToHHMM(mb.tdia),
      decimalToHHMM(mb.ifr),
      Math.round(mb.abast).toLocaleString('pt-BR'),
      Math.round(mb.fuel).toLocaleString('pt-BR'),
    ];
    if (hasDailyRate) {
      row.push(`R$${mb.diariasValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
    }
    body2.push(row);
    totalGeral.voos += mb.voos;
    totalGeral.pousos += mb.pousos;
    totalGeral.tvoo += mb.tvoo;
    totalGeral.tdia += mb.tdia;
    totalGeral.ifr += mb.ifr;
    totalGeral.abast += mb.abast;
    totalGeral.fuel += mb.fuel;
    totalGeral.diariasValor += mb.diariasValor;
  });

  const totalGeralRow: any[] = [
    { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' } },
    String(totalGeral.voos),
    String(totalGeral.pousos),
    decimalToHHMM(totalGeral.tvoo),
    decimalToHHMM(totalGeral.tdia),
    decimalToHHMM(totalGeral.ifr),
    Math.round(totalGeral.abast).toLocaleString('pt-BR'),
    Math.round(totalGeral.fuel).toLocaleString('pt-BR'),
  ];
  if (hasDailyRate) {
    totalGeralRow.push(
      `R$${totalGeral.diariasValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    );
  }
  body2.push(totalGeralRow);

  autoTable(doc, {
    startY: finalY1 + 12,
    head: [headers2],
    body: body2,
    theme: 'grid',
    headStyles: {
      fillColor: ACCENT_BLUE,
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
      textColor: [40, 40, 40],
      cellPadding: 2,
    },
    alternateRowStyles: { fillColor: ALT_ROW_COLOR },
    didParseCell: (data) => {
      const isLast = data.row.index === body2.length - 1;
      if (isLast && data.section === 'body') {
        data.cell.styles.fillColor = HEADER_COLOR;
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14, right: 14 },
  });
};

// ============= MAIN =============
export const generateLogbookPDF = async (
  options: ExportOptions
): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Carregar logo
  let logoDataUrl: string | undefined;
  if (options.logoUrl) {
    logoDataUrl = await loadImageAsDataUrl(options.logoUrl);
  }

  // Capa
  generateCoverPage(doc, options, logoDataUrl);

  // Detectar se há diárias em algum lançamento
  const hasDailyRate = options.entries.some(
    (e) => (e.daily_quantity || 0) > 0 || (e.daily_rate || 0) > 0
  );

  // Páginas mensais (DETALHE + TRECHO logo abaixo)
  options.months.forEach(({ month, year }) => {
    const finalY = generateMonthDetailPage(
      doc,
      options.entries,
      month,
      year,
      hasDailyRate
    );
    generateMonthTrechoTable(
      doc,
      options.entries,
      month,
      year,
      finalY,
      hasDailyRate
    );
  });

  // Última página: resumo geral
  generateConsolidatedSummary(doc, options, hasDailyRate);

  return doc.output('blob');
};

export const downloadLogbookPDF = async (options: ExportOptions) => {
  const blob = await generateLogbookPDF(options);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const monthsStr = options.months.map((m) => `${m.month}-${m.year}`).join('_');
  a.href = url;
  a.download = `diario-bordo-${options.aircraftRegistration}-${monthsStr}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const openLogbookPDFInNewWindow = async (options: ExportOptions) => {
  const blob = await generateLogbookPDF(options);
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
};
