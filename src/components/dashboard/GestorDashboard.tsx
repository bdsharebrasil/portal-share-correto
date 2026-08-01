// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Plane, AlertTriangle, ArrowRight, BarChart3,
  Clock, FileText, ArrowLeft, DollarSign, Settings
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import aviationHero from "@/assets/aviation-hero.jpg";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

export function GestorDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isGestorMaster } = useUserRole();

  const { data: tripulantes = [] } = useQuery({
    queryKey: ["tripulantes-count"],
    queryFn: async () => {
      const { data } = await supabase.from("membros_tripulacao").select("id, status");
      return data || [];
    },
  });

  const { data: aircraft = [] } = useQuery({
    queryKey: ["aircraft-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from('status_tempo_real_aeronave')
        .select("aeronave_id, status_atual");
      return data?.map(item => ({
        id: item.aeronave_id,
        status: item.status_atual
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
        .eq("status", "Pendente");

      // Buscar orçamentos OAS aguardando aprovação
      const { data: budgetsData } = await (supabase as any)
        .from("ctm_orcamentos")
        .select('*, aircraft:aeronave(matricula)')
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false });

      // Buscar solicitações de compra enviadas para aprovação
      const { data: purchaseData } = await (supabase as any)
        .from("purchase_requests")
        .select("*")
        .in("status", ["enviado", "em_analise"])
        .order("data_solicitacao", { ascending: false });

      const flights = (flightData || []).map(f => ({
        ...f,
        type: 'flight',
        title: `${f.origin} → ${f.destination}`,
        date: f.flight_date
      }));

      const budgets = (budgetsData || []).map((b: any) => ({
        ...b,
        type: 'budget',
        title: `Orçamento: ${b.descricao?.substring(0, 40) || ''} (${b.aircraft?.matricula || 'N/A'})`,
        date: b.submitted_at || b.criado_em,
        total: b.valor_total,
      }));

      const purchases = (purchaseData || []).map((p: any) => ({
        ...p,
        type: 'purchase',
        title: `${p.numero_solicitacao} — ${p.descricao?.substring(0, 50) || ''}`,
        date: p.data_solicitacao,
        total: p.valor_total,
      }));

      return [...flights, ...budgets, ...purchases];
    },
  });


  const allQuickTools = [
    {
      icon: DollarSign,
      label: "Simulador de Custos",
      route: "/gestor/simulador-custos",
      iconColor: "text-orange-400",
      iconBg: "bg-orange-500/10",
      hoverGlow: "hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      grid: 1
    },
    {
      icon: FileText,
      label: "Financeiro Share Brasil",
      route: "/gestor/financeiro-share",
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
      hoverGlow: "hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
      grid: 1
    },
    {
      icon: Users,
      label: "Gestão de Funcionários",
      route: "/gestor/funcionarios",
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
      hoverGlow: "hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]",
      grid: 1
    },
    {
      icon: DollarSign,
      label: "Financeiro Cotistas",
      route: "/gestor/financeiro-cotistas",
      iconColor: "text-green-500",
      iconBg: "bg-green-500/10",
      hoverGlow: "hover:border-green-500/50 hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]",
      grid: 2
    },
    {
      icon: BarChart3,
      label: "Master",
      route: "/gestor/master",
      iconColor: "text-orange-400",
      iconBg: "bg-orange-500/10",
      hoverGlow: "hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      restricted: true,
      grid: 3
    },
  ];

  const quickTools = allQuickTools.filter(tool => !tool.restricted || isAdmin || isGestorMaster);

  return (
    <>
      <main className="flex-1 p-3 md:p-4 lg:p-6 space-y-4 md:space-y-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group w-fit"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs md:text-sm font-medium">Voltar</span>
        </button>

        {/* Hero */}
        <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-white/[0.06] shadow-2xl h-32 md:h-40 lg:h-48">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60 mix-blend-overlay"
            style={{ backgroundImage: `url(${aviationHero})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/45 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 lg:p-8">
            <div className="relative z-10 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="p-1.5 md:p-2 rounded-md bg-primary/10 border border-primary/20">
                  <Plane className="h-3 md:h-4 w-3 md:w-4 text-primary" />
                </div>
                <span className="text-xs md:text-sm font-semibold text-primary uppercase tracking-wider drop-shadow-md">
                  Dashboard do Gestor
                </span>
              </div>
              <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                Visão Gerencial
              </h1>
             
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] hover:bg-white/[0.04] transition-colors">
            <CardContent className="pt-3 md:pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground/80">Tripulantes Ativos</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground mt-1">
                    {tripulantes.filter((t: any) => t.status === 'ativo').length}
                  </p>
                </div>
                <div className="p-2 md:p-3.5 rounded-lg md:rounded-xl bg-primary/10 border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)] flex-shrink-0">
                  <Users className="h-5 md:h-6 w-5 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] hover:bg-white/[0.04] transition-colors">
            <CardContent className="pt-3 md:pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground/80">Aeronaves</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground mt-1">{aircraft.length}</p>
                </div>
                <div className="p-2 md:p-3.5 rounded-lg md:rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] flex-shrink-0">
                  <Plane className="h-5 md:h-6 w-5 md:w-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] hover:bg-white/[0.04] transition-colors">
            <CardContent className="pt-3 md:pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground/80">Aprovações</p>
                  <p className="text-2xl md:text-3xl font-bold text-amber-400 mt-1">{pendingApprovals.length}</p>
                </div>
                <div className="p-2 md:p-3.5 rounded-lg md:rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)] flex-shrink-0">
                  <Clock className="h-5 md:h-6 w-5 md:w-6 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] hover:bg-white/[0.04] transition-colors">
            <CardContent className="pt-3 md:pt-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground/80">Em Manutenção</p>
                  <p className="text-2xl md:text-3xl font-bold text-red-400 mt-1">
                    {aircraft.filter((a: any) => a.status === 'manutencao').length}
                  </p>
                </div>
                <div className="p-2 md:p-3.5 rounded-lg md:rounded-xl bg-red-500/10 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)] flex-shrink-0">
                  <AlertTriangle className="h-5 md:h-6 w-5 md:w-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Tools */}
        <div>
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-3 md:mb-4 flex items-center gap-2">
            Ferramentas de Gestão
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {quickTools.map((tool) => (
              <button
                key={tool.label}
                onClick={() => navigate(tool.route)}
                className={`flex items-center gap-3 md:gap-4 p-4 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-md rounded-3xl border border-white/[0.05] transition-all duration-300 group ${tool.hoverGlow}`}
              >
                <div className={`p-3 rounded-3xl transition-transform duration-300 group-hover:scale-110 border border-white/[0.05] ${tool.iconBg} flex-shrink-0`}>
                  <tool.icon className={`h-6 md:h-7 w-6 md:w-7 ${tool.iconColor}`} strokeWidth={1.5} />
                </div>

                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-sm md:text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {tool.label}
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                    Acessar módulo
                  </span>
                </div>

                <ArrowRight className="h-4 md:h-5 w-4 md:w-5 ml-auto text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05]">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 md:pb-4 gap-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <div className="p-1.5 md:p-2 bg-amber-500/10 rounded-lg">
                <Clock className="h-3.5 md:h-4 w-3.5 md:w-4 text-amber-400" />
              </div>
              Aprovações Pendentes
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/gestor/aprovacoes-orcamentos")} className="hover:bg-white/[0.05] text-xs md:text-sm">
              Ver todas <ArrowRight className="ml-1 md:ml-2 h-3 md:h-4 w-3 md:w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Clock className="h-10 w-10 mb-3 opacity-20" />
                <p>Nenhuma aprovação pendente no momento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.slice(0, 5).map((item: any) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => {
                      if (item.type === 'budget') {
                        navigate(`/manutencao/orcamentos?budgetId=${item.id}`);
                      } else if (item.type === 'purchase') {
                        navigate(`/financeiro/compras?requestId=${item.id}`);
                      }
                    }}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-primary/50 hover:bg-white/[0.04] transition-all cursor-pointer group"
                  >
                    <div>
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <p className="text-xs text-muted-foreground">
                        {item.type === 'flight'
                          ? 'Voo Agendado'
                          : item.type === 'budget'
                            ? 'Orçamento de Manutenção'
                            : 'Solicitação de Compra/serviço'
                        }
                      </p>
                        <span className="text-muted-foreground/30 text-xs">•</span>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {item.total && (
                        <p className="text-sm font-semibold text-emerald-400 mt-2">
                          R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <Badge
                      className={`ml-4 shrink-0 ${item.type === 'budget'
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                          : item.type === 'purchase'
                            ? "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20"
                            : "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20"
                        }`}
                    >
                      {item.type === 'budget' ? 'Orçamento' : item.type === 'purchase' ? 'Compra/Serviço' : 'Voo'}
                    </Badge>

                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
