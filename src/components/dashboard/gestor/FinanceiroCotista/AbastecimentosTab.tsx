import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Fuel, Wallet, FileText, Download, Receipt, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);

const formatDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

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

interface Abastecimento {
  id: string;
  data: string | null;
  trecho: string | null;
  local: string | null;
  litros: number;
  valor_unitario: number;
  valor_total: number;
  status_pagamento: string | null;
  abastecedor: string | null;
  aeronave_id: string | null;
  id_clientes?: string | null;
  clientes_nome?: string | null;
  socio_nome?: string | null;
  comanda?: string | null;
  nota_url?: string | null;
  boleto_url?: string | null;
  comprovante_pagamento?: string | null;
  nf?: string | null;
}

interface Cotista {
  id: string;
  nome: string;
  percentual: number;
}

interface AbastecimentosTabProps {
  abastecimentos: Abastecimento[];
  cotistas: Cotista[];
  aeronaveLabel?: string;
}

export function AbastecimentosTab({
  abastecimentos,
  cotistas,
  aeronaveLabel,
}: AbastecimentosTabProps) {
  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState<number>(
    hoje.getMonth() + 1
  );
  const [anoSelecionado, setAnoSelecionado] = useState<number>(
    hoje.getFullYear()
  );
  const [cotistaFiltro, setCotistaFiltro] = useState<string | undefined>();

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  // Filtrar por mês, ano e cotista
  const abastecimentosFiltrados = useMemo(() => {
    return abastecimentos.filter((a) => {
      if (!a.data) return false;

      const data = new Date(a.data);
      const mes = data.getMonth() + 1;
      const ano = data.getFullYear();

      // Filtro de mês e ano
      if (mes !== mesSelecionado || ano !== anoSelecionado) return false;

      // Filtro de cotista (cliente/sócio)
      if (cotistaFiltro) {
        const pertenceAoCotista =
          a.id_clientes === cotistaFiltro ||
          cotistas.some((c) => c.id === cotistaFiltro && (c.nome === a.clientes_nome || c.nome === a.socio_nome));
        if (!pertenceAoCotista) return false;
      }

      return true;
    });
  }, [abastecimentos, mesSelecionado, anoSelecionado, cotistaFiltro, cotistas]);

  // Calcular totais filtrados
  const totaisFiltrados = useMemo(() => {
    const total = abastecimentosFiltrados.reduce(
      (a, x) => a + (x.valor_total || 0),
      0
    );
    const totalLitros = abastecimentosFiltrados.reduce(
      (a, x) => a + (x.litros || 0),
      0
    );
    return { total, totalLitros };
  }, [abastecimentosFiltrados]);

  const temMultiplosCotistas = cotistas.length > 1;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="bg-card/60 border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="flex items-center gap-2 px-2 text-sm font-medium text-muted-foreground">
              <Fuel className="h-4 w-4 text-primary" />
              Filtros:
            </div>

            <Select value={String(mesSelecionado)} onValueChange={(v) => setMesSelecionado(Number(v))}>
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

            <Select value={String(anoSelecionado)} onValueChange={(v) => setAnoSelecionado(Number(v))}>
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

            {temMultiplosCotistas && (
              <Select value={cotistaFiltro || "todos"} onValueChange={(v) => setCotistaFiltro(v === "todos" ? undefined : v)}>
                <SelectTrigger className="w-52 h-10">
                  <SelectValue placeholder="Todos os sócios/clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os sócios/clientes</SelectItem>
                  {cotistas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} ({c.percentual}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="ml-auto text-xs text-muted-foreground">
              Aeronave: <span className="font-mono font-medium text-foreground">{aeronaveLabel || "—"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Totais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          icon={<Fuel className="h-5 w-5" />}
          label="Total Gasto"
          value={formatBRL(totaisFiltrados.total)}
          sub={`${abastecimentosFiltrados.length} abastecimentos`}
        />
        <KpiCard
          icon={<Fuel className="h-5 w-5" />}
          label="Litros"
          value={`${totaisFiltrados.totalLitros.toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          })} L`}
          sub="Volume acumulado"
        />
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          label="Preço médio / L"
          value={formatBRL(
            totaisFiltrados.totalLitros > 0
              ? totaisFiltrados.total / totaisFiltrados.totalLitros
              : 0
          )}
          sub="Média ponderada"
        />
      </div>

      {/* Tabela de Abastecimentos */}
      <Card className="bg-card/60 border-border">
        <CardHeader>
          <CardTitle className="text-base">
            Abastecimentos — {MESES[mesSelecionado - 1]}/{anoSelecionado} — {aeronaveLabel || "—"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {abastecimentosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum abastecimento encontrado para os filtros selecionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Comanda / NF</TableHead>
                    <TableHead>Trecho / Local</TableHead>
                    <TableHead>Abastecedor</TableHead>
                    {temMultiplosCotistas && <TableHead>Cliente / Sócio</TableHead>}
                    <TableHead className="text-right">Litros</TableHead>
                    <TableHead className="text-right">R$/L</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Anexos</TableHead>
                    <TableHead>Pgto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abastecimentosFiltrados.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs font-medium">
                        {formatDate(a.data)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-primary">Cmd: {a.comanda || "—"}</span>
                          <span className="text-muted-foreground">NF: {a.nf || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.trecho || a.local || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.abastecedor || "—"}
                      </TableCell>
                      {temMultiplosCotistas && (
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px] bg-primary/5 border-primary/20">
                           {a.socio_nome || a.clientes_nome|| "—"}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono text-xs">
                        {a.litros.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatBRL(a.valor_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {formatBRL(a.valor_total)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {a.nota_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={a.nota_url} target="_blank" rel="noopener noreferrer" title="Ver Nota Fiscal">
                                <Receipt className="h-3.5 w-3.5 text-blue-500" />
                              </a>
                            </Button>
                          )}
                          {a.boleto_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={a.boleto_url} target="_blank" rel="noopener noreferrer" title="Ver Boleto">
                                <FileText className="h-3.5 w-3.5 text-orange-500" />
                              </a>
                            </Button>
                          )}
                          {a.comprovante_pagamento && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={a.comprovante_pagamento} target="_blank" rel="noopener noreferrer" title="Ver Comprovante">
                                <ExternalLink className="h-3.5 w-3.5 text-green-500" />
                              </a>
                            </Button>
                          )}
                          {!a.nota_url && !a.boleto_url && !a.comprovante_pagamento && (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            a.status_pagamento === "pago"
                              ? "border-success/40 text-success text-[10px]"
                              : "border-amber-500/40 text-amber-400 text-[10px]"
                          }
                        >
                          {a.status_pagamento || "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <p className="text-xs text-muted-foreground mt-3">
                {abastecimentosFiltrados.length} abastecimento(s) · Total: {formatBRL(totaisFiltrados.total)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
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
