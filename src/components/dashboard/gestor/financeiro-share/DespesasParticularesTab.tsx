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
      const [movRes, contaRes, catRes] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select(
            "id, descricao, fluxo, valor_rateado, valor_total, data_emissao, data_pagamento, criado_em, status, tipo_caixa, categoria_id, categoria_nome, conta_bancaria, grupo_categoria",
          )
          .neq("status", "cancelado")
          .order("criado_em", { ascending: false })
          .limit(5000),
        supabase
          .from("contas_apagar")
          .select("id, descricao, valor, data_vencimento, data_pagamento, status, categoria, conta_pagamento_fornecedor, fornecedor_nome, criado_em")
          .neq("status", "cancelado")
          .neq("status", "cancelada")
          .order("data_vencimento", { ascending: false })
          .limit(5000),
        supabase
          .from("categorias_movimentacao")
          .select("id, grupo_categoria, tipo_despesa"),
      ]);
      if (movRes.error) throw movRes.error;
      if (contaRes.error) throw contaRes.error;
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
      const movimentacoes = (movRes.data || [])
        .filter((m: any) => {
          const caixa = String(m.tipo_caixa || "").toLowerCase();
          return caixa === "share" || caixa === "";
        })
        .map((m: any) => {
          const dataReferencia = String(m.data_emissao || m.data_pagamento || m.criado_em || "").trim();
          const grupo = m.grupo_categoria || catMap.get(m.categoria_id)?.grupo || "";
          return {
            ...m,
            grupo_categoria: grupo,
            data_emissao: dataReferencia ? dataReferencia.slice(0, 10) : "",
          };
        });

      const contasParticulares = (contaRes.data || []).map((conta: any) => ({
        id: `conta-particular-${conta.id}`,
        descricao: conta.descricao || conta.fornecedor_nome || "Despesa particular",
        fluxo: "saida",
        valor_total: conta.valor,
        valor_rateado: conta.valor,
        data_emissao: String(conta.data_vencimento || conta.data_pagamento || conta.criado_em || "").slice(0, 10),
        data_pagamento: conta.data_pagamento,
        status: conta.status,
        tipo_caixa: "share",
        categoria_nome: conta.categoria || "Despesas Particulares",
        grupo_categoria: "DESPESAS PARTICULARES",
        conta_bancaria: conta.conta_pagamento_fornecedor,
        fornecedor_nome: conta.fornecedor_nome,
      }));

      return [...movimentacoes, ...contasParticulares].filter((m: any) => {
        if (!m.data_emissao || !/^\d{4}-\d{2}-\d{2}$/.test(m.data_emissao)) return false;
        return m.data_emissao.startsWith(String(ano));
      });
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
