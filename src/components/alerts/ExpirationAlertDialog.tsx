import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExpirationAlert } from '@/hooks/useExpirationAlerts';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpirationAlertDialogProps {
  alert: ExpirationAlert | null;
  isOpen: boolean;
  onDismiss: (alertId: string) => Promise<void>;
  onSnooze: (alertId: string, days: number) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

const severityConfig = {
  expired: {
    label: 'VENCIDO',
    color: 'bg-red-500/10 border-red-500/50',
    textColor: 'text-red-600',
    icon: '🔴',
  },
  critical: {
    label: 'CRÍTICO',
    color: 'bg-orange-500/10 border-orange-500/50',
    textColor: 'text-orange-600',
    icon: '🟠',
  },
  warning: {
    label: 'ATENÇÃO',
    color: 'bg-yellow-500/10 border-yellow-500/50',
    textColor: 'text-yellow-600',
    icon: '🟡',
  },
  info: {
    label: 'INFORMAÇÃO',
    color: 'bg-blue-500/10 border-blue-500/50',
    textColor: 'text-blue-600',
    icon: '🔵',
  },
};

const snoozeOptions = [
  { label: '1 dia', value: 1 },
  { label: '3 dias', value: 3 },
  { label: '7 dias', value: 7 },
  { label: '14 dias', value: 14 },
  { label: '30 dias', value: 30 },
];

export function ExpirationAlertDialog({
  alert,
  isOpen,
  onDismiss,
  onSnooze,
  onOpenChange,
}: ExpirationAlertDialogProps) {
  const [snoozeValue, setSnoozeValue] = useState<string>('7');
  const [isLoading, setIsLoading] = useState(false);

  if (!alert) return null;

  const config = severityConfig[alert.severity];
  const daysText =
    alert.days_until_expiry < 0
      ? `VENCIDO HÁ ${Math.abs(alert.days_until_expiry)} DIAS`
      : `VENCE EM ${alert.days_until_expiry} DIAS`;

  const handleDismiss = async () => {
    setIsLoading(true);
    try {
      await onDismiss(alert.id);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSnooze = async () => {
    setIsLoading(true);
    try {
      await onSnooze(alert.id, parseInt(snoozeValue));
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-white/10">
        {/* Header com severity */}
        <div className={cn('p-4 rounded-lg border', config.color)}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{config.icon}</span>
            <span className={cn('font-bold text-sm', config.textColor)}>
              {config.label}
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">{alert.title}</h2>
          <p className={cn('text-sm mt-2', config.textColor, 'font-semibold')}>
            {daysText}
          </p>
        </div>

        {/* Content */}
        <AlertDialogHeader className="space-y-3">
          {alert.description && (
            <AlertDialogDescription className="text-base text-foreground/80">
              {alert.description}
            </AlertDialogDescription>
          )}

          {alert.entity_name && (
            <div className="bg-muted/50 p-3 rounded-lg border border-white/5">
              <p className="text-sm text-muted-foreground">Entidade</p>
              <p className="font-semibold text-foreground">{alert.entity_name}</p>
            </div>
          )}

          <div className="bg-muted/50 p-3 rounded-lg border border-white/5">
            <p className="text-sm text-muted-foreground">Data de Vencimento</p>
            <p className="font-semibold text-foreground">
              {new Date(alert.expiry_date).toLocaleDateString('pt-BR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </AlertDialogHeader>

        {/* Snooze Options */}
        <div className="space-y-3 mt-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Agendar novamente para:
            </label>
            <Select value={snoozeValue} onValueChange={setSnoozeValue}>
              <SelectTrigger className="w-full border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {snoozeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <Button
            variant="outline"
            onClick={handleDismiss}
            disabled={isLoading}
            className="flex-1 border-white/10"
          >
            <X className="w-4 h-4 mr-2" />
            Descartar
          </Button>
          <Button
            onClick={handleSnooze}
            disabled={isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Clock className="w-4 h-4 mr-2" />
            Agendar
          </Button>
        </div>

        {/* Info text */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Você pode gerenciar esses alertas individualmente. Ninguém mais verá suas escolhas.
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}
