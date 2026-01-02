import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plane, AlertTriangle, ArrowRight, BarChart3, Clock, FileCheck, FileText, PieChart, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import aviationHero from "@/assets/aviation-hero.jpg";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TasksQuickAccess } from "@/components/dashboard/TasksQuickAccess";
import { useUserRole } from "@/hooks/useUserRole";

export function GestorDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isGestorMaster } = useUserRole();

  const { data: tripulantes = [] } = useQuery({
    queryKey: ["tripulantes-count"],
    queryFn: async () => {
      const { data } = await supabase.from("crew_members").select("id, status");
      return data || [];
    },
  });

  const { data: aircraft = [] } = useQuery({
    queryKey: ["aircraft-count"],
    queryFn: async () => {
      const { data } = await supabase.from("aircraft").select("id, status");
      return data || [];
    },
  });

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("flight_schedules")
        .select("*")
        .eq("status", "pendente");
      return data || [];
    },
  });


  const allQuickTools = [
    { icon: Plane, label: "Gestão de Aeronaves", route: "/aeronaves", color: "from-cyan-500 to-cyan-600" },
    { icon: Users, label: "Gestão de Funcionários", route: "/gestao-funcionarios", color: "from-blue-500 to-blue-600" },
    { icon: FileCheck, label: "Controle de Vencimentos", route: "/vencimentos", color: "from-purple-500 to-purple-600" },
    { icon: FileText, label: "Gestão Fiscal", route: "/financeiro/gestao-fiscal", color: "from-green-500 to-green-600" },
    { icon: PieChart, label: "Rateio Clientes", route: "/financeiro/rateio-consolidado", color: "from-indigo-500 to-indigo-600" },
    { icon: BarChart3, label: "Dashboard Gestor", route: "/financeiro/gestor", color: "from-orange-500 to-orange-600", restricted: true },
  ];

  const quickTools = allQuickTools.filter(tool => !tool.restricted || isAdmin || isGestorMaster);

  return (
    <main className="flex-1 p-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group w-fit"
      >
        <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm">Voltar</span>
      </button>

      {/* Hero */}
      <div className="relative mb-6 rounded-xl overflow-hidden">
        <div
          className="h-40 bg-cover bg-center bg-no-repeat relative"
          style={{ backgroundImage: `url(${aviationHero})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          <div className="relative h-full flex items-center px-6">
            <div>
              <p className="text-xs text-primary font-medium uppercase tracking-widest mb-1">
                Dashboard do Gestor
              </p>
              <h1 className="text-3xl font-bold text-foreground">Visão Gerencial</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Acompanhe equipe, frota e aprovações pendentes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tripulantes Ativos</p>
                <p className="text-2xl font-bold text-foreground">
                  {tripulantes.filter(t => t.status === 'ativo').length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aeronaves</p>
                <p className="text-2xl font-bold text-foreground">{aircraft.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-success/20">
                <Plane className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aprovações Pendentes</p>
                <p className="text-2xl font-bold text-warning">{pendingApprovals.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/20">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Manutenção</p>
                <p className="text-2xl font-bold text-destructive">
                  {aircraft.filter(a => a.status === 'manutencao').length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/20">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Tools */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Ferramentas de Gestão</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickTools.map((tool) => (
            <button
              key={tool.label}
              onClick={() => navigate(tool.route)}
              className="flex flex-col items-center justify-center gap-3 p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border hover:border-primary/50 hover:bg-card transition-all duration-200 group"
            >
              <div className={`p-3 rounded-lg bg-gradient-to-br ${tool.color} shadow-lg group-hover:scale-110 transition-transform`}>
                <tool.icon className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-medium text-foreground">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Minhas Tarefas */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Minhas Tarefas</h3>
        <TasksQuickAccess />
      </div>

      {/* Pending Approvals */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Aprovações Pendentes
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/agendamento")}>
            Ver todas <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {pendingApprovals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma aprovação pendente</p>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.slice(0, 4).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                  <div>
                    <p className="font-medium text-foreground">
                      {item.origin} → {item.destination}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(item.flight_date), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge className="bg-warning/20 text-warning border-warning">Pendente</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </main>
  );
}
