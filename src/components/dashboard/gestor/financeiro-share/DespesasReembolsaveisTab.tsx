import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard, EmptyState } from "@/components/dashboard/gestor/master/ui/Premium";
import { setCategoriaMap, getCategoriaMap } from "@/components/dashboard/gestor/master/MasterRelatorios";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface ReembolsavelRow {
  id: string;
  mesIdx: number;
  mes: string;
  cliente: string;
  categoria: string;
  banco: string;
  descricao: string;
  valor: number;
}

/**
 * Tab separada para lançamentos cujo grupo_categoria seja
 * "DESPESAS REEMBOLSÁVEIS" — mesma estrutura visual da tab Despesas Particulares.
 */
export default function DespesasReembolsaveisTab() {
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const anos = useMemo(
    () => Array.from({ length: 6 }, (_, i) => anoAtual - i),
    [anoAtual],
  );
  const { data, isLoading } = useQuery({
    queryKey: ["share-despesas-reembolsaveis", ano],
    queryFn: async () => {
      const [movRes, catRes, clientesRes] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select(
            "id, descricao, fluxo, valor_rateado, valor_total, data_emissao, data_pagamento, criado_em, status, tipo_caixa, categoria_id, categoria_nome, conta_bancaria, grupo_categoria, clientes_id, clientes_nome",
          )
          .neq("status", "cancelado")
          .order("criado_em", { ascending: false })
          .limit(5000),
        supabase
          .from("categorias_movimentacao")
          .select("id, grupo_categoria, tipo_despesa"),
        supabase
          .from("clientes")
          .select("id, razao_social, proprietario"),
      ]);
      if (movRes.error) throw movRes.error;
      if (clientesRes.error) throw clientesRes.error;
      const clientesMap = new Map(
        (clientesRes.data || []).map((cliente: any) => [
          cliente.id,
          cliente.razao_social || cliente.proprietario || "Cliente sem nome",
        ]),
      );
      const catMap = new Map<string, { grupo: string; tipoDespesa: string | null }>();
      (catRes.data || []).forEach((c: any) => {
        catMap.set(c.id, {
          grupo: c.grupo_categoria || "",
          tipoDespesa: c.tipo_despesa || null,
        });
      });
      setCategoriaMap(catMap);
      return (movRes.data || [])
        .filter((m: any) => {
          const caixa = String(m.tipo_caixa || "").toLowerCase();
          return caixa === "share" || caixa === "";
        })
        .map((m: any) => {
          const dataReferencia = String(m.data_emissao || m.data_pagamento || "").trim();
          const grupo = m.grupo_categoria || catMap.get(m.categoria_id)?.grupo || "";
          return {
            ...m,
            cliente: m.clientes_nome || clientesMap.get(m.clientes_id) || "Cliente não identificado",
            grupo_categoria: grupo,
            data_emissao: dataReferencia ? dataReferencia.slice(0, 10) : "",
          };
        })
        .filter((m: any) => {
          if (!m.data_emissao || !/^\d{4}-\d{2}-\d{2}$/.test(m.data_emissao)) {
            return false;
          }
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
        <DetalhamentoReembolsaveisGrid
          movimentacoes={(data as any) || []}
        />
      )}
    </div>
  );
}

