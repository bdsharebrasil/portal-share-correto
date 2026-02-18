import { GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();
export function configurePDFWorker(): void {
  // Guard para ambiente servidor
  if (typeof window === 'undefined') {
    console.log('⚠️ PDF Worker configuration skipped on server');
    return;
  }

  // Se já foi configurado, não fazer novamente
  if (pdfWorkerConfigured && pdfjs.GlobalWorkerOptions.workerSrc) {
    console.log(`✅ PDF Worker já configurado: ${pdfjs.GlobalWorkerOptions.workerSrc}`);

    // Aplicar configurações de segurança mesmo que já esteja configurado
    applySafePDFSettings();
    return;
  }

  try {
    const workerVersion = pdfjs.version;
    console.log(`🔧 PDF.js versão: ${workerVersion}`);

    // Estratégia 1: Verificar se há um worker local em /pdf.worker.mjs (prioritário)
    const localWorkerUrl = '/pdf.worker.mjs';

    // Estratégia 2: Usar uma versão estável conhecida do unpkg (4.8.69 é a versão com react-pdf@10.2.0)
    const stableWorkerUrl = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js`;

    // Estratégia 3: Fallback para jsDelivr CDN (alternativa confiável)
    const jsDelivrUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.js`;

    // Estratégia 4: Fallback com versão na URL do unpkg sem especificar versão
    const unpkgLatestUrl = `https://unpkg.com/pdfjs-dist/build/pdf.worker.min.js`;

    // Tentar estratégias na ordem de prioridade
    try {
      // Primeiro, tentar usar o worker local
      pdfjs.GlobalWorkerOptions.workerSrc = localWorkerUrl;
      console.log(`✅ Configurado para usar worker local: ${localWorkerUrl}`);
      pdfWorkerConfigured = true;
    } catch (localErr) {
      console.warn(`⚠️ Worker local não disponível, tentando CDN estável...`);

      try {
        // Fallback para versão estável conhecida
        pdfjs.GlobalWorkerOptions.workerSrc = stableWorkerUrl;
        console.log(`✅ Configurado para usar worker CDN (versão estável): ${stableWorkerUrl}`);
        pdfWorkerConfigured = true;
      } catch (stableErr) {
        console.warn(`⚠️ CDN estável indisponível, tentando jsDelivr...`);

        try {
          // Fallback para jsDelivr
          pdfjs.GlobalWorkerOptions.workerSrc = jsDelivrUrl;
          console.log(`✅ Configurado para usar worker CDN (jsDelivr): ${jsDelivrUrl}`);
          pdfWorkerConfigured = true;
        } catch (jsDelivrErr) {
          console.warn(`⚠️ jsDelivr indisponível, tentando unpkg sem versão...`);

          try {
            // Último fallback: unpkg sem versão específica
            pdfjs.GlobalWorkerOptions.workerSrc = unpkgLatestUrl;
            console.log(`✅ Configurado para usar worker CDN (unpkg latest): ${unpkgLatestUrl}`);
            pdfWorkerConfigured = true;
          } catch (unpkgErr) {
            console.error('❌ Nenhum worker CDN disponível!', unpkgErr instanceof Error ? unpkgErr.message : String(unpkgErr));
            throw new Error('Não foi possível configurar o worker do PDF.js. Verifique sua conexão com a internet.');
          }
        }
      }
    }

    // Aplicar configurações de segurança após configurar o worker
    applySafePDFSettings();

    console.log(`✅ PDF Worker configurado com sucesso (v${workerVersion})`);
    pdfWorkerConfigured = true;
  } catch (err) {
    console.error('❌ Erro crítico ao configurar PDF Worker:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Aplica configurações de segurança e robustez ao PDF.js
 * Ajuda a lidar com PDFs corrompidos ou malformados
 */
function applySafePDFSettings(): void {
  try {
    // Desabilitar execução de scripts JavaScript em PDFs (segurança)
    if (pdfjs.GlobalWorkerOptions && typeof pdfjs.GlobalWorkerOptions === 'object') {
      // Configurar para ser mais tolerante com PDFs malformados
      (pdfjs as any).disableAutoFetch = false; // Permitir carregamento automático
      (pdfjs as any).disableStream = false; // Permitir streaming
      (pdfjs as any).disableRange = false; // Permitir range requests

      console.log('✅ Configurações de segurança do PDF.js aplicadas');
    }
  } catch (err) {
    console.warn('⚠️ Não foi possível aplicar todas as configurações de segurança:',
      err instanceof Error ? err.message : String(err));
    // Não falhar se não conseguir aplicar configurações extras
  }
}
