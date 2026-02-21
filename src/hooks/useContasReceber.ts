import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContaReceber {
  id: string;
  numero: string;
  cliente_nome: string;
  cliente_cnpj: string;
  categoria: string;
  descricao: string | null;
  data_criacao: string;
  data_vencimento: string;
  valor: number;
  status: string;
  aeronave: string;
  arquivo_pdf_url: string | null;
}

export function useContasReceber() {
  return useQuery({
    queryKey: ["contas-receber"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_areceber")
        .select("*")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data as ContaReceber[];
    },
  });
}

export function useInadimplencia() {
  return useQuery({
    queryKey: ["inadimplencia"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("contas_areceber")
        .select("*")
        .lt("data_vencimento", today)
        .neq("status", "Recebido")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data as ContaReceber[];
    },
  });
}
