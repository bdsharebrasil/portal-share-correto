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

  weather: (icao: string) =>
    `${_base}${apiPrefix}/weather/${icao}`,

  flightplan: (adep: string, ades: string, speed = 120, burn = 32) =>
    `${_base}${apiPrefix}/flightplan?adep=${adep}&ades=${ades}&speed=${speed}&fuel_burn=${burn}`,

  nearestAirport: (lat: number, lon: number) =>
    `${_base}${apiPrefix}/nearest?lat=${lat}&lon=${lon}`,

  geilocNearby: (lat: number, lon: number) =>
    `${_base}${apiPrefix}/geiloc/nearby?lat=${lat}&lon=${lon}`,

} as const;

// Log de configuração (útil para debug)
if (import.meta.env.DEV) {
  console.log('📡 API Configuration:', {
    baseUrl: AIS_API_BASE_URL,
    supabaseUrl: SUPABASE_URL,
  });
}