function DetalhamentoReembolsaveisGrid({
  movimentacoes,
}: {
  movimentacoes: any[];
}) {
  const gridRef = useRef<any>(null);

  const normalize = (v?: string | null) =>
    String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const isEntrada = (m: any) => ["entrada", "receita"].includes(normalize(m.fluxo));
  const val = (m: any) => Number(m.valor_rateado ?? m.valor_total ?? 0);

  const isReembolsavel = (m: any) => {
    const catMap = getCategoriaMap();
    const catInfo = m.categoria_id ? catMap.get(m.categoria_id) : undefined;
    const grupo = normalize(m.grupo_categoria || catInfo?.grupo);
    return grupo.includes("reembolsav");
  };

  const rows: ReembolsavelRow[] = useMemo(() => {
    return movimentacoes
      .filter((m) => !isEntrada(m) && isReembolsavel(m))
      .flatMap((m) => {
        const dataEmissao = /^\d{4}-\d{2}-\d{2}$/.test(String(m.data_emissao || "").trim())
          ? m.data_emissao
          : null;
        if (!dataEmissao) return [];
        const mesIdx = Number(dataEmissao.slice(5, 7)) - 1;
        return [{
          id: m.id,
          mesIdx,
          mes: MESES[mesIdx] ?? "-",
          cliente: (m.cliente || "Cliente não identificado").trim(),
          categoria: (m.categoria_nome || "Sem categoria").trim(),
          banco: (m.conta_bancaria || "-").trim(),
          descricao: (m.descricao || "-").trim(),
          valor: val(m),
        }];
      })
      .sort((a, b) => a.mesIdx - b.mesIdx || a.categoria.localeCompare(b.categoria) || b.valor - a.valor);
  }, [movimentacoes]);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const availableMonths = useMemo(
    () => Array.from(new Set(rows.map((r) => r.mesIdx))).sort((a, b) => a - b),
    [rows],
  );
  useEffect(() => {
    if (selectedMonth === null && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const filteredRows = useMemo(
    () => (selectedMonth === null ? rows : rows.filter((row) => row.mesIdx === selectedMonth)),
    [rows, selectedMonth],
  );

  const [total, setTotal] = useState(0);
  useEffect(() => {
    const grid = gridRef.current;
    const visibleRows = Array.isArray(grid?.dataView) ? grid.dataView : filteredRows;
    setTotal((visibleRows as ReembolsavelRow[]).reduce((s, r) => s + r.valor, 0));
  }, [filteredRows]);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const handler = () => {
      const visibleRows = Array.isArray(grid?.dataView) ? grid.dataView : filteredRows;
      setTotal((visibleRows as ReembolsavelRow[]).reduce((s, r) => s + r.valor, 0));
    };
    grid.addEventListener("filtered", handler);
    return () => grid.removeEventListener("filtered", handler);
  }, [filteredRows]);

  const columns = useMemo(
    () => [
      { key: "cliente", headerText: "Cliente", sort: true, filter: true, width: "240px" },
      { key: "categoria", headerText: "Categoria", sort: true, filter: true },
      { key: "banco", headerText: "Banco", sort: true, filter: true, width: "180px" },
      { key: "descricao", headerText: "Descrição", sort: true, filter: true, width: "260px" },
      {
        key: "valor",
        headerText: "Valor",
        sort: true,
        filter: true,
        type: "number",
        cellTemplate: ({ value }: { value: number }) => brlFmt.format(value),
      },
    ],
    [],
  );

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.columns = columns;
    grid.data = filteredRows;
    grid.setAttribute("theme", "dark tinted");
    grid.style.setProperty("--ag-brand", "#2dd4bf");
    grid.style.setProperty("--ag-brand-strong", "#5eead4");
    grid.style.setProperty("--ag-grid-bg", "#0f172a");
    grid.style.setProperty("--ag-surface", "#0f172a");
    grid.style.setProperty("--ag-surface-alt", "#0f172a");
    grid.style.setProperty("--ag-surface-elevated", "#1e293b");
    grid.style.setProperty("--ag-text", "#e2e8f0");
    grid.style.setProperty("--ag-text-body", "#e2e8f0");
    grid.style.setProperty("--ag-text-muted", "#94a3b8");
    grid.style.setProperty("background", "transparent");
    grid.sort?.([{ key: "valor", direction: "descending" }]);
  }, [columns, filteredRows]);

  return (
    <SectionCard
      title="Despesas Reembolsáveis"
      subtitle="Despesas reembolsáveis do caixa Share agrupadas por mês"
      icon={Layers}
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <EmptyState message="Nenhum lançamento no período." />
      ) : (
        <div className="px-4 pb-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span>Mês</span>
              <select
                value={selectedMonth ?? ""}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
                className="rounded-lg border border-border bg-background px-3 py-1 text-sm text-foreground outline-none transition-colors focus:border-primary"
              >
                {availableMonths.map((idx) => (
                  <option key={idx} value={idx}>{MESES[idx]}</option>
                ))}
              </select>
            </label>
            <div className="text-sm font-semibold text-foreground">
              Total filtrado: {brlFmt.format(total)}
            </div>
          </div>
          {/* @ts-expect-error - apex-grid é um custom element, sem tipagem JSX nativa */}
          <apex-grid ref={gridRef} style={{ minHeight: "420px", display: "block" }} />
        </div>
      )}
    </SectionCard>
  );
}
