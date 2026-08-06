import React from "react";
import { ArrowLeft, LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ---------------- formatters ---------------- */

export const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

export const brlFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

export const compact = (v: number) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
};

/* ---------------- tokens ---------------- */

export const tabsListClass =
  "flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-xl border border-border/60 bg-card/50 p-1 backdrop-blur-xl custom-scrollbar";

export const tabTriggerClass =
  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-all data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm sm:text-sm";

const TONES = {
  primary: "from-primary/25 to-primary/0 text-primary",
  success: "from-emerald-500/25 to-emerald-500/0 text-emerald-400",
  danger: "from-destructive/25 to-destructive/0 text-destructive",
  warning: "from-amber-500/25 to-amber-500/0 text-amber-400",
  neutral: "from-muted-foreground/20 to-muted-foreground/0 text-muted-foreground",
} as const;

const BAR_TONES = {
  primary: "bg-primary",
  success: "bg-emerald-500",
  danger: "bg-destructive",
  warning: "bg-amber-500",
  neutral: "bg-muted-foreground/60",
} as const;

export type Tone = keyof typeof TONES;

/* ---------------- components ---------------- */

export function GlassCard({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl border border-border/60",
        "bg-card/60 backdrop-blur-xl shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)]",
        "transition-all duration-300 hover:border-primary/40 hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.35)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
  back = false,
  backTo,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  back?: boolean;
  backTo?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card/60 to-card/30 p-4 backdrop-blur-xl sm:p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {back && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
              onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {Icon && (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-foreground sm:text-2xl">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  delay = 0,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  delay?: number;
}) {
  return (
    <GlassCard
      className="group animate-fade-in p-4 sm:p-5"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
          TONES[tone]
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1.5 truncate text-xl font-bold text-foreground sm:text-2xl">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br", TONES[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </GlassCard>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <GlassCard className={cn("animate-fade-in", className)}>
      {(title || action) && (
        <div className="flex flex-col gap-2 border-b border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</h2>}
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </GlassCard>
  );
}

export function MiniBar({
  value,
  max,
  tone = "primary",
}: {
  value: number;
  max: number;
  tone?: Tone;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", BAR_TONES[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
