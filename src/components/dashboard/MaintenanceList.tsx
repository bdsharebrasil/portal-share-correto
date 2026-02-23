import { Calendar, Clock, AlertCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MaintenanceItem } from '@/types/maintenance';
import { cn } from '@/lib/utils';

interface MaintenanceListProps {
  items: MaintenanceItem[];
  onViewDetails?: (item: MaintenanceItem) => void;
}

const statusConfig = {
  expired: { label: 'Vencida', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  urgent: { label: 'Urgente', className: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' },
  attention: { label: 'Atenção', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200' },
  ok: { label: 'OK', className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' },
};

function getDaysUntil(date: string): number {
  const diff = new Date(date).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function MaintenanceList({ items, onViewDetails }: MaintenanceListProps) {
  const sortedItems = [...items].sort((a, b) => {
    const statusOrder = { expired: 0, urgent: 1, attention: 2, ok: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Inspeções Próximas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
          {sortedItems.map((item) => {
            const daysUntil = getDaysUntil(item.nextDue);
            const config = statusConfig[item.status];

            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-lg border p-4 transition-all duration-200 hover:shadow-md',
                  item.status === 'expired' && 'border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-950/10'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{item.description}</h4>
                      <Badge className={cn('text-xs', config.className)}>{config.label}</Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Intervalo: {item.interval}</span>
                      </div>
                      {item.dueHours && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{item.dueHours}h</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Próximo:</span>
                      <span className="font-mono font-medium">{item.nextDue}</span>
                      {daysUntil <= 30 && (
                        <Badge variant="outline" className="text-xs">
                          {daysUntil > 0 ? `${daysUntil} dias` : 'Vencido'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'expired' && (
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    {onViewDetails && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onViewDetails(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
