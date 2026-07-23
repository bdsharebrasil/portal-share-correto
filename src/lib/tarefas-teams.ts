// Equipes derivadas dos papéis (user_roles)
// - OPERACIONAL: operacoes, coordenador_de_voo
// - TRIPULACAO: tripulante, piloto_chefe
// - ADMINISTRATIVO: adm, financeiro, financeiro_master
// - gestor_master participa de todas

export type Equipe = "OPERACIONAL" | "TRIPULACAO" | "ADMINISTRATIVO";

export const EQUIPES: {
  id: Equipe;
  label: string;
  short: string;
  color: string;
  bg: string;
  border: string;
  roles: string[];
}[] = [
  {
    id: "OPERACIONAL",
    label: "Operacional",
    short: "OPS",
    color: "hsl(192 90% 65%)",
    bg: "hsl(192 90% 65% / 0.12)",
    border: "hsl(192 90% 65% / 0.35)",
    roles: ["operacoes", "coordenador_de_voo"],
  },
  {
    id: "TRIPULACAO",
    label: "Tripulação",
    short: "TRIP",
    color: "hsl(45 100% 60%)",
    bg: "hsl(45 100% 60% / 0.12)",
    border: "hsl(45 100% 60% / 0.35)",
    roles: ["tripulante", "piloto_chefe"],
  },
  {
    id: "ADMINISTRATIVO",
    label: "Administrativo",
    short: "ADM",
    color: "hsl(280 75% 70%)",
    bg: "hsl(280 75% 70% / 0.12)",
    border: "hsl(280 75% 70% / 0.35)",
    roles: ["adm", "financeiro", "financeiro_master"],
  },
];

export function getEquipe(id: string | null | undefined) {
  return EQUIPES.find((e) => e.id === id);
}

/**
 * Retorna as equipes das quais o usuário faz parte com base nos papéis.
 * `gestor_master` participa de todas.
 */
export function equipesDoUsuario(roles: string[]): Equipe[] {
  if (!roles?.length) return [];
  if (roles.includes("gestor_master") || roles.includes("admin")) {
    return EQUIPES.map((e) => e.id);
  }
  return EQUIPES.filter((e) => e.roles.some((r) => roles.includes(r))).map(
    (e) => e.id,
  );
}