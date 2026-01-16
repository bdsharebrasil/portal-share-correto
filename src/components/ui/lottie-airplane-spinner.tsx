import React, { useState, useEffect } from "react";
import Lottie from "lottie-react";
import { cn } from "@/lib/utils";

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
  const [animationData, setAnimationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAnimation = async () => {
      try {
        const response = await fetch("/animations/airplane-spinner.json");
        const data = await response.json();
        setAnimationData(data);
      } catch (error) {
        console.error("Failed to load animation:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnimation();
  }, []);

  const containerClasses = {
    sm: "h-40 w-40",
    md: "h-56 w-56",
    lg: "h-72 w-72",
  };

  const textClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  if (isLoading || !animationData) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
        <div className={cn("flex items-center justify-center animate-pulse", containerClasses[size])}>
          <div className="w-full h-full bg-muted rounded-lg" />
        </div>
        {text && (
          <p className={cn("text-muted-foreground font-medium", textClasses[size])}>
            {text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        className
      )}
    >
      <div className={cn("flex items-center justify-center", containerClasses[size])}>
        <Lottie
          animationData={animationData}
          loop={true}
          autoplay={true}
        />
      </div>

      {text && (
        <p className={cn("text-muted-foreground font-medium", textClasses[size])}>
          {text}
        </p>
      )}
    </div>
  );
}
