import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, Plus, Calendar, Clock, MapPin, BookOpen, Folder } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddAircraftDialog } from "@/components/diario/AddAircraftDialog";
import { AddAerodromeDialog } from "@/components/diario/AddAerodromeDialog";
import { CreateLogbookDialog } from "@/components/diario/CreateLogbookDialog";
import { useNavigate } from "react-router-dom";
export default function DiarioBordo() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addAerodromeOpen, setAddAerodromeOpen] = useState(false);
  const [createLogbookOpen, setCreateLogbookOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const navigate = useNavigate();
  const {
    data: aircraft,
    isLoading
  } = useQuery({
    queryKey: ['aircraft'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('aircraft').select('*').order('registration');
      if (error) throw error;
      return data;
    }
  });

  // Buscar todos os diários de bordo para mostrar quais aeronaves têm diários
  const { data: logbookMonths } = useQuery({
    queryKey: ['logbook-months-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbook_months')
        .select('aircraft_id, year, month, is_closed')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return data;
    }
  });
  const isActiveAircraft = (status?: string | null) => {
    const s = String(status ?? '').toLowerCase();
    return s === 'ativa' || s === 'active' || s === '';
  };

  // Função para verificar se uma aeronave tem diários
  const hasLogbooks = (aircraftId: string) => {
    return (logbookMonths || []).some(log => log.aircraft_id === aircraftId);
  };

  // Função para obter o último diário de uma aeronave
  const getLatestLogbook = (aircraftId: string) => {
    return (logbookMonths || [])
      .filter(log => log.aircraft_id === aircraftId)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      })[0];
  };

  const activeAircraft = (aircraft ?? []).filter((ac: any) => isActiveAircraft(ac.status));
  const inactiveAircraft = (aircraft ?? []).filter((ac: any) => !isActiveAircraft(ac.status));
  return <Layout>
      <div className="container mx-auto p-6 space-y-6 w-full">
        <div className="flex justify-between items-center pb-[30px]">
          <div>
            <h1 className="text-3xl font-bold text-foreground pb-[2px] mt-2 mr-[85px]">Diários de Bordo</h1>
            <p className="text-muted-foreground mt-1 pb-[21px]">
              Gerencie os diários de bordo digitais das aeronaves.
            </p>
          </div>
          <div className="flex gap-2"></div>
        </div>

        <div className="flex flex-row gap-2">
          <Button onClick={() => navigate('/aerodromos')} variant="outline" className="gap-2 bg-background border-border">
            <MapPin className="h-4 w-4 text-foreground" />
            <span className="capitalize">gerenciar aerodromos</span>
          </Button>
          <Button onClick={() => setCreateLogbookOpen(true)} className="gap-2 bg-custom-cyan shadow-[0_4px_15px_-4px_rgba(26,228,255,0.2)] text-slate-300 rounded-sm">
            <BookOpen className="h-4 w-4" />
            Criar Diário de Bordo
          </Button>
        </div>
        <Button onClick={() => navigate('/aeronaves')} variant="outline" className="gap-2 mt-2 bg-background border-border">
          <Plus className="h-4 w-4 text-foreground" />
          <span className="capitalize">gerenciar aeronaves</span>
        </Button>

        {isLoading ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-3">
                  <div className="h-6 bg-muted rounded w-24" />
                  <div className="h-4 bg-muted rounded w-16" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-32" />
                    <div className="h-4 bg-muted rounded w-40" />
                  </div>
                </CardContent>
              </Card>)}
          </div> : activeAircraft.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeAircraft.map(ac => {
              const latestLog = getLatestLogbook(ac.id);
              const hasDiaries = hasLogbooks(ac.id);
              
              return <Card key={ac.id} className="hover:shadow-lg transition-all cursor-pointer border-border bg-card" onClick={() => {
                if (latestLog) {
                  navigate(`/diario-bordo/${ac.id}?month=${latestLog.month}&year=${latestLog.year}`);
                } else {
                  navigate(`/diario-bordo/${ac.id}`);
                }
              }}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Plane className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-foreground">
                          {ac.registration}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {ac.model}
                        </p>
                      </div>
                    </div>
                    <Badge variant={ac.status === 'Ativa' ? 'default' : 'secondary'} className={ac.status === 'Ativa' ? 'bg-green-500 text-white' : ''}>
                      {ac.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{hasDiaries ? `${(logbookMonths || []).filter(l => l.aircraft_id === ac.id).length} diário(s)` : 'Nenhum diário criado'}</span>
                  </div>
                  {latestLog && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="h-4 w-4" />
                      <span>Último: {latestLog.month}/{latestLog.year}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{((ac as any).total_hours || 0).toFixed(1)} horas totais</span>
                  </div>
                </CardContent>
              </Card>
            })}
          </div> : <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Plane className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhuma aeronave cadastrada
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Comece adicionando sua primeira aeronave ao sistema.
              </p>
              <div className="flex gap-2">
                <Button onClick={() => setCreateLogbookOpen(true)}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Criar Diário de Bordo
                </Button>
              </div>
            </CardContent>
          </Card>}

        {inactiveAircraft.length > 0 && <div className="space-y-3 mt-8">
            <button type="button" className="w-full flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-left" onClick={() => setShowInactive(v => !v)} aria-expanded={showInactive}>
              <div className="flex items-center gap-2">
                <Folder className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-foreground">Aeronaves e Diários Inativos</h2>
                <Badge variant="secondary">
                  {inactiveAircraft.length}
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground">{showInactive ? 'Ocultar' : 'Abrir pasta'}</span>
            </button>

            {showInactive && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {inactiveAircraft.map((ac: any) => <Card key={ac.id} className="hover:shadow-lg transition-all cursor-pointer border-border bg-card/60" onClick={() => navigate(`/diario-bordo/${ac.id}`)}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              <Plane className="h-6 w-6 text-foreground" />
                            </div>
                            <div>
                              <CardTitle className="text-xl text-foreground">
                                {ac.registration}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                {ac.model}
                              </p>
                            </div>
                          </div>
                          <Badge variant="secondary">{ac.status || 'Inativa'}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Diário {new Date().getFullYear()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{ac.total_hours?.toFixed(1) || '0.0'} horas totais</span>
                        </div>
                      </CardContent>
                    </Card>)}
              </div>}
          </div>}

        <AddAircraftDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
        <AddAerodromeDialog open={addAerodromeOpen} onOpenChange={setAddAerodromeOpen} />
        <CreateLogbookDialog open={createLogbookOpen} onOpenChange={setCreateLogbookOpen} aircraft={aircraft || []} />
      </div>
    </Layout>;
}