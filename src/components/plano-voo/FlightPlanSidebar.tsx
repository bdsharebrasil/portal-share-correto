import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { Plane, MapPin, Navigation, Route, FolderOpen, Save, FileText, Loader2, PanelLeftClose, Wand2, User, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AerodromeCombobox } from './AerodromeCombobox';
import type { Aerodromo } from '@/hooks/useAerodromes';
import type { Aeronave } from '@/hooks/useAeronaves';
import type { PreferredRoute } from '@/hooks/usePreferredRoutes';
import { getAircraftSpeed } from '@/constants/aircraftSpeeds';
import { suggestFlightLevel } from '@/lib/flightLevel';
import { cn } from '@/lib/utils';

interface LegCalc {
  from: string;
  to: string;
  distanceNM: number;
  bearing: number;
}

export interface FlightPlanFormData {
  aircraftId: string;
  aeronaveId: string;
  registration: string;
  origin: string;
  destination: string;
  alternate: string;
  cruiseSpeed: number;
  altitude: number;
  fuelOnBoard: number;
  route: string;
  flightRule: 'V' | 'I' | 'Y' | 'Z';
  departure: string;
  picId: string;
}

interface FlightCalcs {
  totalDistanceNM: number;
  estimatedTimeMinutes: number;
  fuelBurnLiters: number;
  legs: LegCalc[];
}

interface FlightPlanSidebarProps {
  aerodromes: Aerodromo[];
  aeronaves: Aeronave[];
  formData: FlightPlanFormData;
  onFormChange: (data: Partial<FlightPlanFormData>) => void;
  calcs: FlightCalcs;
  preferredRoutes: PreferredRoute[];
  loadingRoutes: boolean;
  onSavePlan: () => void;
  onLoadPlan: () => void;
  onCalculate: () => void;
  isCalculating: boolean;
  crewMembers: Array<{ id: string; full_name: string; canac: string }>;
  onCollapse?: () => void;
}

