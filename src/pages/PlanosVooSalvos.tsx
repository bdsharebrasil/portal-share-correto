import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ChevronRight, Clock3, Folder, Plane, Route, Search } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useFlightPlans, type FlightPlan } from '@/hooks/useFlightPlans';
import { useAeronaves } from '@/hooks/useAeronaves';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sem data';
  try {
    return format(new Date(`${value}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return value;
  }
}

function aircraftLabel(id: string | null, aeronaves: any[]) {
  const aircraft = aeronaves.find((item) => item.id === id);
  return aircraft ? `${aircraft.matricula}${aircraft.modelo ? ` · ${aircraft.modelo}` : ''}` : 'Aeronave não identificada';
}

export default function PlanosVooSalvos() {
  const navigate = useNavigate();
  const { flightPlans, loading } = useFlightPlans();
  const { aeronaves } = useAeronaves();
  const [search, setSearch] = useState('');
  const [openedAircraft, setOpenedAircraft] = useState<string | null>(null);

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = flightPlans.filter((plan) => {
      if (!query) return true;
      return [plan.numero_voo, plan.departure_airport, plan.arrival_airport, plan.pilot_in_command, plan.route]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    const map = new Map<string, FlightPlan[]>();
    filtered.forEach((plan) => {
      const key = plan.aeronave_id || 'sem-aeronave';
      map.set(key, [...(map.get(key) || []), plan]);
    });

    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const first = new Date(b[0]?.created_at || 0).getTime();
      const second = new Date(a[0]?.created_at || 0).getTime();
      return first - second;
    });
  }, [flightPlans, search]);

  const visibleGroups = openedAircraft ? groups.filter(([key]) => key === openedAircraft) : groups;

  return (
    <Layout>
      <div className="min-h-[calc(100vh-73px)] overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary/15 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-10 h-64 w-64 rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-73px)] max-w-[1500px] flex-col gap-6 p-5 md:p-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/plano-voo')} className="rounded-xl border border-border/60 bg-card/60">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-blue-300" />
                  <h1 className="text-2xl font-semibold tracking-tight">Planos de voo salvos</h1>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Organizados por aeronave e vinculados aos agendamentos.</p>
              </div>
            </div>
            <Button onClick={() => navigate('/plano-voo')} className="rounded-xl bg-blue-500 font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
              <Route className="mr-2 h-4 w-4" /> Novo plano
            </Button>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 shadow-sm backdrop-blur-xl">
            <div className="relative min-w-[240px] flex-1 md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por voo, rota ou piloto" className="h-10 rounded-xl border-border/60 bg-background/60 pl-9" />
            </div>
            {openedAircraft && <Button variant="ghost" size="sm" onClick={() => setOpenedAircraft(null)}>Ver todas as aeronaves</Button>}
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Carregando planos salvos...</div>
          ) : visibleGroups.length === 0 ? (
            <Card className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-dashed border-border/70 bg-card/50 p-12 text-center">
              <Folder className="h-14 w-14 text-blue-400/70" />
              <h2 className="text-lg font-semibold">Nenhum plano encontrado</h2>
              <p className="max-w-md text-sm text-muted-foreground">Crie um plano de voo pelo número do agendamento e ele aparecerá automaticamente na pasta da aeronave.</p>
              <Button onClick={() => navigate('/plano-voo')} className="mt-2 rounded-xl bg-blue-500 text-white hover:bg-blue-400">Criar plano</Button>
            </Card>
          ) : (
            <div className="space-y-8">
              {visibleGroups.map(([aircraftId, plans]) => (
                <section key={aircraftId} className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300/80">Pasta da aeronave</p>
                      <h2 className="mt-1 text-lg font-semibold">{aircraftLabel(aircraftId === 'sem-aeronave' ? null : aircraftId, aeronaves)}</h2>
                    </div>
                    <span className="text-xs text-muted-foreground">{plans.length} {plans.length === 1 ? 'plano' : 'planos'}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {plans.map((plan) => (
                      <Card key={plan.id} className="group relative overflow-hidden rounded-2xl border-border/60 bg-card/70 p-0 transition-all hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-xl hover:shadow-blue-500/10">
                        <button type="button" onClick={() => navigate(`/plano-voo?plano=${plan.id}`)} className="w-full text-left">
                          <div className="relative h-32 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-400 p-5">
                            <div className="absolute -right-4 -top-7 h-24 w-32 rounded-t-2xl border-2 border-white/25 bg-blue-300/20 shadow-[0_14px_30px_rgba(15,23,42,0.22)]" />
                            <div className="absolute bottom-[-28px] left-[-18px] h-24 w-40 rounded-t-2xl border-2 border-white/20 bg-blue-600/30" />
                            <Folder className="relative z-10 h-12 w-12 fill-blue-200/35 text-white drop-shadow-lg" />
                          </div>
                          <div className="space-y-3 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{plan.numero_voo || 'Plano sem número'}</p>
                                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{plan.departure_airport} → {plan.arrival_airport}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-blue-300" />
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(plan.flight_date)}</span>
                              <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {plan.estimated_time || '—'}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-border/50 pt-3">
                              <Badge variant="outline" className="border-blue-400/30 bg-blue-500/10 text-blue-200">{plan.flight_rule === 'I' ? 'IFR' : plan.flight_rule === 'V' ? 'VFR' : plan.flight_rule || '—'}</Badge>
                              <span className="truncate text-[11px] text-muted-foreground">{plan.pilot_in_command || 'PIC não informado'}</span>
                            </div>
                          </div>
                        </button>
                      </Card>
                    ))}
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => setOpenedAircraft(aircraftId)} className="text-blue-300 hover:bg-blue-500/10 hover:text-blue-200">
                    Abrir pasta <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
