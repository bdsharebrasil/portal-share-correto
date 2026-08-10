import React from "react";
import { motion } from "framer-motion";
import { CalendarIcon, MessageSquareIcon, Trash2Icon } from "lucide-react";
import { AvatarStack, BarraProgresso, EquipeBadges, PrioridadeChip, StatusLegend } from "@/components/tarefas/Indicadores";
import { type Status, type Tarefa, type UserOption } from "@/components/tarefas/types";

interface Props {
  tarefa: Tarefa;
  usersById: Map<string, UserOption>;
  commentCount: number;
  arrastando: boolean;
  /** Pode arrastar / trocar de status rapidamente pelo card (permissão). */
  podeMudarStatus: boolean;
  /** Pode excluir a tarefa (permissão). */
  podeExcluir: boolean;
  meId: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAbrir: () => void;
  onExcluir: () => void;
  onMudarStatus: (novoStatus: Status) => void;
}

function formatarPrazo(prazo: string): string {
  return new Date(`${prazo}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function prazoVencido(prazo: string): boolean {
  return new Date(`${prazo}T23:59:59`).getTime() < Date.now();
}

export function CardTarefa({
  tarefa,
  usersById,
  commentCount,
  arrastando,
  podeMudarStatus,
  podeExcluir,
  onDragStart,
  onDragEnd,
  onAbrir,
  onExcluir,
}: Props) {
  const responsaveis = tarefa.atribuido_para.map((id) => usersById.get(id));
  const atrasada = tarefa.prazo ? prazoVencido(tarefa.prazo) && tarefa.status !== "concluido" : false;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: arrastando ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      draggable={podeMudarStatus}
      onDragStart={(event) => {
        if (!podeMudarStatus) {
          event.preventDefault();
          return;
        }
        const e = event as unknown as React.DragEvent<HTMLElement>;
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onAbrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      className={`card-relevo group relative rounded-xl border border-noite-600/60 p-3.5 text-left outline-none ring-azul-400/60 focus-visible:ring-2 ${
        podeMudarStatus ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-[13.5px] font-semibold leading-snug text-noite-100 line-clamp-2">
          {tarefa.titulo}
        </h3>
        <PrioridadeChip prioridade={tarefa.prioridade} />
      </div>

      {tarefa.descricao && (
        <p className="mb-2.5 text-[11.5px] leading-snug text-noite-400 line-clamp-2">{tarefa.descricao}</p>
      )}

      {tarefa.equipes.length > 0 && (
        <div className="mb-2.5">
          <EquipeBadges equipes={tarefa.equipes} />
        </div>
      )}

      {responsaveis.length > 1 && (
        <div className="mb-2.5">
          <StatusLegend task={tarefa} users={responsaveis} />
        </div>
      )}

      <BarraProgresso valor={tarefa.progresso} />

      <div className="mt-3 flex items-center justify-between border-t border-noite-600/50 pt-2.5">
        <div className="flex items-center gap-3 text-noite-400">
          {tarefa.prazo && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${atrasada ? "text-rose-400" : ""}`}
            >
              <CalendarIcon size={11} />
              {formatarPrazo(tarefa.prazo)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] font-medium">
            <MessageSquareIcon size={11} />
            {commentCount}
          </span>
        </div>
        <AvatarStack users={responsaveis} size={20} />
      </div>

      <div
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-noite-900/90 p-0.5 opacity-0 shadow-md ring-1 ring-noite-600 transition group-hover:opacity-100 focus-within:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {podeExcluir && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExcluir();
            }}
            title="Excluir tarefa"
            aria-label={`Excluir tarefa ${tarefa.titulo}`}
            className="rounded p-1 text-noite-400 transition hover:text-rose-400"
          >
            <Trash2Icon size={13} />
          </button>
        )}
      </div>
    </motion.article>
  );
}
