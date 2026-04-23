import React from "react";
import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "sm" }: StatusPillProps) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    aprovado: { bg: "bg-success/10", text: "text-success", label: "Aprovado" },
    pendente: { bg: "bg-warning/10", text: "text-warning", label: "Pendente" },
    rejected: { bg: "bg-destructive/10", text: "text-destructive", label: "Rejeitado" },
    pending: { bg: "bg-warning/10", text: "text-warning", label: "Pendente" },
    completed: { bg: "bg-success/10", text: "text-success", label: "Concluído" },
    cancelled: { bg: "bg-destructive/10", text: "text-destructive", label: "Cancelado" },
  };

  const config = statusConfig[status.toLowerCase()] || {
    bg: "bg-secondary/50",
    text: "text-muted-foreground",
    label: status,
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
  };

  return (
    <span
      className={cn(
        "inline-block rounded-full font-medium transition-colors",
        config.bg,
        config.text,
        sizeClasses[size]
      )}
    >
      {config.label}
    </span>
  );
}
