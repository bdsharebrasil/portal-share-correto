import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

// =======================================
// 1. TIPOS E CHAVES
// =======================================
export type UserProfile = Tables<"user_profiles">;
const profileQueryKey = (userId?: string) => ["user-profile", userId];

// =======================================
// 2. FUNÇÃO AUXILIAR DE CRIAÇÃO DE PERFIL PADRÃO
// =======================================
const buildDefaultProfile = (user: User): TablesInsert<"user_profiles"> => {
    // Garante que temos um ID e um email de fallback para campos NOT NULL
    if (!user.id) {
        throw new Error("Erro interno: ID de usuário ausente durante a construção do perfil.");
    }

    const userEmail = user.email ?? 'email-indisponivel';
    // Prioriza full_name, depois email, senão usa o fallback seguro
    const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? userEmail;

    const profile: Partial<TablesInsert<"user_profiles">> = {
        id: user.id,
        email: userEmail,
        full_name: fullName,
    };

    // Adiciona apenas campos opcionais quando disponíveis (evita enviar colunas inexistentes)
    const displayName = (user.user_metadata?.display_name as string | undefined) ?? undefined;
    if (displayName) profile.display_name = displayName;

    const avatar = (user.user_metadata?.avatar_url as string | undefined) ?? undefined;
    if (avatar) profile.avatar_url = avatar;

    const address = (user.user_metadata?.endereco as string | undefined) ?? undefined;
    if (address) profile.endereco = address;

    const phone = (user.user_metadata?.telefone as string | undefined) ?? undefined;
    if (phone) profile.telefone = phone;

    // NOTA: 'tipo' é um campo antigo — evite enviar por padrão para não quebrar inserts se a coluna não existir

    return profile as TablesInsert<"user_profiles">;
};

// =======================================
// 3. HOOK PRINCIPAL
// =======================================

/**
 * Busca o perfil do usuário e cria um perfil padrão se não existir.
 * A criação pode ser ignorada passando options.skipCreation = true.
 */
export const useUserProfile = (user: User | null | undefined, options?: { skipCreation?: boolean }) => {
    const queryClient = useQueryClient();

    // Flag para determinar se a criação do perfil deve ser ignorada
    const shouldSkipCreation = useMemo(() => Boolean(options?.skipCreation), [options?.skipCreation]);

    const query = useQuery<UserProfile | null>({
        queryKey: profileQueryKey(user?.id),
        // Habilita a query apenas se o usuário estiver logado
        enabled: Boolean(user?.id),
        // Retry apenas 1 vez em caso de erro
        retry: 1,

        queryFn: async () => {
            if (!user?.id) {
                return null;
            }

            try {
                // Tenta ler o perfil direto do Supabase
                const { data, error } = await supabase
                    .from("user_profiles")
                    .select("*")
                    .eq("id", user.id)
                    .maybeSingle();

                // Se encontrou, retorna (nunca cria perfil se já existe)
                if (data) {
                    return data as UserProfile;
                }

                // Se erro e não é "não encontrado", trata
                if (error) {
                    const errorMsg = error.message || JSON.stringify(error);
                    
                    // Se for "não encontrado", continua para criar ou retornar simulado
                    if (error.code === 'PGRST116') {
                        // Continua o fluxo normalmente
                    } else {
                        // Se for timeout/lock, retorna perfil simulado em vez de falhar
                        if (errorMsg.includes('timed out') || errorMsg.includes('lock')) {
                            console.warn("Timeout/lock ao ler perfil, usando perfil simulado:", errorMsg);
                            return {
                                id: user.id,
                                email: user.email ?? 'user-sem-perfil',
                                full_name: user.user_metadata?.full_name ?? 'Usuário',
                                created_at: new Date().toISOString(),
                            } as UserProfile;
                        }

                        console.error("Erro ao ler perfil:", errorMsg);
                        throw new Error(`Erro ao ler perfil do usuário: ${errorMsg}`);
                    }
                }

                // Se não encontrou e não é para criar, retorna simulado
                if (shouldSkipCreation) {
                    return {
                        id: user.id,
                        email: user.email ?? 'user-sem-perfil',
                        full_name: user.user_metadata?.full_name ?? 'Usuário',
                        created_at: new Date().toISOString(),
                    } as UserProfile;
                }

                // Só cria perfil se não foi encontrado e não é skip
                const defaultProfile = buildDefaultProfile(user);
                const { data: inserted, error: insertError } = await supabase
                    .from("user_profiles")
                    .insert(defaultProfile)
                    .select()
                    .single();

                if (insertError) {
                    const errorMsg = insertError.message || JSON.stringify(insertError);
                    console.error("Erro ao criar perfil:", errorMsg);
                    throw new Error(`Erro ao criar perfil: ${errorMsg}`);
                }

                return inserted as UserProfile;
            } catch (err: any) {
                const errorMsg = err.message || JSON.stringify(err);
                console.error("Exceção em useUserProfile:", errorMsg);
                
                // Em caso de erro crítico, retorna perfil simulado para não bloquear a aplicação
                return {
                    id: user.id,
                    email: user.email ?? 'user-sem-perfil',
                    full_name: user.user_metadata?.full_name ?? 'Usuário',
                    created_at: new Date().toISOString(),
                } as UserProfile;
            }
        },
    });

    // --- MUTATION (Permanece a mesma) ---
    const updateProfile = useMutation({
        mutationFn: async (input: Partial<UserProfile>) => {
            if (!user?.id) {
                throw new Error("Usuário não autenticado");
            }

            const updates = {
                ...input,
                updated_at: new Date().toISOString(),
            } as Partial<UserProfile>;

            const { data, error } = await supabase
                .from("user_profiles")
                .update(updates)
                .eq("id", user.id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return data as UserProfile;
        },
        onSuccess: (data) => {
            queryClient.setQueryData(profileQueryKey(user?.id), data);
        },
    });

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    }, [queryClient, user?.id]);

    return {
        profile: query.data ?? null,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error,
        refetch: query.refetch,
        updateProfile: updateProfile.mutateAsync,
        isUpdating: updateProfile.isPending,
        invalidate,
    };
};
