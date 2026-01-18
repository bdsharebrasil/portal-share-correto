import { useLoading } from "@/contexts/LoadingContext";
import { LottieAirplaneSpinner } from "./lottie-airplane-spinner";

export function GlobalLoader() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <LottieAirplaneSpinner size="lg" text="Carregando..." />
    </div>
  );
}
