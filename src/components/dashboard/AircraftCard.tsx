import { Plane, Clock, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Aircraft } from '@/types/maintenance';

interface AircraftCardProps {
  aircraft: Aircraft;
}

export function AircraftCard({ aircraft }: AircraftCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">{aircraft.registration}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {aircraft.manufacturer} {aircraft.model}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/30">
            <Plane className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horas Totais</p>
              <p className="text-sm font-semibold">{aircraft.totalHours.toFixed(1)}h</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pousos</p>
              <p className="text-sm font-semibold">{aircraft.totalCycles}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-md bg-muted/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">S/N</span>
            <span className="font-mono font-medium">{aircraft.serialNumber}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
