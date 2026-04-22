import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import TarefasKanban from "@/components/tarefas/TarefasKanban";
import { CheckSquare, User, Users } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

export default function MinhasTarefas() {
  const { isAdmin, isGestorMaster } = useUserRole();
  const isManager = isAdmin || isGestorMaster;
  const [view, setView] = useState<"minhas" | "equipe">("minhas");

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
                {view === "minhas" ? "Minhas Tarefas" : "Tarefas da Equipe"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {view === "minhas"
                  ? "Tarefas privadas criadas por você - com controle total"
                  : "Tarefas atribuídas a você por administradores - visualizar e comentar"}
              </p>
            </div>
          </div>

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
        </div>
        <TarefasKanban myView={view === "minhas"} />
      </div>
    </Layout>
  );
}
