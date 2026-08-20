import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DetalhamentoCategoriasGrid from "@/components/dashboard/gestor/master/DetalhamentoCategoriasGrid";
import { setCategoriaMap } from "@/components/dashboard/gestor/master/MasterRelatorios";

/**
 * Mesma apresentação da tabela "Despesas Particulares" do Gestor Master,
 * porém dentro do módulo Financeiro Share (Gestão Fiscal).
 */

const norm = (s: any) => String(s ?? "").trim().toUpperCase();

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
      const inicioAno = `${ano}-01-01`;
      const fimAno = `${ano}-12-31`;
      const inicioAnoTs = `${inicioAno}T00:00:00`;
      const fimAnoTs = `${fimAno}T23:59:59`;

      const [movRes, contaRes, catRes] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select(
            "id, descricao, fluxo, valor_rateado, valor_total, data_emissao, data_pagamento, criado_em, status, tipo_caixa, categoria_id, categoria_nome, conta_bancaria, grupo_categoria, contas_apagar_id",
          )
          .neq("status", "cancelado")
          // Muitos lançamentos não têm data_emissao — sem esse fallback no
          // próprio filtro da query, o corte de ano acontecia só no JS,
          // depois do limit(5000) ordenado por criado_em, e podia excluir
          // anos inteiros de dados que nunca chegavam a ser buscados.
          .or(
            `and(data_emissao.gte.${inicioAno},data_emissao.lte.${fimAno}),` +
              `and(data_emissao.is.null,data_pagamento.gte.${inicioAno},data_pagamento.lte.${fimAno}),` +
              `and(data_emissao.is.null,data_pagamento.is.null,criado_em.gte.${inicioAnoTs},criado_em.lte.${fimAnoTs})`,
          )
          .order("criado_em", { ascending: false })
          .limit(5000),
        supabase
          .from("contas_apagar")
          .select(
            "id, descricao, valor, data_vencimento, data_pagamento, status, categoria, conta_pagamento_fornecedor, fornecedor_nome, criado_em",
          )
          .neq("status", "cancelado")
          .neq("status", "cancelada")
          .or(
            `and(data_vencimento.gte.${inicioAno},data_vencimento.lte.${fimAno}),` +
              `and(data_vencimento.is.null,data_pagamento.gte.${inicioAno},data_pagamento.lte.${fimAno}),` +
              `and(data_vencimento.is.null,data_pagamento.is.null,criado_em.gte.${inicioAnoTs},criado_em.lte.${fimAnoTs})`,
          )
          .order("data_vencimento", { ascending: false })
          .limit(5000),
        supabase
          .from("categorias_movimentacao")
          .select("id, nome, grupo_categoria, tipo_despesa"),
      ]);
      if (movRes.error) throw movRes.error;
      if (contaRes.error) throw contaRes.error;

      const catMap = new Map<string, { grupo: string; tipoDespesa: string | null }>();
      const nomesParticulares = new Set<string>();
      (catRes.data || []).forEach((c: any) => {
        catMap.set(c.id, {
          grupo: c.grupo_categoria || "",
          tipoDespesa: c.tipo_despesa || null,
        });
        if (norm(c.grupo_categoria) === "DESPESAS PARTICULARES" && c.nome) {
          nomesParticulares.add(norm(c.nome));
        }
      });
      setCategoriaMap(catMap);

      // IDs de contas_apagar que já viraram lançamento em movimentacoes —
      // usados pra não contar a mesma despesa duas vezes.
      const contasJaLancadas = new Set(
        (movRes.data || [])
          .map((m: any) => m.contas_apagar_id)
          .filter(Boolean),
      );

      const movimentacoes = (movRes.data || [])
        .filter((m: any) => {
          const caixa = norm(m.tipo_caixa);
          if (caixa !== "SHARE" && caixa !== "") return false;
          const grupo = norm(m.grupo_categoria) || norm(catMap.get(m.categoria_id)?.grupo);
          return grupo === "DESPESAS PARTICULARES";
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

      const contasParticulares = (contaRes.data || [])
        .filter((conta: any) => !contasJaLancadas.has(conta.id))
        .filter((conta: any) => nomesParticulares.has(norm(conta.categoria)))
        .map((conta: any) => ({
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