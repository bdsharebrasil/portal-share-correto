import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inferAircraftDefaults, parseAerodromeCoords } from "./utils";
import type { AerodromeSel, AircraftSel } from "./context";

/** Preço médio de combustível a partir de `fornecedores_combustivel`. */
export function useFuelPrices() {
  return useQuery({
    queryKey: ["simulador-fuel-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores_combustivel")
        .select("preco_avgas, preco_jet");
      if (error) throw error;
      const rows = data ?? [];
      const avg = (key: "preco_avgas" | "preco_jet") => {
        const vals = rows.map((r) => Number(r[key])).filter((n) => Number.isFinite(n) && n > 0);
        if (!vals.length) return null;
        return vals.reduce((s, n) => s + n, 0) / vals.length;
      };
      return { media_avgas: avg("preco_avgas"), media_jet: avg("preco_jet") };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Aeronaves ativas para a seleção. */
export function useAircraftOptions() {
  return useQuery<AircraftSel[]>({
    queryKey: ["simulador-aeronaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aeronave")
        .select(
          "id, fabricante, modelo, matricula, url_imagem, velocidade_cruzeiro, consumo_combustivel, preco_hora, status"
        )
        .order("modelo", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id,
        name: `${a.fabricante ?? ""} ${a.modelo ?? ""}`.trim() || a.matricula,
        matricula: a.matricula,
        image: a.url_imagem ?? null,
        cruiseKts: Number(a.velocidade_cruzeiro ?? 0) || 180,
        fuelBurnLph: Number(a.consumo_combustivel ?? 0) || 90,
        pilotHourlyBRL: Number(a.preco_hora ?? 0) || 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Aeródromos + busca. */
export function useAerodromeSearch(query: string) {
  return useQuery<AerodromeSel[]>({
    queryKey: ["simulador-aerodromes", query],
    queryFn: async () => {
      let q = supabase.from("aerodromes").select("id, designativo, nome, coordenadas").limit(30);
      if (query.trim().length >= 2) {
        const term = `%${query.trim()}%`;
        q = q.or(`designativo.ilike.${term},nome.ilike.${term}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? [])
        .map((r) => {
          const coords = parseAerodromeCoords(r.coordenadas);
          if (!coords) return null;
          return { id: r.id, icao: r.designativo, name: r.nome, lat: coords.lat, lon: coords.lon };
        })
        .filter(Boolean) as AerodromeSel[];
    },
    staleTime: 60 * 1000,
  });
}

export { inferAircraftDefaults };
