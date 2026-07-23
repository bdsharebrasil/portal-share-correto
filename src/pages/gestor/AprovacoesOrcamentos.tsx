import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ArrowRight, Clock, FileText, ShoppingCart, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PurchaseRequestApprovalDetail } from "@/components/aprovacoes/PurchaseRequestApprovalDetail";

type ApprovalItem = {
  id: string;
  type: "budget" | "purchase";
  title: string;
  subtitle?: string;
  date: string;
  total?: number;
  status: string;
};

export default function AprovacoesOrcamentos() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todos" | "budget" | "purchase">("todos");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ["aprovacoes-orcamentos-budgets"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ctm_orcamentos")
        .select("*, aircraft:aeronave(matricula)")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ["aprovacoes-orcamentos-purchases"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("purchase_requests")
        .select("*")
        .in("status", ["enviado", "em_analise"])
        .order("data_solicitacao", { ascending: false });
      return (data || []) as any[];
    },
  });

  const items = useMemo<ApprovalItem[]>(() => {
    const b: ApprovalItem[] = budgets.map((x: any) => ({
      id: x.id,
      type: "budget",
      title: x.descricao || "Orçamento sem descrição",
      subtitle: x.aircraft?.matricula ? `Aeronave ${x.aircraft.matricula}` : undefined,
      date: x.submitted_at || x.criado_em,
      total: Number(x.valor_total) || 0,
      status: x.status,
    }));
    const p: ApprovalItem[] = purchases.map((x: any) => ({
      id: x.id,
      type: "purchase",
      title: `${x.numero_solicitacao || "Solicitação"} — ${x.descricao || ""}`.trim(),
      subtitle: x.solicitante_nome ? `Solicitante: ${x.solicitante_nome}` : undefined,
      date: x.data_solicitacao,
      total: Number(x.valor_total) || 0,
      status: x.status,
    }));
    return [...b, ...p]
      .filter((i) => (tab === "todos" ? true : i.type === tab))
      .filter((i) =>
        search.trim()
          ? (i.title + " " + (i.subtitle || "")).toLowerCase().includes(search.toLowerCase())
          : true
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [budgets, purchases, tab, search]);

  const isLoading = loadingBudgets || loadingPurchases;
  const totalPending = budgets.length + purchases.length;

  const handleOpen = (item: ApprovalItem) => {
    if (item.type === "budget") navigate(`/manutencao/orcamentos?budgetId=${item.id}`);
    else setSelectedPurchaseId(item.id);
  };

  if (selectedPurchaseId) {
    return (
      <main className="flex-1 p-3 md:p-6">
        <PurchaseRequestApprovalDetail
          requestId={selectedPurchaseId}
          onBack={() => setSelectedPurchaseId(null)}
        />
      </main>
    );
  }

  return (
    <main className="flex-1 p-3 md:p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group w-fit"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Voltar</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Aprovações</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Solicitações de compras e orçamentos aguardando sua análise
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1 border-amber-500/30 text-amber-400 bg-amber-500/10 w-fit">
          {totalPending} pendente{totalPending === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="bg-white/[0.02] border-white/[0.05]">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Orçamentos</p>
              <p className="text-2xl font-bold">{budgets.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.02] border-white/[0.05]">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Solicitações de Compra</p>
              <p className="text-2xl font-bold">{purchases.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <ShoppingCart className="h-5 w-5 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/[0.02] border-white/[0.05]">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">Fila de aprovação</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="budget">Orçamentos</TabsTrigger>
              <TabsTrigger value="purchase">Compras</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-0">
              {isLoading ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Carregando...</div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-500/60" />
                  <p>Nenhuma aprovação pendente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleOpen(item)}
                      className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-primary/50 hover:bg-white/[0.04] transition-all cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          {item.subtitle && (
                            <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                          )}
                          {item.date && (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(item.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        {!!item.total && (
                          <p className="text-sm font-semibold text-emerald-400 mt-2">
                            R$ {item.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          className={
                            item.type === "budget"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          }
                        >
                          {item.type === "budget" ? "Orçamento" : "Compra"}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
