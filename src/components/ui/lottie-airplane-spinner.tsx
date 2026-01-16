import React, { useState, useEffect, useRef } from "react";
import Lottie from "lottie-react";
import { cn } from "@/lib/utils";
import { Plane } from "lucide-react";

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
  const [loadFailed, setLoadFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    
    const loadAnimation = async () => {
      try {
        const response = await fetch("/animations/airplane-spinner.json");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (mounted.current) {
          setAnimationData(data);
        }
      } catch (err) {
        console.error("Failed to load airplane animation:", err);
        if (mounted.current) {
          setLoadFailed(true);
        }
      }
    };

    loadAnimation();
    
    return () => {
      mounted.current = false;
    };
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

  // Não mostra nada enquanto carrega a animação Lottie
  if (!animationData) {
    return null;
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
