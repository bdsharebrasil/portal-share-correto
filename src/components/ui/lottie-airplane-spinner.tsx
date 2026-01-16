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
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAnimation = async () => {
      try {
        const response = await fetch("/animations/airplane-spinner.json");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setAnimationData(data);
      } catch (err) {
        console.error("Failed to load airplane animation:", err);
        setError("Falha ao carregar animação");
      }
    };

    loadAnimation();
  }, []);

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

  // Fallback to CSS airplane if animation fails
  if (error || !animationData) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
        <div className="relative flex items-center justify-center">
          <div 
            className="animate-bounce"
            style={{ width: lottieSize[size], height: lottieSize[size] / 1.5 }}
          >
            <svg
              viewBox="0 0 200 140"
              className="w-full h-full drop-shadow-lg text-cyan-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Corpo do avião */}
              <path d="M 40 80 Q 100 60 160 80" fill="none" />
              {/* Asa esquerda */}
              <path d="M 70 80 L 30 70" fill="none" />
              {/* Asa direita */}
              <path d="M 130 80 L 170 70" fill="none" />
              {/* Cauda esquerda */}
              <path d="M 40 80 L 20 90" strokeWidth="4" fill="none" />
              {/* Cauda direita */}
              <path d="M 40 80 L 20 70" strokeWidth="4" fill="none" />
              {/* Cockpit */}
              <circle cx="145" cy="72" r="6" fill="currentColor" />
            </svg>
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

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        className
      )}
    >
      <div 
        className="flex items-center justify-center"
        style={{ width: lottieSize[size], height: lottieSize[size] }}
      >
        <Lottie
          animationData={animationData}
          loop={true}
          autoplay={true}
          style={{ width: "100%", height: "100%" }}
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
