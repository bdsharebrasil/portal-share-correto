import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: "approved" | "pending" | "rejected" | string;
  label?: string;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-success/10", text: "text-success", label: "Aprovado" },
  confirmado: { bg: "bg-success/10", text: "text-success", label: "Confirmado" },
  recebido: { bg: "bg-success/10", text: "text-success", label: "Recebido" },
  pago: { bg: "bg-success/10", text: "text-success", label: "Pago" },
  pending: { bg: "bg-warning/10", text: "text-warning", label: "Pendente" },
  pendente: { bg: "bg-warning/10", text: "text-warning", label: "Pendente" },
  aguardando_reembolso: { bg: "bg-warning/10", text: "text-warning", label: "Aguardando" },
  rejected: { bg: "bg-destructive/10", text: "text-destructive", label: "Rejeitado" },
  cancelado: { bg: "bg-destructive/10", text: "text-destructive", label: "Cancelado" },
};

export function StatusPill({ status, label, className }: StatusPillProps) {
  const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all",
      config.bg,
      config.text,
      className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", config.text.replace("text-", "bg-"))} />
      {label || config.label}
    </span>
  );
}
