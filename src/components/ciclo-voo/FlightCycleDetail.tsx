// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plane,
  MapPin,
  CalendarDays,
  Clock3,
  UserRound,
  Plus,
  FileText,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  WalletCards,
  Navigation,
  CircleDollarSign,
} from "lucide-react";

import {
  FlightCycle,
  FlightExpense,
  FLIGHT_STATUS_CONFIG,
  EXPENSE_STATUS_CONFIG,
  ExpenseStatus,
} from "@/types/flightCycle";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { format, differenceInDays, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatFlightDuration } from "@/lib/duration-utils";

import { AddExpenseDialog } from "./AddExpenseDialog";
import { FlightDurationInput } from "./FlightDurationInput";

import { supabase } from "@/integrations/supabase/client";
import { useCrewMembers } from "@/hooks/useCrewMembers";

interface Client {
  id: string;
  razao_social: string | null;
  proprietario: string | null;
}

interface Aircraft {
  id: string;
  matricula: string;
  modelo: string;
}

interface ClientPartner {
  id: string;
  nome: string;
}

interface FlightCycleDetailProps {
  cycle: FlightCycle;
  onBack: () => void;
  onUpdateExpenseStatus: (
    expenseId: string,
    status: ExpenseStatus,
    additionalData?: Partial<FlightExpense>
  ) => void;
  onUpdateCycleStatus: (
    cycleId: string,
    status: FlightCycle["status"]
  ) => void;
  onAddExpense: (
    cycleId: string,
    expense: Partial<FlightExpense>
  ) => void;
  onDeleteExpense?: (expenseId: string) => Promise<void>;
  onUpdateCycle?: (
    cycleId: string,
    updates: Partial<FlightCycle>
  ) => Promise<void>;
  onDeleteCycle?: (cycleId: string) => Promise<void>;
}

