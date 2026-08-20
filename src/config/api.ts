// src/config/api.ts
/**
 * Configuração centralizada de URLs da API
 *
 * Em desenvolvimento: usa `/api` (proxiado pelo Vite via vite.config.ts)
 * Em produção:        usa VITE_BACKEND_URL ou a URL padrão do Worker
 */
export const AIS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? '/api'
    : 'https://api.share-brasil.com/')

export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// ─── Prefixo /api ─────────────────────────────────────────────────────────────

const _base    = AIS_API_BASE_URL.replace(/\/$/, '')
const _isProxy = _base === '/api'       // DEV com proxy Vite
const _prefix  = _isProxy ? '' : '/api' // PROD precisa do /api

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const API_ENDPOINTS = {
  // METAR + TAF
  weather: (icao: string) =>
    `${_base}${_prefix}/weather/${icao.toUpperCase()}`,

  // Cartas aeronáuticas
  charts: (icao: string, especie?: string, tipo?: string) => {
    const params = new URLSearchParams()
    if (especie) params.append('especie', especie)
    if (tipo)    params.append('tipo', tipo)
    const qs = params.toString() ? `?${params}` : ''
    return `${_base}${_prefix}/charts/${icao.toUpperCase()}${qs}`
  },

  // NOTAMs
  notam: (icao: string) =>
    `${_base}${_prefix}/notam/${icao.toUpperCase()}`,

  // Dados do aeródromo (ROTAER)
  rotaer: (adep: string, ades: string) => {
    const params = new URLSearchParams()
    if (adep) params.append('adep', adep.toUpperCase())
    if (ades) params.append('ades', ades.toUpperCase())
    return `${_base}${_prefix}/rotaer?${params}`
  },

  // Rotas preferenciais ATC — endpoint diferente de rotaer
  routes: (adep: string, ades: string) =>
    `${_base}${_prefix}/routes?adep=${adep.toUpperCase()}&ades=${ades.toUpperCase()}`,

  // Horários solares
  solar: (icao: string) =>
    `${_base}${_prefix}/solar/${icao.toUpperCase()}`,

  // Cálculos de voo (POST)
  flightCalculations: `${_base}${_prefix}/flight-calculations` as string,

  // Plano de voo completo — briefing gerado no frontend
  flightplan: (
    adep:    string,
    ades:    string,
    speed    = 120,
    burn     = 32,
    reserve  = 45,
  ) =>
    `${_base}${_prefix}/flightplan` +
    `?adep=${adep.toUpperCase()}&ades=${ades.toUpperCase()}` +
    `&speed=${speed}&fuel_burn=${burn}&reserve=${reserve}`,

  // Aeródromo mais próximo
  nearestAirport: (lat: number, lon: number) =>
    `${_base}${_prefix}/nearest?lat=${lat}&lon=${lon}`,

  // Avaliação de aeronave (Windsock) — POST
  aircraftValuation: `${_base}${_prefix}/valuation` as string,

  // Estimativa de mercado americano (catálogo FAA / Windsock) — POST
  usAircraftEstimate: `${_base}${_prefix}/us-aircraft-estimate` as string,

  // Alternados próximos
  geilocNearby: (lat: number, lon: number) =>
    `${_base}${_prefix}/geiloc/nearby?lat=${lat}&lon=${lon}`,
} as const

// ─── Debug ────────────────────────────────────────────────────────────────────

if (import.meta.env.DEV) {
  console.log('📡 API Configuration:', {
    baseUrl:     AIS_API_BASE_URL,
    prefix:      _prefix || '(none — using Vite proxy)',
    supabaseUrl: SUPABASE_URL,
  })
}