import { useLoading } from "@/contexts/LoadingContext";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import FlightLottie from "@/assets/Flight.lottie";

export function GlobalLoader() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2">
        <DotLottieReact
          src={FlightLottie}
          loop
          autoplay
          style={{ width: 180, height: 180 }}
        />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    </div>
  );
}