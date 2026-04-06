import jsPDF from "jspdf";
import "jspdf-autotable";
import { toast } from "sonner";

interface OASPDFData {
  order: any;
  services: any[];
  parts: any[];
  costSharing: any[];
  budgets: any[];
  rasReports: any[];
  oilAnalyses: any[];
}

export function generateOASPDF(data: OASPDFData) {
  try {
    const { order, services, parts, costSharing, budgets, rasReports, oilAnalyses } = data;
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    const registration = (order?.aeronave as any)?.registration || "N/A";

    // ===== HEADER =====
    pdf.setFillColor(0, 82, 147);
    pdf.rect(margin, y, 40, 12, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("SHARE", margin + 3, y + 5);
    pdf.setFontSize(7);
    pdf.text("Brasil", margin + 3, y + 10);
    pdf.setTextColor(0, 0, 0);
    y += 18;

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("RELATÓRIO DE ORDEM DE ABERTURA DE SERVIÇO - OAS", pageWidth / 2, y, { align: "center" });
    y += 10;

    pdf.setDrawColor(0);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 5;

    // ===== INFO =====
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const info = [
      ["OAS Nº:", order?.numero || "-"],
      ["Aeronave:", registration],
      ["Tipo Manutenção:", order?.tipo_manutencao || "-"],
      ["Status:", order?.situacao === "concluido" ? "CONCLUÍDO" : order?.situacao === "em_andamento" ? "EM ANDAMENTO" : "PENDENTE"],
      ["Oficina:", order?.oficina_nome || "-"],
      ["Data Entrada:", order?.data_entrada ? new Date(order.data_entrada + "T12:00:00").toLocaleDateString("pt-BR") : "-"],
      ["Data Saída:", order?.data_saida ? new Date(order.data_saida + "T12:00:00").toLocaleDateString("pt-BR") : "-"],
      ["Horas Célula:", order?.horas_celula ? `${order.horas_celula}H` : "-"],
      ["Objetivo:", order?.objetivo || "-"],
    ];

    info.forEach(([label, value]) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(value, margin + 40, y);
      y += 5;
    });

    if (order?.observacoes) {
      y += 3;
      pdf.setFont("helvetica", "bold");
      pdf.text("Observações:", margin, y);
      y += 5;
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(order.observacoes, pageWidth - 2 * margin);
      pdf.text(lines, margin, y);
      y += lines.length * 4 + 3;
    }

    y += 5;

    // Helper: check page
    const checkPage = (needed: number) => {
      if (y + needed > pageHeight - 20) {
        pdf.addPage();
        y = margin;
      }
    };

    // ===== SERVIÇOS =====
    if (services.length > 0) {
      checkPage(20);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("SERVIÇOS REALIZADOS", margin, y);
      y += 5;

      (pdf as any).autoTable({
        startY: y,
        head: [["Descrição", "Fornecedor", "Qtd", "Valor"]],
        body: services.map((s: any) => [
          s.descricao,
          s.fornecedor || "-",
          s.quantidade || 1,
          `R$ ${(s.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 82, 147] },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }

    // ===== PEÇAS =====
    if (parts.length > 0) {
      checkPage(20);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("PEÇAS UTILIZADAS", margin, y);
      y += 5;

      (pdf as any).autoTable({
        startY: y,
        head: [["Descrição", "P/N", "Fornecedor", "Qtd", "Valor Total"]],
        body: parts.map((p: any) => [
          p.descricao,
          p.part_number || "-",
          p.fornecedor || "-",
          p.quantidade,
          `R$ ${(p.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 82, 147] },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }

    // ===== ORÇAMENTOS =====
    if (budgets.length > 0) {
      checkPage(20);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("ORÇAMENTOS", margin, y);
      y += 5;

      (pdf as any).autoTable({
        startY: y,
        head: [["Tipo", "Descrição", "Fornecedor", "Valor", "Status"]],
        body: budgets.map((b: any) => [
          b.tipo === "peca" ? "Peça" : "Serviço",
          b.descricao,
          b.fornecedor || "-",
          `R$ ${(b.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          b.situacao === "aprovado" ? "Aprovado" : b.situacao === "rejeitado" ? "Rejeitado" : "Pendente",
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 82, 147] },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }

    // ===== RAS =====
    if (rasReports.length > 0) {
      checkPage(20);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("RELATÓRIOS RAS", margin, y);
      y += 5;

      (pdf as any).autoTable({
        startY: y,
        head: [["Número", "Tipo", "Centro", "Data", "Status"]],
        body: rasReports.map((r: any) => [
          r.number || "-",
          r.maintenance_type || "-",
          r.maintenance_center || "-",
          r.entry_date ? new Date(r.entry_date + "T12:00:00").toLocaleDateString("pt-BR") : "-",
          r.status === "completed" ? "Concluído" : "Registrado",
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 82, 147] },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }

    // ===== ANÁLISE DE ÓLEO =====
    if (oilAnalyses.length > 0) {
      checkPage(20);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("ANÁLISES DE ÓLEO", margin, y);
      y += 5;

      (pdf as any).autoTable({
        startY: y,
        head: [["Data", "Fe", "Cu", "Al", "Si", "Viscosidade"]],
        body: oilAnalyses.map((a: any) => [
          a.data ? new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR") : "-",
          a.fe ?? "-",
          a.cu ?? "-",
          a.al ?? "-",
          a.si ?? "-",
          a.viscosity ?? "-",
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 82, 147] },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }

    // ===== RATEIO =====
    if (costSharing.length > 0) {
      checkPage(20);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("RATEIO POR SÓCIO", margin, y);
      y += 5;

      (pdf as any).autoTable({
        startY: y,
        head: [["Sócio", "Horas", "%", "Valor", "Status"]],
        body: costSharing.map((c: any) => [
          c.client?.razao_social || c.client?.proprietario || "-",
          c.horas_voadas ? `${Math.floor(c.horas_voadas)}:${String(Math.round((c.horas_voadas - Math.floor(c.horas_voadas)) * 60)).padStart(2, "0")}` : "-",
          `${(c.percentual || 0).toFixed(1)}%`,
          `R$ ${(c.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          c.situacao_pagamento === "pago" ? "Pago" : "Pendente",
        ]),
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 82, 147] },
      });
      y = (pdf as any).lastAutoTable.finalY + 8;
    }

    // ===== RESUMO FINANCEIRO =====
    checkPage(30);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("RESUMO FINANCEIRO", margin, y);
    y += 8;

    const totalServicos = services.reduce((s: number, sv: any) => s + (sv.valor || 0), 0);
    const totalPecas = parts.reduce((s: number, p: any) => s + (p.valor_total || 0), 0);
    const totalGeral = totalServicos + totalPecas;

    const summary = [
      ["Total Serviços:", `R$ ${totalServicos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Total Peças:", `R$ ${totalPecas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["TOTAL GERAL:", `R$ ${totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
    ];

    summary.forEach(([label, value]) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(label, margin, y);
      pdf.text(value, pageWidth - margin, y, { align: "right" });
      y += 6;
    });

    // ===== FOOTER =====
    const pageCount = (pdf as any).internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(7);
      pdf.setTextColor(100);
      pdf.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });
      pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth / 2, pageHeight - 4, { align: "center" });
    }

    pdf.save(`OAS_${order?.numero || "relatorio"}_${registration}.pdf`);
    toast.success("PDF gerado com sucesso!");
  } catch (error) {
    console.error("Error generating OAS PDF:", error);
    toast.error("Erro ao gerar PDF");
  }
}
