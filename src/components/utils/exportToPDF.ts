import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportOptions {
  filename?: string;
  title?: string;
  includeTimestamp?: boolean;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Exporta o conteúdo de um elemento HTML para PDF
 * @param elementId - ID do elemento HTML a ser exportado
 * @param options - Opções de exportação (nome do arquivo, título, etc)
 */
export const exportElementToPDF = async (
  elementId: string,
  options: ExportOptions = {}
): Promise<void> => {
  const {
    filename = 'relatorio.pdf',
    title = 'Relatório',
    includeTimestamp = true,
    orientation = 'portrait'
  } = options;

  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Elemento com ID "${elementId}" não encontrado`);
    }

    // Criar canvas a partir do elemento HTML
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Definir dimensões baseadas na orientação
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = orientation === 'portrait' ? 210 : 297; // mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Criar PDF
    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'l' : 'p',
      unit: 'mm',
      format: 'a4'
    });

    // Adicionar título se fornecido
    if (title) {
      pdf.setFontSize(16);
      pdf.text(title, 15, 15);
      
      if (includeTimestamp) {
        pdf.setFontSize(10);
        const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
        pdf.text(`Gerado em: ${timestamp}`, 15, 22);
      }
    }

    // Adicionar imagem ao PDF
    let yPosition = title ? 30 : 10;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const maxWidth = pageWidth - (2 * margin);

    if (imgHeight > pageHeight - yPosition) {
      // Se a imagem for muito grande, redimensionar
      const scaleFactor = (pageHeight - yPosition - margin) / imgHeight;
      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight * scaleFactor);
    } else {
      pdf.addImage(imgData, 'PNG', margin, yPosition, maxWidth, (maxWidth * imgHeight) / imgWidth);
    }

    // Baixar o PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Erro ao exportar para PDF:', error);
    throw error;
  }
};

/**
 * Exporta uma tabela para PDF usando jsPDF e AutoTable
 * @param data - Dados da tabela
 * @param columns - Colunas da tabela
 * @param options - Opções de exportação
 */
export const exportTableToPDF = async (
  data: any[],
  columns: { header: string; dataKey: string }[],
  options: ExportOptions = {}
): Promise<void> => {
  const {
    filename = 'tabela.pdf',
    title = 'Relatório',
    includeTimestamp = true,
    orientation = 'portrait'
  } = options;

  try {
    const pdf = new jsPDF({
      orientation: orientation === 'landscape' ? 'l' : 'p',
      unit: 'mm',
      format: 'a4'
    });

    // Adicionar título
    if (title) {
      pdf.setFontSize(16);
      pdf.text(title, 15, 15);

      if (includeTimestamp) {
        pdf.setFontSize(10);
        const timestamp = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
        pdf.text(`Gerado em: ${timestamp}`, 15, 22);
      }
    }

    // Importar AutoTable dinamicamente para evitar erros de tipo
    const AutoTable = (await import('jspdf-autotable')).default;

    // Configurar colunas
    const tableColumns = columns.map(col => ({
      header: col.header,
      dataKey: col.dataKey
    }));

    // Adicionar tabela ao PDF
    AutoTable(pdf, {
      columns: tableColumns,
      body: data,
      startY: title ? 30 : 10,
      styles: {
        font: 'Helvetica',
        fontSize: 10,
        cellPadding: 5,
        textColor: '#333333'
      },
      headStyles: {
        fillColor: '#0066cc',
        textColor: '#ffffff',
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: '#f5f5f5'
      },
      margin: { top: 10, right: 10, bottom: 10, left: 10 }
    });

    pdf.save(filename);
  } catch (error) {
    console.error('Erro ao exportar tabela para PDF:', error);
    throw error;
  }
};

/**
 * Cria um nome de arquivo com timestamp
 * @param baseName - Nome base do arquivo
 * @returns Nome do arquivo com timestamp
 */
export const createFilenameWithTimestamp = (baseName: string): string => {
  const timestamp = format(new Date(), 'ddMMyyyy_HHmmss', { locale: ptBR });
  return `${baseName}_${timestamp}.pdf`;
};
