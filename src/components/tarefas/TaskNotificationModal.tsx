import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UserOption {
  id: string;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  atribuido_para: string | null;
  criado_por: string | null;
  prioridade: string | null;
  prazo: string | null;
}

interface Notificacao {
  id: string;
  id_da_tarefa: string;
  user_id: string;
  mensagem: string;
  lido: boolean | null;
  criado_em: string | null;
  tarefa?: Tarefa;
  criador?: UserOption;
}

function userInitials(u: UserOption | undefined): string {
  if (!u) return "?";
  const name = u.full_name || u.display_name || u.email || "?";
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function userColor(id: string | null | undefined): string {
  if (!id) return "hsl(215 20% 55%)";
  const palette = [
    "hsl(192 70% 60%)",
    "hsl(45 100% 60%)",
    "hsl(217 91% 65%)",
    "hsl(142 60% 55%)",
    "hsl(280 70% 65%)",
    "hsl(20 90% 60%)",
    "hsl(330 70% 60%)",
  ];
  let h = 0;
  for (let i = 0; i < (id || "").length; i++)
    h = (h * 31 + (id || "").charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function Avatar({ user, size = 30 }: { user: UserOption | undefined; size?: number }) {
  const color = userColor(user?.id);
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white shrink-0 shadow-sm"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.4,
      }}
    >
      {userInitials(user)}
    </div>
  );
}

export default function TaskNotificationModal({
  meId,
  users,
}: {
  meId: string | null;
  users: UserOption[];
}) {
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const userById = useMemo(() => {
    const m = new Map<string, UserOption>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  // Load unread notifications
  useEffect(() => {
    if (!meId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tarefas_notificacoes")
        .select("*")
        .eq("user_id", meId)
        .eq("lido", false)
        .order("criado_em", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar notificações:", error);
      } else {
        // Enriquecer notificações com dados das tarefas
        const enriched = await Promise.all(
          (data || []).map(async (notif) => {
            const tarefasRes = await supabase
              .from("tarefas")
              .select("*")
              .eq("id", notif.id_da_tarefa)
              .single();

            const tarefa = tarefasRes.data as Tarefa | null;
            const criador = tarefa?.criado_por
              ? userById.get(tarefa.criado_por)
              : undefined;

            return {
              ...notif,
              tarefa,
              criador,
            } as Notificacao;
          })
        );

        setNotifications(enriched);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [meId, userById]);

  // Realtime subscription para novas notificações
  useEffect(() => {
    if (!meId) return;

    const channel = supabase
      .channel("task-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tarefas_notificacoes",
          filter: `user_id=eq.${meId}`,
        },
        (payload) => {
          setNotifications((prev) => {
            const n = payload.new as any;
            if (prev.find((notif) => notif.id === n.id)) return prev;
            return [{ ...n, tarefa: undefined, criador: undefined }, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId]);

  const handleMarkAsRead = async (notifId: string) => {
    const { error } = await supabase
      .from("tarefas_notificacoes")
      .update({ lido: true, atualizado_em: new Date().toISOString() })
      .eq("id", notifId);

    if (error) {
      toast.error("Erro ao marcar como visualizado");
      return;
    }

    setNotifications((prev) => prev.filter((n) => n.id !== notifId));

    // Notificar o criador
    const notif = notifications.find((n) => n.id === notifId);
    if (notif?.tarefa?.criado_por) {
      await supabase.from("tarefas_notificacoes").insert({
        id_da_tarefa: notif.id_da_tarefa,
        user_id: notif.tarefa.criado_por,
        mensagem: `${userById.get(meId || "")?.full_name || "Usuário"} visualizou a tarefa "${notif.tarefa.titulo}"`,
        lido: false,
      });
    }

    if (notifications.length === 1) {
      toast.success("Tarefa marcada como visualizada");
    }
  };

  const handleDismiss = async () => {
    if (currentIndex < notifications.length) {
      const current = notifications[currentIndex];
      await handleMarkAsRead(current.id);
      if (currentIndex < notifications.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  if (loading || notifications.length === 0) return null;

  const current = notifications[currentIndex];
  if (!current) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm border-blue-200">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-700">
                Nova Tarefa Recebida!
              </h3>
              <p className="text-sm text-gray-600">
                {currentIndex + 1} de {notifications.length}
              </p>
            </div>
            <button
              onClick={() => {
                // Marcar todas como lidas e fechar
                notifications.forEach((n) => {
                  void handleMarkAsRead(n.id);
                });
              }}
              className="flex items-center justify-center w-8 h-8 rounded transition-colors hover:bg-red-500 hover:text-white"
              title="Fechar todas"
            >
              <X size={18} />
            </button>
          </div>

          {/* Message */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-gray-600 font-medium text-sm">
              {current.criador?.full_name || current.criador?.display_name || "Alguém"} delegou uma tarefa para você:
            </p>
            <h4 className="text-lg font-bold text-gray-800 mt-2">
              {current.tarefa?.titulo || "Tarefa"}
            </h4>
            {current.tarefa?.descricao && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                {current.tarefa.descricao}
              </p>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2 text-xs text-gray-600 bg-slate-50 p-3 rounded">
            <div className="flex justify-between">
              <span>Prioridade:</span>
              <span className="font-medium">
                {current.tarefa?.prioridade
                  ? current.tarefa.prioridade.charAt(0).toUpperCase() +
                    current.tarefa.prioridade.slice(1)
                  : "—"}
              </span>
            </div>
            {current.tarefa?.prazo && (
              <div className="flex justify-between">
                <span>Prazo:</span>
                <span className="font-medium">
                  {new Date(current.tarefa.prazo).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => void handleDismiss()}
              className="flex-1 px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-all"
            >
              Próxima
            </button>
            <button
              onClick={() => void handleMarkAsRead(current.id)}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all"
            >
              Marcar como Ciente
            </button>
          </div>

          {/* Info */}
          <p className="text-xs text-gray-500 text-center">
            Você receberá mais notificações conforme novas tarefas forem delegadas
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
