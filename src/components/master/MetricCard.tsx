import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "primary" | "success" | "destructive" | "warning" | "default";
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
}: MetricCardProps) {
  const variantClasses = {
    primary: "border-primary/30 bg-primary/5",
    success: "border-success/30 bg-success/5",
    destructive: "border-destructive/30 bg-destructive/5",
    warning: "border-warning/30 bg-warning/5",
    default: "border-border bg-card/50",
  };

  const iconColorClasses = {
    primary: "text-primary",
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
    default: "text-foreground",
  };

  return (
    <Card className={cn("border transition-all hover:shadow-md", variantClasses[variant])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="space-y-1 flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={cn("p-2 rounded-lg bg-current/10")}>
              <Icon className={cn("w-5 h-5", iconColorClasses[variant])} />
            </div>
          )}
        </div>

        {trend && (
          <div className="flex items-center gap-1.5 text-xs">
            {trend.isPositive ? (
              <ArrowUp className="w-3 h-3 text-success" />
            ) : (
              <ArrowDown className="w-3 h-3 text-destructive" />
            )}
            <span className={trend.isPositive ? "text-success" : "text-destructive"}>
              {trend.value}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
