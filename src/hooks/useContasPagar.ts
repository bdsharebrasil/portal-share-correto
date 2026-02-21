import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContaPagar {
  id: string;
  numero: string;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  categoria: string;
  descricao: string | null;
  data_vencimento: string;
  data_recebimento: string;
  valor: number;
  status: string;
  aeronave: string;
  metodo_pagamento: string | null;
  arquivo_pdf_url: string | null;
  observacoes: string | null;
}

export function useContasPagar() {
  return useQuery({
    queryKey: ["contas-pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_apagar")
        .select("*")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data as ContaPagar[];
    },
  });
}
