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
          </div>
        </Tabs>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: "success" | "destructive";
}) {
  return (
    <div className="group relative p-6 rounded-3xl bg-gradient-to-b from-card/60 to-card/20 backdrop-blur-md border border-border/40 hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
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
      </div>
    </div>
  );
}
