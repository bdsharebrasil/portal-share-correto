import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FuelSupplier {
  id: string;
  city_name: string;
  icao_code: string;
  supplier_name: string;
  contact_person: string | null;
  phone: string | null;
  fuel_price_avgas: number | null;
  fuel_price_jet: number | null;
}

/**
 * Hook para buscar fornecedores de combustível
 */
export function useFuelSuppliers() {
  return useQuery({
    queryKey: ["fuel-suppliers"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("fuel_suppliers")
          .select("*")
          .order("supplier_name");

        if (error) {
          console.warn("Erro ao buscar fornecedores de combustível:", error);
          return [];
        }

        return (data || []) as FuelSupplier[];
      } catch (err) {
        console.warn("Erro ao buscar fornecedores de combustível:", err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
