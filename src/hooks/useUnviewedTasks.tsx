import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnviewedTasks(userId: string | null) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Carregar contagem inicial
    (async () => {
      setLoading(true);
      const { count: unviewedCount, error } = await supabase
        .from("tarefas_notificacoes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lido", false);

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar tarefas não visualizadas:", error);
      } else {
        setCount(unviewedCount || 0);
      }
      setLoading(false);
    })();

    // Realtime subscription
    const channel = supabase
      .channel(`unviewed-tasks-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tarefas_notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif.lido === false) {
            setCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tarefas_notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.lido === true) {
            setCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { count, loading };
}
