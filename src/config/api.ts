/**
 * Configuração centralizada de URLs da API
 * Alinhado com Cloudflare Workers (ShareBrasil) e Supabase
 */

// URL base do backend (Workers)
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev';

// URL da API do Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Endpoints específicos (Sincronizados 1:1 com o seu api-client.ts)
export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/health`,
  
  // Clima e Info Técnica
  weather: (icao: string) => `${API_BASE_URL}/api/weather/${icao.toUpperCase()}`,
  notam: (icao: string) => `${API_BASE_URL}/api/notam/${icao.toUpperCase()}`,
  infotemp: (icao: string) => `${API_BASE_URL}/api/infotemp/${icao.toUpperCase()}`,
  rotaer: (icao: string) => `${API_BASE_URL}/api/rotaer/${icao.toUpperCase()}`,
  
  // Cartas e Documentos
  charts: (icao: string) => `${API_BASE_URL}/api/charts/${icao.toUpperCase()}`,
  pub: (tipo?: string) => `${API_BASE_URL}/api/pub${tipo ? `?tipo=${tipo}` : ''}`,
  
  // Planejamento e Navegação
  solar: (icao: string, date?: string) => `${API_BASE_URL}/api/solar/${icao.toUpperCase()}${date ? `?date=${date}` : ''}`,
  routes: (adep: string, ades: string) => `${API_BASE_URL}/api/routes?adep=${adep.toUpperCase()}&ades=${ades.toUpperCase()}`,
  waypoints: `${API_BASE_URL}/api/waypoints`,

  // Localização (Geiloc) - Onde o Widget de Clima se baseia
  geiloc: {
    byIcao: (icao: string) => `${API_BASE_URL}/api/geiloc?icao=${icao.toUpperCase()}`,
    nearby: (lat: number, lon: number, limit: number = 1) => 
      `${API_BASE_URL}/api/geiloc/nearby?lat=${lat}&lon=${lon}&limit=${limit}`,
  },

  // OBS: Removido 'airports.search' pois a rota não existe no Worker. 
  // A busca deve ser feita via Supabase para evitar 404.
} as const;

// Log de configuração (útil para debug em ambiente de desenvolvimento)
if (import.meta.env.DEV) {
  console.log('📡 API Configuration Sync:', {
    baseUrl: API_BASE_URL,
    geilocEnabled: !!API_ENDPOINTS.geiloc,
    supabaseConfigured: !!SUPABASE_URL,
  });
}