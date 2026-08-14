import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  History,
  Mail,
  Search,
  Send,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";

import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

/* =========================================================
   FORMATADORES
========================================================= */

const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR")
    : "—";

/* =========================================================
   STATUS
========================================================= */

type StatusFilter =
  | "todos"
  | "pendente"
  | "pago"
  | "rascunho"
  | "cancelado";

const statusLabel = (status: string | null) => {
  switch (status) {
    case "pago":
      return "Pago";
    case "cancelado":
      return "Cancelado";
    case "rascunho":
      return "Rascunho";
    default:
      return "Pendente";
  }
};

const getStatusClasses = (status: string | null) => {
  switch (status) {
    case "pago":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-400";

    case "cancelado":
      return "border-red-400/20 bg-red-400/10 text-red-400";

    case "rascunho":
      return "border-slate-400/20 bg-slate-400/10 text-slate-300";

    default:
      return "border-amber-400/20 bg-amber-400/10 text-amber-400";
  }
};

/* =========================================================
   TIPOS
========================================================= */

type PaymentMovement = {
  id: string;
  descricao: string;
  fornecedor_nome: string | null;
  valor_total: number | null;
  valor_rateado: number;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  criado_em: string;
  criado_por: string | null;
  tipo_caixa: string | null;
  status: string;
  clientes_id: string | null;
  enviado_por_email: boolean;
  enviado_por_email_em: string | null;
  reference_type: string | null;
  reference_id: string | null;
  observacoes: string | null;
};

type PaymentEmail = {
  id: string;
  reference_id: string | null;
  destinatario: string;
  assunto: string;
  status: string;
  criado_em: string;
  enviado_por: string | null;
};

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */

