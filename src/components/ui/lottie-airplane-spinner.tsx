import React from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { cn } from "@/lib/utils";
import FlightLottie from "@/assets/Flight.lottie";

interface LottieAirplaneSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export function LottieAirplaneSpinner({
  size = "md",
  text = "Carregando...",
  className,
}: LottieAirplaneSpinnerProps) {
  const lottieSize = {
    sm: 120,
    md: 180,
    lg: 240,
  };

  const textClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        className
      )}
    >
      <DotLottieReact
        src={FlightLottie}
        loop
        autoplay
        style={{ width: lottieSize[size], height: lottieSize[size] }}
      />

      {text && (
        <p className={cn("text-muted-foreground font-medium", textClasses[size])}>
          {text}
        </p>
      )}
    </div>
  );
}
