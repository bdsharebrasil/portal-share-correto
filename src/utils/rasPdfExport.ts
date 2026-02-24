import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { RAS } from '@/types/maintenance';

export async function exportRAStoPDF(ras: RAS) {
  try {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Header
    pdf.setFontSize(16);
    pdf.text('RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS', margin, yPosition);
    yPosition += 10;

    // Divider line
    pdf.setDrawColor(0);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;

    // Basic Info
    pdf.setFontSize(10);
    const basicInfo = [
      ['Número de OS:', ras.serviceOrderNumber],
      ['Centro de Manutenção:', ras.maintenanceCenter],
      ['Tipo de Manutenção:', ras.maintenanceType.toUpperCase()],
      ['Status:', ras.status.toUpperCase()],
    ];

    basicInfo.forEach(([label, value]) => {
      pdf.text(`${label} ${value}`, margin, yPosition);
      yPosition += 6;
    });

    yPosition += 5;

    // Responsible Info
    pdf.setFontSize(11);
    pdf.text('Informações Responsável', margin, yPosition);
    yPosition += 6;
    pdf.setFontSize(10);
    const responsibleInfo = [
      ['Mecânico Responsável:', ras.responsibleMechanic],
      ['Data de Serviço:', new Date(ras.date).toLocaleDateString('pt-BR')],
      ...(ras.completionDate ? [['Data de Conclusão:', new Date(ras.completionDate).toLocaleDateString('pt-BR')]] : []),
    ];

    responsibleInfo.forEach(([label, value]) => {
      pdf.text(`${label} ${value}`, margin, yPosition);
      yPosition += 6;
    });

    yPosition += 8;

    // Description
    pdf.setFontSize(11);
    pdf.text('Descrição dos Trabalhos', margin, yPosition);
    yPosition += 6;
    pdf.setFontSize(10);
    const descriptionLines = pdf.splitTextToSize(ras.description, pageWidth - 2 * margin);
    pdf.text(descriptionLines, margin, yPosition);
    yPosition += descriptionLines.length * 5 + 5;

    // Check if we need a new page
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    // Inspection Details
    pdf.setFontSize(11);
    pdf.text('Detalhes Técnicos', margin, yPosition);
    yPosition += 6;
    pdf.setFontSize(10);
    const detailsLines = pdf.splitTextToSize(ras.inspectionDetails, pageWidth - 2 * margin);
    pdf.text(detailsLines, margin, yPosition);
    yPosition += detailsLines.length * 5 + 5;

    // Check page again
    if (yPosition > pageHeight - 60) {
      pdf.addPage();
      yPosition = margin;
    }

    // Cost Breakdown Table
    if (ras.costItems && ras.costItems.length > 0) {
      pdf.setFontSize(11);
      pdf.text('Breakdown de Custos', margin, yPosition);
      yPosition += 10;

      const tableData = ras.costItems.map((item) => [
        item.description,
        item.quantity.toString(),
        `R$ ${item.unitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(item.quantity * item.unitValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ]);

      tableData.push([
        'TOTAL',
        '',
        '',
        `R$ ${ras.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      ]);

      (pdf as any).autoTable({
        startY: yPosition,
        head: [['Descrição', 'Qtd', 'Valor Unit.', 'Subtotal']],
        body: tableData,
        margin: margin,
        didDrawPage: (data: any) => {
          yPosition = data.pageCount > 1 ? margin : yPosition + 60;
        },
      });

      yPosition = (pdf as any).lastAutoTable.finalY + 10;
    }

    // Check page again
    if (yPosition > pageHeight - 40) {
      pdf.addPage();
      yPosition = margin;
    }

    // Motor Hours if available
    if (ras.motorHours) {
      pdf.setFontSize(11);
      pdf.text('Horas de Motor', margin, yPosition);
      yPosition += 6;
      pdf.setFontSize(10);
      pdf.text(`${ras.motorHours} horas`, margin, yPosition);
      yPosition += 10;
    }

    // Observations if available
    if (ras.observations) {
      pdf.setFontSize(11);
      pdf.text('Observações', margin, yPosition);
      yPosition += 6;
      pdf.setFontSize(10);
      const observationsLines = pdf.splitTextToSize(ras.observations, pageWidth - 2 * margin);
      pdf.text(observationsLines, margin, yPosition);
    }

    // Footer
    const pageCount = (pdf as any).internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100);
      pdf.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      pdf.text(
        `Gerado em ${new Date().toLocaleString('pt-BR')}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );
    }

    // Download
    pdf.save(`RAS_${ras.serviceOrderNumber.replace('/', '_')}.pdf`);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
}
