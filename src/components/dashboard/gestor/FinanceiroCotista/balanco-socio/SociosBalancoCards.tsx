import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, TrendingDown, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { SocioBalanco } from "@/hooks/useSocioBalanco";

interface SociosBalancoCardsProps {
  sociosBalanco: SocioBalanco[];
  socioSelecionadoId?: string;
  onSelectSocio?: (socioId: string) => void;
}

export function SociosBalancoCards({
  sociosBalanco,
  socioSelecionadoId,
  onSelectSocio,
}: SociosBalancoCardsProps) {
  if (sociosBalanco.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Distribuição por Sócio</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sociosBalanco.map((socio) => {
          const isSelected = socio.id === socioSelecionadoId;
          const temPendencias = socio.saldoDevedor > 0;

          return (
            <Card
              key={socio.id}
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border/50 bg-card/60 hover:border-primary/30"
              }`}
              onClick={() => onSelectSocio?.(socio.id)}
            >
              <CardContent className="pt-4">
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-full bg-primary/10">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{socio.nome}</p>
                      {socio.cpf && (
                        <p className="text-xs text-muted-foreground font-mono">
                          CPF: {socio.cpf}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={isSelected ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {socio.percentual.toFixed(1)}%
                  </Badge>
                </div>

                {/* Métricas do Sócio */}
                <div className="space-y-3">
                  {/* Valor Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Valor Total</span>
                    <span className="font-semibold">
                      R${" "}
                      {socio.valorTotal.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* Despesas Pagas */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-muted-foreground">Pago</span>
                    </div>
                    <span className="text-sm text-green-600">
                      R${" "}
                      {socio.despesasPagas.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* Aguardando Reembolso */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-yellow-500" />
                      <span className="text-xs text-muted-foreground">
                        Aguardando
                      </span>
                    </div>
                    <span className="text-sm text-yellow-600">
                      R${" "}
                      {socio.aguardandoReembolso.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* Saldo Devedor */}
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {temPendencias ? (
                          <TrendingDown className="h-3 w-3 text-destructive" />
                        ) : (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        )}
                        <span className="text-xs font-medium">Saldo Devedor</span>
                      </div>
                      <span
                        className={`font-bold ${
                          temPendencias ? "text-destructive" : "text-green-600"
                        }`}
                      >
                        R${" "}
                        {socio.saldoDevedor.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
