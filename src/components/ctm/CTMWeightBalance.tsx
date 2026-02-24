import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scale, Plus, FileText, AlertCircle } from "lucide-react";

interface WeightBalanceProps {
  aircraftId: string;
  aircraftRegistration: string;
}

export function CTMWeightBalance({ aircraftId, aircraftRegistration }: WeightBalanceProps) {
  // This is a placeholder for weight and balance data
  // In a real implementation, this would fetch from a database

  return (
    <Card className="bg-gradient-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Peso e Balanceamento
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Ficha técnica de CG e pesos - {aircraftRegistration}
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Ficha
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/20 rounded-lg border-2 border-dashed">
          <Scale className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="font-medium text-foreground mb-2">Peso e Balanceamento</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Configure os dados de peso e balanceamento desta aeronave para 
            cálculos automáticos de CG e limites operacionais.
          </p>
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Configurar Dados
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-500 mb-1">Em Desenvolvimento</p>
              <p className="text-muted-foreground">
                O módulo de Peso e Balanceamento está em desenvolvimento. 
                Em breve você poderá cadastrar e calcular CG e pesos máximos.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Reference Template */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-base">Peso Básico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Peso Vazio</Label>
                  <Input placeholder="kg" disabled />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Braço CG</Label>
                  <Input placeholder="m" disabled />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">PMD</Label>
                  <Input placeholder="kg" disabled />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Peso Pouso Máx</Label>
                  <Input placeholder="kg" disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-background/50">
            <CardHeader>
              <CardTitle className="text-base">Limites CG</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">CG Dianteiro</Label>
                  <Input placeholder="% MAC" disabled />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CG Traseiro</Label>
                  <Input placeholder="% MAC" disabled />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">MAC</Label>
                  <Input placeholder="m" disabled />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">LEMAC</Label>
                  <Input placeholder="m" disabled />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
