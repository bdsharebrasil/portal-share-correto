import { useEffect, useMemo, useRef, useState } from "react";
import { html } from "lit";
import "apex-grid/define"; // registra <apex-grid> como custom element
import { Layers } from "lucide-react";
import { SectionCard, EmptyState } from "./ui/Premium";
import { getCategoriaMap } from "./MasterRelatorios";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface MovimentacaoRow {
  id: string;
  descricao?: string;
  tipo?: string;
  valor_rateado?: number | null;
  valor_original?: number | null;
  data_competencia: string; // YYYY-MM-DD
  status?: string;
  data_pagamento?: string | null;
  tipo_caixa?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  grupo_custo?: string | null;
  conta_bancaria?: string | null;
  categorias_movimentacao?: { grupo_categoria?: string | null };
}

interface GridRow {
  id: string;
  mesIdx: number;
  mes: string;
  categoria: string;
  banco: string;
  descricao: string;
  valor: number;
}

interface DetalhamentoCategoriasGridProps {
  /** Lançamentos já filtrados por período/caixa (ex.: a lista `share` do MasterRelatorios) */
  movimentacoes: MovimentacaoRow[];
  title?: string;
  subtitle?: string;
}

// ---------------------------------------------------------------------------
// Helpers (mesma lógica usada em MasterRelatorios.tsx)
// ---------------------------------------------------------------------------

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const val = (m: MovimentacaoRow) => Number(m.valor_rateado ?? m.valor_original ?? 0);
const isEntrada = (m: MovimentacaoRow) => ["entrada", "receita"].includes(String(m.tipo || "").toLowerCase());
const isPago = (m: MovimentacaoRow) => m.status === "pago" || Boolean(m.data_pagamento);

/**
 * Usa o mesmo sistema de classificação do MasterRelatorios, baseado em grupo_categoria + tipo_despesa.
 */
const naturezaDe = (m: MovimentacaoRow) => {
  const catMap = getCategoriaMap();
  const catInfo = m.categoria_id ? catMap.get(m.categoria_id) : undefined;
  const grupo = (catInfo?.grupo || String(m.grupo_custo || "")).toUpperCase().trim();
  const tipoDespesa = (catInfo?.tipoDespesa || String((m as any).tipo_despesa || "")).toLowerCase().trim();

  if (grupo === "DESPESAS PARTICULARES") return tipoDespesa === "variavel" ? "Particulares Variável" : "Particulares Fixo";
  if (grupo === "DESPESAS EMPRESA" || grupo === "DESPESAS EMPRESA - BANCO") return tipoDespesa === "variavel" ? "Despesas Empresa Variável" : "Despesas Empresa Fixo";
  if (grupo === "FOLHA DE PAGAMENTO") return "Folha de Pagamento";
  if (grupo === "DESPESAS REEMBOLSÁVEIS") return "Despesas Reembolsáveis";
  if (grupo === "IMPOSTOS") return "Impostos";
  if (grupo === "RECEITAS OPERACIONAIS") return "Receitas Operacionais";
  if (grupo === "REEMBOLSOS ENTRADAS") return "Reembolsos Entradas";
  if (grupo.includes("PARTICULAR")) return "Particulares Fixo";
  if (grupo.startsWith("FIXO")) return "Despesas Empresa Fixo";
  if (grupo.startsWith("VARIAVEL") || grupo.startsWith("VARIÁVEL")) return "Despesas Empresa Variável";
  return "Outros";
};

const NAT_TONE: Record<string, string> = {
  Pessoal: "#7c3aed",
  Fixo: "#2563eb",
  "Variável": "#d97706",
  Extra: "#0d9488",
  Outros: "#64748b",
};

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export default function DetalhamentoCategoriasGrid({
  movimentacoes,
  title = "Despesas Particulares",
  subtitle = "Despesas particulares do caixa Share agrupadas por mês",
}: DetalhamentoCategoriasGridProps) {
  const gridRef = useRef<any>(null);

  const normalize = (value?: string | null) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const isDespesaParticular = (m: MovimentacaoRow) => {
    const catMap = getCategoriaMap();
    const catInfo = m.categoria_id ? catMap.get(m.categoria_id) : undefined;
    const grupo = (catInfo?.grupo || String(m.grupo_custo || "")).toUpperCase().trim();
    if (grupo === "DESPESAS PARTICULARES") return true;
    if (grupo.includes("PARTICULAR")) return true;
    return false;
  };

  const rows: GridRow[] = useMemo(() => {
    return movimentacoes
      .filter((m) => !isEntrada(m) && isPago(m) && isDespesaParticular(m))
      .map((m) => {
        const mesIdx = Number(String(m.data_competencia).slice(5, 7)) - 1;
        return {
          id: m.id,
          mesIdx,
          mes: MESES[mesIdx] ?? "-",
          categoria: (m.categoria_nome || "Sem categoria").trim(),
          banco: (m.conta_bancaria || "-").trim(),
          descricao: (m.descricao || "-").trim(),
          valor: val(m),
        };
      })
      .sort((a, b) => a.mesIdx - b.mesIdx || a.categoria.localeCompare(b.categoria) || b.valor - a.valor);
  }, [movimentacoes]);

  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const availableMonths = useMemo(
    () => Array.from(new Set(rows.map((r) => r.mesIdx))).sort((a, b) => a - b),
    [rows]
  );

  useEffect(() => {
    if (selectedMonth === null && availableMonths.length > 0) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const filteredRows = useMemo(
    () => (selectedMonth === null ? rows : rows.filter((row) => row.mesIdx === selectedMonth)),
    [rows, selectedMonth]
  );

  const [total, setTotal] = useState(0);

  const computeTotal = (data: GridRow[]) => data.reduce((sum, row) => sum + row.valor, 0);

  useEffect(() => {
    const grid = gridRef.current;
    const visibleRows = Array.isArray(grid?.dataView) ? grid.dataView as GridRow[] : filteredRows;
    setTotal(computeTotal(visibleRows));
  }, [filteredRows]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const handleFiltered = () => {
      const visibleRows = Array.isArray(grid.dataView) ? grid.dataView as GridRow[] : filteredRows;
      setTotal(computeTotal(visibleRows));
    };

    grid.addEventListener("filtered", handleFiltered);
    return () => grid.removeEventListener("filtered", handleFiltered);
  }, [filteredRows]);

  // Colunas — mês agora é filtrado pela UI acima, não exibido como coluna.
  const columns = useMemo(
    () => [
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
    []
  );

  // Liga colunas + dados + tema ao custom element (mesmo padrão do exemplo de theming)
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    grid.columns = columns;
    grid.data = filteredRows;

    // theme="dark tinted" aplica o modo escuro do Apex Grid.
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

    // ordenação inicial: maiores valores primeiro
    grid.sort?.([{ key: "valor", direction: "descending" }]);
  }, [columns, filteredRows]);

  return (
    <SectionCard title={title} subtitle={subtitle} icon={Layers} bodyClassName="p-0">
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
            <div className="text-sm font-semibold text-foreground">Total filtrado: {brlFmt.format(total)}</div>
          </div>
          {/* @ts-expect-error - apex-grid é um custom element, sem tipagem JSX nativa */}
          <apex-grid ref={gridRef} style={{ minHeight: "420px", display: "block" }} />
        </div>
      )}
    </SectionCard>
  );
}
