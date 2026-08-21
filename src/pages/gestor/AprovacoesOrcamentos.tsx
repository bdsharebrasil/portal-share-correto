import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";

import {
  ArrowLeft,
  ArrowRight,
  Clock,
  FileText,
  ShoppingCart,
  CheckCircle2,
  RefreshCw,
  Search,
  ClipboardCheck,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

import { PurchaseRequestApprovalDetail } from "@/components/aprovacoes/PurchaseRequestApprovalDetail";

import { toast } from "@/hooks/use-toast";

// ============================================================================
// TIPOS
// ============================================================================

type ApprovalType = "budget" | "purchase";
type ApprovalTab = "todos" | ApprovalType;

interface Budget {
  id: string;
  descricao?: string | null;
  valor_total?: number | string | null;
  status?: string | null;
  submetido_em?: string | null;
  criado_em?: string | null;

  aircraft?: {
    matricula?: string | null;
  } | null;
}

interface PurchaseRequest {
  id: string;
  numero_solicitacao?: string | null;
  descricao?: string | null;
  solicitante_nome?: string | null;
  valor_total?: number | string | null;
  status?: string | null;
  data_solicitacao?: string | null;
}

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  subtitle?: string;
  date?: string | null;
  total: number;
  status: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(value: number | string | null | undefined) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "R$ 0,00";
  }

  return numericValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Data não informada";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return format(date, "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AprovacoesOrcamentos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ApprovalTab>("todos");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ==========================================================================
  // ORÇAMENTOS
  // ==========================================================================

  const {
    data: budgets = [],
    isLoading: loadingBudgets,
    isError: errorBudgets,
    refetch: refetchBudgets,
  } = useQuery<Budget[]>({
    queryKey: ["aprovacoes-orcamentos-budgets"],

    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ctm_orcamentos")
        .select(`
          id,
          descricao,
          valor_total,
          status,
          submetido_em,
          criado_em,
          aircraft:aeronave (
            matricula
          )
        `)
        .eq("status", "submitted")
        .order("submetido_em", {
          ascending: false,
          nullsFirst: false,
        });

      if (error) {
        console.error("Erro ao carregar orçamentos CTM:", error);
        throw error;
      }

      return (data || []) as Budget[];
    },

    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // ==========================================================================
  // SOLICITAÇÕES DE COMPRA
  // ==========================================================================

  const {
    data: purchases = [],
    isLoading: loadingPurchases,
    isError: errorPurchases,
    refetch: refetchPurchases,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["aprovacoes-orcamentos-purchases"],

    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("purchase_requests")
        .select(`
          id,
          numero_solicitacao,
          descricao,
          solicitante_nome,
          valor_total,
          status,
          data_solicitacao
        `)
        .in("status", ["enviado", "em_analise"])
        .order("data_solicitacao", {
          ascending: false,
          nullsFirst: false,
        });

      if (error) {
        console.error(
          "Erro ao carregar solicitações de compra:",
          error
        );

        throw error;
      }

      return (data || []) as PurchaseRequest[];
    },

    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // ==========================================================================
  // CONSOLIDAÇÃO DA FILA
  // ==========================================================================

  const items = useMemo<ApprovalItem[]>(() => {
    const budgetItems: ApprovalItem[] = budgets.map((budget) => ({
      id: budget.id,
      type: "budget",

      title:
        budget.descricao?.trim() ||
        "Orçamento sem descrição",

      subtitle: budget.aircraft?.matricula
        ? `Aeronave ${budget.aircraft.matricula}`
        : "Aeronave não informada",

      date: budget.submetido_em || budget.criado_em,

      total: Number(budget.valor_total) || 0,

      status: budget.status || "submitted",
    }));

    const purchaseItems: ApprovalItem[] = purchases.map((purchase) => ({
      id: purchase.id,
      type: "purchase",

      title: [
        purchase.numero_solicitacao || "Solicitação",
        purchase.descricao || "",
      ]
        .filter(Boolean)
        .join(" — "),

      subtitle: purchase.solicitante_nome
        ? `Solicitante: ${purchase.solicitante_nome}`
        : "Solicitante não informado",

      date: purchase.data_solicitacao,

      total: Number(purchase.valor_total) || 0,

      status: purchase.status || "enviado",
    }));

    const normalizedSearch = normalizeSearch(search);

    return [...budgetItems, ...purchaseItems]
      .filter((item) => {
        if (tab === "todos") return true;

        return item.type === tab;
      })
      .filter((item) => {
        if (!normalizedSearch) return true;

        const searchableText = normalizeSearch(
          [
            item.title,
            item.subtitle,
            item.status,
          ]
            .filter(Boolean)
            .join(" ")
        );

        return searchableText.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const dateA = a.date
          ? new Date(a.date).getTime()
          : 0;

        const dateB = b.date
          ? new Date(b.date).getTime()
          : 0;

        return dateB - dateA;
      });
  }, [budgets, purchases, tab, search]);

  // ==========================================================================
  // ESTADOS
  // ==========================================================================

  const isLoading =
    loadingBudgets ||
    loadingPurchases;

  const hasError =
    errorBudgets ||
    errorPurchases;

  const totalPending =
    budgets.length +
    purchases.length;

  // ==========================================================================
  // ATUALIZAR FILA
  // ==========================================================================

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await Promise.all([
        refetchBudgets(),
        refetchPurchases(),
      ]);

      await queryClient.invalidateQueries({
        queryKey: ["aprovacoes-orcamentos-budgets"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["aprovacoes-orcamentos-purchases"],
      });

      toast({
        title: "Fila atualizada",
        description:
          "As aprovações pendentes foram atualizadas.",
      });
    } catch (error: any) {
      console.error(error);

      toast({
        title: "Erro ao atualizar",
        description:
          error?.message ||
          "Não foi possível atualizar a fila.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // ==========================================================================
  // ABRIR ITEM
  // ==========================================================================

  const handleOpen = (item: ApprovalItem) => {
    if (item.type === "budget") {
      navigate(
        `/manutencao/orcamentos?budgetId=${item.id}`
      );

      return;
    }

    setSelectedPurchaseId(item.id);
  };

  // ==========================================================================
  // TELA DE DETALHE DA COMPRA
  // ==========================================================================

  if (selectedPurchaseId) {
    return (
      <main className="flex-1 min-h-screen p-3 md:p-6">
        <PurchaseRequestApprovalDetail
          requestId={selectedPurchaseId}
          onBack={() => {
            setSelectedPurchaseId(null);

            refetchPurchases();
          }}
        />
      </main>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <main className="flex-1 min-h-screen p-3 md:p-6 space-y-6">
      {/* ================================================================ */}
      {/* VOLTAR */}
      {/* ================================================================ */}

      <button
        onClick={() => navigate(-1)}
        className="
          flex items-center gap-2
          text-muted-foreground
          hover:text-foreground
          transition-colors
          group
          w-fit
        "
      >
        <ArrowLeft
          className="
            h-4 w-4
            group-hover:-translate-x-1
            transition-transform
          "
        />

        <span className="text-sm font-medium">
          Voltar
        </span>
      </button>

      {/* ================================================================ */}
      {/* CABEÇALHO */}
      {/* ================================================================ */}

      <div
        className="
          flex flex-col
          lg:flex-row
          lg:items-center
          lg:justify-between
          gap-4
        "
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="
                p-2.5
                rounded-xl
                bg-amber-500/10
                border border-amber-500/20
              "
            >
              <Clock className="w-5 h-5 text-amber-400" />
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Aprovações
              </h1>
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            Solicitações de compras e orçamentos aguardando
            análise e aprovação.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="
              text-sm
              px-3
              py-1.5
              border-amber-500/30
              text-amber-400
              bg-amber-500/10
            "
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />

            {totalPending} pendente
            {totalPending === 1 ? "" : "s"}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                isRefreshing
                  ? "animate-spin"
                  : ""
              }`}
            />

            <span className="hidden sm:inline">
              Atualizar
            </span>
          </Button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ERRO */}
      {/* ================================================================ */}

      {hasError && (
        <Card
          className="
            border-red-500/20
            bg-red-500/5
          "
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle
                className="
                  h-5 w-5
                  text-red-400
                  mt-0.5
                  shrink-0
                "
              />

              <div>
                <p className="font-medium text-red-400">
                  Não foi possível carregar toda a fila.
                </p>

                <p className="text-sm text-muted-foreground mt-1">
                  Verifique sua conexão ou atualize a página.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/* RESUMO */}
      {/* ================================================================ */}

      <div
        className="
          grid
          grid-cols-1
          sm:grid-cols-2
          lg:grid-cols-3
          gap-3
        "
      >
        {/* TOTAL */}

        <Card
          className="
            bg-white/[0.02]
            border-white/[0.05]
            hover:border-amber-500/20
            transition-colors
          "
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Total pendente
                </p>

                <p className="text-3xl font-bold mt-1">
                  {totalPending}
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  itens aguardando análise
                </p>
              </div>

              <div
                className="
                  p-3
                  rounded-xl
                  bg-amber-500/10
                  border border-amber-500/20
                "
              >
                <ClipboardCheck
                  className="
                    h-5 w-5
                    text-amber-400
                  "
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ORÇAMENTOS */}

        <Card
          className="
            bg-white/[0.02]
            border-white/[0.05]
            hover:border-blue-500/20
            transition-colors
          "
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Orçamentos
                </p>

                <p className="text-3xl font-bold mt-1">
                  {budgets.length}
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  aguardando aprovação
                </p>
              </div>

              <div
                className="
                  p-3
                  rounded-xl
                  bg-blue-500/10
                  border border-blue-500/20
                "
              >
                <FileText
                  className="
                    h-5 w-5
                    text-blue-400
                  "
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* COMPRAS */}

        <Card
          className="
            bg-white/[0.02]
            border-white/[0.05]
            hover:border-purple-500/20
            transition-colors
          "
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Solicitações de compra
                </p>

                <p className="text-3xl font-bold mt-1">
                  {purchases.length}
                </p>

                <p className="text-xs text-muted-foreground mt-1">
                  aguardando aprovação
                </p>
              </div>

              <div
                className="
                  p-3
                  rounded-xl
                  bg-purple-500/10
                  border border-purple-500/20
                "
              >
                <ShoppingCart
                  className="
                    h-5 w-5
                    text-purple-400
                  "
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================================================================ */}
      {/* FILA */}
      {/* ================================================================ */}

      <Card
        className="
          bg-white/[0.02]
          border-white/[0.05]
          overflow-hidden
        "
      >
        <CardHeader
          className="
            flex
            flex-col
            lg:flex-row
            lg:items-center
            lg:justify-between
            gap-4
            border-b
            border-white/[0.05]
          "
        >
          <div>
            <CardTitle className="text-lg">
              Fila de aprovação
            </CardTitle>

            <p className="text-xs text-muted-foreground mt-1">
              Selecione uma solicitação para visualizar os
              detalhes.
            </p>
          </div>

          {/* BUSCA */}

          <div className="relative w-full lg:w-80">
            <Search
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                h-4
                w-4
                text-muted-foreground
              "
            />

            <Input
              placeholder="
                Buscar por descrição, solicitante,
                aeronave ou número...
              "
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          {/* ============================================================ */}
          {/* ABAS */}
          {/* ============================================================ */}

          <Tabs
            value={tab}
            onValueChange={(value) =>
              setTab(value as ApprovalTab)
            }
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <TabsList
                className="
                  w-full
                  sm:w-auto
                  grid
                  grid-cols-3
                "
              >
                <TabsTrigger value="todos">
                  Todos
                </TabsTrigger>

                <TabsTrigger value="budget">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Orçamentos
                </TabsTrigger>

                <TabsTrigger value="purchase">
                  <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                  Compras
                </TabsTrigger>
              </TabsList>

              {search && (
                <p className="text-xs text-muted-foreground">
                  {items.length} resultado
                  {items.length === 1
                    ? ""
                    : "s"} encontrado
                  {items.length === 1
                    ? ""
                    : "s"}
                </p>
              )}
            </div>

            <TabsContent
              value={tab}
              className="mt-0"
            >
              {/* ======================================================== */}
              {/* LOADING */}
              {/* ======================================================== */}

              {isLoading ? (
                <ApprovalLoading />
              ) : items.length === 0 ? (
                /* ====================================================== */
                /* VAZIO */
                /* ====================================================== */

                <EmptyApprovals
                  hasSearch={Boolean(search.trim())}
                  onClearSearch={() => setSearch("")}
                />
              ) : (
                /* ====================================================== */
                /* LISTA */
                /* ====================================================== */

                <div className="space-y-2.5">
                  {items.map((item) => (
                    <ApprovalRow
                      key={`${item.type}-${item.id}`}
                      item={item}
                      onClick={() =>
                        handleOpen(item)
                      }
                    />
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

// ============================================================================
// LINHA DA APROVAÇÃO
// ============================================================================

function ApprovalRow({
  item,
  onClick,
}: {
  item: ApprovalItem;
  onClick: () => void;
}) {
  const isBudget =
    item.type === "budget";

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full
        text-left
        flex
        items-center
        gap-3
        p-4
        rounded-xl
        bg-white/[0.02]
        border
        border-white/[0.05]
        hover:border-primary/30
        hover:bg-white/[0.04]
        transition-all
        group
      "
    >
      {/* ÍCONE */}

      <div
        className={`
          hidden
          sm:flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          rounded-xl
          border

          ${
            isBudget
              ? `
                bg-blue-500/10
                border-blue-500/20
              `
              : `
                bg-purple-500/10
                border-purple-500/20
              `
          }
        `}
      >
        {isBudget ? (
          <FileText
            className="
              h-5 w-5
              text-blue-400
            "
          />
        ) : (
          <ShoppingCart
            className="
              h-5 w-5
              text-purple-400
            "
          />
        )}
      </div>

      {/* CONTEÚDO */}

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p
            className="
              font-medium
              text-foreground
              group-hover:text-primary
              transition-colors
              truncate
            "
          >
            {item.title}
          </p>
        </div>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-x-3
            gap-y-1
            mt-1.5
          "
        >
          {item.subtitle && (
            <p className="text-xs text-muted-foreground truncate max-w-[260px]">
              {item.subtitle}
            </p>
          )}

          {item.date && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTime(item.date)}
            </p>
          )}
        </div>

        <div className="mt-2">
          <span
            className="
              text-sm
              font-semibold
              text-emerald-400
            "
          >
            {formatCurrency(item.total)}
          </span>
        </div>
      </div>

      {/* STATUS + SETA */}

      <div
        className="
          flex
          items-center
          gap-2
          shrink-0
        "
      >
        <Badge
          variant="outline"
          className={
            isBudget
              ? `
                bg-blue-500/10
                text-blue-400
                border-blue-500/20
              `
              : `
                bg-purple-500/10
                text-purple-400
                border-purple-500/20
              `
          }
        >
          {isBudget
            ? "Orçamento"
            : "Compra"}
        </Badge>

        <ChevronRight
          className="
            h-4 w-4
            text-muted-foreground
            opacity-50
            group-hover:opacity-100
            group-hover:translate-x-0.5
            transition-all
          "
        />
      </div>
    </button>
  );
}

// ============================================================================
// LOADING
// ============================================================================

function ApprovalLoading() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="
            flex
            items-center
            gap-4
            p-4
            rounded-xl
            bg-white/[0.02]
            border
            border-white/[0.05]
            animate-pulse
          "
        >
          <div className="hidden sm:block h-11 w-11 rounded-xl bg-white/[0.05]" />

          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-white/[0.05]" />
            <div className="h-3 w-1/3 rounded bg-white/[0.05]" />
            <div className="h-3 w-24 rounded bg-white/[0.05]" />
          </div>

          <div className="h-6 w-20 rounded-full bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ESTADO VAZIO
// ============================================================================

function EmptyApprovals({
  hasSearch,
  onClearSearch,
}: {
  hasSearch: boolean;
  onClearSearch: () => void;
}) {
  return (
    <div
      className="
        flex
        flex-col
        items-center
        justify-center
        py-16
        text-center
      "
    >
      <div
        className="
          w-16
          h-16
          rounded-2xl
          bg-emerald-500/10
          border border-emerald-500/20
          flex
          items-center
          justify-center
          mb-4
        "
      >
        {hasSearch ? (
          <Search
            className="
              h-7 w-7
              text-muted-foreground
            "
          />
        ) : (
          <CheckCircle2
            className="
              h-7 w-7
              text-emerald-400
            "
          />
        )}
      </div>

      <p className="font-medium text-foreground">
        {hasSearch
          ? "Nenhum resultado encontrado"
          : "Tudo em dia!"}
      </p>

      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        {hasSearch
          ? "Nenhuma aprovação corresponde aos termos da busca."
          : "Não existem orçamentos ou solicitações de compra aguardando aprovação."}
      </p>

      {hasSearch && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onClearSearch}
        >
          Limpar busca
        </Button>
      )}
    </div>
  );
}