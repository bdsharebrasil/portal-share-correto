import { useEffect, useRef } from 'react';
import { configurePDFWorker } from '@/lib/pdfWorkerConfig';

/**
 * Hook que garante que o PDF worker é configurado apenas uma vez
 * Deve ser chamado no root component (App.tsx) ou no componente que renderiza DocumentViewer
 */
export function usePDFWorker() {
  const configuredRef = useRef(false);

  useEffect(() => {
    // Apenas configurar uma vez na montagem
    if (configuredRef.current) return;

    const setup = async () => {
      try {
        await configurePDFWorker();
        configuredRef.current = true;
      } catch (err) {
        console.error('Erro ao configurar PDF worker:', err instanceof Error ? err.message : String(err));
        // Não re-lançar o erro, permitir que o componente tente carregar PDFs mesmo com erro na config
      }
    };

    setup();
  }, []); // Dependência vazia = executa apenas uma vez na montagem
}
