import React from "react";
import { getEquipe } from "@/lib/tarefas-teams";
import { PRIORIDADES } from "@/components/tarefas/priority";
import {
  COLUMNS,
  getEffectiveStatus,
  statusToColumn,
  userInitials,
  userName,
  type Priority,
  type Tarefa,
  type UserOption,
} from "@/components/tarefas/types";

export function Avatar({
  user,
  size = 24,
  ring = true,
}: {
  user: UserOption | undefined;
  size?: number;
  ring?: boolean;
}) {
  const label = userName(user);
  const ringClass = ring ? "ring-2 ring-noite-800" : "";

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={label}
        title={label}
        className={`shrink-0 rounded-full object-cover ${ringClass}`}
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      title={label}
      aria-label={label}
      className={`flex shrink-0 items-center justify-center rounded-full bg-azul-500 font-semibold text-white ${ringClass}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {userInitials(user)}
    </div>
  );
}

export function AvatarStack({
  users,
  max = 3,
  size = 22,
}: {
  users: (UserOption | undefined)[];
  max?: number;
  size?: number;
}) {
  const visiveis = users.filter(Boolean).slice(0, max) as UserOption[];
  const excedente = users.filter(Boolean).length - visiveis.length;
  if (visiveis.length === 0) return null;

  return (
    <div className="flex items-center -space-x-1.5">
      {visiveis.map((u) => (
        <Avatar key={u.id} user={u} size={size} />
      ))}
      {excedente > 0 && (
        <div
          className="flex shrink-0 items-center justify-center rounded-full bg-noite-600 font-semibold text-noite-100 ring-2 ring-noite-800"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
        >
          +{excedente}
        </div>
      )}
    </div>
  );
}

export function PrioridadeChip({ prioridade }: { prioridade: string | null | undefined }) {
  const key: Priority = (prioridade as Priority) in PRIORIDADES ? (prioridade as Priority) : "media";
  const p = PRIORIDADES[key];
  const Icon = p.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${p.chip}`}
    >
      <Icon size={11} strokeWidth={2.5} />
      {p.label}
    </span>
  );
}

export function EquipeBadges({ equipes }: { equipes: string[] | null | undefined }) {
  if (!equipes || equipes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {equipes.map((id) => {
        const e = getEquipe(id);
        if (!e) return null;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-noite-700/60 px-1.5 py-0.5 text-[10px] font-medium text-noite-200 ring-1 ring-inset ring-noite-600"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
            {e.short}
          </span>
        );
      })}
    </div>
  );
}

export function BarraProgresso({ valor }: { valor: number }) {
  const v = Math.max(0, Math.min(100, valor || 0));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-noite-900 shadow-[inset_0_1px_3px_rgba(0,0,0,0.7)]">
        <div
          className={`h-full rounded-full ${v >= 100 ? "bg-emerald-400" : "bg-azul-400"}`}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="text-[11px] font-medium text-noite-400">{v}%</span>
    </div>
  );
}

/**
 * Legenda de bolinhas mostrando em que coluna cada responsável está —
 * dá visibilidade do andamento coletivo sem misturar o status de ninguém,
 * já que cada bolinha reflete o `status_por_usuario` daquela pessoa.
 */
export function StatusLegend({
  task,
  users,
}: {
  task: Tarefa;
  users: (UserOption | undefined)[];
}) {
  const assignees = users.filter(Boolean) as UserOption[];
  if (assignees.length <= 1) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assignees.map((u) => {
        const col = statusToColumn(getEffectiveStatus(task, u.id));
        const dot = COLUMNS.find((c) => c.id === col)?.dot || "bg-zinc-400";
        return (
          <span
            key={u.id}
            title={`${userName(u)}: ${COLUMNS.find((c) => c.id === col)?.label}`}
            className="inline-flex items-center gap-1 rounded-full bg-noite-700/60 py-0.5 pl-0.5 pr-1.5 ring-1 ring-inset ring-noite-600"
          >
            <Avatar user={u} size={14} ring={false} />
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          </span>
        );
      })}
    </div>
  );
}