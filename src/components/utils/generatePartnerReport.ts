import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GenerateOptions {
  elementId: string;
  clientName: string;
  month: string;
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
  const margin = 5;
  const usableWidth = pageWidth - margin * 2;
  const imgRatio = canvas.height / canvas.width;
  const totalImgHeight = usableWidth * imgRatio;

  let yOffset = 0;
  let pageNum = 1;
  const sliceHeight = pageHeight - margin * 2;

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

    pdf.addImage(sliceData, "PNG", margin, margin, usableWidth, sliceImgH);

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150);
    pdf.text(
      `Página ${pageNum} • Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      pageWidth / 2,
      pageHeight - 3,
      { align: "center" }
    );

    yOffset += sliceHeight;
    pageNum++;
  }

  const monthLabel = format(new Date(month + "-01"), "MMMM_yyyy", { locale: ptBR });
  const safeName = clientName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  pdf.save(`relatorio_socios_${safeName}_${monthLabel}.pdf`);
}
