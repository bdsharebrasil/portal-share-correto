import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustoSocio {
  socio_id: string;
  socio_nome: string;
  total_devido: number;
  total_aportado: number;
  saldo: number;
}

export interface MovimentacaoCaixa {
  id: string;
  data_competencia: string;
  descricao: string;
  valor: number;
  tipo: string; // receita | despesa
  categorias_movimentacao?: { nome: string } | null;
}

export interface RelatorioCustosModelo2Data {
  saldo_caixa_holding: number;
  total_aportes_socios: number;
  total_despesas_pagas: number;
  custos_por_socio: CustoSocio[];
  movimentacoes_caixa: MovimentacaoCaixa[];
}

export function useRelatorioCustosModelo2(
  clienteId: string | undefined,
  aeronaveId?: string,
  dataInicio?: string,
  dataFim?: string,
) {
  return useQuery<RelatorioCustosModelo2Data | null>({
    queryKey: ["relatorio-custos-modelo2", clienteId, aeronaveId, dataInicio, dataFim],
    enabled: !!clienteId,
    queryFn: async () => {
      // Sócios do cliente
      const { data: socios } = await supabase
        .from("socios")
        .select("id, nome")
        .eq("cliente_id", clienteId as string);

      // Movimentações do caixa "cliente"
      let mq = supabase
        .from("movimentacoes")
        .select(
          "id, data_competencia, descricao, valor, tipo, tipo_caixa, categoria_id, clientes_id, socio_id, aeronave_id, status",
        )
        .eq("clientes_id", clienteId as string)
        .eq("tipo_caixa", "cliente");
      if (aeronaveId) mq = mq.eq("aeronave_id", aeronaveId);
      if (dataInicio) mq = mq.gte("data_competencia", dataInicio);
      if (dataFim) mq = mq.lte("data_competencia", dataFim);
      const { data: movs, error } = await mq.order("data_competencia", {
        ascending: false,
      });
      if (error) throw error;
      const list = (movs as any[]) || [];

      // Categorias para join
      const catIds = Array.from(
        new Set(list.map((r) => r.categoria_id).filter(Boolean)),
      );
      const catMap: Record<string, string> = {};
      if (catIds.length) {
        const { data: cats } = await supabase
          .from("categorias_movimentacao")
          .select("id, nome")
          .in("id", catIds as string[]);
        (cats || []).forEach((c: any) => (catMap[c.id] = c.nome));
      }

      let totalAportes = 0;
      let totalDespesas = 0;
      const aportePorSocio: Record<string, number> = {};

      for (const m of list) {
        const v = Number(m.valor) || 0;
        const tipo = (m.tipo || "").toLowerCase();
        if (tipo === "receita" || tipo === "entrada") {
          totalAportes += v;
          if (m.socio_id) {
            aportePorSocio[m.socio_id] =
              (aportePorSocio[m.socio_id] || 0) + v;
          }
        } else {
          totalDespesas += v;
        }
      }

      const sociosList = (socios as any[]) || [];
      const n = sociosList.length || 1;
      const devidoPorSocio = totalDespesas / n;

      const custos_por_socio: CustoSocio[] = sociosList.map((s) => {
        const total_aportado = aportePorSocio[s.id] || 0;
        return {
          socio_id: s.id,
          socio_nome: s.nome,
          total_devido: devidoPorSocio,
          total_aportado,
          saldo: total_aportado - devidoPorSocio,
        };
      });

      const movimentacoes_caixa: MovimentacaoCaixa[] = list.map((m) => ({
        id: m.id,
        data_competencia: m.data_competencia,
        descricao: m.descricao,
        valor: Number(m.valor) || 0,
        tipo: (m.tipo || "").toLowerCase() === "receita" || (m.tipo || "").toLowerCase() === "entrada"
          ? "receita"
          : "despesa",
        categorias_movimentacao: m.categoria_id
          ? { nome: catMap[m.categoria_id] || "Geral" }
          : { nome: "Geral" },
      }));

      return {
        saldo_caixa_holding: totalAportes - totalDespesas,
        total_aportes_socios: totalAportes,
        total_despesas_pagas: totalDespesas,
        custos_por_socio,
        movimentacoes_caixa,
      };
    },
  });
}
