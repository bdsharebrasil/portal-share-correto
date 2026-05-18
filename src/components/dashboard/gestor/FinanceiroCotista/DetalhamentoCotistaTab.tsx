import { useState, useMemo } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCotistaDetalhamentoMensal } from "@/hooks/useCotistaDetalhamentoMensal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const fmtHoras = (h: number) => {
  if (!h || h < 0.01) return "0h";
  const horas = Math.floor(h);
  const minutos = Math.round((h - horas) * 60);
  return minutos > 0 ? `${horas}h${minutos}m` : `${horas}h`;
};

const fmtDate = (s?: string | null) =>
  s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—";

interface DetalhamentoCotistaTabProps {
  clienteId: string;
  clienteNome: string;
  cotistaNome: string;
  cotistaPct: number;
  aeronaveId: string;
  aeronaveLabel: string;
}

export function DetalhamentoCotistaTab({
  clienteId,
  clienteNome,
  cotistaNome,
  cotistaPct,
  aeronaveId,
  aeronaveLabel,
}: DetalhamentoCotistaTabProps) {
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    fixas: true,
    variaveis: true,
    extras: false,
    bordo: true,
  });

  const { data: detalhamento, isLoading } = useCotistaDetalhamentoMensal(
    clienteId,
    aeronaveId,
    mesSelecionado
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const meses = useMemo(() => {
    const result = [];
    const hoje = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = format(d, "MMMM 'de' yyyy", { locale: ptBR });
      result.push({ key, label });
    }
    return result;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!detalhamento) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Sem dados para este período
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com seletor de mês */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Detalhamento de Custos</h2>
          <p className="text-xs text-muted-foreground">
            {cotistaNome} ({cotistaPct}%) • {aeronaveLabel}
          </p>
        </div>
        <select
          value={mesSelecionado}
          onChange={(e) => setMesSelecionado(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          {meses.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Resumo geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Custos Fixos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtBRL(detalhamento.totalFixo)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Custos Variáveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtBRL(detalhamento.totalVariavel)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Total Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtBRL(detalhamento.totalDespesas)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
              Horas Voadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{fmtHoras(detalhamento.horasVoadasTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Despesas Fixas */}
      <Card>
        <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
          <button
            onClick={() => toggleSection("fixas")}
            className="flex items-center justify-between w-full"
          >
            <div>
              <CardTitle className="text-base">Custos Fixos</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {detalhamento.despesasFixas.length} item(ns)
              </p>
            </div>
            {expandedSections.fixas ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </CardHeader>
        {expandedSections.fixas && (
          <CardContent className="pt-0">
            {detalhamento.despesasFixas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum custo fixo neste período</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Sua Parcela</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhamento.despesasFixas.map((d) => (
                    <TableRow key={d.id} className="text-xs">
                      <TableCell>{fmtDate(d.data_vencimento)}</TableCell>
                      <TableCell className="font-medium">{d.descricao}</TableCell>
                      <TableCell>{d.fornecedor || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{fmtBRL(d.valor_total)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {fmtBRL(d.valor_rateado)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {d.status || "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      {/* Despesas Variáveis */}
      <Card>
        <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
          <button
            onClick={() => toggleSection("variaveis")}
            className="flex items-center justify-between w-full"
          >
            <div>
              <CardTitle className="text-base">Custos Variáveis</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {detalhamento.despesasVariaveis.length} item(ns)
              </p>
            </div>
            {expandedSections.variaveis ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </CardHeader>
        {expandedSections.variaveis && (
          <CardContent className="pt-0">
            {detalhamento.despesasVariaveis.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum custo variável neste período</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Sua Parcela</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhamento.despesasVariaveis.map((d) => (
                    <TableRow key={d.id} className="text-xs">
                      <TableCell>{fmtDate(d.data_vencimento)}</TableCell>
                      <TableCell className="font-medium">{d.descricao}</TableCell>
                      <TableCell>{d.fornecedor || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{fmtBRL(d.valor_total)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {fmtBRL(d.valor_rateado)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {d.status || "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        )}
      </Card>

      {/* Despesas Extras */}
      {detalhamento.despesasExtras.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
            <button
              onClick={() => toggleSection("extras")}
              className="flex items-center justify-between w-full"
            >
              <div>
                <CardTitle className="text-base">Custos Extras</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {detalhamento.despesasExtras.length} item(ns)
                </p>
              </div>
              {expandedSections.extras ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          </CardHeader>
          {expandedSections.extras && (
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Sua Parcela</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalhamento.despesasExtras.map((d) => (
                    <TableRow key={d.id} className="text-xs">
                      <TableCell>{fmtDate(d.data_vencimento)}</TableCell>
                      <TableCell className="font-medium">{d.descricao}</TableCell>
                      <TableCell>{d.fornecedor || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{fmtBRL(d.valor_total)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {fmtBRL(d.valor_rateado)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {d.status || "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

      {/* Diário de Bordo / Horas */}
      <Card>
        <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
          <button
            onClick={() => toggleSection("bordo")}
            className="flex items-center justify-between w-full"
          >
            <div>
              <CardTitle className="text-base">Diário de Bordo</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {detalhamento.lancamentosBordo.length} voo(s) • {fmtHoras(detalhamento.horasVoadasTotal)} totais
              </p>
            </div>
            {expandedSections.bordo ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </CardHeader>
        {expandedSections.bordo && (
          <CardContent className="pt-0">
            {detalhamento.lancamentosBordo.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum voo registrado neste período</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Voo Total</TableHead>
                      <TableHead className="text-right">Diurno</TableHead>
                      <TableHead className="text-right">Noturno</TableHead>
                      <TableHead className="text-right">IFR</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalhamento.lancamentosBordo.map((l) => (
                      <TableRow key={l.id} className="text-xs">
                        <TableCell>{fmtDate(l.data)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {fmtHoras(l.horas_voo)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtHoras(l.horas_diurnas)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtHoras(l.horas_noturnas)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtHoras(l.horas_ifr)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{l.descricao || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Resumo de horas */}
                <div className="mt-4 p-3 rounded-lg bg-muted/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-[11px] uppercase font-semibold">Total Voado</p>
                      <p className="text-lg font-bold">{fmtHoras(detalhamento.horasVoadasTotal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px] uppercase font-semibold">Diurno</p>
                      <p className="text-lg font-bold">{fmtHoras(detalhamento.horasDiurnasTotal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px] uppercase font-semibold">Noturno</p>
                      <p className="text-lg font-bold">{fmtHoras(detalhamento.horasNoturnasTotal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[11px] uppercase font-semibold">IFR</p>
                      <p className="text-lg font-bold">{fmtHoras(detalhamento.horasIfrTotal)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
