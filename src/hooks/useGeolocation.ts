import { useState, useEffect, useCallback } from 'react';

export interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function useGeolocation(options?: { icao?: string; useBackendFallback?: boolean }) {
  const { icao, useBackendFallback = true } = options || {};
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation não é suportado neste navegador');
      setLoading(false);
      // tentar backend se configurado
      if (useBackendFallback) {
        fetchBackendGeiloc();
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        // Silenciosamente falhar para erros de permissão
        // O fallback para SBGR no WeatherDisplay será acionado após 5 segundos
        setError(err.message);
        setLoading(false);
        if (useBackendFallback) fetchBackendGeiloc();
      },
      {
        timeout: 5000,
        maximumAge: Infinity,
        enableHighAccuracy: false,
      }
    );
  }, []);

  const fetchBackendGeiloc = async () => {
    try {
      setLoading(true);
      const q = icao ? `?icao=${encodeURIComponent(icao)}` : '';
      const res = await fetch(`/api/geiloc${q}`);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) throw new Error(`Geiloc backend HTTP ${res.status}`);

      let data: any;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        try { data = JSON.parse(text); } catch { data = text; }
      }

      const found = findCoordinatesInObject(data);
      if (found) {
        setCoords(found);
        setError(null);
      } else {
        setError('Backend geiloc não retornou coordenadas');
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const findCoordinatesInObject = (obj: any): GeolocationCoordinates | null => {
    if (!obj) return null;

    // procura por chaves comuns
    const tryKeys = (o: any) => {
      if (typeof o !== 'object') return null;
      const lowKeys = Object.keys(o).reduce<Record<string, any>>((acc, k) => { acc[k.toLowerCase()] = o[k]; return acc; }, {} as any);
      const lat = lowKeys['latitude'] ?? lowKeys['lat'];
      const lon = lowKeys['longitude'] ?? lowKeys['lon'] ?? lowKeys['lng'];
      const acc = lowKeys['accuracy'] ?? lowKeys['acc'];
      if ((lat !== undefined && lon !== undefined) && !Array.isArray(lat)) {
        const latNum = parseFloat(String(lat));
        const lonNum = parseFloat(String(lon));
        if (!Number.isNaN(latNum) && !Number.isNaN(lonNum)) {
          return { latitude: latNum, longitude: lonNum, accuracy: acc ? Number(acc) : 1000 };
        }
      }
      return null;
    };

    // busca recursiva
    const stack = [obj];
    while (stack.length > 0) {
      const cur = stack.pop();
      const attempt = tryKeys(cur);
      if (attempt) return attempt;
      if (Array.isArray(cur)) {
        for (const item of cur) stack.push(item);
      } else if (typeof cur === 'object') {
        for (const v of Object.values(cur)) stack.push(v);
      }
    }
    return null;
  };

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { coords, loading, error, requestLocation };
}
