import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  FileText,
  Fuel,
  MapPin,
  Plane,
  Users,
  Wrench,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeClockWidget } from "@/components/time-tracking/TimeClockWidget";
import { useUserRole } from "@/hooks/useUserRole";

interface FlightOperation {
  label: string;
  icon: typeof Clock;
  color: "primary" | "secondary" | "accent";
  path?: string;
}

type MaintenanceStatus = "urgent" | "normal" | "completed";

interface MaintenanceItem {
  label: string;
  icon: typeof Clock;
  status: MaintenanceStatus;
  path: string;
}

interface RightSidebarProps {
  isOpen: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ isOpen }) => {
  const navigate = useNavigate();
  const { hasAnyRole } = useUserRole();
  const [currentTime, setCurrentTime] = useState(new Date());

  const showTimeClock = hasAnyRole(['admin', 'financeiro', 'financeiro_master', 'adm', 'operacoes']);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const flightOperations: FlightOperation[] = [
    {
      label: "Agendamentos de Voo",
      icon: Calendar,
      color: "primary",
      path: "/agendamento",
    },
    {
      label: "Plano de Voo",
      icon: MapPin,
      color: "secondary",
      path: "/plano-voo",
    },
    {
      label: "Diário de Bordo",
      icon: Plane,
      color: "accent",
      path: "/diario-bordo",
    },
    {
      label: "Gerenciar Aeronaves",
      icon: Plane,
      color: "secondary",
      path: "/aeronaves",
    },
    {
      label: "Controle de Abastecimento",
      icon: Fuel,
      color: "primary",
      path: "/abastecimento",
    },
    {
      label: "Gestão de Tripulação",
      icon: Users,
      color: "secondary",
      path: "/tripulacao",
    },
    {
      label: "Documentos",
      icon: FileText,
      color: "accent",
      path: "/documentos",
    },
    {
      label: "Senhas",
      icon: Key,
      color: "primary",
      path: "/senhas",
    },
  ];

  const aircraftOperations: FlightOperation[] = [
    {
      label: "Aeronaves",
      icon: Plane,
      color: "primary",
      path: "/aeronaves",
    },
  ];

  const maintenanceItems: MaintenanceItem[] = [
    {
      label: "Controle de Vencimentos",
      icon: Clock,
      status: "urgent",
      path: "/manutencao/vencimentos",
    },
    {
      label: "Programação Manutenção",
      icon: Calendar,
      status: "normal",
      path: "/manutencao/programacao",
    },
    {
      label: "Relatórios Técnicos",
      icon: FileText,
      status: "completed",
      path: "/manutencao/relatorios",
    },
    {
      label: "Gestão de CTM",
      icon: Wrench,
      status: "normal",
      path: "/manutencao/ctm",
    },
  ];

  return (
    <aside
      className={cn(
        "fixed right-0 top-16 h-[calc(100vh-4rem)] aviation-gradient-card border-l border-border transition-all duration-300 custom-scrollbar overflow-y-auto z-40",
        isOpen ? "w-80" : "w-0"
      )}
    >
      {isOpen && (
        <div className="p-4 space-y-6">
          {/* Horário do Sistema */}
          <Card className="bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700 shadow-lg rounded-lg">
            <CardContent className="py-6 px-4">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-400" />
                  <div className="text-3xl font-bold text-white tabular-nums">
                    {formatTime(currentTime)}
                  </div>
                </div>
                <div className="text-sm text-slate-300 capitalize">{formatDate(currentTime)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Controle de Ponto */}
          {showTimeClock && <TimeClockWidget />}

          {/* Operações de Voo */}
          <Card className="bg-gradient-card border-border shadow-card static-card rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground flex items-center">
                <Plane className="mr-2 h-4 w-4 text-primary animate-plane-right" />
                Operações de Voo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {flightOperations.map((operation) => (
                <Button
                  key={operation.label}
                  variant="outline"
                  className="w-full justify-start border-border hover:bg-accent hover:border-primary transition-smooth rounded-md"
                  onClick={() => operation.path && navigate(operation.path)}
                >
                  <operation.icon className="mr-3 h-4 w-4 text-primary" />
                  <span className="text-sm">{operation.label}</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Gerenciar Aeronaves */}
          <Card className="bg-gradient-card border-border shadow-card static-card rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground flex items-center">
                <Plane className="mr-2 h-4 w-4 text-primary" />
                Gerenciar Aeronaves
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {aircraftOperations.map((operation) => (
                <Button
                  key={operation.label}
                  variant="outline"
                  className="w-full justify-start border-border hover:bg-accent hover:border-primary transition-smooth rounded-md"
                  onClick={() => operation.path && navigate(operation.path)}
                >
                  <operation.icon className="mr-3 h-4 w-4 text-primary" />
                  <span className="text-sm">{operation.label}</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Manutenção */}
          <Card className="bg-gradient-card border-border shadow-card static-card rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground flex items-center">
                <Wrench className="mr-2 h-4 w-4 text-primary" />
                Manutenção
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {maintenanceItems.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  className="w-full justify-start border-border hover:bg-accent hover:border-primary transition-smooth rounded-md"
                  onClick={() => navigate(item.path)}
                >
                  <div className="flex items-center w-full">
                    <item.icon className="mr-3 h-4 w-4 text-primary" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </aside>
  );
};
