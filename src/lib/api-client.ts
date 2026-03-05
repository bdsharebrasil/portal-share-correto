// Cliente simplificado apenas para chamadas AISweb (via Cloudflare Worker)
// As demais operações de dados devem ser feitas diretamente contra o Supabase.

const AIS_API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? '/api' : 'https://api-workers.sharebrasil.workers.dev');

async function fetchJson(endpoint: string, options: RequestInit = {}) {
  const base = AIS_API_BASE_URL.replace(/\/$/, '');
  // normalize endpoint: remove leading slashes and a leading 'api/' if present to avoid '/api/api' when base === '/api'
  let ep = endpoint.replace(/^\/+/, '');
  if (ep.startsWith('api/')) ep = ep.replace(/^api\//, '');
  const url = `${base}/${ep}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AIS API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const apiClient = {
  getWeather: (icao: string) =>
    fetchJson(`/api/weather/${icao.toUpperCase()}`),
  getNotam: (icao: string) =>
    fetchJson(`/api/notam/${icao.toUpperCase()}`),
  getInfoTemp: (icao: string) =>
    fetchJson(`/api/infotemp/${icao.toUpperCase()}`),
  getCharts: (icao: string, especie?: string, tipo?: string) => {
    const params: Record<string, string> = {};
    if (especie) params.especie = especie;
    if (tipo) params.tipo = tipo;
    const query =
      Object.keys(params).length > 0
        ? '?' + new URLSearchParams(params).toString()
        : '';
    return fetchJson(`/api/charts/${icao.toUpperCase()}${query}`);
  },
  getSolar: (icao: string, date?: string) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return fetchJson(`/api/solar/${icao.toUpperCase()}${query}`);
  },
  getPreferentialRoutes: (adep: string, ades: string) =>
    fetchJson(
      `/api/routes?adep=${adep.toUpperCase()}&ades=${ades.toUpperCase()}`
    ),
  getWaypoints: () => fetchJson('/api/waypoints'),
};

export function handleApiError(error: any): string {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.message) {
    return error.message;
  }
  return 'Erro desconhecido na API';
}
