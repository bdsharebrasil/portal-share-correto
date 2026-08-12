import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type Tone = "success" | "warning" | "info" | "neutral";

const tones: Record<Tone, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  neutral: "border-border bg-muted text-muted-foreground",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Estilo semântico opcional (usado em telas legadas). */
  tone?: Tone;
  icon?: React.ReactNode;
}

function Badge({ className, variant, tone, icon, children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        tone ? `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}` : badgeVariants({ variant }),
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
