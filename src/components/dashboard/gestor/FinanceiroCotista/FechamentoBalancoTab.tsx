import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, Scale, Plane, FileText, Download, 
  TrendingDown, TrendingUp, Wallet, ArrowRight, DollarSign, 
  Clock, CheckCircle2, ChevronRight, Activity, PieChart 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DiarioBordoCotistaTab } from "./DiarioBordoCotistaTab";
import { cn } from "@/lib/utils";

const formatBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
const formatHHMM = (horasDecimais: number) => {
  const total = Math.max(0, horasDecimais || 0);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const formatDate = (s?: string | null) => s ? new Date(s.length <= 10 ? s + "T00:00:00" : s).toLocaleDateString("pt-BR") : "—";
const norm = (s?: string | null) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
function isFixo(periodicidade?: string | null) { return norm(periodicidade).startsWith("fixo"); }

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
type PeriodoTipo = "mensal" | "acumulado-ano" | "customizado";
interface Cotista { id: string; nome: string; percentual: number; }

interface Props {
  aeronaveId: string;
  aeronaveLabel?: string;
  cotistas: Cotista[];
  clienteEmFoco?: string;
  clienteId?: string;
  relatorios?: any[];
}

export function FechamentoBalancoTab({ aeronaveId, aeronaveLabel, cotistas, clienteId, relatorios = [] }: Props) {
  const hoje = new Date();
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensal");
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [dataInicio, setDataInicio] = useState<string>(`${ano}-${String(mes).padStart(2, "0")}-01`);
  const [dataFim, setDataFim] = useState<string>(new Date(ano, mes, 0).toISOString().slice(0, 10));

  const { inicio, fim } = useMemo(() => {
    if (periodoTipo === "mensal") return { inicio: new Date(ano, mes - 1, 1).toISOString().slice(0, 10), fim: new Date(ano, mes, 0).toISOString().slice(0, 10) };
    if (periodoTipo === "acumulado-ano") return { inicio: `${ano}-01-01`, fim: `${ano}-12-31` };
    return { inicio: dataInicio, fim: dataFim };
  }, [periodoTipo, mes, ano, dataInicio, dataFim]);

  const { data, isLoading } = useQuery({
    enabled: !!aeronaveId,
    queryKey: ["fechamento-balanco-leitura", aeronaveId, inicio, fim],
    queryFn: async () => {
      const [{ data: rateios }, { data: voos }] = await Promise.all([
        supabase.from("rateio_despesas" as any).select("*").eq("aeronave_id", aeronaveId).or(`and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`),
        supabase.from("lancamentos_diario_bordo" as any).select("id, clientes_id, socios_id, tempo_total, data_registro").eq("aeronave_id", aeronaveId).gte("data_registro", inicio).lte("data_registro", fim),
      ]);
      return { rateios: (rateios || []) as any[], voos: (voos || []) as any[] };
    },
  });

  const rateios = data?.rateios || [];
  const voos = data?.voos || [];

  const despesasAgrupadas = useMemo(() => {
    const m = new Map<string, { despesa: any; rateios: any[] }>();
    rateios.forEach((r) => {
      const key = r.despesa_id || `${r.data_vencimento}|${r.descricao_despesa}|${r.valor_total_despesa}`;
      if (!m.has(key)) m.set(key, { despesa: r, rateios: [] });
      m.get(key)!.rateios.push(r);
    });
    return Array.from(m.values()).sort((a, b) => (a.despesa.data_pagamento || a.despesa.data_vencimento || "").localeCompare(b.despesa.data_pagamento || b.despesa.data_vencimento || ""));
  }, [rateios]);

  const despesasUnicas = useMemo(() => despesasAgrupadas.map((g) => g.despesa), [despesasAgrupadas]);

  const creditoPorCotista = useMemo(() => {
    const map = new Map<string, number>(cotistas.map(c => [c.id, 0]));
    rateios.forEach((r) => {
      if ((r.fluxo || "").toUpperCase() === "ENTRADA") return;
      const cid = r.cliente_id || r.socio_id;
      if (cid && map.has(cid)) map.set(cid, map.get(cid)! + Number(r.valor_pago_real || 0));
    });
    return map;
  }, [rateios, cotistas]);

  const custoDevidoPorCotista = useMemo(() => {
    const map = new Map<string, number>(cotistas.map(c => [c.id, 0]));
    rateios.forEach((r) => {
      if ((r.fluxo || "").toUpperCase() === "ENTRADA") return;
      const isDGA = norm(r.descricao_despesa).includes("dga") || norm(r.fornecedor_nome).includes("dga");
      if (isDGA) {
        const valorPorSocio = Number(r.valor_total_despesa || 0) / (cotistas.length || 1);
        cotistas.forEach(c => map.set(c.id, map.get(c.id)! + (valorPorSocio / cotistas.length)));
        return;
      }
      const cid = r.cliente_id || r.socio_id;
      if (cid && map.has(cid)) map.set(cid, map.get(cid)! + Number(r.valor_rateado || 0));
    });
    return map;
  }, [rateios, cotistas]);

  const horasPorCotista = useMemo(() => {
    const map = new Map<string, number>(cotistas.map(c => [c.id, 0]));
    voos.forEach((v) => {
      const cid = v.clientes_id || v.socios_id;
      if (cid && map.has(cid)) map.set(cid, map.get(cid)! + (Number(v.tempo_total) || 0));
    });
    return map;
  }, [voos, cotistas]);

  const horasTotais = Array.from(horasPorCotista.values()).reduce((a, b) => a + b, 0);

  const { custoFixo, custoVariavel, custoTotal } = useMemo(() => {
    let f = 0, v = 0, total = 0;
    despesasUnicas.forEach((d) => {
      if ((d.fluxo || "").toUpperCase() === "ENTRADA") return;
      const val = Number(d.valor_total_despesa) || 0;
      total += val;
      isFixo(d.periodicidade) ? f += val : v += val;
    });
    return { custoFixo: f, custoVariavel: v, custoTotal: total };
  }, [despesasUnicas]);

  const linhas = useMemo(() => {
    return cotistas.map((c) => {
      const horas = horasPorCotista.get(c.id) || 0;
      const custoDevido = custoDevidoPorCotista.get(c.id) || 0;
      const credito = creditoPorCotista.get(c.id) || 0;
      const parcelaFixa = custoFixo > 0 ? (custoDevido * (custoFixo / (custoFixo + custoVariavel || 1))) : 0;
      const parcelaVariavel = custoVariavel > 0 ? (custoDevido * (custoVariavel / (custoFixo + custoVariavel || 1))) : 0;
      return { ...c, horas, parcelaFixa, parcelaVariavel, custoDevido, credito, saldo: credito - custoDevido };
    });
  }, [cotistas, custoFixo, custoVariavel, horasPorCotista, custoDevidoPorCotista, creditoPorCotista]);

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);
  const periodoLabel = periodoTipo === "mensal" ? `${MESES[mes - 1]}/${ano}` : periodoTipo === "acumulado-ano" ? `Acumulado ${ano}` : `${formatDate(inicio)} a ${formatDate(fim)}`;

  const exportarPDF = () => {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const title = `Balanço de Sócios - ${aeronaveLabel || "Aeronave"}`;
      doc.setFontSize(18); doc.text(title, 14, 20); doc.setFontSize(12); doc.text(`Período: ${periodoLabel}`, 14, 28);
      autoTable(doc, {
        startY: 35,
        head: [["Cotista", "% Cota", "Horas", "Fixo", "Var.", "Devido", "Crédito", "Saldo"]],
        body: linhas.map(l => [l.nome, `${l.percentual}%`, formatHHMM(l.horas), formatBRL(l.parcelaFixa), formatBRL(l.parcelaVariavel), formatBRL(l.custoDevido), formatBRL(l.credito), formatBRL(l.saldo)]),
        theme: "striped", headStyles: { fillColor: [41, 128, 185] },
        foot: [["TOTAL", "100%", formatHHMM(horasTotais), formatBRL(custoFixo), formatBRL(custoVariavel), formatBRL(custoTotal), formatBRL(Array.from(creditoPorCotista.values()).reduce((a, b) => a + b, 0)), formatBRL(linhas.reduce((a, b) => a + b.saldo, 0))]],
      });
      doc.save(`Balanco_${aeronaveLabel}_${periodoLabel.replace(/\//g, "-")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (error) { toast.error("Erro ao gerar PDF"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fechamento & Balanço</h2>
          <p className="text-sm text-muted-foreground">Visão consolidada e espelho financeiro da aeronave.</p>
        </div>
        <Button onClick={exportarPDF} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
          <Download className="h-4 w-4" /> Gerar Relatório PDF
        </Button>
      </div>

      <Card className="bg-card/40 border-border shadow-sm backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border/50 text-sm font-medium">
              <Calculator className="h-4 w-4 text-primary" /> Período:
            </div>
            <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as PeriodoTipo)}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-medium"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="acumulado-ano">Acumulado do Ano</SelectItem>
                <SelectItem value="customizado">Customizado</SelectItem>
              </SelectContent>
            </Select>
            {periodoTipo === "mensal" && (
              <div className="flex items-center gap-2">
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}><SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}><SelectTrigger className="w-[100px] h-9 text-xs"><SelectValue /></SelectTrigger><SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
            {periodoTipo === "customizado" && (
              <div className="flex items-center gap-2">
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="px-3 py-1 rounded-md border border-input bg-background text-xs h-9" />
                <span className="text-xs text-muted-foreground">até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="px-3 py-1 rounded-md border border-input bg-background text-xs h-9" />
              </div>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Aeronave:</span>
              <Badge variant="secondary" className="font-mono">{aeronaveLabel || "—"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="visao" className="w-full">
        <TabsList className="bg-card border border-border p-1 rounded-xl h-auto grid grid-cols-2 md:grid-cols-4 gap-1">
          <TabsTrigger value="visao" className="rounded-lg gap-2 text-xs sm:text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <PieChart className="h-4 w-4" /> Extrato Consolidado
          </TabsTrigger>
          <TabsTrigger value="lancamentos" className="rounded-lg gap-2 text-xs sm:text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <FileText className="h-4 w-4" /> Lançamentos
          </TabsTrigger>
          <TabsTrigger value="equilibrio" className="rounded-lg gap-2 text-xs sm:text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Scale className="h-4 w-4" /> Equilíbrio Financeiro
          </TabsTrigger>
          <TabsTrigger value="diario" className="rounded-lg gap-2 text-xs sm:text-sm py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Plane className="h-4 w-4" /> Diário de Bordo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-6 space-y-6">
          <VisaoGeralDashboard 
            linhas={linhas} 
            custoTotal={custoTotal} 
            custoFixo={custoFixo} 
            custoVariavel={custoVariavel} 
            horasTotais={horasTotais} 
          />
        </TabsContent>

        <TabsContent value="lancamentos" className="mt-6">
          <LancamentosEspelhoView despesasAgrupadas={despesasAgrupadas} cotistas={cotistas} periodoLabel={periodoLabel} />
        </TabsContent>

        <TabsContent value="equilibrio" className="mt-6">
          <EquilibrioContasView linhas={linhas} periodoLabel={periodoLabel} />
        </TabsContent>

        <TabsContent value="diario" className="mt-6">
          {clienteId ? <DiarioBordoCotistaTab clienteId={clienteId} aeronaveId={aeronaveId} relatorios={relatorios} /> : <p className="text-center text-muted-foreground py-8">Cliente não identificado para exibir diário.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   VISÃO GERAL DASHBOARD (NOVO) - Foco no Cliente/Sócio
   ════════════════════════════════════════════════════════════════════ */
function VisaoGeralDashboard({ linhas, custoTotal, custoFixo, custoVariavel, horasTotais }: any) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4 text-rose-500" /> Custo Operacional</p>
            <p className="text-2xl font-bold font-mono text-foreground">{formatBRL(custoTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2 mb-2"><Activity className="h-4 w-4 text-amber-500" /> Fixo vs Variável</p>
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Fixo: <span className="font-mono text-foreground font-medium">{formatBRL(custoFixo)}</span></p>
                <p className="text-xs text-muted-foreground">Var: <span className="font-mono text-foreground font-medium">{formatBRL(custoVariavel)}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-blue-500" /> Horas Voadas</p>
            <p className="text-2xl font-bold font-mono text-foreground">{formatHHMM(horasTotais)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/60 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-2 mb-2"><PieChart className="h-4 w-4 text-primary" /> Custo Médio / Hora</p>
            <p className="text-2xl font-bold font-mono text-foreground">{formatBRL(horasTotais > 0 ? custoVariavel / horasTotais : 0)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Considerando apenas custos variáveis</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Extrato Individual dos Sócios
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          {linhas.map((cotista: any) => (
            <Card key={cotista.id} className="overflow-hidden border-border bg-card shadow-sm flex flex-col">
              <div className="bg-muted/30 border-b border-border p-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-lg text-foreground">{cotista.nome}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="rounded-sm font-mono">{cotista.percentual}% Cota</Badge>
                    <span>Voou: {formatHHMM(cotista.horas)}</span>
                  </p>
                </div>
                <div className={cn("px-4 py-2 rounded-lg border text-right", cotista.saldo >= 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30")}>
                  <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80 mb-0.5">{cotista.saldo >= 0 ? "Saldo a Receber" : "Saldo a Pagar"}</p>
                  <p className={cn("text-xl font-bold font-mono tabular-nums", cotista.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {formatBRL(Math.abs(cotista.saldo))}
                  </p>
                </div>
              </div>
              <div className="p-5 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                <div className="hidden sm:block absolute left-1/2 top-4 bottom-4 w-px bg-border/50"></div>
                
                {/* Débitos (O que deve) */}
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-wider font-semibold text-rose-500 flex items-center gap-1.5 border-b border-border/50 pb-2"><TrendingDown className="h-3.5 w-3.5" /> Custos Rateados (Débitos)</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Parcela Fixo</span>
                      <span className="font-mono font-medium">{formatBRL(cotista.parcelaFixa)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Parcela Variável</span>
                      <span className="font-mono font-medium">{formatBRL(cotista.parcelaVariavel)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-border/50 font-semibold">
                      <span>Total Devido</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">{formatBRL(cotista.custoDevido)}</span>
                    </div>
                  </div>
                </div>

                {/* Créditos (O que pagou) */}
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-wider font-semibold text-emerald-500 flex items-center gap-1.5 border-b border-border/50 pb-2"><TrendingUp className="h-3.5 w-3.5" /> Valores Pagos (Créditos)</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pagamentos Realizados</span>
                      <span className="font-mono font-medium">{formatBRL(cotista.credito)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-transparent font-semibold mt-auto opacity-0 pointer-events-none">
                      <span>Espaçador</span><span>R$ 0,00</span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-border/50 font-semibold">
                      <span>Total Pago</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">{formatBRL(cotista.credito)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   LANÇAMENTOS ESPELHO - Read Only Ultra Premium
   ════════════════════════════════════════════════════════════════════ */
function LancamentosEspelhoView({ despesasAgrupadas, cotistas, periodoLabel }: any) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    if (!busca) return despesasAgrupadas;
    const q = norm(busca);
    return despesasAgrupadas.filter(({ despesa }: any) => norm([despesa.descricao_despesa, despesa.fornecedor_nome, despesa.categoria_custo].join(" ")).includes(q));
  }, [despesasAgrupadas, busca]);

  const total = filtrados.reduce((a: number, { despesa }: any) => a + (Number(despesa.valor_total_despesa) || 0), 0);

  return (
    <Card className="border-border bg-card shadow-sm overflow-hidden">
      <CardHeader className="bg-muted/20 border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-lg">Espelho de Despesas</CardTitle>
            <CardDescription>Detalhamento de todos os custos e como foram rateados no período.</CardDescription>
          </div>
          <input placeholder="Buscar lançamento..." value={busca} onChange={(e) => setBusca(e.target.value)} className="px-3 py-2 rounded-lg border border-input bg-background text-sm h-9 w-full sm:w-64 focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
      </CardHeader>
      
      <div className="overflow-x-auto">
        <style>{`
          .mirror-table th, .mirror-table td { border-right: 1px solid hsl(var(--border) / 0.4); }
          .mirror-table th:last-child, .mirror-table td:last-child { border-right: none; }
          .mirror-table tbody tr:hover { background-color: hsl(var(--muted) / 0.3); }
        `}</style>
        <table className="w-full text-xs text-left mirror-table border-collapse">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="p-3 font-semibold">Data</th>
              <th className="p-3 font-semibold">Descrição / Fornecedor</th>
              <th className="p-3 font-semibold">Categoria</th>
              <th className="p-3 font-semibold text-right">Valor Total</th>
              <th className="p-3 font-semibold text-center w-24">Status</th>
              {cotistas.map((c: any) => (
                <th key={c.id} className="p-3 font-semibold text-right border-l-2 border-l-border/60 bg-primary/5 min-w-[100px]">
                  Rateio <span className="text-foreground font-bold">{c.nome.split(' ')[0]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtrados.length === 0 ? (
              <tr><td colSpan={5 + cotistas.length} className="p-8 text-center text-muted-foreground">Nenhum lançamento corresponde à busca.</td></tr>
            ) : (
              filtrados.map(({ despesa, rateios }: any, idx: number) => {
                const isEntrada = (despesa.fluxo || "").toUpperCase() === "ENTRADA";
                const isPago = (despesa.status || "").toLowerCase() === "pago";
                return (
                  <tr key={despesa.id || idx} className="transition-colors group">
                    <td className="p-3 font-medium text-muted-foreground whitespace-nowrap">{formatDate(despesa.data_pagamento || despesa.data_vencimento)}</td>
                    <td className="p-3">
                      <p className="font-semibold text-foreground truncate max-w-[200px]">{despesa.descricao_despesa || "Sem descrição"}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{despesa.fornecedor_nome || "Fornecedor não informado"}</p>
                    </td>
                    <td className="p-3 text-muted-foreground"><Badge variant="outline" className="font-normal bg-background/50">{despesa.categoria_custo || "—"}</Badge></td>
                    <td className="p-3 text-right font-mono font-bold whitespace-nowrap">{formatBRL(despesa.valor_total_despesa)}</td>
                    <td className="p-3 text-center">
                      {isPago ? 
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1"/> Pago</Badge> : 
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"><Clock className="h-3 w-3 mr-1"/> Pendente</Badge>
                      }
                    </td>
                    {cotistas.map((c: any) => {
                      const r = rateios.find((item: any) => item.cliente_id === c.id || item.socio_id === c.id);
                      const rateio = r ? Number(r.valor_rateado || 0) : 0;
                      return (
                        <td key={c.id} className="p-3 text-right font-mono border-l-2 border-l-border/60 bg-primary/[0.02] group-hover:bg-primary/[0.04] transition-colors">
                          {rateio > 0 ? (
                            <span className={isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>{formatBRL(rateio)}</span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot className="bg-muted/30 border-t-2 border-border">
            <tr>
              <td colSpan={3} className="p-3 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Total do Período</td>
              <td className="p-3 text-right font-mono font-bold text-sm text-foreground">{formatBRL(total)}</td>
              <td colSpan={1 + cotistas.length}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EQUILÍBRIO DE CONTAS - UI Aprimorada
   ════════════════════════════════════════════════════════════════════ */
function EquilibrioContasView({ linhas, periodoLabel }: any) {
  const arr = linhas as any[];
  const { matrix, totaisLinha, totaisColuna, equilibrado } = useMemo(() => {
    const credores = arr.filter((l) => l.saldo > 0.005);
    const devedores = arr.filter((l) => l.saldo < -0.005);
    const totalCredito = credores.reduce((a, c) => a + c.saldo, 0);
    const n = arr.length;
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    if (totalCredito > 0) {
      arr.forEach((credor, i) => {
        if (credor.saldo <= 0) return;
        const share = credor.saldo / totalCredito;
        arr.forEach((dev, j) => {
          if (dev.saldo >= 0) return;
          matrix[i][j] = Math.abs(dev.saldo) * share;
        });
      });
    }
    return { matrix, totaisLinha: matrix.map((row) => row.reduce((a, b) => a + b, 0)), totaisColuna: arr.map((_, j) => matrix.reduce((a, row) => a + row[j], 0)), equilibrado: devedores.length === 0 && credores.length === 0 };
  }, [arr]);

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border bg-muted/10">
        <CardTitle className="text-lg flex items-center gap-2"><Scale className="h-5 w-5 text-primary" /> Matriz de Transferências</CardTitle>
        <CardDescription>Acerto de contas entre os sócios. Quem deve transferir para quem para equilibrar o caixa.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {equilibrado ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4"><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div>
            <h3 className="text-xl font-bold text-foreground">Balanço Equilibrado</h3>
            <p className="text-muted-foreground max-w-md mt-2">Nenhum sócio possui pendências ou créditos pendentes neste período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-sm border-collapse rounded-lg overflow-hidden ring-1 ring-border">
              <thead>
                <tr className="bg-muted/40">
                  <th className="p-3 border border-border text-left font-semibold text-muted-foreground w-[200px]">DEVEDOR ↓ \ CREDOR →</th>
                  {arr.map((c) => <th key={c.id} className="p-3 border border-border text-center font-bold">{c.nome}</th>)}
                  <th className="p-3 border border-border text-center font-bold bg-rose-500/5 text-rose-600 dark:text-rose-400">Total a Pagar</th>
                </tr>
              </thead>
              <tbody>
                {arr.map((dev, j) => (
                  <tr key={dev.id} className="hover:bg-muted/20">
                    <th className="p-3 border border-border text-left font-bold bg-muted/10">{dev.nome}</th>
                    {arr.map((credor, i) => {
                      const v = matrix[i][j];
                      const isSelf = i === j;
                      return (
                        <td key={credor.id} className={cn("p-3 border border-border text-center font-mono text-xs", isSelf ? "bg-muted/30 text-muted-foreground/30" : v > 0.005 ? "bg-emerald-500/10 text-emerald-600 font-bold" : "text-muted-foreground/40")}>
                          {isSelf ? "—" : v > 0.005 ? formatBRL(v) : "-"}
                        </td>
                      );
                    })}
                    <td className="p-3 border border-border text-center font-mono text-xs font-bold bg-rose-500/5 text-rose-600 dark:text-rose-400">
                      {totaisColuna[j] > 0.005 ? formatBRL(totaisColuna[j]) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
