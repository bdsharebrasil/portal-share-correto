import { Layout } from "@/components/layout/Layout";
import { useNavigate, useParams, useLocation } from "react-router-dom";
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
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import { GerenciarAcessoPortal } from "./GerenciarAcessoPortal";
import { LancamentosTab } from "./LancamentosTab";
import { FechamentoBalancoTab } from "./FechamentoBalancoTab";
import { HistoricoCreditsTab } from "./HistoricoCreditsTab";
import { MatrizFinanceiraMensal } from "./MatrizFinanceiraMensal";
import { RateioCotistas } from "./RateioCotistas";
import { AbastecimentosTab } from "./AbastecimentosTab";
import { TabelaFinanceiraTab } from "./TabelaFinanceiraTab";
import { DiarioBordoCotistaTab } from "./DiarioBordoCotistaTab";
import { RelatoriosViagemTab } from "./RelatoriosViagemTab";
import LancamentoForm from "./LancamentoForm";
import EntradaForm from "./EntradaForm";
import { FluxoSelecionModal } from "./FluxoSelecionModal";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
  const location = useLocation();
  const { data, isLoading } = useFinanceiroCotistaDetalhe(clienteId);
  const [aeronaveSelecionada, setAeronaveSelecionada] = useState<string>("");
  const [socioSelecionado, setSocioSelecionado] = useState<string | undefined>();
  const [drillCard, setDrillCard] = useState<null | "total" | "share" | "direto" | "abast">(null);
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<DespesaUnificada | null>(null);
  const [acaoModal, setAcaoModal] = useState<"editar" | "deletar" | "novo" | null>(null);
  const [fluxoSelecionado, setFluxoSelecionado] = useState<"entrada" | "saida" | null | "escolher">("escolher");

  const cliente = data?.cliente;
  const aeronaves = data?.aeronaves || [];
  const despesas = data?.despesas || [];
  const cotistasPorAeronave = data?.cotistasPorAeronave || [];
  const abastecimentos = data?.abastecimentos || [];
  const relatorios = data?.relatorios || [];
  const rateioDespesasComTodosCotistasDetalhado = data?.rateioDespesasComTodosCotistasDetalhado || [];

  const aeronaveAtual =
    aeronaveSelecionada || (aeronaves[0] as any)?.id_aeronave || "";

  const aeronaveInfo = (aeronaves as any[]).find(
    (a) => a.id_aeronave === aeronaveAtual
  )?.aeronave;

  const cotistasDaAeronave = useMemo(
    () => {
      // Primeiro, obter cotistas de cotistas_aeronave
      const cotistasDeAeronave = cotistasPorAeronave
        .filter((c: any) => c.id_aeronave === aeronaveAtual)
        .map((c: any) => ({
          id: c.socios_id || c.id_clientes,
          nome:
            c.socio?.nome ||
            c.cliente?.razao_social ||
            c.cliente?.proprietario ||
            "Cotista",
          percentual: Number(c.percentual_sociedade) || 0,
        }));

      // Se não houver cotistas em cotistas_aeronave, extrair de rateio_despesas
      if (cotistasDeAeronave.length === 0) {
        const cotistasDoRateio = new Map<string, { id: string; nome: string; percentual: number }>();

        rateioDespesasComTodosCotistasDetalhado.forEach((despesa: any) => {
          despesa.rateios?.forEach((r: any) => {
            // Usar socio_id se disponível (cotista/sócio), caso contrário usar cliente_id
            const cotista_id = r.socio_id || r.cliente_id;
            const cotista_nome = r.socios_nome || r.clientes_nome || "Cotista";

            if (cotista_id && !cotistasDoRateio.has(cotista_id)) {
              cotistasDoRateio.set(cotista_id, {
                id: cotista_id,
                nome: cotista_nome,
                percentual: Number(r.percentual_sociedade) || 0,
              });
            }
          });
        });

        return Array.from(cotistasDoRateio.values());
      }

      return cotistasDeAeronave;
    },
    [cotistasPorAeronave, aeronaveAtual, rateioDespesasComTodosCotistasDetalhado]
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

            <TabsTrigger value="diario" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-800 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-600 transition-all border-2 border-transparent data-[state=active]:border-cyan-500/20">
              <Plane className="h-4 w-4 mr-2 text-cyan-500" />
              Diário de Bordo
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-800 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-600 transition-all">Financeiro</TabsTrigger>
            <TabsTrigger value="viagem" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-800 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-600 transition-all">Relatórios Viagem</TabsTrigger>
            <TabsTrigger value="abast" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-800 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-600 transition-all">Abastecimentos</TabsTrigger>
            <TabsTrigger value="balanco" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-slate-800 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-600 transition-all">Fechamento de Balanço</TabsTrigger>
            <TabsTrigger value="creditos" className="rounded-xl px-4 py-2.5 flex items-center gap-2 data-[state=active]:bg-slate-800 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-600 transition-all">
              <Wallet className="h-4 w-4 text-primary/70" />
              Histórico de Créditos
            </TabsTrigger>
            <TabsTrigger value="portal" className="rounded-xl px-4 py-2.5 flex items-center gap-2 data-[state=active]:bg-slate-800 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-slate-600 transition-all ml-auto">
              <KeyRound className="h-4 w-4 text-primary/70" />
              <span>Acesso Portal</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            {/* Visão Geral */}
            <TabsContent value="visao" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {aeronaveAtual ? (
                <>
                  <MatrizFinanceiraMensal
                    aeronaveId={aeronaveAtual}
                    matricula={aeronaveInfo?.matricula}
                  />
                  <RateioCotistas
                    aeronaveId={aeronaveAtual}
                    matricula={aeronaveInfo?.matricula}
                    cotistas={cotistasDaAeronave}
                  />
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Selecione uma aeronave para visualizar a matriz financeira.
                </div>
              )}
            </TabsContent>



            {/* Diário de Bordo */}
            <TabsContent value="diario" className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <DiarioBordoCotistaTab
                clienteId={clienteId!}
                aeronaveId={aeronaveAtual}
                relatorios={relatoriosDaAeronave}
              />
            </TabsContent>

            {/* Financeiro */}
            <TabsContent value="financeiro" className="space-y-4 mt-4">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-lg font-semibold text-foreground">Gestão Financeira</h3>
                <Button
                  onClick={() => setFluxoSelecionado("escolher")}
                  className="gap-2 rounded-xl"
                >
                  <FileText className="h-4 w-4" />
                  Novo Lançamento
                </Button>
              </div>
              <TabelaFinanceiraTab
                despesas={despesasDaAeronave}
                cotistas={cotistasDaAeronave}
                aeronaveLabel={aeronaveInfo?.matricula}
              />
            </TabsContent>

            {/* Relatórios de Viagem */}
            <TabsContent value="viagem" className="mt-4">
              <RelatoriosViagemTab
                relatorios={relatoriosDaAeronave}
                cotistas={cotistasDaAeronave}
                aeronaveLabel={aeronaveInfo?.matricula}
                onOpen={() => navigate(`/financeiro/relatorios-cliente/${clienteId}`)}
              />
            </TabsContent>

            {/* Abastecimentos */}
            <TabsContent value="abast" className="space-y-4 mt-4">
              <AbastecimentosTab
                abastecimentos={abastecimentosDaAeronave}
                cotistas={cotistasDaAeronave}
                aeronaveLabel={aeronaveInfo?.matricula}
              />
            </TabsContent>

            {/* Fechamento de Balanço */}
            <TabsContent value="balanco" className="mt-4">
              <FechamentoBalancoTab
                aeronaveId={aeronaveAtual}
                aeronaveLabel={aeronaveInfo?.matricula}
                cotistas={cotistasDaAeronave}
                clienteEmFoco={clienteId}
                clienteId={clienteId}
                abastecimentos={abastecimentosDaAeronave}
                relatorios={relatoriosDaAeronave}
              />
            </TabsContent>

            {/* Histórico de Créditos */}
            <TabsContent value="creditos" className="mt-4">
              <HistoricoCreditsTab
                clienteId={clienteId}
                socioId={socioSelecionado}
                aeronaveId={aeronaveAtual}
                onSocioChange={setSocioSelecionado}
                cotistas={cotistasDaAeronave}
              />
            </TabsContent>

            {/* Acesso ao Portal */}
            <TabsContent value="portal" className="mt-4">
              <GerenciarAcessoPortal clienteId={clienteId!} />
            </TabsContent>
          </div>
        </Tabs>

        {/* Drill-down dos cards do topo */}
        <DrillDownModal
          tipo={drillCard}
          onClose={() => setDrillCard(null)}
          despesas={despesasDaAeronave}
          abastecimentos={abastecimentosDaAeronave}
          aeronaveLabel={aeronaveInfo?.matricula || "—"}
        />

        {/* Modal de Seleção de Fluxo */}
        <FluxoSelecionModal
          open={fluxoSelecionado === "escolher"}
          onSelect={(fluxo) => {
            setFluxoSelecionado(fluxo);
            setAcaoModal("novo");
          }}
        />

        {/* Modal de Novo Lançamento - SAÍDA */}
        <Dialog
          open={acaoModal === "novo" && fluxoSelecionado === "saida"}
          onOpenChange={(open) => {
            if (!open) {
              setAcaoModal(null);
              setFluxoSelecionado("escolher");
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Lançamento - Saída</DialogTitle>
              <DialogDescription>
                Crie um novo lançamento de saída para {cliente?.razao_social}
              </DialogDescription>
            </DialogHeader>
            {aeronaveAtual && cliente && (
              <LancamentoForm
                clienteId={clienteId!}
                clienteNome={cliente.razao_social || cliente.cnpj || "Cliente"}
                aeronaveId={aeronaveAtual}
                aeronaveRegistro={aeronaveInfo?.matricula || ""}
                socios={cotistasDaAeronave}
                editing={null}
                onCancel={() => {
                  setAcaoModal(null);
                  setFluxoSelecionado("escolher");
                }}
                onSaved={() => {
                  setAcaoModal(null);
                  setFluxoSelecionado("escolher");
                }}
                isModal={true}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Novo Lançamento - ENTRADA */}
        <Dialog
          open={acaoModal === "novo" && fluxoSelecionado === "entrada"}
          onOpenChange={(open) => {
            if (!open) {
              setAcaoModal(null);
              setFluxoSelecionado("escolher");
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Entrada</DialogTitle>
              <DialogDescription>
                Registre uma entrada de caixa para {cliente?.razao_social}
              </DialogDescription>
            </DialogHeader>
            {cliente && (
              <EntradaForm
                clienteId={clienteId!}
                clienteNome={cliente.razao_social || cliente.cnpj || "Cliente"}
                socios={cotistasDaAeronave}
                isModal={true}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Ação (Editar/Deletar) */}
        <LancamentoAcaoModal
          lancamento={lancamentoSelecionado}
          acao={acaoModal}
          onAcao={(acao) => setAcaoModal(acao)}
          onClose={() => {
            setLancamentoSelecionado(null);
            setAcaoModal(null);
          }}
          onVoltarEscolha={() => setAcaoModal(null)}
          onEditarClick={() => {
            if (lancamentoSelecionado) {
              navigate(
                `/financeiro/lancamento/${clienteId}/${aeronaveAtual}?editing=${lancamentoSelecionado.id}`,
                { state: { despesaPrefill: lancamentoSelecionado } }
              );
              setLancamentoSelecionado(null);
              setAcaoModal(null);
            }
          }}
          onDeletarConfirm={() => {
            // será implementado no componente
          }}
        />

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
      : listaDespesas.reduce((a, d) => a + d.valor_total, 0);

  // Agrupar por categoria
  const porCategoria = new Map<string, number>();
  listaDespesas.forEach((d) => {
    const k = d.categoria || "Sem categoria";
    porCategoria.set(k, (porCategoria.get(k) || 0) + d.valor_total);
  });

  return (
    <Dialog open={!!tipo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{titulo}</span>
            <span className="text-xl font-mono text-primary">{fmtBRL(total)}</span>
          </DialogTitle>
          <DialogDescription>
            {explicacao} Aeronave: <strong>{aeronaveLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        {tipo !== "abast" && porCategoria.size > 0 && (
          <div className="mb-4">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Por categoria
            </h4>
            <div className="flex flex-wrap gap-2">
              {Array.from(porCategoria.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([cat, val]) => (
                  <Badge key={cat} variant="outline" className="text-xs py-1 px-3">
                    {cat}: <span className="ml-1 font-mono font-semibold">{fmtBRL(val)}</span>
                  </Badge>
                ))}
            </div>
          </div>
        )}

        {tipo !== "abast" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Doc</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Pago por</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listaDespesas
                .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime())
                .map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{fmtDate(d.data)}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {d.numero_nf || d.numero_doc || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{d.descricao}</TableCell>
                    <TableCell className="text-xs">{d.fornecedor || "—"}</TableCell>
                    <TableCell className="text-xs">{d.pago_por}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {fmtBRL(d.valor_total)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Abastecedor</TableHead>
                <TableHead className="text-right">Litros</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {abastecimentos.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{fmtDate(a.data)}</TableCell>
                  <TableCell className="text-sm">{a.trecho || a.local || "—"}</TableCell>
                  <TableCell className="text-xs">{a.abastecedor || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {Number(a.litros).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtBRL(a.valor_total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============== Modal de Edição/Exclusão de Lançamento ==============
function LancamentoAcaoModal({
  lancamento,
  acao,
  onAcao,
  onClose,
  onEditarClick,
  onDeletarConfirm,
  onVoltarEscolha,
}: {
  lancamento: DespesaUnificada | null;
  acao: "editar" | "deletar" | null;
  onAcao: (acao: "editar" | "deletar") => void;
  onClose: () => void;
  onEditarClick: () => void;
  onDeletarConfirm: () => void;
  onVoltarEscolha: () => void;
}) {
  const qc = useQueryClient();
  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(n || 0);
  const fmtDate = (s?: string | null) =>
    s ? new Date(s).toLocaleDateString("pt-BR") : "—";

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("rateio_despesas").delete().eq("id", id);
      const { error } = await supabase.from("movimentacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso");
      qc.invalidateQueries({ queryKey: ["financeiro-cotista-detalhe"] });
      onClose();
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir: " + (error.message || "Erro desconhecido"));
    },
  });

  if (!lancamento) return null;

  const isOpen = !!lancamento;
  const mostrandoEscolha = acao === null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mostrandoEscolha
              ? "O que deseja fazer?"
              : acao === "editar"
              ? "Editar lançamento"
              : "Excluir lançamento"}
          </DialogTitle>
          {!mostrandoEscolha && (
            <DialogDescription>
              {lancamento.descricao} • {fmtBRL(lancamento.valor_total)}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {mostrandoEscolha ? (
            <>
              <p className="text-sm text-muted-foreground">
                Escolha a ação desejada para este lançamento:
              </p>
              <div className="space-y-2">
                <Button
                  onClick={() => onAcao("editar")}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                >
                  <Edit2 className="h-4 w-4" />
                  <div className="text-left">
                    <p className="font-semibold">Editar</p>
                    <p className="text-xs text-muted-foreground">Modificar dados do lançamento</p>
                  </div>
                </Button>
                <Button
                  onClick={() => onAcao("deletar")}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <div className="text-left">
                    <p className="font-semibold">Excluir</p>
                    <p className="text-xs text-muted-foreground">Remover este lançamento</p>
                  </div>
                </Button>
              </div>
            </>
          ) : acao === "editar" ? (
            <>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                    Descrição
                  </p>
                  <p className="font-medium">{lancamento.descricao}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                      Valor
                    </p>
                    <p className="font-mono font-semibold">{fmtBRL(lancamento.valor_total)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                      Data
                    </p>
                    <p className="font-mono">{fmtDate(lancamento.data)}</p>
                  </div>
                </div>
                {lancamento.fornecedor && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                      Fornecedor
                    </p>
                    <p>{lancamento.fornecedor}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">
                  Esta ação é irreversível. O lançamento será removido permanentemente do sistema.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {acao === "editar" ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                }}
              >
                Cancelar
              </Button>
              <Button onClick={onEditarClick} className="gap-2">
                <Edit2 className="h-4 w-4" />
                Abrir para editar
              </Button>
            </>
          ) : acao === "deletar" ? (
            <>
              <Button
                variant="outline"
                onClick={onVoltarEscolha}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteMutation.mutate(lancamento.id);
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Confirmar exclusão"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onClose}
              >
                Fechar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
