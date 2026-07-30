// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import {
  APP_ROLE_VALUES,
  ROLE_LABELS,
  type AppRole,
} from "@/lib/roles";
import type { TablesInsert } from "@/integrations/supabase/types";

export { APP_ROLE_VALUES, ROLE_LABELS } from "@/lib/roles";
export type { AppRole } from "@/lib/roles";
export type UserCategory = "colaboradores" | "fornecedores" | "clientes";

export type ManagedUser = {
  id: string;
  email: string;
  fullName: string;
  displayName: string;
  tipo: string | null;
  roles: AppRole[];
  createdAt: string | null;
  updatedAt: string | null;
};

export const USER_CATEGORY_VALUES = [
  "colaboradores",
  "fornecedores",
  "clientes",
] as const satisfies readonly UserCategory[];

type SupabaseRoleRow = {
  user_id: string;
  role: AppRole | null;
};

type SupabaseProfileRow = {
  id: string;
  email: string;
  full_name: string;
  display_name?: string | null;
  tipo?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const ROLE_OPTIONS = APP_ROLE_VALUES.map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

export const USER_CATEGORY_LABELS: Record<UserCategory, string> = {
  colaboradores: "Colaboradores",
  fornecedores: "Fornecedores",
  clientes: "Clientes",
};

export const USER_CATEGORY_OPTIONS = USER_CATEGORY_VALUES.map((value) => ({
  value,
  label: USER_CATEGORY_LABELS[value],
}));

const createProfilePayload = (
  userId: string,
  email: string,
  fullName: string,
  tipo: UserCategory,
): TablesInsert<"user_profiles"> => ({
  id: userId,
  email,
  full_name: fullName,
  display_name: fullName,
  updated_at: new Date().toISOString(),
} as any);

export const fetchManagedUsers = async (): Promise<ManagedUser[]> => {
  const { data: profilesData, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, display_name, created_at, updated_at")
    .order("full_name", { ascending: true });

  if (profilesError) {
    throw new Error(profilesError.message ?? "Não foi possível carregar os perfis.");
  }

  const userIds = ((profilesData ?? []) as SupabaseProfileRow[]).map((p) => p.id);
  const { data: rolesResp, error: rolesErr } = await supabase.functions.invoke("list-user-roles", {
    body: { userIds },
  });

  if (rolesErr) {
    throw new Error(rolesErr.message ?? "Não foi possível carregar os perfis de acesso.");
  }

  const rolesByUser = (rolesResp as { rolesByUser?: Record<string, AppRole[]> })?.rolesByUser ?? {};

  const rolesMap = new Map<string, AppRole[]>();
  Object.entries(rolesByUser).forEach(([userId, roles]) => {
    rolesMap.set(userId, roles);
  });

  const rawProfiles = (profilesData ?? []) as SupabaseProfileRow[];

  return rawProfiles.map((profile) => ({
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    displayName: profile.display_name ?? profile.full_name,
    tipo: profile.tipo ?? null,
    roles: rolesMap.get(profile.id) ?? [],
    createdAt: profile.criado_em ?? null,
    updatedAt: profile.atualizado_em ?? null,
  }));
};

export interface CreateManagedUserInput {
  email: string;
  password: string;
  fullName: string;
  roles: AppRole[];
  tipo: UserCategory;
}

export const createManagedUser = async (input: CreateManagedUserInput) => {
  console.log("Calling create-user function with:", {
    email: input.email,
    roles: input.roles,
    fullName: input.fullName,
    tipo: input.tipo
  });

  const { data: session } = await supabase.auth.getSession();
  console.log("Session exists:", !!session?.session);

  const { data, error } = await supabase.functions.invoke("create-user", {
    body: {
      email: input.email,
      password: input.password,
      roles: input.roles,
      fullName: input.fullName,
      tipo: input.tipo,
    },
  });

  console.log("Function response:", { data, error });

  if (error) {
    console.error("Function error:", error);
    throw new Error(error.message ?? "Erro ao criar usuário.");
  }

  const userId = (data as { user?: { id?: string } })?.user?.id;

  if (!userId) {
    throw new Error("Resposta inválida do servidor ao criar usuário.");
  }

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert(createProfilePayload(userId, input.email, input.fullName, input.tipo));

  if (profileError) {
    throw new Error(profileError.message ?? "Erro ao salvar perfil do usuário.");
  }

  return userId;
};

export interface UpdateManagedUserInput {
  userId: string;
  email: string;
  password?: string;
  fullName: string;
  roles: AppRole[];
  tipo: UserCategory;
}

export const updateManagedUser = async (input: UpdateManagedUserInput) => {
  const { error } = await supabase.functions.invoke("update-user", {
    body: {
      userId: input.userId,
      email: input.email,
      password: input.password ?? undefined,
      roles: input.roles,
      fullName: input.fullName,
      tipo: input.tipo,
    },
  });

  if (error) {
    throw new Error(error.message ?? "Erro ao atualizar usuário.");
  }

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert(createProfilePayload(input.userId, input.email, input.fullName, input.tipo));

  if (profileError) {
    throw new Error(profileError.message ?? "Erro ao atualizar perfil do usuário.");
  }
};

export const deleteManagedUser = async (userId: string) => {
  const { error } = await supabase.functions.invoke("delete-user", {
    body: { userId },
  });

  if (error) {
    throw new Error(error.message ?? "Erro ao excluir usuário.");
  }
};
