import React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  variant?: "primary" | "success" | "warning" | "destructive";
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({
  label,
  value,
  max,
  variant = "primary",
  size = "md",
}: ProgressBarProps) {
  const percentage = (value / max) * 100;

  const variantClasses = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs font-semibold text-muted-foreground">
          {value.toLocaleString("pt-BR")} / {max.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="w-full bg-secondary/50 rounded-full overflow-hidden">
        <div
          className={cn(
            "rounded-full transition-all duration-500",
            variantClasses[variant],
            sizeClasses[size]
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {Math.round(percentage)}%
      </div>
    </div>
  );
}
