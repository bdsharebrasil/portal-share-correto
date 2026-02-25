import { useState } from 'react';
import { AnniversaryAlert, useAnniversaryAlerts } from '@/hooks/useAnniversaryAlerts';
import { AnniversaryAlertDialog } from './AnniversaryAlertDialog';
import { useAuth } from '@/contexts/AuthContext';
import { Gift, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AnniversaryAlertsContainer() {
  const { user } = useAuth();
  const { visibleAlerts, isLoading, dismissAlert, acknowledgeAlert } = useAnniversaryAlerts(
    user?.id || null
  );
  const [selectedAlert, setSelectedAlert] = useState<AnniversaryAlert | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading || visibleAlerts.length === 0) {
    return null;
  }

  // Separate today's birthdays and upcoming
  const todaysBirthdays = visibleAlerts.filter((a) => a.is_today);
  const upcomingBirthdays = visibleAlerts.filter((a) => !a.is_today);

  // Sort by days until birthday
  const sorted = [...todaysBirthdays, ...upcomingBirthdays.sort((a, b) => a.days_until_birthday - b.days_until_birthday)];

  const handleAlertClick = (alert: AnniversaryAlert) => {
    setSelectedAlert(alert);
    setIsDialogOpen(true);
  };

  const handleDismissAlert = async (alertId: string) => {
    await dismissAlert(alertId);
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    await acknowledgeAlert(alertId);
  };

  return (
    <>
      {/* Toast-style notifications at top */}
      <div className="fixed top-20 left-0 right-0 z-40 flex flex-col gap-3 px-4 max-w-2xl mx-auto">
        {/* Today's birthdays first */}
        {todaysBirthdays.map((alert) => (
          <AnniversaryNotificationItem
            key={alert.id}
            alert={alert}
            onClick={() => handleAlertClick(alert)}
            isPriority={true}
          />
        ))}

        {/* Upcoming birthdays */}
        {upcomingBirthdays.map((alert) => (
          <AnniversaryNotificationItem
            key={alert.id}
            alert={alert}
            onClick={() => handleAlertClick(alert)}
            isPriority={false}
          />
        ))}
      </div>

      {/* Alert Dialog */}
      <AnniversaryAlertDialog
        alert={selectedAlert}
        isOpen={isDialogOpen}
        onDismiss={handleDismissAlert}
        onAcknowledge={handleAcknowledgeAlert}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}

interface AnniversaryNotificationItemProps {
  alert: AnniversaryAlert;
  onClick: () => void;
  isPriority: boolean;
}

function AnniversaryNotificationItem({
  alert,
  onClick,
  isPriority,
}: AnniversaryNotificationItemProps) {
  const config = alert.is_today
    ? {
        icon: '🎂',
        color: 'bg-pink-500/10 border-pink-500/30 hover:bg-pink-500/15',
        textColor: 'text-pink-600',
        bgColor: 'bg-gradient-to-r from-pink-500/20 to-pink-500/5',
      }
    : {
        icon: '🎈',
        color: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15',
        textColor: 'text-blue-600',
        bgColor: 'bg-gradient-to-r from-blue-500/20 to-blue-500/5',
      };

  const daysText = alert.is_today
    ? 'HOJE!'
    : `${alert.days_until_birthday}d`;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-lg border cursor-pointer transition-all duration-200 text-left',
        'hover:shadow-lg hover:scale-[1.02]',
        'backdrop-blur-sm',
        isPriority && 'ring-2 ring-pink-500/50',
        config.color
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 pt-1 text-2xl">
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-foreground text-sm leading-tight truncate">
                {alert.is_today ? '🎉 ' : '🎁 '} {alert.person_name}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {alert.person_type === 'crew_member' && 'Tripulante'}
                {alert.person_type === 'employee' && 'Funcionário'}
                {alert.person_type === 'contact' && 'Contato'}
                {alert.person_type === 'client' && 'Cliente'}
              </p>
            </div>
            <span className={cn('text-xs font-bold whitespace-nowrap', config.textColor)}>
              {daysText}
            </span>
          </div>
        </div>

        {/* Action indicator */}
        <div className="flex-shrink-0 text-muted-foreground">
          <Gift className="w-4 h-4" />
        </div>
      </div>

      {/* Tap to open indicator */}
      <p className="text-xs text-muted-foreground mt-2">
        Clique para parabenizar
      </p>
    </button>
  );
}
