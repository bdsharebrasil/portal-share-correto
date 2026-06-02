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
import { Input } from "@/components/ui/input";
import { Search, Paperclip, FileText } from "lucide-react";

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

interface DespesaUnificada {
  id: string;
  origem: "conciliacao" | "direto";
  data: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  descricao: string;
  categoria: string | null;
  valor_total: number;
  valor_rateado: number;
  pago_por: string;
  pago_por_tipo: string | null;
  pago_diretamente: boolean;
  forma_pagamento: string | null;
  fornecedor: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  numero_boleto: string | null;
  numero_recibo: string | null;
  status: string | null;
  observacoes: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  socio_id: string | null;
  socio_nome: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
}

interface Cotista {
  id: string;
  nome: string;
  percentual: number;
}

interface LancamentosFinanceiroTabProps {
  despesas: DespesaUnificada[];
  cotistas: Cotista[];
  aeronaveLabel?: string;
  onLancamentoClick?: (d: DespesaUnificada) => void;
}

export function LancamentosFinanceiroTab({
  despesas,
  cotistas,
  aeronaveLabel,
  onLancamentoClick,
}: LancamentosFinanceiroTabProps) {
  const hoje = new Date();
  const [mesSelecionado, setMesSelecionado] = useState<number>(
    hoje.getMonth() + 1
  );
  const [anoSelecionado, setAnoSelecionado] = useState<number>(
    hoje.getFullYear()
  );
  const [cotistaFiltro, setCotistaFiltro] = useState<string | undefined>();
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState<"todos" | "conciliacao" | "direto">("todos");

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getFullYear() - i);

  // Filtrar por mês, ano, cotista, texto e origem
  const despesasFiltradas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();

    return despesas.filter((d) => {
      if (!d.data && !d.data_vencimento) return false;

      const data = new Date(d.data || d.data_vencimento || new Date());
      const mes = data.getMonth() + 1;
      const ano = data.getFullYear();

      // Filtro de mês e ano
      if (mes !== mesSelecionado || ano !== anoSelecionado) return false;

      // Filtro de origem
      if (filtroOrigem !== "todos" && d.origem !== filtroOrigem) return false;

      // Filtro de cotista (cliente/sócio)
      if (cotistaFiltro) {
        const pertenceAoCotista =
          d.cliente_id === cotistaFiltro || d.socio_id === cotistaFiltro;
        if (!pertenceAoCotista) return false;
      }

      // Filtro de texto
      if (q) {
        return (
          d.descricao?.toLowerCase().includes(q) ||
          (d.fornecedor || "").toLowerCase().includes(q) ||
          (d.numero_doc || "").toLowerCase().includes(q) ||
          (d.numero_nf || "").toLowerCase().includes(q) ||
          (d.numero_boleto || "").toLowerCase().includes(q) ||
          (d.pago_por || "").toLowerCase().includes(q) ||
          (d.categoria || "").toLowerCase().includes(q) ||
          (d.cliente_nome || "").toLowerCase().includes(q) ||
          (d.socio_nome || "").toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [despesas, mesSelecionado, anoSelecionado, cotistaFiltro, filtroTexto, filtroOrigem]);

  // Calcular totais filtrados
  const totaisFiltrados = useMemo(() => {
    return despesasFiltradas.reduce((a, d) => a + d.valor_total, 0);
  }, [despesasFiltradas]);

  const temMultiplosCotistas = cotistas.length > 1;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="bg-card/60 border-border">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Lançamentos detalhados
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {MESES[mesSelecionado - 1]}/{anoSelecionado} — {aeronaveLabel || "—"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Linha de filtros principais */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
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
              <Select value={cotistaFiltro || ""} onValueChange={(v) => setCotistaFiltro(v || undefined)}>
                <SelectTrigger className="w-52 h-10">
                  <SelectValue placeholder="Todos os sócios/clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os sócios/clientes</SelectItem>
                  {cotistas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} ({c.percentual}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={filtroOrigem} onValueChange={(v: any) => setFiltroOrigem(v)}>
              <SelectTrigger className="w-44 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as origens</SelectItem>
                <SelectItem value="conciliacao">Pago pela Share</SelectItem>
                <SelectItem value="direto">Pago direto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Linha de busca */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar descrição, fornecedor, doc..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="pl-8 w-full h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Lançamentos */}
      <Card className="bg-card/60 border-border">
        <CardContent className="pt-6">
          {despesasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum lançamento encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Doc / NF</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    {temMultiplosCotistas && <TableHead>Cliente / Sócio</TableHead>}
                    <TableHead>Pago por</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Anexos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {despesasFiltradas.map((d) => {
                    const anexos = [
                      { url: d.comprovante_url, label: "Comprovante" },
                      { url: d.recibo_url, label: "Recibo" },
                      { url: d.nf_url, label: "NF" },
                      { url: d.boleto_url, label: "Boleto" },
                    ].filter((a) => !!a.url);

                    return (
                      <TableRow
                        key={d.id}
                        className="cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={() => onLancamentoClick?.(d)}
                      >
                        <TableCell className="text-xs">
                          {formatDate(d.data_vencimento)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(d.data_pagamento)}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {d.numero_nf || d.numero_doc || d.numero_boleto || d.numero_recibo || "—"}
                        </TableCell>
                        <TableCell className="text-sm max-w-[260px]">
                          <span className="block truncate" title={d.descricao}>
                            {d.descricao}
                          </span>
                          {d.observacoes && (
                            <span className="block text-[10px] text-muted-foreground/70 truncate" title={d.observacoes}>
                              {d.observacoes}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {d.categoria || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{d.fornecedor || "—"}</TableCell>
                        {temMultiplosCotistas && (
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {d.cliente_nome || d.socio_nome || "—"}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className={
                              d.pago_por_tipo === "EMPRESA"
                                ? "border-blue-500/40 text-blue-400"
                                : d.pago_por_tipo === "CLIENTE"
                                ? "border-amber-500/40 text-amber-400"
                                : d.pago_por_tipo === "SOCIO"
                                ? "border-purple-500/40 text-purple-400"
                                : "border-border text-muted-foreground"
                            }
                          >
                            {d.pago_por}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {d.forma_pagamento || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              d.origem === "conciliacao"
                                ? "border-blue-500/40 text-blue-400"
                                : "border-amber-500/40 text-amber-400"
                            }
                          >
                            {d.origem === "conciliacao" ? "Share pagou" : "Direto"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          {formatBRL(d.valor_total)}
                        </TableCell>
                        <TableCell className="text-center">
                          {anexos.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex justify-center gap-1">
                              {anexos.map((a) => (
                                <a
                                  key={a.label}
                                  href={a.url!}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={a.label}
                                  className="p-1 rounded hover:bg-primary/10 text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Paperclip className="h-3.5 w-3.5" />
                                </a>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {d.status || "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <p className="text-xs text-muted-foreground mt-3">
                {despesasFiltradas.length} lançamento(s) · Total: {formatBRL(totaisFiltrados)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
