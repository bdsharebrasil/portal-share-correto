// src/config/api.ts
/**
 * Configuração centralizada de URLs da API
 *
 * Em desenvolvimento: usa `/api` (proxiado pelo Vite via vite.config.ts)
 * Em produção:        usa VITE_BACKEND_URL ou a URL padrão do Worker
 */

export const AIS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? '/api'
    : 'https://api-workers.sharebrasil.workers.dev');

export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ─── Prefixo /api ─────────────────────────────────────────────────────────────
// Em DEV o proxy Vite já mapeia /api → Worker, então não duplicamos o prefixo.
// Em PROD a URL do Worker já não tem /api na raiz, então adicionamos.
const _base     = AIS_API_BASE_URL.replace(/\/$/, '');
const _isProxy  = _base === '/api';           // DEV com proxy Vite
const _prefix   = _isProxy ? '' : '/api';    // PROD precisa do /api

// ─── Endpoints ────────────────────────────────────────────────────────────────
export const API_ENDPOINTS = {

  // METAR + TAF
  weather: (icao: string) =>
    `${_base}${_prefix}/weather/${icao.toUpperCase()}`,

  // Cartas aeronáuticas
  charts: (icao: string, especie?: string, tipo?: string) => {
    const params = new URLSearchParams();
    if (especie) params.append('especie', especie);
    if (tipo)    params.append('tipo', tipo);
    const qs = params.toString() ? `?${params}` : '';
    return `${_base}${_prefix}/charts/${icao.toUpperCase()}${qs}`;
  },

  // NOTAMs
  notam: (icao: string) =>
    `${_base}${_prefix}/notam/${icao.toUpperCase()}`,

  // Dados do aeródromo (ROTAER).
  // Quando ades for vazio, o Worker retorna dados do aeródromo isolado.
  rotaer: (adep: string, ades: string) => {
    const params = new URLSearchParams();
    if (adep) params.append('adep', adep.toUpperCase());
    if (ades) params.append('ades', ades.toUpperCase());
    return `${_base}${_prefix}/rotaer?${params}`;
  },

  // Rotas preferenciais ATC — endpoint DIFERENTE de rotaer.
  // Requer adep e ades obrigatoriamente.
  routes: (adep: string, ades: string) =>
    `${_base}${_prefix}/routes?adep=${adep.toUpperCase()}&ades=${ades.toUpperCase()}`,

  // Horários de nascer/pôr do sol
  solar: (icao: string) =>
    `${_base}${_prefix}/solar/${icao.toUpperCase()}`,

  // Cálculos de voo (POST) — sem parâmetros na URL
  flightCalculations: `${_base}${_prefix}/flight-calculations` as string,

  // Plano de voo completo (inclui NOTAMs, alternados e briefing AI)
  flightplan: (
    adep:    string,
    ades:    string,
    speed    = 120,
    burn     = 32,
    reserve  = 45
  ) =>
    `${_base}${_prefix}/flightplan` +
    `?adep=${adep.toUpperCase()}&ades=${ades.toUpperCase()}` +
    `&speed=${speed}&fuel_burn=${burn}&reserve=${reserve}`,

  // Aeródromo mais próximo de uma coordenada
  nearestAirport: (lat: number, lon: number) =>
    `${_base}${_prefix}/nearest?lat=${lat}&lon=${lon}`,

  // Aeródromos próximos para alternados
  geilocNearby: (lat: number, lon: number) =>
    `${_base}${_prefix}/geiloc/nearby?lat=${lat}&lon=${lon}`,

} as const;

// ─── Debug ────────────────────────────────────────────────────────────────────
if (import.meta.env.DEV) {
  console.log('📡 API Configuration:', {
    baseUrl:      AIS_API_BASE_URL,
    prefix:       _prefix || '(none — using Vite proxy)',
    supabaseUrl:  SUPABASE_URL,
  });
}