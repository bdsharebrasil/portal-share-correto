import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import aviationHero from "@/assets/aviation-hero.jpg";

export function DashboardHero() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const fetchName = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      setDisplayName(data?.display_name || "");
    };
    fetchName();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <div className="relative mb-6 rounded-xl overflow-hidden">
      <div
        className="h-40 bg-cover bg-center bg-no-repeat relative"
        style={{ backgroundImage: `url(${aviationHero})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

        <div className="relative h-full flex items-center px-6">
          <div>
            <p className="text-xs text-primary font-medium uppercase tracking-widest mb-1">
              Dashboard Operacional
            </p>
            <h1 className="text-3xl font-bold text-foreground">
              {getGreeting()}, {displayName || "Comandante"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Resumo do dia: Confira o status da frota, vencimentos próximos e agendamentos pendentes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
