import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "./StatusPill";
import { Clock, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { useAtividadesRecentes } from "@/hooks/useAtividadesRecentes";
import { cn } from "@/lib/utils";

export function ActivityFeed() {
  const { data: activities = [], isLoading } = useAtividadesRecentes();

  return (
    <Card className="border-border bg-card h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Atividades Recentes
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Últimas movimentações financeiras
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <Clock className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Nenhuma atividade registrada</p>
          </div>
        ) : (
          activities.slice(0, 6).map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors group"
            >
              <div className={cn(
                "p-2 rounded-lg",
                activity.tipo_movimento === "entrada" 
                  ? "bg-success/10" 
                  : "bg-destructive/10"
              )}>
                {activity.tipo_movimento === "entrada" ? (
                  <ArrowUpRight className="w-4 h-4 text-success" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {activity.descricao}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{activity.timeAgo}</span>
                  <StatusPill status={activity.status || "pending"} />
                </div>
              </div>
              <div className={cn(
                "text-sm font-semibold whitespace-nowrap",
                activity.tipo_movimento === "entrada" ? "text-success" : "text-destructive"
              )}>
                {activity.tipo_movimento === "entrada" ? "+" : "-"}
                R$ {activity.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
