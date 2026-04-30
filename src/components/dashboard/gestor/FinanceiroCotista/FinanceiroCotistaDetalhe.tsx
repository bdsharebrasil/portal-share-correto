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
  Building,
} from "lucide-react";
import { GerenciarAcessoPortal } from "./balanco-socio/GerenciarAcessoPortal";
import { LancamentosTab } from "./LancamentosTab";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Paperclip } from "lucide-react";
import type { DespesaUnificada } from "@/hooks/useFinanceiroCotista";
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
  const [filtroFin, setFiltroFin] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState<"todos" | "conciliacao" | "direto">("todos");
  const [drillCard, setDrillCard] = useState<null | "total" | "share" | "direto" | "abast">(null);

  const cliente = data?.cliente;
  const aeronaves = data?.aeronaves || [];
  const despesas = data?.despesas || [];
  const cotistasPorAeronave = data?.cotistasPorAeronave || [];
  const abastecimentos = data?.abastecimentos || [];
  const relatorios = data?.relatorios || [];
  const rateioDespesasDetalhado = data?.rateioDespesasDetalhado || [];

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
        <div className="animate-pulse space-y-6 max-w-7xl mx-auto">
          <div className="h-4 w-32 bg-muted/50 rounded-full" />
          <div className="h-48 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-card/40 rounded-2xl border border-border/40" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!cliente) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
            <Building className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground tracking-tight">Cliente não encontrado</p>
          <p className="text-sm text-muted-foreground">O cadastro pode ter sido removido ou o ID é inválido.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Navegação Topo */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-300 w-fit"
          >
            <div className="p-1.5 rounded-lg bg-background/50 border border-border/40 group-hover:border-border transition-colors">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            <span className="text-sm font-medium tracking-tight">Voltar para clientes</span>
          </button>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className="hover:text-primary cursor-pointer transition-colors"
              onClick={() => navigate("/financeiro/financeiro-cotistas")}
            >
              Gestão Financeira
            </span>
            <span>/</span>
            <span className="text-foreground font-medium">{cliente.razao_social}</span>
          </div>
        </div>

        {/* Hero Card Premium */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-card/80 to-card/30 backdrop-blur-xl border border-border/50 shadow-2xl">
          {/* Efeito de brilho de fundo (Glow) */}
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none" />
          
          <div className="p-8 md:p-10 relative z-10">
            <div className="flex flex-col md:flex-row md:items-start gap-8">
              
              {/* Logo Premium */}
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-background to-muted/30 border border-border/50 shadow-inner flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-background/50">
                {cliente.url_logo ? (
                  <img
                    src={cliente.url_logo}
                    alt={cliente.razao_social}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
                    {(cliente.razao_social || "—").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info Principal */}
              <div className="flex-1 space-y-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                      {cliente.razao_social}
                    </h1>
                    <Badge
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        cliente.status === "ativo"
                          ? "bg-success/10 text-success border-success/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                          : "bg-muted/50 text-muted-foreground border-border"
                      }`}
                    >
                      {cliente.status || "—"}
                    </Badge>
                  </div>
                  <p className="text-sm font-mono text-muted-foreground/80 tracking-widest">
                    CNPJ {cliente.cnpj || "—"}
                  </p>
                </div>

                {/* Contatos em Pills Glassmorphism */}
                <div className="flex flex-wrap gap-3">
                  {cliente.telefone && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors backdrop-blur-md">
                      <Phone className="h-3.5 w-3.5 text-primary/70" />
                      {cliente.telefone}
                    </div>
                  )}
                  {cliente.email && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors backdrop-blur-md">
                      <Mail className="h-3.5 w-3.5 text-primary/70" />
                      {cliente.email.toLowerCase()}
                    </div>
                  )}
                  {(cliente.cidade || cliente.uf) && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/40 border border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors backdrop-blur-md">
                      <MapPin className="h-3.5 w-3.5 text-primary/70" />
                      {cliente.cidade}
                      {cliente.uf && `, ${cliente.uf}`}
                    </div>
                  )}
                </div>
              </div>

              {/* Métricas Hero */}
              <div className="flex flex-row md:flex-col gap-6 md:pl-10 md:border-l border-border/40 min-w-[140px]">
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-muted-foreground/70 mb-1">
                    Aeronaves
                  </p>
                  <p className="text-3xl font-light text-foreground">
                    {aeronaves.length > 9 ? aeronaves.length : `0${aeronaves.length}`}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-muted-foreground/70 mb-1">
                    Lançamentos
                  </p>
                  <p className="text-3xl font-light text-foreground">
                    {despesasDaAeronave.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar de Filtro de Aeronave Ultra-Clean */}
        {aeronaves.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/40">
            <div className="flex items-center gap-3 px-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Plane className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-muted-foreground tracking-tight">
                Analisando aeronave:
              </span>
            </div>
            <div className="flex-1 max-w-sm">
              <Select value={aeronaveAtual} onValueChange={setAeronaveSelecionada}>
                <SelectTrigger className="w-full bg-background/50 border-border/50 rounded-xl h-11 transition-all focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 backdrop-blur-xl bg-card/90">
                  {(aeronaves as any[]).map((a) => (
                    <SelectItem key={a.id_aeronave} value={a.id_aeronave} className="rounded-lg my-1">
                      <span className="font-medium text-foreground">{a.aeronave?.matricula}</span>
                      <span className="text-muted-foreground mx-2">—</span>
                      <span className="text-muted-foreground">{a.aeronave?.modelo} ({a.percentual_sociedade}%)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Navegação por Tabs Moderna */}
        <Tabs defaultValue="visao" className="w-full">
          <TabsList className="h-auto p-1 bg-card/40 backdrop-blur-md border border-border/40 rounded-2xl w-full flex flex-wrap justify-start gap-1">
            <TabsTrigger value="visao" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">Visão Geral</TabsTrigger>
            <TabsTrigger value="lancamentos" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all font-semibold border-2 border-primary/20 data-[state=active]:border-primary">
              <FileText className="h-4 w-4 mr-2" />
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Financeiro</TabsTrigger>
            <TabsTrigger value="viagem" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Relatórios</TabsTrigger>
            <TabsTrigger value="abast" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Abastecimentos</TabsTrigger>
            <TabsTrigger value="balanco" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">Balanço</TabsTrigger>
            <TabsTrigger value="portal" className="rounded-xl px-4 py-2.5 flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all ml-auto">
              <KeyRound className="h-4 w-4 text-primary/70" />
              <span>Acesso Portal</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            {/* Visão Geral */}
            <TabsContent value="visao" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  icon={<Wallet className="h-5 w-5" />}
                  label="Total despesas"
                  value={formatBRL(totaisAeronave.total)}
                  sub={`${despesasDaAeronave.length} lançamentos · ${aeronaveInfo?.matricula || "—"}`}
                  onClick={() => setDrillCard("total")}
                />
                <StatCard
                  icon={<Receipt className="h-5 w-5" />}
                  label="Pago pela Share Brasil"
                  value={formatBRL(totaisAeronave.conc)}
                  sub="Quitado pela operadora (a reembolsar)"
                  onClick={() => setDrillCard("share")}
                />
                <StatCard
                  icon={<FileText className="h-5 w-5" />}
                  label="Pago pelo cliente / sócio"
                  value={formatBRL(totaisAeronave.direto)}
                  sub="Despesas pagas direto do bolso"
                  onClick={() => setDrillCard("direto")}
                />
                <StatCard
                  icon={<Fuel className="h-5 w-5" />}
                  label="Abastecimentos"
                  value={formatBRL(totaisAeronave.totalAbast)}
                  sub={`${totaisAeronave.totalLitros.toLocaleString("pt-BR")} L`}
                  onClick={() => setDrillCard("abast")}
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

            {/* Lançamentos - Redirecionar para página dedicada */}
            <TabsContent value="lancamentos" className="mt-4">
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">Gerenciar Lançamentos</h3>
                  <p className="text-muted-foreground max-w-md">
                    Acesse a página dedicada para criar, editar e gerenciar lançamentos financeiros desta aeronave.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/financeiro/lancamento/${clienteId}/${aeronaveAtual}`)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
                >
                  <FileText className="h-4 w-4" />
                  Ir para Lançamentos
                </button>
              </div>
            </TabsContent>

            {/* Financeiro */}
            <TabsContent value="financeiro" className="space-y-4 mt-4">
              <Card className="bg-card/60 border-border">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Lançamentos detalhados — {aeronaveInfo?.matricula || "—"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Visão analítica de cada despesa: pagador, fornecedor, documentos e anexos.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar descrição, fornecedor, doc..."
                        value={filtroFin}
                        onChange={(e) => setFiltroFin(e.target.value)}
                        className="pl-8 w-64 h-9"
                      />
                    </div>
                    <Select value={filtroOrigem} onValueChange={(v: any) => setFiltroOrigem(v)}>
                      <SelectTrigger className="w-44 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as origens</SelectItem>
                        <SelectItem value="conciliacao">Pago pela Share</SelectItem>
                        <SelectItem value="direto">Pago direto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <DespesasTable
                    despesas={despesasDaAeronave}
                    filtro={filtroFin}
                    filtroOrigem={filtroOrigem}
                  />
                </CardContent>
              </Card>
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
                    label="Já pago pelo cliente"
                    value={formatBRL(meuBalanco.total_pago)}
                    sub="Despesas quitadas direto pelo cliente/sócio"
                  />
                  <StatCard
                    icon={<TrendingDown className="h-5 w-5 text-destructive" />}
                    label="Devido pelo cliente"
                    value={formatBRL(meuBalanco.total_devido)}
                    sub={`Rateio sobre ${meuBalanco.percentual}% de cota`}
                  />
                  <StatCard
                    icon={<Scale className="h-5 w-5" />}
                    label="Saldo"
                    value={formatBRL(Math.abs(meuBalanco.saldo))}
                    sub={
                      meuBalanco.saldo >= 0
                        ? "Share deve ao cliente"
                        : "Cliente deve à Share"
                    }
                    highlight={meuBalanco.saldo >= 0 ? "success" : "destructive"}
                  />
                </div>
              )}

              <Card className="bg-card/60 border-border">
                <CardHeader>
                  <CardTitle className="text-base">
                    Comparativo Detalhado entre Cotistas — {aeronaveInfo?.matricula || "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rateioDespesasDetalhado.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Sem despesas para comparar.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Data</TableHead>
                            <TableHead className="text-xs">Doc</TableHead>
                            <TableHead className="text-xs">Fornecedor</TableHead>
                            <TableHead className="text-xs">Descrição</TableHead>
                            <TableHead className="text-xs">Categoria</TableHead>
                            <TableHead className="text-right text-xs">Valor Total</TableHead>
                            <TableHead className="text-xs">Quem Pagou</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            {cotistasDaAeronave.map((cot) => (
                              <TableHead key={cot.id} className="text-right text-xs">
                                <div className="font-semibold">{cot.nome}</div>
                                <div className="text-muted-foreground">{cot.percentual}%</div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rateioDespesasDetalhado.map((despesa, idx) => (
                            <TableRow key={`${despesa.despesa_id}-${idx}`} className="hover:bg-muted/50">
                              <TableCell className="text-xs font-mono whitespace-nowrap">
                                {despesa.data_pagamento
                                  ? formatDate(despesa.data_pagamento)
                                  : despesa.data_vencimento
                                  ? formatDate(despesa.data_vencimento)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-xs font-mono">
                                {despesa.numero_nf || despesa.numero_doc || "—"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">
                                {despesa.fornecedor_nome || "—"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate">
                                {despesa.descricao_despesa || "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {despesa.categoria_custo || "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm font-semibold">
                                {formatBRL(despesa.valor_total_despesa)}
                              </TableCell>
                              <TableCell className="text-xs">
                                {despesa.pago_por || "Share Brasil"}
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {despesa.status || "pendente"}
                                </Badge>
                              </TableCell>
                              {cotistasDaAeronave.map((cot) => {
                                const rateio = despesa.rateios.find(
                                  (r) => r.cliente_id === cot.id
                                );
                                if (!rateio) {
                                  return (
                                    <TableCell key={cot.id} className="text-center text-xs">
                                      —
                                    </TableCell>
                                  );
                                }
                                return (
                                  <TableCell
                                    key={cot.id}
                                    className={`text-right text-xs font-mono ${
                                      rateio.valor_pago_real > 0
                                        ? "text-success bg-success/5"
                                        : rateio.pago_diretamente
                                        ? "text-warning bg-warning/5"
                                        : "text-destructive"
                                    }`}
                                  >
                                    <div className="font-semibold">
                                      {formatBRL(rateio.valor_rateado)}
                                    </div>
                                    {rateio.valor_pago_real > 0 && (
                                      <div className="text-[10px] text-muted-foreground">
                                        Pago: {formatBRL(rateio.valor_pago_real)}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground italic mt-3">
                * Cada coluna de cotista mostra o valor rateado conforme sua % de cota. "Valor rateado" = valor total × % de cota do
                cotista. "Pago" = valor efetivamente quitado (se diferente do rateio). Cores: verde = pago, laranja = pago direto, vermelho = pendente.
              </p>
            </TabsContent>

            {/* Acesso ao Portal */}
            <TabsContent value="portal" className="mt-4">
              <GerenciarAcessoPortal clienteId={clienteId!} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Drill-down dos cards do topo - Visualização Inline */}
        {drillCard && (
          <DrillDownModal
            tipo={drillCard}
            onClose={() => setDrillCard(null)}
            despesas={despesasDaAeronave}
            abastecimentos={abastecimentosDaAeronave}
            aeronaveLabel={aeronaveInfo?.matricula || "—"}
          />
        )}
      </div>
    </Layout>
  );
}


// Componente de Estatística Refatorado para AA++
function StatCard({
  icon,
  label,
  value,
  sub,
  highlight,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: "success" | "destructive";
  onClick?: () => void;
}) {
  const Component: any = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className={`group relative p-6 rounded-3xl bg-gradient-to-b from-card/60 to-card/20 backdrop-blur-md border border-border/40 hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden text-left w-full ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/80">
            {label}
          </span>
          <div className="p-2.5 rounded-xl bg-background border border-border/50 text-foreground group-hover:scale-110 group-hover:text-primary transition-all duration-500 shadow-sm">
            {icon}
          </div>
        </div>
        <p
          className={`text-3xl font-bold tracking-tight mb-1 ${
            highlight === "success"
              ? "text-success"
              : highlight === "destructive"
              ? "text-destructive"
              : "text-foreground"
          }`}
        >
          {value}
        </p>
        {sub && <p className="text-sm text-muted-foreground/70 font-medium">{sub}</p>}
        {onClick && (
          <p className="text-[10px] uppercase tracking-wider text-primary/70 mt-2 font-medium">
            Clique para detalhar →
          </p>
        )}
      </div>
    </Component>
  );
}


// ============== Tabela detalhada de lançamentos ==============
function DespesasTable({
  despesas,
  filtro,
  filtroOrigem,
}: {
  despesas: DespesaUnificada[];
  filtro: string;
  filtroOrigem: "todos" | "conciliacao" | "direto";
}) {
  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
  const fmtDate = (s?: string | null) =>
    s ? new Date(s).toLocaleDateString("pt-BR") : "—";

  const lista = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return [...despesas]
      .filter((d) => filtroOrigem === "todos" || d.origem === filtroOrigem)
      .filter((d) => {
        if (!q) return true;
        return (
          d.descricao?.toLowerCase().includes(q) ||
          (d.fornecedor || "").toLowerCase().includes(q) ||
          (d.numero_doc || "").toLowerCase().includes(q) ||
          (d.numero_nf || "").toLowerCase().includes(q) ||
          (d.numero_boleto || "").toLowerCase().includes(q) ||
          (d.pago_por || "").toLowerCase().includes(q) ||
          (d.categoria || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
  }, [despesas, filtro, filtroOrigem]);

  if (lista.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhum lançamento encontrado com os filtros atuais.
      </p>
    );
  }

  return (
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
            <TableHead>Pago por</TableHead>
            <TableHead>Forma</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Anexos</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lista.map((d) => {
            const anexos = [
              { url: d.comprovante_url, label: "Comprovante" },
              { url: d.recibo_url, label: "Recibo" },
              { url: d.nf_url, label: "NF" },
              { url: d.boleto_url, label: "Boleto" },
            ].filter((a) => !!a.url);

            return (
              <TableRow key={d.id}>
                <TableCell className="text-xs">{fmtDate(d.data_vencimento)}</TableCell>
                <TableCell className="text-xs">{fmtDate(d.data_pagamento)}</TableCell>
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
                <TableCell className="text-xs text-muted-foreground">{d.categoria || "—"}</TableCell>
                <TableCell className="text-xs">{d.fornecedor || "—"}</TableCell>
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
                <TableCell className="text-xs">{d.forma_pagamento || "—"}</TableCell>
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
                  {fmtBRL(d.valor_total)}
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
        {lista.length} lançamento(s) · Total: {fmtBRL(lista.reduce((a, d) => a + d.valor_total, 0))}
      </p>
    </div>
  );
}

// ============== Drill-down modal dos cards ==============
function DrillDownModal({
  tipo,
  onClose,
  despesas,
  abastecimentos,
  aeronaveLabel,
}: {
  tipo: null | "total" | "share" | "direto" | "abast";
  onClose: () => void;
  despesas: DespesaUnificada[];
  abastecimentos: any[];
  aeronaveLabel: string;
}) {
  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
  const fmtDate = (s?: string | null) =>
    s ? new Date(s).toLocaleDateString("pt-BR") : "—";

  if (!tipo) return null;

  const titulo =
    tipo === "total"
      ? "Composição: Total de despesas"
      : tipo === "share"
      ? "Composição: Pago pela Share Brasil"
      : tipo === "direto"
      ? "Composição: Pago diretamente pelo cliente/sócio"
      : "Composição: Abastecimentos";

  const explicacao =
    tipo === "total"
      ? "Soma de TODAS as despesas vinculadas a esta aeronave (independente de quem pagou)."
      : tipo === "share"
      ? "Despesas que a Share Brasil quitou do caixa da empresa. Geram crédito a reembolsar pelo cliente."
      : tipo === "direto"
      ? "Despesas pagas direto do bolso do cliente ou do sócio (sem passar pelo caixa da Share)."
      : "Abastecimentos lançados separadamente do fluxo de despesas administrativas.";

  let listaDespesas: DespesaUnificada[] = [];
  if (tipo === "total") listaDespesas = despesas;
  else if (tipo === "share") listaDespesas = despesas.filter((d) => d.origem === "conciliacao");
  else if (tipo === "direto") listaDespesas = despesas.filter((d) => d.origem === "direto");

  const total =
    tipo === "abast"
      ? abastecimentos.reduce((a, x) => a + (x.valor_total || 0), 0)
      : listaDespesas.reduce((a, d) => a + d.valor_rateado, 0);

  // Agrupar por categoria
  const porCategoria = new Map<string, number>();
  listaDespesas.forEach((d) => {
    const k = d.categoria || "Sem categoria";
    porCategoria.set(k, (porCategoria.get(k) || 0) + d.valor_rateado);
  });

  return (
    <Card className="mt-6 border-primary/20 bg-muted/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-2xl">{titulo}</CardTitle>
            <p className="text-base text-muted-foreground mt-2">
              {explicacao} Aeronave: <strong>{aeronaveLabel}</strong>.
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-3xl font-mono text-primary font-bold">{fmtBRL(total)}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {tipo !== "abast" && porCategoria.size > 0 && (
          <div className="mb-6">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              Por categoria
            </h4>
            <div className="flex flex-wrap gap-2">
              {Array.from(porCategoria.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([cat, val]) => (
                  <Badge key={cat} variant="outline" className="text-sm py-2 px-4">
                    {cat}: <span className="ml-1 font-mono font-semibold text-base">{fmtBRL(val)}</span>
                  </Badge>
                ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto border rounded-lg">
          {tipo !== "abast" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Data</TableHead>
                  <TableHead className="text-base">Doc</TableHead>
                  <TableHead className="text-base">Descrição</TableHead>
                  <TableHead className="text-base">Fornecedor</TableHead>
                  <TableHead className="text-base">Pago por</TableHead>
                  <TableHead className="text-right text-base">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listaDespesas
                  .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime())
                  .map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm">{fmtDate(d.data)}</TableCell>
                      <TableCell className="text-sm font-mono">
                        {d.numero_nf || d.numero_doc || "—"}
                      </TableCell>
                      <TableCell className="text-base">{d.descricao}</TableCell>
                      <TableCell className="text-sm">{d.fornecedor || "—"}</TableCell>
                      <TableCell className="text-sm">{d.pago_por}</TableCell>
                      <TableCell className="text-right font-mono text-base font-semibold">
                        {fmtBRL(d.valor_rateado)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Data</TableHead>
                  <TableHead className="text-base">Local</TableHead>
                  <TableHead className="text-base">Abastecedor</TableHead>
                  <TableHead className="text-right text-base">Litros</TableHead>
                  <TableHead className="text-right text-base">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abastecimentos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{fmtDate(a.data)}</TableCell>
                    <TableCell className="text-base">{a.trecho || a.local || "—"}</TableCell>
                    <TableCell className="text-sm">{a.abastecedor || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(a.litros).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-base font-semibold">
                      {fmtBRL(a.valor_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
