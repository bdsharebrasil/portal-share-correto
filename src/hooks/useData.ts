import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// =======================================================
// 1. TIPOS DERIVADOS DAS SUAS TABELAS (types.ts)
// =======================================================

// Tabela 'clients' (Para o Select de Cliente)
export type Cliente = Tables<"clients">;
const clientesQueryKey = ["clientes-list"];

// Tabela 'aircraft' (Para o Select de Aeronave)
export type Aeronave = Tables<"aircraft">;
const aeronavesQueryKey = ["aeronaves-list"];

// Tabela 'crew_members' (Para o Select de Tripulante)
export type Tripulante = Tables<"crew_members">;
const tripulantesQueryKey = ["tripulantes-list"];


// =======================================================
// 2. HOOK PARA CLIENTES (clients)
// =======================================================

/**
 * Busca todos os clientes cadastrados na tabela 'clients'.
 * Retorna uma lista de clientes ordenada pelo nome da empresa.
 */
export const useClientes = () => {
  const query = useQuery<Cliente[] | null>({
    queryKey: clientesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, email, phone")
        .order("company_name", { ascending: true });

      if (error) {
        console.error("Erro ao buscar clientes:", error);
        throw error;
      }

      return (data as Cliente[]) || null;
    },
    staleTime: 15 * 60 * 1000, // 15 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });

  return {
    clientes: query.data ?? [],
    isLoadingClientes: query.isLoading,
    refetchClientes: query.refetch,
    errorClientes: query.error,
  };
};

// -------------------------------------------------------

// =======================================================
// 3. HOOK PARA AERONAVES (aircraft)
// =======================================================

/**
 * Busca todas as aeronaves cadastradas na tabela 'aircraft'.
 * Retorna uma lista ordenada pelo registro (registration).
 */
export const useAeronaves = () => {
  const query = useQuery<Aeronave[] | null>({
    queryKey: aeronavesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aircraft")
        .select("id, registration, model, manufacturer")
        .eq("status", "ativa")
        .order("registration", { ascending: true });

      if (error) {
        console.error("Erro ao buscar aeronaves:", error);
        throw error;
      }

      return (data as Aeronave[]) || null;
    },
    staleTime: 20 * 60 * 1000, // 20 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });

  return {
    aeronaves: query.data ?? [],
    isLoadingAeronaves: query.isLoading,
    refetchAeronaves: query.refetch,
    errorAeronaves: query.error,
  };
};

// -------------------------------------------------------

// =======================================================
// 4. HOOK PARA TRIPULANTES (crew_members)
// =======================================================

/**
 * Busca todos os membros ativos da tripulação na tabela 'crew_members'.
 * Retorna uma lista ordenada pelo nome completo.
 */
export const useTripulantes = () => {
  const query = useQuery<Tripulante[] | null>({
    queryKey: tripulantesQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crew_members")
        .select("id, full_name, canac, status")
        .eq("status", "active")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Erro ao buscar tripulantes:", error);
        throw error;
      }

      return (data || []) as unknown as Tripulante[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  });

  // Retornamos 'uniqueTripulantesNames' para simplificar o Select do formulário
  const uniqueTripulantesNames = query.data
    ?.map(t => t.full_name)
    .filter(Boolean) ?? [];

  return {
    tripulantes: query.data ?? [], // Retorna o objeto completo se necessário
    uniqueTripulantesNames: uniqueTripulantesNames, // Retorna apenas os nomes
    isLoadingTripulantes: query.isLoading,
    refetchTripulantes: query.refetch,
    errorTripulantes: query.error,
  };
};
