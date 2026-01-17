import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Clock, Wrench } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MaintenanceStatus, ALERT_STYLES, AlertLevel } from '@/lib/maintenance-alerts';
import { Progress } from '@/components/ui/progress';

interface MaintenanceAlertCardProps {
  status: MaintenanceStatus;
  aircraftRegistration?: string;
  compact?: boolean;
  onClick?: () => void;
}

const ALERT_ICONS: Record<AlertLevel, React.ComponentType<{ className?: string }>> = {
  green: CheckCircle,
  yellow: Info,
  orange: AlertTriangle,
  red: AlertCircle,
};

export function MaintenanceAlertCard({
  status,
  aircraftRegistration,
  compact = false,
  onClick,
}: MaintenanceAlertCardProps) {
  const styles = ALERT_STYLES[status.alertLevel];
  const Icon = ALERT_ICONS[status.alertLevel];

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'border rounded-lg p-3 backdrop-blur-xl cursor-pointer transition-all hover:scale-[1.02]',
          styles.bgColor,
          styles.borderColor,
          styles.textColor
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', styles.iconColor)} />
          <span className="font-semibold text-sm">{status.maintenanceType}</span>
          <span className="text-xs opacity-75 ml-auto">
            {status.isOverdue ? 'VENCIDO' : `${status.hoursRemaining.toFixed(1)}h`}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'border rounded-2xl p-4 backdrop-blur-xl overflow-hidden relative group transition-all',
        styles.bgColor,
        styles.borderColor,
        onClick && 'cursor-pointer hover:scale-[1.01]'
      )}
      onClick={onClick}
    >
      {/* Background Glow */}
      <div className={cn(
        'absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20',
        status.alertLevel === 'red' && 'bg-red-500',
        status.alertLevel === 'orange' && 'bg-orange-500',
        status.alertLevel === 'yellow' && 'bg-yellow-500',
        status.alertLevel === 'green' && 'bg-green-500'
      )} />

      <div className="relative z-10 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              'p-2 rounded-xl shrink-0',
              status.alertLevel === 'red' && 'bg-red-500/30',
              status.alertLevel === 'orange' && 'bg-orange-500/30',
              status.alertLevel === 'yellow' && 'bg-yellow-500/30',
              status.alertLevel === 'green' && 'bg-green-500/30'
            )}>
              <Icon className={cn('h-5 w-5', styles.iconColor)} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                  styles.bgColor,
                  styles.textColor
                )}>
                  {styles.labelPt}
                </span>
                <span className="text-sm font-semibold opacity-90">
                  Manutenção {status.maintenanceType}
                </span>
              </div>
              {aircraftRegistration && (
                <p className="text-xs opacity-70 mt-1">{aircraftRegistration}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={cn('text-2xl font-black', styles.textColor)}>
              {status.isOverdue ? (
                <span className="text-red-400">VENCIDO</span>
              ) : (
                <>{status.hoursRemaining.toFixed(1)}<span className="text-sm font-medium">h</span></>
              )}
            </p>
            <p className="text-xs opacity-60">restantes</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs opacity-75">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {status.currentHours.toFixed(1)}h voadas
            </span>
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Próxima: {status.nextDueHours.toFixed(1)}h
            </span>
          </div>
          <div className="relative">
            <Progress 
              value={status.percentComplete} 
              className={cn(
                'h-3',
                status.alertLevel === 'red' && '[&>div]:bg-red-500',
                status.alertLevel === 'orange' && '[&>div]:bg-orange-500',
                status.alertLevel === 'yellow' && '[&>div]:bg-yellow-500',
                status.alertLevel === 'green' && '[&>div]:bg-green-500'
              )}
            />
          </div>
          <p className="text-xs text-center opacity-60">
            {status.percentComplete.toFixed(0)}% do intervalo
          </p>
        </div>

        {/* Message */}
        <div className={cn(
          'pt-3 border-t text-sm',
          `border-current/20`
        )}>
          <p className="font-medium">{status.message}</p>
        </div>

        {/* Warning for blocking */}
        {status.shouldBlockScheduling && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>⚠️ Agendamentos de voo bloqueados até a manutenção ser realizada</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
