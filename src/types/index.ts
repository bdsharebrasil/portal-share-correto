// Common types used across the application

export interface Aircraft {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
  serial_number: string;
  year?: string;
  status: string;
  owner_name: string;
  base?: string;
  image_url?: string;
  hourly_price?: string;
  fuel_consumption?: number;
  horimeter_start?: number;
  horimeter_end?: number;
  horimeter_active?: number;
  cell_hours_current?: number;
  cell_hours_prev?: number;
  cell_hours_before?: number;
  celula_prox_revisao?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Aerodrome {
  id: string;
  designativo: string;
  name: string;
  coordenadas?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  company_name?: string;
  proprietario?: string;
  cnpj?: string;
  inscricao_estadual?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  uf?: string;
  aircraft?: string;
  share_percentage?: number;
  status?: string;
  financial_contact?: string;
  logo_url?: string;
  observations?: string;
  documents?: any;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
  avatar_url?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}
