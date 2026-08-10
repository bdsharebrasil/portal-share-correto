import React from "react";
import { AnimatePresence } from "framer-motion";
import { InboxIcon, PlusIcon } from "lucide-react";
import { CardTarefa } from "@/components/tarefas/CardTarefa";
import { type Status, type Tarefa, type UserOption } from "@/components/tarefas/types";

export type ModoOrdenacao = "padrao" | "prioridade" | "prazo";

interface Coluna {
  id: Status;
  label: string;
  dot: string;
}

interface Props {
  coluna: Coluna;
  tarefas: Tarefa[];
  usersById: Map<string, UserOption>;
  commentCounts: Record<string, number>;
  arrastandoId: string | null;
  ativa: boolean;
  meId: string | null;
  sortMode?: ModoOrdenacao;
  onSortModeChange?: (modo: ModoOrdenacao) => void;
  showClearCompleted?: boolean;
  onClearCompleted?: () => void;

  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onNovaTarefa: () => void;
  onArrastar: (id: string | null) => void;
  onAbrirTarefa: (tarefa: Tarefa) => void;
  onExcluirTarefa: (id: string) => void;
  onMudarStatus: (id: string, status: Status) => void;
  podeMudarStatus: (tarefa: Tarefa) => boolean;
  podeExcluir: (tarefa: Tarefa) => boolean;
}

export function ColunaKanban({
  coluna,
  tarefas,
  usersById,
  commentCounts,
  arrastandoId,
  ativa,
  meId,
  showClearCompleted,
  onClearCompleted,
  onDragOver,
  onDragLeave,
  onDrop,
  onNovaTarefa,
  onArrastar,
  onAbrirTarefa,
  onExcluirTarefa,
  onMudarStatus,
  podeMudarStatus,
  podeExcluir,
}: Props) {
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      aria-label={coluna.label}
      className={`flex w-[290px] shrink-0 flex-col rounded-2xl border border-noite-700/80 bg-[#0b1220]/95 p-2.5 shadow-[0_0_0_1px_rgba(148,163,184,0.08)] transition-colors duration-150 ${
        ativa ? "border-azul-400 ring-2 ring-azul-400/30" : "border-noite-700/80"
      }`}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${coluna.dot}`} />
          <h2 className="text-[13px] font-semibold text-noite-100">{coluna.label}</h2>
          <span className="rounded-full bg-noite-700/70 px-1.5 py-0.5 text-[11px] font-semibold text-noite-200">
            {tarefas.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onNovaTarefa}
          aria-label={`Nova tarefa em ${coluna.label}`}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-noite-700/70 text-noite-200 transition hover:bg-azul-600 hover:text-white"
        >
          <PlusIcon size={14} />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {tarefas.map((tarefa) => (
            <CardTarefa
              key={tarefa.id}
              tarefa={tarefa}
              usersById={usersById}
              commentCount={commentCounts[tarefa.id] || 0}
              arrastando={arrastandoId === tarefa.id}
              podeMudarStatus={podeMudarStatus(tarefa)}
              podeExcluir={podeExcluir(tarefa)}
              meId={meId}
              onDragStart={() => onArrastar(tarefa.id)}
              onDragEnd={() => onArrastar(null)}
              onAbrir={() => onAbrirTarefa(tarefa)}
              onExcluir={() => onExcluirTarefa(tarefa.id)}
              onMudarStatus={(status) => onMudarStatus(tarefa.id, status)}
            />
          ))}
        </AnimatePresence>

        {tarefas.length === 0 && (
          <div className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-noite-600/70 text-center">
            <InboxIcon className="h-4 w-4 text-noite-400" />
            <span className="text-[11px] text-noite-400">Nenhuma tarefa</span>
          </div>
        )}
      </div>
    </section>
  );
}