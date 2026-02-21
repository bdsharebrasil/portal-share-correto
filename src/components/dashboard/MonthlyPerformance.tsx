import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "./ProgressBar";
import { TrendingUp, Target, Calendar } from "lucide-react";

interface PerformanceMetric {
  label: string;
  current: number;
  target: number;
  variant: "primary" | "success" | "warning" | "destructive";
}

const metrics: PerformanceMetric[] = [
  { label: "Receitas vs Meta", current: 85000, target: 100000, variant: "primary" },
  { label: "Redução de Custos", current: 72, target: 100, variant: "success" },
  { label: "Novos Clientes", current: 8, target: 10, variant: "warning" },
  { label: "Projetos Concluídos", current: 12, target: 15, variant: "primary" },
];

export function MonthlyPerformance() {
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-foreground">
                Performance Mensal
              </CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                {currentMonth}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            +15%
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {metrics.map((metric, index) => (
          <ProgressBar
            key={index}
            label={metric.label}
            value={metric.current}
            max={metric.target}
            variant={metric.variant}
            size="md"
          />
        ))}
      </CardContent>
    </Card>
  );
}
