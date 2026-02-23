import { Plane } from "lucide-react";

interface LoadingPlaneProps {
  size?: "sm" | "md" | "lg";
}

export const LoadingPlane = ({ size = "md" }: LoadingPlaneProps) => {
  const sizeClasses = {
    sm: "h-32",
    md: "h-48",
    lg: "h-64"
  };

  const planeSize = {
    sm: 24,
    md: 32,
    lg: 48
  };

  return (
    <div className={`relative w-full ${sizeClasses[size]} flex items-center justify-center overflow-hidden`}>
      {/* Nuvens de fundo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute top-4 left-[10%] w-20 h-12 bg-muted/30 rounded-full blur-xl animate-plane-pulse" />
        <div className="absolute top-8 right-[15%] w-24 h-14 bg-muted/25 rounded-full blur-xl animate-plane-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-8 left-[20%] w-16 h-10 bg-muted/35 rounded-full blur-xl animate-plane-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-4 right-[25%] w-28 h-16 bg-muted/20 rounded-full blur-xl animate-plane-pulse" style={{ animationDelay: "1.5s" }} />
      </div>

      {/* Avião voando */}
      <div className="relative z-10">
        <div className="animate-plane-fly">
          <Plane 
            size={planeSize[size]} 
            className="text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
            style={{ transform: "rotate(-10deg)" }}
          />
        </div>
      </div>

      {/* Rastro do avião */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-32 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-plane-trail" />
      </div>
    </div>
  );
};
