import React from "react";
import { cn } from "@/lib/utils";

interface AirplaneSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export function AirplaneSpinner({
  size = "md",
  text = "Carregando ...",
  className,
}: AirplaneSpinnerProps) {
  const containerClasses = {
    sm: "h-40 w-full",
    md: "h-56 w-full",
    lg: "h-72 w-full",
  };

  const textClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-gradient-to-b from-cyan-100/30 to-cyan-50/20 border border-cyan-200/30",
          containerClasses[size]
        )}
      >
        {/* Nuvens passando - Superior */}
        <div className="absolute top-8 left-0 right-0 z-0 opacity-60">
          <div className="flex gap-8 animate-scroll-left">
            {[...Array(6)].map((_, i) => (
              <Cloud key={i} size={i % 3 === 0 ? "sm" : i % 3 === 1 ? "lg" : "md"} />
            ))}
          </div>
        </div>

        {/* Nuvens passando - Inferior */}
        <div className="absolute bottom-12 left-0 right-0 z-0 opacity-50">
          <div className="flex gap-12 animate-scroll-right">
            {[...Array(6)].map((_, i) => (
              <Cloud key={i} size={i % 3 === 0 ? "md" : i % 3 === 1 ? "sm" : "lg"} />
            ))}
          </div>
        </div>

        {/* Avião */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="animate-plane-float">
            <Airplane />
          </div>
        </div>
      </div>

      {text && (
        <p className={cn("text-muted-foreground font-medium", textClasses[size])}>
          {text}
        </p>
      )}
    </div>
  );
}

function Airplane() {
  return (
    <svg viewBox="0 0 200 140" className="w-24 h-24 drop-shadow-lg" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <g className="text-cyan-600">
        <path d="M 40 80 Q 100 60 160 80" strokeWidth="5" fill="none" />
        <path d="M 70 80 L 30 70" strokeWidth="5" fill="none" />
        <path d="M 130 80 L 170 70" strokeWidth="5" fill="none" />
        <path d="M 40 80 L 20 90" strokeWidth="4" fill="none" />
        <path d="M 40 80 L 20 70" strokeWidth="4" fill="none" />
        <circle cx="130" cy="75" r="6" fill="currentColor" />
      </g>
    </svg>
  );
}

function Cloud({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "w-16 h-10", md: "w-24 h-14", lg: "w-32 h-20" };
  return (
    <svg viewBox="0 0 100 60" className={cn("text-cyan-400/70 flex-shrink-0", sizeClasses[size])} fill="currentColor">
      <path d="M 15 40 Q 10 25 25 15 Q 35 5 50 8 Q 60 2 72 12 Q 85 8 85 25 Q 92 20 95 35 Q 92 50 75 52 Q 55 58 35 55 Q 20 55 15 40 Z" />
    </svg>
  );
}
