import type { AppRole } from "./roles";

export type DashboardRoute = "/operacoes" | "/financeiro" | "/gestor" | "/contabilidade";

/**
 * Mapeia roles para o dashboard e view mode apropriados
 * 
 * Regras de roteamento:
 * - operacoes, piloto_chefe, tripulante, coordenador_de_voo → /operacoes (view mode: operacoes)
 * - admin, financeiro_master, gestor_master → /gestor (view mode: gestor)
 * - financeiro, rh, adm → /financeiro (view mode: financeiro)
 */
export function getDashboardRouteFromRoles(roles: string[]): {
  route: DashboardRoute;
  viewMode: "operacoes" | "financeiro" | "gestor" | "contabilidade";
} {
  // Roles para dashboard de operações
  const operacoesRoles = [
    "operacoes",
    "piloto_chefe",
    "tripulante",
    "coordenador_de_voo",
  ];

  // Roles para dashboard gestor
  const gestorRoles = ["admin", "financeiro_master", "gestor_master"];

  // Roles para dashboard financeiro
  const financeiroRoles = ["financeiro", "rh", "adm"];

  const isContabilidade = roles.includes("contabilidade");

  if (isContabilidade) {
    return { route: "/contabilidade", viewMode: "contabilidade" };
  }

  // Prioridade: verifica gestor master, depois financeiro master, depois operações
  if (roles.some((role) => gestorRoles.includes(role))) {
    return { route: "/gestor", viewMode: "gestor" };
  }

  if (roles.some((role) => financeiroRoles.includes(role))) {
    return { route: "/financeiro", viewMode: "financeiro" };
  }

  if (roles.some((role) => operacoesRoles.includes(role))) {
    return { route: "/operacoes", viewMode: "operacoes" };
  }

  // Default para operações se não tiver role específica
  return { route: "/operacoes", viewMode: "operacoes" };
}
