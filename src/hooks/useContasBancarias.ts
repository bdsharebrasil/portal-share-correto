import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContaBancaria {
  id: string;
  banco: string;
  numero_conta: string;
  tipo_conta: string;
  ativo: boolean;
}

export function useContasBancarias() {
  return useQuery({
    queryKey: ["contas-bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("id, banco, numero_conta, tipo_conta, ativo")
        .eq("ativo", true)
        .order("banco", { ascending: true });

      if (error) throw error;
      return data as ContaBancaria[];
    },
  });
}
