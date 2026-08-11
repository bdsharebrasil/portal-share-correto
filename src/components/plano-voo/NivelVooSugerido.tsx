// src/components/NivelVooSugerido.tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge, Loader2 } from 'lucide-react';
import { formatarFL } from '@/lib/flightLevel';

interface NivelVooSugeridoProps {
  nivelSugeridoFt: number | null;
  rumo: number | null;
  carregando: boolean;
  erro: string | null;
}

export function NivelVooSugerido({ nivelSugeridoFt, rumo, carregando, erro }: NivelVooSugeridoProps) {
  if (carregando) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Calculando nível...
      </Badge>
    );
  }

  if (erro) {
    return (
      <Badge className="bg-destructive/20 text-destructive border-destructive/50 border">
        Erro ao calcular nível
      </Badge>
    );
  }

  if (nivelSugeridoFt === null) return null;

  return (
    <Card className="bg-card border-border p-3 flex items-center gap-3">
      <Gauge className="w-5 h-5 text-primary" />
      <div>
        <p className="text-xs text-muted-foreground">Nível de voo sugerido</p>
        <p className="text-lg font-semibold text-foreground">
          {formatarFL(nivelSugeridoFt)}
          {rumo !== null && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              (rumo {Math.round(rumo)}°)
            </span>
          )}
        </p>
      </div>
    </Card>
  );
}