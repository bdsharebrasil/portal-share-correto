import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { num } from "@/lib/formatters";

const monthNames = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export interface DiarioPDFData {
  aeronave: {
    matricula: string;
    modelo: string;
    ano?: string | null;
  };
  meses: Array<{
    mes: number;
    ano: number;
    lancamentos: any[];
    totals: {
      tVoo: number;
      tTotal: number;
      tDia: number;
      tNoit: number;
      ifr: number;
      pousos: number;
      abast: number;
      fuel: number;
      totalDiarias: number;
    };
    porCotista: Array<{ label: string; horas: number }>;
    temDiaria: boolean;
  }>;
}

// ─── PALETTE (matches the Excel/JPEG we built) ──────────────────
type RGB = [number, number, number];
const COLOR: Record<string, RGB> = {
  navyDark:  [30,  58,  95],   // #1E3A5F — header bg, total row bg
  navyMed:   [46,  94, 163],   // #2E5EA3 — sub-header bg
  cyanText:  [0,  168, 214],   // #00A8D6 — time columns
  rowAlt:    [239, 244, 251],  // #EFF4FB — alternating row
  rowWhite:  [255, 255, 255],  // #FFFFFF
  darkText:  [30,  58,  95],   // #1E3A5F — body text
  white:     [255, 255, 255],
  border:    [197, 216, 239],  // #C5D8EF
};

// Column indices (0-based) that hold time values → rendered in cyan
const TIME_COLS_DETAIL  = new Set([8, 9, 10, 11]);   // T VOO, T DIA, T NOIT, IFR
const TIME_COLS_SUMMARY = new Set([5]);               // T VOO in summary table

function applyTableStyles(
  pdf: any,
  tableColumns: string[],
  tableData: any[][],
  startY: number, 
  timeCols: Set<number>,
  headerFill: RGB = COLOR.navyDark,
  opts: Record<string, any> = {}
) {
  const pageWidth = pdf.internal.pageSize.getWidth();

  autoTable(pdf, {
      columns: tableColumns.map((c) => ({ header: c, key: c.toLowerCase() })),
      body: tableData,
      startY: startY, // ✅ CORRIGIDO
      tableWidth: pageWidth - 20,
      margin: { left: 10, right: 10, top: 10, bottom: 15 },

    // ── Global cell style ──────────────────────────────────────
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      textColor: COLOR.darkText,
      lineColor: COLOR.border,
      lineWidth: 0.25,
      overflow: "linebreak",
      valign: "middle",
    },

    // ── Header row ─────────────────────────────────────────────
    headStyles: {
      fillColor: headerFill,
      textColor: COLOR.white,
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
    },

    // ── Alternating rows ───────────────────────────────────────
    alternateRowStyles: {
      fillColor: COLOR.rowAlt,
    },

    // ── Per-cell overrides ─────────────────────────────────────
    didParseCell(data: any) {
      const { row, column, cell, section } = data;
      if (section === "head") return;

      const isLastRow = row.index === tableData.length - 1;

      // Total row → navy bg, white text, cyan for time cols
      if (isLastRow) {
        cell.styles.fillColor = COLOR.navyDark;
        cell.styles.textColor = timeCols.has(column.index)
          ? COLOR.cyanText
          : COLOR.white;
        cell.styles.fontStyle = "bold";
        return;
      }

      // Time columns → cyan text
      if (timeCols.has(column.index)) {
        cell.styles.textColor = COLOR.cyanText;
        cell.styles.fontStyle = "bold";
      }

      // Diárias column (last col) → navy bold when numeric
      const val = String(cell.raw ?? "");
      if (column.index === tableColumns.length - 1 && /^\d/.test(val)) {
        cell.styles.textColor = COLOR.navyDark;
        cell.styles.fontStyle = "bold";
      }
    },

    // ── Column alignment ───────────────────────────────────────
    columnStyles: buildColumnStyles(tableColumns, timeCols),

    // Prevent table from being split across pages — draws full table
    // on a new page if it doesn't fit
    pageBreak: "auto",
    rowPageBreak: "avoid",

    ...opts,
  });
}

function buildColumnStyles(
  cols: string[],
  timeCols: Set<number>
): Record<number, any> {
  const styles: Record<number, any> = {};
  cols.forEach((col, i) => {
    const isTime = timeCols.has(i);
    const isText = ["De", "Para", "PIC", "SIC", "VOO PARA", "TRECHO", "CLIENTE"].includes(col);
    styles[i] = {
      halign: isText ? "left" : "center",
      cellWidth: isText ? "auto" : undefined,
    };
  });
  return styles;
}

