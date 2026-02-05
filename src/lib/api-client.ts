// Configuração para comunicação com o backend na Vercel

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface ApiError {
  error: string;
  details?: any;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API Error: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Métodos HTTP básicos
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const queryString = params
      ? '?' + new URLSearchParams(params).toString()
      : '';
    return this.request<T>(`${endpoint}${queryString}`);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // ========== HEALTH CHECK ==========
  async healthCheck() {
    try {
      const response = await this.get<{ status: string; uptime?: number }>('/api/health');
      return { success: true, data: response };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ========== USERS ==========
  async getUsers() {
    return this.get('/api/users');
  }

  async getUser(id: string) {
    return this.get(`/api/users/${id}`);
  }

  async getUserProfile(id: string) {
    return this.get(`/api/users/${id}/profile`);
  }

  // ========== FLIGHTS ==========
  async getFlights(filters?: { status?: string; date?: string; aircraft_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date) params.append('date', filters.date);
    if (filters?.aircraft_id) params.append('aircraft_id', filters.aircraft_id);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.get(`/api/flights${query}`);
  }

  async getFlight(id: string) {
    return this.get(`/api/flights/${id}`);
  }

  async getActiveFlights() {
    return this.get('/api/flights/active/now');
  }

  async createFlight(data: any) {
    return this.post('/api/flights', data);
  }

  async updateFlight(id: string, data: any) {
    return this.put(`/api/flights/${id}`, data);
  }

  // ========== CLIENTS ==========
  async getClients() {
    return this.get('/api/clients');
  }

  async getClient(id: string) {
    return this.get(`/api/clients/${id}`);
  }

  async getClientContracts(id: string) {
    return this.get(`/api/clients/${id}/contracts`);
  }

  async createClient(data: any) {
    return this.post('/api/clients', data);
  }

  async updateClient(id: string, data: any) {
    return this.put(`/api/clients/${id}`, data);
  }

  // ========== AIRCRAFT ==========
  async getAircraft() {
    return this.get('/api/aircraft');
  }

  async getAircraftDetail(id: string) {
    return this.get(`/api/aircraft/${id}`);
  }

  async getAircraftAvailability(id: string) {
    return this.get(`/api/aircraft/${id}/availability`);
  }

  async createAircraft(data: any) {
    return this.post('/api/aircraft', data);
  }

  async updateAircraft(id: string, data: any) {
    return this.put(`/api/aircraft/${id}`, data);
  }

  // ========== AERODROMES ==========
  async getAerodromes() {
    return this.get('/api/aerodromes');
  }

  async getAerodromeDetails() {
    return this.get('/api/aerodromes/details');
  }

  // ========== CATEGORIES ==========
  async getCategories() {
    return this.get('/api/categories');
  }

  async getCategoriesByType() {
    return this.get('/api/categories/unique-by-type');
  }

  // ========== MAINTENANCE ==========
  async createMaintenance(payload: any) {
    return this.post('/api/maintenances', payload);
  }

  async updateMaintenance(id: string, payload: any) {
    return this.patch(`/api/maintenances/${id}`, payload);
  }

  async deleteMaintenance(id: string) {
    return this.delete(`/api/maintenances/${id}`);
  }

  // ========== FLIGHT DOCUMENTS ==========
  async createFlightDocument(payload: any) {
    return this.post('/api/flight-documents', payload);
  }

  async getFlightDocuments(flightId: string) {
    return this.get(`/api/flight-documents?flight_id=${flightId}`);
  }

  async deleteFlightDocument(id: string) {
    return this.delete(`/api/flight-documents/${id}`);
  }

  // ========== WEATHER ==========
  async getWeather(icao: string) {
    return this.get(`/api/weather/metar?icao=${icao.toUpperCase()}`);
  }

  // ========== FLIGHT CALCULATIONS ==========
  async calculateFlight(payload: any) {
    return this.post('/api/flight-calculations', payload);
  }

  // ========== CACHE ==========
  async getCacheStats() {
    return this.get('/api/cache/stats');
  }

  async clearCache(pattern?: string) {
    return this.post('/api/cache/clear', { pattern });
  }

  // ========== PDF LOGS ==========
  async sendPdfLogs(logs: any) {
    return this.post('/api/pdf-logs', logs);
  }
}

// Instância única da API
export const apiClient = new ApiClient(API_BASE_URL);

// Helper para tratamento de erros
export function handleApiError(error: any): string {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.message) {
    return error.message;
  }
  return 'Erro desconhecido na API';
}
