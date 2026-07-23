import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import TarefasKanban from "@/components/tarefas/TarefasKanban";
import TarefasLista from "@/components/tarefas/TarefasLista";
import TaskNotificationModal from "@/components/tarefas/TaskNotificationModal";
import { CheckSquare, User, Users, LayoutGrid, List } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function MinhasTarefas() {
  const { isAdmin, isGestorMaster } = useUserRole();
  const isManager = isAdmin || isGestorMaster;
  const [view, setView] = useState<"minhas" | "equipe">("minhas");
  const [layout, setLayout] = useState<"kanban" | "lista">("kanban");
  const [userId, setUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar dados do usuário
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
      }

      // Carregar lista de usuários
      const { data: usersData } = await supabase
        .from("user_profiles")
        .select("id, full_name, display_name, email, avatar_url")
        .order("full_name", { ascending: true });

      if (usersData) {
        setUsers(usersData);
      }

      setLoading(false);
    })();
  }, []);

  return (
    <Layout>
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isManager
                  ? view === "minhas"
                    ? "Minhas Tarefas"
                    : "Tarefas da Equipe"
                  : "Minhas Tarefas"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isManager
                  ? view === "minhas"
                    ? "Tarefas privadas criadas por você - com controle total"
                    : "Tarefas que você delegou para a equipe"
                  : "Tarefas privadas criadas por você e tarefas atribuídas pela equipe"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Seletor de Visualização de Pessoas */}
            {isManager && (
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                <button
                  onClick={() => setView("minhas")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    view === "minhas"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <User className="h-4 w-4" />
                  Minhas
                </button>
                <button
                  onClick={() => setView("equipe")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                    view === "equipe"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="h-4 w-4" />
                  Equipe
                </button>
              </div>
            )}

            {/* Seletor de Layout (Kanban/Lista) */}
            <div className="inline-flex rounded-lg border border-border bg-card p-1">
              <button
                onClick={() => setLayout("kanban")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                  layout === "kanban"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Visualização Kanban"
              >
                <LayoutGrid className="h-4 w-4" />
                Kanban
              </button>
              <button
                onClick={() => setLayout("lista")}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                  layout === "lista"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Visualização em Lista"
              >
                <List className="h-4 w-4" />
                Lista
              </button>
            </div>
          </div>
        </div>

        {/* Renderizar com base no layout selecionado */}
        <div className="rounded-2xl bg-[#0b0d12] border border-white/5 shadow-2xl overflow-hidden">
          {layout === "kanban" ? (
            <TarefasKanban myView={isManager && view === "minhas"} isManager={isManager} />
          ) : (
            <TarefasLista myView={isManager && view === "minhas"} isManager={isManager} />
          )}
        </div>
      </div>

      {/* Modal de notificações de tarefas recebidas */}
      <TaskNotificationModal meId={userId} users={users} />
    </Layout>
  );
}
