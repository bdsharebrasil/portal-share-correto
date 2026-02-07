import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AeronaveSocio {
  id: string;
  aeronave_id: string | null;
  aeronave_registro: string;
  cliente_id: string | null;
  cliente_nome: string;
  percentual_participacao: number;
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function useAeronaveSocios(aeronaveRegistro?: string) {
  const queryClient = useQueryClient();

  const { data: socios, isLoading, error } = useQuery({
    queryKey: ["aeronaves_socios", aeronaveRegistro],
    queryFn: async () => {
      let query = (supabase as any)
        .from("aeronaves_socios")
        .select("*")
        .eq("ativo", true)
        .order("cliente_nome");

      if (aeronaveRegistro) {
        query = query.eq("aeronave_registro", aeronaveRegistro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AeronaveSocio[];
    },
    enabled: true,
  });

  const createSocio = useMutation({
    mutationFn: async (socio: Omit<AeronaveSocio, "id" | "criado_em" | "atualizado_em">) => {
      const { data, error } = await (supabase as any)
        .from("aeronaves_socios")
        .insert([socio])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aeronaves_socios"] });
    },
  });

  const updateSocio = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AeronaveSocio> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("aeronaves_socios")
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aeronaves_socios"] });
    },
  });

  return {
    socios: socios || [],
    isLoading,
    error,
    createSocio,
    updateSocio,
  };
}
