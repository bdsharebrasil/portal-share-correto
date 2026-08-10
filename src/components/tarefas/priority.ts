import { AlertTriangle, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Priority } from "@/components/tarefas/types";

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

export const PRIORIDADES: Record<
  Priority,
  { label: string; icon: LucideIcon; cor: string; chip: string }
> = {
  baixa: {
    label: "Baixa",
    icon: SignalLow,
    cor: "text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  },
  media: {
    label: "Média",
    icon: SignalMedium,
    cor: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  },
  alta: {
    label: "Alta",
    icon: SignalHigh,
    cor: "text-orange-400",
    chip: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  },
  urgente: {
    label: "Urgente",
    icon: AlertTriangle,
    cor: "text-rose-400",
    chip: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  },
};

export function normalizePriority(p: string | null | undefined): Priority {
  return (p as Priority) in PRIORIDADES ? (p as Priority) : "media";
}