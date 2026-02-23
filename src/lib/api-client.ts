// api-client.ts
//
// Cliente HTTP para o Cloudflare Worker (ShareBrasil API).
// Os métodos aqui espelham 1:1 as rotas definidas no Worker.
// Nenhuma chamada a serviços externos é feita diretamente pelo frontend.

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://api-workers.sharebrasil.workers.dev';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const contentType = response.headers.get('content-type');

      if (!contentType?.includes('application/json')) {
        let body = '<empty>';
        try { body = await response.text(); } catch { /* ignore */ }
        throw new Error(`Resposta não-JSON do Worker (${response.status}): ${body.slice(0, 200)}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Erro ${response.status}: ${response.statusText}`);
      }

      return data as T;
    } catch (error: any) {
      if (!(error instanceof TypeError && error.message.includes('Failed to fetch'))) {
        console.warn('[ApiClient]', error.message);
      }
      throw error;
    }
  }

  private async get<T = any>(endpoint: string, params?: Record<string, string | undefined>): Promise<T> {
    const filtered = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '')
    ) as Record<string, string>;

    const qs = Object.keys(filtered).length
      ? '?' + new URLSearchParams(filtered).toString()
      : '';

    return this.request<T>(`${endpoint}${qs}`);
  }

  // ─── Rota 1 ── GET /api/weather/:icao ─────────────────────────────────────
  // Retorna METAR e TAF do aeródromo.

  getWeather(icao: string) {
    return this.get(`/api/weather/${icao.toUpperCase()}`);
  }

  // ─── Rota 2 ── GET /api/charts/:icao ──────────────────────────────────────
  // Cartas de aproximação/saída. especie: 'IFR' | 'VFR' (default 'IFR')

  getCharts(icao: string, especie?: string, tipo?: string) {
    return this.get(`/api/charts/${icao.toUpperCase()}`, { especie, tipo });
  }

  // ─── Rota 3 ── GET /api/notam/:icao ───────────────────────────────────────
  // NOTAMs ativos do aeródromo.

  getNotam(icao: string) {
    return this.get(`/api/notam/${icao.toUpperCase()}`);
  }

  // ─── Rota 4 ── GET /api/infotemp/:icao ────────────────────────────────────
  // Informações de temperatura (ROTAER).

  getInfoTemp(icao: string) {
    return this.get(`/api/infotemp/${icao.toUpperCase()}`);
  }

  // ─── Rota 5 ── GET /api/rotaer/:icao ──────────────────────────────────────
  // Dados completos do aeródromo no ROTAER.

  getRotaer(icao: string) {
    return this.get(`/api/rotaer/${icao.toUpperCase()}`);
  }

  // ─── Rota 6 ── GET /api/solar/:icao ───────────────────────────────────────
  // Nascer/pôr do sol. date: 'YYYY-MM-DD' (opcional, default = hoje)

  getSolar(icao: string, date?: string, dateFim?: string) {
    return this.get(`/api/solar/${icao.toUpperCase()}`, { date, date_f: dateFim });
  }

  // ─── Rota 7 ── GET /api/routes?adep=&ades= ────────────────────────────────
  // Rotas preferenciais entre dois aeródromos.

  getRoutes(adep: string, ades: string) {
    return this.get('/api/routes', {
      adep: adep.toUpperCase(),
      ades: ades.toUpperCase(),
    });
  }

  // ─── Rota 8 ── GET /api/waypoints ─────────────────────────────────────────
  // Lista completa de waypoints brasileiros.

  getWaypoints() {
    return this.get('/api/waypoints');
  }

  // ─── Rota 9 ── GET /api/geiloc?icao= ──────────────────────────────────────
  // Dados geográficos / localização de um aeródromo por ICAO.

  getGeiloc(icao: string) {
    return this.get('/api/geiloc', { icao: icao.toUpperCase() });
  }

  // ─── Rota 9b ── GET /api/geiloc/nearby?lat=&lon=&limit= ───────────────────
  // Aeródromos mais próximos de uma coordenada geográfica.
  // Retorna: { userLocation, count, airports: [{ icao, name, lat, lon, distKm }] }

  getNearbyAirport(lat: number, lon: number, limit = 1) {
    return this.get<{
      userLocation: { lat: number; lon: number };
      count: number;
      airports: Array<{
        icao: string;
        name: string;
        lat: number;
        lon: number;
        distKm: number;
      }>;
    }>('/api/geiloc/nearby', {
      lat:   String(lat),
      lon:   String(lon),
      limit: String(limit),
    });
  }

  // ─── Rota 10 ── GET /api/pub?tipo= ────────────────────────────────────────
  // Publicações AIP. tipo: 'AIP' | 'AIRAC' | 'SUP AIP' etc. (opcional)

  getPub(tipo?: string) {
    return this.get('/api/pub', { tipo });
  }
}

// Instância única — importe onde precisar
export const apiClient = new ApiClient(API_BASE_URL);

// Helper de erro
export function handleApiError(error: any): string {
  return error?.response?.data?.error ?? error?.message ?? 'Erro desconhecido na API';
}