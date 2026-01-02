import { useLoading } from "@/contexts/LoadingContext";
import { AirplaneSpinner } from "./airplane-spinner";

export function GlobalLoader() {
  const { isLoading } = useLoading();

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <AirplaneSpinner size="lg" text="Carregando..." />
    </div>
  );
}
