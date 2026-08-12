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
    <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-white/[0.06] shadow-2xl h-32 md:h-40 lg:h-48">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60 mix-blend-overlay"
        style={{ backgroundImage: `url(${aviationHero})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/45 to-background/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
        <div className="relative z-10 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs md:text-sm font-semibold text-primary uppercase tracking-wider drop-shadow-md mt-[51px] mb-[51px]">
              Dashboard Operações
            </span>
          </div>
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight -mt-[8px] -mb-[8px] pt-0 pb-0">
            {getGreeting()}, {displayName || "Comandante"}
          </h1>
          
        </div>
      </div>
    </div>
  );
}
