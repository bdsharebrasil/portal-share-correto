import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotaFiscalSaida {
  id: string;
  numero: string;
  cliente_nome: string;
  cliente_cnpj: string;
  data_criacao: string;
  data_vencimento: string;
  valor: number;
  categoria: string;
  descricao: string | null;
  status: string;
  arquivo_pdf_url: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  criado_por: string | null;
}

export function useNotasFiscaisSaida() {
  return useQuery({
    queryKey: ["notas-fiscais-saida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais_saida")
        .select("*")
        .order("data_criacao", { ascending: false });

      if (error) throw error;
      return data as NotaFiscalSaida[];
    },
  });
}
