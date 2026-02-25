import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CheckSquare, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: string;
  title: string;
  priority: "baixa" | "media" | "alta";
  status: "pendente" | "em progresso" | "concluida";
  due_date: string | null;
}

export function TasksPanel() {
  const navigate = useNavigate();
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .order("due_date", { ascending: true });

      if (error) throw error;

      const tasks = (data || []) as Task[];
      const pending = tasks.filter(t => t.status === "pendente" || t.status === "em progresso");
      
      setPendingTasks(pending.slice(0, 3));
      setTotalTasks(pending.length);
    } catch (error) {
      console.error("Erro ao carregar tarefas:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "alta":
        return "bg-destructive/20 text-destructive border-destructive";
      case "media":
        return "bg-warning/20 text-warning border-warning";
      case "baixa":
        return "bg-success/20 text-success border-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Minhas Tarefas</h3>
        </div>
        {totalTasks > 0 && (
          <Badge variant="secondary" className="bg-warning/20 text-warning">
            {totalTasks} pendente{totalTasks !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Carregando tarefas...
        </div>
      ) : totalTasks === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <CheckSquare className="mx-auto h-10 w-10 mb-2 opacity-50" />
          <p>Nenhuma tarefa pendente!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingTasks.map((task) => (
            <div 
              key={task.id}
              className="p-2 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => navigate("/minhas-tarefas")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  {task.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Vence em {new Date(task.due_date).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-xs flex-shrink-0 ${getPriorityColor(task.priority)}`}
                >
                  {task.priority}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button 
        variant="ghost" 
        className="w-full mt-4 text-primary hover:text-primary/80"
        onClick={() => navigate("/minhas-tarefas")}
      >
        Ver Todas as Tarefas
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
