import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: "baixa" | "media" | "alta";
  status: "pendente" | "em progresso" | "concluida";
  assigned_to: string | null;
  requested_by: string | null;
  created_at: string;
}

export function TasksQuickAccess() {
  const navigate = useNavigate();
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPendingTasks = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`)
        .eq("status", "pendente")
        .order("due_date", { ascending: true });

      if (!error && data) {
        setPendingTasks((data as Task[]).slice(0, 3));
      }
      setLoading(false);
    };

    void fetchPendingTasks();
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "media":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "baixa":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Card: Tarefas Pendentes */}
      <Card className="border-border hover:border-primary/50 transition-all">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Tarefas Pendentes
          </CardTitle>
          <CardDescription>Suas tarefas aguardando conclusão</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : pendingTasks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Nenhuma tarefa pendente! 🎉
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
              {pendingTasks.length > 0 && (
                <p className="text-xs text-muted-foreground pt-2">
                  Mostrando {pendingTasks.length} de suas tarefas pendentes
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card: Acessar Minhas Tarefas */}
      <Card className="border-border hover:border-primary/50 transition-all flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Gerenciar Tarefas
          </CardTitle>
          <CardDescription>Acesse todas as suas tarefas</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-between">
          <p className="text-sm text-muted-foreground mb-4">
            Visualize, crie e edite todas as suas tarefas em um único lugar. Acompanhe o progresso e mantenha-se organizado.
          </p>
          <Button
            onClick={() => navigate("/minhas-tarefas")}
            className="w-full"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Ir para Minhas Tarefas
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
