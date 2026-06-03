import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useMatrizFinanceira,
  type CategoriaGrupo,
} from "@/hooks/useMatrizFinanceira";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const GRUPOS: CategoriaGrupo[] = [
  "CUSTOS FIXOS",
  "PESSOAL & TRIPULAÇÃO",
  "MANUTENÇÃO",
  "CUSTOS VARIÁVEIS",
];

const fmt = (n: number) =>
  n === 0
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(n);

interface Props {
  aeronaveId: string;
  matricula?: string;
  ano?: number;
}

export function MatrizFinanceiraMensal({ aeronaveId, matricula, ano }: Props) {
  const anoAtual = ano ?? new Date().getFullYear();
  const mesAtual = new Date().getMonth();
  const { data, isLoading } = useMatrizFinanceira(aeronaveId, anoAtual);

  const [expandidos, setExpandidos] = useState<Record<string, boolean>>(() => ({
    "CUSTOS FIXOS": true,
    "PESSOAL & TRIPULAÇÃO": true,
    "MANUTENÇÃO": true,
    "CUSTOS VARIÁVEIS": true,
  }));
  const [subExpandido, setSubExpandido] = useState<Record<string, boolean>>({});

  const fmtBRLFull = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
  const fmtData = (s: string) =>
    new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");

  const linhasPorGrupo = useMemo(() => {
    const m: Record<CategoriaGrupo, typeof data extends infer T ? any[] : any[]> = {
      "CUSTOS FIXOS": [],
      "PESSOAL & TRIPULAÇÃO": [],
      "MANUTENÇÃO": [],
      "CUSTOS VARIÁVEIS": [],
    };
    for (const l of data?.linhas || []) m[l.grupo].push(l);
    return m;
  }, [data]);

  if (isLoading) {
    return (
      <Card className="p-6 bg-card/60">
        <div className="h-64 animate-pulse bg-muted/30 rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="bg-card/60 border-border/60 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            Matriz Financeira Mensal {matricula ? `— ${matricula}` : ""}
          </h3>
          <p className="text-xs text-muted-foreground">
            Despesas agrupadas por categoria · {anoAtual}
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full">
          {MESES[mesAtual]}/{anoAtual}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-left font-medium text-muted-foreground px-3 py-2 sticky left-0 bg-muted/40 z-10 min-w-[220px]">
                Categoria
              </th>
              {MESES.map((m, i) => (
                <th
                  key={m}
                  className={`text-right font-medium px-2 py-2 ${
                    i === mesAtual ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {i === mesAtual ? (
                    <span className="inline-flex items-center gap-1">
                      {m}
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </span>
                  ) : (
                    m
                  )}
                </th>
              ))}
              <th className="text-right font-semibold text-foreground px-3 py-2 bg-muted/60">
                YTD
              </th>
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map((grupo) => {
              const linhas = linhasPorGrupo[grupo];
              const totaisGrupo = data?.totaisGrupoMes[grupo] || Array(12).fill(0);
              const totalGrupoYTD = totaisGrupo.reduce((a, b) => a + b, 0);
              const aberto = expandidos[grupo];
              return (
                <React.Fragment key={grupo}>
                  <tr
                    className="cursor-pointer hover:bg-muted/30 border-t border-border/40"
                    onClick={() =>
                      setExpandidos((s) => ({ ...s, [grupo]: !s[grupo] }))
                    }
                  >
                    <td className="px-3 py-2 sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        {aberto ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {grupo}
                      </div>
                    </td>
                    {totaisGrupo.map((v, i) => (
                      <td
                        key={i}
                        className={`text-right px-2 py-2 font-medium ${
                          v === 0 ? "text-muted-foreground/50" : "text-foreground"
                        } ${i === mesAtual ? "bg-primary/5" : ""}`}
                      >
                        {fmt(v)}
                      </td>
                    ))}
                    <td className="text-right px-3 py-2 font-semibold bg-muted/40">
                      {fmt(totalGrupoYTD)}
                    </td>
                  </tr>
                  {aberto &&
                    linhas.map((l) => (
                      <tr
                        key={`${grupo}-${l.subcategoria}`}
                        className="border-t border-border/20 hover:bg-muted/20"
                      >
                        <td className="px-3 py-1.5 pl-9 sticky left-0 bg-card z-10 text-muted-foreground">
                          {l.subcategoria}
                        </td>
                        {l.meses.map((v: number, i: number) => (
                          <td
                            key={i}
                            className={`text-right px-2 py-1.5 ${
                              v === 0
                                ? "text-muted-foreground/40"
                                : "text-foreground/90"
                            } ${i === mesAtual ? "bg-primary/5" : ""}`}
                          >
                            {fmt(v)}
                          </td>
                        ))}
                        <td className="text-right px-3 py-1.5 font-medium bg-muted/30">
                          {fmt(l.totalYTD)}
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
            <tr className="border-t-2 border-border/60 bg-muted/50">
              <td className="px-3 py-2.5 sticky left-0 bg-muted/50 z-10 font-bold text-[13px] uppercase tracking-wide">
                Total Geral
              </td>
              {(data?.totaisMes || Array(12).fill(0)).map((v, i) => (
                <td
                  key={i}
                  className={`text-right px-2 py-2.5 font-bold ${
                    i === mesAtual ? "text-primary" : "text-foreground"
                  }`}
                >
                  {fmt(v)}
                </td>
              ))}
              <td className="text-right px-3 py-2.5 font-bold text-[14px] bg-muted/70">
                {fmt(data?.totalGeralYTD || 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
