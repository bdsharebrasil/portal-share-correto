import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GenerateOptions {
  elementId: string;
  clientName: string;
  month?: string; // "yyyy-MM" (deprecated, use months)
  months?: string[]; // "yyyy-MM" array
}

export async function generatePartnerMonthlyPDF(options: GenerateOptions): Promise<void> {
  const { elementId, clientName, month, months: monthArray } = options;

  // Support both single month and multiple months
  const months = monthArray || (month ? [month] : []);
  if (months.length === 0) throw new Error("Nenhum mês fornecido para geração de PDF");

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
    margin: 0;
  `;
  element.style.display = "block";

  // Wait for render (increased timeout for multi-month reports)
  await new Promise((r) => setTimeout(r, 2000));

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
  const marginBottom = 5; // bottom margin (mm) - aumentado para evitar cortes
  const usableWidth = pageWidth - marginH * 2;

  // Usable content height per page (com margens mais generosas para evitar cortes)
  const sliceHeight = pageHeight - marginTop - marginBottom;

  const imgRatio = canvas.height / canvas.width;
  const totalImgHeight = usableWidth * imgRatio;

  let yOffset = 0;
  let pageNum = 1;

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

    // Rodapé removido conforme solicitação do cliente

    yOffset += sliceHeight;
    pageNum++;
  }

  // Generate filename
  let filename: string;
  if (months.length === 1) {
    const [year, mon] = months[0].split("-");
    const monthDate = new Date(parseInt(year), parseInt(mon) - 1, 15);
    const monthLabel = format(monthDate, "MMMM_yyyy", { locale: ptBR });
    const safeName = clientName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    filename = `relatorio_socios_${safeName}_${monthLabel}.pdf`;
  } else {
    const firstMonth = new Date(parseInt(months[0].split("-")[0]), parseInt(months[0].split("-")[1]) - 1, 15);
    const lastMonth = new Date(parseInt(months[months.length - 1].split("-")[0]), parseInt(months[months.length - 1].split("-")[1]) - 1, 15);
    const startLabel = format(firstMonth, "MMM_yyyy", { locale: ptBR });
    const endLabel = format(lastMonth, "MMM_yyyy", { locale: ptBR });
    const safeName = clientName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    filename = `relatorio_socios_${safeName}_${startLabel}_ate_${endLabel}.pdf`;
  }

  pdf.save(filename);
}
