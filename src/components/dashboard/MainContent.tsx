import { useViewMode } from "@/contexts/ViewModeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Plane, CalendarCheck, AlertCircle, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardHero } from "./operador/DashboardHero";
import { FleetStatusCards } from "./operador/FleetStatusCards";
import { OperationsTools } from "./operador/OperationsTools";
import { MessagesPanel } from "./operador/MessagesPanel";
import { FinanceiroDashboard } from "./FinanceiroDashboard";
import { GestorDashboard } from "./GestorDashboard";

import { PortalClienteDashboard } from "@/pages/PortalCliente";

function OperacoesKPIs() {
  const today = format(new Date(), "yyyy-MM-dd");

  // Voos de hoje: considera voos de múltiplos dias cuja duração cobre a data atual
  const { data: voosHoje = 0 } = useQuery({
    queryKey: ["kpi-voos-hoje", today],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("solicitacoes_reserva_voo")
        .select("data_agendada, dias_duracao, status")
        .lte("data_agendada", today)
        .in("status", ["confirmado", "aprovado", "em_voo", "em_rota"]);
      return ((data as any[]) ?? []).filter((s) => {
        const dias = Math.max(1, Number(s.dias_duracao ?? 1));
        const inicio = new Date(`${s.data_agendada}T00:00:00`);
        const fim = new Date(inicio.getTime() + (dias - 1) * 86400000);
        return today <= format(fim, "yyyy-MM-dd");
      }).length;
    },
    refetchInterval: 30000,
  });

  const { data: agendamentos = 0 } = useQuery({
    queryKey: ["kpi-agendamentos", today],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("solicitacoes_reserva_voo")
        .select("id", { count: "exact", head: true })
        .gte("data_agendada", today)
        .not("status", "in", '("rejeitado","cancelado")');
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const { data: pendencias = 0 } = useQuery({
    queryKey: ["kpi-pendencias"],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("solicitacoes_reserva_voo")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });



  const kpis = [
    { label: "Voos Hoje", value: voosHoje, icon: Plane, color: "text-primary", bg: "bg-primary/10", border: "border-primary/20" },
    { label: "Agendamentos", value: agendamentos, icon: CalendarCheck, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
    { label: "Pendências", value: pendencias, icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  ];

  return (
    <div className="flex justify-center">
      <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="border-white/[0.05] bg-white/[0.02] backdrop-blur-md transition-colors hover:bg-white/[0.04]">
            <CardContent className="flex flex-col items-center p-4 text-center">
              <div className={`mb-2 rounded-xl border p-2 ${k.bg} ${k.border}`}>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <p className="text-xs font-medium text-muted-foreground/80">{k.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function MainContent() {
  const { viewMode } = useViewMode();

  if (viewMode === 'financeiro') {
    return <FinanceiroDashboard />;
  }

 

  if (viewMode === 'portal-cliente') {
    return <PortalClienteDashboard />;
  }

  if (viewMode === 'gestor') {
    return <GestorDashboard />;
  }

  // Operações view (default)
  return (
    <main className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Hero Section */}
      <DashboardHero />

      {/* KPIs em tempo real */}
      <OperacoesKPIs />

      {/* Ferramentas centralizadas */}
      <div>
        <div className="mb-4 text-center">
        </div>
        <OperationsTools />
      </div>

      <div className="flex flex-col gap-3 md:gap-6">
        <MessagesPanel />
        <FleetStatusCards />
      </div>
    </main>
  );
}
