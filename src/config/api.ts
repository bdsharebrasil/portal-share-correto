// src/config/api.ts

/**
 * Configuração centralizada de URLs da API
 */

// URL base do backend (Workers)
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev';

// URL da API do Supabase
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Endpoints específicos (alinhados com Workers backend)
export const API_ENDPOINTS = {
  health: `${API_BASE_URL}/health`,
  weather: (icao: string) => `${API_BASE_URL}/api/weather/${icao}`,
  notam: (icao: string) => `${API_BASE_URL}/api/notam/${icao}`,
  charts: (icao: string) => `${API_BASE_URL}/api/charts/${icao}`,
  infotemp: (icao: string) => `${API_BASE_URL}/api/infotemp/${icao}`,
  solar: (icao: string) => `${API_BASE_URL}/api/solar/${icao}`,
  routes: `${API_BASE_URL}/api/routes`,
  waypoints: `${API_BASE_URL}/api/waypoints`,
  airports: {
    byIcao: (icao: string) => `${API_BASE_URL}/api/airports/${icao}`,
    search: (query: string) => `${API_BASE_URL}/api/airports/search?q=${query}`,
  },
  flights: {
    all: `${API_BASE_URL}/flights`,
    byId: (id: string) => `${API_BASE_URL}/flights/${id}`,
    active: `${API_BASE_URL}/flights/active/now`,
    calculations: `${API_BASE_URL}/api/flight-calculations`,
  },
} as const;

// Log de configuração (útil para debug)
if (import.meta.env.DEV) {
  console.log('📡 API Configuration:', {
    baseUrl: API_BASE_URL,
    supabaseUrl: SUPABASE_URL,
  });
}