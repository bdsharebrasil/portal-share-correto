import jsPDF from "jspdf";
import AutoTable from "jspdf-autotable";
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

export const exportDiarioBordoPDF = async (data: DiarioPDFData, logoUrl: string) => {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();

  // Carregar logo
  let logoImg: string | undefined;
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    logoImg = await blobToBase64(blob);
  } catch (e) {
    console.warn("Erro ao carregar logo:", e);
  }

  // Para cada mês, criar páginas
  for (let i = 0; i < data.meses.length; i++) {
    const mesData = data.meses[i];

    // PÁGINA 1: CAPA DO DIÁRIO
    if (i > 0) pdf.addPage();

    let yPos = 15;

    // Logo
    if (logoImg) {
      pdf.addImage(logoImg, "PNG", pageWidth / 2 - 15, yPos, 30, 30);
      yPos += 35;
    }

    // Título
    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.text("Diário de Bordo", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Matrícula, Modelo, Ano
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Matrícula: ${data.aeronave.matricula}`, pageWidth / 2, yPos, {
      align: "center",
    });
    yPos += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(
      `Modelo: ${data.aeronave.modelo} | Ano: ${data.aeronave.ano || "—"}`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
    yPos += 15;

    // Mês e Ano
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    const monthName = monthNames[mesData.mes - 1] || "—";
    pdf.text(
      `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${mesData.ano}`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    );

    // PÁGINA 2: TABELA COMPLETA
    pdf.addPage();
    yPos = 20;

    // Título da página
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(
      `Registros de Voo - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${mesData.ano}`,
      pageWidth / 2,
      yPos,
      { align: "center" }
    );
    yPos += 10;

    // Preparar dados da tabela (excluindo CONFIRMADO POR)
    const tableColumns = [
      "#",
      "Data",
      "De",
      "Para",
      "AC",
      "DEP",
      "POU",
      "COR",
      "T VOO",
      "T DIA",
      "T NOIT",
      "IFR",
      "POUSOS",
      "ABAST+",
      "FUEL",
      "CÉLULA",
      "PIC",
      "SIC",
      "VOO PARA",
    ];

    if (mesData.temDiaria) {
      tableColumns.push("DIÁRIAS");
    }

    const tableData = mesData.lancamentos.map((l, idx) => {
      const row: any[] = [
        String(idx + 1),
        l.data_registro || "—",
        l.aerodromo_partida || "—",
        l.aerodromo_chegada || "—",
        l.tripulacao_checkin_hora || "—",
        l.tempo_dep || "—",
        l.tempo_pou || "—",
        l.tempo_cor || "—",
        l.tempo_voo ? num(l.tempo_voo, 2) : "—",
        l.horas_diurnas ? num(l.horas_diurnas, 2) : "—",
        l.horas_noturnas ? num(l.horas_noturnas, 2) : "—",
        l.tempo_ifr ? num(l.tempo_ifr, 2) : "—",
        String(l.pousos_total || 0),
        l.combustivel_adicionado ? num(l.combustivel_adicionado, 2) : "—",
        l.litros_combustivel_inicio_voo ? num(l.litros_combustivel_inicio_voo, 2) : "—",
        l.celula ? num(l.celula, 2) : "—",
        l.pic?.nome_completo || "—",
        l.sic?.nome_completo || "—",
        l.natureza_voo || "—",
      ];

      if (mesData.temDiaria) {
        row.push(l.tarifa_diaria ? num(l.tarifa_diaria, 2) : "—");
      }

      return row;
    });

    // Adicionar linha de totais
    const totalRow: any[] = [
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      num(mesData.totals.tVoo, 2),
      num(mesData.totals.tDia, 2),
      num(mesData.totals.tNoit, 2),
      num(mesData.totals.ifr, 2),
      String(mesData.totals.pousos),
      num(mesData.totals.abast, 2),
      num(mesData.totals.fuel, 2),
      "",
      "",
      "",
      "",
    ];

    if (mesData.temDiaria) {
      totalRow.push(num(mesData.totals.totalDiarias, 2));
    }

    tableData.push(totalRow);

    // Usar AutoTable para criar a tabela
    AutoTable(pdf, {
      columns: tableColumns.map((c) => ({ header: c, key: c.toLowerCase() })),
      body: tableData,
      startY: yPos,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3,
        textColor: 0,
        lineColor: 100,
      },
      headStyles: {
        fillColor: 40,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: 245,
      },
      margin: { left: 10, right: 10, top: 10, bottom: 10 },
    });

    // PÁGINA 3: RESUMO
    yPos = (pdf as any).lastAutoTable?.finalY || 100;
    yPos += 15;

    if (yPos > pageHeight - 60) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Resumo de Voos", 15, yPos);
    yPos += 10;

    // Tabela de resumo por cliente/sócio
    const resumoColumns = ["Cliente/Sócio", "Horas"];
    const resumoData = mesData.porCotista.map((c) => [
      c.label,
      num(c.horas, 2),
    ]);

    AutoTable(pdf, {
      columns: resumoColumns.map((c) => ({ header: c, key: c.toLowerCase() })),
      body: resumoData,
      startY: yPos,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 9,
        cellPadding: 4,
        textColor: 0,
        lineColor: 150,
      },
      headStyles: {
        fillColor: 60,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: 245,
      },
      margin: { left: 15, right: 15 },
    });
  }

  // Se houver múltiplos meses, adicionar página final com resumo geral
  if (data.meses.length > 1) {
    pdf.addPage();
    let yPos = 20;

    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Resumo Consolidado", pageWidth / 2, yPos, { align: "center" });
    yPos += 15;

    // Calcular totais consolidados
    const totalConsolidado = {
      tVoo: 0,
      tTotal: 0,
      tDia: 0,
      tNoit: 0,
      ifr: 0,
      pousos: 0,
      abast: 0,
      fuel: 0,
      totalDiarias: 0,
    };

    const cotistasConsolidado = new Map<
      string,
      { label: string; horas: number }
    >();

    for (const mes of data.meses) {
      totalConsolidado.tVoo += mes.totals.tVoo;
      totalConsolidado.tTotal += mes.totals.tTotal;
      totalConsolidado.tDia += mes.totals.tDia;
      totalConsolidado.tNoit += mes.totals.tNoit;
      totalConsolidado.ifr += mes.totals.ifr;
      totalConsolidado.pousos += mes.totals.pousos;
      totalConsolidado.abast += mes.totals.abast;
      totalConsolidado.fuel += mes.totals.fuel;
      totalConsolidado.totalDiarias += mes.totals.totalDiarias;

      for (const c of mes.porCotista) {
        const cur = cotistasConsolidado.get(c.label) ?? { label: c.label, horas: 0 };
        cur.horas += c.horas;
        cotistasConsolidado.set(c.label, cur);
      }
    }

    const periodoTexto = data.meses
      .map((m) => `${monthNames[m.mes - 1]} de ${m.ano}`)
      .join(", ");

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Período: ${periodoTexto}`, 15, yPos);
    yPos += 10;

    // Tabela consolidada
    const resumoColumns = ["Cliente/Sócio", "Horas"];
    const resumoData = Array.from(cotistasConsolidado.values())
      .sort((a, b) => b.horas - a.horas)
      .map((c) => [c.label, num(c.horas, 2)]);

    AutoTable(pdf, {
      columns: resumoColumns.map((c) => ({ header: c, key: c.toLowerCase() })),
      body: resumoData,
      startY: yPos,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 4,
        textColor: 0,
        lineColor: 150,
      },
      headStyles: {
        fillColor: 60,
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: 245,
      },
      margin: { left: 15, right: 15 },
    });

    // Resumo consolidado de horas
    yPos = (pdf as any).lastAutoTable?.finalY || 300;
    yPos += 15;

    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Totais Consolidados", 15, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const statsConsolidado = [
      `T. Voo: ${num(totalConsolidado.tVoo, 2)}h`,
      `Tempo Total: ${num(totalConsolidado.tTotal, 2)}h`,
      `Horas Diurnas: ${num(totalConsolidado.tDia, 2)}h`,
      `Horas Noturnas: ${num(totalConsolidado.tNoit, 2)}h`,
      `IFR: ${num(totalConsolidado.ifr, 2)}h`,
      `Pousos: ${totalConsolidado.pousos}`,
      `Combustível Adicionado: ${num(totalConsolidado.abast, 2)}L`,
    ];

    for (const stat of statsConsolidado) {
      pdf.text(stat, 15, yPos);
      yPos += 6;
    }
  }

  return pdf;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
