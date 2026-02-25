import { Package, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { Component } from '@/types/maintenance';
import { cn } from '@/lib/utils';

interface ComponentLifeCardProps {
  component: Component;
}

export function ComponentLifeCard({ component }: ComponentLifeCardProps) {
  const lifePercentage = (component.currentLife / component.totalLife) * 100;
  const remainingLife = component.totalLife - component.currentLife;
  
  const getStatusColor = () => {
    if (lifePercentage >= 80) return 'text-red-600 dark:text-red-400';
    if (lifePercentage >= 60) return 'text-orange-600 dark:text-orange-400';
    if (lifePercentage >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProgressColor = () => {
    if (lifePercentage >= 80) return 'bg-red-500';
    if (lifePercentage >= 60) return 'bg-orange-500';
    if (lifePercentage >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getBadgeVariant = () => {
    if (lifePercentage >= 80) return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
    if (lifePercentage >= 60) return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200';
    if (lifePercentage >= 40) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200';
    return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold">{component.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{component.location}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Vida Útil</span>
            <span className={cn('font-bold', getStatusColor())}>
              {lifePercentage.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full transition-all duration-300', getProgressColor())}
              style={{ width: `${Math.min(lifePercentage, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{component.currentLife}h utilizadas</span>
            <span>{remainingLife}h restantes</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">P/N</p>
            <p className="text-xs font-mono font-medium break-all">{component.partNumber}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">S/N</p>
            <p className="text-xs font-mono font-medium break-all">{component.serialNumber}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">Instalado em</span>
          <span className="text-xs font-medium">{component.installedDate}</span>
        </div>

        {lifePercentage >= 80 && (
          <Badge className={cn('w-full justify-center gap-1', getBadgeVariant())}>
            <AlertTriangle className="h-3 w-3" />
            Alerta: Substituição próxima
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
