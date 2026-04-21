// Configuração de retry
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableHosts: [
    'supabase.co',
    'api.share-brasil.com',
  ],
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isRetryableHost(url: string): boolean {
  try {
    const urlObj = new URL(url, location.origin);
    return RETRY_CONFIG.retryableHosts.some(host => urlObj.hostname.includes(host));
  } catch {
    return false;
  }
}

const originalFetch = window.fetch;

window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : (input as Request).url;

  // ✅ Se não é um host que gerenciamos, passa direto sem interceptar
  if (!isRetryableHost(url)) {
    return originalFetch.call(window, input, init);
  }

  let lastError: any;
  let currentDelay = RETRY_CONFIG.initialDelayMs;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const result = await originalFetch.call(window, input, init);

      if (result.ok || result.status < 500) {
        return result;
      }

      if (attempt < RETRY_CONFIG.maxRetries - 1) {
        console.warn(
          `Server error (${result.status}) on ${url}. Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries - 1}. Waiting ${currentDelay}ms...`
        );
        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        continue;
      }

      return result;
    } catch (error: any) {
      lastError = error;

      const isNetworkError =
        error?.message?.includes('Failed to fetch') || error?.code === 'NETWORK_ERROR';

      if (isNetworkError && attempt < RETRY_CONFIG.maxRetries - 1) {
        console.warn(
          `Network error on ${url}. Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries - 1}. Waiting ${currentDelay}ms...`,
          error?.message
        );
        await delay(currentDelay);
        currentDelay = Math.min(currentDelay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
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
  retryableHosts: RETRY_CONFIG.retryableHosts,
});