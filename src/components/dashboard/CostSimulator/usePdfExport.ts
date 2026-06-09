import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CostData {
  shortTerm: number;
  mediumTerm: number;
  longTerm: number;
  total: number;
  hourlyRate: number;
}

interface FormData {
  aircraftName: string;
  originName: string;
  destinationName: string;
  flightTimeRoundTrip: number;
  monthlyFlights: number;
  [key: string]: any;
}

interface SimulationForExport {
  name: string;
  formData: FormData;
  costs: CostData;
}

export function usePdfExport() {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const generatePdf = (simulations: SimulationForExport[], title: string = 'Simulador de Custos') => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 10;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(25, 118, 210);
    doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Separator
    doc.setDrawColor(200, 200, 200);
    doc.line(10, yPosition, pageWidth - 10, yPosition);
    yPosition += 8;

    // Process each simulation
    simulations.forEach((sim, index) => {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 10;
      }

      // Simulation Title
      doc.setFontSize(14);
      doc.setTextColor(25, 118, 210);
      doc.text(`${index + 1}. ${sim.name}`, 10, yPosition);
      yPosition += 7;

      // Basic Info
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const basicInfo = [
        `Aeronave: ${sim.formData.aircraftName}`,
        `Rota: ${sim.formData.originName} → ${sim.formData.destinationName}`,
        `Tempo de Voo: ${sim.formData.flightTimeRoundTrip}h | Voos/Mês: ${sim.formData.monthlyFlights}`,
      ];

      basicInfo.forEach((info) => {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 10;
        }
        doc.text(info, 10, yPosition);
        yPosition += 5;
      });

      yPosition += 3;

      // Costs Table
      const costsTableData = [
        ['Período', 'Valor', 'Percentual'],
        ['Curto Prazo (0-29 dias)', formatCurrency(sim.costs.shortTerm), `${((sim.costs.shortTerm / sim.costs.total) * 100).toFixed(1)}%`],
        ['Médio Prazo (30 dias-1 ano)', formatCurrency(sim.costs.mediumTerm), `${((sim.costs.mediumTerm / sim.costs.total) * 100).toFixed(1)}%`],
        ['Longo Prazo (até 10 anos)', formatCurrency(sim.costs.longTerm), `${((sim.costs.longTerm / sim.costs.total) * 100).toFixed(1)}%`],
        ['TOTAL', formatCurrency(sim.costs.total), '100%'],
      ];

      (doc as any).autoTable({
        startY: yPosition,
        head: [costsTableData[0]],
        body: costsTableData.slice(1),
        theme: 'grid',
        headStyles: {
          fillColor: [25, 118, 210],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240],
        },
        margin: { left: 10, right: 10 },
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'right' },
          2: { halign: 'right' },
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 5;

      // Summary
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const summaryText = [
        `Taxa Horária: ${formatCurrency(sim.costs.hourlyRate)}/h`,
      ];

      summaryText.forEach((text) => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 10;
        }
        doc.text(text, 10, yPosition);
        yPosition += 5;
      });

      yPosition += 8;
    });

    // Comparison Table (if multiple simulations)
    if (simulations.length > 1) {
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 10;
      }

      doc.setFontSize(14);
      doc.setTextColor(25, 118, 210);
      doc.text('Comparativo', 10, yPosition);
      yPosition += 8;

      const comparisonData = [
        ['Simulação', 'Curto Prazo', 'Médio Prazo', 'Longo Prazo', 'Total', 'Taxa/h'],
        ...simulations.map((sim) => [
          sim.name,
          formatCurrency(sim.costs.shortTerm),
          formatCurrency(sim.costs.mediumTerm),
          formatCurrency(sim.costs.longTerm),
          formatCurrency(sim.costs.total),
          formatCurrency(sim.costs.hourlyRate),
        ]),
      ];

      (doc as any).autoTable({
        startY: yPosition,
        head: [comparisonData[0]],
        body: comparisonData.slice(1),
        theme: 'grid',
        headStyles: {
          fillColor: [25, 118, 210],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [0, 0, 0],
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240],
        },
        margin: { left: 10, right: 10 },
        columnStyles: {
          0: { halign: 'left' },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
        },
      });
    }

    // Save PDF
    const fileName = `simulador-custos-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  return { generatePdf, formatCurrency };
}
