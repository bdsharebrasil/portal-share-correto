import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardList,
  Package,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface PurchaseRequest {
  id: string;
  numero_solicitacao: string;
  tipo: string;
  tipo_de_servico: string | null;
  descricao: string;
  observacoes: string | null;
  user_id: string;
  solicitante_nome: string | null;
  departamento: string | null;
  centro_custo: string | null;
  data_solicitacao: string | null;
  data_necessaria: string | null;
  priority: string | null;
  status: string;
}

interface PurchaseRequestItem {
  id: string;
  purchase_request_id: string;
  quantidade: number;
  valor_unitario: number;
  codigo_fornecedor?: string | null;
}

const statusOptions = [
  { value: "todos", label: "Todos" },
  { value: "analise", label: "Em análise" },
  { value: "aprovado", label: "Aprovadas" },
  { value: "reprovado", label: "Rejeitadas" },
  { value: "rascunho", label: "Rascunhos" },
] as const;

type StatusFilter = (typeof statusOptions)[number]["value"];

const statusStyles: Record<string, { label: string; className: string }> = {
  rascunho: {
    label: "Rascunho",
    className: "border-slate-500/35 bg-slate-400/10 text-muted-foreground",
  },
  enviado: {
    label: "Em análise",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  em_analise: {
    label: "Em análise",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  aprovado: {
    label: "Concluída",
    className: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  },
  reprovado: {
    label: "Rejeitada",
    className: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  },
  cancelado: {
    label: "Cancelada",
    className: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  },
  entregue: {
    label: "Concluída",
    className: "border-teal-400/30 bg-teal-400/10 text-teal-300",
  },
};

const priorityStyles: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "border-slate-500/35 bg-slate-400/10 text-muted-foreground" },
  normal: { label: "Normal", className: "border-teal-400/25 bg-teal-400/10 text-teal-300" },
  media: { label: "Normal", className: "border-teal-400/25 bg-teal-400/10 text-teal-300" },
  alta: { label: "Alta", className: "border-orange-400/30 bg-orange-400/10 text-orange-300" },
  urgente: { label: "Urgente", className: "border-orange-400/30 bg-orange-400/10 text-orange-300" },
};

const compactInputClass =
  "h-10 rounded-md border-[#223252] bg-[#0b1428] px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-teal-400/70 focus-visible:ring-teal-400/20";

const extractAircraft = (observacoes: string | null) => {
  const match = observacoes?.match(/^\[Aeronave: (.+?)\]/);
  return match?.[1] ?? "—";
};

const formatRequestDate = (date: string | null) => {
  if (!date) return "—";
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? "—"
    : format(parsedDate, "dd/MM/yyyy", { locale: ptBR });
};

