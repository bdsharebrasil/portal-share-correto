import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface Aerodromo {
  id?: string;
  designativo: string;
  name: string;
  coordenadas?: string;
}

const aerodromesQueryKey = ["aerodromes-list"];

/**
 * Hook para buscar todos os aeródromos via Worker (GET /api/rotaer/:icao não existe sem ICAO,
 * então usamos GET /api/geiloc que retorna a lista geral de aeródromos).
 */
export const useAerodromes = () => {
  const query = useQuery<Aerodromo[]>({
    queryKey: aerodromesQueryKey,
    queryFn: async () => {
      const data = await apiClient.getGeiloc(""); // lista geral sem ICAO
      // Normaliza qualquer estrutura retornada pelo Worker
      const src = data?.geiloc ?? data?.item ?? data;
      const items: any[] = Array.isArray(src) ? src : [src];

      return items
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id:          item?.id        ?? undefined,
          designativo: item?.icaoCode  ?? item?.icao ?? item?.CodICAO ?? "",
          name:        item?.nome      ?? item?.name ?? item?.Name    ?? "",
          coordenadas: item?.latitude && item?.longitude
            ? `${item.latitude},${item.longitude}`
            : undefined,
        }))
        .filter((a) => a.designativo.length === 4)
        .sort((a, b) => a.designativo.localeCompare(b.designativo));
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 horas
    gcTime:    30 * 60 * 1000,       // 30 minutos
  });

  return {
    aerodromes:          query.data ?? [],
    isLoadingAerodromes: query.isLoading,
    refetchAerodromes:   query.refetch,
    errorAerodromes:     query.error,
  };
};