const formatTime = (minutes: number) => {
  if (!minutes || minutes <= 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
};

const formatBearing = (deg: number) => `${Math.round(deg).toString().padStart(3, '0')}°`;

const SectionHeader: React.FC<{ step: number; title: string; icon: React.ReactNode; done?: boolean }> = ({ step, title, icon, done }) => (
  <div className="flex items-center gap-2 pt-1">
    <span className={cn(
      'h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center border',
      done ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border',
    )}>
      {step}
    </span>
    <span className="text-[10px] uppercase font-bold tracking-wider text-foreground flex items-center gap-1">
      {icon} {title}
    </span>
  </div>
);

export const FlightPlanSidebar: React.FC<FlightPlanSidebarProps> = ({
  aerodromes,
  aeronaves,
  formData,
  onFormChange,
  calcs,
  preferredRoutes,
  loadingRoutes,
  onSavePlan,
  onLoadPlan,
  onCalculate,
  isCalculating,
  crewMembers,
  onCollapse,
}) => {
  const [autoAltitude, setAutoAltitude] = useState(true);

  // Auto-fill speed when aircraft changes
  const handleAircraftChange = useCallback((aircraftId: string) => {
    const ac = aeronaves.find(a => a.id === aircraftId);
    if (ac) {
      const speed = getAircraftSpeed(ac.modelo);
      onFormChange({
        aircraftId,
        aeronaveId: aircraftId,
        registration: ac.matricula,
        cruiseSpeed: speed,
        fuelOnBoard: 0,
      });
    }
  }, [aeronaves, onFormChange]);

  const step1Ok = !!formData.aeronaveId && !!formData.picId;
  const step2Ok = !!formData.origin && !!formData.destination;

  // Proa magnética da perna principal
  const mainBearing = calcs.legs.length > 0 ? calcs.legs[0].bearing : null;

  // Sugestão automática de nível conforme regra semicircular
  const suggestion = useMemo(() => {
    if (mainBearing == null) return null;
    return suggestFlightLevel(mainBearing, formData.flightRule);
  }, [mainBearing, formData.flightRule]);

  // Aplica automaticamente o FL sugerido
  useEffect(() => {
    if (!autoAltitude || !suggestion) return;
    if (formData.altitude !== suggestion.altitudeFt) {
      onFormChange({ altitude: suggestion.altitudeFt });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion?.altitudeFt, autoAltitude]);

  // Sugere rota padrão quando ainda vazia
  useEffect(() => {
    if (!suggestion || formData.route) return;
    onFormChange({ route: suggestion.suggestedRoute });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion?.suggestedRoute]);

  return (
    <div className="w-80 bg-card/95 backdrop-blur-xl border-r border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-background/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Plano de Voo</h2>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onLoadPlan} title="Carregar Plano">
              <FolderOpen className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onSavePlan} title="Salvar Plano">
              <Save className="w-4 h-4" />
            </Button>
            {onCollapse && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onCollapse} title="Recolher painel">
                <PanelLeftClose className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ── ETAPA 1: Aeronave e Piloto ─────────────────────────── */}
        <SectionHeader step={1} title="Aeronave e Piloto" icon={<Plane className="w-3 h-3" />} done={step1Ok} />

        <div className="space-y-2">
          <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
            <Plane className="w-3 h-3" /> Aeronave
          </label>
          <Select value={formData.aeronaveId} onValueChange={handleAircraftChange}>
            <SelectTrigger className="bg-background border-border text-foreground h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {aeronaves.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="font-mono font-bold">{a.matricula}</span>
                  <span className="text-muted-foreground ml-2">{a.modelo}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
            <User className="w-3 h-3" /> PIC
          </label>
          <Select value={formData.picId} onValueChange={(v) => onFormChange({ picId: v })}>
            <SelectTrigger className="bg-background border-border text-foreground h-9">
              <SelectValue placeholder="Piloto em Comando..." />
            </SelectTrigger>
            <SelectContent>
              {crewMembers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name} <span className="text-muted-foreground">({c.canac})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── ETAPA 2: Origem e Destino ──────────────────────────── */}
        <div className={cn('space-y-4 pt-2 border-t border-border/60', !step1Ok && 'opacity-60')}>
          <SectionHeader step={2} title="Origem e Destino" icon={<MapPin className="w-3 h-3" />} done={step2Ok} />

          <div className="space-y-2">
            <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Origem
            </label>
            <AerodromeCombobox
              aerodromes={aerodromes}
              value={formData.origin}
              onChange={(val) => onFormChange({ origin: val })}
              placeholder="SBGR"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
              <Navigation className="w-3 h-3" /> Destino
            </label>
            <AerodromeCombobox
              aerodromes={aerodromes}
              value={formData.destination}
              onChange={(val) => onFormChange({ destination: val })}
              placeholder="SBRJ"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Alternativa</label>
            <AerodromeCombobox
              aerodromes={aerodromes}
              value={formData.alternate}
              onChange={(val) => onFormChange({ alternate: val })}
              placeholder="Alternativa..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
              <Route className="w-3 h-3" /> Regra de Voo
            </label>
            <Select value={formData.flightRule} onValueChange={(v) => onFormChange({ flightRule: v as any })}>
              <SelectTrigger className="bg-background border-border text-foreground h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="V">VFR</SelectItem>
                <SelectItem value="I">IFR</SelectItem>
                <SelectItem value="Y">Y (IFR → VFR)</SelectItem>
                <SelectItem value="Z">Z (VFR → IFR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── ETAPA 3: Performance, Nível e Rota ─────────────────── */}
        <div className={cn('space-y-4 pt-2 border-t border-border/60', !step2Ok && 'opacity-60')}>
          <SectionHeader step={3} title="Velocidade, Nível e Rota" icon={<Gauge className="w-3 h-3" />} done={!!formData.cruiseSpeed && !!formData.altitude} />

          {/* Sugestão automática de FL */}
          {suggestion && (
            <div className="rounded-md border border-primary/40 bg-primary/10 p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                  <Wand2 className="w-3 h-3" /> Nível sugerido
                </span>
                <span className="font-mono font-bold text-primary">{suggestion.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-tight">{suggestion.rationale}</p>
              <div className="flex flex-wrap gap-1">
                {suggestion.alternatives.map((alt) => (
                  <button
                    key={alt.altitudeFt}
                    type="button"
                    onClick={() => { setAutoAltitude(false); onFormChange({ altitude: alt.altitudeFt }); }}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted/40 hover:bg-muted text-foreground"
                  >
                    {alt.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoAltitude}
                  onChange={(e) => setAutoAltitude(e.target.checked)}
                  className="accent-primary"
                />
                Aplicar nível automaticamente
              </label>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider block mb-1">Spd (kt)</label>
              <Input
                type="number"
                value={formData.cruiseSpeed || ''}
                onChange={(e) => onFormChange({ cruiseSpeed: Number(e.target.value) })}
                className="bg-background border-border text-foreground font-mono h-8 text-center"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider block mb-1">Alt (ft)</label>
              <Input
                type="number"
                value={formData.altitude || ''}
                onChange={(e) => { setAutoAltitude(false); onFormChange({ altitude: Number(e.target.value) }); }}
                className="bg-background border-border text-foreground font-mono h-8 text-center"
                step={500}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider block mb-1">Fuel (L)</label>
              <Input
                type="number"
                value={formData.fuelOnBoard || ''}
                onChange={(e) => onFormChange({ fuelOnBoard: Number(e.target.value) })}
                className="bg-background border-border text-foreground font-mono h-8 text-center"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Rota</label>
            <Input
              value={formData.route}
              onChange={(e) => onFormChange({ route: e.target.value.toUpperCase() })}
              placeholder="DCT ou via pontos"
              className="bg-background border-border text-foreground font-mono h-8 text-xs"
            />
          </div>

          {(preferredRoutes.length > 0 || loadingRoutes) && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
                <Route className="w-3 h-3" /> Rotas Preferenciais
                {loadingRoutes && <Loader2 className="w-3 h-3 animate-spin" />}
              </label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {preferredRoutes.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => onFormChange({ route: r.route })}
                    className={cn(
                      'w-full text-left p-2 rounded border text-xs font-mono transition-colors',
                      formData.route === r.route
                        ? 'bg-primary/20 border-primary/50 text-primary'
                        : 'bg-muted/30 border-border text-foreground hover:bg-muted/50'
                    )}
                  >
                    <div className="truncate">{r.route}</div>
                    <div className="flex gap-2 mt-1">
                      {r.level && <Badge variant="outline" className="text-[9px] h-4">{r.level}</Badge>}
                      {r.type && <Badge variant="outline" className="text-[9px] h-4">{r.type}</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Partida</label>
            <Input
              type="datetime-local"
              value={formData.departure}
              onChange={(e) => onFormChange({ departure: e.target.value })}
              className="bg-background border-border text-foreground h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Calculations Summary */}
      <div className="border-t border-border p-4 bg-background/50">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Distance</div>
            <div className="text-lg font-mono font-bold text-foreground">
              {calcs.totalDistanceNM.toFixed(1)} <span className="text-xs text-muted-foreground">NM</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">ETE</div>
            <div className="text-lg font-mono font-bold text-primary">
              {formatTime(calcs.estimatedTimeMinutes)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Fuel Burn</div>
            <div className="text-sm font-mono font-bold text-foreground">
              {calcs.fuelBurnLiters.toFixed(0)} <span className="text-xs text-muted-foreground">L</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Pernas</div>
            <div className="text-sm font-mono font-bold text-foreground">{calcs.legs.length}</div>
          </div>
        </div>

        {calcs.legs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="text-[10px] uppercase text-muted-foreground mb-2">Pernas Details</div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {calcs.legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-foreground">{leg.from} → {leg.to}</span>
                  <span className="font-mono text-muted-foreground">
                    {formatBearing(leg.bearing)} / {leg.distanceNM.toFixed(0)}nm
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={onCalculate}
            disabled={!formData.origin || !formData.destination || isCalculating}
          >
            {isCalculating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
            Gerar Plano de Voo
          </Button>
          <Button variant="outline" className="flex-1" onClick={onSavePlan}>
            <Save className="w-4 h-4 mr-1" />
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
};
