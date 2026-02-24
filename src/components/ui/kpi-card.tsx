import React from "react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface KPICardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  gradient?: {
    from: string;
    to: string;
  };
  sparklineData?: Array<{ value: number }>;
  className?: string;
  onClick?: () => void;
}

export const KPICard = React.forwardRef<HTMLDivElement, KPICardProps>(
  (
    {
      label,
      value,
      icon,
      trend,
      trendLabel,
      gradient = { from: "from-emerald-500/20", to: "to-teal-500/10" },
      sparklineData,
      className = "",
      onClick,
    },
    ref
  ) => {
    const hasPositiveTrend = trend && trend > 0;

    return (
      <motion.div
        ref={ref}
        className={`relative group cursor-pointer overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-300 hover:shadow-xl ${className}`}
        onClick={onClick}
        whileHover={{ scale: 1.02, y: -2 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Glassmorphism Background with Gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} bg-white/5 group-hover:bg-white/8 transition-colors`} />
        
        {/* Gradient Border */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${gradient} opacity-20 group-hover:opacity-30 -inset-[1px] transition-opacity pointer-events-none`}
          style={{
            zIndex: -1,
            filter: "blur(1px)",
          }}
        />

        {/* Content */}
        <div className="relative p-6 space-y-4 border border-white/10 rounded-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-foreground/60 font-medium mb-2">
                {label}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-3xl font-bold text-foreground tracking-tight">
                  {value}
                </h3>
              </div>
            </div>
            {icon && (
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 group-hover:from-primary/40 group-hover:to-primary/20 transition-colors">
                {icon}
              </div>
            )}
          </div>

          {/* Trend Badge */}
          {trend !== undefined && (
            <div className="flex items-center gap-2">
              <div
                className={`px-3 py-1 rounded-lg text-sm font-semibold flex items-center gap-1 ${
                  hasPositiveTrend
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                <span>{hasPositiveTrend ? "↑" : "↓"}</span>
                <span>{Math.abs(trend)}%</span>
              </div>
              {trendLabel && (
                <p className="text-xs text-foreground/60">{trendLabel}</p>
              )}
            </div>
          )}

          {/* Sparkline Chart */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="h-12 -mx-2 opacity-70 group-hover:opacity-100 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);

KPICard.displayName = "KPICard";
