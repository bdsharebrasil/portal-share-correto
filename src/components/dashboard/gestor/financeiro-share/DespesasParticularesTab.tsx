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
            "id, descricao, tipo, fluxo, valor_rateado, valor_original, data_emissao, data_pagamento, criado_em, status, tipo_caixa, categoria_id, categoria_nome, grupo_custo, conta_bancaria",
          )
          .neq("status", "cancelado")
          .order("criado_em", { ascending: false })
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

      // Muitos lançamentos não possuem data_emissao — usamos pagamento/criação
      // como referência para agrupar por mês e filtrar o ano.
      return (movRes.data || [])
        .filter((m: any) => {
          const caixa = String(m.tipo_caixa || "").toLowerCase();
          return caixa === "share" || caixa === "";
        })
        .map((m: any) => ({
          ...m,
          data_emissao: String(
            m.data_emissao || m.data_pagamento || m.criado_em || "",
          ).slice(0, 10),
        }))
        .filter((m: any) => m.data_emissao.startsWith(String(ano)));
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
