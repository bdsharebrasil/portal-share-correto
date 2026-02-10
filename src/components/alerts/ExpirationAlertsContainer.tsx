import { useState } from 'react';
import { ExpirationAlert, useExpirationAlerts } from '@/hooks/useExpirationAlerts';
import { ExpirationAlertDialog } from './ExpirationAlertDialog';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AlertGroup {
  expired: ExpirationAlert[];
  critical: ExpirationAlert[];
  warning: ExpirationAlert[];
  info: ExpirationAlert[];
}

export function ExpirationAlertsContainer() {
  const { user } = useAuth();
  const { visibleAlerts, isLoading, dismissAlert, snoozeAlert } = useExpirationAlerts(
    user?.id || null
  );
  const [selectedAlert, setSelectedAlert] = useState<ExpirationAlert | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Group alerts by severity
  const groupedAlerts = visibleAlerts.reduce<AlertGroup>(
    (acc, alert) => {
      acc[alert.severity].push(alert);
      return acc;
    },
    { expired: [], critical: [], warning: [], info: [] }
  );

  const severityConfig = {
    expired: {
      label: 'Vencidos',
      icon: '🔴',
      color: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15',
      textColor: 'text-red-600',
      count: groupedAlerts.expired.length,
    },
    critical: {
      label: 'Críticos',
      icon: '🟠',
      color: 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15',
      textColor: 'text-orange-600',
      count: groupedAlerts.critical.length,
    },
    warning: {
      label: 'Atenção',
      icon: '🟡',
      color: 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/15',
      textColor: 'text-yellow-600',
      count: groupedAlerts.warning.length,
    },
    info: {
      label: 'Informação',
      icon: '🔵',
      color: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15',
      textColor: 'text-blue-600',
      count: groupedAlerts.info.length,
    },
  };

  if (isLoading || visibleAlerts.length === 0) {
    return null;
  }

  // Show the most critical alert first
  const alertsToShow = [
    ...groupedAlerts.expired,
    ...groupedAlerts.critical,
    ...groupedAlerts.warning,
    ...groupedAlerts.info,
  ];

  const handleAlertClick = (alert: ExpirationAlert) => {
    setSelectedAlert(alert);
    setIsDialogOpen(true);
  };

  const handleDismissAlert = async (alertId: string) => {
    await dismissAlert(alertId);
  };

  const handleSnoozeAlert = async (alertId: string, days: number) => {
    await snoozeAlert(alertId, days);
  };

  return (
    <>
      {/* Toast-style notifications at top */}
      <div className="fixed top-20 left-0 right-0 z-40 flex flex-col gap-3 px-4 max-w-2xl mx-auto">
        {alertsToShow.map((alert) => (
          <AlertNotificationItem
            key={alert.id}
            alert={alert}
            onClick={() => handleAlertClick(alert)}
          />
        ))}
      </div>

      {/* Alert Dialog */}
      <ExpirationAlertDialog
        alert={selectedAlert}
        isOpen={isDialogOpen}
        onDismiss={handleDismissAlert}
        onSnooze={handleSnoozeAlert}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}

interface AlertNotificationItemProps {
  alert: ExpirationAlert;
  onClick: () => void;
}

function AlertNotificationItem({ alert, onClick }: AlertNotificationItemProps) {
  const severityConfig = {
    expired: {
      icon: '🔴',
      color: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15',
      textColor: 'text-red-600',
      bgColor: 'bg-gradient-to-r from-red-500/20 to-red-500/5',
    },
    critical: {
      icon: '🟠',
      color: 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/15',
      textColor: 'text-orange-600',
      bgColor: 'bg-gradient-to-r from-orange-500/20 to-orange-500/5',
    },
    warning: {
      icon: '🟡',
      color: 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/15',
      textColor: 'text-yellow-600',
      bgColor: 'bg-gradient-to-r from-yellow-500/20 to-yellow-500/5',
    },
    info: {
      icon: '🔵',
      color: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15',
      textColor: 'text-blue-600',
      bgColor: 'bg-gradient-to-r from-blue-500/20 to-blue-500/5',
    },
  };

  const config = severityConfig[alert.severity];
  const daysText =
    alert.days_until_expiry < 0
      ? `Vencido há ${Math.abs(alert.days_until_expiry)}d`
      : `Vence em ${alert.days_until_expiry}d`;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-lg border cursor-pointer transition-all duration-200 text-left',
        'hover:shadow-lg hover:scale-[1.02]',
        'backdrop-blur-sm',
        config.color
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 pt-1">
          <span className="text-xl">{config.icon}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-foreground text-sm leading-tight truncate">
                {alert.title}
              </h4>
              {alert.entity_name && (
                <p className="text-xs text-muted-foreground mt-1">
                  {alert.entity_name}
                </p>
              )}
            </div>
            <span className={cn('text-xs font-bold whitespace-nowrap', config.textColor)}>
              {daysText}
            </span>
          </div>
        </div>

        {/* Action indicator */}
        <div className="flex-shrink-0 text-muted-foreground">
          <AlertTriangle className="w-4 h-4" />
        </div>
      </div>

      {/* Tap to open indicator */}
      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Clique para agendar ou descartar
      </p>
    </button>
  );
}
