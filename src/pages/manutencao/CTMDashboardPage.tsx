import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plane, ChevronDown, ChevronRight, Search, AlertCircle, ArrowLeft } from 'lucide-react';
import { CTMDashboard } from '@/components/ctm/CTMDashboard';

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status?: string | null;
  cell_hours_current?: number | null;
  celula_prox_revisao?: number | null;
  celula_atual?: number | null;
}

export default function CTMDashboardPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAircraft();
  }, []);

  const loadAircraft = async () => {
    try {
      const { data: aircraftData, error: aircraftError } = await supabase
        .from('aeronave')
        .select('id, matricula, modelo, status')
        .eq('status', 'ativa')
        .order("matricula");

      if (aircraftError) throw aircraftError;

      const aircraftWithLogbook = await Promise.all(
        (aircraftData || []).map(async (ac) => {
          try {
            const { data: logbookData } = await supabase
              .from('logbook_months')
              .select('celula_atual, celula_prox_revisao')
              .eq('aircraft_id', ac.id)
              .order('year', { ascending: false })
              .order('month', { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              ...ac,
              celula_atual: logbookData?.celula_atual ?? null,
              celula_prox_revisao: logbookData?.celula_prox_revisao ?? null,
            };
          } catch (error) {
            return {
              ...ac,
              celula_atual: null,
              celula_prox_revisao: null,
            };
          }
        })
      );

      setAircraft(aircraftWithLogbook);
    } catch (error: any) {
      toast.error('Erro ao carregar aeronaves: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizeStatus = (s: string | null | undefined) => (s ?? '').toString().trim().toLowerCase();
  const isActiveStatus = (s: string | null | undefined) => {
    const status = normalizeStatus(s);
    return status === '' || ['ativo', 'ativa', 'active', 'operacional'].includes(status);
  };
  const isInactiveStatus = (s: string | null | undefined) => {
    const status = normalizeStatus(s);
    return ['inativo', 'inativa', 'inactive', 'parado', 'manutenção', 'manutencao'].includes(status);
  };

  const filterAircraft = (ac: Aircraft) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    return (
      ac.registration.toLowerCase().includes(search) ||
      ac.model.toLowerCase().includes(search)
    );
  };

  const activeAircraft = aircraft.filter((a) => isActiveStatus(a.status) && filterAircraft(a));
  const inactiveAircraft = aircraft.filter((a) => isInactiveStatus(a.status) && filterAircraft(a));

  if (loading) {
    return (
      <Layout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </Layout>
    );
  }

  // Show dashboard if aircraft is selected
  if (selectedAircraftId) {
    const selectedAeronave = aircraft.find(ac => ac.id === selectedAircraftId);
    if (!selectedAeronave) return null;

    return (
      <Layout>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedAircraftId('')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{selectedAeronave.registration}</h1>
              <p className="text-sm text-muted-foreground">{selectedAeronave.model}</p>
            </div>
          </div>
          <CTMDashboard aircraftId={selectedAircraftId} />
        </div>
      </Layout>
    );
  }

  // Show aircraft selection
  const AeronaveCard = ({ ac }: { ac: Aircraft }) => (
    <button
      onClick={() => setSelectedAircraftId(ac.id)}
      className="group relative overflow-hidden rounded-lg border border-border bg-background/50 p-4 text-left transition-all hover:border-primary/50 hover:bg-background hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Plane className="h-4 w-4 text-primary flex-shrink-0" />
            <h3 className="font-bold text-foreground truncate">{ac.registration}</h3>
          </div>
          <p className="text-sm text-muted-foreground truncate">{ac.model}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform group-hover:translate-x-1" />
      </div>
      {ac.celula_prox_revisao && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
          <div className="text-xs text-muted-foreground">
            <span>Horas: {ac.celula_atual?.toLocaleString('pt-BR') ?? '—'}</span>
            {' | '}
            <span>Revisão: {ac.celula_prox_revisao?.toLocaleString('pt-BR') ?? '—'}</span>
          </div>
        </div>
      )}
    </button>
  );

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Gestão CTM
            </h1>
            <p className="text-muted-foreground">
              Controle Técnico de Manutenção de Aeronaves
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número de registro ou modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Active Aircraft Section */}
        {activeAircraft.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Aeronaves Ativas
              </h2>
              <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium">
                {activeAircraft.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeAircraft.map((ac) => (
                <AeronaveCard key={ac.id} ac={ac} />
              ))}
            </div>
          </div>
        )}

        {/* Inactive Aircraft Section */}
        {aircraft.some((a) => isInactiveStatus(a.status)) && (
          <div className="space-y-3">
            <button
              onClick={() => setShowInactive((s) => !s)}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-background/50 p-4 text-left transition-colors hover:bg-background/75"
            >
              <div className="flex items-center gap-2">
                {showInactive ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                <h2 className="text-lg font-semibold text-foreground">
                  Aeronaves Inativas
                </h2>
                <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 text-xs font-medium">
                  {inactiveAircraft.length}
                </span>
              </div>
            </button>
            {showInactive && inactiveAircraft.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                {inactiveAircraft.map((ac) => (
                  <AeronaveCard key={ac.id} ac={ac} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {activeAircraft.length === 0 && inactiveAircraft.length === 0 && (
          <Card className="border-border bg-background/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm.trim() ? "Nenhuma aeronave encontrada com esse critério" : "Nenhuma aeronave disponível"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
