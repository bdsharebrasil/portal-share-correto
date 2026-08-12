import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Plane,
  Radio,
  Fuel,
  Building,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertOctagon,
  CheckCircle,
} from 'lucide-react';
import { useAISWeb } from '@/hooks/useAISWeb';
import type { NOTAMData, ROTAERData, RouteValidation } from '@/types/aisweb';
import { toast } from 'sonner';

interface AeronauticalInfoTabProps {
  origin: string;
  destination: string;
  alternate: string;
  onValidationComplete?: (validation: RouteValidation) => void;
}

export function AeronauticalInfoTab({
  origin,
  destination,
  alternate,
  onValidationComplete,
}: AeronauticalInfoTabProps) {
  const { getNOTAMs, getMultipleNOTAMs, getROTAER, validateFlightPlan, loading, error, getCacheAge, clearCache } = useAISWeb();
  
  const [notams, setNotams] = useState<Record<string, NOTAMData[]>>({});
  const [rotaerData, setRotaerData] = useState<Record<string, ROTAERData | null>>({});
  const [validation, setValidation] = useState<RouteValidation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const [expandedNotams, setExpandedNotams] = useState<Record<string, boolean>>({});

  // Helper function to check if data is stale
  const isDataStale = (icao: string, type: 'notams' | 'rotaer'): boolean => {
    const age = getCacheAge(icao, type);
    return age !== null && age > 5; // Consider stale if older than 5 minutes
  };

  const loadData = async (forceRefresh = false) => {
    if (!origin || !destination) {
      toast.error('Selecione origem e destino');
      return;
    }

    setIsLoading(true);
    try {
      // Fetch NOTAMs for all aerodromes
      const icaos = [origin, destination, alternate].filter(Boolean);
      const notamsData = await getMultipleNOTAMs(icaos);
      setNotams(notamsData as Record<string, NOTAMData[]>);

      // Fetch ROTAER for origin and destination
      const [originRotaer, destRotaer] = await Promise.all([
        getROTAER(origin, forceRefresh),
        getROTAER(destination, forceRefresh),
      ]);
      
      setRotaerData({
        [origin.toUpperCase()]: originRotaer as ROTAERData | null,
        [destination.toUpperCase()]: destRotaer as ROTAERData | null,
      });

      // Validate flight plan - usando array vazio pois coordenadas não disponíveis aqui
      const validationResult = await validateFlightPlan(origin, destination, [], 5000);
      
      setValidation(validationResult);
      onValidationComplete?.(validationResult);

      setHasLoaded(true);
      toast.success('Dados aeronáuticos carregados');
    } catch (err) {
      console.error('Error loading aeronautical data:', err);
      toast.error('Erro ao carregar dados aeronáuticos');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleNotamExpand = (icao: string) => {
    setExpandedNotams(prev => ({ ...prev, [icao]: !prev[icao] }));
  };

  const getPriorityIcon = (priority: NOTAMData['priority']) => {
    switch (priority) {
      case 'critical':
        return <AlertOctagon className="w-4 h-4 text-destructive" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: NOTAMData['priority']) => {
    const colors: Record<string, string> = {
      critical: 'bg-destructive/20 text-destructive border-destructive/50',
      high: 'bg-warning/20 text-warning border-warning/50',
      medium: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
      low: 'bg-muted text-muted-foreground border-border',
    };
    return colors[priority] || colors.low;
  };

  const getStatusBadge = () => {
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
  };

  const renderNOTAMCard = (icao: string, label: string) => {
    const icaoNotams = notams[icao.toUpperCase()] || [];
    const isExpanded = expandedNotams[icao.toUpperCase()];
    const criticalCount = icaoNotams.filter(n => n.priority === 'critical').length;
    const highCount = icaoNotams.filter(n => n.priority === 'high').length;
    const cacheAge = getCacheAge(icao, 'notams');
    const stale = isDataStale(icao, 'notams');

    return (
      <Card className="bg-card border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-foreground">{label}</h3>
            <span className="text-muted-foreground text-sm">({icao})</span>
          </div>
          <div className="flex items-center gap-2">
            {stale && cacheAge !== null && (
              <Badge variant="outline" className="text-warning border-warning/50 text-xs">
                Dados de {cacheAge}min atrás
              </Badge>
            )}
            <Badge variant="outline" className="text-muted-foreground">
              {icaoNotams.length} NOTAMs
            </Badge>
            {criticalCount > 0 && (
              <Badge className="bg-destructive/20 text-destructive border-destructive/50 border">
                {criticalCount} Crítico{criticalCount > 1 ? 's' : ''}
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="bg-warning/20 text-warning border-warning/50 border">
                {highCount} Alto
              </Badge>
            )}
          </div>
        </div>

        {icaoNotams.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum NOTAM ativo</p>
        ) : (
          <Collapsible open={isExpanded} onOpenChange={() => toggleNotamExpand(icao)}>
            <div className="space-y-2">
              {/* Show first 2 NOTAMs always */}
              {icaoNotams.slice(0, 2).map((notam) => (
                <div key={notam.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                  {getPriorityIcon(notam.priority)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${getPriorityBadge(notam.priority)} border text-xs`}>
                        {notam.priority.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{notam.number}</span>
                    </div>
                    <p className="text-sm text-foreground break-words">{notam.message}</p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>De: {notam.startDate || 'N/A'}</span>
                      <span>Até: {notam.endDate || 'PERM'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {icaoNotams.length > 2 && (
              <>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground">
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Ocultar {icaoNotams.length - 2} NOTAMs
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Ver mais {icaoNotams.length - 2} NOTAMs
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {icaoNotams.slice(2).map((notam) => (
                    <div key={notam.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                      {getPriorityIcon(notam.priority)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`${getPriorityBadge(notam.priority)} border text-xs`}>
                            {notam.priority.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{notam.number}</span>
                        </div>
                        <p className="text-sm text-foreground break-words">{notam.message}</p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>De: {notam.startDate || 'N/A'}</span>
                          <span>Até: {notam.endDate || 'PERM'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </>
            )}
          </Collapsible>
        )}
      </Card>
    );
  };

  const renderROTAERCard = (icao: string, label: string) => {
    const rotaer = rotaerData[icao.toUpperCase()];
    
    if (!rotaer) {
      return (
        <Card className="bg-card border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Building className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">{label}</h3>
            <span className="text-muted-foreground text-sm">({icao})</span>
          </div>
          <p className="text-muted-foreground text-sm">Dados ROTAER não disponíveis</p>
        </Card>
      );
    }

    return (
      <Card className="bg-card border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{rotaer.name || label}</h3>
          <span className="text-muted-foreground text-sm">({icao})</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Runway Info */}
          {rotaer?.runways?.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-2 text-sm font-medium text-foreground">
                <Plane className="w-4 h-4" />
                Pistas
              </div>
              {rotaer.runways.map((rwy, idx) => (
                <div key={idx} className="text-sm text-muted-foreground mb-1">
                  <span className="text-foreground font-mono">{rwy.designator || 'N/A'}</span>
                  {' - '}
                  {rwy.length}m x {rwy.width}m
                  {rwy.surface && ` (${rwy.surface})`}
                  {rwy.strength && ` - PCN: ${rwy.strength}`}
                </div>
              ))}
            </div>
          )}

          {/* Frequencies */}
          {rotaer?.frequencies?.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-2 text-sm font-medium text-foreground">
                <Radio className="w-4 h-4" />
                Frequências
              </div>
              {rotaer.frequencies.slice(0, 4).map((freq, idx) => (
                <div key={idx} className="text-sm text-muted-foreground">
                  <span className="text-foreground">{freq.type}:</span> {freq.frequency}
                </div>
              ))}
            </div>
          )}

          {/* Services */}
          <div>
            <div className="flex items-center gap-1 mb-2 text-sm font-medium text-foreground">
              <Fuel className="w-4 h-4" />
              Serviços
            </div>
            <div className="flex flex-wrap gap-2">
              {rotaer?.services?.fuel && (
                <Badge variant="outline" className="text-success border-success/50">Combustível</Badge>
              )}
              {rotaer?.services?.hangar && (
                <Badge variant="outline" className="text-primary border-primary/50">Hangar</Badge>
              )}
              {rotaer?.services?.maintenance && (
                <Badge variant="outline" className="text-primary border-primary/50">Manutenção</Badge>
              )}
              {rotaer?.services?.customs && (
                <Badge variant="outline" className="text-primary border-primary/50">Alfândega</Badge>
              )}
              {!rotaer?.services?.fuel && !rotaer?.services?.hangar && (
                <span className="text-sm text-muted-foreground">Informações limitadas</span>
              )}
            </div>
          </div>

          {/* Operating Hours */}
          <div>
            <div className="flex items-center gap-1 mb-2 text-sm font-medium text-foreground">
              <Clock className="w-4 h-4" />
              Horário de Funcionamento
            </div>
            <p className="text-sm text-muted-foreground">
              {rotaer?.operatingHours || 'Não informado'}
            </p>
          </div>

          {/* Navaids */}
          {rotaer?.navaids?.length > 0 && (
            <div className="md:col-span-2">
              <div className="flex items-center gap-1 mb-2 text-sm font-medium text-foreground">
                <Radio className="w-4 h-4" />
                Auxílios à Navegação
              </div>
              <div className="flex flex-wrap gap-2">
                {rotaer.navaids.map((nav, idx) => (
                  <Badge key={idx} variant="outline" className="text-foreground">
                    {nav.type} {nav.identifier} {nav.frequency && `(${nav.frequency})`}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Elevation */}
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Elevação:</span>
          <span className="text-foreground font-mono">{rotaer?.elevation || 'N/A'} ft</span>
          {'city' in rotaer && rotaer.city && (
            <>
              <span className="text-muted-foreground">Cidade:</span>
              <span className="text-foreground">{(rotaer as any).city}/{(rotaer as any).state}</span>
            </>
          )}
        </div>
      </Card>
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Load Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Informações Aeronáuticas</h2>
          {validation && getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          {hasLoaded && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearCache();
                loadData(true);
              }}
              className="text-muted-foreground"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Atualizar
            </Button>
          )}
          {!hasLoaded && (
            <Button
              onClick={() => loadData()}
              disabled={!origin || !destination}
              className="bg-primary hover:bg-primary/90"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Carregar Dados AISWeb
            </Button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/50 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* No data message */}
      {!hasLoaded && !isLoading && (
        <Card className="bg-card border-border p-8 text-center">
          <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Dados Aeronáuticos Oficiais</h3>
          <p className="text-muted-foreground mb-4">
            Clique em "Carregar Dados AISWeb" para buscar NOTAMs, informações ROTAER e validar a rota usando dados oficiais do DECEA.
          </p>
          {(!origin || !destination) && (
            <p className="text-warning text-sm">Selecione origem e destino primeiro</p>
          )}
        </Card>
      )}

      {/* NOTAMs Section */}
      {hasLoaded && (
        <>
          <div>
            <h3 className="text-md font-medium text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              NOTAMs Ativos
            </h3>
            <div className="space-y-4">
              {origin && renderNOTAMCard(origin, 'Origem')}
              {destination && renderNOTAMCard(destination, 'Destino')}
              {alternate && renderNOTAMCard(alternate, 'Alternativa')}
            </div>
          </div>

          {/* ROTAER Section */}
          <div>
            <h3 className="text-md font-medium text-foreground mb-3 flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              Dados Técnicos (ROTAER)
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {origin && renderROTAERCard(origin, 'Origem')}
              {destination && renderROTAERCard(destination, 'Destino')}
            </div>
          </div>

          {/* Warnings Section */}
          {validation && validation.warnings.length > 0 && (
            <Card className="bg-warning/10 border-warning/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <h3 className="font-semibold text-warning">Alertas</h3>
              </div>
              <ul className="space-y-1">
                {validation.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-warning">•</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default AeronauticalInfoTab;
