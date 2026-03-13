/**
 * Converte a primeira página de um PDF em uma imagem (Blob PNG)
 * usando PDF.js carregado via CDN.
 */

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfjsLoaded = false;

const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.pdfjsLib) {
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      return resolve(w.pdfjsLib);
    }

    if (pdfjsLoaded) {
      // Script is loading, wait for it
      const check = setInterval(() => {
        if (w.pdfjsLib) {
          clearInterval(check);
          w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
          resolve(w.pdfjsLib);
        }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error('Timeout loading PDF.js')); }, 10000);
      return;
    }

    pdfjsLoaded = true;
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.async = true;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) return reject(new Error('pdfjsLib not available'));
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
};

/**
 * Converte um File PDF em um Blob PNG da primeira página.
 * @param pdfFile O arquivo PDF
 * @param scale Escala de renderização (default 2 para boa qualidade)
 */
export const convertPdfToImageBlob = async (pdfFile: File, scale = 2): Promise<Blob> => {
  const pdfjsLib = await loadPdfJs();

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });
};
