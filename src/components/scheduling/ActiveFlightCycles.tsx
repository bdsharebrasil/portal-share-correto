import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plane, MapPin, Clock, User, ArrowRight, RefreshCw, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { getFlightCycleStatusConfig } from '@/utils/statusHelpers';

interface ActiveCycle {
  id: string;
  registration: string;
  aircraft_model: string;
  origin_icao: string;
  destination_icao: string;
  flight_date: string;
  status: string;
  pilot_name: string | null;
  client_name: string | null;
  observations: string | null;
  started_at: string | null;
}

export function ActiveFlightCycles() {
  const navigate = useNavigate();
  
  const { data: cycles, isLoading, refetch } = useQuery({
    queryKey: ['active-flight-cycles'],
    queryFn: async () => {
      // Buscar ciclos ativos da view active_flight_cycles
      const { data, error } = await supabase
        .from('active_flight_cycles')
        .select('*')
        .in('status', ['em_execucao', 'confirmado'])
        .order('flight_date', { ascending: true });
      
      if (error) throw error;
      return data as ActiveCycle[];
    },
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Carregando ciclos ativos...</span>
        </CardContent>
      </Card>
    );
  }

  if (!cycles || cycles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Plane className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">Nenhum ciclo de voo ativo no momento</p>
          <p className="text-sm text-muted-foreground mt-1">
            Os ciclos aparecem aqui quando um voo é iniciado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          Ciclos de Voo Ativos ({cycles.length})
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {cycles.map((cycle) => {
          const statusConfig = getFlightCycleStatusConfig(cycle.status);
          
          return (
            <div
              key={cycle.id}
              className="p-4 bg-muted/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Info Principal */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/20 text-primary">
                      {cycle.registration}
                    </Badge>
                    <Badge variant="outline" className={statusConfig.className}>
                      {statusConfig.icon} {statusConfig.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {cycle.aircraft_model}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {cycle.origin_icao}
                      <ArrowRight className="h-3 w-3" />
                      {cycle.destination_icao}
                    </div>
                    
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {format(new Date(cycle.flight_date), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                    
                    {cycle.pilot_name && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        {cycle.pilot_name}
                      </div>
                    )}

                    {cycle.client_name && (
                      <div className="text-sm text-muted-foreground">
                        Cliente: <span className="font-medium">{cycle.client_name}</span>
                      </div>
                    )}
                  </div>

                  {cycle.observations && (
                    <p className="text-xs text-muted-foreground bg-card p-2 rounded border border-border/50">
                      {cycle.observations}
                    </p>
                  )}

                  {cycle.started_at && (
                    <p className="text-xs text-muted-foreground">
                      Iniciado em: {format(new Date(cycle.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => navigate(`/diario-bordo?cycle_id=${cycle.id}`)}
                  >
                    <FileText className="h-4 w-4" />
                    Preencher Diário
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
