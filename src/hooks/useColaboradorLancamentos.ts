import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ColaboradorLancamento {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo_movimento: string;
  categoria_id: string | null;
  grupo_categoria: string | null;
  status: string | null;
  comprovante_url: string | null;
}

export function useColaboradorLancamentos(colaboradorId: string | null) {
  return useQuery({
    queryKey: ["colaborador_lancamentos", colaboradorId],
    queryFn: async () => {
      if (!colaboradorId) return [];

      const { data, error } = await supabase
        .from("controle_bancario")
        .select(`
          id,
          data,
          descricao,
          valor,
          tipo_movimento,
          categoria_id,
          grupo_categoria,
          status,
          comprovante_url
        `)
        .eq("colaborador_id", colaboradorId)
        .order("data", { ascending: false });

      if (error) {
        console.error("Erro ao buscar lançamentos do colaborador:", error);
        return [];
      }

      return (data || []) as ColaboradorLancamento[];
    },
    enabled: !!colaboradorId,
  });
}

export function useColaboradorResumoFinanceiro(colaboradorId: string | null) {
  const { data: lancamentos = [], isLoading } = useColaboradorLancamentos(colaboradorId);

  const resumo = {
    totalSalarios: 0,
    totalDecimoTerceiro: 0,
    totalFerias: 0,
    totalAdiantamentos: 0,
    totalBeneficios: 0,
    totalOutros: 0,
    totalGeral: 0,
  };

  lancamentos.forEach((l) => {
    const desc = l.descricao?.toLowerCase() || "";
    const valor = Number(l.valor) || 0;

    if (desc.includes("salário") && !desc.includes("13")) {
      resumo.totalSalarios += valor;
    } else if (desc.includes("13º") || desc.includes("décimo") || desc.includes("decimo")) {
      resumo.totalDecimoTerceiro += valor;
    } else if (desc.includes("férias") || desc.includes("ferias")) {
      resumo.totalFerias += valor;
    } else if (desc.includes("adiantamento")) {
      resumo.totalAdiantamentos += valor;
    } else if (desc.includes("benefício") || desc.includes("beneficio") || desc.includes("vale")) {
      resumo.totalBeneficios += valor;
    } else {
      resumo.totalOutros += valor;
    }

    resumo.totalGeral += valor;
  });

  return { resumo, lancamentos, isLoading };
}