// ─── Load logo robustly ──────────────────────────────────────────
async function loadLogo(logoUrl: string): Promise<string | undefined> {
  if (!logoUrl) return undefined;
  try {
    // Support both relative paths and full URLs
    const url = logoUrl.startsWith("http")
      ? logoUrl
      : `${window.location.origin}/${logoUrl.replace(/^\//, "")}`;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Logo não carregada, continuando sem ela:", e);
    return undefined;
  }
}

// ─── Draw cover page for a month ────────────────────────────────
function drawCover(
  pdf: jsPDF,
  mesData: DiarioPDFData["meses"][number],
  aeronave: DiarioPDFData["aeronave"],
  logoImg?: string
) {
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  let y = 18;

  // Navy top banner
  pdf.setFillColor(...(COLOR.navyDark));
  pdf.rect(0, 0, pw, 40, "F");

  if (logoImg) {
    try {
      pdf.addImage(logoImg, "PNG", pw / 2 - 15, 5, 30, 30);
    } catch {/* skip */}
  }

  y = 55;

  // Title
  pdf.setFontSize(26);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...(COLOR.navyDark));
  pdf.text("Diário de Bordo", pw / 2, y, { align: "center" });
  y += 14;

  // Thin divider line
  pdf.setDrawColor(...(COLOR.navyDark));
  pdf.setLineWidth(0.5);
  pdf.line(pw * 0.25, y, pw * 0.75, y);
  y += 12;

  // Aircraft info
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Matrícula: ${aeronave.matricula}`, pw / 2, y, { align: "center" });
  y += 9;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(
    `Modelo: ${aeronave.modelo}  |  Ano: ${aeronave.ano || "—"}`,
    pw / 2, y, { align: "center" }
  );
  y += 16;

  // Month / year badge
  pdf.setFillColor(...(COLOR.navyMed));
  pdf.roundedRect(pw / 2 - 45, y - 9, 90, 18, 3, 3, "F");
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...(COLOR.white));
  const monthName = monthNames[(mesData.mes - 1)] ?? "—";
  pdf.text(
    `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} de ${mesData.ano}`,
    pw / 2, y + 4, { align: "center" }
  );
}

// ─── Main export function ────────────────────────────────────────
export const exportDiarioBordoPDF = async (
  data: DiarioPDFData,
  logoUrl: string
): Promise<jsPDF> => {
  if (!data?.meses?.length)
    throw new Error("Nenhum dado de mês disponível para exportação");
  if (!data.aeronave?.matricula)
    throw new Error("Matrícula da aeronave não encontrada");

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const logoImg = await loadLogo(logoUrl);

  // ══════════════════════════════════════════════════════════════
  // Loop over months
  // ══════════════════════════════════════════════════════════════
  for (let i = 0; i < data.meses.length; i++) {
    const mesData = data.meses[i];
    if (i > 0) pdf.addPage();

    // ── COVER ───────────────────────────────────────────────────
    drawCover(pdf, mesData, data.aeronave, logoImg);

    // ── DETAIL TABLE PAGE ────────────────────────────────────────
    pdf.addPage();

    const monthLabel =
      monthNames[(mesData.mes - 1)]?.replace(/^\w/, (c) => c.toUpperCase()) ?? "—";

    // Page title
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...(COLOR.navyDark));
    pdf.text(
      `Registros de Voo — ${monthLabel} ${mesData.ano}`,
      pageWidth / 2, 14, { align: "center" }
    );

    // Build columns
    const detailCols = [
      "#", "Data", "De", "Para", "AC",
      "DEP", "POU", "COR",
      "T VOO", "T DIA", "T NOIT", "IFR",
      "POUSOS", "ABAST+", "FUEL", "CÉLULA",
      "PIC", "SIC", "VOO PARA",
    ];
    if (mesData.temDiaria) detailCols.push("DIÁRIAS");

    // Build rows
    const detailRows: any[][] = mesData.lancamentos.map((l, idx) => {
      const row: any[] = [
        String(idx + 1),
        l.data_registro    ?? "—",
        l.aerodromo_partida ?? "—",
        l.aerodromo_chegada ?? "—",
        l.tripulacao_checkin_hora ?? "—",
        l.tempo_dep  ?? "—",
        l.tempo_pou  ?? "—",
        l.tempo_cor  ?? "—",
        l.tempo_voo              ? num(l.tempo_voo, 2)                        : "—",
        l.horas_diurnas          ? num(l.horas_diurnas, 2)                    : "—",
        l.horas_noturnas         ? num(l.horas_noturnas, 2)                   : "—",
        l.tempo_ifr              ? num(l.tempo_ifr, 2)                        : "—",
        String(l.pousos_total ?? 0),
        l.combustivel_adicionado             ? num(l.combustivel_adicionado, 2)             : "—",
        l.litros_combustivel_inicio_voo      ? num(l.litros_combustivel_inicio_voo, 2)      : "—",
        l.celula                             ? num(l.celula, 2)                             : "—",
        l.pic?.nome_completo ?? "—",
        l.sic?.nome_completo ?? "—",
        l.natureza_voo ?? "—",
      ];
      if (mesData.temDiaria)
        row.push(l.tarifa_diaria ? num(l.tarifa_diaria, 2) : "—");
      return row;
    });

    // Total row — only fill time/numeric cols, leave others blank
    const t = mesData.totals;
    const totalRow: any[] = [
      "TOTAL", "", "", "", "", "", "", "",
      num(t.tVoo,   2),
      num(t.tDia,   2),
      num(t.tNoit,  2),
      num(t.ifr,    2),
      String(t.pousos),
      num(t.abast,  2),
      num(t.fuel,   2),
      "", "", "", "",
    ];
    if (mesData.temDiaria) totalRow.push(num(t.totalDiarias, 2));
    detailRows.push(totalRow);

    applyTableStyles(pdf, detailCols, detailRows, 20, TIME_COLS_DETAIL);

    // ── SUMMARY TABLE (same page if space, else new page) ────────
    const afterDetail = (pdf as any).lastAutoTable?.finalY ?? 200;
    let summaryY = afterDetail + 12;

    if (summaryY > pageHeight - 50) {
      pdf.addPage();
      summaryY = 16;
    }

    // Summary section title
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...(COLOR.navyDark));
    pdf.text("Resumo de Voos por Cliente", 10, summaryY);
    summaryY += 6;

    const summaryCols = ["#", "Data", "Trecho", "DEP", "POU", "T VOO", "VOO PARA", "DIÁRIAS"];

    // Build summary rows: one row per lancamento with city names resolved
    const icaoCity: Record<string, string> = {
      SBCY: "Cuiabá",
      SDPR: "Faz. Turazzi",
      SSQM: "Faz. Malibu",
      SBDO: "Dourados",
    };
    const resolve = (code: string) => icaoCity[code?.toUpperCase?.() ?? ""] ?? code ?? "—";

    const summaryRows: any[][] = mesData.lancamentos.map((l, idx) => {
      const de   = resolve(l.aerodromo_partida);
      const para = resolve(l.aerodromo_chegada);
      return [
        String(idx + 1),
        l.data_registro ?? "—",
        `${de} × ${para}`,
        l.tempo_dep ?? "—",
        l.tempo_pou ?? "—",
        l.tempo_voo ? num(l.tempo_voo, 2) : "—",
        l.natureza_voo ?? "—",
        mesData.temDiaria
          ? (l.tarifa_diaria ? num(l.tarifa_diaria, 2) : "—")
          : "—",
      ];
    });

    // Total row for summary
    summaryRows.push([
      "TOTAL", "", "", "", "",
      num(t.tVoo, 2),
      "",
      mesData.temDiaria ? num(t.totalDiarias, 2) : "—",
    ]);

    applyTableStyles(
      pdf, summaryCols, summaryRows, summaryY,
      TIME_COLS_SUMMARY,
      COLOR.navyMed,  // blue header for summary
      { tableWidth: (pageWidth - 20) * 0.75 } // narrower table
    );

    // ── POR COTISTA breakdown ────────────────────────────────────
    if (mesData.porCotista?.length) {
      const afterSummary = (pdf as any).lastAutoTable?.finalY ?? summaryY + 40;
      let cotY = afterSummary + 12;

      if (cotY > pageHeight - 40) {
        pdf.addPage();
        cotY = 16;
      }

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...(COLOR.navyDark));
      pdf.text("Horas por Cliente / Sócio", 10, cotY);
      cotY += 6;

      const cotCols  = ["Cliente / Sócio", "Horas Voadas"];
      const cotRows  = mesData.porCotista.map((c) => [c.label, num(c.horas, 2)]);

      applyTableStyles(
        pdf, cotCols, cotRows, cotY,
        new Set([1]),          // col 1 = horas → cyan
        COLOR.navyDark,
        { tableWidth: (pageWidth - 20) * 0.40 }
      );
    }
  }

  // ══════════════════════════════════════════════════════════════
  // CONSOLIDATED SUMMARY (multi-month)
  // ══════════════════════════════════════════════════════════════
  if (data.meses.length > 1) {
    pdf.addPage();
    let y = 18;

    // Navy banner
    pdf.setFillColor(...(COLOR.navyDark));
    pdf.rect(0, 0, pageWidth, 32, "F");
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...(COLOR.white));
    pdf.text("Resumo Consolidado", pageWidth / 2, 20, { align: "center" });

    y = 42;

    // Period
    const periodo = data.meses
      .map((m) => `${monthNames[m.mes - 1]} de ${m.ano}`)
      .join(", ");
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...(COLOR.darkText));
    pdf.text(`Período: ${periodo}`, 10, y);
    y += 10;

    // Accumulate totals
    const grand = {
      tVoo: 0, tDia: 0, tNoit: 0, ifr: 0,
      pousos: 0, abast: 0, fuel: 0, diarias: 0,
    };
    const cotMap = new Map<string, number>();

    for (const m of data.meses) {
      grand.tVoo    += m.totals.tVoo;
      grand.tDia    += m.totals.tDia;
      grand.tNoit   += m.totals.tNoit;
      grand.ifr     += m.totals.ifr;
      grand.pousos  += m.totals.pousos;
      grand.abast   += m.totals.abast;
      grand.fuel    += m.totals.fuel;
      grand.diarias += m.totals.totalDiarias;
      for (const c of m.porCotista) {
        cotMap.set(c.label, (cotMap.get(c.label) ?? 0) + c.horas);
      }
    }

    // By-month table
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Totais por Mês", 10, y);
    y += 6;

    const monthCols = ["Mês", "Nº Voos", "Pousos", "T VOO (h)", "T DIA (h)", "IFR (h)", "ABAST+ (L)", "FUEL (L)", "Diárias (R$)"];
    const monthRows = data.meses.map((m) => [
      `${monthNames[m.mes - 1]?.replace(/^\w/, (c) => c.toUpperCase())} ${m.ano}`,
      String(m.lancamentos.length),
      String(m.totals.pousos),
      num(m.totals.tVoo,  2),
      num(m.totals.tDia,  2),
      num(m.totals.ifr,   2),
      num(m.totals.abast, 2),
      num(m.totals.fuel,  2),
      num(m.totals.totalDiarias, 2),
    ]);
    // Grand total row
    monthRows.push([
      "TOTAL GERAL",
      String(data.meses.reduce((s, m) => s + m.lancamentos.length, 0)),
      String(grand.pousos),
      num(grand.tVoo,  2),
      num(grand.tDia,  2),
      num(grand.ifr,   2),
      num(grand.abast, 2),
      num(grand.fuel,  2),
      num(grand.diarias, 2),
    ]);

    applyTableStyles(
      pdf, monthCols, monthRows, y,
      new Set([3, 4, 5]),  // time cols cyan
      COLOR.navyDark
    );

    // By-client table
    const afterMonthTable = (pdf as any).lastAutoTable?.finalY ?? y + 60;
    let clientY = afterMonthTable + 14;

    if (clientY > pageHeight - 50) {
      pdf.addPage();
      clientY = 16;
    }

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...(COLOR.navyDark));
    pdf.text("Horas por Cliente / Sócio — Consolidado", 10, clientY);
    clientY += 6;

    const clientCols = ["Cliente / Sócio", "Horas Voadas"];
    const clientRows = Array.from(cotMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, horas]) => [label, num(horas, 2)]);
    // Append total
    const totalHoras = Array.from(cotMap.values()).reduce((s, h) => s + h, 0);
    clientRows.push(["TOTAL", num(totalHoras, 2)]);

    applyTableStyles(
      pdf, clientCols, clientRows, clientY,
      new Set([1]),
      COLOR.navyMed,
      { tableWidth: (pageWidth - 20) * 0.45 }
    );
  }

  return pdf;
};