import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  CheckCircle,
  Info,
} from 'lucide-react';
import type { RouteValidation, NOTAMData } from '@/types/aisweb';

interface RouteStatusBadgeProps {
  validation: RouteValidation | null;
}

export function RouteStatusBadge({ validation }: RouteStatusBadgeProps) {
  if (!validation) return null;

  const statusConfig = {
    clear: { label: 'Rota Livre', icon: CheckCircle, className: 'bg-success/20 text-success border-success/50' },
    caution: { label: 'Atenção', icon: AlertCircle, className: 'bg-amber-500/20 text-amber-400 border-amber-500/50' },
    warning: { label: 'Verificar NOTAMs', icon: AlertTriangle, className: 'bg-warning/20 text-warning border-warning/50' },
    danger: { label: 'Restrições Críticas', icon: AlertOctagon, className: 'bg-destructive/20 text-destructive border-destructive/50' },
  };

  const config = statusConfig[validation.routeStatus];
  const Icon = config.icon;

  return (
    <Badge className={`${config.className} border gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

interface NOTAMSummaryProps {
  notams: Record<string, NOTAMData[]>;
  origin: string;
  destination: string;
  alternate?: string;
}

export function NOTAMSummary({ notams, origin, destination, alternate }: NOTAMSummaryProps) {
  const allNotams = [
    ...(notams[origin.toUpperCase()] || []),
    ...(notams[destination.toUpperCase()] || []),
    ...(alternate ? notams[alternate.toUpperCase()] || [] : []),
  ];

  const criticalNotams = allNotams.filter(n => n.priority === 'critical');
  const highNotams = allNotams.filter(n => n.priority === 'high');

  if (allNotams.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-foreground">Resumo de NOTAMs</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-muted-foreground">
            {allNotams.length} total
          </Badge>
          {criticalNotams.length > 0 && (
            <Badge className="bg-destructive/20 text-destructive border-destructive/50 border">
              {criticalNotams.length} crítico{criticalNotams.length > 1 ? 's' : ''}
            </Badge>
          )}
          {highNotams.length > 0 && (
            <Badge className="bg-warning/20 text-warning border-warning/50 border">
              {highNotams.length} alto
            </Badge>
          )}
        </div>
      </div>

      {/* Show critical NOTAMs */}
      {criticalNotams.length > 0 && (
        <div className="space-y-2">
          {criticalNotams.slice(0, 3).map((notam, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-destructive/10 rounded-lg border border-destructive/30">
              <AlertOctagon className="w-4 h-4 text-destructive mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-destructive">{notam.icao}</span>
                </div>
                <p className="text-sm text-foreground break-words line-clamp-2">
                  {notam.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show high priority NOTAMs if no critical */}
      {criticalNotams.length === 0 && highNotams.length > 0 && (
        <div className="space-y-2">
          {highNotams.slice(0, 2).map((notam, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 bg-warning/10 rounded-lg border border-warning/30">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-warning">{notam.icao}</span>
                </div>
                <p className="text-sm text-foreground break-words line-clamp-2">
                  {notam.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No critical or high priority */}
      {criticalNotams.length === 0 && highNotams.length === 0 && (
        <div className="flex items-center gap-2 p-2 bg-success/10 rounded-lg border border-success/30">
          <CheckCircle className="w-4 h-4 text-success" />
          <p className="text-sm text-foreground">
            Nenhum NOTAM crítico ou de alta prioridade
          </p>
        </div>
      )}
    </Card>
  );
}

interface NavaidsDisplayProps {
  rotaerData: Record<string, any | null>;
  origin: string;
  destination: string;
}

export function NavaidsDisplay({ rotaerData, origin, destination }: NavaidsDisplayProps) {
  const originRotaer = rotaerData[origin.toUpperCase()];
  const destRotaer = rotaerData[destination.toUpperCase()];

  const hasNavaids = (originRotaer?.navaids?.length > 0) || (destRotaer?.navaids?.length > 0);

  if (!hasNavaids) return null;

  return (
    <Card className="bg-card border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Auxílios à Navegação</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {originRotaer?.navaids?.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Origem ({origin})</p>
            <div className="flex flex-wrap gap-1">
              {originRotaer.navaids.map((nav: any, idx: number) => (
                <Badge key={idx} variant="outline" className="text-foreground text-xs">
                  {nav.tipo} {nav.identifier}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {destRotaer?.navaids?.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Destino ({destination})</p>
            <div className="flex flex-wrap gap-1">
              {destRotaer.navaids.map((nav: any, idx: number) => (
                <Badge key={idx} variant="outline" className="text-foreground text-xs">
                  {nav.tipo} {nav.identifier}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
