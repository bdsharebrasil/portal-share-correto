import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function CompactClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border shadow-sm fixed right-6 top-20 w-48 z-30">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground font-mono">
              {formatTime(currentTime)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