export default function SolicitacaoCompras() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [requestItems, setRequestItems] = useState<PurchaseRequestItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const [tipo, setTipo] = useState<"compra" | "servico">("compra");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [aeronave, setAeronave] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [unidade, setUnidade] = useState("UN");
  const [valorEstimado, setValorEstimado] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [dataNecessaria, setDataNecessaria] = useState("");
  const [tipoDeServico, setTipoDeServico] = useState("");
  const [detalhes, setDetalhes] = useState("");

  useEffect(() => {
    void loadCurrentUser();
    void loadRequests();
  }, []);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    setCurrentUserName(profile?.full_name || user.email || "");
  };

  const loadRequests = async () => {
    const [{ data: requestData, error }, { data: itemData }] = await Promise.all([
      supabase
        .from("purchase_requests")
        .select("*")
        .order("data_solicitacao", { ascending: false }),
      supabase.from("purchase_request_items").select("id, purchase_request_id, quantidade, valor_unitario"),
    ]);

    if (error) {
      toast({
        title: "Erro ao carregar solicitações",
        description: "Não foi possível consultar as solicitações de compra.",
        variant: "destructive",
      });
      return;
    }

    setRequests((requestData || []) as PurchaseRequest[]);
    setRequestItems((itemData || []) as PurchaseRequestItem[]);
  };

  const itemSummaryByRequest = useMemo(() => {
    return requestItems.reduce<Record<string, { quantity: number; total: number }>>((summary, item) => {
      const current = summary[item.purchase_request_id] || { quantity: 0, total: 0 };
      current.quantity += Number(item.quantidade || 0);
      current.total += Number(item.quantidade || 0) * Number(item.valor_unitario || 0);
      summary[item.purchase_request_id] = current;
      return summary;
    }, {});
  }, [requestItems]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch = !normalizedSearch || [
        request.numero_solicitacao,
        request.descricao,
        request.departamento || "",
        request.solicitante_nome || "",
      ].some((value) => value.toLowerCase().includes(normalizedSearch));

      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "analise" && ["enviado", "em_analise"].includes(request.status)) ||
        (statusFilter === "aprovado" && ["aprovado", "entregue"].includes(request.status)) ||
        (statusFilter === "reprovado" && ["reprovado", "cancelado"].includes(request.status)) ||
        (statusFilter === "rascunho" && request.status === "rascunho");

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const statusCount = (filter: StatusFilter) => {
    if (filter === "todos") return requests.length;
    if (filter === "analise") return requests.filter((request) => ["enviado", "em_analise"].includes(request.status)).length;
    if (filter === "aprovado") return requests.filter((request) => ["aprovado", "entregue"].includes(request.status)).length;
    if (filter === "reprovado") return requests.filter((request) => ["reprovado", "cancelado"].includes(request.status)).length;
    return requests.filter((request) => request.status === "rascunho").length;
  };

  const resetForm = () => {
    setTipo("compra");
    setDescricao("");
    setCategoria("");
    setAeronave("");
    setFornecedor("");
    setQuantidade("1");
    setUnidade("UN");
    setValorEstimado("");
    setPrioridade("normal");
    setDataNecessaria("");
    setTipoDeServico("");
    setDetalhes("");
  };

  const closeForm = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const submitRequest = async (status: "rascunho" | "em_analise") => {
    if (!currentUserId || !currentUserName) {
      toast({
        title: "Usuário não autenticado",
        description: "Entre novamente para enviar uma solicitação.",
        variant: "destructive",
      });
      return;
    }

    if (!descricao.trim()) {
      toast({ title: "Informe o item ou serviço", variant: "destructive" });
      return;
    }

    if (tipo === "servico" && !tipoDeServico) {
      toast({ title: "Selecione o tipo de serviço", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const numeroSolicitacao = `SOL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const aircraftNote = aeronave.trim() ? `[Aeronave: ${aeronave.trim()}]` : "";
      const observacoes = [aircraftNote, detalhes.trim()].filter(Boolean).join("\n\n") || null;
      const { data: request, error } = await supabase
        .from("purchase_requests")
        .insert({
          numero_solicitacao: numeroSolicitacao,
          tipo,
          tipo_de_servico: tipo === "servico" ? tipoDeServico || null : null,
          descricao: descricao.trim(),
          user_id: currentUserId,
          solicitante_nome: currentUserName,
          departamento: categoria.trim() || null,
          observacoes,
          priority: prioridade,
          data_necessaria: dataNecessaria || null,
          status,
        })
        .select("id")
        .single();

      if (error) throw error;

      const itemError = await supabase.from("purchase_request_items").insert({
        purchase_request_id: request.id,
        numero_item: 1,
        descricao: descricao.trim(),
        quantidade: Number(quantidade) || 1,
        unidade: unidade.trim().toUpperCase() || "UN",
        valor_unitario: Number(valorEstimado) || 0,
        especificacoes: detalhes.trim() || null,
        codigo_fornecedor: fornecedor.trim() || null,
      });

      if (itemError.error) throw itemError.error;

      toast({
        title: status === "rascunho" ? "Rascunho salvo" : "Solicitação enviada",
        description: status === "rascunho"
          ? "Você pode continuar a edição quando quiser."
          : "A área de suprimentos foi notificada para análise.",
      });
      closeForm();
      await loadRequests();
    } catch (error) {
      toast({
        title: "Não foi possível salvar a solicitação",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isFormOpen) {
    return (
      <Layout>
        <div className="min-h-full bg-[#080f20] px-3 py-4 text-foreground md:px-6 md:py-6">
          <div className="mx-auto max-w-5xl">
            <header className="mb-5 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeForm}
                  className="mt-1 h-8 w-8 shrink-0 rounded-md border border-[#243452] bg-[#101a31] text-muted-foreground hover:bg-[#17233d] hover:text-foreground"
                  aria-label="Voltar para solicitações"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 border-l-2 border-teal-400 pl-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Suprimentos · nova solicitação
                  </p>
                  <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-50 md:text-2xl">
                    Abrir pedido de compra ou serviço
                  </h1>
                </div>
              </div>
              <Badge className="shrink-0 border border-[#2a4260] bg-[#13243e] px-2 py-1 text-[10px] font-medium text-muted-foreground">
                Rascunho não salvo
              </Badge>
            </header>

            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#1c2a45] bg-[#0c1528] px-4 py-3 text-xs text-muted-foreground">
              <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
              <p>
                Após o envio, a solicitação entra em <span className="font-semibold text-teal-300">análise</span> pela área de suprimentos. Pedidos acima de R$ 50.000 exigem aprovação da diretoria.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitRequest("em_analise");
              }}
              className="overflow-hidden rounded-xl border border-[#233452] bg-[#0d172b] shadow-[0_18px_60px_rgba(0,0,0,0.2)]"
            >
              <div className="border-b border-[#1e2c47] px-4 py-4 md:px-5">
                <div className="border-l-2 border-teal-400 pl-3">
                  <h2 className="text-sm font-semibold text-foreground">Dados da solicitação</h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">Informe o que precisa ser comprado ou contratado</p>
                </div>
              </div>

              <div className="space-y-5 px-4 py-5 md:px-5">
                <div>
                  <Label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tipo de solicitação</Label>
                  <div className="grid max-w-md grid-cols-2 gap-2 rounded-lg bg-[#101a30] p-1">
                    <button
                      type="button"
                      onClick={() => setTipo("compra")}
                      className={`flex h-9 items-center justify-center gap-2 rounded-md border text-xs font-semibold transition-colors ${
                        tipo === "compra"
                          ? "border-teal-400/50 bg-teal-400/10 text-teal-300"
                          : "border-transparent text-muted-foreground hover:bg-[#17233d] hover:text-foreground"
                      }`}
                    >
                      <Package className="h-3.5 w-3.5" /> Compra
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipo("servico")}
                      className={`flex h-9 items-center justify-center gap-2 rounded-md border text-xs font-semibold transition-colors ${
                        tipo === "servico"
                          ? "border-teal-400/50 bg-teal-400/10 text-teal-300"
                          : "border-transparent text-muted-foreground hover:bg-[#17233d] hover:text-foreground"
                      }`}
                    >
                      <Wrench className="h-3.5 w-3.5" /> Serviço
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="item-ou-servico" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Item ou serviço</Label>
                  <Input
                    id="item-ou-servico"
                    value={descricao}
                    onChange={(event) => setDescricao(event.target.value)}
                    placeholder={tipo === "compra" ? "Ex.: Mercado - produtos de limpeza" : "Ex.: Revisão do ar condicionado"}
                    className={compactInputClass}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="categoria" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Categoria</Label>
                    <Input
                      id="categoria"
                      value={categoria}
                      onChange={(event) => setCategoria(event.target.value)}
                      placeholder="MERCADO"
                      className={compactInputClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="aeronave" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Aeronave</Label>
                    <Input
                      id="aeronave"
                      value={aeronave}
                      onChange={(event) => setAeronave(event.target.value)}
                      placeholder=""
                      className={compactInputClass}
                    />
                  </div>
                </div>

                {tipo === "servico" && (
                  <div>
                    <Label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Tipo de serviço</Label>
                    <Select value={tipoDeServico} onValueChange={setTipoDeServico}>
                      <SelectTrigger className="!my-0 border-[#223252] bg-[#0b1428] text-sm text-foreground">
                        <SelectValue placeholder="Selecione o tipo de serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manutencao_infraestrutura">Manutenção e infraestrutura</SelectItem>
                        <SelectItem value="servicos_tecnicos">Serviços técnicos</SelectItem>
                        <SelectItem value="limpeza_conservacao">Limpeza e conservação</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="fornecedor" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Fornecedor sugerido</Label>
                  <Input
                    id="fornecedor"
                    value={fornecedor}
                    onChange={(event) => setFornecedor(event.target.value)}
                    placeholder="Ex.: AeroParts do Brasil"
                    className={compactInputClass}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor="quantidade" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Quantidade</Label>
                    <Input id="quantidade" type="number" min="1" value={quantidade} onChange={(event) => setQuantidade(event.target.value)} className={compactInputClass} />
                  </div>
                  <div>
                    <Label htmlFor="unidade" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Unidade</Label>
                    <Input id="unidade" value={unidade} onChange={(event) => setUnidade(event.target.value)} className={compactInputClass} />
                  </div>
                  <div>
                    <Label htmlFor="valor" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Valor estimado</Label>
                    <Input id="valor" type="number" min="0" step="0.01" value={valorEstimado} onChange={(event) => setValorEstimado(event.target.value)} placeholder="0,00" className={compactInputClass} />
                  </div>
                  <div>
                    <Label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Prioridade</Label>
                    <Select value={prioridade} onValueChange={setPrioridade}>
                      <SelectTrigger className="!my-0 border-[#223252] bg-[#0b1428] text-sm text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
                  <div>
                    <Label htmlFor="necessidade" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Data de necessidade</Label>
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="necessidade" type="date" value={dataNecessaria} onChange={(event) => setDataNecessaria(event.target.value)} className={`${compactInputClass} pl-10`} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="detalhes" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Observações</Label>
                    <Textarea id="detalhes" value={detalhes} onChange={(event) => setDetalhes(event.target.value)} placeholder="Especificações ou instruções adicionais" className="min-h-10 resize-y border-[#223252] bg-[#0b1428] text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-teal-400/70 focus-visible:ring-teal-400/20" />
                  </div>
                </div>
              </div>

              <footer className="flex flex-col-reverse gap-2 border-t border-[#1e2c47] bg-[#0b1425] px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
                <Button type="button" variant="ghost" onClick={closeForm} className="text-muted-foreground hover:bg-[#17233d] hover:text-foreground">Cancelar</Button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="outline" disabled={loading} onClick={() => void submitRequest("rascunho")} className="border-[#2a4260] bg-[#101b31] text-foreground hover:bg-[#172942] hover:text-slate-50">
                    Salvar rascunho
                  </Button>
                  <Button type="submit" disabled={loading} className="bg-teal-400 px-5 font-semibold text-[#06201f] hover:bg-teal-300">
                    <Send className="h-4 w-4" /> {loading ? "Enviando..." : "Enviar solicitação"}
                  </Button>
                </div>
              </footer>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-full bg-[#080f20] px-3 py-4 text-foreground md:px-6 md:py-6">
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex flex-col gap-4 border-b border-[#1d2a44] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="border-l-2 border-teal-400 pl-3">
              <h1 className="text-xl font-semibold tracking-tight text-slate-50 md:text-2xl">Solicitações realizadas</h1>
              <p className="mt-1 text-xs text-muted-foreground">Acompanhe o andamento de cada pedido de compra ou serviço</p>
            </div>
            <Button onClick={() => setIsFormOpen(true)} className="bg-teal-400 px-4 text-xs font-semibold text-[#06201f] hover:bg-teal-300">
              <Plus className="h-4 w-4" /> Nova solicitação
            </Button>
          </header>

          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nº, item, aeronave..." className={`${compactInputClass} pl-9`} />
            </div>
            <div className="flex w-full items-center gap-1 overflow-x-auto rounded-lg border border-[#1d2b46] bg-[#0d172b] p-1 lg:w-auto">
              {statusOptions.map((option) => {
                const active = statusFilter === option.value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setStatusFilter(option.value)}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-[10px] font-semibold transition-colors ${
                      active ? "bg-[#1d344b] text-slate-50 shadow-sm" : "text-muted-foreground hover:bg-[#14213a] hover:text-foreground"
                    }`}
                  >
                    {option.label} <span className="ml-1 text-[9px] text-muted-foreground">{statusCount(option.value)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#1d2a45] bg-[#0c1528]">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left">
                <thead className="border-b border-[#1e2d48] bg-[#0b1426]">
                  <tr className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="px-4 py-3">Nº / tipo</th>
                    <th className="px-4 py-3">Item ou serviço</th>
                    <th className="px-4 py-3">Aeronave</th>
                    <th className="px-4 py-3 text-center">Qtd.</th>
                    <th className="px-4 py-3">Valor estimado</th>
                    <th className="px-4 py-3">Prioridade</th>
                    <th className="px-4 py-3">Necessidade</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => {
                    const itemSummary = itemSummaryByRequest[request.id];
                    const status = statusStyles[request.status] || { label: request.status, className: "border-slate-500/35 bg-slate-400/10 text-muted-foreground" };
                    const priority = priorityStyles[request.priority || "normal"] || priorityStyles.normal;
                    const isService = request.tipo === "servico";

                    return (
                      <tr key={request.id} className="border-b border-[#17243c] last:border-0 transition-colors hover:bg-[#101c33]">
                        <td className="px-4 py-3 align-top">
                          <p className="font-mono text-[11px] font-semibold text-muted-foreground">{request.numero_solicitacao}</p>
                          <p className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">
                            {isService ? <Wrench className="h-2.5 w-2.5" /> : <ShoppingBag className="h-2.5 w-2.5" />}
                            {isService ? "Serviço" : "Compra"}
                          </p>
                        </td>
                        <td className="max-w-[260px] px-4 py-3 align-top">
                          <p className="truncate text-[11px] font-semibold text-foreground">{request.descricao}</p>
                          <p className="mt-1 truncate text-[9px] text-muted-foreground">{request.departamento || request.tipo_de_servico || "Sem categoria"}</p>
                        </td>
                        <td className="px-4 py-3 align-top text-[10px] text-muted-foreground">{extractAircraft(request.observacoes)}</td>
                        <td className="px-4 py-3 text-center align-top text-[10px] font-medium text-muted-foreground">{itemSummary?.quantity || "—"}</td>
                        <td className="px-4 py-3 align-top text-[10px] font-semibold text-foreground">
                          {itemSummary?.total ? itemSummary.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge className={`border px-2 py-0.5 text-[9px] font-medium ${priority.className}`}>{priority.label}</Badge>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="text-[10px] text-muted-foreground">{formatRequestDate(request.data_necessaria)}</p>
                          <p className="mt-1 text-[9px] text-muted-foreground">Aberta em {formatRequestDate(request.data_solicitacao)}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge className={`border px-2 py-0.5 text-[9px] font-medium ${status.className}`}>{status.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredRequests.length === 0 && (
              <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                <ClipboardList className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">Nenhuma solicitação encontrada</p>
                <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou abra uma nova solicitação.</p>
                <Button onClick={() => setIsFormOpen(true)} variant="outline" className="mt-4 border-[#2a4260] bg-[#101b31] text-foreground hover:bg-[#172942] hover:text-slate-50">
                  <Plus className="h-4 w-4" /> Nova solicitação
                </Button>
              </div>
            )}
          </div>

          <p className="mt-3 text-right text-[10px] text-muted-foreground">{filteredRequests.length} {filteredRequests.length === 1 ? "solicitação exibida" : "solicitações exibidas"}</p>
        </div>
      </div>
    </Layout>
  );
}