export function FlightCycleDetail({
  cycle,
  onBack,
  onUpdateExpenseStatus,
  onUpdateCycleStatus,
  onAddExpense,
  onDeleteExpense,
  onUpdateCycle,
  onDeleteCycle,
}: FlightCycleDetailProps) {
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [partners, setPartners] = useState<ClientPartner[]>([]);

  const { crewMembers, fetchCrewMembers } = useCrewMembers();

  const [savingEdit, setSavingEdit] = useState(false);

  const [expenseEdits, setExpenseEdits] = useState<
    Record<
      string,
      {
        amount: number | null;
        status: ExpenseStatus;
      }
    >
  >({});

  const [editData, setEditData] = useState({
    client_id: cycle.client_id || "",
    partner_id: cycle.partner_id || "",
    origin_icao: cycle.origin_icao,
    destination_icao: cycle.destination_icao,
    flight_duration_hours: cycle.flight_duration_hours?.toString() || "",
    pic_name: cycle.pic_name || "",
    sic_name: cycle.sic_name || "",
  });

  const statusConfig = FLIGHT_STATUS_CONFIG[cycle.status];

  const expenses = cycle.expenses || [];

  const completedExpenses = expenses.filter((expense) =>
    ["paga", "nao_aplicavel"].includes(expense.status)
  ).length;

  const completionPercentage =
    expenses.length > 0
      ? Math.round((completedExpenses / expenses.length) * 100)
      : 0;

  const overdueExpenses = expenses.filter(
    (expense) => expense.status === "atrasada"
  );

  const pendingExpenses = expenses.filter(
    (expense) => !["paga", "nao_aplicavel"].includes(expense.status)
  );

  const clientName =
    cycle.partner_name ||
    cycle.client?.company_name ||
    cycle.client?.proprietario ||
    "Cliente não definido";

  /* ==========================================================
     LOAD EDIT DATA
  ========================================================== */

  useEffect(() => {
    if (isEditing) {
      loadEditData();
    }
  }, [isEditing]);

  useEffect(() => {
    const loadPartners = async () => {
      if (!editData.client_id) {
        setPartners([]);

        setEditData((prev) => ({
          ...prev,
          partner_id: "",
        }));

        return;
      }

      const { data } = await supabase
        .from("socios")
        .select("id, nome")
        .eq("cliente_id", editData.client_id)
        .order("nome");

      setPartners(data || []);

      setEditData((prev) => ({
        ...prev,
        partner_id: "",
      }));
    };

    loadPartners();
  }, [editData.client_id]);

  const loadEditData = async () => {
    const [clientsRes, aircraftRes] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, razao_social, proprietario")
        .order("razao_social"),

      supabase.from("aeronave").select("id, matricula, modelo").order("matricula"),
    ]);

    if (clientsRes.data) {
      setClients(clientsRes.data as Client[]);
    }

    if (aircraftRes.data) {
      setAircraft(aircraftRes.data as Aircraft[]);
    }

    await fetchCrewMembers();
  };

  /* ==========================================================
     EDIT
  ========================================================== */

  const handleSaveEdit = async () => {
    if (!onUpdateCycle) return;

    setSavingEdit(true);

    try {
      let partnerName: string | null = null;

      if (editData.partner_id) {
        const partner = partners.find(
          (item) => item.id === editData.partner_id
        );

        partnerName = partner?.nome || null;
      }

      await onUpdateCycle(cycle.id, {
        client_id: editData.client_id || null,
        partner_id: editData.partner_id || null,
        partner_name: partnerName,
        origin_icao: editData.origin_icao?.toUpperCase(),
        destination_icao: editData.destination_icao?.toUpperCase(),
        flight_duration_hours: editData.flight_duration_hours
          ? parseFloat(editData.flight_duration_hours)
          : null,
        pic_name: editData.pic_name || null,
        sic_name: editData.sic_name || null,
      });

      setIsEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditData({
      client_id: cycle.client_id || "",
      partner_id: cycle.partner_id || "",
      origin_icao: cycle.origin_icao,
      destination_icao: cycle.destination_icao,
      flight_duration_hours: cycle.flight_duration_hours?.toString() || "",
      pic_name: cycle.pic_name || "",
      sic_name: cycle.sic_name || "",
    });

    setIsEditing(false);
  };

  /* ==========================================================
     EXPENSE ALERTS
  ========================================================== */

  const getExpenseAlertLevel = (
    expense: FlightExpense
  ): "none" | "yellow" | "red" | "purple" => {
    if (
      !expense.expected_date ||
      expense.status === "paga" ||
      expense.status === "nao_aplicavel"
    ) {
      return "none";
    }

    const expectedDate = parseISO(expense.expected_date);
    const today = new Date();
    const daysUntilDue = differenceInDays(expectedDate, today);

    if (daysUntilDue < -30) return "purple";
    if (isPast(expectedDate)) return "red";
    if (daysUntilDue <= 7) return "yellow";

    return "none";
  };

  const getAlertStyles = (level: string) => {
    switch (level) {
      case "yellow":
        return "border-l-amber-400 bg-amber-500/[0.03]";

      case "red":
        return "border-l-red-500 bg-red-500/[0.03]";

      case "purple":
        return "border-l-purple-500 bg-purple-500/[0.03]";

      default:
        return "border-l-transparent";
    }
  };

  /* ==========================================================
     GROUP EXPENSES
  ========================================================== */

  const groupedExpenses = {
    imediata: expenses.filter(
      (expense) => expense.expense_category === "imediata"
    ),

    relatorio_viagem: expenses.filter(
      (expense) => expense.expense_category === "relatorio_viagem"
    ),

    regulatoria: expenses.filter(
      (expense) => expense.expense_category === "regulatoria"
    ),

    variavel: expenses.filter(
      (expense) => expense.expense_category === "variavel"
    ),
  };

  const categoryLabels = {
    imediata: "Despesas imediatas",
    relatorio_viagem: "Relatório de viagem",
    regulatoria: "Regulatórias",
    variavel: "Variáveis",
  };

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0
    );
  }, [expenses]);

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-[1600px] space-y-6 overflow-hidden rounded-[28px] border border-border/60 bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8 lg:py-6">
        {/* ====================================================
            TOP NAV
        ===================================================== */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={onBack}
            className="w-fit -ml-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para ciclos
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Operações</span>
            <span>/</span>
            <span className="font-medium text-foreground">
              {cycle.aircraft?.matricula || "N/A"}
            </span>
          </div>
        </div>

        {/* ====================================================
            HERO
        ===================================================== */}
        <section className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-[0_20px_70px_-30px_rgba(15,23,42,0.55)] sm:p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

          <div className="relative z-10">
            {!isEditing ? (
              <>
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur-xl">
                      <Plane className="h-7 w-7" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                          {cycle.aircraft?.matricula || "N/A"}
                        </h1>

                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full border-0 px-3 py-1 text-xs font-semibold",
                            statusConfig.bgColor,
                            statusConfig.color
                          )}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>

                      <p className="mt-2 text-sm font-medium text-slate-300 sm:text-base">
                        {clientName}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <HeroMeta
                          icon={MapPin}
                          value={`${cycle.origin_icao || "---"} → ${
                            cycle.destination_icao || "---"
                          }`}
                        />

                        <HeroMeta
                          icon={CalendarDays}
                          value={
                            cycle.flight_date
                              ? format(new Date(cycle.flight_date), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })
                              : "--/--/----"
                          }
                        />

                        {cycle.flight_duration_hours && (
                          <HeroMeta
                            icon={Clock3}
                            value={formatFlightDuration(
                              cycle.flight_duration_hours
                            )}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="xl:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Conclusão
                    </p>

                    <p
                      className={cn(
                        "mt-1 text-5xl font-bold tracking-tight",
                        completionPercentage === 100
                          ? "text-emerald-400"
                          : "text-white"
                      )}
                    >
                      {completionPercentage}%
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {completedExpenses} de {expenses.length} despesas
                    </p>
                  </div>
                </div>

                {/* Crew */}
                <div className="mt-7 grid grid-cols-1 gap-3 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-3">
                  <DarkInfo
                    icon={Navigation}
                    label="Origem"
                    value={cycle.origin_icao || "Não definida"}
                  />

                  <DarkInfo
                    icon={Navigation}
                    label="Destino"
                    value={cycle.destination_icao || "Não definido"}
                  />

                  <DarkInfo
                    icon={UserRound}
                    label="PIC"
                    value={cycle.pic_name || "Não informado"}
                  />

                  {cycle.sic_name && (
                    <DarkInfo icon={UserRound} label="SIC" value={cycle.sic_name} />
                  )}

                  {cycle.return_date && (
                    <DarkInfo
                      icon={CalendarDays}
                      label="Retorno"
                      value={format(new Date(cycle.return_date), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    />
                  )}

                  <DarkInfo
                    icon={WalletCards}
                    label="Total de despesas"
                    value={new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(totalExpenseAmount)}
                  />
                </div>
              </>
            ) : (
              <EditPanel
                editData={editData}
                setEditData={setEditData}
                clients={clients}
                partners={partners}
                crewMembers={crewMembers}
              />
            )}

            {/* =================================================
                ACTIONS
            ================================================== */}
            <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:flex-wrap">
              {!isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsEditing(true)}
                    className="h-10 rounded-xl"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar ciclo
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (
                        onDeleteCycle &&
                        window.confirm(
                          "Tem certeza que deseja excluir este ciclo de voo? Todas as despesas associadas também serão excluídas."
                        )
                      ) {
                        onDeleteCycle(cycle.id).then(() => onBack());
                      }
                    }}
                    className="h-10 rounded-xl text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>

                  <div className="flex-1" />

                  {cycle.status === "confirmado" && (
                    <Button
                      size="sm"
                      onClick={() => onUpdateCycleStatus(cycle.id, "em_execucao")}
                      className="h-10 rounded-xl bg-amber-500 font-semibold text-black hover:bg-amber-400"
                    >
                      <Plane className="mr-2 h-4 w-4" />
                      Iniciar voo
                    </Button>
                  )}

                  {cycle.status === "em_execucao" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        onUpdateCycleStatus(cycle.id, "aguardando_despesas")
                      }
                      className="h-10 rounded-xl bg-cyan-500 font-semibold text-black hover:bg-cyan-400"
                    >
                      Concluir voo
                    </Button>
                  )}

                  {["aguardando_despesas", "em_cobranca"].includes(
                    cycle.status
                  ) &&
                    completionPercentage === 100 && (
                      <Button
                        size="sm"
                        onClick={() =>
                          onUpdateCycleStatus(cycle.id, "finalizado")
                        }
                        className="h-10 rounded-xl bg-emerald-500 font-semibold text-black hover:bg-emerald-400"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Finalizar ciclo
                      </Button>
                    )}
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    className="h-10 rounded-xl bg-emerald-500 px-5 font-semibold text-black hover:bg-emerald-400"
                  >
                    {savingEdit ? "Salvando..." : "Salvar alterações"}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={savingEdit}
                    className="h-10 rounded-xl text-white hover:bg-white/10 hover:text-white"
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ====================================================
            KPI STRIP
        ===================================================== */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard icon={WalletCards} label="Despesas" value={expenses.length} />

          <MetricCard
            icon={CheckCircle2}
            label="Concluídas"
            value={completedExpenses}
            success
          />

          <MetricCard
            icon={Clock3}
            label="Pendentes"
            value={pendingExpenses.length}
            warning={pendingExpenses.length > 0}
          />

          <MetricCard
            icon={AlertTriangle}
            label="Atrasadas"
            value={overdueExpenses.length}
            danger={overdueExpenses.length > 0}
          />
        </section>

        {/* ====================================================
            EXPENSE SECTION
        ===================================================== */}
        <section className="rounded-[28px] border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <WalletCards className="h-5 w-5" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Financeiro do ciclo
                </p>

                <h2 className="mt-1 text-xl font-bold tracking-tight">
                  Checklist de despesas
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Controle prazos, valores e status de cada despesa.
                </p>
              </div>
            </div>

            <Button onClick={() => setAddExpenseOpen(true)} className="h-11 rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar despesa
            </Button>
          </div>

          {/* Overall progress */}
          <div className="mt-6 rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {completionPercentage === 100 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                  )}

                  <span className="text-sm font-semibold">Progresso financeiro</span>
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {completedExpenses} de {expenses.length} itens concluídos
                </p>
              </div>

              <span className="text-2xl font-bold">{completionPercentage}%</span>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  completionPercentage === 100 ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Expenses */}
          <div className="mt-8 space-y-8">
            {Object.entries(groupedExpenses).map(([category, categoryExpenses]) => {
              if (categoryExpenses.length === 0) {
                return null;
              }

              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />

                    <h3 className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </h3>

                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <div className="space-y-2">
                    {categoryExpenses.map((expense) => {
                      const alertLevel = getExpenseAlertLevel(expense);
                      const expenseStatusConfig = EXPENSE_STATUS_CONFIG[expense.status];
                      const isExpanded = expandedExpense === expense.id;

                      return (
                        <ExpenseItem
                          key={expense.id}
                          expense={expense}
                          alertLevel={alertLevel}
                          alertStyles={getAlertStyles(alertLevel)}
                          expenseStatusConfig={expenseStatusConfig}
                          isExpanded={isExpanded}
                          setExpanded={setExpandedExpense}
                          expenseEdits={expenseEdits}
                          setExpenseEdits={setExpenseEdits}
                          onUpdateExpenseStatus={onUpdateExpenseStatus}
                          onDeleteExpense={onDeleteExpense}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {expenses.length === 0 && (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-12">
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>

                  <h3 className="mt-4 text-sm font-semibold">
                    Nenhuma despesa cadastrada
                  </h3>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Comece adicionando a primeira despesa deste ciclo.
                  </p>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl"
                    onClick={() => setAddExpenseOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar despesa
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        <AddExpenseDialog
          open={addExpenseOpen}
          onOpenChange={setAddExpenseOpen}
          onAdd={(expense) => onAddExpense(cycle.id, expense)}
        />
      </div>
    </div>
  );
}

/* ===============================================================
   HERO META
================================================================ */

function HeroMeta({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span>{value}</span>
    </div>
  );
}

/* ===============================================================
   DARK INFO
================================================================ */

function DarkInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-300">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          {label}
        </p>

        <p className="mt-0.5 truncate text-xs font-semibold text-slate-200">{value}</p>
      </div>
    </div>
  );
}

/* ===============================================================
   METRIC CARD
================================================================ */

function MetricCard({
  icon: Icon,
  label,
  value,
  success = false,
  warning = false,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  success?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  const colorClass = danger
    ? "text-red-500 bg-red-500/10"
    : warning
    ? "text-amber-500 bg-amber-500/10"
    : success
    ? "text-emerald-500 bg-emerald-500/10"
    : "text-primary bg-primary/10";

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            colorClass
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>

          <p className="mt-0.5 text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ===============================================================
   EXPENSE ITEM
================================================================ */

function ExpenseItem({
  expense,
  alertLevel,
  alertStyles,
  expenseStatusConfig,
  isExpanded,
  setExpanded,
  expenseEdits,
  setExpenseEdits,
  onUpdateExpenseStatus,
  onDeleteExpense,
}: any) {
  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => setExpanded(isExpanded ? null : expense.id)}
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/70 border-l-4 bg-background",
          "transition-all duration-200",
          "hover:shadow-sm",
          alertStyles
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 p-4 text-left"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/70">
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {expense.expense_name}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {expense.expected_date && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {format(new Date(expense.expected_date), "dd/MM/yyyy")}
                    </span>
                  )}

                  {expense.amount != null && (
                    <span className="text-[11px] font-semibold text-foreground">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(expense.amount)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "hidden rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold sm:inline-flex",
                  expenseStatusConfig.bgColor,
                  expenseStatusConfig.color
                )}
              >
                {expenseStatusConfig.icon} {expenseStatusConfig.label}
              </Badge>

              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/60 bg-muted/10 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>

                <Select
                  value={expenseEdits[expense.id]?.status || expense.status}
                  onValueChange={(value) =>
                    setExpenseEdits((prev: any) => ({
                      ...prev,
                      [expense.id]: {
                        ...prev[expense.id],
                        amount: prev[expense.id]?.amount ?? expense.amount,
                        status: value as ExpenseStatus,
                      },
                    }))
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {Object.entries(EXPENSE_STATUS_CONFIG).map(
                      ([key, config]: any) => (
                        <SelectItem key={key} value={key}>
                          {config.icon} {config.label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Valor</Label>

                <Input
                  type="number"
                  placeholder="0,00"
                  className="h-11 rounded-xl bg-background"
                  value={expenseEdits[expense.id]?.amount ?? expense.amount ?? ""}
                  onChange={(event) =>
                    setExpenseEdits((prev: any) => ({
                      ...prev,
                      [expense.id]: {
                        ...prev[expense.id],
                        amount: event.target.value
                          ? parseFloat(event.target.value)
                          : null,
                        status: prev[expense.id]?.status ?? expense.status,
                      },
                    }))
                  }
                />
              </div>

              <Button
                className="h-11 rounded-xl"
                onClick={() => {
                  const newStatus =
                    expenseEdits[expense.id]?.status || expense.status;

                  const newAmount =
                    expenseEdits[expense.id]?.amount ?? expense.amount;

                  onUpdateExpenseStatus(expense.id, newStatus, {
                    amount: newAmount,
                  });

                  setExpenseEdits((prev: any) => {
                    const updated = { ...prev };
                    delete updated[expense.id];
                    return updated;
                  });
                }}
              >
                Salvar
              </Button>

              <Button
                variant="destructive"
                className="h-11 rounded-xl"
                onClick={() => {
                  if (
                    onDeleteExpense &&
                    window.confirm("Tem certeza que deseja excluir esta despesa?")
                  ) {
                    onDeleteExpense(expense.id);
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </div>

            {alertLevel !== "none" && (
              <div
                className={cn(
                  "mt-4 flex items-start gap-3 rounded-xl border p-3",
                  alertLevel === "yellow" && "border-amber-500/20 bg-amber-500/5",
                  alertLevel === "red" && "border-red-500/20 bg-red-500/5",
                  alertLevel === "purple" && "border-purple-500/20 bg-purple-500/5"
                )}
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                <p className="text-xs text-muted-foreground">
                  Esta despesa requer atenção devido ao prazo informado.
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/* ===============================================================
   EDIT PANEL
================================================================ */

function EditPanel({ editData, setEditData, clients, partners, crewMembers }: any) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Configuração do ciclo
        </p>

        <h2 className="mt-1 text-2xl font-bold">Editar informações</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-slate-300">Cliente</Label>

          <Select
            value={editData.client_id}
            onValueChange={(value) =>
              setEditData((prev: any) => ({ ...prev, client_id: value }))
            }
          >
            <SelectTrigger className="h-11 rounded-xl border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>

            <SelectContent>
              {clients.map((client: any) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.razao_social || client.proprietario || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <FlightDurationInput
          value={editData.flight_duration_hours}
          onChange={(value) =>
            setEditData((prev: any) => ({
              ...prev,
              flight_duration_hours: value,
            }))
          }
        />
      </div>

      {partners.length > 0 && (
        <div className="space-y-2">
          <Label className="text-slate-300">Sócio / Partner</Label>

          <Select
            value={editData.partner_id}
            onValueChange={(value) =>
              setEditData((prev: any) => ({ ...prev, partner_id: value }))
            }
          >
            <SelectTrigger className="h-11 rounded-xl border-white/10 bg-white/5 text-white">
              <SelectValue placeholder="Selecione um partner" />
            </SelectTrigger>

            <SelectContent>
              {partners.map((partner: any) => (
                <SelectItem key={partner.id} value={partner.id}>
                  {partner.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-slate-300">Origem · ICAO</Label>

          <Input
            value={editData.origin_icao}
            onChange={(event) =>
              setEditData((prev: any) => ({
                ...prev,
                origin_icao: event.target.value.toUpperCase(),
              }))
            }
            maxLength={4}
            placeholder="SBSP"
            className="h-11 rounded-xl border-white/10 bg-white/5 font-mono uppercase text-white"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Destino · ICAO</Label>

          <Input
            value={editData.destination_icao}
            onChange={(event) =>
              setEditData((prev: any) => ({
                ...prev,
                destination_icao: event.target.value.toUpperCase(),
              }))
            }
            maxLength={4}
            placeholder="SBBR"
            className="h-11 rounded-xl border-white/10 bg-white/5 font-mono uppercase text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CrewSelect
          label="PIC · Pilot in Command"
          value={editData.pic_name}
          members={crewMembers}
          onChange={(value: string) =>
            setEditData((prev: any) => ({ ...prev, pic_name: value }))
          }
        />

        <CrewSelect
          label="SIC · Second in Command"
          value={editData.sic_name}
          members={crewMembers}
          onChange={(value: string) =>
            setEditData((prev: any) => ({ ...prev, sic_name: value }))
          }
        />
      </div>
    </div>
  );
}

/* ===============================================================
   CREW SELECT
================================================================ */

function CrewSelect({ label, value, members, onChange }: any) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-300">{label}</Label>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 rounded-xl border-white/10 bg-white/5 text-white">
          <SelectValue placeholder="Selecione o piloto" />
        </SelectTrigger>

        <SelectContent>
          {members.map((member: any) => (
            <SelectItem key={member.id} value={member.full_name}>
              <div className="flex items-center gap-2">
                <span>{member.full_name}</span>
                <span className="text-xs text-muted-foreground">
                  ({member.canac})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}