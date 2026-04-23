import { Plane, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlightCycleStatsProps {
  activeFlights: number;
  overdueExpenses: number;
  completedFlights: number;
  pendingExpenses: number;
}

export function FlightCycleStats({
  activeFlights,
  overdueExpenses,
  completedFlights,
  pendingExpenses,
}: FlightCycleStatsProps) {
  const stats = [
    {
      label: "Voos Ativos",
      value: activeFlights,
      icon: Plane,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      label: "Despesas Atrasadas",
      value: overdueExpenses,
      icon: AlertTriangle,
      color: overdueExpenses > 0 ? "text-red-400" : "text-emerald-400",
      bgColor: overdueExpenses > 0 ? "bg-red-500/10" : "bg-emerald-500/10",
      borderColor: overdueExpenses > 0 ? "border-red-500/20" : "border-emerald-500/20",
    },
    {
      label: "Voos Finalizados",
      value: completedFlights,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Despesas Pendentes",
      value: pendingExpenses,
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={cn(
            "rounded-xl border p-4 backdrop-blur-sm",
            stat.bgColor,
            stat.borderColor
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <stat.icon className={cn("h-4 w-4", stat.color)} />
          </div>
          <p className={cn("text-3xl font-bold", stat.color)}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
