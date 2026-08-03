import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const APP_ROLE_VALUES = [
  "admin",
  "financeiro_master",
  "financeiro",
  "operacoes",
  "piloto_chefe",
  "tripulante",
  "cotista",
  "gestor_master",
  "adm",
  "cliente",
  "coordenador_de_voo",
  "rh",
] as const satisfies readonly AppRole[];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  financeiro_master: "FINANCEIRO MASTER",
  financeiro: "FINANCEIRO",
  operacoes: "OPERAÇÕES (CTM)",
  piloto_chefe: "PILOTO CHEFE",
  tripulante: "TRIPULANTE",
  cotista: "COTISTA",
  gestor_master: "Gestor Master",
  adm: "ADMINISTRATIVO",
  cliente: "CLIENTE",
  coordenador_de_voo: "COORDENADOR DE VOO",
  rh: "RH",
};

const DEFAULT_ROLE_LABEL = "Sem categoria";

const APP_ROLE_SET = new Set<AppRole>(APP_ROLE_VALUES);

const capitalizeToken = (token: string) =>
  token.charAt(0).toUpperCase() + token.slice(1);

export const isAppRole = (value: string | null | undefined): value is AppRole =>
  typeof value === "string" && APP_ROLE_SET.has(value as AppRole);

export const selectPrimaryRole = (
  roles: readonly string[] | null | undefined,
): AppRole | null => {
  if (!roles || roles.length === 0) {
    return null;
  }

  for (const candidate of APP_ROLE_VALUES) {
    if (roles.includes(candidate)) {
      return candidate;
    }
  }

  const firstValid = roles.find((role): role is AppRole => isAppRole(role));

  return firstValid ?? null;
};

export const formatRoleLabel = (role: string | null | undefined): string => {
  if (!role) {
    return DEFAULT_ROLE_LABEL;
  }

  if (isAppRole(role)) {
    return ROLE_LABELS[role];
  }

  const formatted = role
    .split("_")
    .filter(Boolean)
    .map((token) => capitalizeToken(token.toLowerCase()))
    .join(" ");

  return formatted || DEFAULT_ROLE_LABEL;
};

export const formatRoleList = (
  roles: readonly string[] | null | undefined,
): string[] => {
  if (!roles?.length) {
    return [];
  }

  const labels = new Set<string>();

  roles.forEach((role) => {
    if (!role) {
      return;
    }

    labels.add(formatRoleLabel(role));
  });

  return Array.from(labels);
};

export const getRoleLabelOrDefault = (
  role: string | null | undefined,
  fallback: string = DEFAULT_ROLE_LABEL,
): string => {
  if (!role) {
    return fallback;
  }

  return formatRoleLabel(role) || fallback;
};

export const getDefaultRoleLabel = () => DEFAULT_ROLE_LABEL;
