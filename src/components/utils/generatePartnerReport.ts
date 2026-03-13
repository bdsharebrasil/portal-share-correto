import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GenerateOptions {
  elementId: string;
  clientName: string;
  month: string; // "yyyy-MM"
}

export async function generatePartnerMonthlyPDF(options: GenerateOptions): Promise<void> {
  const { elementId, clientName, month } = options;

  const element = document.getElementById(elementId);
  if (!element) throw new Error("Elemento do relatório não encontrado");

  // Temporarily make element visible and full-width for capture
  const originalStyle = element.style.cssText;
  element.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 1200px;
    background: white;
    color: black;
    padding: 0;
  `;
  element.style.display = "block";

  // Wait for render
  await new Promise((r) => setTimeout(r, 500));

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    width: 1200,
    windowWidth: 1200,
  });

  // Restore
  element.style.cssText = originalStyle;

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const marginH = 5;   // horizontal margin (mm)
  const marginTop = 5; // top margin (mm)
  const footerH = 8;   // height reserved for footer at bottom (mm)
  const usableWidth = pageWidth - marginH * 2;

  // Usable content height per page (leaving room for footer)
  const sliceHeight = pageHeight - marginTop - footerH;

  const imgRatio = canvas.height / canvas.width;
  const totalImgHeight = usableWidth * imgRatio;

  let yOffset = 0;
  let pageNum = 1;

  // Fix: parse month safely without UTC shift
  const [year, mon] = month.split("-");
  const monthDate = new Date(parseInt(year), parseInt(mon) - 1, 15);
  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  while (yOffset < totalImgHeight) {
    if (pageNum > 1) pdf.addPage();

    const sourceY = (yOffset / totalImgHeight) * canvas.height;
    const sourceH = (sliceHeight / totalImgHeight) * canvas.height;

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = Math.min(sourceH, canvas.height - sourceY);
    const ctx = sliceCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(
        canvas,
        0, sourceY, canvas.width, sliceCanvas.height,
        0, 0, sliceCanvas.width, sliceCanvas.height
      );
    }

    const sliceData = sliceCanvas.toDataURL("image/png");
    const sliceImgH = (sliceCanvas.height / canvas.width) * usableWidth;

    pdf.addImage(sliceData, "PNG", marginH, marginTop, usableWidth, sliceImgH);

    // Footer — drawn AFTER the image, safely below content area
    const footerY = pageHeight - 3;
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Página ${pageNum} • Gerado em ${generatedAt}`,
      pageWidth / 2,
      footerY,
      { align: "center" }
    );

    yOffset += sliceHeight;
    pageNum++;
  }

  // Fix: use locally-parsed date for filename (no UTC shift)
  const monthLabel = format(monthDate, "MMMM_yyyy", { locale: ptBR });
  const safeName = clientName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  pdf.save(`relatorio_socios_${safeName}_${monthLabel}.pdf`);
}