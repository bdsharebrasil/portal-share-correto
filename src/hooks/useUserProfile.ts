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

    const address = (user.user_metadata?.address as string | undefined) ?? undefined;
    if (address) profile.address = address;

    const phone = (user.user_metadata?.phone as string | undefined) ?? undefined;
    if (phone) profile.phone = phone;

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

        queryFn: async () => {
            if (!user?.id) {
                return null;
            }

            // A. Tenta ler o perfil existente
            const { data, error } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("id", user.id)
                .maybeSingle();

            // Lida com erros diferentes de "registro não encontrado" (que é esperado)
            if (error && error.code !== 'PGRST116') {
                console.error("Erro ao tentar ler o perfil:", error);
                throw error;
            }

            // B. Se o perfil existir, retorna
            if (data) {
                return data as UserProfile;
            }

            // C. Se o perfil NÃO existe: Verifica a permissão para PULAR o INSERT
            if (shouldSkipCreation) {
                // Usuário especial sem perfil: Retorna um objeto simulado
                // para satisfazer o sistema sem fazer o POST.
                return {
                    id: user.id,
                    email: user.email ?? 'admin-sem-perfil',
                    full_name: 'Admin Sem Perfil (Simulado)',
                    created_at: new Date().toISOString(),
                } as UserProfile;
            }

            // D. Se o perfil NÃO existe e o usuário não é privilegiado: CRIA o perfil
            const defaultProfile = buildDefaultProfile(user);
            // Tenta inserir e, se a mensagem indicar coluna desconhecida no schema cache,
            // remove essa chave e tenta novamente (útil quando tipos locais e DB estão desalinhados).
            let insertAttempt = 0;
            let payload: any = { ...defaultProfile };
            while (insertAttempt < 2) {
                const { data: inserted, error: insertError } = await supabase
                    .from("user_profiles")
                    .insert(payload)
                    .select()
                    .single();

                if (!insertError) {
                    return inserted as UserProfile;
                }

                const errMsg = (insertError.message ?? JSON.stringify(insertError)) as string;
                console.error("Erro no INSERT (Criação de Perfil):", errMsg, insertError);

                // Detecta mensagem do tipo: Could not find the 'tipo' column of 'user_profiles' in the schema cache
                const match = errMsg.match(/Could not find the '(.+?)' column of 'user_profiles'/i);
                if (match && match[1]) {
                    const missingCol = match[1];
                    // Remove a coluna do payload e tenta novamente
                    if (payload.hasOwnProperty(missingCol)) {
                        delete payload[missingCol];
                        insertAttempt += 1;
                        console.warn(`Retrying insert after removing unknown column: ${missingCol}`);
                        continue;
                    }
                }

                // Se não for esse caso, lança o erro
                throw new Error(errMsg);
            }

            throw new Error("Falha ao inserir perfil após tentativas");
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
