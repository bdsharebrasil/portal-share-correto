export const CATEGORIAS_DESPESA = [
  "Combustível",
  "Hospedagem",
  "Alimentação",
  "Transporte",
  "Outros"
];

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
  return {
    margin: 10,
    filename: `${reportNumber}-relatorio-viagem.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
  };
};

export interface TravelExpense {
  categoria: string;
  descricao: string;
  valor: number;
  pago_por: string;
  comprovante_url?: string;
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
  total_tripulante1: number;
  total_tripulante2: number;
  total_cliente: number;
  total_sharebrasil: number;
  valor_total: number;
}

// Função auxiliar para calcular totais separados por tripulante a partir das despesas
const calculateCrewTotals = (despesas: TravelExpense[]) => {
  let total_tripulante1 = 0;
  let total_tripulante2 = 0;

  despesas.forEach(d => {
    const valor = Number(d.valor) || 0;
    const pagoPor = d.pago_por || '';

    if (pagoPor === 'Tripulante 1' || pagoPor === 'Tripulante') {
      total_tripulante1 += valor;
    } else if (pagoPor === 'Tripulante 2') {
      total_tripulante2 += valor;
    }
  });

  return { total_tripulante1, total_tripulante2 };
};

const generateHTMLReport = (report: TravelReport, currentFullName = 'Usuário') => {
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

  // Calcular totais separados por tripulante
  const crewTotals = calculateCrewTotals(report.despesas);
  const total_tripulante1 = report.total_tripulante1 || crewTotals.total_tripulante1;
  const total_tripulante2 = report.total_tripulante2 || crewTotals.total_tripulante2;

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
            }

            .info-item {
                font-size: 12px;
                margin: 4px 30px 4px 0;
                display: inline-block;
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
                height: auto;
                display: block;
                margin-top: 12px;
                border: 1px solid #ccc;
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
                    <img src="/logo.share.png" alt="Share Brasil Logo" />
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
                </div>
                <div class="info-row">
                    <div class="info-item"><strong>Tripulante 1:</strong> ${(report.tripulante || 'N/A').toUpperCase()}</div>
                    ${hasSecondCrew ? `<div class="info-item"><strong>Tripulante 2:</strong> ${(report.tripulante2 || '').toUpperCase()}</div>` : ''}
                </div>
                <div class="info-row">
                    <div class="info-item"><strong>Trecho:</strong> ${report.trecho || report.destino || 'N/A'}</div>
                    <div class="info-item"><strong>Período:</strong> ${report.data_inicio ? formatDateBR(report.data_inicio) : 'N/A'} a ${report.data_fim ? formatDateBR(report.data_fim) : 'N/A'} (${calcDays()} dias)</div>
                </div>
            </div>

            <h2 class="despesas-title">Detalhes das Despesas</h2>
            <table>
                <thead>
                    <tr>
                        <th>Categoria</th>
                        <th>Descrição</th>
                        <th class="text-right">Valor (R$)</th>
                        <th>Pago Por</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.despesas.map(d => `
                        <tr>
                            <td>${d.categoria || 'Outros'}</td>
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
                    <div class="total-row"><span>${report.tripulante ? `Tripulante 1 (${report.tripulante}):` : 'Tripulante 1:'}</span> <span>${(total_tripulante1 || 0).toFixed(2).replace('.', ',')}</span></div>
                    ${hasSecondCrew ? `<div class="total-row"><span>Tripulante 2 (${report.tripulante2}):</span> <span>${(total_tripulante2 || 0).toFixed(2).replace('.', ',')}</span></div>` : ''}
                    <div class="total-row"><span>Cliente:</span> <span>${(report.total_cliente || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row"><span>ShareBrasil:</span> <span>${(report.total_sharebrasil || 0).toFixed(2).replace('.', ',')}</span></div>
                    <div class="total-row total-final"><span>TOTAL GERAL:</span> <span>${(report.valor_total || 0).toFixed(2).replace('.', ',')}</span></div>
                </div>
            </div>

            <div class="footer">
                Gerado por: ${currentFullName || 'Usuário'}
            </div>
        </div>

        ${report.despesas.some(d => d.comprovante_url) ? `
            <div class="report-container receipts-section">
                <h2>Comprovantes Anexados</h2>
                ${report.despesas
        .filter(d => d.comprovante_url)
        .map((d, index) => `
                        <div class="receipt-item">
                            <p><strong>Item Nº:</strong> ${index + 1}</p>
                            <p><strong>Descrição:</strong> ${d.descricao || 'N/A'}</p>
                            <p><strong>Categoria:</strong> ${d.categoria || 'Outros'}</p>
                            <p><strong>Valor:</strong> R$ ${(Number(d.valor) || 0).toFixed(2).replace('.', ',')}</p>
                            <img class="receipt-image" src="${d.comprovante_url}" alt="Comprovante" />
                        </div>
                    `).join('')}
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

export const generatePDF = async (report: TravelReport, currentFullName?: string): Promise<Blob> => {
  const htmlContent = generateHTMLReport(report, currentFullName);

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Não foi possível acessar o documento do iframe');

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    await new Promise(resolve => setTimeout(resolve, 1000));

    const config = generatePDFConfig(report.numero);
    const html2pdf = (window as any).html2pdf ? (window as any).html2pdf : await loadHtml2PdfFromCdn();

    const blob = await new Promise<Blob>((resolve, reject) => {
      html2pdf()
        .set({
          ...config,
          useCORS: true,
          logging: false,
        })
        .from(iframeDoc.body)
        .outputPdf('blob')
        .then((pdfBlob: Blob) => {
          resolve(pdfBlob);
        })
        .catch((err: any) => {
          console.error('Erro ao gerar PDF:', err);
          reject(err);
        });
    });

    return blob;
  } finally {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
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
  const blob = await generatePDF(report, currentFullName);
  const url = window.URL.createObjectURL(blob);
  window.open(url, '_blank');
};

export const viewHTMLPreview = (report: TravelReport, currentFullName?: string) => {
  const htmlContent = generateHTMLReport(report, currentFullName);
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  }
};

export const previewPDFForPrint = async (report: TravelReport, currentFullName?: string) => {
  const htmlContent = generateHTMLReport(report, currentFullName);
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
    newWindow.onload = () => {
      newWindow.print();
    };
  }
};

export const uploadPDFToStorage = async (
  report: TravelReport,
  supabaseClient: any,
  currentFullName?: string
): Promise<string> => {
  const blob = await generatePDF(report, currentFullName);

  console.log('PDF Blob size:', blob.size, 'bytes');
  console.log('PDF Blob type:', blob.type);

  if (!blob || blob.size === 0) {
    throw new Error('PDF gerado está vazio. Verifique se os dados do relatório estão corretos.');
  }

  const fileName = `${report.numero.replace(/\//g, '-')}-${Date.now()}.pdf`;
  const filePath = `pdfs/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('travel-reports')
    .upload(filePath, blob, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabaseClient.storage
    .from('travel-reports')
    .getPublicUrl(filePath);

  return publicUrl;
};
