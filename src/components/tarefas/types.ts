// Tipos compartilhados do módulo de Tarefas (Kanban).
// Ajuste os imports em cada arquivo se você preferir manter esses tipos
// dentro de "@/integrations/supabase/types" ou em outro lugar do projeto.

export const COLUMNS = [
  { id: "a-fazer", label: "A Fazer", dot: "bg-zinc-400" },
  { id: "em-andamento", label: "Em Andamento", dot: "bg-amber-400" },
  { id: "revisao", label: "Revisão", dot: "bg-blue-400" },
  { id: "concluido", label: "Concluído", dot: "bg-emerald-400" },
] as const;

export type Status = (typeof COLUMNS)[number]["id"];
export type StatusMap = Record<string, string>;
export type Priority = "baixa" | "media" | "alta" | "urgente";

export interface UserOption {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  status_por_usuario: StatusMap | null;
  prioridade: string;
  criado_por: string | null;
  prazo: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  publico: boolean | null;
  origem: string;
  equipes: string[];
  progresso: number;
  atribuido_para: string[];
}

export interface Comentario {
  id: string;
  tarefa_id: string;
  usuario_id: string;
  comentario: string;
  criado_em: string | null;
}

/** Mapeia status legado (banco) -> coluna do kanban. */
export function statusToColumn(s: string | null | undefined): Status {
  if (!s) return "a-fazer";
  const normalized = s.trim().toLowerCase().replace(/_/g, "-");
  if (COLUMNS.find((c) => c.id === normalized)) return normalized as Status;
  switch (normalized) {
    case "aberto":
    case "pendente":
    case "a-fazer":
      return "a-fazer";
    case "em andamento":
    case "em-andamento":
      return "em-andamento";
    case "em progresso":
    case "em-progresso":
    case "em_progresso":
      return "em-andamento";
    case "revisao":
    case "revisão":
      return "revisao";
    case "concluida":
    case "concluído":
    case "concluido":
      return "concluido";
    default:
      return "a-fazer";
  }
}

/**
 * Status "efetivo" de uma tarefa para uma pessoa específica.
 * Cada responsável tem sua própria entrada em `status_por_usuario`;
 * se ainda não tiver, cai no `status` legado como ponto de partida.
 */
export function getEffectiveStatus(task: Tarefa, viewerId: string | null): string {
  if (viewerId) {
    const own = task.status_por_usuario?.[viewerId];
    if (own) return own;
  }
  return task.status;
}

export function userName(u: UserOption | undefined): string {
  if (!u) return "—";
  return u.full_name || u.display_name || u.email || "—";
}

export function userInitials(u: UserOption | undefined): string {
  if (!u) return "?";
  const name = u.full_name || u.display_name || u.email || "?";
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}