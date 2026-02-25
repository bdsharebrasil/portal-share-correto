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
        console.warn("Airplane animation not available, using fallback");
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

  const iconSize = {
    sm: 40,
    md: 60,
    lg: 80,
  };

  const textClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  // Fallback spinner when animation fails to load
  if (loadFailed || !animationData) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4",
          className
        )}
      >
        <div
          className="flex items-center justify-center animate-spin"
          style={{ width: lottieSize[size], height: lottieSize[size] }}
        >
          <Plane
            size={iconSize[size]}
            className="text-primary opacity-70"
            style={{
              animation: "spin 3s linear infinite",
            }}
          />
        </div>

        {text && (
          <p className={cn("text-muted-foreground font-medium", textClasses[size])}>
            {text}
          </p>
        )}

        <style>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
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
