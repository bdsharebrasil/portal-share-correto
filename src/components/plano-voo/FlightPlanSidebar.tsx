import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Plane, MapPin, Navigation, Route, Plus, FolderOpen, Save, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AerodromeCombobox } from './AerodromeCombobox';
import type { Aerodromo } from '@/hooks/useAerodromes';
import type { Aeronave } from '@/hooks/useAeronaves';
import type { PreferredRoute } from '@/hooks/usePreferredRoutes';
import { getAircraftSpeed } from '@/constants/aircraftSpeeds';
import { cn } from '@/lib/utils';

interface LegCalc {
  from: string;
  to: string;
  distanceNM: number;
  bearing: number;
}

export interface FlightPlanFormData {
  aircraftId: string;
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
}

const formatTime = (minutes: number) => {
  if (!minutes || minutes <= 0) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
};

const formatBearing = (deg: number) => `${Math.round(deg).toString().padStart(3, '0')}°`;

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
}) => {
  // Auto-fill speed when aircraft changes
  const handleAircraftChange = useCallback((aircraftId: string) => {
    const aircraft = aeronaves.find(a => a.id === aircraftId);
    if (aircraft) {
      const speed = getAircraftSpeed(aeronave.modelo);
      onFormChange({
        aircraftId,
        registration: aeronave.matricula,
        cruiseSpeed: speed,
        fuelOnBoard: 0,
      });
    }
  }, [aeronaves, onFormChange]);

  const selectedAeronave = useMemo(() => {
    return aeronaves.find(a => a.id === formData.aeronaveId);
  }, [aeronaves, formData.aeronaveId]);

  return (
    <div className="w-80 bg-card/95 backdrop-blur-xl border-r border-border flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-background/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-foreground">Flight Plan</h2>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onLoadPlan} title="Carregar Plano">
              <FolderOpen className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onSavePlan} title="Salvar Plano">
              <Save className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Aircraft Selection */}
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
                  <span className="font-mono font-bold">{a.registration}</span>
                  <span className="text-muted-foreground ml-2">{a.model}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* PIC */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">PIC</label>
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

        {/* Performance Row */}
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
              onChange={(e) => onFormChange({ altitude: Number(e.target.value) })}
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

        {/* Departure */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Departure
          </label>
          <AerodromeCombobox
            aerodromes={aerodromes}
            value={formData.origin}
            onChange={(val) => onFormChange({ origin: val })}
            placeholder="SBGR"
          />
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1">
            <Navigation className="w-3 h-3" /> Destination
          </label>
          <AerodromeCombobox
            aerodromes={aerodromes}
            value={formData.destination}
            onChange={(val) => onFormChange({ destination: val })}
            placeholder="SBRJ"
          />
        </div>

        {/* Alternate */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Alternativa</label>
          <AerodromeCombobox
            aerodromes={aerodromes}
            value={formData.alternate}
            onChange={(val) => onFormChange({ alternate: val })}
            placeholder="Alternativa..."
          />
        </div>

        {/* Flight Rule */}
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

        {/* Route */}
        <div className="space-y-2">
          <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Rota</label>
          <Input
            value={formData.route}
            onChange={(e) => onFormChange({ route: e.target.value.toUpperCase() })}
            placeholder="DCT ou via pontos"
            className="bg-background border-border text-foreground font-mono h-8 text-xs"
          />
        </div>

        {/* Preferred Routes */}
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
                    {r.tipo && <Badge variant="outline" className="text-[9px] h-4">{r.tipo}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Departure Time */}
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
            <div className="text-[10px] uppercase text-muted-foreground">Legs</div>
            <div className="text-sm font-mono font-bold text-foreground">{calcs.legs.length}</div>
          </div>
        </div>

        {/* Leg Details */}
        {calcs.legs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="text-[10px] uppercase text-muted-foreground mb-2">Leg Details</div>
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

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={onCalculate}
            disabled={!formData.origin || !formData.destination || isCalculating}
          >
            {isCalculating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
            Briefing
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
