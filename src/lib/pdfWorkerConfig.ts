import * as pdfjs from 'pdfjs-dist';

let pdfWorkerConfigured = false;

export function configurePDFWorker(): void {
  // Guard para ambiente servidor
  if (typeof window === 'undefined') {
    console.log('⚠️ PDF Worker configuration skipped on server');
    return;
  }

  // Se já foi configurado, não fazer novamente
  if (pdfWorkerConfigured && pdfjs.GlobalWorkerOptions.workerSrc) {
    console.log(`✅ PDF Worker já configurado: ${pdfjs.GlobalWorkerOptions.workerSrc}`);
    return;
  }

  try {
    const workerVersion = pdfjs.version;
    console.log(`🔧 PDF.js versão: ${workerVersion}`);

    // Estratégia 1: Worker local via Vite (mais confiável em produção)
    try {
      const localWorkerUrl = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url
      ).toString();

      pdfjs.GlobalWorkerOptions.workerSrc = localWorkerUrl;
      console.log(`✅ Configurado para usar worker local: ${localWorkerUrl}`);
      pdfWorkerConfigured = true;
    } catch (localErr) {
      console.warn('⚠️ Worker local não disponível, tentando CDN...');

      // Estratégia 2: CDN estável (versão compatível com pdfjs-dist instalado)
      const cdnWorkerUrl = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      pdfjs.GlobalWorkerOptions.workerSrc = cdnWorkerUrl;
      console.log(`✅ Configurado para usar worker CDN: ${cdnWorkerUrl}`);
      pdfWorkerConfigured = true;
    }

    console.log(`✅ PDF Worker configurado com sucesso (v${workerVersion})`);
  } catch (err) {
    console.error(
      '❌ Erro crítico ao configurar PDF Worker:',
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
}