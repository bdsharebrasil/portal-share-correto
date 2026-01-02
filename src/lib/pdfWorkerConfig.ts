import { pdfjs } from 'react-pdf';

// Flag para rastrear se o worker já foi configurado
let pdfWorkerConfigured = false;

/**
 * Configura o worker do PDF.js com múltiplas estratégias de fallback
 * Garante que o worker seja carregado corretamente em desenvolvimento e produção
 * A configuração é feita apenas uma vez para evitar conflitos
 * Esta função é segura para ser chamada apenas no navegador (via useEffect)
 */
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

    console.log(`✅ PDF Worker configurado com sucesso (v${workerVersion})`);
  } catch (err) {
    console.error('❌ Erro crítico ao configurar PDF Worker:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
