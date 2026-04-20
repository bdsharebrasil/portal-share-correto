// components/MetricsPanel.tsx
import { Card, CardContent } from '@/components/ui/card';
import { Plane, Clock, MapPin, Fuel, ArrowDown } from 'lucide-react';
import { LogbookMonth, FlightEntry } from '../types';
import { useMetrics } from '../hooks/useMetrics';

interface MetricsPanelProps {
  logbookMonth: LogbookMonth | null;
  entries: FlightEntry[];
  isLoading: boolean;
}

export function MetricsPanel({ logbookMonth, entries, isLoading }: MetricsPanelProps) {
  const metrics = useMetrics(entries);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const metricCards = [
    {
      icon: Plane,
      label: 'Total de Voos',
      value: metrics.totalFlights,
      color: 'text-blue-500',
    },
    {
      icon: Clock,
      label: 'Horas Totais',
      value: metrics.totalHours.toFixed(1),
      color: 'text-green-500',
    },
    {
      icon: MapPin,
      label: 'Distância (NM)',
      value: metrics.totalDistance.toFixed(0),
      color: 'text-purple-500',
    },
    {
      icon: Fuel,
      label: 'Combustível (L)',
      value: metrics.totalFuel.toFixed(0),
      color: 'text-orange-500',
    },
    {
      icon: ArrowDown,
      label: 'Pousos',
      value: metrics.totalLandings,
      color: 'text-red-500',
    },
    {
      icon: Clock,
      label: 'Horas Diurnas',
      value: metrics.dayHours.toFixed(1),
      color: 'text-yellow-500',
    },
    {
      icon: Clock,
      label: 'Horas Noturnas',
      value: metrics.nightHours.toFixed(1),
      color: 'text-indigo-500',
    },
    {
      icon: Clock,
      label: 'Horas IFR',
      value: metrics.ifrHours.toFixed(1),
      color: 'text-cyan-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metricCards.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index} className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Icon className={`h-8 w-8 ${metric.color}`} />
                <div>
                  <p className="text-sm text-slate-400">{metric.label}</p>
                  <p className="text-2xl font-bold text-white">
                    {metric.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}