import {
  Plane,
  ChevronRight,
  Clock,
  MapPin,
  CalendarDays,
  AlertTriangle,
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

function getFlightNumber(cycle: FlightCycle) {
  const explicit = (cycle as any).flight_number as string | undefined;
  if (explicit) return explicit;
  return cycle.id ? cycle.id.slice(0, 8).toUpperCase() : "—";
}

export function FlightCycleCard({ cycle, onClick }: FlightCycleCardProps) {
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

  const hasOverdue = expenses.some((expense) => expense.status === "atrasada");

  const clientName =
    cycle.partner_name ||
    cycle.client?.company_name ||
    cycle.client?.proprietario ||
    "Cliente não definido";

  const formattedDate = cycle.flight_date
    ? format(new Date(cycle.flight_date), "dd MMM yyyy", { locale: ptBR })
    : "Data não definida";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border text-left",
        "bg-card shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5",
        "focus:outline-none focus:ring-2 focus:ring-primary/30",
        hasOverdue
          ? "border-red-500/25"
          : "border-border/70 hover:border-primary/30"
      )}
    >
      {/* Accent line */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[3px]",
          hasOverdue
            ? "bg-gradient-to-r from-red-500 via-red-400 to-transparent"
            : "bg-gradient-to-r from-primary via-primary/50 to-transparent"
        )}
      />

      <div className="p-4">
        {/* =====================================================
            HEADER
        ====================================================== */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                hasOverdue
                  ? "bg-red-500/10 text-red-500"
                  : "bg-primary/10 text-primary"
              )}
            >
              <Plane className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h3 className="truncate text-sm font-bold tracking-tight">
                  {cycle.aircraft?.matricula || "N/A"}
                </h3>

                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
                  #{getFlightNumber(cycle)}
                </span>
              </div>

              <p className="truncate text-xs text-muted-foreground">
                {clientName}
              </p>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>

        {/* =====================================================
            STATUS + ROUTE
        ====================================================== */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "rounded-full border-0 px-2 py-0.5 text-[10px] font-semibold",
              statusConfig.bgColor,
              statusConfig.color
            )}
          >
            {statusConfig.label}
          </Badge>

          <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
            <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
            {cycle.origin_icao || "---"} → {cycle.destination_icao || "---"}
          </span>

          {hasOverdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
              <AlertTriangle className="h-2.5 w-2.5" />
              Atrasada
            </span>
          )}
        </div>

        {/* =====================================================
            META
        ====================================================== */}
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {formattedDate}
          </span>

          {cycle.flight_duration_hours ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {cycle.flight_duration_hours}h
            </span>
          ) : null}
        </div>

        {/* =====================================================
            PROGRESS
        ====================================================== */}
        <div className="mt-3 flex items-center gap-2.5">
          <Progress
            value={completionPercentage}
            className="h-1.5 flex-1 overflow-hidden rounded-full"
          />

          <span
            className={cn(
              "shrink-0 text-xs font-bold tabular-nums",
              completionPercentage === 100
                ? "text-emerald-500"
                : "text-foreground"
            )}
          >
            {completionPercentage}%
          </span>
        </div>

        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {completedExpenses} de {totalExpenses} despesas concluídas
        </p>
      </div>
    </button>
  );
}