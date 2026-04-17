export const CATEGORIAS_DESPESA = [
  "Combustível",
  "Hospedagem",
  "Alimentação",
  "Transporte",
  "Outros"
];

// Import placeholders de erro
import { PDF_CONVERSION_ERROR_PLACEHOLDER } from "@/constants/errorPlaceholders";

// Import PDF.js do npm (não CDN)
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configurar worker local
pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

// Pagadores separados: Tripulante 1 e Tripulante 2
export const PAGADORES = [
  "Tripulante 1",
  "Tripulante 2",
  "Cliente",
  "ShareBrasil"
];

const parseLocalDate = (value: string | Date) => {
  const s = String(value).split('T')[0];
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// Helper para detectar se é PDF de forma robusta
const isPdfByUrl = (url: string): boolean => {
  return url.toLowerCase().includes('.pdf') ||
    url.startsWith('data:application/pdf') ||
    url.startsWith('data:application/octet-stream');
};

const isPdfByContent = (base64: string): boolean => {
  return base64.startsWith('data:application/pdf') ||
    base64.startsWith('data:application/octet-stream');
};

export const formatDateBR = (value: string | Date) => {
  if (!value) return '';
  const s = String(value).split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  try { return new Date(value).toLocaleDateString('pt-BR'); } catch { return String(value); }
};

const generatePDFConfig = (reportNumber: string) => {
  // Formatar número para filename
  const cleanId = reportNumber.replace(/[^a-zA-Z0-9]/g, '');
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  return {
    margin: 10,
    filename: `${cleanId}-${dateStr}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
  };
};

export interface TravelExpense {
  categoria: string;
  descricao: string;
  valor: number;
  pago_por: string;
  data?: string;
  comprovante_url?: string;
  comprovante_pages?: string[]; // Páginas adicionais de PDF multi-página
  _conversionError?: string;
  _conversionPages?: number;
}

export interface TravelReport {
  numero: string;
  cliente_nome: string;
  aeronave: string;
  tripulante: string;
  tripulante2?: string;
  trecho?: string;
  destino: string;
  data_inicio: string;
  data_fim: string;
  observacoes?: string;
  despesas: TravelExpense[];
  total_combustivel: number;
  total_hospedagem: number;
  total_alimentacao: number;
  total_transporte: number;
  total_outros: number;
  total_tripulante: number;
  total_tripulante1?: number;
  total_tripulante2?: number;
  total_cliente: number;
  total_sharebrasil: number;
  valor_total: number;
}

export interface TravelReportSignatures {
  generatedBy?: string;
  crewSigner?: string;       // tripulante que conferiu (preenche após aprovação)
  crewSignedAt?: string;     // ISO
  clientSigner?: string;     // cliente que conferiu (opcional)
  clientSignedAt?: string;
}

const generateHTMLReport = (report: TravelReport, currentFullName = 'Usuário', logoBase64?: string, signatures?: TravelReportSignatures) => {
  const calcDays = () => {
    if (report?.data_inicio && report?.data_fim) {
      const inicio = parseLocalDate(report.data_inicio);
      const fim = parseLocalDate(report.data_fim);
      const diffTime = Math.abs(fim.getTime() - inicio.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 1;
  };

  const formattedNumero = (() => {
    const raw = String(report?.numero || '').toUpperCase();
    return raw || 'N/A';
  })();

  // Lógica para obter os totais específicos
  const totalT1 = report.total_tripulante1 || 0;
  const totalT2 = report.total_tripulante2 || 0;

  // Para compatibilidade, se T1 e T2 não existirem, usamos o total_tripulante no T1.
  const finalTotalT1 = (totalT1 === 0 && totalT2 === 0) ? report.total_tripulante : totalT1;
  const hasSecondCrew = report.tripulante2 && report.tripulante2.trim() !== '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Relatório de Viagem - ${report.numero}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: Arial, Helvetica, sans-serif;
                font-size: 12px;
                color: #333;
                background: white;
                line-height: 1.4;
                padding: 0;
                margin: 0;
            }

            .report-container {
                width: 100%;
                border: 3px solid #22c55e;
                padding: 20px;
                background: white;
                page-break-after: always;
            }

            .header {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 3px solid #22c55e;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 15px;
            }

            .logo-box {
                flex-shrink: 0;
                width: 120px;
                height: 120px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .logo-box img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }

            .header-content {
                width: 100%;
                text-align: center;
            }

            .header-title {
                color: #1e3a8a;
                font-size: 18px;
                font-weight: bold;
                margin: 0 0 5px 0;
            }

            .header-info {
                font-size: 13px;
                color: #333;
                font-weight: bold;
                margin: 0;
            }

            .info-section {
                margin: 20px 0;
                background: white;
            }

            .info-row {
                margin: 8px 0;
                display: flex;
                flex-wrap: wrap;
            }

            .info-item {
                font-size: 12px;
                margin: 4px 30px 4px 0;
                min-width: 150px;
            }

            .info-item strong {
                color: #1e3a8a;
                font-weight: bold;
            }

            .despesas-title {
                color: #1e3a8a;
                font-size: 14px;
                font-weight: bold;
                margin: 15px 0 10px 0;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 11px;
            }

            th, td {
                border: 1px solid #999;
                padding: 6px 8px;
                text-align: left;
                vertical-align: top;
            }

            th {
                background-color: #e8e8e8;
                color: #1e3a8a;
                font-weight: bold;
            }

            .text-right {
                text-align: right !important;
            }

            .totals-box {
                border: 1px solid #999;
                padding: 12px;
                margin: 15px 0;
                width: 48%;
                display: inline-block;
                vertical-align: top;
                page-break-inside: avoid;
            }

            .totals-box:nth-child(2n) {
                margin-left: 2%;
            }

            .totals-box h3 {
                color: #22c55e;
                margin: 0 0 8px 0;
                font-size: 13px;
                border-bottom: 1px dotted #22c55e;
                padding-bottom: 4px;
                font-weight: bold;
            }

            .total-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                padding: 2px 0;
                margin: 4px 0;
                border-bottom: 1px solid #f0f0f0;
            }

            .total-final {
                font-weight: bold;
                font-size: 12px;
                color: #1e3a8a;
                margin-top: 8px;
                border-top: 2px solid #22c55e;
                padding-top: 8px;
            }

            .total-final span:last-child {
                color: #22c55e;
            }

            .receipts-section {
                margin-top: 40px;
                page-break-before: always;
            }

            .receipts-section h2 {
                color: #1e3a8a;
                font-size: 16px;
                margin: 0 0 20px 0;
                font-weight: bold;
            }

            .receipt-item {
                margin: 0 0 30px 0;
                border: 1px solid #ddd;
                padding: 12px;
                page-break-inside: avoid;
            }

            .receipt-item p {
                font-size: 11px;
                margin: 3px 0;
            }

            .receipt-image {
                max-width: 100%;
                max-height: 600px;
                height: auto;
                display: block;
                margin-top: 12px;
                border: 1px solid #ccc;
                object-fit: contain;
                background-color: #f5f5f5;
                padding: 4px;
            }

            .receipt-image-container {
                page-break-inside: avoid;
                margin-top: 12px;
            }

            hr {
                border: none;
                border-top: 1px solid #999;
                margin: 15px 0;
            }

            .footer {
                text-align: right;
                margin-top: 40px;
                padding-top: 15px;
                border-top: 1px solid #999;
                font-size: 11px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="report-container">
            <div class="header">
                <div class="logo-box">
                    <img src="${logoBase64 || '/logo.share.png'}" alt="Share Brasil" />
                </div>
                <div class="header-content">
                    <h1 class="header-title">Relatório de Despesa de Viagem</h1>
                    <p class="header-info">${formattedNumero} - ${(report.cliente_nome || 'N/A').toUpperCase()}</p>
                </div>
            </div>

            <div class="info-section">
                <div class="info-row">
                    <div class="info-item"><strong>Cliente:</strong> ${(report.cliente_nome || 'N/A').toUpperCase()}</div>
                    <div class="info-item"><strong>Aeronave:</strong> ${report.aeronave || 'N/A'}</div>
                    <div class="info-item"><strong>Período:</strong> ${report.data_inicio ? formatDateBR(report.data_inicio) : 'N/A'} a ${report.data_fim ? formatDateBR(report.data_fim) : 'N/A'} (${calcDays()} dias)</div>
                </div>
                <div class="info-row">
                    <div class="info-item"><strong>Tripulante 1:</strong> ${(report.tripulante || 'N/A').toUpperCase()}</div>
                    ${hasSecondCrew ?
      `<div class="info-item"><strong>Tripulante 2:</strong> ${(report.tripulante2 || 'N/A').toUpperCase()}</div>`
      : ''
    }
                    <div class="info-item"><strong>Trecho:</strong> ${report.trecho || report.destino || 'N/A'}</div>
                </div>
            </div>

            <h2 class="despesas-title">Detalhes das Despesas</h2>
            <table>
                <thead>
                    <tr>
                        <th>Categoria</th>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th class="text-right">Valor (R$)</th>
                        <th>Pago Por</th>
                    </tr>
                </thead>
                <tbody>
                    ${[...report.despesas]
      .sort((a, b) => {
        if (!a.data && !b.data) return 0;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return a.data.localeCompare(b.data);
      })
      .map(d => `
                        <tr>
                            <td>${d.categoria || 'Outros'}</td>
                            <td>${d.data ? formatDateBR(d.data) : '-'}</td>
                            <td>${d.descricao || 'N/A'}</td>
                            <td class="text-right">${(Number(d.valor) || 0).toFixed(2).replace('.', ',')}</td>
                            <td>${d.pago_por || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div>
                <div class="totals-box">
                    <h3>Totais por Categoria (R$)</h3>
                    <div class="total-row"><span>Combustível:</span> <span>${(report.total_combustivel || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row"><span>Hospedagem:</span> <span>${(report.total_hospedagem || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row"><span>Alimentação:</span> <span>${(report.total_alimentacao || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row"><span>Transporte:</span> <span>${(report.total_transporte || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row"><span>Outros:</span> <span>${(report.total_outros || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row total-final"><span>TOTAL GERAL:</span> <span>${(report.valor_total || 0).toFixed(2).replace('.', ',')}</span></div>
                </div>
                <div class="totals-box">
                    <h3>Totais por Pagador (R$)</h3>
                    <div class="total-row"><span>Tripulante 1:</span> <span>${(finalTotalT1).toFixed(2).replace('.', ',')}</span></div>
                    ${hasSecondCrew ?
      `<div class="total-row"><span>Tripulante 2:</span> <span>${(totalT2).toFixed(2).replace('.', ',')}</span></div>`
      : ''
    }
                    <div class="total-row"><span>Cliente:</span> <span>${(report.total_cliente || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row"><span>ShareBrasil:</span> <span>${(report.total_sharebrasil || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row total-final"><span>TOTAL GERAL:</span> <span>${(report.valor_total || 0).toFixed(2).replace('.', ',')}</span></div>
                </div>
            </div>

            ${report.observacoes ? `
            <hr />
            <div style="margin-top: 20px; padding: 12px; background: #f5f5f5; border-left: 4px solid #22c55e;">
                <h3 style="color: #1e3a8a; margin: 0 0 8px 0; font-size: 13px; font-weight: bold;">Observações</h3>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #333; white-space: pre-wrap; word-wrap: break-word;">${(report.observacoes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </div>
            ` : ''}

        </div>

        ${report.despesas.some(d => d.comprovante_url) ? `
            <div class="report-container receipts-section">
                <h2>Comprovantes Anexados</h2>
                ${[...report.despesas]
        .sort((a, b) => {
          if (!a.data && !b.data) return 0;
          if (!a.data) return 1;
          if (!b.data) return -1;
          return a.data.localeCompare(b.data);
        })
        .filter(d => d.comprovante_url)
        .map((d, index) => {
          const isBase64 = d.comprovante_url && d.comprovante_url.startsWith('data:');
          const hasMultiplePages = d.comprovante_pages && d.comprovante_pages.length > 0;
          const totalPages = hasMultiplePages ? (d._conversionPages || 1) : 1;

          let pagesHtml = '';

          // Página 1 (comprovante_url principal)
          pagesHtml += `
            <div class="receipt-image-container">
              ${hasMultiplePages ? `<p style="font-size: 11px; color: #666; margin-bottom: 8px;"><strong>Página 1 de ${totalPages}</strong></p>` : ''}
              <img class="receipt-image" src="${d.comprovante_url}" alt="Comprovante Página 1" ${isBase64 ? '' : 'crossorigin="anonymous"'} />
            </div>
          `;

          // Páginas adicionais (comprovante_pages)
          if (hasMultiplePages) {
            d.comprovante_pages.forEach((pageUrl, pageIndex) => {
              const pageNum = pageIndex + 2;
              const isPageBase64 = pageUrl.startsWith('data:');
              pagesHtml += `
            <div class="receipt-image-container" style="margin-top: 20px;">
              <p style="font-size: 11px; color: #666; margin-bottom: 8px;"><strong>Página ${pageNum} de ${totalPages}</strong></p>
              <img class="receipt-image" src="${pageUrl}" alt="Comprovante Página ${pageNum}" ${isPageBase64 ? '' : 'crossorigin="anonymous"'} />
            </div>
              `;
            });
          }

          return `
                        <div class="receipt-item">
                            <p><strong>Item Nº:</strong> ${index + 1}</p>
                            <p><strong>Descrição:</strong> ${d.descricao || 'N/A'}</p>
                            <p><strong>Categoria:</strong> ${d.categoria || 'Outros'}</p>
                            <p><strong>Valor:</strong> R$ ${(Number(d.valor) || 0).toFixed(2).replace('.', ',')}</p>
                            ${pagesHtml}
                        </div>
                    `;
        }).join('')}
            </div>
        ` : ''}

    </body>
    </html>
    `;
};

export const getReportHTML = generateHTMLReport;

const loadHtml2PdfFromCdn = () => {
  return new Promise<any>((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('window is undefined'));
    const w = window as any;
    if (w.html2pdf) return resolve(w.html2pdf);
    const existing = document.querySelector('script[data-html2pdf]');
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).html2pdf));
      existing.addEventListener('error', () => reject(new Error('Failed to load html2pdf script')));
      return;
    }
    const script = document.createElement('script');
    script.setAttribute('data-html2pdf', '1');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => {
      const w2 = window as any;
      if (w2.html2pdf) return resolve(w2.html2pdf);
      if (w2.html2pdf) return resolve(w2.html2pdf);
      reject(new Error('html2pdf not available after script load'));
    };
    script.onerror = () => reject(new Error('Failed to load html2pdf script'));
    document.head.appendChild(script);
  });
};

// Helper para gerar nome profissional do PDF
const generatePdfFilename = (report: TravelReport): string => {
  try {
    // Usar numero_relatorio se disponível (formato: REL-ARG-001 ou similar)
    // Caso contrário, usar numero (formato: R-0001)
    const reportId = (report as any).numero_relatorio || report.numero || 'REL-0001';

    // Extrair apenas números e letras para filename (remover caracteres especiais)
    const cleanId = reportId.replace(/[^a-zA-Z0-9]/g, '');

    // Adicionar data no formato YYYYMMDD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Formato final: REL-ARG-001-20260319.pdf
    return `${cleanId}-${dateStr}.pdf`;
  } catch (error) {
    console.warn('Erro ao gerar nome do PDF, usando padrão:', error);
    return 'relatorio-viagem.pdf';
  }
};

const loadLogoAsBase64 = async (): Promise<string> => {
  try {
    const response = await fetch('/logo.share.png');
    if (!response.ok) {
      console.warn('Logo não encontrado, usando caminho padrão');
      return '';
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        console.warn('Erro ao carregar logo como base64');
        resolve('');
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Erro ao fazer fetch do logo:', error);
    return '';
  }
};

const convertPdfBase64ToImageBase64 = async (pdfBase64: string): Promise<string> => {
  try {
    console.log('🔄 Convertendo PDF em imagem...');

    // Remove o prefixo data:application/...;base64,
    const base64Data = pdfBase64.replace(/^data:[^;]+;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pageCount = pdf.numPages;

    // Se multi-página, usa a nova função
    if (pageCount > 1) {
      console.log(`📄 PDF com ${pageCount} páginas detectado. Convertendo todas...`);
      const images = await convertPdfBase64ToMultipleImages(pdfBase64);
      // Retorna primeira página para compatibilidade, mas marca que há múltiplas
      return images[0] || '';
    }

    // Single page - renderizar normalmente
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível obter contexto do canvas');

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Falha ao converter canvas para blob'));
        const reader = new FileReader();
        reader.onloadend = () => {
          const imageBase64 = reader.result as string;
          console.log('✅ PDF convertido para imagem com sucesso');
          resolve(imageBase64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.85); // Usar JPEG com quality 0.85 para melhor compressão
    });
  } catch (error: any) {
    console.error('❌ Erro ao converter PDF para imagem:', error.message);
    throw error;
  }
};

const convertPdfBase64ToMultipleImages = async (pdfBase64: string): Promise<string[]> => {
  try {
    console.log('🔄 Convertendo PDF multi-página em imagens...');

    // Remove o prefixo data:application/...;base64,
    const base64Data = pdfBase64.replace(/^data:[^;]+;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pageCount = pdf.numPages;
    const images: string[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(`Não foi possível obter contexto do canvas para página ${pageNum}`);

        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

        const imageBase64 = await new Promise<string>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error(`Falha ao converter página ${pageNum}`));
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }, 'image/jpeg', 0.85);
        });

        images.push(imageBase64);
        console.log(`✅ Página ${pageNum}/${pageCount} convertida com sucesso`);
      } catch (pageError) {
        console.warn(`⚠️ Erro ao converter página ${pageNum}:`, pageError);
        // Continua com próxima página mesmo se falhar
      }
    }

    console.log(`✅ PDF com ${pageCount} páginas convertido para ${images.length} imagens`);
    return images;
  } catch (error: any) {
    console.error('❌ Erro ao converter PDF multi-página:', error.message);
    throw error;
  }
};

const fetchImageAsBase64 = async (url: string): Promise<string> => {
  // Pula se já é base64
  if (url.startsWith('data:')) {
    return url;
  }

  console.log('🔄 Convertendo comprovante para base64:', url.substring(0, 60) + '...');

  // Método 1: Usar Image + Canvas (melhor para imagens, evita CORS)
  const tryImageCanvas = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const timeout = setTimeout(() => {
        reject(new Error('Timeout ao carregar imagem'));
      }, 15000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível obter contexto do canvas'));
            return;
          }
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl && dataUrl.length > 100) {
            console.log('✅ Imagem convertida via canvas, tamanho:', (dataUrl.length / 1024).toFixed(2) + 'KB');
            resolve(dataUrl);
          } else {
            reject(new Error('Canvas retornou data URL inválida'));
          }
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Erro ao carregar imagem'));
      };

      // Adicionar timestamp para evitar cache CORS
      const separator = url.includes('?') ? '&' : '?';
      img.src = url + separator + 't=' + Date.now();
    });
  };

  // Método 2: Fetch direto como fallback
  const tryFetch = async (): Promise<string> => {
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Blob vazio');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (result && result.length > 100) {
          console.log('✅ Comprovante convertido via fetch, tamanho:', (result.length / 1024).toFixed(2) + 'KB');
          resolve(result);
        } else {
          reject(new Error('FileReader retornou resultado vazio'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  };

  // Detectar se é PDF pela extensão
  const isPdfUrl = url.toLowerCase().includes('.pdf');

  // Para PDFs, usar fetch direto (canvas não funciona com PDFs)
  if (isPdfUrl) {
    try {
      return await tryFetch();
    } catch (e: any) {
      console.warn('⚠️ Falha ao baixar PDF:', e.message);
      // Não retorna URL original para PDF - lança erro
      throw new Error(`Falha ao baixar PDF: ${e.message}`);
    }
  }

  // Para imagens, tentar canvas primeiro, depois fetch
  try {
    return await tryImageCanvas();
  } catch (e1: any) {
    console.warn('⚠️ Canvas falhou, tentando fetch:', e1.message);
    try {
      return await tryFetch();
    } catch (e2: any) {
      console.warn('⚠️ Fetch também falhou:', e2.message);
      return url;
    }
  }
};

export const generatePDF = async (report: TravelReport, currentFullName?: string): Promise<Blob> => {
  // Carregar logo como base64
  console.log('🔄 Carregando logo...');
  const logoBase64 = await loadLogoAsBase64();

  // Pre-convert all receipt images to base64 to avoid CORS issues
  const reportWithBase64 = { ...report, despesas: [...report.despesas] };

  const totalComprovantes = report.despesas.filter(d => d.comprovante_url).length;
  console.log(`📄 Iniciando conversão de ${totalComprovantes} comprovante(s) para base64...`);

  const imagePromises = reportWithBase64.despesas.map(async (d, i) => {
    if (d.comprovante_url) {
      const isPDF = isPdfByUrl(d.comprovante_url);
      const fileType = isPDF ? 'PDF' : 'Imagem';
      console.log(`⏳ Convertendo comprovante ${i + 1} (${fileType}):`, d.comprovante_url.substring(0, 50) + '...');
      try {
        let base64 = await fetchImageAsBase64(d.comprovante_url);

        // Se é PDF, converte para imagem (verificar tanto pelo URL quanto pelo conteúdo base64)
        const isPdfContent = isPdfByContent(base64);
        if ((isPDF || isPdfContent) && !base64.startsWith('data:image/')) {
          console.log(`🔄 PDF detectado, convertendo para imagem...`);

          // Para PDFs potencialmente multi-página, tentar obter todas as páginas
          let pages: string[] = [];
          try {
            pages = await convertPdfBase64ToMultipleImages(base64);
            if (pages.length > 1) {
              base64 = pages[0];
              reportWithBase64.despesas[i] = {
                ...d,
                comprovante_url: base64,
                comprovante_pages: pages.slice(1), // Armazenar páginas 2+
                _conversionPages: pages.length
              };
              console.log(`✅ PDF com ${pages.length} páginas convertido com sucesso`);
            } else {
              base64 = pages[0] || base64;
              reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
            }
          } catch (_multiPageError) {
            // Se multi-página falhar, tentar single-page
            base64 = await convertPdfBase64ToImageBase64(base64);
            reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
          }
        } else {
          reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
        }

        console.log(`✅ Comprovante ${i + 1} convertido com sucesso (${fileType})`);
      } catch (error) {
        console.error(`❌ Erro ao converter comprovante ${i + 1}:`, error);
        // Usar placeholder de erro em caso de falha na conversão
        reportWithBase64.despesas[i] = {
          ...d,
          comprovante_url: PDF_CONVERSION_ERROR_PLACEHOLDER,
          _conversionError: error instanceof Error ? error.message : String(error)
        };
        console.warn(`⚠️ Placeholder usado para comprovante ${i + 1}`);
      }
    }
  });

  await Promise.all(imagePromises);
  console.log(`✅ Conversão de ${totalComprovantes} comprovante(s) concluída`);

  const htmlContent = generateHTMLReport(reportWithBase64, currentFullName, logoBase64);

  const htmlDoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório - ${report.numero}</title>
      <style>
        body { margin: 0; padding: 0; background: white; }
        @page { size: A4; margin: 0; }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.style.position = 'fixed';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Não foi possível acessar o documento do iframe');

    iframeDoc.open();
    iframeDoc.write(htmlDoc);
    iframeDoc.close();

    // Wait for all content to render completely
    const renderTimeout = Math.max(8000, totalComprovantes * 1000);
    console.log(`⏳ Aguardando renderização completa (${renderTimeout / 1000} segundos)...`);
    await new Promise(resolve => setTimeout(resolve, renderTimeout));
    console.log('✅ Renderização concluída');

    const html2pdf = (window as any).html2pdf ? (window as any).html2pdf : await loadHtml2PdfFromCdn();

    return new Promise((resolve, reject) => {
      html2pdf()
        .set({
          margin: 0,
          filename: `${generatePdfFilename(report)}`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowHeight: iframeDoc.body.scrollHeight || 1200,
            windowWidth: 794,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(iframeDoc.body)
        .outputPdf('blob')
        .then((blob: Blob) => {
          console.log('✅ PDF gerado com sucesso:', blob.size, 'bytes');
          resolve(blob);
        })
        .catch((err: any) => {
          console.error('❌ Erro ao gerar PDF:', err);
          reject(err);
        });
    });
  } finally {
    // Remover iframe somente após ter gerado o blob (Promise.all resolveu)
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 100);
  }
};

export const downloadPDF = async (report: TravelReport, currentFullName?: string) => {
  const blob = await generatePDF(report, currentFullName);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.numero.replace(/\//g, '-')}-relatorio-viagem.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const openPDFInNewWindow = async (report: TravelReport, currentFullName?: string) => {
  // Open window FIRST (synchronously, within user interaction context)
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    throw new Error('Não foi possível abrir a janela');
  }

  const blob = await generatePDF(report, currentFullName);
  const url = window.URL.createObjectURL(blob);
  newWindow.location.href = url;
};

export const viewHTMLPreview = async (report: TravelReport, currentFullName?: string) => {
  // Open window FIRST (synchronously, within user interaction context)
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    throw new Error('Não foi possível abrir a janela de prévia');
  }

  // Convert receipts to base64 for better compatibility
  const reportWithBase64 = { ...report, despesas: [...report.despesas] };

  console.log('📄 Preparando prévia HTML com conversão de comprovantes...');

  const imagePromises = reportWithBase64.despesas.map(async (d, i) => {
    if (d.comprovante_url && !d.comprovante_url.startsWith('data:')) {
      try {
        let base64 = await fetchImageAsBase64(d.comprovante_url);

        // Se é PDF, converte para imagem
        const isPDF = d.comprovante_url.includes('.pdf') || base64.startsWith('data:application/pdf') || base64.startsWith('data:application/octet-stream');
        if (isPDF && !base64.startsWith('data:image/')) {
          console.log('🔄 PDF detectado na prévia, convertendo para imagem...');

          // Tentar obter todas as páginas (multi-página)
          let pages: string[] = [];
          try {
            pages = await convertPdfBase64ToMultipleImages(base64);
            if (pages.length > 1) {
              base64 = pages[0];
              reportWithBase64.despesas[i] = {
                ...d,
                comprovante_url: base64,
                comprovante_pages: pages.slice(1),
                _conversionPages: pages.length
              };
              console.log(`✅ PDF com ${pages.length} páginas convertido com sucesso`);
            } else {
              base64 = pages[0] || base64;
              reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
            }
          } catch (_multiPageError) {
            // Se multi-página falhar, tentar single-page
            base64 = await convertPdfBase64ToImageBase64(base64);
            reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
          }
        } else {
          reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
        }
      } catch (error) {
        console.warn('Erro ao converter para prévia HTML:', error);
        // Mantém URL original
      }
    }
  });

  await Promise.all(imagePromises);

  const htmlContent = generateHTMLReport(reportWithBase64, currentFullName);
  newWindow.document.write(htmlContent);
  newWindow.document.close();
};

export const previewPDFForPrint = async (report: TravelReport, currentFullName?: string) => {
  // Open window FIRST (synchronously, within user interaction context)
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    throw new Error('Não foi possível abrir a janela de prévia');
  }

  try {
    // Convert receipts to base64 for better compatibility
    const reportWithBase64 = { ...report, despesas: [...report.despesas] };

    const imagePromises = reportWithBase64.despesas.map(async (d, i) => {
      if (d.comprovante_url && !d.comprovante_url.startsWith('data:')) {
        try {
          let base64 = await fetchImageAsBase64(d.comprovante_url);

          // Se é PDF, converte para imagem
          const isPDF = d.comprovante_url.includes('.pdf') || base64.startsWith('data:application/pdf') || base64.startsWith('data:application/octet-stream');
          if (isPDF && !base64.startsWith('data:image/')) {
            console.log('🔄 PDF detectado na prévia de impressão, convertendo para imagem...');

            // Tentar obter todas as páginas (multi-página)
            let pages: string[] = [];
            try {
              pages = await convertPdfBase64ToMultipleImages(base64);
              if (pages.length > 1) {
                base64 = pages[0];
                reportWithBase64.despesas[i] = {
                  ...d,
                  comprovante_url: base64,
                  comprovante_pages: pages.slice(1),
                  _conversionPages: pages.length
                };
                console.log(`✅ PDF com ${pages.length} páginas convertido com sucesso`);
              } else {
                base64 = pages[0] || base64;
                reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
              }
            } catch (_multiPageError) {
              // Se multi-página falhar, tentar single-page
              base64 = await convertPdfBase64ToImageBase64(base64);
              reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
            }
          } else {
            reportWithBase64.despesas[i] = { ...d, comprovante_url: base64 };
          }
        } catch (error) {
          console.warn('Erro ao converter para prévia de impressão:', error);
        }
      }
    });

    await Promise.all(imagePromises);

    const htmlContent = generateHTMLReport(reportWithBase64, currentFullName);

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Prévia - ${report.numero}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { margin: 0; padding: 20px; background: #f0f0f0; font-family: Arial, sans-serif; }
          .controls {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
            z-index: 1000;
          }
          .btn {
            padding: 10px 20px;
            background: #22c55e;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: background 0.2s;
          }
          .btn:hover { background: #16a34a; }
          .btn:disabled { background: #999; cursor: not-allowed; }
          .container { background: white; margin: 0 auto; max-width: 210mm; box-shadow: 0 0 10px rgba(0,0,0,0.1); padding: 20px; }
          @media print {
            body { background: white; padding: 0; }
            .controls { display: none; }
            .container { max-width: 100%; box-shadow: none; padding: 0; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="controls">
          <button class="btn" onclick="window.print()">🖨️ Imprimir</button>
        </div>
        <div class="container">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;

    newWindow.document.write(htmlDoc);
    newWindow.document.close();
  } catch (error) {
    console.error('Erro ao visualizar prévia:', error);
    newWindow.close();
    throw error;
  }
};