import { useState, useEffect } from 'react';

export function useUserLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error("Erro ao pegar localização", err)
    );
  }, []);

  return coords;
}