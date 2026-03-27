import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OASOilAnalysisSection } from "./OASOilAnalysisSection";
import { Card, CardContent } from "@/components/ui/card";
import { Droplets } from "lucide-react";

interface Props {
  aircraftId: string;
}

export function CTMOilAnalysisTab({ aircraftId }: Props) {
  const queryClient = useQueryClient();

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["oil-analysis", aircraftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oil_analysis")
        .select("*")
        .eq("aircraft_id", aircraftId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!aircraftId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Droplets className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <OASOilAnalysisSection
      orderId=""
      aircraftId={aircraftId}
      analyses={analyses}
      onRefetch={() => queryClient.invalidateQueries({ queryKey: ["oil-analysis", aircraftId] })}
    />
  );
}
