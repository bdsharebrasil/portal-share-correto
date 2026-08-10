import React, { useEffect, useMemo, useState } from "react";
import { CalendarIcon, MessageSquareIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Avatar, AvatarStack, EquipeBadges, PrioridadeChip } from "@/components/tarefas/Indicadores";
import {
  COLUMNS,
  getEffectiveStatus,
  statusToColumn,
  userName,
  type Comentario,
  type Status,
  type StatusMap,
  type Tarefa,
  type UserOption,
} from "@/components/tarefas/types";

interface Props {
  tarefa: Tarefa | null;
  usersById: Map<string, UserOption>;
  users: UserOption[];
  meId: string | null;
  canManage: boolean;
  onFechar: () => void;
  /** Chamado após qualquer alteração local persistida (status/progresso) para o pai atualizar sua lista. */
  onAtualizado?: (tarefaId: string, patch: Partial<Tarefa>) => void;
}

function StatusPorPessoa({
  tarefa,
  users,
  usersById,
  meId,
  canManage,
  onChange,
}: {
  tarefa: Tarefa;
  users: UserOption[];
  usersById: Map<string, UserOption>;
  meId: string | null;
  canManage: boolean;
  onChange: (userId: string, status: Status) => void;
}) {
  const assignees = tarefa.atribuido_para || [];
  if (assignees.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {assignees.map((uid) => {
        const u = usersById.get(uid);
        const currentCol = statusToColumn(getEffectiveStatus(tarefa, uid));
        const editable = uid === meId || canManage || tarefa.criado_por === meId;
        return (
          <div key={uid} className="flex items-center justify-between gap-2 rounded-md bg-noite-900/60 px-2.5 py-1.5 ring-1 ring-inset ring-noite-700">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar user={u} size={20} ring={false} />
              <span className="truncate text-xs font-medium text-noite-100">{userName(u)}</span>
            </div>
            <select
              value={currentCol}
              disabled={!editable}
              onChange={(e) => onChange(uid, e.target.value as Status)}
              className="campo-afundado rounded px-1.5 py-1 text-[11px] text-noite-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

export function ModalDetalhe({ tarefa, usersById, users, meId, canManage, onFechar, onAtualizado }: Props) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [carregandoComentarios, setCarregandoComentarios] = useState(false);
  const [texto, setTexto] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [salvandoProgresso, setSalvandoProgresso] = useState(false);

  useEffect(() => {
    setTexto("");
    if (!tarefa) {
      setComentarios([]);
      return;
    }
    setProgresso(Math.max(0, Math.min(100, Number(tarefa.progresso) || 0)));

    let cancelado = false;
    (async () => {
      setCarregandoComentarios(true);
      const { data, error } = await supabase
        .from("tarefas_comentarios")
        .select("*")
        .eq("tarefa_id", tarefa.id)
        .order("criado_em", { ascending: true });
      if (cancelado) return;
      if (!error) setComentarios((data || []) as Comentario[]);
      setCarregandoComentarios(false);
    })();

    const channel = supabase
      .channel(`tarefa-comentarios-${tarefa.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tarefas_comentarios", filter: `tarefa_id=eq.${tarefa.id}` },
        (payload) => {
          setComentarios((prev) => {
            if (payload.eventType === "INSERT") {
              const n = payload.new as Comentario;
              if (prev.find((c) => c.id === n.id)) return prev;
              return [...prev, n];
            }
            if (payload.eventType === "DELETE") {
              const o = payload.old as Comentario;
              return prev.filter((c) => c.id !== o.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      supabase.removeChannel(channel);
    };
  }, [tarefa]);

  useEffect(() => {
    if (!tarefa) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tarefa, onFechar]);

  const assignedUsers = useMemo(
    () => (tarefa?.atribuido_para || []).map((id) => usersById.get(id)).filter(Boolean) as UserOption[],
    [tarefa, usersById],
  );

  if (!tarefa) return null;

  const criador = tarefa.criado_por ? usersById.get(tarefa.criado_por) : undefined;
  const soleAssigneeId = (tarefa.atribuido_para || [])[0];
  const canEditSoleStatus =
    (tarefa.atribuido_para || []).length <= 1 && (soleAssigneeId === meId || canManage || tarefa.criado_por === meId);
  const podeEditarProgresso = canEditSoleStatus || canManage;

  const enviarComentario = async () => {
    if (!texto.trim() || !meId) return;
    const { error } = await supabase.from("tarefas_comentarios").insert({
      tarefa_id: tarefa.id,
      usuario_id: meId,
      comentario: texto.trim(),
    });
    if (error) {
      toast.error("Erro ao enviar comentário");
      return;
    }
    setTexto("");
  };

  const excluirComentario = async (id: string) => {
    const { error } = await supabase.from("tarefas_comentarios").delete().eq("id", id);
    if (error) toast.error("Sem permissão para excluir");
  };

  const mudarStatusDe = async (userId: string, novoStatus: Status) => {
    const merged: StatusMap = { ...(tarefa.status_por_usuario || {}), [userId]: novoStatus };
    const syncLegacy = (tarefa.atribuido_para || []).length <= 1;
    const payload: Record<string, unknown> = { status_por_usuario: merged, atualizado_em: new Date().toISOString() };
    if (syncLegacy) payload.status = novoStatus;

    const { error } = await supabase
      .from("tarefas")
      .update(payload as Database["public"]["Tables"]["tarefas"]["Update"])
      .eq("id", tarefa.id);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    toast.success("Status atualizado");
    onAtualizado?.(tarefa.id, {
      status_por_usuario: merged,
      status: syncLegacy ? novoStatus : tarefa.status,
    });
  };

  const salvarProgresso = async (valor: number) => {
    setSalvandoProgresso(true);
    const { error } = await supabase
      .from("tarefas")
      .update({ progresso: valor, atualizado_em: new Date().toISOString() } as Database["public"]["Tables"]["tarefas"]["Update"])
      .eq("id", tarefa.id);
    setSalvandoProgresso(false);
    if (error) {
      toast.error("Erro ao salvar progresso");
      return;
    }
    toast.success("Progresso atualizado");
    onAtualizado?.(tarefa.id, { progresso: valor });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onFechar} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalhe"
        className="relative mx-[10px] my-[2px] max-h-[112vh] w-full max-w-[557px] overflow-y-auto rounded-2xl border border-noite-600 bg-noite-850 px-[11px] py-[34px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5">
              <PrioridadeChip prioridade={tarefa.prioridade} />
            </div>
            <h2 id="titulo-detalhe" className="text-lg font-semibold leading-snug text-noite-100">
              {tarefa.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md p-1 text-noite-400 transition hover:bg-noite-700 hover:text-noite-100"
          >
            <XIcon size={16} />
          </button>
        </div>

        {tarefa.descricao && <p className="mb-3 whitespace-pre-wrap text-sm text-noite-300">{tarefa.descricao}</p>}

        <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-noite-400">
          <div className="flex items-center gap-2">
            <span className="font-medium">Responsáveis:</span>
            {assignedUsers.length > 0 ? (
              <>
                <AvatarStack users={assignedUsers} size={20} />
                <span>{assignedUsers.map((u) => userName(u).split(" ")[0]).join(", ")}</span>
              </>
            ) : (
              <span>—</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">Criado por:</span>
            <Avatar user={criador} size={18} ring={false} />
            <span>{userName(criador)}</span>
          </div>
          {tarefa.prazo && (
            <span className="inline-flex items-center gap-1 font-medium">
              <CalendarIcon size={12} />
              {new Date(tarefa.prazo).toLocaleDateString("pt-BR")}
            </span>
          )}
          <EquipeBadges equipes={tarefa.equipes} />
        </div>

        {assignedUsers.length > 1 ? (
          <div className="mb-4">
            <label className="text-xs font-semibold text-noite-300">Status por pessoa</label>
            <div className="mt-1.5">
              <StatusPorPessoa
                tarefa={tarefa}
                users={users}
                usersById={usersById}
                meId={meId}
                canManage={canManage}
                onChange={(uid, s) => void mudarStatusDe(uid, s)}
              />
            </div>
            <p className="mt-1.5 text-[10.5px] text-noite-400">
              Cada responsável tem seu próprio andamento — mudar o status de uma pessoa não afeta as demais.
            </p>
          </div>
        ) : (
          <div className="mb-4">
            <label htmlFor="detalhe-status" className="text-xs font-semibold text-noite-300">
              Status
              {!canEditSoleStatus && (
                <span className="ml-2 text-[10px] font-normal text-amber-400">
                  (somente leitura — apenas o responsável, criador ou gestor podem editar)
                </span>
              )}
            </label>
            <select
              id="detalhe-status"
              value={statusToColumn(getEffectiveStatus(tarefa, soleAssigneeId ?? meId))}
              disabled={!canEditSoleStatus}
              onChange={(e) => canEditSoleStatus && void mudarStatusDe(soleAssigneeId ?? meId ?? "", e.target.value as Status)}
              className="campo-afundado bg-[#040216] mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="rounded-lg border border-noite-600 bg-noite-900/60 p-3">
          <div className="flex items-center justify-between">
            <label htmlFor="detalhe-progresso" className="text-xs font-semibold text-noite-300">
              Progresso
            </label>
            <span className="text-xs font-semibold text-noite-100">{progresso}%</span>
          </div>
          <input
            id="detalhe-progresso"
            type="range"
            min={0}
            max={100}
            step={5}
            value={progresso}
            disabled={!podeEditarProgresso}
            onChange={(e) => setProgresso(Number(e.target.value))}
            onMouseUp={(e) => void salvarProgresso(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => void salvarProgresso(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => void salvarProgresso(Number((e.target as HTMLInputElement).value))}
            className="mt-2 w-full accent-azul-500 disabled:opacity-50"
          />
          {salvandoProgresso && <p className="mt-1 text-[10.5px] text-noite-400">Salvando…</p>}
        </div>

        <div className="mt-5">
          <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-noite-300">
            <MessageSquareIcon size={13} /> Comentários ({comentarios.length})
          </h3>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {carregandoComentarios ? (
              <p className="text-xs text-noite-400">Carregando...</p>
            ) : comentarios.length === 0 ? (
              <p className="text-xs text-noite-400">Nenhum comentário ainda.</p>
            ) : (
              comentarios.map((c) => {
                const autor = usersById.get(c.usuario_id);
                const meuComentario = c.usuario_id === meId;
                return (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 rounded-lg bg-noite-900/70 p-2.5 ring-1 ring-inset ring-noite-700"
                  >
                    <Avatar user={autor} size={22} ring={false} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-noite-100">{userName(autor)}</span>
                        <span className="text-[10px] text-noite-400">
                          {c.criado_em
                            ? new Date(c.criado_em).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-noite-200">{c.comentario}</p>
                    </div>
                    {(meuComentario || canManage) && (
                      <button
                        type="button"
                        onClick={() => void excluirComentario(c.id)}
                        aria-label="Excluir comentário"
                        className="text-noite-400 transition hover:text-rose-400"
                      >
                        <Trash2Icon size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviarComentario();
                }
              }}
              placeholder="Escreva um comentário..."
              aria-label="Novo comentário"
              className="campo-afundado bg-[#040216] flex-1 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void enviarComentario()}
              aria-label="Enviar comentário"
              className="botao-relevo flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-azul-600 text-white transition hover:bg-azul-500"
            >
              <SendIcon size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
