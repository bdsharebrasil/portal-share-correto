import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface ContaBancaria {
  id: string;
  banco: string | null;
  numero_conta: string | null;
  tipo_conta: string | null;
  ativo: boolean | null;
}

export function useContasBancarias() {
  return useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("id, banco, numero_conta, tipo_conta, ativo")
        .eq("ativo", true)
        .order("banco");

      if (error) throw error;
      return (data ?? []) as ContaBancaria[];
    },
  });
}
