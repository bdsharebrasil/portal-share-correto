// Configuração de retry
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  // URLs que sempre devem fazer retry em caso de falha de rede
  retryableHosts: [
    'supabase.co',
    'api-workers.sharebrasil.workers.dev',
  ],
};

// Função para aguardar com delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função para verificar se deve fazer retry
function shouldRetry(url: string, error: any): boolean {
  // Se for erro de rede (Failed to fetch), tenta novamente
  if (error?.message?.includes('Failed to fetch') || error?.code === 'NETWORK_ERROR') {
    // Verifica se é uma URL que deve fazer retry
    try {
      const urlObj = new URL(url, location.origin);
      return RETRY_CONFIG.retryableHosts.some(host => urlObj.hostname.includes(host));
    } catch {
      return false;
    }
  }
  return false;
}

// Armazena o fetch original
const originalFetch = window.fetch;

// Override fetch com retry automático
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any).url;
  let lastError: any;
  let currentDelay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await originalFetch.call(window, input, init);
      
      // Se a resposta foi bem-sucedida, retorna
      if (result.ok || result.status < 500) {
        return result;
      }
      
      // Se for erro de servidor (5xx), tenta novamente
      if (result.status >= 500 && attempt < RETRY_CONFIG.maxRetries - 1) {
        console.warn(
          `Server error (${result.status}) on ${url}. Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries - 1}. Waiting ${currentDelay}ms...`
        );
        await delay(currentDelay);
        currentDelay = Math.min(
          currentDelay * RETRY_CONFIG.backoffMultiplier,
          RETRY_CONFIG.maxDelayMs
        );
        continue;
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      if (shouldRetry(url, error) && attempt < RETRY_CONFIG.maxRetries - 1) {
        console.warn(
          `Network error on ${url}. Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries - 1}. Waiting ${currentDelay}ms...`,
          error?.message
        );
        await delay(currentDelay);
        currentDelay = Math.min(
          currentDelay * RETRY_CONFIG.backoffMultiplier,
          RETRY_CONFIG.maxDelayMs
        );
        continue;
      }
      
      throw error;
    }
  }

  console.error(`❌ Max retries exceeded for ${url}. Last error:`, lastError?.message || lastError);
  throw lastError;
}) as typeof fetch;

console.log('✓ Fetch retry interceptor initialized', {
  maxRetries: RETRY_CONFIG.maxRetries,
  timeout: RETRY_CONFIG.maxDelayMs,
  retryableHosts: RETRY_CONFIG.retryableHosts,
});
