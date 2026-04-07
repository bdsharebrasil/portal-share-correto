import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface ModernNotificationProps {
  type: NotificationType;
  title: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
  dismissible?: boolean;
}

const notificationStyles: Record<NotificationType, { gradient: string; icon: React.ReactNode; color: string }> = {
  success: {
    gradient: 'from-green-500 to-emerald-600',
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-white'
  },
  error: {
    gradient: 'from-red-500 to-rose-600',
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-white'
  },
  warning: {
    gradient: 'from-yellow-500 to-orange-600',
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-white'
  },
  info: {
    gradient: 'from-blue-500 to-indigo-600',
    icon: <Info className="w-5 h-5" />,
    color: 'text-white'
  }
};

export const ModernNotification: React.FC<ModernNotificationProps> = ({
  type,
  title,
  description,
  duration = 4000,
  onClose,
  dismissible = true
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const style = notificationStyles[type];

  if (!isVisible || !style) return null;

  return (
    <div className="animate-in slide-in-from-top fade-in duration-300">
      <div className={`flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r ${style.gradient} ${style.color} shadow-lg backdrop-blur-sm border border-white/20`}>
        <div className="flex-shrink-0">
          {style.icon}
        </div>
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          {description && (
            <p className="text-sm opacity-90">{description}</p>
          )}
        </div>
        {dismissible && (
          <button
            onClick={() => {
              setIsVisible(false);
              onClose?.();
            }}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ModernNotification;
