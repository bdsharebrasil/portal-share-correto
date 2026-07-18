import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane } from "lucide-react";
import { useMatrizFinanceira } from "@/hooks/useMatrizFinanceira";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n || 0);

interface Cotista {
  id: string;
  nome: string;
  percentual: number;
}

interface Props {
  aeronaveId: string;
  matricula?: string;
  cotistas: Cotista[];
  ano?: number;
}

type Metodo = "proporcional" | "igualitario";

export function RateioCotistas({ aeronaveId, matricula, cotistas, ano }: Props) {
  const anoAtual = ano ?? new Date().getFullYear();
  const [metodo, setMetodo] = useState<Metodo>("proporcional");
  const [mes, setMes] = useState(new Date().getMonth());
  const { data, isLoading } = useMatrizFinanceira(aeronaveId, anoAtual);

  const totalFixoMes = useMemo(() => {
    if (!data) return 0;

    const getTotalGrupo = (grupo: string) =>
      data.totaisGrupoMes?.[grupo]?.[mes] || 0;

    return (
      getTotalGrupo("CUSTOS FIXOS") +
      getTotalGrupo("PESSOAL & TRIPULAÇÃO") +
      getTotalGrupo("MANUTENÇÃO")
    );
  }, [data, mes]);

  const totalVariavelMes = data?.totaisGrupoMes?.["CUSTOS VARIÁVEIS"]?.[mes] || 0;

  const calcular = (cot: Cotista) => {
    const horas = data?.horasMesPorCotista[cot.id]?.[mes] || 0;
    const horasTot = data?.horasMesTotais[mes] || 0;
    let fixo = 0;
    let variavel = 0;
    if (metodo === "proporcional") {
      fixo = totalFixoMes * ((cot.percentual || 0) / 100);
      variavel = horasTot > 0 ? totalVariavelMes * (horas / horasTot) : 0;
    } else {
      const n = cotistas.length || 1;
      fixo = totalFixoMes / n;
      variavel = totalVariavelMes / n;
    }
    return { horas, fixo, variavel, total: fixo + variavel };
  };

  const maxValor = Math.max(
    1,
    ...cotistas.map((c) => {
      const r = calcular(c);
      return Math.max(r.fixo, r.variavel);
    }),
  );

  return (
    <Card className="bg-card/60 border-border/60 p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            Rateio de Custos — Distribuição entre Cotistas
          </h3>
          <p className="text-xs text-muted-foreground">
            {matricula ? `${matricula} · ` : ""}Método {metodo === "proporcional" ? "proporcional" : "igualitário"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
            className="h-8 rounded-lg bg-background/50 border border-border/50 text-xs px-2"
          >
            {MESES.map((m, i) => (
              <option key={m} value={i}>
                {m}/{anoAtual}
              </option>
            ))}
          </select>
          <Badge variant="secondary" className="rounded-full">
            {MESES[mes]}/{anoAtual}
          </Badge>
          <div className="inline-flex rounded-lg bg-muted/40 p-0.5 border border-border/40">
            <button
              onClick={() => setMetodo("proporcional")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                metodo === "proporcional"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Proporcional
            </button>
            <button
              onClick={() => setMetodo("igualitario")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                metodo === "igualitario"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Igualitário
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse bg-muted/30 rounded-lg" />
      ) : cotistas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhum cotista vinculado a esta aeronave.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cotistas.map((c) => {
            const r = calcular(c);
            const pctFixo = (r.fixo / maxValor) * 100;
            const pctVar = (r.variavel / maxValor) * 100;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      <Plane className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground leading-none">
                        {matricula || "—"}
                      </p>
                      <p className="text-sm font-semibold truncate">{c.nome}</p>
                    </div>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full">
                    {c.percentual.toFixed(2)}%
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                  <Metric label="Horas Voadas" value={r.horas.toFixed(1)} />
                  <Metric
                    label="Cota Fixa"
                    value={`${c.percentual.toFixed(0)}%`}
                  />
                  <Metric label="Nº Cotistas" value={String(cotistas.length)} />
                </div>

                <div className="space-y-2">
                  <BarRow
                    label="Custos Fixos Alocados"
                    value={fmt(r.fixo)}
                    pct={pctFixo}
                    color="#3266ad"
                  />
                  <BarRow
                    label="Custos Variáveis Alocados"
                    value={fmt(r.variavel)}
                    pct={pctVar}
                    color="#73726c"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Total no mês
                  </span>
                  <span className="text-[15px] font-bold text-foreground">
                    {fmt(r.total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/40 border border-border/30 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-[13px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function BarRow({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-[5px] rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
