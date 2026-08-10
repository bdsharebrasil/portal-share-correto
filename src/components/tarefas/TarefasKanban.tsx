import { useEffect, useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { equipesDoUsuario } from "@/lib/tarefas-teams";
import type { Database } from "@/integrations/supabase/types";
import { ColunaKanban, type ModoOrdenacao } from "@/components/tarefas/ColunaKanban";
import { ModalNovaTarefa, type NovaTarefaForm } from "@/components/tarefas/ModalNovaTarefa";
import { ModalDetalhe } from "@/components/tarefas/ModalDetalhe";
import { PRIORITY_ORDER } from "@/components/tarefas/priority";
import {
  COLUMNS,
  getEffectiveStatus,
  statusToColumn,
  type Priority,
  type Status,
  type StatusMap,
  type Tarefa,
  type UserOption,
} from "@/components/tarefas/types";

interface Props {
  /** Se true, mostra apenas as tarefas atribuídas/criadas pelo usuário (visão "minhas"). */
  myView?: boolean;
  title?: string;
  subtitle?: string;
}

export default function TarefasKanban({ myView = false, title, subtitle }: Props) {
  const { isAdmin, isGestorMaster, userRoles, isLoading: roleLoading } = useUserRole();
  const isManager = isAdmin || isGestorMaster;
  // mantido para paridade com o hook original — hoje não é usado diretamente aqui,
  // mas fica disponível caso o filtro por equipe precise dele.
  void useMemo(() => equipesDoUsuario(userRoles || []), [userRoles]);

  const [me, setMe] = useState<string | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<Status>("a-fazer");
  const [detailTask, setDetailTask] = useState<Tarefa | null>(null);

  const [colSort, setColSort] = useState<Record<Status, ModoOrdenacao>>({
    "a-fazer": "padrao",
    "em-andamento": "padrao",
    revisao: "padrao",
    concluido: "padrao",
  });

  // -------------------------------------------------- Load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setMe(user.id);

      const [tarefasRes, usersRes] = await Promise.all([
        supabase.from("tarefas").select("*").or("origem.eq.kanban,origem.is.null").order("criado_em", { ascending: false }),
        supabase.from("user_profiles").select("id, full_name, display_name, email, avatar_url").order("full_name", { ascending: true }),
      ]);
      if (cancelled) return;

      if (tarefasRes.error) {
        console.error(tarefasRes.error);
        toast.error("Erro ao carregar tarefas");
      } else {
        setTarefas((tarefasRes.data || []) as unknown as Tarefa[]);
      }
      if (!usersRes.error) {
        setUsers((usersRes.data || []) as UserOption[]);
      }

      const { data: commentsData } = await supabase.from("tarefas_comentarios").select("tarefa_id");
      if (!cancelled && commentsData) {
        const counts: Record<string, number> = {};
        for (const c of commentsData as { tarefa_id: string }[]) {
          counts[c.tarefa_id] = (counts[c.tarefa_id] || 0) + 1;
        }
        setCommentCounts(counts);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------- Realtime: contagem de comentários
  useEffect(() => {
    const channel = supabase
      .channel("tarefas-comment-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas_comentarios" }, (payload) => {
        setCommentCounts((prev) => {
          const next = { ...prev };
          if (payload.eventType === "INSERT") {
            const n = payload.new as { tarefa_id: string };
            next[n.tarefa_id] = (next[n.tarefa_id] || 0) + 1;
          } else if (payload.eventType === "DELETE") {
            const o = payload.old as { tarefa_id: string };
            next[o.tarefa_id] = Math.max(0, (next[o.tarefa_id] || 0) - 1);
          }
          return next;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // -------------------------------------------------- Realtime: tarefas
  useEffect(() => {
    const channel = supabase
      .channel("tarefas-kanban")
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, (payload) => {
        setTarefas((prev) => {
          if (payload.eventType === "INSERT") {
            const n = payload.new as unknown as Tarefa;
            if (n.origem === "lista") return prev;
            if (prev.find((t) => t.id === n.id)) return prev;
            return [n, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            const n = payload.new as unknown as Tarefa;
            if (n.origem === "lista") return prev;
            return prev.map((t) => (t.id === n.id ? n : t));
          }
          if (payload.eventType === "DELETE") {
            const o = payload.old as unknown as Tarefa;
            return prev.filter((t) => t.id !== o.id);
          }
          return prev;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const usersById = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  // -------------------------------------------------- Filtragem
  const visibleTasks = useMemo(() => {
    if (!me) return [];
    const mine = tarefas.filter((t) => t.criado_por === me || (t.atribuido_para || []).includes(me));
    if (!isManager) return mine;
    if (myView) {
      return mine.filter((t) => t.criado_por === me && (t.atribuido_para || []).every((a) => a === me));
    }
    const delegadas = mine.filter((t) => t.criado_por === me && (t.atribuido_para || []).some((a) => a !== me));
    const compartilhadas = tarefas.filter((t) => t.criado_por !== me && t.publico === true);
    const ids = new Set(delegadas.map((t) => t.id));
    return [...delegadas, ...compartilhadas.filter((t) => !ids.has(t.id))];
  }, [tarefas, me, myView, isManager]);

  const getColTasks = (colId: Status) => {
    const list = visibleTasks.filter((t) => statusToColumn(getEffectiveStatus(t, me)) === colId);
    const mode = colSort[colId];
    if (mode === "prioridade") {
      return [...list].sort(
        (a, b) => (PRIORITY_ORDER[(a.prioridade as Priority) || "media"] ?? 2) - (PRIORITY_ORDER[(b.prioridade as Priority) || "media"] ?? 2),
      );
    }
    if (mode === "prazo") {
      return [...list].sort((a, b) => {
        if (!a.prazo && !b.prazo) return 0;
        if (!a.prazo) return 1;
        if (!b.prazo) return -1;
        return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
      });
    }
    return list;
  };

  // -------------------------------------------------- Mutations

  /**
   * Quem pode usar a troca rápida (drag-and-drop / seletor no card): a
   * pessoa logada sendo uma das responsáveis, ou — quando há um único
   * responsável e não há ambiguidade sobre de quem é o status — o
   * criador/gestor. Tarefas com vários responsáveis onde eu não sou um
   * deles só dá pra administrar pelo detalhe da tarefa.
   */
  const podeMudarStatus = (task: Tarefa): boolean => {
    const assignees = task.atribuido_para || [];
    if (assignees.includes(me || "")) return true;
    if (assignees.length <= 1) return isManager || task.criado_por === me;
    return false;
  };

  const podeExcluir = (task: Tarefa): boolean => task.criado_por === me || (isManager && !!task.publico);

  const handleStatusChange = async (id: string, newStatus: Status, targetUserId?: string) => {
    const task = tarefas.find((t) => t.id === id);
    if (!task) return;

    if (!podeMudarStatus(task)) {
      toast.error("Você não tem permissão para alterar o status desta tarefa");
      return;
    }

    const assignees = task.atribuido_para || [];
    const forUser = targetUserId || (assignees.includes(me || "") ? me : assignees[0]) || me;
    if (!forUser) return;

    const mergedMap: StatusMap = { ...(task.status_por_usuario || {}), [forUser]: newStatus };
    const syncLegacy = assignees.length <= 1;

    const previous = tarefas;
    setTarefas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status_por_usuario: mergedMap, status: syncLegacy ? newStatus : t.status } : t)),
    );

    const updatePayload: Record<string, unknown> = { status_por_usuario: mergedMap, atualizado_em: new Date().toISOString() };
    if (syncLegacy) updatePayload.status = newStatus;

    const { error } = await supabase
      .from("tarefas")
      .update(updatePayload as Database["public"]["Tables"]["tarefas"]["Update"])
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar status");
      setTarefas(previous);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;
    const previous = tarefas;
    setTarefas((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (error) {
      toast.error("Sem permissão para excluir");
      setTarefas(previous);
    } else {
      toast.success("Tarefa excluída");
    }
  };

  const handleClearCompleted = async () => {
    const completed = getColTasks("concluido").filter((t) => t.criado_por === me || (isManager && t.publico));
    if (completed.length === 0) {
      toast.info("Nenhuma tarefa concluída para limpar");
      return;
    }
    if (!confirm(`Excluir ${completed.length} tarefa(s) concluída(s)?`)) return;

    const ids = completed.map((t) => t.id);
    const previous = tarefas;
    setTarefas((prev) => prev.filter((t) => !ids.includes(t.id)));
    const { error } = await supabase.from("tarefas").delete().in("id", ids);
    if (error) {
      toast.error("Erro ao limpar tarefas concluídas");
      setTarefas(previous);
    } else {
      toast.success("Tarefas concluídas removidas");
    }
  };

  const handleDrop = (colId: Status) => {
    if (!dragId) return;
    void handleStatusChange(dragId, colId);
    setDragId(null);
  };

  const handleCreate = async (form: NovaTarefaForm) => {
    if (!me) return;
    const assignees = form.atribuido_para.length > 0 ? form.atribuido_para : [me];
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      atribuido_para: assignees,
      criado_por: me,
      prioridade: form.prioridade,
      status: form.status,
      status_por_usuario: {},
      prazo: form.prazo || null,
      publico: form.publico,
      origem: "kanban",
      equipes: form.equipes || [],
      progresso: Math.max(0, Math.min(100, form.progresso || 0)),
    } as unknown as Database["public"]["Tables"]["tarefas"]["Insert"];

    const { data, error } = await supabase.from("tarefas").insert(payload).select().single();
    if (error) {
      console.error(error);
      toast.error("Erro ao criar tarefa");
      return;
    }

    if (data) {
      const nomeCriador = users.find((u) => u.id === me)?.full_name || me;
      const outrosResponsaveis = assignees.filter((id) => id !== me);
      await Promise.all(
        outrosResponsaveis.map((userId) =>
          supabase.from("tarefas_notificacoes").insert({
            id_da_tarefa: data.id,
            user_id: userId,
            mensagem: `${nomeCriador} delegou uma nova tarefa: "${form.titulo}"`,
            lido: false,
          }),
        ),
      );
    }

    toast.success("Tarefa criada");
    setCreateOpen(false);
  };

  const handleTaskPatch = (id: string, patch: Partial<Tarefa>) => {
    setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDetailTask((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  // -------------------------------------------------- Stats
  const stats = useMemo(
    () => ({
      total: visibleTasks.length,
      urgente: visibleTasks.filter((t) => t.prioridade === "urgente").length,
      concluido: visibleTasks.filter((t) => statusToColumn(getEffectiveStatus(t, me)) === "concluido").length,
    }),
    [visibleTasks, me],
  );

  if (loading || roleLoading) {
    return <div className="p-8 text-center text-sm text-noite-100">Carregando tarefas...</div>;
  }

  const canCreateForOthers = isManager && !myView;
  const headingTitle = title || (myView ? "Minhas Tarefas" : "Painel de Tarefas");
  const headingSubtitle =
    subtitle ||
    (myView
      ? "Tarefas atribuídas a você ou criadas por você"
      : isManager
        ? "Gerencie e acompanhe todas as tarefas da equipe"
        : "Suas tarefas");

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#1c335d] bg-[#101a2e] text-noite-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-noite-700 px-5 py-4">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-noite-400">Kanban</p>
            <h1 className="text-2xl font-semibold text-noite-100">{headingTitle}</h1>
            <p className="mt-0.5 text-xs text-noite-400">{headingSubtitle}</p>
          </div>

          <div className="hidden gap-1.5 md:flex">
            {[
              { label: "Total", val: stats.total },
              { label: "Urgentes", val: stats.urgente },
              { label: "Concluídas", val: stats.concluido },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5 rounded-full border border-[rgba(16,22,34,1)] bg-noite-800/70 px-2.5 py-1">
                <span className="text-sm font-semibold text-noite-100">{s.val}</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-noite-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setDefaultStatus("a-fazer");
            setCreateOpen(true);
          }}
          className="botao-relevo flex h-9 items-center gap-1.5 rounded-full border border-[rgba(16,22,34,1)] bg-[#225345] px-4 text-sm font-medium text-white shadow-[1px_1px_2px_0_rgba(20,17,17,1)] transition hover:bg-[#225345]"
        >
          <PlusIcon size={14} />
          Nova Tarefa
        </button>
      </div>

      <div className="flex min-h-[500px] gap-4 overflow-x-auto p-5">
        {COLUMNS.map((col) => (
          <ColunaKanban
            key={col.id}
            coluna={col}
            tarefas={getColTasks(col.id)}
            usersById={usersById}
            commentCounts={commentCounts}
            arrastandoId={dragId}
            ativa={dragOver === col.id}
            meId={me}
            sortMode={colSort[col.id]}
            onSortModeChange={(modo) => setColSort((prev) => ({ ...prev, [col.id]: modo }))}
            showClearCompleted={col.id === "concluido"}
            onClearCompleted={() => void handleClearCompleted()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.id);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => {
              handleDrop(col.id);
              setDragOver(null);
            }}
            onNovaTarefa={() => {
              setDefaultStatus(col.id);
              setCreateOpen(true);
            }}
            onArrastar={setDragId}
            onAbrirTarefa={setDetailTask}
            onExcluirTarefa={(id) => void handleDelete(id)}
            onMudarStatus={(id, status) => void handleStatusChange(id, status)}
            podeMudarStatus={podeMudarStatus}
            podeExcluir={podeExcluir}
          />
        ))}
      </div>

      <ModalNovaTarefa
        aberto={createOpen}
        statusInicial={defaultStatus}
        users={users}
        meId={me}
        canAssignOthers={canCreateForOthers}
        onFechar={() => setCreateOpen(false)}
        onCriar={handleCreate}
      />

      <ModalDetalhe
        tarefa={detailTask}
        usersById={usersById}
        users={users}
        meId={me}
        canManage={isManager}
        onFechar={() => setDetailTask(null)}
        onAtualizado={handleTaskPatch}
      />
    </div>
  );
}
