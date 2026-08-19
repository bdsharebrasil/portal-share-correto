import {
  Plane,
  ChevronRight,
  Clock,
  MapPin,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  WalletCards,
} from "lucide-react";
import { FlightCycle, FLIGHT_STATUS_CONFIG } from "@/types/flightCycle";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FlightCycleCardProps {
  cycle: FlightCycle;
  onClick: () => void;
}

export function FlightCycleCard({
  cycle,
  onClick,
}: FlightCycleCardProps) {
  const statusConfig = FLIGHT_STATUS_CONFIG[cycle.status];

  const expenses = cycle.expenses || [];

  const completedExpenses = expenses.filter((expense) =>
    ["paga", "nao_aplicavel"].includes(expense.status)
  ).length;

  const totalExpenses = expenses.length;

  const completionPercentage =
    totalExpenses > 0
      ? Math.round((completedExpenses / totalExpenses) * 100)
      : 0;

  const hasOverdue = expenses.some(
    (expense) => expense.status === "atrasada"
  );

  const pendingExpenses = expenses.filter(
    (expense) =>
      !["paga", "nao_aplicavel"].includes(expense.status)
  ).length;

  const clientName =
    cycle.partner_name ||
    cycle.client?.company_name ||
    cycle.client?.proprietario ||
    "Cliente não definido";

  const formattedDate = cycle.flight_date
    ? format(new Date(cycle.flight_date), "dd MMM yyyy", {
        locale: ptBR,
      })
    : "Data não definida";

  const formattedReturnDate = cycle.return_date
    ? format(new Date(cycle.return_date), "dd MMM", {
        locale: ptBR,
      })
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-[24px] border text-left",
        "bg-card shadow-sm transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        hasOverdue
          ? "border-red-500/25"
          : "border-border/70 hover:border-primary/30"
      )}
    >
      {/* Accent line */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          hasOverdue
            ? "bg-gradient-to-r from-red-500 via-red-400 to-transparent"
            : "bg-gradient-to-r from-primary via-primary/50 to-transparent"
        )}
      />

      <div className="p-5">
        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                hasOverdue
                  ? "bg-red-500/10 text-red-500"
                  : "bg-primary/10 text-primary"
              )}
            >
              <Plane className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-bold tracking-tight">
                  {cycle.aircraft?.matricula || "N/A"}
                </h3>

                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold",
                    statusConfig.bgColor,
                    statusConfig.color
                  )}
                >
                  {statusConfig.label}
                </Badge>
              </div>

              <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                {clientName}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              "bg-muted/60 text-muted-foreground",
              "transition-all duration-200",
              "group-hover:bg-primary group-hover:text-primary-foreground"
            )}
          >
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </div>
        </div>

        {/* =====================================================
            ROUTE
        ====================================================== */}
        <div className="mt-5 rounded-2xl border border-border/60 bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
              <MapPin className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Rota
              </p>

              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider">
                  {cycle.origin_icao || "---"}
                </span>

                <div className="h-px min-w-5 flex-1 bg-border" />

                <Plane className="h-3.5 w-3.5 shrink-0 rotate-90 text-primary" />

                <div className="h-px min-w-5 flex-1 bg-border" />

                <span className="font-mono text-sm font-bold tracking-wider">
                  {cycle.destination_icao || "---"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            INFORMATION GRID
        ====================================================== */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <InfoItem
            icon={CalendarDays}
            label="Partida"
            value={formattedDate}
          />

          <InfoItem
            icon={Clock}
            label="Duração"
            value={
              cycle.flight_duration_hours
                ? `${cycle.flight_duration_hours}h`
                : "Não informada"
            }
          />
        </div>

        {formattedReturnDate && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />

            <span>
              Retorno previsto em{" "}
              <strong className="font-semibold text-foreground">
                {formattedReturnDate}
              </strong>
            </span>
          </div>
        )}

        {/* =====================================================
            CHECKLIST
        ====================================================== */}
        <div className="mt-5 border-t border-border/60 pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <WalletCards className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold">
                  Controle financeiro
                </p>

                <p className="truncate text-[11px] text-muted-foreground">
                  Checklist de despesas
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-xl font-bold tracking-tight",
                  completionPercentage === 100
                    ? "text-emerald-500"
                    : "text-foreground"
                )}
              >
                {completionPercentage}%
              </p>

              <p className="text-[10px] text-muted-foreground">
                concluído
              </p>
            </div>
          </div>

          <Progress
            value={completionPercentage}
            className="h-2 overflow-hidden rounded-full"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              {completedExpenses} de {totalExpenses} despesas concluídas
            </span>

            {pendingExpenses > 0 && (
              <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                {pendingExpenses} pendente
                {pendingExpenses > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* =====================================================
            ALERT
        ====================================================== */}
        {hasOverdue && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
              <AlertTriangle className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                Atenção necessária
              </p>

              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                Existem despesas atrasadas neste ciclo.
              </p>
            </div>
          </div>
        )}

        {/* =====================================================
            FOOTER
        ====================================================== */}
        <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-4">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {completionPercentage === 100 ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Checklist completo</span>
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" />
                <span>Acompanhamento pendente</span>
              </>
            )}
          </div>

          <span className="text-[11px] font-semibold text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Ver detalhes →
          </span>
        </div>
      </div>
    </button>
  );
}

/* ===============================================================
   INFO ITEM
================================================================ */

interface InfoItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: InfoItemProps) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-background/70 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
      </div>

      <p className="mt-1 truncate text-xs font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}