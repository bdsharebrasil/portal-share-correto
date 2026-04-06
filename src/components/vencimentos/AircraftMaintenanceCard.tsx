import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plane,
  Calendar,
  AlertCircle,
  CheckCheck,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface Vencimento {
  id: string;
  item: string;
  dataVencimento: string;
  diasRestantes: number;
  diasAlerta: number;
  status: string;
  periodoTipo?: string;
  periodoValor?: any;
}

interface AeronaveManutencaoCardProps {
  aeronave: string;
  aeronaveId: string;
  vencimentos: Vencimento[];
  onStatusChange: (id: string, newStatus: string) => void;
  getStatusInfo: (
    diasRestantes: number,
    diasAlerta: number,
    status: string
  ) => {
    label: string;
    color: string;
    icon: any;
    severity: string;
    colorClass: string;
  };
}

export function AircraftMaintenanceCard({
  aeronave,
  vencimentos,
  onStatusChange,
  getStatusInfo,
}: AeronaveManutencaoCardProps) {
  return (
    <Card className="bg-gradient-card border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="bg-gradient-to-r from-blue-500/15 via-primary/15 to-blue-500/5 px-6 py-5 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500/30 to-blue-600/30 rounded-xl">
            <Plane className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              {aeronave}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {vencimentos.length} vencimento{vencimentos.length !== 1 ? "s" : ""} registrado
              {vencimentos.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            {(() => {
              const vencidos = vencimentos.filter((v) => v.diasRestantes < 0).length;
              const proximos = vencimentos.filter(
                (v) => v.diasRestantes > 0 && v.diasRestantes <= 30
              ).length;
              const dentro = vencimentos.filter((v) => v.diasRestantes > 60).length;

              return (
                <>
                  {vencidos > 0 && (
                    <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {vencidos} vencido{vencidos !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {proximos > 0 && (
                    <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {proximos} próximo{proximos !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {dentro > 0 && (
                    <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                      <CheckCheck className="h-3 w-3 mr-1" />
                      {dentro} OK
                    </Badge>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <CardContent className="pt-6 space-y-3">
        {vencimentos
          .sort(
            (a, b) =>
              new Date(a.dataVencimento).getTime() -
              new Date(b.dataVencimento).getTime()
          )
          .map((vencimento) => {
            const statusInfo = getStatusInfo(
              vencimento.diasRestantes,
              vencimento.diasAlerta,
              vencimento.status
            );
            const StatusIcon = statusInfo.icon;

            let urgencyClass = "border-l-4";
            if (vencimento.diasRestantes < 0) {
              urgencyClass = "border-l-4 border-l-red-500";
            } else if (vencimento.diasRestantes <= 30) {
              urgencyClass = "border-l-4 border-l-yellow-500";
            } else if (vencimento.diasRestantes > 60) {
              urgencyClass = "border-l-4 border-l-green-500";
            }

            return (
              <div
                key={vencimento.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${statusInfo.color} hover:shadow-md transition-all duration-200 ${urgencyClass}`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className={`flex-shrink-0 p-2.5 rounded-lg ${statusInfo.colorClass} bg-current opacity-15`}
                  >
                    <StatusIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground truncate">
                      {vencimento.item}
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        {new Date(vencimento.dataVencimento).toLocaleDateString(
                          "pt-BR",
                          {
                            weekday: "short",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold whitespace-nowrap ${statusInfo.colorClass}`}
                    >
                      {vencimento.diasRestantes < 0
                        ? "Vencido"
                        : `${vencimento.diasRestantes}d`}
                    </div>
                    {vencimento.diasRestantes >= 0 && (
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        restantes
                      </p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-1"
                      >
                        <Badge
                          className={`${statusInfo.color} cursor-pointer`}
                        >
                          {statusInfo.label}
                        </Badge>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => onStatusChange(vencimento.id, "pendente")}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Marcar como Pendente
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onStatusChange(vencimento.id, "programado")}
                      >
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Marcar como Programado
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onStatusChange(vencimento.id, "concluido")}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Concluído
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}
