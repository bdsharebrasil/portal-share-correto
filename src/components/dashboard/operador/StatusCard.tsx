import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  status: 'expired' | 'urgent' | 'attention' | 'ok';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const statusConfig = {
  expired: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-900/30',
    glow: 'animate-pulse',
  },
  urgent: {
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-900/30',
    glow: '',
  },
  attention: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    text: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-900/30',
    glow: '',
  },
  ok: {
    bg: 'bg-green-50 dark:bg-green-950/20',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-900/30',
    glow: '',
  },
};

export function StatusCard({ title, value, icon: Icon, status, trend }: StatusCardProps) {
  const config = statusConfig[status];

  return (
    <Card className={cn('border transition-all', config.border, config.glow)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className={cn('text-3xl font-bold', config.text)}>{value}</p>
              {trend && (
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.isPositive ? '+' : ''}
                  {trend.value}%
                </span>
              )}
            </div>
          </div>
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', config.bg)}>
            <Icon className={cn('h-6 w-6', config.text)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
