import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import TarefasKanban from "@/components/tarefas/TarefasKanban";
import TarefasLista from "@/components/tarefas/TarefasLista";
import TarefasCalendario from "@/components/tarefas/TarefasCalendario";
import TaskNotificationModal from "@/components/tarefas/TaskNotificationModal";
import { 
  User, 
  Users, 
  LayoutGrid, 
  List, 
  CalendarDays
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function MinhasTarefas() {
  const { isAdmin, isGestorMaster } = useUserRole();
  const isManager = isAdmin || isGestorMaster;
  const [view, setView] = useState<"minhas" | "equipe">("minhas");
  const [layout, setLayout] = useState<"kanban" | "lista" | "calendario">("kanban");
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
      <div className="w-full max-w-full space-y-6 pb-8 text-foreground">
        
        {/* Cabeçalho Principal Estilo Imagem */}
        <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-6 pb-2">
          
          {/* Esquerda: Título e Badges */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
            <div className="flex flex-col px-[28px]">
              <span className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase">
                {layout}
              </span>
              <h1 className="text-2xl font-semibold text-white tracking-tight">Painel de Tarefas</h1>
            </div>

          </div>

          {/* Direita: Controles e Seus Menus Originais */}
          <div className="mx-[18px] flex flex-wrap items-center gap-3">
            
            {/* Seletor de Visualização de Pessoas (Seu Menu Original) */}
            {isManager && (
              <div className="inline-flex rounded-full border border-border/50 bg-card/50 p-1">
                <button
                  onClick={() => setView("minhas")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    view === "minhas"
                      ? "bg-secondary text-white shadow-sm"
                      : "text-muted-foreground hover:text-white"
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  Minhas
                </button>
                <button
                  onClick={() => setView("equipe")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    view === "equipe"
                      ? "bg-secondary text-white shadow-sm"
                      : "text-muted-foreground hover:text-white"
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  Equipe
                </button>
              </div>
            )}

            {/* Seletor de Layout (Seu Menu Original) */}
            <div className="inline-flex rounded-full border border-border/50 bg-card/50 p-1">
              <button
                onClick={() => setLayout("kanban")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  layout === "kanban"
                    ? "bg-secondary text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
                title="Visualização Kanban"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                onClick={() => setLayout("lista")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  layout === "lista"
                    ? "bg-secondary text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
                title="Visualização em Lista"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setLayout("calendario")}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  layout === "calendario"
                    ? "bg-secondary text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                )}
                title="Visualização em Calendário"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Calendário</span>
              </button>
            </div>

          </div>
        </div>

        {/* Renderizar com base no layout selecionado */}
        <div className="mt-5 w-full max-w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0b0d12] shadow-2xl">
          {layout === "kanban" ? (
            <TarefasKanban myView={isManager && view === "minhas"} />
          ) : layout === "lista" ? (
            <TarefasLista myView={isManager && view === "minhas"} isManager={isManager} />
          ) : (
            <TarefasCalendario myView={isManager && view === "minhas"} isManager={isManager} />
          )}
        </div>
      </div>

      {/* Modal de notificações de tarefas recebidas */}
      <TaskNotificationModal meId={userId} users={users} />
    </Layout>
  );
}
