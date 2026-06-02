import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Props {
  clienteId: string;
  aeronaveId: string;
  aeronaveLabel?: string;
}

type RateioRow = {
  id: string;
  despesa_id: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  numero_doc: string | null;
  fornecedor_nome: string | null;
  descricao_despesa: string | null;
  periodicidade: string | null;
  tipo_rateio: string | null;
  fluxo: string | null;
  pago_por: string | null;
  valor_total_despesa: number | null;
  valor_rateado: number | null;
  percentual_sociedade: number | null;
  socios_nome: string | null;
  socio_id: string | null;
  observacoes: string | null;
};

type Socio = { id: string; nome: string; percentual: number | null };

const fmtBRL = (n: number | null | undefined) =>
  n == null || n === 0
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const fmtPct = (n: number | null | undefined) =>
  n == null || n === 0 ? "—" : `${Number(n).toFixed(4)}%`;

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const [y, m, d] = s.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

export function RelatorioCompletoTab({ clienteId, aeronaveId, aeronaveLabel }: Props) {
  const [filtro, setFiltro] = useState("");
  const [filtroFluxo, setFiltroFluxo] = useState<"todos" | "ENTRADA" | "SAÍDA">("todos");

  // Sócios do cliente
  const { data: socios = [] } = useQuery<Socio[]>({
    queryKey: ["socios-cliente-relatorio", clienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("socios_cliente")
        .select("id, nome, percentual_participacao")
        .eq("cliente_id", clienteId)
        .order("nome");
      if (error) throw error;
      return (data || []).map((s: any) => ({
        id: s.id,
        nome: s.nome,
        percentual: s.percentual_participacao,
      }));
    },
    enabled: !!clienteId,
  });

  // Rateios da aeronave
  const { data: rateios = [], isLoading } = useQuery<RateioRow[]>({
    queryKey: ["rateio-completo", clienteId, aeronaveId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("rateio_despesas")
        .select(
          "id, despesa_id, data_vencimento, data_pagamento, numero_doc, fornecedor_nome, descricao_despesa, periodicidade, tipo_rateio, fluxo, pago_por, valor_total_despesa, valor_rateado, percentual_sociedade, socios_nome, socio_id, observacoes"
        )
        .eq("cliente_id", clienteId)
        .order("data_vencimento", { ascending: true });
      if (aeronaveId) q = q.eq("aeronave_id", aeronaveId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId && !!aeronaveId,
  });

  // Agrupar por despesa_id (cada despesa vira 1 linha; sócios viram colunas)
  const linhas = useMemo(() => {
    const map = new Map<string, any>();
    rateios.forEach((r) => {
      const key = r.despesa_id || r.id;
      if (!map.has(key)) {
        map.set(key, {
          despesa_id: key,
          data: r.data_vencimento || r.data_pagamento,
          doc: r.numero_doc,
          fornecedor: r.fornecedor_nome,
          descricao: r.descricao_despesa,
          categoria: r.observacoes?.match(/categoria:\s*([^|]+)/i)?.[1]?.trim() || "—",
          prazo: r.observacoes?.match(/prazo:\s*(.+)$/i)?.[1]?.trim() || "—",
          tipo: r.periodicidade || r.tipo_rateio,
          fluxo: r.fluxo,
          pago_por: r.pago_por,
          valor_total: r.valor_total_despesa,
          rateios: {} as Record<string, { pct: number; valor: number }>,
        });
      }
      const row = map.get(key);
      if (r.socio_id) {
        row.rateios[r.socio_id] = {
          pct: Number(r.percentual_sociedade) || 0,
          valor: Number(r.valor_rateado) || 0,
        };
      }
    });
    let arr = Array.from(map.values());
    if (filtro) {
      const q = filtro.toLowerCase();
      arr = arr.filter(
        (l) =>
          l.fornecedor?.toLowerCase().includes(q) ||
          l.descricao?.toLowerCase().includes(q) ||
          l.categoria?.toLowerCase().includes(q) ||
          l.doc?.toLowerCase().includes(q)
      );
    }
    if (filtroFluxo !== "todos") {
      arr = arr.filter((l) => l.fluxo === filtroFluxo);
    }
    return arr.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  }, [rateios, filtro, filtroFluxo]);

  // Totais por sócio
  const totais = useMemo(() => {
    const porSocio: Record<string, number> = {};
    let totalGeral = 0;
    let totalEntradas = 0;
    let totalSaidas = 0;
    linhas.forEach((l) => {
      const v = Number(l.valor_total) || 0;
      totalGeral += v;
      if (l.fluxo === "ENTRADA") totalEntradas += v;
      else totalSaidas += v;
      Object.entries(l.rateios).forEach(([sid, r]: any) => {
        porSocio[sid] = (porSocio[sid] || 0) + (r.valor || 0);
      });
    });
    return { porSocio, totalGeral, totalEntradas, totalSaidas };
  }, [linhas]);

  const exportCSV = () => {
    const headers = [
      "DATA",
      "DOC",
      "FORNECEDOR",
      "DESCRIÇÃO",
      "CATEGORIA",
      "TIPO",
      "PRAZO",
      "FLUXO",
      "PAGO POR",
      "VALOR PAGO",
      ...socios.flatMap((s) => [`% ${s.nome}`, `RATEIO ${s.nome}`]),
    ];
    const rows = linhas.map((l) => [
      fmtDate(l.data),
      l.doc || "",
      l.fornecedor || "",
      l.descricao || "",
      l.categoria,
      l.tipo || "",
      l.prazo,
      l.fluxo || "",
      l.pago_por || "",
      (l.valor_total || 0).toFixed(2).replace(".", ","),
      ...socios.flatMap((s) => {
        const r = l.rateios[s.id];
        return [r ? r.pct.toFixed(4).replace(".", ",") + "%" : "", r ? r.valor.toFixed(2).replace(".", ",") : ""];
      }),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_completo_${aeronaveLabel || "aeronave"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Relatório Completo de Lançamentos
          </h2>
          <p className="text-xs text-muted-foreground">
            Formato planilha — {aeronaveLabel || "aeronave"} · {linhas.length} despesas · {socios.length} sócios
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Filtrar..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="h-9 w-56"
          />
          <select
            value={filtroFluxo}
            onChange={(e) => setFiltroFluxo(e.target.value as any)}
            className="h-9 px-3 rounded-md border border-border bg-background text-sm"
          >
            <option value="todos">Todos os fluxos</option>
            <option value="SAÍDA">Apenas saídas</option>
            <option value="ENTRADA">Apenas entradas (aportes)</option>
          </select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground">Total geral</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{fmtBRL(totais.totalGeral)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase tracking-wider text-emerald-500">Entradas (aportes)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-emerald-500">{fmtBRL(totais.totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase tracking-wider text-rose-500">Saídas (despesas)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-rose-500">{fmtBRL(totais.totalSaidas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-bold ${totais.totalEntradas - totais.totalSaidas >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {fmtBRL(totais.totalEntradas - totais.totalSaidas)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela formato planilha */}
      <div className="border border-border rounded-xl bg-card/60 overflow-auto max-h-[70vh]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10 border-b-2 border-border">
            <tr>
              <th colSpan={7} className="px-2 py-1 text-center font-semibold border-r border-border bg-muted/40">
                QUALIFICAÇÃO DE CUSTO
              </th>
              <th colSpan={2} className="px-2 py-1 text-center font-semibold border-r border-border bg-muted/40">
                PAGAMENTO
              </th>
              <th colSpan={socios.length} className="px-2 py-1 text-center font-semibold border-r border-border bg-blue-500/10">
                %
              </th>
              <th colSpan={socios.length} className="px-2 py-1 text-center font-semibold bg-emerald-500/10">
                RATEIO
              </th>
            </tr>
            <tr className="text-[10px] uppercase tracking-tight">
              <th className="px-2 py-2 text-left">Data</th>
              <th className="px-2 py-2 text-left">Doc</th>
              <th className="px-2 py-2 text-left">Fornecedor</th>
              <th className="px-2 py-2 text-left">Descrição</th>
              <th className="px-2 py-2 text-left">Categoria</th>
              <th className="px-2 py-2 text-left">Tipo</th>
              <th className="px-2 py-2 text-left border-r border-border">Prazo</th>
              <th className="px-2 py-2 text-left">Fluxo</th>
              <th className="px-2 py-2 text-left border-r border-border">Pago por</th>
              <th className="px-2 py-2 text-right border-r border-border">Valor pago</th>
              {socios.map((s) => (
                <th key={`p-${s.id}`} className="px-2 py-2 text-right bg-blue-500/5">
                  {s.nome}
                </th>
              ))}
              {socios.map((s, i) => (
                <th
                  key={`r-${s.id}`}
                  className={`px-2 py-2 text-right bg-emerald-500/5 ${i === 0 ? "border-l border-border" : ""}`}
                >
                  {s.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr>
                <td colSpan={10 + 2 * socios.length} className="text-center py-12 text-muted-foreground">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            ) : (
              linhas.map((l, idx) => (
                <tr
                  key={l.despesa_id}
                  className={`border-b border-border/40 hover:bg-muted/30 ${
                    l.fluxo === "ENTRADA" ? "bg-emerald-500/5" : ""
                  } ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                >
                  <td className="px-2 py-1.5 whitespace-nowrap font-mono">{fmtDate(l.data)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{l.doc || "—"}</td>
                  <td className="px-2 py-1.5 font-medium">{l.fornecedor || "—"}</td>
                  <td className="px-2 py-1.5">{l.descricao || "—"}</td>
                  <td className="px-2 py-1.5">
                    <Badge variant="outline" className="text-[9px] font-normal">
                      {l.categoria}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{l.tipo}</td>
                  <td className="px-2 py-1.5 text-muted-foreground border-r border-border">{l.prazo}</td>
                  <td className="px-2 py-1.5">
                    <Badge
                      variant="outline"
                      className={`text-[9px] ${
                        l.fluxo === "ENTRADA"
                          ? "border-emerald-500/40 text-emerald-500"
                          : "border-rose-500/40 text-rose-500"
                      }`}
                    >
                      {l.fluxo}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 border-r border-border">{l.pago_por || "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold border-r border-border">
                    {fmtBRL(l.valor_total)}
                  </td>
                  {socios.map((s) => {
                    const r = l.rateios[s.id];
                    return (
                      <td key={`p-${l.despesa_id}-${s.id}`} className="px-2 py-1.5 text-right font-mono text-blue-400">
                        {fmtPct(r?.pct)}
                      </td>
                    );
                  })}
                  {socios.map((s, i) => {
                    const r = l.rateios[s.id];
                    return (
                      <td
                        key={`r-${l.despesa_id}-${s.id}`}
                        className={`px-2 py-1.5 text-right font-mono text-emerald-400 ${
                          i === 0 ? "border-l border-border" : ""
                        }`}
                      >
                        {fmtBRL(r?.valor)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {linhas.length > 0 && (
            <tfoot className="sticky bottom-0 bg-card border-t-2 border-border">
              <tr className="font-semibold">
                <td colSpan={9} className="px-2 py-2 text-right text-muted-foreground uppercase text-[10px] tracking-wider">
                  Totais
                </td>
                <td className="px-2 py-2 text-right font-mono border-r border-border">{fmtBRL(totais.totalGeral)}</td>
                {socios.map((s) => (
                  <td key={`tp-${s.id}`} className="px-2 py-2 text-right font-mono text-blue-400">
                    {s.percentual ? `${Number(s.percentual).toFixed(2)}%` : "—"}
                  </td>
                ))}
                {socios.map((s, i) => (
                  <td
                    key={`tr-${s.id}`}
                    className={`px-2 py-2 text-right font-mono text-emerald-400 ${i === 0 ? "border-l border-border" : ""}`}
                  >
                    {fmtBRL(totais.porSocio[s.id])}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default RelatorioCompletoTab;
