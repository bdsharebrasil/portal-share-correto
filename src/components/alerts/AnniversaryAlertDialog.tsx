import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AnniversaryAlert } from '@/hooks/useAnniversaryAlerts';
import { Gift, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnniversaryAlertDialogProps {
  alert: AnniversaryAlert | null;
  isOpen: boolean;
  onDismiss: (alertId: string) => Promise<void>;
  onAcknowledge: (alertId: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}

const daysConfig = {
  today: {
    label: '🎂 HOJE!',
    color: 'bg-pink-500/10 border-pink-500/50',
    textColor: 'text-pink-600',
    icon: '🎉',
  },
  upcoming: {
    label: '🎁 PRÓXIMO',
    color: 'bg-blue-500/10 border-blue-500/50',
    textColor: 'text-blue-600',
    icon: '🎈',
  },
};

export function AnniversaryAlertDialog({
  alert,
  isOpen,
  onDismiss,
  onAcknowledge,
  onOpenChange,
}: AnniversaryAlertDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!alert) return null;

  const config = alert.is_today ? daysConfig.today : daysConfig.upcoming;
  const daysText = alert.is_today
    ? 'HOJE! 🎂'
    : `FALTAM ${alert.days_until_birthday} DIAS`;

  // Calcular idade
  const today = new Date();
  const birthDate = new Date(alert.birth_date);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDayToday = today.getMonth() * 100 + today.getDate();
  const monthDayBirth = birthDate.getMonth() * 100 + birthDate.getDate();
  if (monthDayToday < monthDayBirth) {
    age--;
  }

  // Formatar data
  const formattedDate = new Date(alert.birth_date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleDismiss = async () => {
    setIsLoading(true);
    try {
      await onDismiss(alert.id);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    setIsLoading(true);
    try {
      await onAcknowledge(alert.id);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-white/10">
        {/* Header com status */}
        <div className={cn('p-4 rounded-lg border', config.color)}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{config.icon}</span>
            <span className={cn('font-bold text-sm', config.textColor)}>
              {config.label}
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground">{alert.person_name}</h2>
          <p className={cn('text-sm mt-2', config.textColor, 'font-semibold')}>
            {daysText}
          </p>
        </div>

        {/* Content */}
        <AlertDialogHeader className="space-y-3">
          <AlertDialogDescription className="text-base text-foreground/80">
            🎉 Deseje um feliz aniversário para {alert.person_name}!
          </AlertDialogDescription>

          <div className="bg-muted/50 p-3 rounded-lg border border-white/5 space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">Data de Nascimento</p>
              <p className="font-semibold text-foreground">{formattedDate}</p>
            </div>
            <div className="border-t border-white/10 pt-2">
              <p className="text-sm text-muted-foreground">Idade a Completar</p>
              <p className="font-semibold text-foreground text-lg">{age} anos</p>
            </div>
          </div>

          {alert.is_today && (
            <div className="bg-pink-500/10 border border-pink-500/30 p-3 rounded-lg">
              <p className="text-sm text-pink-600 font-semibold">
                ✨ Dia especial! Não esqueça de parabenizá-lo(a) hoje.
              </p>
            </div>
          )}

          {alert.days_until_birthday > 0 && !alert.is_today && (
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-lg">
              <p className="text-sm text-blue-600 font-semibold">
                ℹ️ Você pode já preparar uma mensagem para {alert.person_name}.
              </p>
            </div>
          )}
        </AlertDialogHeader>

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
            onClick={handleAcknowledge}
            disabled={isLoading}
            className="flex-1 bg-pink-600 hover:bg-pink-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Marcar como Visto
          </Button>
        </div>

        {/* Info text */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Cada usuário gerencia seus próprios lembretes de aniversário.
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
}
