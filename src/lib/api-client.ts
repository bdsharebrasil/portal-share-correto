/**
 * Cliente HTTP para comunicar com o backend Express
 * Usa o backend como cache/proxy para o Supabase
 *
 * Em produção, o backend deve estar no mesmo servidor (mesma origem).
 * Em desenvolvimento, usa localhost:3001.
 */

const getApiBaseUrl = () => {
  // Se VITE_API_URL está definido, use-o (permite override por environment variable)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Em desenvolvimento local (localhost), usa localhost:3001
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Desenvolvimento local
      return 'http://localhost:3001';
    }

    // Em desenvolvimento remoto (ex: Fly.io) ou produção, tenta usar mesmo domínio
    // Se o backend está servindo em /api, usa relative path
    if (hostname.includes('fly.dev') || !import.meta.env.DEV) {
      // Produção ou staging em Fly.io - usa relative path (mesmo origem)
      return '';
    }
  }

  // Fallback: relative path
  return '';
};

const API_BASE_URL = getApiBaseUrl();

export interface ApiOptions {
  cache?: boolean;
  revalidate?: number;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;

    // Debug logging para diagnosticar problemas de conexão
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      console.log('[API Client] Configuration:', {
        baseUrl: this.baseUrl,
        hostname: window.location.hostname,
        isDev: import.meta.env.DEV,
        defaultUrl: API_BASE_URL
      });
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: ApiOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundo timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const cached = response.headers.get('X-Cache') === 'HIT';

      console.debug(`[API] ${endpoint} - ${cached ? 'CACHED' : 'FRESH'}`);

      return data.data || data;
    } catch (error) {
      // Log mais detalhado para debug
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isBackendError = errorMsg.includes('Failed to fetch') || errorMsg.includes('fetch');

      if (isBackendError) {
        console.error(`[API Error] Backend não está respondendo em ${this.baseUrl}${endpoint}:`, errorMsg);
        console.warn(`[API Debug] BASE_URL=${this.baseUrl}, DEV=${import.meta.env.DEV}`);
      } else {
        console.error(`[API Error] ${endpoint}: ${errorMsg}`, { url, error });
      }

      throw error;
    }
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, payload: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundo timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isBackendError = errorMsg.includes('Failed to fetch') || errorMsg.includes('fetch');

      if (isBackendError) {
        console.error(`[API Error] Backend não está respondendo em ${this.baseUrl}${endpoint}:`, errorMsg);
      } else {
        console.error(`[API Error] ${endpoint}:`, error);
      }
      throw error;
    }
  }

  /**
   * GET users
   */
  async getUsers() {
    return this.get('/api/users');
  }

  /**
   * GET user by ID
   */
  async getUser(id: string) {
    return this.get(`/api/users/${id}`);
  }

  /**
   * GET user profile with related data
   */
  async getUserProfile(id: string) {
    return this.get(`/api/users/${id}/profile`);
  }

  /**
   * GET flights with optional filters
   */
  async getFlights(filters?: { status?: string; date?: string; aircraft_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date) params.append('date', filters.date);
    if (filters?.aircraft_id) params.append('aircraft_id', filters.aircraft_id);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/flights${query}`);
  }

  /**
   * GET flight by ID
   */
  async getFlight(id: string) {
    return this.get(`/api/flights/${id}`);
  }

  /**
   * GET active flights (in flight now)
   */
  async getActiveFlights() {
    return this.get('/api/flights/active/now');
  }

  /**
   * GET clients
   */
  async getClients() {
    return this.get('/api/clients');
  }

  /**
   * GET client by ID with financial summary
   */
  async getClient(id: string) {
    return this.get(`/api/clients/${id}`);
  }

  /**
   * GET client contracts
   */
  async getClientContracts(id: string) {
    return this.get(`/api/clients/${id}/contracts`);
  }

  /**
   * GET all aircraft
   */
  async getAircraft() {
    return this.get('/api/aircraft');
  }

  /**
   * GET aircraft by ID with maintenance and flight hours
   */
  async getAircraftDetail(id: string) {
    return this.get(`/api/aircraft/${id}`);
  }

  /**
   * GET aircraft availability
   */
  async getAircraftAvailability(id: string) {
    return this.get(`/api/aircraft/${id}/availability`);
  }

  /**
   * GET cache statistics
   */
  async getCacheStats() {
    return this.get('/api/cache/stats');
  }

  /**
   * Clear cache
   */
  async clearCache(pattern?: string) {
    return this.post('/api/cache/clear', { pattern });
  }

  /**
   * GET aerodromes
   */
  async getAerodromes() {
    return this.get('/api/aerodromes');
  }

  /**
   * GET financial categories
   */
  async getCategories() {
    return this.get('/api/categories');
  }

  /**
   * GET financial categories grouped by type
   */
  async getCategoriesByType() {
    return this.get('/api/categories/unique-by-type');
  }

  /**
   * CREATE maintenance
   */
  async createMaintenance(payload: any) {
    return this.post('/api/maintenances', payload);
  }

  /**
   * UPDATE maintenance
   */
  async updateMaintenance(id: string, payload: any) {
    return this.post(`/api/maintenances/${id}`, payload);
  }

  /**
   * CREATE flight document
   */
  async createFlightDocument(payload: any) {
    return this.post('/api/flight-documents', payload);
  }

}

// Export singleton instance
export const apiClient = new ApiClient();
