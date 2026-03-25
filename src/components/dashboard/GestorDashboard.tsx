import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plane, AlertTriangle, ArrowRight, BarChart3, Clock, FileText, PieChart, ArrowLeft, DollarSign, Settings } from "lucide-react";
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
      const { data } = await supabase
        .from("aircraft_live_status")
        .select("aircraft_id, current_status");
      return data?.map(item => ({
        id: item.aircraft_id,
        status: item.current_status
      })) || [];
    },
  });

  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      // Buscar voos pendentes
      const { data: flightData } = await supabase
        .from("flight_schedules")
        .select("*")
        .eq("status", "pendente");

      // Buscar orçamentos OAS aguardando aprovação
      const { data: budgetsData } = await (supabase as any)
        .from("oas_budgets")
        .select("*, service_order:ctm_service_orders(numero, aircraft:aircraft(registration))")
        .eq("status", "pendente_aprovacao")
        .order("submitted_at", { ascending: false });

      // Buscar orçamentos CTM (ctm_budgets) pendentes de aprovação
      const { data: ctmBudgetsData } = await (supabase as any)
        .from("ctm_budgets")
        .select("*, aircraft:aircraft_id(registration)")
        .in("status", ["submitted"])
        .order("submitted_at", { ascending: false });

      // Buscar ordens de serviço CTM pendentes de aprovação
      const { data: ctmOrdersData } = await supabase
        .from("ctm_service_orders")
        .select("*, aircraft(registration)")
        .eq("approval_status", "pending_approval")
        .order("submitted_for_approval_at", { ascending: false });

      // Combinar e formatar os dados
      const flights = (flightData || []).map(f => ({
        ...f,
        type: 'flight',
        title: `${f.origin} → ${f.destination}`,
        date: f.flight_date
      }));

      const budgets = (budgetsData || []).map((b: any) => ({
        ...b,
        type: 'budget',
        title: `Orçamento: ${b.descricao?.substring(0, 40) || ''} - OAS #${b.service_order?.numero || '?'} (${b.service_order?.aircraft?.registration || 'N/A'})`,
        date: b.submitted_at || b.created_at,
        total: b.valor_total,
      }));

      const ctmOrders = (ctmOrdersData || []).map(o => ({
        ...o,
        type: 'ctm_order',
        title: `OAS #${o.numero} - ${(o.aircraft as any)?.registration || 'N/A'}`,
        date: o.submitted_for_approval_at || o.data_entrada,
        description: o.objetivo,
        total: o.total_geral
      }));

      const ctmBudgets = (ctmBudgetsData || []).map((b: any) => ({
        ...b,
        type: 'ctm_budget',
        title: `Orçamento CTM: ${b.description?.substring(0, 40) || b.supplier_name || ''} (${b.aircraft?.registration || 'N/A'})`,
        date: b.submitted_at || b.created_at,
        total: b.total_value,
      }));

      return [...flights, ...budgets, ...ctmOrders, ...ctmBudgets];
    },
  });


  const allQuickTools = [
    { icon: FileText, label: "Gestão Fiscal", route: "/financeiro/gestao-fiscal", color: "from-green-500 to-green-600", grid: 1 },
    { icon: Users, label: "Gestão de Funcionários", route: "/gestao-funcionarios", color: "from-blue-500 to-blue-600", grid: 1 },
    { icon: Settings, label: "Configurações", route: "/financeiro/configuracoes-fiscais", textColor: "text-cyan-400", grid: 2 },
    { icon: PieChart, label: "Balanço Clientes", route: "/financeiro/balanco-cliente", textColor: "text-indigo-400", grid: 2 },
    { icon: BarChart3, label: "Master", route: "/financeiro/master", color: "from-orange-500 to-orange-600", restricted: true, grid: 3 },
    { icon: DollarSign, label: "Financeiro Sócios", route: "/financeiro/financeiro-socios", color: "from-purple-500 to-purple-600", grid: 3 },
  ];

  const quickTools = allQuickTools.filter(tool => !tool.restricted || isAdmin || isGestorMaster);

  // Organizar ferramentas por grid
  const grid1Tools = quickTools.filter(tool => tool.grid === 1);
  const grid2Tools = quickTools.filter(tool => tool.grid === 2);
  const grid3Tools = quickTools.filter(tool => tool.grid === 3);

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

      {/* Quick Tools - 3 Grids */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-6">Ferramentas de Gestão</h3>
        <div className="space-y-6">
          {/* Grid 1: Gestão Fiscal, Gestão Funcionários */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grid1Tools.map((tool) => (
              <button
                key={tool.label}
                onClick={() => navigate(tool.route)}
                className="flex flex-col items-center justify-center gap-3 p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border hover:border-primary/50 hover:bg-card transition-all duration-200 group"
              >
                <tool.icon className="h-8 w-8 text-green-400 group-hover:scale-110 transition-all duration-300" strokeWidth={1.5} />
                <span className="text-sm font-medium text-foreground text-center">{tool.label}</span>
              </button>
            ))}
          </div>

          {/* Grid 2: Controle de Aeronaves, Clientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grid2Tools.map((tool) => (
              <button
                key={tool.label}
                onClick={() => navigate(tool.route)}
                className="flex flex-col items-center justify-center gap-3 p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border hover:border-primary/50 hover:bg-card transition-all duration-200 group"
              >
                <tool.icon className={`h-8 w-8 ${tool.textColor} group-hover:scale-110 transition-all duration-300`} strokeWidth={1.5} />
                <span className="text-sm font-medium text-foreground text-center">{tool.label}</span>
              </button>
            ))}
          </div>

          {/* Grid 3: Master e Financeiro Sócios */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grid3Tools.map((tool) => (
              <button
                key={tool.label}
                onClick={() => navigate(tool.route)}
                className="flex flex-col items-center justify-center gap-3 p-6 bg-card/50 backdrop-blur-sm rounded-xl border border-border hover:border-primary/50 hover:bg-card transition-all duration-200 group"
              >
                <div className={`p-3 rounded-lg bg-gradient-to-br ${tool.color} shadow-lg group-hover:scale-110 transition-transform`}>
                  <tool.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-medium text-foreground text-center">{tool.label}</span>
              </button>
            ))}
          </div>
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
              {pendingApprovals.slice(0, 5).map((item: any) => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    if (item.type === 'ctm_order') {
                      navigate(`/manutencao/ctm?serviceOrderId=${item.id}`);
                    }
                  }}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/50 hover:bg-background/80 transition-all cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.type === 'flight'
                        ? 'Voo Agendado'
                        : item.type === 'ctm_order'
                        ? 'Ordem de Serviço CTM'
                        : 'Orçamento de Manutenção'
                      }
                    </p>
                    {item.type === 'ctm_order' && item.total && (
                      <p className="text-sm font-semibold text-primary mt-1">
                        R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge
                    className={
                      item.type === 'ctm_order'
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                        : item.type === 'budget'
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        : "bg-warning/20 text-warning border-warning"
                    }
                  >
                    {item.type === 'ctm_order' ? 'OAS' : item.type === 'budget' ? 'Orçamento' : 'Voo'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </main>
  );
}