export default function HistoricoProgramacaoPagamentos() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(
    null
  );

  const [expandedClients, setExpandedClients] = useState<
    Record<string, boolean>
  >({});

  /* =======================================================
     QUERY
  ======================================================= */

  const { data, isLoading, error } = useQuery({
    queryKey: ["historico-programacao-pagamentos"],
    queryFn: async () => {
      const { data: movements, error: movementsError } = await supabase
        .from("movimentacoes")
        .select(
          `
          id,
          descricao,
          fornecedor_nome,
          valor_total,
          valor_rateado,
          data_emissao,
          data_vencimento,
          data_pagamento,
          criado_em,
          criado_por,
          tipo_caixa,
          status,
          clientes_id,
          enviado_por_email,
          enviado_por_email_em,
          reference_type,
          reference_id,
          observacoes
        `
        )
        .or(
          "reference_type.eq.solicitacao_pagamento,reference_type.eq.travel_expense_report"
        )
        .order("criado_em", { ascending: false });

      if (movementsError) {
        throw movementsError;
      }

      const rows = (movements || []) as PaymentMovement[];

      const authorIds = Array.from(
        new Set(rows.map((row) => row.criado_por).filter(Boolean))
      );

      const clientIds = Array.from(
        new Set(rows.map((row) => row.clientes_id).filter(Boolean))
      );

      const movementIds = rows.map((row) => row.id);

      const [profilesResponse, clientsResponse, emailsResponse] =
        await Promise.all([
          authorIds.length
            ? supabase
                .from("user_profiles")
                .select("id, full_name, display_name")
                .in("id", authorIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          clientIds.length
            ? supabase
                .from("clientes")
                .select("id, razao_social")
                .in("id", clientIds)
            : Promise.resolve({
                data: [],
                error: null,
              }),

          movementIds.length
            ? supabase
                .from("emails_enviados")
                .select(
                  "id, reference_id, destinatario, assunto, status, criado_em, enviado_por"
                )
                .eq("reference_type", "movimentacoes")
                .in("reference_id", movementIds)
                .order("criado_em", { ascending: false })
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

      if (profilesResponse.error) {
        throw profilesResponse.error;
      }

      if (clientsResponse.error) {
        throw clientsResponse.error;
      }

      if (emailsResponse.error) {
        throw emailsResponse.error;
      }

      return {
        movements: rows,

        profiles: Object.fromEntries(
          (
            (profilesResponse.data || []) as Array<{
              id: string;
              full_name: string | null;
              display_name?: string | null;
            }>
          ).map((profile) => [
            profile.id,
            profile.display_name || profile.full_name || "Usuário",
          ])
        ) as Record<string, string>,

        clients: Object.fromEntries(
          (
            (clientsResponse.data || []) as Array<{
              id: string;
              razao_social: string | null;
            }>
          ).map((client) => [
            client.id,
            client.razao_social || "Cliente sem nome",
          ])
        ) as Record<string, string>,

        emails: (emailsResponse.data || []) as PaymentEmail[],
      };
    },
  });

  /* =======================================================
     ESTATÍSTICAS
  ======================================================= */

  const stats = useMemo(() => {
    const rows = data?.movements || [];
    const emails = data?.emails || [];

    const pending = rows.filter(
      (row) => !row.status || row.status === "pendente"
    );

    const paid = rows.filter((row) => row.status === "pago");

    const drafts = rows.filter((row) => row.status === "rascunho");

    const canceled = rows.filter((row) => row.status === "cancelado");

    const withEmail = new Set(
      emails
        .filter((email) => email.status !== "erro")
        .map((email) => email.reference_id)
    ).size;

    return {
      total: rows.length,

      pending: pending.length,

      paid: paid.length,

      drafts: drafts.length,

      canceled: canceled.length,

      emails: withEmail,

      share: rows.filter((row) => row.tipo_caixa === "share").length,

      totalValue: rows.reduce(
        (total, row) =>
          total + Number(row.valor_total ?? row.valor_rateado ?? 0),
        0
      ),

      openValue: pending.reduce(
        (total, row) =>
          total + Number(row.valor_total ?? row.valor_rateado ?? 0),
        0
      ),
    };
  }, [data]);

  /* =======================================================
     FILTRO
  ======================================================= */

  const filteredMovements = useMemo(() => {
    const rows = data?.movements || [];

    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((movement) => {
      const clientName = movement.clientes_id
        ? data?.clients[movement.clientes_id] || ""
        : "";

      const authorName = movement.criado_por
        ? data?.profiles[movement.criado_por] || ""
        : "";

      const searchableText = [
        movement.descricao,
        movement.fornecedor_nome,
        movement.observacoes,
        clientName,
        authorName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      const normalizedStatus =
        movement.status === "pago" ||
        movement.status === "cancelado" ||
        movement.status === "rascunho"
          ? movement.status
          : "pendente";

      const matchesStatus =
        statusFilter === "todos" || normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [data, search, statusFilter]);

  /* =======================================================
     AGRUPAMENTO POR CLIENTE
  ======================================================= */

  const groupedClients = useMemo(() => {
    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        movements: PaymentMovement[];
        total: number;
      }
    >();

    filteredMovements.forEach((movement) => {
      const id = movement.clientes_id || "sem-cliente";

      const name = movement.clientes_id
        ? data?.clients[movement.clientes_id] || "Cliente não identificado"
        : "Sem cliente vinculado";

      if (!groups.has(id)) {
        groups.set(id, {
          id,
          name,
          movements: [],
          total: 0,
        });
      }

      const group = groups.get(id)!;

      group.movements.push(movement);

      group.total += Number(
        movement.valor_total ?? movement.valor_rateado ?? 0
      );
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR")
    );
  }, [filteredMovements, data]);

  /* =======================================================
     MOVIMENTO SELECIONADO
  ======================================================= */

  const selectedMovement = useMemo(() => {
    if (!selectedMovementId) return null;

    const rows = data?.movements || [];

    return rows.find((row) => row.id === selectedMovementId) || null;
  }, [data, selectedMovementId]);

  /*
   * Mantém o preview sincronizado com a lista filtrada.
   * Se o usuário pesquisar/filtrar e o item selecionado deixar de existir
   * na lista visível, o preview é limpo em vez de mostrar outro registro.
   */
  useEffect(() => {
    if (!selectedMovementId) return;

    const stillVisible = filteredMovements.some(
      (movement) => movement.id === selectedMovementId
    );

    if (!stillVisible) {
      setSelectedMovementId(null);
    }
  }, [filteredMovements, selectedMovementId]);

  const selectedEmails = useMemo(() => {
    if (!selectedMovement) return [];

    return (data?.emails || []).filter(
      (email) =>
        email.reference_id === selectedMovement.id &&
        email.status !== "erro"
    );
  }, [data, selectedMovement]);

  /* =======================================================
     CLIENTES EXPANDIDOS
  ======================================================= */

  const toggleClient = (clientId: string) => {
    setExpandedClients((current) => ({
      ...current,
      [clientId]: !current[clientId],
    }));
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <Layout>
      <main className="min-h-[calc(100vh-4rem)] bg-[#090a0c] text-white">
        <div className="mx-auto max-w-[1800px] px-4 py-6 md:px-6 lg:px-8">

          {/* =================================================
              HEADER
          ================================================= */}

          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="
                  mt-1
                  h-9
                  w-9
                  rounded-lg
                  border
                  border-white/5
                  bg-white/[0.025]
                  text-slate-400
                  hover:bg-white/[0.06]
                  hover:text-white
                "
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-400" />

                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
                    Financeiro
                  </span>
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                  Histórico de programação de pagamentos
                </h1>

                <p className="mt-1 max-w-3xl text-sm text-slate-400">
                  Solicitações agrupadas por cliente, com uma visão completa
                  da criação, envio à Share, e-mails e liquidação.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => navigate("/financeiro")}
              className="
                border-white/10
                bg-white/[0.025]
                text-slate-300
                hover:bg-white/[0.06]
                hover:text-white
              "
            >
              Voltar ao financeiro
            </Button>
          </div>

          {/* =================================================
              STATS
          ================================================= */}

          <div className="mb-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101114]">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5">

              <StatItem
                label="Valor programado"
                value={formatCurrency(stats.totalValue)}
                secondary={`${formatCurrency(stats.openValue)} em aberto`}
                icon={<CircleDollarSign className="h-4 w-4" />}
                accent="primary"
              />

              <StatItem
                label="Clientes"
                value={String(groupedClients.length)}
                secondary={`${stats.total} programação${
                  stats.total === 1 ? "" : "ões"
                }`}
                icon={<UserRound className="h-4 w-4" />}
              />

              <StatItem
                label="Programações"
                value={String(stats.total)}
                secondary={`${stats.pending} pendentes`}
                icon={<FileText className="h-4 w-4" />}
              />

              <StatItem
                label="Caixa Share"
                value={String(stats.share)}
                secondary="registros enviados"
                icon={<Send className="h-4 w-4" />}
              />

              <div className="col-span-2 hidden xl:block">
                <StatItem
                  label="Com e-mail"
                  value={String(stats.emails)}
                  secondary={`${stats.paid} pagos`}
                  icon={<Mail className="h-4 w-4" />}
                  noRightBorder
                />
              </div>

            </div>
          </div>

          {/* =================================================
              FILTROS
          ================================================= */}

          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">

            <div className="relative w-full xl:max-w-[440px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por cliente, fornecedor, descrição ou responsável..."
                className="
                  h-10
                  border-white/[0.08]
                  bg-[#101114]
                  pl-10
                  text-sm
                  text-white
                  placeholder:text-slate-600
                  focus-visible:ring-1
                  focus-visible:ring-blue-500/50
                "
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <FilterButton
                active={statusFilter === "todos"}
                onClick={() => setStatusFilter("todos")}
              >
                Todos {stats.total}
              </FilterButton>

              <FilterButton
                active={statusFilter === "pendente"}
                onClick={() => setStatusFilter("pendente")}
              >
                Pendente {stats.pending}
              </FilterButton>

              <FilterButton
                active={statusFilter === "pago"}
                onClick={() => setStatusFilter("pago")}
              >
                Pago {stats.paid}
              </FilterButton>

              <FilterButton
                active={statusFilter === "rascunho"}
                onClick={() => setStatusFilter("rascunho")}
              >
                Rascunho {stats.drafts}
              </FilterButton>

              <FilterButton
                active={statusFilter === "cancelado"}
                onClick={() => setStatusFilter("cancelado")}
              >
                Cancelado {stats.canceled}
              </FilterButton>
            </div>
          </div>

          {/* =================================================
              GRID PRINCIPAL
          ================================================= */}

          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState />
          ) : filteredMovements.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)]">

              {/* =============================================
                  LISTA DE CLIENTES
              ============================================= */}

              <section className="min-w-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs text-slate-500">
                    {filteredMovements.length} de {data?.movements.length || 0}{" "}
                    programações
                  </span>

                  <span className="text-xs text-slate-600">
                    {groupedClients.length} cliente
                    {groupedClients.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2">

                  {groupedClients.map((group) => {
                    const isExpanded =
                      expandedClients[group.id] !== false;

                    return (
                      <div key={group.id} className="space-y-2">

                        {/* ===================================
                            CLIENTE
                        =================================== */}

                        <button
                          type="button"
                          onClick={() => toggleClient(group.id)}
                          className="
                            group
                            w-full
                            rounded-xl
                            border
                            border-white/[0.08]
                            bg-[#101114]
                            px-4
                            py-3
                            text-left
                            transition
                            hover:border-white/[0.14]
                            hover:bg-[#121419]
                          "
                        >
                          <div className="flex items-center gap-3">

                            <div className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-500">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>

                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025]">
                              <Wallet className="h-4 w-4 text-slate-400" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-100">
                                {group.name}
                              </div>

                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                                <span>
                                  {group.movements.length} programação
                                  {group.movements.length === 1 ? "" : "ões"}
                                </span>

                                <span className="text-slate-700">•</span>

                                <span>
                                  {
                                    group.movements.filter(
                                      (item) =>
                                        !item.status ||
                                        item.status === "pendente"
                                    ).length
                                  }{" "}
                                  pendente
                                  {
                                    group.movements.filter(
                                      (item) =>
                                        !item.status ||
                                        item.status === "pendente"
                                    ).length === 1
                                      ? ""
                                      : "s"
                                  }
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-sm font-semibold text-white">
                                {formatCurrency(group.total)}
                              </div>
                            </div>

                          </div>
                        </button>

                        {/* ===================================
                            MOVIMENTAÇÕES
                        =================================== */}

                        {isExpanded && (
                          <div className="ml-4 space-y-2 border-l border-white/[0.07] pl-3">

                            {group.movements.map((movement) => {
                              const isSelected =
                                selectedMovement?.id === movement.id;

                              const emails =
                                data?.emails.filter(
                                  (email) =>
                                    email.reference_id === movement.id &&
                                    email.status !== "erro"
                                ) || [];

                              const emailed =
                                movement.enviado_por_email ||
                                emails.length > 0;

                              return (
                                <button
                                  key={movement.id}
                                  type="button"
                                  onClick={() => setSelectedMovementId(movement.id)}
                                  aria-pressed={isSelected}
                                  className={`
                                    w-full
                                    rounded-xl
                                    border
                                    p-4
                                    text-left
                                    transition
                                    ${
                                      isSelected
                                        ? "border-blue-500/40 bg-blue-500/[0.07] shadow-[0_0_0_1px_rgba(59,130,246,0.08)]"
                                        : "border-white/[0.07] bg-[#0f1013] hover:border-white/[0.13] hover:bg-[#111318]"
                                    }
                                  `}
                                >
                                  <div className="flex items-start justify-between gap-4">

                                    <div className="min-w-0 flex-1">
                                      <div className="mb-2 flex flex-wrap items-center gap-2">

                                        <span
                                          className={`
                                            inline-flex
                                            items-center
                                            rounded-full
                                            border
                                            px-2
                                            py-0.5
                                            text-[10px]
                                            font-medium
                                            ${getStatusClasses(
                                              movement.status
                                            )}
                                          `}
                                        >
                                          {statusLabel(movement.status)}
                                        </span>

                                        {movement.tipo_caixa === "share" && (
                                          <span className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                                            Caixa Share
                                          </span>
                                        )}

                                        {emailed && (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                                            <Mail className="h-3 w-3" />
                                            E-mail
                                          </span>
                                        )}

                                      </div>

                                      <h3 className="truncate text-sm font-semibold text-slate-100">
                                        {movement.descricao ||
                                          "Programação sem descrição"}
                                      </h3>

                                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">

                                        {movement.fornecedor_nome && (
                                          <span>
                                            {movement.fornecedor_nome}
                                          </span>
                                        )}

                                        <span>
                                          Criado em{" "}
                                          {formatDateTime(movement.criado_em)}
                                        </span>

                                      </div>
                                    </div>

                                    <div className="shrink-0 text-right">
                                      <div className="text-sm font-semibold text-white">
                                        {formatCurrency(
                                          movement.valor_total ??
                                            movement.valor_rateado
                                        )}
                                      </div>

                                      <div className="mt-1 text-[11px] text-slate-600">
                                        Venc.{" "}
                                        {formatDate(
                                          movement.data_vencimento
                                        )}
                                      </div>
                                    </div>

                                  </div>
                                </button>
                              );
                            })}

                          </div>
                        )}
                      </div>
                    );
                  })}

                </div>
              </section>

              {/* =============================================
                  DETALHES
              ============================================= */}

              <section className="min-w-0">

                {selectedMovement ? (
                  <PaymentDetailPanel
                    movement={selectedMovement}
                    emails={selectedEmails}
                    author={
                      selectedMovement.criado_por
                        ? data?.profiles[selectedMovement.criado_por] ||
                          "Usuário não identificado"
                        : "Usuário não identificado"
                    }
                    client={
                      selectedMovement.clientes_id
                        ? data?.clients[selectedMovement.clientes_id] ||
                          "Cliente não identificado"
                        : "Sem cliente vinculado"
                    }
                  />
                ) : (
                  <NoSelectionState />
                )}

              </section>
            </div>
          )}

        </div>
      </main>
    </Layout>
  );
}

/* =========================================================
   STAT ITEM
========================================================= */

function StatItem({
  label,
  value,
  secondary,
  icon,
  accent,
  noRightBorder = false,
}: {
  label: string;
  value: string;
  secondary?: string;
  icon: React.ReactNode;
  accent?: "primary";
  noRightBorder?: boolean;
}) {
  return (
    <div
      className={`
        flex
        items-center
        justify-between
        gap-4
        px-5
        py-4
        ${
          noRightBorder
            ? ""
            : "border-r border-white/[0.06]"
        }
      `}
    >
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {label}
          </span>
        </div>

        <div
          className={`
            truncate
            text-lg
            font-semibold
            tracking-tight
            ${
              accent === "primary"
                ? "text-white"
                : "text-slate-100"
            }
          `}
        >
          {value}
        </div>

        {secondary && (
          <div className="mt-0.5 truncate text-[10px] text-amber-400">
            {secondary}
          </div>
        )}
      </div>

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-slate-500">
        {icon}
      </div>
    </div>
  );
}

/* =========================================================
   FILTER BUTTON
========================================================= */

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        h-9
        rounded-lg
        border
        px-3
        text-xs
        font-medium
        transition
        ${
          active
            ? "border-blue-500/50 bg-blue-500/[0.09] text-blue-400"
            : "border-white/[0.06] bg-[#101114] text-slate-400 hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-slate-200"
        }
      `}
    >
      {children}
    </button>
  );
}

/* =========================================================
   DETALHE
========================================================= */

function PaymentDetailPanel({
  movement,
  emails,
  author,
  client,
}: {
  movement: PaymentMovement;
  emails: PaymentEmail[];
  author: string;
  client: string;
}) {
  const emailed = movement.enviado_por_email || emails.length > 0;

  return (
    <div className="sticky top-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101114]">

      {/* ===============================================
          HEADER
      =============================================== */}

      <div className="border-b border-white/[0.06] px-5 py-5">

        <div className="mb-4 flex items-start justify-between gap-4">

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">

              <span
                className={`
                  inline-flex
                  items-center
                  rounded-full
                  border
                  px-2.5
                  py-1
                  text-[10px]
                  font-medium
                  ${getStatusClasses(movement.status)}
                `}
              >
                {statusLabel(movement.status)}
              </span>

              {movement.tipo_caixa === "share" && (
                <span className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[10px] font-medium text-violet-300">
                  Caixa Share
                </span>
              )}
            </div>

            <h2 className="text-lg font-semibold leading-snug text-white">
              {movement.descricao || "Programação sem descrição"}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {client}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-lg font-bold tracking-tight text-blue-400">
              {formatCurrency(
                movement.valor_total ?? movement.valor_rateado
              )}
            </div>

            <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
              valor programado
            </div>
          </div>
        </div>

      </div>

      {/* ===============================================
          INFORMAÇÕES
      =============================================== */}

      <div className="px-5 py-5">

        <div className="grid grid-cols-2 gap-x-5 gap-y-5">

          <DetailField
            label="Responsável"
            value={author}
            icon={<UserRound className="h-3.5 w-3.5" />}
          />

          <DetailField
            label="Fornecedor"
            value={movement.fornecedor_nome || "—"}
            icon={<Wallet className="h-3.5 w-3.5" />}
          />

          <DetailField
            label="Criado em"
            value={formatDateTime(movement.criado_em)}
            icon={<Clock3 className="h-3.5 w-3.5" />}
          />

          <DetailField
            label="Emissão"
            value={formatDate(movement.data_emissao)}
            icon={<FileText className="h-3.5 w-3.5" />}
          />

          <DetailField
            label="Vencimento"
            value={formatDate(movement.data_vencimento)}
            icon={<Clock3 className="h-3.5 w-3.5" />}
          />

          <DetailField
            label="Pagamento"
            value={
              movement.data_pagamento
                ? formatDate(movement.data_pagamento)
                : "Ainda não liquidado"
            }
            icon={<CircleDollarSign className="h-3.5 w-3.5" />}
          />

        </div>

        {movement.observacoes && (
          <>
            <Separator className="my-5 bg-white/[0.06]" />

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Observações
              </p>

              <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3 text-xs leading-relaxed text-slate-300">
                {movement.observacoes}
              </div>
            </div>
          </>
        )}

      </div>

      {/* ===============================================
          TRILHA
      =============================================== */}

      <div className="border-t border-white/[0.06] px-5 py-5">

        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
              Trilha da programação
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Histórico do fluxo financeiro
            </p>
          </div>

          <History className="h-4 w-4 text-slate-600" />
        </div>

        <div className="space-y-1">

          <TimelineRow
            active
            icon={<UserRound className="h-3.5 w-3.5" />}
            title="Programação criada"
            detail={`${author} • ${formatDateTime(
              movement.criado_em
            )}`}
          />

          {movement.tipo_caixa === "share" && (
            <TimelineRow
              active
              icon={<Send className="h-3.5 w-3.5" />}
              title="Enviada ao caixa Share"
              detail="Registro incluído no fluxo financeiro da Share"
            />
          )}

          {emailed && (
            <TimelineRow
              active
              icon={<Mail className="h-3.5 w-3.5" />}
              title="Enviada ao cliente por e-mail"
              detail={
                emails[0]
                  ? `${emails[0].destinatario} • ${formatDateTime(
                      emails[0].criado_em
                    )}`
                  : formatDateTime(movement.enviado_por_email_em)
              }
            />
          )}

          {movement.status === "pago" && (
            <TimelineRow
              active
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              title="Pagamento concluído"
              detail={formatDateTime(movement.data_pagamento)}
            />
          )}

          {movement.status === "rascunho" && (
            <TimelineRow
              active={false}
              icon={<Clock3 className="h-3.5 w-3.5" />}
              title="Salvo como rascunho"
              detail="A programação ainda não foi enviada"
            />
          )}

          {movement.status === "cancelado" && (
            <TimelineRow
              active={false}
              icon={<XCircle className="h-3.5 w-3.5" />}
              title="Programação cancelada"
              detail="Esta solicitação foi cancelada"
            />
          )}

        </div>
      </div>

      {/* ===============================================
          E-MAILS
      =============================================== */}

      {emails.length > 0 && (
        <div className="border-t border-white/[0.06] px-5 py-5">

          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-500" />

            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                Histórico de e-mails
              </p>

              <p className="mt-1 text-xs text-slate-600">
                {emails.length} envio
                {emails.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {emails.map((email) => (
              <div
                key={email.id}
                className="rounded-xl border border-white/[0.06] bg-black/10 p-3"
              >
                <div className="flex items-start justify-between gap-3">

                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200">
                      {email.destinatario}
                    </p>

                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {email.assunto}
                    </p>
                  </div>

                  <span className="shrink-0 text-[10px] text-emerald-400">
                    Enviado
                  </span>
                </div>

                <p className="mt-2 text-[10px] text-slate-600">
                  {formatDateTime(email.criado_em)}
                </p>
              </div>
            ))}
          </div>

        </div>
      )}

    </div>
  );
}

/* =========================================================
   DETAIL FIELD
========================================================= */

function DetailField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-slate-600">
        {icon}
        <span>{label}</span>
      </div>

      <p className="break-words text-xs font-medium text-slate-200">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   TIMELINE ROW
========================================================= */

function TimelineRow({
  active,
  icon,
  title,
  detail,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">

      <div className="relative flex w-7 shrink-0 justify-center">

        <div
          className={`
            relative
            z-10
            flex
            h-7
            w-7
            items-center
            justify-center
            rounded-full
            border
            ${
              active
                ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                : "border-white/[0.07] bg-white/[0.02] text-slate-600"
            }
          `}
        >
          {icon}
        </div>

        <div className="absolute left-1/2 top-7 h-full w-px -translate-x-1/2 bg-white/[0.06]" />
      </div>

      <div className="min-w-0 pt-0.5">
        <p
          className={`text-xs font-medium ${
            active ? "text-slate-200" : "text-slate-500"
          }`}
        >
          {title}
        </p>

        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {detail}
        </p>
      </div>

    </div>
  );
}

/* =========================================================
   LOADING
========================================================= */

function LoadingState() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)]">

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-[84px] animate-pulse rounded-xl border border-white/[0.05] bg-[#101114]"
          />
        ))}
      </div>

      <div className="h-[620px] animate-pulse rounded-2xl border border-white/[0.05] bg-[#101114]" />
    </div>
  );
}

/* =========================================================
   ERROR
========================================================= */

function ErrorState() {
  return (
    <Card className="border-red-500/20 bg-red-500/[0.04]">
      <CardContent className="flex min-h-[260px] flex-col items-center justify-center text-center">
        <XCircle className="mb-3 h-8 w-8 text-red-400" />

        <h3 className="text-sm font-semibold text-white">
          Não foi possível carregar o histórico
        </h3>

        <p className="mt-1 max-w-md text-xs text-slate-500">
          Ocorreu um erro ao consultar as programações de pagamento.
        </p>
      </CardContent>
    </Card>
  );
}

/* =========================================================
   EMPTY
========================================================= */

function EmptyState() {
  return (
    <div className="grid min-h-[560px] place-items-center rounded-2xl border border-dashed border-white/[0.08] bg-[#0e0f12]">
      <div className="flex max-w-md flex-col items-center px-6 text-center">

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.025]">
          <Search className="h-5 w-5 text-slate-600" />
        </div>

        <h3 className="text-sm font-semibold text-slate-200">
          Nenhuma programação encontrada
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Não existem registros que correspondam à busca ou ao filtro
          selecionado.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   NO SELECTION
========================================================= */

function NoSelectionState() {
  return (
    <div className="grid min-h-[620px] place-items-center rounded-2xl border border-dashed border-white/[0.08] bg-[#0e0f12]">
      <div className="flex max-w-md flex-col items-center px-6 text-center">

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.025]">
          <Check className="h-5 w-5 text-slate-600" />
        </div>

        <h3 className="text-sm font-semibold text-slate-200">
          Nenhuma programação selecionada
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Selecione uma solicitação na lista para abrir o preview. Nenhuma
          programação é exibida automaticamente.
        </p>

      </div>
    </div>
  );
}