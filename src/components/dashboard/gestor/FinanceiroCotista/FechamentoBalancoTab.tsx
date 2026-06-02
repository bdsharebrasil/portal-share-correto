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
import {
  Calculator,
  Clock,
  Gauge,
  Layers,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

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

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
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
}

/** Normaliza string para comparação flexível de nomes. */
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
      // customizado
      start = dataInicio;
      end = dataFim;
    }

    return { inicio: start, fim: end };
  }, [periodoTipo, mes, ano, dataInicio, dataFim]);

  const { data, isLoading } = useQuery({
    enabled: !!aeronaveId,
    queryKey: ["fechamento-balanco", aeronaveId, periodoTipo, mes, ano, dataInicio, dataFim],
    queryFn: async () => {
      const [{ data: despesas }, { data: voos }] = await Promise.all([
        (supabase as any)
          .from("rateio_despesas")
          .select(
            "id, descricao_despesa, fornecedor_nome, categoria_custo, periodicidade, valor_total_despesa, pago_por, pago_por_tipo, data_pagamento, data_vencimento, cliente_id, clientes_nome, socio_id, socios_nome"
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
      ]);

      return {
        despesas: (despesas || []) as any[],
        voos: (voos || []) as any[],
      };
    },
  });

  const despesas = data?.despesas || [];
  const voos = data?.voos || [];

  // Horas voadas por cotista (clientes_id ou socios_id)
  const horasPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    voos.forEach((v) => {
      const cid = v.clientes_id || v.socios_id;
      if (!cid) return;
      if (!map.has(cid)) return;
      map.set(cid, (map.get(cid) || 0) + (Number(v.tempo_total) || 0));
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
    despesas.forEach((d) => {
      const val = Number(d.valor_total_despesa) || 0;
      if (isFixo(d.periodicidade)) f += val;
      else v += val;
    });
    return { custoFixo: f, custoVariavel: v };
  }, [despesas]);

  const custoMedioHora = horasTotais > 0 ? custoVariavel / horasTotais : 0;

  // Crédito: somatório por nome de pago_por que bate com nome do cotista
  const creditoPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    despesas.forEach((d) => {
      const val = Number(d.valor_total_despesa) || 0;
      const pagoNorm = norm(d.pago_por);
      if (!pagoNorm || pagoNorm === "empresa" || pagoNorm === "share" || pagoNorm === "share brasil") return;
      // 1) match direto por id (cliente_id / socio_id na linha)
      const matchId =
        cotistas.find((c) => c.id === d.cliente_id) ||
        cotistas.find((c) => c.id === d.socio_id);
      // 2) match por nome
      const matchNome =
        cotistas.find((c) => norm(c.nome) === pagoNorm) ||
        cotistas.find(
          (c) => pagoNorm.includes(norm(c.nome)) && norm(c.nome).length > 3
        );
      const alvo = matchId || matchNome;
      if (alvo) map.set(alvo.id, (map.get(alvo.id) || 0) + val);
    });
    return map;
  }, [despesas, cotistas]);

  const linhas = useMemo(() => {
    return cotistas.map((c) => {
      const horas = horasPorCotista.get(c.id) || 0;
      const parcelaFixa = custoFixo * (c.percentual / 100);
      const parcelaVariavel =
        horasTotais > 0 ? custoVariavel * (horas / horasTotais) : 0;
      const custoDevido = parcelaFixa + parcelaVariavel;
      const credito = creditoPorCotista.get(c.id) || 0;
      const saldo = credito - custoDevido;
      return {
        ...c,
        horas,
        parcelaFixa,
        parcelaVariavel,
        custoDevido,
        credito,
        saldo,
      };
    });
  }, [cotistas, custoFixo, custoVariavel, horasTotais, horasPorCotista, creditoPorCotista]);

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="bg-card/60 border-border">
        <CardContent className="p-4 space-y-4">
          {/* Tipo de período */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex items-center gap-2 px-2 text-sm font-medium text-muted-foreground">
              <Calculator className="h-4 w-4 text-primary" />
              Tipo de período:
            </div>
            <Select value={periodoTipo} onValueChange={(v) => setPeriodoTipo(v as PeriodoTipo)}>
              <SelectTrigger className="w-56 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="acumulado-ano">Acumulado (Ano-a-Data)</SelectItem>
                <SelectItem value="customizado">Período Customizado</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-xs text-muted-foreground">
              Aeronave: <span className="font-mono font-medium text-foreground">{aeronaveLabel || "—"}</span>
            </div>
          </div>

          {/* Opções específicas por tipo */}
          {periodoTipo === "mensal" && (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <span className="text-xs text-muted-foreground px-2">Selecione mês e ano:</span>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="w-44 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-32 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodoTipo === "acumulado-ano" && (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <span className="text-xs text-muted-foreground px-2">Ano-a-data:</span>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-40 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                ({inicio} a {fim})
              </span>
            </div>
          )}

          {periodoTipo === "customizado" && (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <span className="text-xs text-muted-foreground px-2">De:</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="px-3 py-2 rounded-md border border-input bg-background text-sm h-10 max-w-xs"
              />
              <span className="text-xs text-muted-foreground px-2">Até:</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="px-3 py-2 rounded-md border border-input bg-background text-sm h-10 max-w-xs"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<Layers className="h-5 w-5" />}
          label="Custo Fixo Total"
          value={formatBRL(custoFixo)}
          sub="Rateado por % de cota"
        />
        <KpiCard
          icon={<Gauge className="h-5 w-5" />}
          label="Custo Variável Total"
          value={formatBRL(custoVariavel)}
          sub="Rateado por horas voadas"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label="Horas Totais Voadas"
          value={formatHHMM(horasTotais)}
          sub={`${voos.length} lançamentos no diário`}
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Custo Médio / Hora"
          value={formatBRL(custoMedioHora)}
          sub="Variável ÷ horas totais"
        />
      </div>

      {/* Tabela de Acerto */}
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base">
            Acerto de Contas — {periodoTipo === "mensal" ? `${MESES[mes - 1]}/${ano}` : periodoTipo === "acumulado-ano" ? `Acumulado ${ano}` : `${inicio} a ${fim}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Calculando...</p>
          ) : cotistas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum cotista vinculado a esta aeronave.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cotista</TableHead>
                  <TableHead className="text-right">% Cota</TableHead>
                  <TableHead className="text-right">Horas Voadas</TableHead>
                  <TableHead className="text-right">Parcela Fixa (A)</TableHead>
                  <TableHead className="text-right">Parcela Variável (B)</TableHead>
                  <TableHead className="text-right">Custo Devido (A+B)</TableHead>
                  <TableHead className="text-right">Crédito / Já Pago</TableHead>
                  <TableHead className="text-right">Saldo Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const positivo = l.saldo >= 0;
                  return (
                    <TableRow
                      key={l.id}
                      className={l.id === clienteEmFoco ? "bg-primary/5" : undefined}
                    >
                      <TableCell className="font-medium">
                        {l.nome}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {l.percentual}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatHHMM(l.horas)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBRL(l.parcelaFixa)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatBRL(l.parcelaVariavel)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatBRL(l.custoDevido)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-success">
                        {formatBRL(l.credito)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm font-bold ${
                          positivo ? "text-success" : "text-destructive"
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {positivo ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {positivo ? "A Receber: " : "A Pagar: "}
                            {formatBRL(Math.abs(l.saldo))}
                          </span>
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

      <p className="text-xs text-muted-foreground italic px-2">
        * Despesas <strong>Fixas</strong> (periodicidade = FIXO) são rateadas pela % de cota.
        Despesas <strong>Variáveis</strong> são rateadas proporcionalmente às horas voadas no mês
        (tempo_total do diário de bordo). O <strong>crédito</strong> soma os lançamentos em que o
        campo <em>Pago Por</em> identifica o próprio cotista (id ou nome).
      </p>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-md p-5 shadow-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">{icon}</div>
      </div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80 font-semibold mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
