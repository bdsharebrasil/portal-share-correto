import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ManualTutorial {
  id: string;
  titulo: string;
  descricao: string;
  video_url: string | null;
  categoria: string;
  ordem: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["manual_tutoriais"];

export function useManualTutoriais() {
  return useQuery<ManualTutorial[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_tutoriais")
        .select("*")
        .order("categoria", { ascending: true })
        .order("ordem", { ascending: true });

      if (error) throw error;
      return (data || []) as ManualTutorial[];
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateManualTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ManualTutorial, "id" | "created_at" | "updated_at" | "criado_por">) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("manual_tutoriais")
        .insert({ ...input, criado_por: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as ManualTutorial;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateManualTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ManualTutorial> & { id: string }) => {
      const { data, error } = await supabase
        .from("manual_tutoriais")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as ManualTutorial;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteManualTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("manual_tutoriais")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
