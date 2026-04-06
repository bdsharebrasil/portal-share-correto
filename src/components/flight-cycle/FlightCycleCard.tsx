import { Plane, ChevronRight, Clock, MapPin, User, Calendar } from "lucide-react";
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

export function FlightCycleCard({ cycle, onClick }: FlightCycleCardProps) {
  const statusConfig = FLIGHT_STATUS_CONFIG[cycle.status];
  
  // Calculate checklist completion
  const expenses = cycle.expenses || [];
  const completedExpenses = expenses.filter(e => 
    ['paga', 'nao_aplicavel'].includes(e.status)
  ).length;
  const totalExpenses = expenses.length;
  const completionPercentage = totalExpenses > 0 
    ? Math.round((completedExpenses / totalExpenses) * 100) 
    : 0;

  // Check for overdue expenses
  const hasOverdue = expenses.some(e => e.status === 'atrasada');

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card/50 backdrop-blur-sm p-4 cursor-pointer",
        "hover:bg-card/80 hover:border-primary/30 transition-all duration-200",
        "group",
        hasOverdue && "border-red-500/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Plane className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">
                {cycle.aeronave?.matricula || 'N/A'}
              </span>
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs border-0",
                  statusConfig.bgColor,
                  statusConfig.color
                )}
              >
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {cycle.nome_socio || cycle.client?.razao_social || cycle.client?.proprietario || 'Cliente não definido'}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>

      {/* Route & Dates */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-3">
        <MapPin className="h-4 w-4" />
        <span className="font-mono">
          {cycle.origin_icao} → {cycle.destination_icao}
        </span>
        <span className="mx-1">•</span>
        <Calendar className="h-4 w-4" />
        <span>
          {format(new Date(cycle.flight_date), "dd/MM/yyyy", { locale: ptBR })}
        </span>
        {cycle.return_date && (
          <>
            <span>→</span>
            <span>
              {format(new Date(cycle.return_date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </>
        )}
      </div>

      {/* Progress */}
      {totalExpenses > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Conclusão do Checklist</span>
            <span className={cn(
              "font-medium",
              completionPercentage === 100 ? "text-emerald-400" : "text-foreground"
            )}>
              {completionPercentage}%
            </span>
          </div>
          <Progress 
            value={completionPercentage} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {completedExpenses} de {totalExpenses} despesas concluídas
          </p>
        </div>
      )}

      {/* Alerts */}
      {hasOverdue && (
        <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <span>⚠️</span>
          <span>Há despesas atrasadas neste voo</span>
        </div>
      )}
    </div>
  );
}
