import { useState, useEffect, useMemo } from "react";
import { Calendar, CheckSquare, Plane, Clock, Users, FileText, ArrowRight, Check, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import aviationHero from "@/assets/aviation-hero.jpg";
import TaskDialog from "@/components/tasks/TaskDialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from "@/hooks/useUserRole";

export function MainContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isFinanceiroMaster, isGestorMaster } = useUserRole();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [userDisplayName, setUserDisplayName] = useState<string>("");

  useEffect(() => {
    fetchTasks();
    fetchUserDisplayName();
  }, [user]);

  const fetchUserDisplayName = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Erro ao carregar nome do usuário:", error);
        return;
      }

      setUserDisplayName(data?.display_name || "");
    } catch (e) {
      console.error("Erro ao buscar display_name:", e);
    }
  };

  const fetchTasks = async () => {
    if (!user) return;

    try {
      const assignedResult = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .order("created_at", { ascending: false });

      const createdResult = await supabase
        .from("tasks")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (assignedResult.error) {
        console.error("Erro ao carregar tarefas atribuídas:", assignedResult.error);
        setTasks([]);
        return;
      }

      if (createdResult.error) {
        console.error("Erro ao carregar tarefas criadas:", createdResult.error);
        setTasks([]);
        return;
      }

      const assignedTasks = assignedResult.data || [];
      const createdTasks = createdResult.data || [];

      const tasksMap = new Map();
      [...assignedTasks, ...createdTasks].forEach(task => {
        tasksMap.set(task.id, task);
      });

      const uniqueTasks = Array.from(tasksMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTasks(uniqueTasks);
    } catch (e) {
      console.error("Erro ao buscar tarefas:", e);
      setTasks([]);
    }
  };

  const quickAccess = useMemo(() => {
    const baseAccess = [
      {
        title: "Relatório de Viagem",
        description: "Gerar e gerenciar relatórios",
        icon: FileText,
        action: () => navigate("/financeiro/viagem"),
        gradient: "from-custom-cyan to-primary",
      },
      {
        title: "Portal do Cliente",
        description: "Área do cliente com CNPJ e matrícula",
        icon: Plane,
        action: () => navigate("/portal-cliente"),
        gradient: "from-custom-cyan to-primary",
      },
    ];

    return baseAccess;
  }, [navigate]);

  const todayTasks = tasks.filter(task => {
    // Mostrar todas as tarefas pendentes (não apenas as de hoje)
    return task.status !== 'concluida';
  });

  const toggleTask = async (task: any, checked: boolean) => {
    try {
      await supabase
        .from("tasks")
        .update({ status: checked ? "concluida" : "pendente" })
        .eq("id", task.id);
      fetchTasks();
    } catch (e) {
      console.error("Erro ao atualizar tarefa", e);
    }
  };

  const { data: scheduledFlights = [] } = useQuery({
    queryKey: ["scheduled-flights-dashboard"],
    queryFn: async () => {
      try {
        const res = await supabase
          .from("flight_schedules")
          .select(`
            id,
            status,
            flight_date,
            flight_time,
            passengers,
            origin,
            destination,
            aircraft_id,
            client_id,
            crew_member_id,
            aircraft:aircraft_id(registration, model),
            client:client_id(company_name),
            crew:crew_member_id(full_name)
          `)
          .order("flight_date", { ascending: true })
          .limit(5);

        // Supabase sometimes returns an error object that can contain streaming body data.
        // Avoid logging the full error object (which may attempt to read the body stream) — log only safe fields.
        if (res.error) {
          const safeMsg = res.error.message ?? String(res.error?.code ?? res.error?.details ?? 'Unknown error');
          console.error("Erro ao carregar voos agendados:", safeMsg);
          return [];
        }

        return res.data || [];
      } catch (err: any) {
        // Avoid printing raw response-like objects to console which could re-read the body stream.
        const msg = err instanceof Error ? err.message : JSON.stringify(err, Object.getOwnPropertyNames(err));
        console.error("Erro inesperado ao carregar voos:", msg);
        return [];
      }
    },
  });

  return (
    <main className="flex-1 p-6 space-y-6 bg-gradient-subtle">
      {/* Hero Section com Mensagem de Boas-vindas */}
      <div className="relative mb-8 rounded-2xl overflow-hidden shadow-elevated">
        <div
          className="h-72 bg-cover bg-center bg-no-repeat relative rounded-2xl"
          style={{ backgroundImage: `url(${aviationHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/60" />

          <div className="relative h-full flex items-center justify-between px-10">
            <div className="max-w-2xl">
              <div className="mb-2">
                <p className="text-primary/90 font-semibold text-sm uppercase tracking-widest">
                  {(() => {
                    const hour = new Date().getHours();
                    if (hour < 12) return "☀️ Bom dia";
                    if (hour < 18) return "🌤️ Boa tarde";
                    return "🌙 Boa noite";
                  })()}, {userDisplayName || "Usuário"}
                </p>
              </div>
              <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
                Bem-vindo ao Portal Share Brasil
              </h1>
              <div className="w-16 h-1 bg-gradient-to-r from-primary to-cyan-400 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Acessos Rápidos */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">Acessos Rápidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickAccess.map((item, index) => (
            <Card
              key={index}
              className="group bg-gradient-card border-border shadow-card hover:shadow-glow transition-all duration-300 cursor-pointer overflow-hidden hover-scale rounded-lg p-4"
              onClick={item.action}
            >
              <CardHeader className="pb-2">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-3 shadow-primary`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <CardTitle className="text-foreground group-hover:text-primary transition-colors">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-muted-foreground text-sm mb-4">{item.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-border hover:bg-primary hover:text-primary-foreground hover:border-primary group rounded-md"
                >
                  Acessar
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tarefas do Dia */}
        <Card className="bg-gradient-card border-border shadow-card rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center text-foreground">
              <Clock className="mr-2 h-5 w-5 text-primary" />
              Tarefas do Dia
            </CardTitle>
            <Badge className="bg-primary text-primary-foreground">
              {todayTasks.length} pendentes
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Nenhuma tarefa pendente</p>
              </div>
            ) : (
              todayTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                  <Checkbox
                    checked={task.status === 'concluida'}
                    onCheckedChange={(v) => toggleTask(task, Boolean(v))}
                  />
                  <div className="flex-1">
                    <p className={`font-medium ${task.status === 'concluida' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Prioridade: {task.priority}
                    </p>
                  </div>
                  <Badge variant={task.status === 'pendente' ? 'secondary' : 'default'}>
                    {task.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Voos Agendados */}
        <Card className="bg-gradient-card border-border shadow-card rounded-lg">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center text-foreground">
              <Plane className="mr-2 h-5 w-5 text-primary" />
              Voos Agendados
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="border-border hover:bg-accent rounded-md"
              onClick={() => navigate("/agendamento")}
            >
              Ver todos
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {scheduledFlights.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Plane className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>Nenhum voo agendado</p>
              </div>
            ) : (
              scheduledFlights.map((flight: any) => (
                <div
                  key={flight.id}
                  className="p-4 rounded-md bg-muted/50 hover:bg-muted transition-colors cursor-pointer border border-border hover:border-primary"
                  onClick={() => navigate("/agendamento")}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Plane className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground">
                        {flight.aircraft?.registration || "Aeronave não informada"}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        flight.status === 'confirmado'
                          ? 'bg-success/20 text-success border-success'
                          : flight.status === 'pendente'
                            ? 'bg-warning/20 text-warning border-warning'
                            : 'bg-destructive/20 text-destructive border-destructive'
                      }
                    >
                      {flight.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium text-foreground">{flight.origin || "N/A"}</span>
                      {flight.destination && (
                        <>
                          <span>→</span>
                          <span className="font-medium text-foreground">{flight.destination}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{flight.client?.company_name ? `Cliente: ${flight.client.company_name}` : "Cliente não informado"}</span>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(flight.flight_date).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onSave={fetchTasks}
      />
    </main>
  );
}
