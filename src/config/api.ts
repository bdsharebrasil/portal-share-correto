// src/config/api.ts

/**
 * Configuração centralizada de URLs da API
 * 
 * Em desenvolvimento: usa `/api` (proxiado pelo Vite)
 * Em produção: usa a URL completa
 */

// URL base do backend (Workers) apenas usado para AISweb
// DEV: `/api` (proxy Vite) | PROD: variável de ambiente ou URL padrão
export const AIS_API_BASE_URL = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? '/api' : 'https://api-workers.sharebrasil.workers.dev');

// URL da API do Supabase (uso direto em serviços/hooks)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Endpoints AISweb (Cloudflare Worker)
const _base = AIS_API_BASE_URL.replace(/\/$/, '');
const _hasDevProxy = _base === '/api';
const apiPrefix = _hasDevProxy ? '' : '/api';

export const API_ENDPOINTS = {
  weather: (icao: string) => `${_base}${apiPrefix}/weather/${icao}`,
  notam: (icao: string) => `${_base}${apiPrefix}/notam/${icao}`,
  charts: (icao: string) => `${_base}${apiPrefix}/charts/${icao}`,
  infotemp: (icao: string) => `${_base}${apiPrefix}/infotemp/${icao}`,
  solar: (icao: string) => `${_base}${apiPrefix}/solar/${icao}`,
  routes: `${_base}${apiPrefix}/routes`,
  waypoints: `${_base}${apiPrefix}/waypoints`,
  flightCalculations: `${_base}${apiPrefix}/flight-calculations`,
  geiloc: (icao?: string) =>
    icao ? `${_base}${apiPrefix}/geiloc?icao=${icao}` : `${_base}${apiPrefix}/geiloc`,
  geilocNearby: `${_base}${apiPrefix}/geiloc/nearby`,
} as const;

// Log de configuração (útil para debug)
if (import.meta.env.DEV) {
  console.log('📡 API Configuration:', {
    baseUrl: AIS_API_BASE_URL,
    supabaseUrl: SUPABASE_URL,
  });
}