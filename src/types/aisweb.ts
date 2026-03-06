// Types for AISWeb API responses

export interface NOTAMData {
  id: string;
  icao: string;
  number: string;
  type: 'NOTAM' | 'NOTAMR' | 'NOTAMC';
  category: string;
  traffic: string;
  purpose: string;
  scope: string;
  lower: string;
  upper: string;
  coordinates: string | null;
  radius: number | null;
  message: string;
  startDate: string;
  endDate: string;
  schedule: string | null;
  created: string;
  source: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ROTAERData {
  icao: string;
  name: string;
  city: string;
  state: string;
  country: string;
  type: string;
  coordinates: { lat: number; lng: number };
  elevation: number;
  runways: Array<{
    designator: string;
    length: number;
    width: number;
    surface: string;
    strength: string;
    lighting: boolean;
  }>;
  frequencies: Array<{
    type: string;
    frequency: string;
    name?: string;
  }>;
  navaids: Array<{
    type: string;
    identifier: string;
    frequency: string;
  }>;
  services: {
    fuel: boolean;
    fuelTypes?: string[];
    hangar: boolean;
    maintenance: boolean;
    customs: boolean;
    firefighting?: string;
    meteorology?: boolean;
    ais?: boolean;
  };
  operatingHours: string;
  restrictions: string[];
  contact?: {
    phone?: string;
    fax?: string;
    email?: string;
  };
}

export interface AIPData {
  icao: string;
  charts: Array<{
    name: string;
    type: string;
    url?: string;
  }>;
  procedures: {
    sid: string[];
    star: string[];
    iap: string[];
  };
  minima: {
    circling?: string;
    straight?: string;
  };
}

export interface AirspaceRestriction {
  id: string;
  name: string;
  type: 'TMA' | 'CTR' | 'FIR' | 'D' | 'R' | 'P' | 'TSA' | 'ATZ';
  class?: string;
  lowerLimit: string;
  upperLimit: string;
  active: boolean;
  schedule: string | null;
  coordinates: Array<{ lat: number; lng: number }>;
  notes: string;
  controllingAuthority?: string;
  frequency?: string;
}

export interface AISWebResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  source: string;
  error?: string;
}

export interface RouteValidation {
  valid: boolean;
  notams: Record<string, NOTAMData[]>;
  originStatus: {
    operational: boolean;
    reason: string | null;
    criticalNOTAMs: NOTAMData[];
    warnings?: string[];
  };
  destinationStatus: {
    operational: boolean;
    reason: string | null;
    criticalNOTAMs: NOTAMData[];
    warnings?: string[];
  };
  alternateStatus?: {
    operational: boolean;
    reason: string | null;
    criticalNOTAMs: NOTAMData[];
    warnings?: string[];
  };
  restrictions: AirspaceRestriction[];
  warnings: string[];
  routeStatus: 'clear' | 'caution' | 'warning' | 'danger';
}

// Utility types
export interface AISWebCache {
  notams: Record<string, { data: NOTAMData[]; timestamp: number }>;
  rotaer: Record<string, { data: ROTAERData | null; timestamp: number }>;
  aip: Record<string, { data: AIPData | null; timestamp: number }>;
  restrictions: Record<string, { data: AirspaceRestriction[]; timestamp: number }>;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  source: 'api' | 'cache' | 'offline';
}
