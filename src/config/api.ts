/**
 * Configuração Centralizada da API
 * 
 * Este arquivo define a URL base da API e outros parâmetros
 * de configuração que podem variar entre ambientes.
 */

/**
 * URL Base da API Backend
 * 
 * - Em desenvolvimento local: http://localhost:3001
 * - Em produção Vercel: https://seu-backend-nome.vercel.app
 * 
 * Configure no arquivo .env.local:
 * VITE_API_BASE_URL=https://seu-backend.vercel.app
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * URL completa do Supabase
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Token público do Supabase
 */
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * Token da API AVWX
 */
export const AVWX_TOKEN = import.meta.env.VITE_AVWX_API_TOKEN;

/**
 * Ambiente da aplicação
 */
export const APP_ENV = import.meta.env.VITE_APP_ENV || 'development';

/**
 * Função auxiliar para fazer requisições à API
 */
export const apiFetch = async (
  endpoint: string,
  options?: RequestInit
): Promise<any> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  console.debug(`[API] ${options?.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      console.error(`[API] Erro ${response.status}: ${response.statusText}`);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    console.debug(`[API] ✓ Sucesso`, data);
    return data;
  } catch (error) {
    console.error(`[API] ✗ Falha:`, error);
    throw error;
  }
};

/**
 * Logging de configuração
 */
if (APP_ENV === 'development') {
  console.group('🔧 Configuração da API');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Supabase URL:', SUPABASE_URL ? '✓' : '✗');
  console.log('Environment:', APP_ENV);
  console.groupEnd();
}
