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
        setPendingTasks((data as unknown as Task[]).slice(0, 3));
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
    <Card className="border-border hover:border-primary/50 transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Minhas Tarefas</CardTitle>
            <CardDescription className="text-xs mt-1">Suas tarefas aguardando conclusão</CardDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/minhas-tarefas")}
        >
          Ver todas
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Carregando tarefas...
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nenhuma tarefa pendente! 🎉
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                onClick={() => navigate("/minhas-tarefas")}
              >
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
  );
}
