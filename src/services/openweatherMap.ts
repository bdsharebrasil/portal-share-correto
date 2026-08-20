const SUPABASE_URL = 'https://jilmlmdgeyzubylncpjy.supabase.co';
export const OPENWEATHER_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/openweather-map`;

export type OpenWeatherLayer = 'clouds_new' | 'precipitation_new' | 'pressure_new' | 'wind_new' | 'temp_new';

export function openWeatherTileUrl(layer: OpenWeatherLayer) {
  return `${OPENWEATHER_FUNCTION_URL}?mode=tile&layer=${layer}&z={z}&x={x}&y={y}`;
}

export interface OpenWeatherPoint {
  name?: string;
  main?: { temp?: number; feels_like?: number; pressure?: number; humidity?: number; visibility?: number };
  wind?: { speed?: number; deg?: number; gust?: number };
  weather?: Array<{ description?: string; icon?: string }>;
  clouds?: { all?: number };
  rain?: { '1h'?: number };
  snow?: { '1h'?: number };
  dt?: number;
}

export async function fetchOpenWeatherPointDirect(lat: number, lon: number): Promise<OpenWeatherPoint> {
  const response = await fetch(`${OPENWEATHER_FUNCTION_URL}?mode=point&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || 'Não foi possível consultar a meteorologia.');
  return body;
}
