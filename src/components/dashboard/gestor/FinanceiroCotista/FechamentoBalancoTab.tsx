import { useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Clock,
  Gauge,
  Layers,
  TrendingDown,
  TrendingUp,
  Wallet,
  FileText,
  Scale,
  Plane,
  Fuel,
  ArrowRight,
} from "lucide-react";
import { DiarioBordoCotistaTab } from "./DiarioBordoCotistaTab";
import { AbastecimentosTab } from "./AbastecimentosTab";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);

const formatHHMM = (horasDecimais: number) => {
  const total = Math.max(0, horasDecimais || 0);
  const h = Math.floor(total);
  const m = Math.round((total - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
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
  return norm(periodicidade).startsWith("fixo");
}

export function FechamentoBalancoTab({
  aeronaveId,
  aeronaveLabel,
  cotistas,
  clienteEmFoco,
  clienteId,
  abastecimentos = [],
  relatorios = [],
}: Props) {
  const hoje = new Date();
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("mensal");
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [dataInicio, setDataInicio] = useState<string>(
    `${ano}-${String(mes).padStart(2, "0")}-01`
  );
  const [dataFim, setDataFim] = useState<string>(
    new Date(ano, mes, 0).toISOString().slice(0, 10)
  );

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
      const [{ data: rateios }, { data: voos }] = await Promise.all([
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
          .select("id, client_id, socios_id, total_time, entry_date")
          .eq("aeronave_id", aeronaveId)
          .gte("entry_date", inicio)
          .lte("entry_date", fim),
      ]);
      return {
        rateios: (rateios || []) as any[],
        voos: (voos || []) as any[],
      };
    },
  });

  const rateios = data?.rateios || [];
  const voos = data?.voos || [];

  // Agrupa rateios por despesa (mantém cada rateio para cálculo detalhado)
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

  // Despesas únicas (primeira instância de cada grupo) para totais
  const despesasUnicas = useMemo(
    () => despesasAgrupadas.map((g) => g.despesa),
    [despesasAgrupadas]
  );

  // Calcular TODOS os rateios de cada cotista (não apenas pela despesa pai)
  const creditoPorCotistaDetalhado = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));

    // Iterar sobre TODOS os rateios (não apenas despesas únicas)
    rateios.forEach((r) => {
      if ((r.fluxo || "").toUpperCase() === "ENTRADA") return;

      const cid = r.cliente_id || r.socio_id;
      if (!cid || !map.has(cid)) return;

      // Usar valor_pago_real se disponível, senão valor_rateado
      const valPago = Number(r.valor_pago_real || r.valor_rateado || 0);
      if (valPago > 0) {
        map.set(cid, (map.get(cid) || 0) + valPago);
      }
    });

    return map;
  }, [rateios, cotistas]);

  // Horas voadas por cotista
  const horasPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    voos.forEach((v) => {
      const cid = v.client_id || v.socios_id;
      if (!cid || !map.has(cid)) return;
      map.set(cid, (map.get(cid) || 0) + (Number(v.total_time) || 0));
    });
    return map;
  }, [voos, cotistas]);

  const horasTotais = useMemo(
    () => Array.from(horasPorCotista.values()).reduce((a, b) => a + b, 0),
    [horasPorCotista]
  );

  const { custoFixo, custoVariavel } = useMemo(() => {
    let f = 0;
    let v = 0;
    despesasUnicas.forEach((d) => {
      if ((d.fluxo || "").toUpperCase() === "ENTRADA") return;
      const val = Number(d.valor_total_despesa) || 0;
      if (isFixo(d.periodicidade)) f += val;
      else v += val;
    });
    return { custoFixo: f, custoVariavel: v };
  }, [despesasUnicas]);

  const custoMedioHora = horasTotais > 0 ? custoVariavel / horasTotais : 0;


  const linhas = useMemo(() => {
    return cotistas.map((c) => {
      const horas = horasPorCotista.get(c.id) || 0;

      // Calcular parcela fixa: percentual do cotista sobre o total de custos fixos
      const parcelaFixa = custoFixo * (c.percentual / 100);

      // Calcular parcela variável: proporcional às horas voadas
      const parcelaVariavel =
        horasTotais > 0 ? custoVariavel * (horas / horasTotais) : 0;

      const custoDevido = parcelaFixa + parcelaVariavel;
      const credito = creditoPorCotistaDetalhado.get(c.id) || 0;
      const saldo = credito - custoDevido;

      return {
        ...c,
        horas,
        parcelaFixa,
        parcelaVariavel,
        custoDevido,
        credito,
        saldo
      };
    });
  }, [cotistas, custoFixo, custoVariavel, horasTotais, horasPorCotista, creditoPorCotistaDetalhado]);

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  const periodoLabel =
    periodoTipo === "mensal"
      ? `${MESES[mes - 1]}/${ano}`
      : periodoTipo === "acumulado-ano"
      ? `Acumulado ${ano}`
      : `${inicio} a ${fim}`;

  return (
    <div className="space-y-6">
      {/* Filtros de período */}
      <Card className="bg-card/60 border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex items-center gap-2 px-2 text-sm font-medium text-muted-foreground">
              <Calculator className="h-4 w-4 text-primary" />
              Período:
            </div>
            <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as PeriodoTipo)}>
              <SelectTrigger className="w-56 h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="acumulado-ano">Acumulado (Ano-a-Data)</SelectItem>
                <SelectItem value="customizado">Período Customizado</SelectItem>
              </SelectContent>
            </Select>

            {periodoTipo === "mensal" && (
              <>
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger className="w-40 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger className="w-28 h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}

            {periodoTipo === "acumulado-ano" && (
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-40 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {periodoTipo === "customizado" && (
              <>
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm h-10" />
                <span className="text-xs text-muted-foreground">até</span>
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm h-10" />
              </>
            )}

            <div className="ml-auto text-xs text-muted-foreground">
              Aeronave: <span className="font-mono font-medium text-foreground">{aeronaveLabel || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="bg-card/60 border border-border p-1 rounded-xl flex-wrap h-auto">
          <TabsTrigger value="resumo" className="rounded-lg gap-2">
            <Calculator className="h-4 w-4" /> Resumo
          </TabsTrigger>
          <TabsTrigger value="lancamentos" className="rounded-lg gap-2">
            <FileText className="h-4 w-4" /> Lançamentos Detalhados
          </TabsTrigger>
          <TabsTrigger value="equilibrio" className="rounded-lg gap-2">
            <Scale className="h-4 w-4" /> Equilíbrio de Contas
          </TabsTrigger>
          <TabsTrigger value="diario" className="rounded-lg gap-2">
            <Plane className="h-4 w-4" /> Diário de Bordo
          </TabsTrigger>
          <TabsTrigger value="abast" className="rounded-lg gap-2">
            <Fuel className="h-4 w-4" /> Abastecimentos
          </TabsTrigger>
        </TabsList>

        {/* RESUMO */}
        <TabsContent value="resumo" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard icon={<Layers className="h-5 w-5" />} label="Custo Fixo Total" value={formatBRL(custoFixo)} sub="Rateado por % de cota" />
            <KpiCard icon={<Gauge className="h-5 w-5" />} label="Custo Variável Total" value={formatBRL(custoVariavel)} sub="Rateado por horas voadas" />
            <KpiCard icon={<Clock className="h-5 w-5" />} label="Horas Totais Voadas" value={formatHHMM(horasTotais)} sub={`${voos.length} lançamentos no diário`} />
            <KpiCard icon={<Wallet className="h-5 w-5" />} label="Custo Médio / Hora" value={formatBRL(custoMedioHora)} sub="Variável ÷ horas totais" />
          </div>

          <Card className="bg-card/60 border-border">
            <CardHeader>
              <CardTitle className="text-base">Acerto de Contas — {periodoLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Calculando...</p>
              ) : cotistas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhum cotista vinculado a esta aeronave.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cotista</TableHead>
                      <TableHead className="text-right">% Cota</TableHead>
                      <TableHead className="text-right">Horas Voadas</TableHead>
                      <TableHead className="text-right">Parcela Fixa</TableHead>
                      <TableHead className="text-right">Parcela Variável</TableHead>
                      <TableHead className="text-right">Custo Devido</TableHead>
                      <TableHead className="text-right">Crédito / Já Pago</TableHead>
                      <TableHead className="text-right">Saldo Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l) => {
                      const positivo = l.saldo >= 0;
                      return (
                        <TableRow key={l.id} className={l.id === clienteEmFoco ? "bg-primary/5" : undefined}>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{l.percentual}%</TableCell>
                          <TableCell className="text-right font-mono text-xs">{formatHHMM(l.horas)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatBRL(l.parcelaFixa)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatBRL(l.parcelaVariavel)}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">{formatBRL(l.custoDevido)}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-success">{formatBRL(l.credito)}</TableCell>
                          <TableCell className={`text-right font-mono text-sm font-bold ${positivo ? "text-success" : "text-destructive"}`}>
                            <div className="flex items-center justify-end gap-1">
                              {positivo ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                              <span>{positivo ? "A Receber: " : "A Pagar: "}{formatBRL(Math.abs(l.saldo))}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LANÇAMENTOS DETALHADOS */}
        <TabsContent value="lancamentos" className="mt-4">
          <LancamentosDetalhadosView
            despesasAgrupadas={despesasAgrupadas}
            cotistas={cotistas}
            periodoLabel={periodoLabel}
            aeronaveLabel={aeronaveLabel}
          />
        </TabsContent>

        {/* EQUILÍBRIO DE CONTAS */}
        <TabsContent value="equilibrio" className="mt-4">
          <EquilibrioContasView linhas={linhas} periodoLabel={periodoLabel} aeronaveLabel={aeronaveLabel} />
        </TabsContent>

        {/* DIÁRIO DE BORDO */}
        <TabsContent value="diario" className="mt-4">
          {clienteId ? (
            <DiarioBordoCotistaTab clienteId={clienteId} aeronaveId={aeronaveId} relatorios={relatorios} />
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Cliente não identificado.</p>
          )}
        </TabsContent>

        {/* ABASTECIMENTOS */}
        <TabsContent value="abast" className="mt-4">
          <AbastecimentosTab abastecimentos={abastecimentos as any} cotistas={cotistas} aeronaveLabel={aeronaveLabel} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   LANÇAMENTOS DETALHADOS — estilo planilha "Centro de Lançamentos"
   ════════════════════════════════════════════════════════════════════ */
function LancamentosDetalhadosView({
  despesasAgrupadas,
  cotistas,
  periodoLabel,
  aeronaveLabel,
}: {
  despesasAgrupadas: { despesa: any; rateios: any[] }[];
  cotistas: Cotista[];
  periodoLabel: string;
  aeronaveLabel?: string;
}) {
  const [filtroCotista, setFiltroCotista] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    return despesasAgrupadas.filter(({ despesa, rateios }) => {
      if (filtroCotista !== "todos") {
        const algum = rateios.some(
          (r) => r.cliente_id === filtroCotista || r.socio_id === filtroCotista
        );
        if (!algum) return false;
      }
      if (busca) {
        const q = norm(busca);
        const txt = norm(
          [despesa.descricao_despesa, despesa.fornecedor_nome, despesa.categoria_custo, despesa.numero_nf, despesa.numero_doc].join(" ")
        );
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [despesasAgrupadas, filtroCotista, busca]);

  const total = filtrados.reduce((a, { despesa }) => a + (Number(despesa.valor_total_despesa) || 0), 0);

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">Centro de Lançamentos — {periodoLabel}</CardTitle>
        <div className="flex gap-2 flex-wrap">
          <input
            placeholder="Buscar fornecedor, descrição, NF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="px-3 py-2 rounded-md border border-input bg-background text-sm h-9 w-64"
          />
          <Select value={filtroCotista} onValueChange={setFiltroCotista}>
            <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os cotistas</SelectItem>
              {cotistas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/40 text-[10px] uppercase tracking-wide">
                  <th className="text-left p-2 border-b border-border">Data</th>
                  <th className="text-left p-2 border-b border-border">Doc</th>
                  <th className="text-left p-2 border-b border-border">Fornecedor</th>
                  <th className="text-left p-2 border-b border-border">Descrição</th>
                  <th className="text-left p-2 border-b border-border">Categoria</th>
                  <th className="text-left p-2 border-b border-border">Tipo</th>
                  <th className="text-center p-2 border-b border-border">Fluxo</th>
                  <th className="text-left p-2 border-b border-border">Pago Por</th>
                  <th className="text-right p-2 border-b border-border">Valor</th>
                  <th colSpan={cotistas.length} className="text-center p-2 border-b border-l border-border bg-primary/5">% por Cotista</th>
                  <th colSpan={cotistas.length} className="text-center p-2 border-b border-l border-border bg-success/5">Rateio (R$)</th>
                </tr>
                <tr className="bg-muted/20 text-[10px]">
                  <th colSpan={9} className="p-1 border-b border-border"></th>
                  {cotistas.map((c) => (
                    <th key={`p-${c.id}`} className="text-center p-1 border-b border-l border-border font-mono">{c.nome.split(" ")[0]}</th>
                  ))}
                  {cotistas.map((c) => (
                    <th key={`r-${c.id}`} className="text-center p-1 border-b border-l border-border font-mono">{c.nome.split(" ")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(({ despesa: d, rateios }, idx) => {
                  const dataRef = d.data_pagamento || d.data_vencimento;
                  const doc = d.numero_nf || d.numero_doc || d.numero_recibo || d.numero_boleto || "—";
                  const valor = Number(d.valor_total_despesa) || 0;
                  const fluxoUp = (d.fluxo || "").toUpperCase();
                  // mapa cotista->rateio consolidado (soma se múltiplos registros)
                  const ratioByCotista = new Map<string, any>();
                  rateios.forEach((r) => {
                    const cid = r.cliente_id || r.socio_id;
                    if (!cid) return;
                    if (!ratioByCotista.has(cid)) {
                      ratioByCotista.set(cid, { ...r });
                    } else {
                      const existing = ratioByCotista.get(cid)!;
                      existing.valor_rateado = (Number(existing.valor_rateado) || 0) + (Number(r.valor_rateado) || 0);
                      existing.valor_pago_real = (Number(existing.valor_pago_real) || 0) + (Number(r.valor_pago_real) || 0);
                      existing.percentual_sociedade = Number(r.percentual_sociedade) || Number(existing.percentual_sociedade) || 0;
                      existing.percentual_uso = Number(r.percentual_uso) || Number(existing.percentual_uso) || null;
                    }
                  });
                  return (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="p-2 border-b border-border font-mono">{formatDate(dataRef)}</td>
                      <td className="p-2 border-b border-border font-mono">{doc}</td>
                      <td className="p-2 border-b border-border">{d.fornecedor_nome || "—"}</td>
                      <td className="p-2 border-b border-border">{d.descricao_despesa || "—"}</td>
                      <td className="p-2 border-b border-border uppercase text-[10px]">{d.categoria_custo || "—"}</td>
                      <td className="p-2 border-b border-border text-[10px]">{d.periodicidade || "—"}</td>
                      <td className="p-2 border-b border-border text-center">
                        <Badge variant="outline" className={fluxoUp === "ENTRADA" ? "border-success/40 text-success text-[10px]" : "border-destructive/40 text-destructive text-[10px]"}>
                          {fluxoUp || "SAIDA"}
                        </Badge>
                      </td>
                      <td className="p-2 border-b border-border text-[10px] uppercase">{d.pago_por || "—"}</td>
                      <td className="p-2 border-b border-border text-right font-mono font-semibold">{formatBRL(valor)}</td>
                      {cotistas.map((c) => {
                        const r = ratioByCotista.get(c.id);
                        const pct = r ? Number(r.percentual_uso ?? r.percentual_sociedade ?? 0) : 0;
                        return (
                          <td key={`p-${idx}-${c.id}`} className={`p-2 border-b border-l border-border text-center font-mono text-[10px] ${pct > 0 ? "bg-primary/5" : "text-muted-foreground/40"}`}>
                            {pct > 0 ? `${pct.toFixed(2)}%` : "—"}
                          </td>
                        );
                      })}
                      {cotistas.map((c) => {
                        const r = ratioByCotista.get(c.id);
                        const v = r ? Number(r.valor_rateado || 0) : 0;
                        return (
                          <td key={`r-${idx}-${c.id}`} className={`p-2 border-b border-l border-border text-right font-mono text-[10px] ${v > 0 ? "bg-success/5 text-foreground" : "text-muted-foreground/40"}`}>
                            {v > 0 ? formatBRL(v) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-semibold">
                  <td colSpan={8} className="p-2 text-right">TOTAL</td>
                  <td className="p-2 text-right font-mono">{formatBRL(total)}</td>
                  <td colSpan={cotistas.length * 2} className="p-2"></td>
                </tr>
              </tfoot>
            </table>
            <p className="text-[11px] text-muted-foreground mt-3">{filtrados.length} lançamento(s) · {aeronaveLabel || "—"}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EQUILÍBRIO DE CONTAS — matriz "A RECEBER DE"
   ════════════════════════════════════════════════════════════════════ */
function EquilibrioContasView({
  linhas,
  periodoLabel,
  aeronaveLabel,
}: {
  linhas: ReturnType<typeof useMemo> | any[];
  periodoLabel: string;
  aeronaveLabel?: string;
}) {
  // linhas: { id, nome, saldo, ... }
  const arr = linhas as any[];

  // Construir matriz: matrix[i][j] = quanto i RECEBE de j (positivo)
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

    const totaisLinha = matrix.map((row) => row.reduce((a, b) => a + b, 0));
    const totaisColuna = arr.map((_, j) => matrix.reduce((a, row) => a + row[j], 0));
    const equilibrado = devedores.length === 0 && credores.length === 0;
    return { matrix, totaisLinha, totaisColuna, equilibrado };
  }, [arr]);

  return (
    <div className="space-y-4">
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" /> Equilíbrio de Contas — {periodoLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {arr.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem cotistas.</p>
          ) : equilibrado ? (
            <div className="p-6 text-center bg-success/10 border border-success/30 rounded-lg">
              <Scale className="h-8 w-8 mx-auto text-success mb-2" />
              <p className="text-success font-semibold">Balanço equilibrado neste período.</p>
              <p className="text-xs text-muted-foreground mt-1">Nenhum cotista tem saldo a pagar ou receber.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border border-border bg-yellow-500/20 text-foreground"></th>
                    <th colSpan={arr.length} className="p-2 border border-border bg-yellow-400/30 text-foreground text-center text-xs uppercase tracking-wider">
                      A Receber De
                    </th>
                    <th className="p-2 border border-border bg-yellow-500/20 text-xs uppercase">Total a Receber</th>
                  </tr>
                  <tr>
                    <th className="p-2 border border-border bg-foreground text-background text-xs">Pago Por ↓</th>
                    {arr.map((c) => (
                      <th key={c.id} className="p-2 border border-border bg-muted/40 text-xs font-mono">{c.nome}</th>
                    ))}
                    <th className="p-2 border border-border bg-muted/40 text-xs"></th>
                  </tr>
                </thead>
                <tbody>
                  {arr.map((credor, i) => (
                    <tr key={credor.id}>
                      <th className="p-2 border border-border bg-muted/40 text-xs text-left font-mono">{credor.nome}</th>
                      {arr.map((_, j) => {
                        const v = matrix[i][j];
                        const isSelf = i === j;
                        return (
                          <td
                            key={j}
                            className={`p-2 border border-border text-right font-mono text-xs ${
                              isSelf ? "bg-muted/60 text-muted-foreground" :
                              v > 0.005 ? "bg-blue-500/15 text-blue-300 font-semibold" :
                              "bg-card/40 text-muted-foreground/50"
                            }`}
                          >
                            {isSelf ? "—" : v > 0.005 ? formatBRL(v) : "R$ -"}
                          </td>
                        );
                      })}
                      <td className="p-2 border border-border text-right font-mono text-xs font-bold bg-success/10 text-success">
                        {formatBRL(totaisLinha[i])}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <th className="p-2 border border-border bg-muted/40 text-xs text-left uppercase">Total a Pagar</th>
                    {totaisColuna.map((v, j) => (
                      <td key={j} className="p-2 border border-border text-right font-mono text-xs font-bold bg-destructive/10 text-destructive">
                        {v > 0.005 ? formatBRL(v) : "R$ -"}
                      </td>
                    ))}
                    <td className="p-2 border border-border bg-foreground/5"></td>
                  </tr>
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground mt-3 italic">
                Distribuição proporcional: o débito de cada cotista é dividido entre os credores de acordo com o crédito de cada um. Aeronave: {aeronaveLabel || "—"}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo individual */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {arr.map((c) => {
          const positivo = c.saldo >= 0;
          return (
            <div key={c.id} className={`rounded-xl border p-4 ${positivo ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{c.nome}</p>
              <p className={`text-xl font-bold ${positivo ? "text-success" : "text-destructive"}`}>
                {positivo ? "+" : ""}{formatBRL(c.saldo)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                {positivo ? <><TrendingUp className="h-3 w-3" /> A receber</> : <><TrendingDown className="h-3 w-3" /> A pagar</>}
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

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-md p-5 shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">{icon}</div>
      </div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
