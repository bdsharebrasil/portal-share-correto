import { Layout } from "@/components/layout/Layout";
import { useNavigate, useParams } from "react-router-dom";
import {
  useFinanceiroCotistaDetalhe,
  calcularBalanco,
} from "@/hooks/useFinanceiroCotista";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Plane,
  FileText,
  Wallet,
  TrendingUp,
  TrendingDown,
  Fuel,
  Receipt,
  Scale,
  KeyRound,
} from "lucide-react";
import { GerenciarAcessoPortal } from "./balanco-socio/GerenciarAcessoPortal";
import { LancamentosTab } from "./LancamentosTab";
import { useMemo, useState } from "react";
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

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n || 0);

const formatDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("pt-BR") : "—";

export default function FinanceiroCotistaDetalhe() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useFinanceiroCotistaDetalhe(clienteId);
  const [aeronaveSelecionada, setAeronaveSelecionada] = useState<string>("");

  const cliente = data?.cliente;
  const aeronaves = data?.aeronaves || [];
  const despesas = data?.despesas || [];
  const cotistasPorAeronave = data?.cotistasPorAeronave || [];
  const abastecimentos = data?.abastecimentos || [];
  const relatorios = data?.relatorios || [];

  const aeronaveAtual =
    aeronaveSelecionada || (aeronaves[0] as any)?.id_aeronave || "";

  const aeronaveInfo = (aeronaves as any[]).find(
    (a) => a.id_aeronave === aeronaveAtual
  )?.aeronave;

  const cotistasDaAeronave = useMemo(
    () =>
      cotistasPorAeronave
        .filter((c: any) => c.id_aeronave === aeronaveAtual)
        .map((c: any) => ({
          id: c.id_clientes,
          nome:
            c.cliente?.razao_social || c.cliente?.proprietario || "Cotista",
          percentual: Number(c.percentual_sociedade) || 0,
        })),
    [cotistasPorAeronave, aeronaveAtual]
  );

  // TUDO filtrado pela aeronave selecionada
  const despesasDaAeronave = useMemo(
    () => despesas.filter((d) => d.aeronave_id === aeronaveAtual),
    [despesas, aeronaveAtual]
  );
  const abastecimentosDaAeronave = useMemo(
    () => abastecimentos.filter((a) => a.aeronave_id === aeronaveAtual),
    [abastecimentos, aeronaveAtual]
  );
  const relatoriosDaAeronave = useMemo(
    () => relatorios.filter((r) => r.aeronave_id === aeronaveAtual),
    [relatorios, aeronaveAtual]
  );

  const balanco = useMemo(
    () => calcularBalanco(despesasDaAeronave, cotistasDaAeronave),
    [despesasDaAeronave, cotistasDaAeronave]
  );
  const meuBalanco = balanco.find((b) => b.cotista_id === clienteId);

  // Totais agora respeitam a aeronave selecionada
  const totaisAeronave = useMemo(() => {
    const total = despesasDaAeronave.reduce((a, d) => a + d.valor_total, 0);
    const conc = despesasDaAeronave
      .filter((d) => d.origem === "conciliacao")
      .reduce((a, d) => a + d.valor_total, 0);
    const direto = despesasDaAeronave
      .filter((d) => d.origem === "direto")
      .reduce((a, d) => a + d.valor_total, 0);
    const totalAbast = abastecimentosDaAeronave.reduce(
      (a, x) => a + x.valor_total,
      0
    );
    const totalLitros = abastecimentosDaAeronave.reduce(
      (a, x) => a + x.litros,
      0
    );
    return { total, conc, direto, totalAbast, totalLitros };
  }, [despesasDaAeronave, abastecimentosDaAeronave]);

  if (isLoading) {
    return (
      <Layout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 bg-muted rounded" />
          <div className="h-40 bg-muted rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!cliente) {
    return (
      <Layout>
        <div className="text-center text-muted-foreground py-20">
          Cliente não encontrado.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group w-fit"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Voltar</span>
        </button>

        <p className="text-xs text-muted-foreground">
          <span
            className="hover:text-primary cursor-pointer"
            onClick={() => navigate("/financeiro/financeiro-cotistas")}
          >
            Financeiro Cotistas
          </span>{" "}
          / <span className="text-foreground">{cliente.razao_social}</span>
        </p>

        {/* Cabeçalho */}
        <Card className="bg-card/60 border-border overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 overflow-hidden flex items-center justify-center shrink-0">
                {cliente.url_logo ? (
                  <img
                    src={cliente.url_logo}
                    alt={cliente.razao_social}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-bold text-primary">
                    {(cliente.razao_social || "—").slice(0, 2)}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">
                    {cliente.razao_social}
                  </h1>
                  <Badge
                    className={
                      cliente.status === "ativo"
                        ? "bg-success/15 text-success border-success/30"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {cliente.status || "—"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  CNPJ {cliente.cnpj || "—"}
                </p>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  {cliente.telefone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {cliente.telefone}
                    </span>
                  )}
                  {cliente.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {cliente.email.toLowerCase()}
                    </span>
                  )}
                  {(cliente.cidade || cliente.uf) && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {cliente.cidade}
                      {cliente.uf && `, ${cliente.uf}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center md:border-l md:pl-6 border-border">
                <div>
                  <p className="text-lg font-bold text-primary">
                    {aeronaves.length}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Aeronaves
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">
                    {despesasDaAeronave.length}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Lançamentos
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">
                    {Array.isArray(cliente.documentos)
                      ? cliente.documentos.length
                      : 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Documentos
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seletor de aeronave */}
        {aeronaves.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Plane className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Aeronave em foco:
            </span>
            <Select
              value={aeronaveAtual}
              onValueChange={setAeronaveSelecionada}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(aeronaves as any[]).map((a) => (
                  <SelectItem key={a.id_aeronave} value={a.id_aeronave}>
                    {a.aeronave?.matricula} — {a.aeronave?.modelo} ·{" "}
                    {a.percentual_sociedade}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              Todos os dados abaixo refletem apenas a aeronave selecionada.
            </span>
          </div>
        )}

        <Tabs defaultValue="visao" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-7 w-full">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
            <TabsTrigger value="viagem">Relatórios</TabsTrigger>
            <TabsTrigger value="abast">Abastecimentos</TabsTrigger>
            <TabsTrigger value="balanco">Balanço</TabsTrigger>
            <TabsTrigger value="portal" className="flex items-center gap-1">
              <KeyRound className="h-4 w-4" />
              <span className="hidden sm:inline">Acesso Portal</span>
              <span className="sm:hidden">Portal</span>
            </TabsTrigger>
          </TabsList>

          {/* Visão Geral - tudo da aeronave */}
          <TabsContent value="visao" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                label="Total despesas"
                value={formatBRL(totaisAeronave.total)}
                sub={aeronaveInfo?.matricula || "—"}
              />
              <StatCard
                icon={<Receipt className="h-5 w-5" />}
                label="Pago pela Share"
                value={formatBRL(totaisAeronave.conc)}
                sub="Conciliações bancárias"
              />
              <StatCard
                icon={<FileText className="h-5 w-5" />}
                label="Despesas diretas"
                value={formatBRL(totaisAeronave.direto)}
                sub="Enviadas ao cliente"
              />
              <StatCard
                icon={<Fuel className="h-5 w-5" />}
                label="Abastecimentos"
                value={formatBRL(totaisAeronave.totalAbast)}
                sub={`${totaisAeronave.totalLitros.toLocaleString("pt-BR")} L`}
              />
            </div>

            <Card className="bg-card/60 border-border">
              <CardHeader>
                <CardTitle className="text-base">
                  Aeronaves do cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aeronaves.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma aeronave vinculada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(aeronaves as any[]).map((a) => (
                      <button
                        key={a.id_aeronave}
                        onClick={() => setAeronaveSelecionada(a.id_aeronave)}
                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                          a.id_aeronave === aeronaveAtual
                            ? "bg-primary/10 border-primary/40"
                            : "bg-background/50 border-border/40 hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Plane className="h-4 w-4 text-primary" />
                          <div>
                            <p className="font-medium text-sm">
                              {a.aeronave?.matricula}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {a.aeronave?.modelo} · {a.aeronave?.fabricante}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {a.percentual_sociedade}% de cota
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Financeiro */}
          <TabsContent value="financeiro" className="space-y-4 mt-4">
            <Card className="bg-card/60 border-border">
              <CardHeader>
                <CardTitle className="text-base">
                  Lançamentos — {aeronaveInfo?.matricula || "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {despesasDaAeronave.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhum lançamento encontrado.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Pago por</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {despesasDaAeronave
                          .sort(
                            (a, b) =>
                              new Date(b.data || 0).getTime() -
                              new Date(a.data || 0).getTime()
                          )
                          .slice(0, 100)
                          .map((d) => (
                            <TableRow key={d.id}>
                              <TableCell className="text-xs">
                                {formatDate(d.data)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {d.descricao}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {d.categoria || "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {d.pago_por}
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
                                  {d.origem === "conciliacao"
                                    ? "Share"
                                    : "Direto"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatBRL(d.valor_total)}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lançamentos com rateio */}
          <TabsContent value="lancamentos" className="mt-4">
            <LancamentosTab
              clienteId={clienteId!}
              aeronaveId={aeronaveAtual || null}
              aeronaveLabel={aeronaveInfo?.matricula || undefined}
            />
          </TabsContent>

          {/* Relatórios de Viagem */}
          <TabsContent value="viagem" className="mt-4">
            <Card className="bg-card/60 border-border">
              <CardHeader>
                <CardTitle className="text-base">
                  Relatórios de viagem — {aeronaveInfo?.matricula || "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {relatoriosDaAeronave.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhum relatório encontrado para esta aeronave.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead>Rota</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Dias</TableHead>
                        <TableHead className="text-right">
                          Total Cliente
                        </TableHead>
                        <TableHead className="text-right">Total Geral</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {relatoriosDaAeronave.map((r) => (
                        <TableRow
                          key={r.id}
                          className="cursor-pointer hover:bg-primary/5"
                          onClick={() =>
                            navigate(
                              `/financeiro/relatorios-cliente/${clienteId}`
                            )
                          }
                        >
                          <TableCell className="font-mono text-xs">
                            {r.numero_relatorio || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {r.rota || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(r.data_inicio)} →{" "}
                            {formatDate(r.data_fim)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {r.dias_count || 0}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatBRL(r.total_clientes)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatBRL(r.total_valor)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {r.status || "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Abastecimentos */}
          <TabsContent value="abast" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                icon={<Fuel className="h-5 w-5" />}
                label="Total gasto"
                value={formatBRL(totaisAeronave.totalAbast)}
                sub={`${abastecimentosDaAeronave.length} abastecimentos`}
              />
              <StatCard
                icon={<Fuel className="h-5 w-5" />}
                label="Litros"
                value={`${totaisAeronave.totalLitros.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })} L`}
                sub="Volume acumulado"
              />
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                label="Preço médio / L"
                value={formatBRL(
                  totaisAeronave.totalLitros > 0
                    ? totaisAeronave.totalAbast / totaisAeronave.totalLitros
                    : 0
                )}
                sub="Média ponderada"
              />
            </div>

            <Card className="bg-card/60 border-border">
              <CardHeader>
                <CardTitle className="text-base">
                  Abastecimentos — {aeronaveInfo?.matricula || "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {abastecimentosDaAeronave.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhum abastecimento encontrado para esta aeronave.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Trecho / Local</TableHead>
                        <TableHead>Abastecedor</TableHead>
                        <TableHead className="text-right">Litros</TableHead>
                        <TableHead className="text-right">R$/L</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Pgto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {abastecimentosDaAeronave.slice(0, 100).map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">
                            {formatDate(a.data)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {a.trecho || a.local || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {a.abastecedor || "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {a.litros.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {formatBRL(a.valor_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {formatBRL(a.valor_total)}
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
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balanço */}
          <TabsContent value="balanco" className="space-y-4 mt-4">
            {meuBalanco && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  icon={<TrendingUp className="h-5 w-5 text-success" />}
                  label="Crédito (você pagou)"
                  value={formatBRL(meuBalanco.total_pago)}
                  sub="Total efetivamente pago"
                />
                <StatCard
                  icon={<TrendingDown className="h-5 w-5 text-destructive" />}
                  label="Débito (sua parte)"
                  value={formatBRL(meuBalanco.total_devido)}
                  sub={`Rateio sobre ${meuBalanco.percentual}% de cota`}
                />
                <StatCard
                  icon={<Scale className="h-5 w-5" />}
                  label="Saldo"
                  value={formatBRL(meuBalanco.saldo)}
                  sub={
                    meuBalanco.saldo >= 0
                      ? "Você tem a receber"
                      : "Você tem a pagar"
                  }
                  highlight={meuBalanco.saldo >= 0 ? "success" : "destructive"}
                />
              </div>
            )}

            <Card className="bg-card/60 border-border">
              <CardHeader>
                <CardTitle className="text-base">
                  Comparativo entre cotistas — {aeronaveInfo?.matricula || "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {balanco.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Sem cotistas para comparar.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cotista</TableHead>
                        <TableHead className="text-right">% Cota</TableHead>
                        <TableHead className="text-right">
                          Crédito (pagou)
                        </TableHead>
                        <TableHead className="text-right">
                          Débito (deve)
                        </TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {balanco.map((b) => (
                        <TableRow
                          key={b.cotista_id}
                          className={
                            b.cotista_id === clienteId
                              ? "bg-primary/5"
                              : undefined
                          }
                        >
                          <TableCell className="font-medium">
                            {b.cotista_nome}
                            {b.cotista_id === clienteId && (
                              <Badge
                                variant="secondary"
                                className="ml-2 text-[10px]"
                              >
                                Você
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">
                            {b.percentual}%
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-success">
                            {formatBRL(b.total_pago)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-destructive">
                            {formatBRL(b.total_devido)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-sm font-semibold ${
                              b.saldo >= 0
                                ? "text-success"
                                : "text-destructive"
                            }`}
                          >
                            {formatBRL(b.saldo)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground italic">
              * O débito é calculado proporcionalmente ao percentual de cota
              sobre cada despesa da aeronave. O crédito considera as despesas
              pagas diretamente pelo cotista (origem "Direto").
            </p>
          </TabsContent>

          {/* Acesso ao Portal */}
          <TabsContent value="portal" className="mt-4">
            <GerenciarAcessoPortal clienteId={clienteId!} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: "success" | "destructive";
}) {
  return (
    <Card className="bg-card/60 border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p
          className={`text-2xl font-bold ${
            highlight === "success"
              ? "text-success"
              : highlight === "destructive"
              ? "text-destructive"
              : "text-foreground"
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
