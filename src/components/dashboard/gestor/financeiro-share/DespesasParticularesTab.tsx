import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DetalhamentoCategoriasGrid from "@/components/dashboard/gestor/master/DetalhamentoCategoriasGrid";
import { setCategoriaMap } from "@/components/dashboard/gestor/master/MasterRelatorios";

/**
 * Mesma apresentação da tabela "Despesas Particulares" do Gestor Master,
 * porém dentro do módulo Financeiro Share (Gestão Fiscal).
 */
export default function DespesasParticularesTab() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const anos = useMemo(
    () => Array.from({ length: 6 }, (_, i) => anoAtual - i),
    [anoAtual],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["share-despesas-particulares", ano],
    queryFn: async () => {
      const [movRes, catRes] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select(
            "id, descricao, tipo, valor_rateado, valor_original, data_competencia, data_pagamento, status, tipo_caixa, categoria_id, categoria_nome, grupo_custo, conta_bancaria",
          )
          .gte("data_competencia", `${ano}-01-01`)
          .lte("data_competencia", `${ano}-12-31`)
          .neq("status", "cancelado")
          .order("data_competencia", { ascending: false })
          .limit(5000),
        supabase
          .from("categorias_movimentacao")
          .select("id, grupo_categoria, tipo_despesa"),
      ]);
      if (movRes.error) throw movRes.error;

      const catMap = new Map<string, { grupo: string; tipoDespesa: string | null }>();
      (catRes.data || []).forEach((c: any) => {
        catMap.set(c.id, {
          grupo: c.grupo_categoria || "",
          tipoDespesa: c.tipo_despesa || null,
        });
      });
      setCategoriaMap(catMap);

      return (movRes.data || []).filter(
        (m: any) => String(m.tipo_caixa || "").toLowerCase() === "share",
      );
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">Ano</span>
        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="rounded-lg border border-border bg-background px-3 py-1 text-sm text-foreground outline-none transition-colors focus:border-primary"
        >
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Carregando lançamentos...
        </div>
      ) : (
        <DetalhamentoCategoriasGrid
          movimentacoes={(data as any) || []}
          subtitle="Despesas particulares do caixa Share agrupadas por mês"
        />
      )}
    </div>
  );
}
