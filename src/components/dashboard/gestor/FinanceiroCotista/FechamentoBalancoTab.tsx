import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  Clock,
  Scale,
  Plane,
  ArrowRight,
  Download,
  TrendingUp,
  TrendingDown,
  Wallet,
  Gauge,
  Layers,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  ReceiptText,
  HandCoins,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";
import { DiarioBordoCotistaTab } from "./DiarioBordoCotistaTab";
import { findCotistaIdForRecord, resolveCategoriaLabel } from "./fechamentoBalancoUtils";

/* ════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════ */
const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const formatHHMM = (horasDecimais: number) => {
  const total = Math.max(0, horasDecimais || 0);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type PeriodoTipo = "mensal" | "acumulado-ano" | "customizado";

interface Cotista {
  id: string;
  nome: string;
  percentual: number;
}

interface Props {
  aeronaveId: string;
  aeronaveLabel?: string;
  cotistas: Cotista[];
  clienteEmFoco?: string;
  clienteId?: string;
  abastecimentos?: any[];
  relatorios?: any[];
}

const norm = (s?: string | null) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function isFixo(periodicidade?: string | null) {
  return norm(periodicidade).startsWith("mensal");
}

const firstName = (nome?: string | null) => (nome || "—").split(" ")[0];

/* ════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ════════════════════════════════════════════════════════════════════ */
export function FechamentoBalancoTab({
  aeronaveId,
  aeronaveLabel,
  cotistas,
  clienteId,
  relatorios = [],
}: Props) {
  const hoje = new Date();
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensal");
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [dataInicio, setDataInicio] = useState<string>(`${ano}-${String(mes).padStart(2, "0")}-01`);
  const [dataFim, setDataFim] = useState<string>(new Date(ano, mes, 0).toISOString().slice(0, 10));

  const { inicio, fim } = useMemo(() => {
    let start: string;
    let end: string;
    if (periodoTipo === "mensal") {
      start = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
      end = new Date(ano, mes, 0).toISOString().slice(0, 10);
    } else if (periodoTipo === "acumulado-ano") {
      start = `${ano}-01-01`;
      end = `${ano}-12-31`;
    } else {
      start = dataInicio;
      end = dataFim;
    }
    return { inicio: start, fim: end };
  }, [periodoTipo, mes, ano, dataInicio, dataFim]);

  const { data, isLoading } = useQuery({
    enabled: !!aeronaveId,
    queryKey: ["fechamento-balanco", aeronaveId, periodoTipo, mes, ano, dataInicio, dataFim],
    queryFn: async () => {
      const [{ data: rateios }, { data: voos }, { data: expenseConfig }, { data: categoriasMovimentacao }] = await Promise.all([
        (supabase as any)
          .from("rateio_despesas")
          .select(
            "id, despesa_id, descricao_despesa, fornecedor_nome, categoria_custo, periodicidade, tipo_rateio, valor_total_despesa, valor_rateado, percentual_sociedade, percentual_uso, pago_por, pago_diretamente, fluxo, data_pagamento, data_vencimento, cliente_id, clientes_nome, socio_id, socios_nome, valor_pago_real, numero_nf, numero_doc, numero_recibo, numero_boleto, status"
          )
          .eq("aeronave_id", aeronaveId)
          .or(
            `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`
          ),
        supabase
          .from("lancamentos_diario_bordo")
          .select("id, clientes_id, socios_id, tempo_total, data_registro")
          .eq("aeronave_id", aeronaveId)
          .gte("data_registro", inicio)
          .lte("data_registro", fim),
        (supabase as any).from("expense_configu").select("id, expense_type").order("expense_type"),
        (supabase as any).from("categorias_movimentacao").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      const categoriasPorId = new Map<string, string>();
      (expenseConfig || []).forEach((item: any) => {
        if (item?.id) categoriasPorId.set(item.id, item.expense_type || item.id);
      });
      (categoriasMovimentacao || []).forEach((item: any) => {
        if (item?.id) categoriasPorId.set(item.id, item.nome || item.id);
      });

      return {
        rateios: (rateios || []) as any[],
        voos: (voos || []) as any[],
        categoriasPorId,
      };
    },
  });

  const rateios = data?.rateios || [];
  const voos = data?.voos || [];
  const categoriasPorId = data?.categoriasPorId || new Map<string, string>();

  const despesasAgrupadas = useMemo(() => {
    const m = new Map<string, { despesa: any; rateios: any[] }>();
    rateios.forEach((r) => {
      const key = r.despesa_id || `${r.data_vencimento}|${r.descricao_despesa}|${r.valor_total_despesa}`;
      if (!m.has(key)) m.set(key, { despesa: r, rateios: [] });
      m.get(key)!.rateios.push(r);
    });
    return Array.from(m.values()).sort((a, b) => {
      const da = a.despesa.data_pagamento || a.despesa.data_vencimento || "";
      const db = b.despesa.data_pagamento || b.despesa.data_vencimento || "";
      return da.localeCompare(db);
    });
  }, [rateios]);

  const despesasUnicas = useMemo(() => despesasAgrupadas.map((g) => g.despesa), [despesasAgrupadas]);

  // Crédito = o que cada cotista efetivamente PAGOU (entrou com o dinheiro)
  const creditoPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    rateios.forEach((r) => {
      if ((r.fluxo || "").toUpperCase() === "ENTRADA") return;
      const cid = findCotistaIdForRecord(cotistas, r);
      if (!cid || !map.has(cid)) return;
      const valPago = Number(r.valor_pago_real || 0);
      if (valPago > 0) map.set(cid, (map.get(cid) || 0) + valPago);
    });
    return map;
  }, [rateios, cotistas]);

  // Débito = a parte que CABE a cada cotista nas despesas do período
  const custoDevidoPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    rateios.forEach((r) => {
      if ((r.fluxo || "").toUpperCase() === "ENTRADA") return;
      const isDGA = norm(r.descricao_despesa).includes("dga") || norm(r.fornecedor_nome).includes("dga");
      if (isDGA) {
        const valorPorSocio = Number(r.valor_total_despesa || 0) / (cotistas.length || 1);
        cotistas.forEach((c) => {
          map.set(c.id, (map.get(c.id) || 0) + valorPorSocio / cotistas.length);
        });
        return;
      }

      const cid = findCotistaIdForRecord(cotistas, r);
      if (!cid || !map.has(cid)) return;

      const valorRateado = Number(r.valor_rateado || 0);
      const valorTotal = Number(r.valor_total_despesa || 0);
      const percentualUso = Number(r.percentual_uso ?? r.percentual_sociedade ?? 0);
      const valorBase = valorRateado > 0 ? valorRateado : percentualUso > 0 ? valorTotal * (percentualUso / 100) : 0;

      if (valorBase > 0) {
        map.set(cid, (map.get(cid) || 0) + valorBase);
      }
    });
    return map;
  }, [rateios, cotistas]);

  const horasPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    voos.forEach((v) => {
      const cid = findCotistaIdForRecord(cotistas, v);
      if (!cid || !map.has(cid)) return;
      map.set(cid, (map.get(cid) || 0) + (Number(v.tempo_total) || 0));
    });
    return map;
  }, [voos, cotistas]);

  const horasTotais = useMemo(
    () => Array.from(horasPorCotista.values()).reduce((a, b) => a + b, 0),
    [horasPorCotista]
  );

  const { custoFixo, custoVariavel, custoTotal } = useMemo(() => {
    let f = 0, v = 0, total = 0;
    despesasUnicas.forEach((d) => {
      if ((d.fluxo || "").toUpperCase() === "ENTRADA") return;
      const val = Number(d.valor_total_despesa) || 0;
      total += val;
      if (isFixo(d.periodicidade)) f += val; else v += val;
    });
    return { custoFixo: f, custoVariavel: v, custoTotal: total };
  }, [despesasUnicas]);

  const custoMedioHora = horasTotais > 0 ? custoVariavel / horasTotais : 0;

  const linhas = useMemo(() => {
    return cotistas.map((c) => {
      const horas = horasPorCotista.get(c.id) || 0;
      const custoDevido = custoDevidoPorCotista.get(c.id) || 0;
      const credito = creditoPorCotista.get(c.id) || 0;
      const saldo = credito - custoDevido;
      const pctPago = custoDevido > 0 ? Math.min(200, (credito / custoDevido) * 100) : credito > 0 ? 100 : 0;
      return { ...c, horas, custoDevido, credito, saldo, pctPago };
    });
  }, [cotistas, horasPorCotista, custoDevidoPorCotista, creditoPorCotista]);

  const totalARegularizar = useMemo(
    () => linhas.filter((l) => l.saldo > 0.005).reduce((a, l) => a + l.saldo, 0),
    [linhas]
  );
  const credoresCount = linhas.filter((l) => l.saldo > 0.005).length;
  const devedoresCount = linhas.filter((l) => l.saldo < -0.005).length;

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  const periodoLabel =
    periodoTipo === "mensal"
      ? `${MESES[mes - 1]}/${ano}`
      : periodoTipo === "acumulado-ano"
      ? `Acumulado ${ano}`
      : `${formatDate(inicio)} a ${formatDate(fim)}`;

  const exportarPDF = () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      doc.setFontSize(18);
      doc.text(`Balanço Financeiro — ${aeronaveLabel || "Aeronave"}`, 14, 20);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Período de referência: ${periodoLabel}`, 14, 27);
      doc.setTextColor(0);

      autoTable(doc, {
        startY: 34,
        head: [["Cotista", "% Cota", "Horas Voadas", "Débito (custo devido)", "Crédito (pago)", "Saldo"]],
        body: linhas.map((l) => [
          l.nome, `${l.percentual}%`, formatHHMM(l.horas),
          formatBRL(l.custoDevido), formatBRL(l.credito),
          `${l.saldo >= 0 ? "+" : ""}${formatBRL(l.saldo)}`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [30, 41, 59] },
        foot: [[
          "TOTAL", "100%", formatHHMM(horasTotais),
          formatBRL(custoTotal),
          formatBRL(Array.from(creditoPorCotista.values()).reduce((a, b) => a + b, 0)),
          formatBRL(linhas.reduce((a, l) => a + l.saldo, 0)),
        ]],
      });

      if (despesasUnicas.length > 0) {
        doc.addPage();
        doc.setFontSize(15);
        doc.text("Extrato Detalhado de Despesas", 14, 20);
        autoTable(doc, {
          startY: 27,
          head: [["Data", "Fornecedor", "Descrição", "Categoria", "Fluxo", "Valor Total"]],
          body: despesasUnicas.map((d) => [
            formatDate(d.data_pagamento || d.data_vencimento),
            d.fornecedor_nome || "—", d.descricao_despesa || "—", d.categoria_custo || "—",
            (d.fluxo || "SAIDA").toUpperCase() === "ENTRADA" ? "Entrada" : "Saída",
            formatBRL(Number(d.valor_total_despesa) || 0),
          ]),
          theme: "grid",
          headStyles: { fillColor: [71, 85, 105] },
        });
      }

      if (voos.length > 0) {
        doc.addPage();
        doc.setFontSize(15);
        doc.text("Diário de Bordo Detalhado", 14, 20);
        autoTable(doc, {
          startY: 27,
          head: [["Data", "Cotista", "Tempo de Voo"]],
          body: voos
            .sort((a, b) => new Date(a.data_registro).getTime() - new Date(b.data_registro).getTime())
            .map((v) => {
              const cotista = cotistas.find((c) => findCotistaIdForRecord([c], v) === c.id);
              return [formatDate(v.data_registro), cotista?.nome || "—", formatHHMM(Number(v.tempo_total) || 0)];
            }),
          theme: "grid",
          headStyles: { fillColor: [51, 65, 85] },
        });
      }

      const credores = linhas.filter((l) => l.saldo > 0.005);
      const devedores = linhas.filter((l) => l.saldo < -0.005);
      if (credores.length > 0 && devedores.length > 0) {
        doc.addPage();
        doc.setFontSize(15);
        doc.text("Equilíbrio de Contas — Transferências Sugeridas", 14, 20);
        const matrixData: any[][] = [];
        const totalCredito = credores.reduce((a, c) => a + c.saldo, 0);
        credores.forEach((credor) => {
          const share = credor.saldo / totalCredito;
          devedores.forEach((dev) => {
            const valor = Math.abs(dev.saldo) * share;
            if (valor > 0.01) matrixData.push([dev.nome, "→ paga →", credor.nome, formatBRL(valor)]);
          });
        });
        autoTable(doc, {
          startY: 27,
          head: [["Quem paga", "", "Quem recebe", "Valor"]],
          body: matrixData,
          theme: "grid",
          headStyles: { fillColor: [4, 120, 87] },
        });
      }

      doc.save(`Balanco_${aeronaveLabel || "Aeronave"}_${periodoLabel.replace(/\//g, "-")}.pdf`);
      toast.success("Balanço exportado em PDF");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar o PDF do balanço");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Cabeçalho ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
              Balanço Financeiro · Espelho para o Cotista
            </p>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {aeronaveLabel || "Aeronave"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Referente a {periodoLabel}</p>
          </div>
        </div>
        <Button onClick={exportarPDF} variant="outline" className="gap-2 h-9">
          <Download className="h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      {/* ── Filtro de período ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground pl-1">
          <Calculator className="h-3.5 w-3.5 text-primary" /> Período
        </div>
        <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as PeriodoTipo)}>
          <SelectTrigger className="w-48 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="acumulado-ano">Acumulado (Ano-a-Data)</SelectItem>
            <SelectItem value="customizado">Período Customizado</SelectItem>
          </SelectContent>
        </Select>

        {periodoTipo === "mensal" && (
          <>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-32 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
              <SelectTrigger className="w-24 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </>
        )}
        {periodoTipo === "acumulado-ano" && (
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-28 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {periodoTipo === "customizado" && (
          <>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-input bg-background text-xs h-8" />
            <span className="text-[11px] text-muted-foreground">até</span>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-input bg-background text-xs h-8" />
          </>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border py-16 text-center text-sm text-muted-foreground">
          Carregando balanço...
        </div>
      ) : (
        <>
          {/* ── Resumo executivo ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard icon={Layers} label="Custo Fixo" value={formatBRL(custoFixo)} />
            <MetricCard icon={Gauge} label="Custo Variável" value={formatBRL(custoVariavel)} />
            <MetricCard icon={Wallet} label="Custo Total do Período" value={formatBRL(custoTotal)} highlight />
            <MetricCard icon={Clock} label="Horas Voadas" value={formatHHMM(horasTotais)} sub={horasTotais > 0 ? `${formatBRL(custoMedioHora)}/h médio` : undefined} />
          </div>

          {/* ── Faixa "o que fazer" ──────────────────────────────── */}
          <div className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4",
            totalARegularizar > 0.005 ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-emerald-500/30 bg-emerald-500/[0.06]"
          )}>
            <div className="flex items-center gap-3">
              {totalARegularizar > 0.005 ? (
                <HandCoins className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {totalARegularizar > 0.005
                    ? `${formatBRL(totalARegularizar)} a regularizar entre os cotistas`
                    : "Balanço equilibrado — ninguém deve nada a ninguém"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalARegularizar > 0.005
                    ? `${devedoresCount} cotista(s) devem transferir para ${credoresCount} cotista(s) credor(es). Veja o detalhe em "Equilíbrio de Contas".`
                    : "Todos os cotistas pagaram exatamente a parte que lhes cabia neste período."}
                </p>
              </div>
            </div>
          </div>

          {/* ── Legenda simples ──────────────────────────────────── */}
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-lg bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground">
            <span><b className="text-foreground">Débito</b> — parte das despesas que cabe ao cotista</span>
            <span><b className="text-foreground">Crédito</b> — valor que o cotista efetivamente pagou</span>
            <span><b className="text-foreground">Saldo</b> — diferença entre os dois (crédito − débito)</span>
          </div>

          {/* ── Cartões de balanço por cotista ───────────────────── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Balanço por Cotista</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {linhas.map((l) => (
                <CotistaBalanceCard key={l.id} linha={l} />
              ))}
              {linhas.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center col-span-full">
                  Nenhum cotista cadastrado para esta aeronave.
                </p>
              )}
            </div>
          </div>

          {/* ── Abas de detalhamento ──────────────────────────────── */}
          <Tabs defaultValue="extrato" className="w-full">
            <TabsList className="bg-card/60 border border-border p-1 rounded-xl flex-wrap h-auto">
              <TabsTrigger value="extrato" className="rounded-lg gap-2">
                <ReceiptText className="h-4 w-4" /> Extrato Completo
              </TabsTrigger>
              <TabsTrigger value="equilibrio" className="rounded-lg gap-2">
                <Scale className="h-4 w-4" /> Equilíbrio de Contas
              </TabsTrigger>
              <TabsTrigger value="diario" className="rounded-lg gap-2">
                <Plane className="h-4 w-4" /> Diário de Bordo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="extrato" className="mt-4">
              <ExtratoCompleto
                despesasAgrupadas={despesasAgrupadas}
                cotistas={cotistas}
                periodoLabel={periodoLabel}
                aeronaveLabel={aeronaveLabel}
                categoriasPorId={categoriasPorId}
              />
            </TabsContent>

            <TabsContent value="equilibrio" className="mt-4">
              <EquilibrioContas linhas={linhas} periodoLabel={periodoLabel} />
            </TabsContent>

            <TabsContent value="diario" className="mt-4">
              {clienteId ? (
                <DiarioBordoCotistaTab clienteId={clienteId} aeronaveId={aeronaveId} relatorios={relatorios} />
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Cliente não identificado.</p>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   METRIC CARD — resumo executivo
   ════════════════════════════════════════════════════════════════════ */
function MetricCard({
  icon: Icon, label, value, sub, highlight,
}: { icon: any; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      highlight ? "border-primary/30 bg-primary/[0.05]" : "border-border bg-background"
    )}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-3.5 w-3.5", highlight ? "text-primary" : "text-muted-foreground")} />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-lg font-bold font-mono tabular-nums", highlight ? "text-primary" : "text-foreground")}>{value}</p>
      {sub && <p className="text-[10.5px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CARTÃO DE BALANÇO POR COTISTA — elemento de assinatura:
   barra de progresso de pagamento (crédito pago ÷ débito devido)
   ════════════════════════════════════════════════════════════════════ */
function CotistaBalanceCard({ linha }: { linha: any }) {
  const positivo = linha.saldo >= -0.005;
  const quitado = Math.abs(linha.saldo) <= 0.005;
  const pctBarra = Math.max(0, Math.min(100, linha.pctPago));
  const excedente = linha.pctPago > 100;

  return (
    <div className={cn(
      "rounded-xl border bg-background p-4 transition-colors",
      quitado ? "border-border" : positivo ? "border-emerald-500/30" : "border-rose-500/30"
    )}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">{linha.nome || linha.id}</p>
          <p className="text-[10.5px] text-muted-foreground">
            Cota de {linha.percentual}% · {formatHHMM(linha.horas)} voadas
          </p>
        </div>
        {quitado ? (
          <Badge className="bg-muted text-muted-foreground border-border gap-1 shrink-0 rounded-full text-[10px] px-2 py-0.5">
            <CheckCircle2 className="h-3 w-3" /> Quitado
          </Badge>
        ) : positivo ? (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 shrink-0 rounded-full text-[10px] px-2 py-0.5">
            <ArrowUpRight className="h-3 w-3" /> A receber
          </Badge>
        ) : (
          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 shrink-0 rounded-full text-[10px] px-2 py-0.5">
            <ArrowDownRight className="h-3 w-3" /> A pagar
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Débito</p>
          <p className="text-sm font-mono font-semibold text-foreground tabular-nums">{formatBRL(linha.custoDevido)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Crédito</p>
          <p className="text-sm font-mono font-semibold text-foreground tabular-nums">{formatBRL(linha.credito)}</p>
        </div>
      </div>

      {/* Barra de progresso de pagamento — proporcional ao que foi pago vs. devido */}
      <div className="mb-3">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", excedente || quitado ? "bg-emerald-500" : positivo ? "bg-emerald-500" : "bg-rose-400")}
            style={{ width: `${quitado ? 100 : pctBarra}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {quitado
            ? "100% da parte devida foi paga"
            : `${Math.min(999, Math.round(linha.pctPago))}% do valor devido já foi pago`}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-border/70 pt-2.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Saldo</span>
        <span className={cn(
          "text-base font-bold font-mono tabular-nums",
          quitado ? "text-foreground" : positivo ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
        )}>
          {quitado ? formatBRL(0) : `${positivo ? "+" : ""}${formatBRL(linha.saldo)}`}
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EXTRATO COMPLETO — espelho fiel do Centro de Lançamentos, somente leitura
   ════════════════════════════════════════════════════════════════════ */
function ExtratoCompleto({
  despesasAgrupadas, cotistas, periodoLabel, aeronaveLabel, categoriasPorId,
}: {
  despesasAgrupadas: { despesa: any; rateios: any[] }[];
  cotistas: Cotista[];
  periodoLabel: string;
  aeronaveLabel?: string;
  categoriasPorId: Map<string, string>;
}) {
  const [filtroCotista, setFiltroCotista] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todos");

  const categoriasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    despesasAgrupadas.forEach(({ despesa }) => {
      const nome = resolveCategoriaLabel(despesa.categoria_custo, categoriasPorId);
      if (nome && nome !== "—") s.add(nome);
    });
    return Array.from(s).sort();
  }, [despesasAgrupadas, categoriasPorId]);

  const filtrados = useMemo(() => {
    return despesasAgrupadas.filter(({ despesa, rateios }) => {
      if (filtroCotista !== "todos") {
        const algum = rateios.some((r) => r.cliente_id === filtroCotista || r.socio_id === filtroCotista);
        if (!algum) return false;
      }
      if (busca) {
        const q = norm(busca);
        const txt = norm([despesa.descricao_despesa, despesa.fornecedor_nome, despesa.categoria_custo, despesa.numero_nf, despesa.numero_doc].join(" "));
        if (!txt.includes(q)) return false;
      }
      const categoriaLabel = resolveCategoriaLabel(despesa.categoria_custo, categoriasPorId);
      if (filtroCategoria !== "todos" && categoriaLabel !== filtroCategoria) return false;
      return true;
    });
  }, [despesasAgrupadas, filtroCotista, busca, filtroCategoria, categoriasPorId]);

  const grupos: { fluxo: "ENTRADA" | "SAIDA"; itens: typeof filtrados }[] = useMemo(() => {
    const entradas = filtrados.filter((g) => (g.despesa.fluxo || "").toUpperCase() === "ENTRADA");
    const saidas = filtrados.filter((g) => (g.despesa.fluxo || "").toUpperCase() !== "ENTRADA");
    return [
      { fluxo: "SAIDA" as const, itens: saidas },
      { fluxo: "ENTRADA" as const, itens: entradas },
    ].filter((g) => g.itens.length > 0);
  }, [filtrados]);

  const totalGeral = filtrados.reduce((a, { despesa }) => a + (Number(despesa.valor_total_despesa) || 0), 0);
  const totalSaidas = grupos.find((g) => g.fluxo === "SAIDA")?.itens.reduce((a, { despesa }) => a + (Number(despesa.valor_total_despesa) || 0), 0) || 0;
  const totalEntradas = grupos.find((g) => g.fluxo === "ENTRADA")?.itens.reduce((a, { despesa }) => a + (Number(despesa.valor_total_despesa) || 0), 0) || 0;

  const nColsFixas = 8; // Data, Doc, Fornecedor, Descrição, Categoria, Tipo, Periodicidade, Pago Por
  const totalCols = nColsFixas + cotistas.length * 2;

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="text-base">Extrato Completo — {periodoLabel}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Espelho fiel dos lançamentos · {filtrados.length} registro(s) · {aeronaveLabel || "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="Buscar fornecedor, descrição, NF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-background text-xs h-9 w-56"
          />
          <Select value={filtroCotista} onValueChange={setFiltroCotista}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cotistas</SelectItem>
              {cotistas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              {categoriasDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento no período.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left p-2.5 border-b border-border font-semibold">Data</th>
                  <th className="text-left p-2.5 border-b border-border font-semibold">Doc</th>
                  <th className="text-left p-2.5 border-b border-border font-semibold">Fornecedor</th>
                  <th className="text-left p-2.5 border-b border-border font-semibold">Descrição</th>
                  <th className="text-left p-2.5 border-b border-border font-semibold">Categoria</th>
                  <th className="text-left p-2.5 border-b border-border font-semibold">Tipo de Rateio</th>
                  <th className="text-left p-2.5 border-b border-border font-semibold">Periodicidade</th>
                  <th className="text-left p-2.5 border-b border-border font-semibold">Pago Por</th>
                  {cotistas.map((c) => (
                    <th key={c.id} colSpan={2} className="text-center p-2.5 border-b border-l border-border font-semibold">
                      {firstName(c.nome || c.id)}
                    </th>
                  ))}
                </tr>
                <tr className="bg-muted/30 text-[9.5px] uppercase text-muted-foreground/80">
                  <th colSpan={nColsFixas} className="p-1 border-b border-border" />
                  {cotistas.map((c) => (
                    <Fragment key={c.id}>
                      <th className="p-1 text-center border-b border-l border-border font-medium">% Uso</th>
                      <th className="p-1 text-right border-b border-border font-medium pr-2">Débito</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grupos.map((grupo) => (
                  <Fragment key={grupo.fluxo}>
                    <tr className={cn(grupo.fluxo === "ENTRADA" ? "bg-emerald-500/[0.06]" : "bg-rose-500/[0.06]")}>
                      <td colSpan={totalCols} className="px-2.5 py-1.5 border-b border-border">
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-[0.15em]",
                          grupo.fluxo === "ENTRADA" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                          {grupo.fluxo === "ENTRADA" ? "Entradas" : "Saídas"} · {grupo.itens.length} lançamento(s)
                        </span>
                      </td>
                    </tr>
                    {grupo.itens.map((g, idx) => (
                      <tr key={g.despesa.id || idx} className="hover:bg-muted/20 transition-colors even:bg-muted/[0.08]">
                        <td className="p-2 border-b border-border/70 whitespace-nowrap">{formatDate(g.despesa.data_pagamento || g.despesa.data_vencimento)}</td>
                        <td className="p-2 border-b border-border/70 font-mono">{g.despesa.numero_doc || g.despesa.numero_nf || "—"}</td>
                        <td className="p-2 border-b border-border/70">{g.despesa.fornecedor_nome || "—"}</td>
                        <td className="p-2 border-b border-border/70">{g.despesa.descricao_despesa || "—"}</td>
                        <td className="p-2 border-b border-border/70">{resolveCategoriaLabel(g.despesa.categoria_custo, categoriasPorId)}</td>
                        <td className="p-2 border-b border-border/70">{(g.despesa.tipo_rateio || "—").replace(/_/g, " ")}</td>
                        <td className="p-2 border-b border-border/70">{(g.despesa.periodicidade || "—").toString().toUpperCase()}</td>
                        <td className="p-2 border-b border-border/70 font-medium">{g.despesa.pago_por || "—"}</td>
                        {cotistas.map((c) => {
                          const r = g.rateios.find((item) => item.cliente_id === c.id || item.socio_id === c.id);
                          const pct = r ? Number(r.percentual_uso ?? r.percentual_sociedade ?? 0) : 0;
                          const rateio = r ? Number(r.valor_rateado || 0) : 0;
                          return (
                            <Fragment key={c.id}>
                              <td className="p-2 border-b border-l border-border/70 text-center font-mono text-muted-foreground">
                                {pct > 0 ? `${pct.toFixed(1)}%` : "—"}
                              </td>
                              <td className="p-2 border-b border-border/70 text-right font-mono font-semibold pr-2">
                                {rateio > 0 ? formatBRL(rateio) : "—"}
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-muted/30">
                      <td colSpan={totalCols - 1} className="px-2.5 py-1.5 text-right text-[11px] font-semibold text-muted-foreground border-b border-border">
                        Subtotal de {grupo.fluxo === "ENTRADA" ? "entradas" : "saídas"}
                      </td>
                      <td className={cn(
                        "px-2.5 py-1.5 text-right text-[11px] font-bold font-mono border-b border-border",
                        grupo.fluxo === "ENTRADA" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {formatBRL(grupo.fluxo === "ENTRADA" ? totalEntradas : totalSaidas)}
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-foreground/[0.04] font-bold">
                  <td colSpan={totalCols - 1} className="p-2.5 text-right text-xs">TOTAL GERAL DO PERÍODO</td>
                  <td className="p-2.5 text-right text-xs font-mono text-primary">{formatBRL(totalGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EQUILÍBRIO DE CONTAS — quem paga quem, para fechar o período
   ════════════════════════════════════════════════════════════════════ */
function EquilibrioContas({ linhas, periodoLabel }: { linhas: any[]; periodoLabel: string }) {
  const arr = linhas;

  const transferencias = useMemo(() => {
    const credores = arr.filter((l) => l.saldo > 0.005);
    const devedores = arr.filter((l) => l.saldo < -0.005);
    const totalCredito = credores.reduce((a, c) => a + c.saldo, 0);
    const lista: { de: string; para: string; valor: number }[] = [];
    if (totalCredito > 0) {
      credores.forEach((credor) => {
        const share = credor.saldo / totalCredito;
        devedores.forEach((dev) => {
          const valor = Math.abs(dev.saldo) * share;
          if (valor > 0.01) lista.push({ de: dev.nome, para: credor.nome, valor });
        });
      });
    }
    return lista.sort((a, b) => b.valor - a.valor);
  }, [arr]);

  const equilibrado = transferencias.length === 0;

  return (
    <div className="space-y-4">
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" /> Equilíbrio de Contas — {periodoLabel}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Transferências necessárias entre cotistas para que todos fiquem com saldo zerado neste período.
          </p>
        </CardHeader>
        <CardContent>
          {arr.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem cotistas cadastrados.</p>
          ) : equilibrado ? (
            <div className="p-6 text-center bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
              <p className="text-emerald-700 dark:text-emerald-400 font-semibold">Balanço equilibrado neste período.</p>
              <p className="text-xs text-muted-foreground mt-1">Nenhuma transferência é necessária entre os cotistas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transferencias.map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0 text-sm">
                    <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 rounded-full shrink-0">{t.de}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 rounded-full shrink-0">{t.para}</Badge>
                  </div>
                  <span className="font-mono font-bold text-foreground tabular-nums shrink-0">{formatBRL(t.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {arr.map((c) => {
          const positivo = c.saldo >= -0.005;
          return (
            <div key={c.id} className={cn("rounded-xl border p-4", positivo ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-rose-500/30 bg-rose-500/[0.04]")}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{c.nome}</p>
              <p className={cn("text-xl font-bold font-mono tabular-nums", positivo ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                {positivo ? "+" : ""}{formatBRL(c.saldo)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                {positivo ? <><TrendingUp className="h-3 w-3" /> a receber</> : <><TrendingDown className="h-3 w-3" /> a pagar</>}
                <ArrowRight className="h-3 w-3 mx-1 opacity-50" />
                <span>cota {c.percentual}%</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
