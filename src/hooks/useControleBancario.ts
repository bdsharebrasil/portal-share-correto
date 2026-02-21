import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ControleBancario {
  id: string;
  data: string;
  tipo_movimento: string;
  descricao: string;
  valor: number;
  categoria_id: string;
  conta_banco: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  client_id: string | null;
  client_name: string | null;
  status: string | null;
  comprovante_url: string | null;
  nf_url: string | null;
  numero_documento: string | null;
  observacoes: string | null;
  reembolsavel: boolean | null;
  tem_rateio: boolean | null;
  grupo_categoria: string | null;
}

export function useControleBancario() {
  return useQuery({
    queryKey: ["controle-bancario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("controle_bancario")
        .select("*")
        .order("data", { ascending: false });

      if (error) throw error;
      return data as ControleBancario[];
    },
  });
}
