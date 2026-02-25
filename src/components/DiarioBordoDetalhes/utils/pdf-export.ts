// utils/pdf-export.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FlightEntry, LogbookMonth } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export async function exportToPDF(
  entries: FlightEntry[],
  logbookMonth: LogbookMonth,
  aircraftRegistration: string
) {
  const doc = new jsPDF('landscape');
  
  // Título
  doc.setFontSize(16);
  doc.text('DIÁRIO DE BORDO', 148, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(`Aeronave: ${aircraftRegistration}`, 148, 22, { align: 'center' });
  
  const monthName = format(
    new Date(logbookMonth.year, logbookMonth.month - 1),
    'MMMM yyyy',
    { locale: ptBR }
  );
  doc.text(monthName.toUpperCase(), 148, 28, { align: 'center' });

  // Preparar dados da tabela
  const tableData = entries.map((entry) => [
    format(new Date(entry.entry_date), 'dd/MM/yyyy'),
    entry.departure_aerodrome,
    entry.arrival_aerodrome,
    entry.pic_canac,
    entry.sic_canac || '-',
    entry.ac_time,
    entry.cor_time,
    entry.total_time.toFixed(1),
    entry.pousos.toString(),
    entry.distance_nm.toString(),
  ]);

  // Criar tabela
  autoTable(doc, {
    startY: 35,
    head: [
      [
        'Data',
        'DE',
        'PARA',
        'PIC',
        'SIC',
        'AC',
        'COR',
        'Bloco',
        'Pousos',
        'Dist (NM)',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 18, halign: 'center' },
      9: { cellWidth: 22, halign: 'center' },
    },
  });

  // Totalizadores
  const totalHours = entries.reduce((sum, e) => sum + e.total_time, 0);
  const totalDistance = entries.reduce((sum, e) => sum + e.distance_nm, 0);
  const totalLandings = entries.reduce((sum, e) => sum + e.pousos, 0);

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`TOTAIS:`, 14, finalY);
  doc.text(`Voos: ${entries.length}`, 14, finalY + 7);
  doc.text(`Horas: ${totalHours.toFixed(1)}h`, 50, finalY + 7);
  doc.text(`Distância: ${totalDistance.toFixed(0)} NM`, 90, finalY + 7);
  doc.text(`Pousos: ${totalLandings}`, 140, finalY + 7);

  // Rodapé
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    14,
    doc.internal.pageSize.height - 10
  );

  // Salvar PDF
  const fileName = `diario-bordo-${aircraftRegistration}-${logbookMonth.month}-${logbookMonth.year}.pdf`;
  doc.save(fileName);
}
