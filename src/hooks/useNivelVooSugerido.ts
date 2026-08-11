// src/hooks/useNivelVooSugerido.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calcularRumo } from '@/lib/flightLevel';

interface Ponto {
  lat: number;
  lng: number;
}

export function useNivelVooSugerido(
  aeronaveId: string | null,
  origem: Ponto | null,
  destino: Ponto | null
) {
  const [nivelSugeridoFt, setNivelSugeridoFt] = useState<number | null>(null);
  const [rumo, setRumo] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aeronaveId || !origem || !destino) {
      setNivelSugeridoFt(null);
      setRumo(null);
      return;
    }

    const rumoCalculado = calcularRumo(origem.lat, origem.lng, destino.lat, destino.lng);
    setRumo(rumoCalculado);

    setCarregando(true);
    setErro(null);

    (async () => {
      const { data, error } = await supabase.rpc('calcular_nivel_voo', {
        p_aeronave_id: aeronaveId,
        p_rumo_magnetico: rumoCalculado,
      });
      if (error) {
        setErro(error.message);
        setNivelSugeridoFt(null);
      } else {
        setNivelSugeridoFt(data as number | null);
      }
      setCarregando(false);
    })();
  }, [aeronaveId, origem?.lat, origem?.lng, destino?.lat, destino?.lng]);

  return { nivelSugeridoFt, rumo, carregando, erro };
}