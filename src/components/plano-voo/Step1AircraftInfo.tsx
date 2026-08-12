import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AutocompleteInput, type AutocompleteOption } from '@/components/ui/autocomplete-input';
import { Badge } from '@/components/ui/badge';
import {
  Plane,
  FileText,
  MapPin,
  Navigation,
  Clock,
  Fuel,
  Compass,
  ArrowRight,
  Calculator,
  Info,
  Gauge,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance, calculateMagneticHeading } from '@/lib/aviation';
import {
  formatSpeedCode,
  getSuggestedAltitudeFallback,
  calculateMinimumEndurance,
} from '@/lib/aircraft-speeds';

interface Step1Props {
  formData: any;
  updateFormData: (data: Partial<any>) => void;
  onViewMap?: (data: any) => void;
}

interface Aircraft {
  id: string;
  matricula: string;
  modelo: string;
  fabricante: string;
  performance_aeronave_id: string | null;
  performance_aeronave: {
    categoria: string;
    teto_servico_ft: number;
    nivel_cruzeiro_min_ft: number;
    nivel_cruzeiro_max_ft: number;
    velocidade_cruzeiro_kt: number | null;
  } | null;
}

interface Aerodrome {
  id: string;
  designativo: string;
  nome: string;
  coordenadas: string | null;
}

const FLIGHT_RULES = [
  { value: 'I', label: 'I - IFR' },
  { value: 'V', label: 'V - VFR' },
  { value: 'Y', label: 'Y - IFR primeiro, depois VFR' },
  { value: 'Z', label: 'Z - VFR primeiro, depois IFR' },
];

export function Step1AircraftInfo({ formData, updateFormData, onViewMap }: Step1Props) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [aerodromes, setAerodromes] = useState<Aerodrome[]>([]);
  const [aerodromesOptions, setAerodromesOptions] = useState<AutocompleteOption[]>([]);
  const [calculatedData, setCalculatedData] = useState<{
    distanceNM: number;
    magneticHeading: number;
    trueHeading: number;
    estimatedTimeMinutes: number;
    suggestedAltitude: string;
    suggestedEndurance: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [aircraftRes, aerodromesRes] = await Promise.all([
        (supabase as any)
          .from('aeronave')
          .select(`
            id, matricula, modelo, fabricante,
            performance_aeronave_id,
            performance_aeronave:performance_aeronave_id (
              categoria, teto_servico_ft, nivel_cruzeiro_min_ft, nivel_cruzeiro_max_ft, velocidade_cruzeiro_kt
            )
          `),
        supabase.from('aerodromes').select('*').order('designativo'),
      ]);

      if (aircraftRes.data) {
        setAircraft(aircraftRes.data as unknown as Aircraft[]);
      }
      if (aerodromesRes.data) {
        setAerodromes(aerodromesRes.data as Aerodrome[]);
        const options: AutocompleteOption[] = aerodromesRes.data.map((a) => ({
          id: a.designativo,
          label: `${a.designativo} - ${a.nome}`,
        }));
        setAerodromesOptions(options);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const parseCoordinates = (
    coordStr: string | null
  ): { lat: number; lon: number } | null => {
    if (!coordStr) return null;
    const match = coordStr.match(
      /([NS])(\d+)°(\d+)'(\d+)"?\s*([EW])(\d+)°(\d+)'(\d+)"?/i
    );
    if (match) {
      const lat =
        (parseInt(match[2]) +
          parseInt(match[3]) / 60 +
          parseInt(match[4]) / 3600) *
        (match[1].toUpperCase() === 'S' ? -1 : 1);
      const lon =
        (parseInt(match[6]) +
          parseInt(match[7]) / 60 +
          parseInt(match[8]) / 3600) *
        (match[5].toUpperCase() === 'W' ? -1 : 1);
      return { lat, lon };
    }
    const decimalMatch = coordStr.match(/([-\d.]+),?\s*([-\d.]+)/);
    if (decimalMatch) {
      return {
        lat: parseFloat(decimalMatch[1]),
        lon: parseFloat(decimalMatch[2]),
      };
    }
    return null;
  };

  const calculateRoute = useCallback(() => {
    if (
      !formData.departureAirport ||
      !formData.destinationAirport ||
      !formData.cruiseSpeed
    ) {
      setCalculatedData(null);
      return;
    }

    const depAerodrome = aerodromes.find(
      (a) => a.designativo === formData.departureAirport
    );
    const arrAerodrome = aerodromes.find(
      (a) => a.designativo === formData.destinationAirport
    );

    if (!depAerodrome || !arrAerodrome) {
      setCalculatedData(null);
      return;
    }

    const depCoords = parseCoordinates(depAerodrome.coordenadas);
    const arrCoords = parseCoordinates(arrAerodrome.coordenadas);

    if (!depCoords || !arrCoords) {
      setCalculatedData(null);
      return;
    }

    const distanceNM = calculateDistance(
      depCoords.lat,
      depCoords.lon,
      arrCoords.lat,
      arrCoords.lon
    );
    const magneticHeading = calculateMagneticHeading(
      depCoords.lat,
      depCoords.lon,
      arrCoords.lat,
      arrCoords.lon
    );

    // True heading = magnetic heading + magnetic variation (for Brazil ~-20°)
    const trueHeading = (magneticHeading + 20 + 360) % 360;

    // Extract speed from format like "N0150" or just "150"
    const speedMatch = formData.cruiseSpeed.match(/(\d+)/);
    const cruiseSpeed = speedMatch ? parseInt(speedMatch[1]) : 150;

    const estimatedTimeMinutes = (distanceNM / cruiseSpeed) * 60;

    const isIFR = formData.flightRules === 'I' || formData.flightRules === 'Y';
    const suggestedAltitude = getSuggestedAltitudeFallback(
      distanceNM,
      magneticHeading,
      isIFR
    );
    const suggestedEndurance = calculateMinimumEndurance(
      estimatedTimeMinutes,
      isIFR
    );

    setCalculatedData({
      distanceNM: Math.round(distanceNM),
      magneticHeading: Math.round(magneticHeading),
      trueHeading: Math.round(trueHeading),
      estimatedTimeMinutes: Math.round(estimatedTimeMinutes),
      suggestedAltitude,
      suggestedEndurance,
    });

    // Auto-update form with calculated values
    const hours = Math.floor(estimatedTimeMinutes / 60);
    const minutes = Math.round(estimatedTimeMinutes % 60);

    updateFormData({
      estimatedTime: `${hours.toString().padStart(2, '0')}${minutes
        .toString()
        .padStart(2, '0')}`,
      cruiseAltitude: suggestedAltitude,
      fuelEndurance: suggestedEndurance,
    });
  }, [
    formData.departureAirport,
    formData.destinationAirport,
    formData.cruiseSpeed,
    formData.flightRules,
    aerodromes,
    updateFormData,
  ]);

  useEffect(() => {
    if (
      aerodromes.length > 0 &&
      formData.departureAirport &&
      formData.destinationAirport
    ) {
      calculateRoute();
    }
  }, [
    formData.departureAirport,
    formData.destinationAirport,
    formData.cruiseSpeed,
    formData.flightRules,
    aerodromes.length,
    calculateRoute,
  ]);

  const handleAircraftChange = (aircraftId: string) => {
    const selected = aircraft.find((a) => a.id === aircraftId);
    if (selected) {
      const speedCode = formatSpeedCode(selected.performance_aeronave?.velocidade_cruzeiro_kt);
      updateFormData({
        aircraftId: selected.id,
        aircraftRegistration: selected.matricula,
        aircraftType: selected.modelo,
        cruiseSpeed: speedCode,
      });
    }
  };

  const formatTime = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hrs}h ${mins}min`;
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Aircraft Selection */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <Plane className="h-5 w-5 text-primary" />
            </div>
            1. Selecione a Aeronave
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Aeronave *</Label>
              <Select
                value={formData.aeronaveId || ''}
                onValueChange={handleAircraftChange}
              >
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue placeholder="Selecione a aeronave" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {aircraft.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-foreground">
                      {a.matricula} - {a.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Tipo de Aeronave</Label>
              <Input
                value={formData.aeronaveType || ''}
                readOnly
                placeholder="—"
                className="bg-background border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Velocidade de Cruzeiro
              </Label>
              <Input
                value={formData.cruiseSpeed || ''}
                onChange={(e) =>
                  updateFormData({ cruiseSpeed: e.target.value.toUpperCase() })
                }
                placeholder="N0150"
                className="bg-background border-border text-foreground font-mono"
              />
              {formData.aeronaveRegistration && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Velocidade sugerida para {formData.aeronaveRegistration}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Flight Rules */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            2. Regra de Voo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-w-xs">
            <Label className="text-muted-foreground">Regras de Voo *</Label>
            <Select
              value={formData.flightRules || ''}
              onValueChange={(value) => updateFormData({ flightRules: value })}
            >
              <SelectTrigger className="bg-background border-border text-foreground mt-2">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {FLIGHT_RULES.map((rule) => (
                  <SelectItem
                    key={rule.value}
                    value={rule.value}
                    className="text-foreground"
                  >
                    {rule.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Origin, Destination, Alternate */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            3. Origem, Destino e Alternativa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Origem (ICAO) *</Label>
              <AutocompleteInput
                value={formData.departureAirport || ''}
                onChange={(value) => {
                  const icao = value.split(' - ')[0].toUpperCase().trim();
                  updateFormData({ departureAirport: icao });
                }}
                options={aerodromesOptions}
                placeholder="Ex: SBGR"
                onSelect={(option) => {
                  const icao = option.id.toUpperCase();
                  updateFormData({ departureAirport: icao });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Destino (ICAO) *</Label>
              <AutocompleteInput
                value={formData.destinationAirport || ''}
                onChange={(value) => {
                  const icao = value.split(' - ')[0].toUpperCase().trim();
                  updateFormData({ destinationAirport: icao });
                }}
                options={aerodromesOptions}
                placeholder="Ex: SBRJ"
                onSelect={(option) => {
                  const icao = option.id.toUpperCase();
                  updateFormData({ destinationAirport: icao });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Alternativa (ICAO)</Label>
              <AutocompleteInput
                value={formData.alternateAirport || ''}
                onChange={(value) => {
                  const icao = value.split(' - ')[0].toUpperCase().trim();
                  updateFormData({ alternateAirport: icao });
                }}
                options={aerodromesOptions}
                placeholder="Ex: SBSP"
                onSelect={(option) => {
                  const icao = option.id.toUpperCase();
                  updateFormData({ alternateAirport: icao });
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculated Results - Only shown after origin and destination are set */}
      {calculatedData && (
        <Card className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              Dados Calculados
              <Badge variant="outline" className="ml-auto border-primary text-primary">
                Atualizado automaticamente
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {/* Route Header */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Origem</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formData.departureAirport}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-0.5 bg-primary/50" />
                <Navigation className="h-5 w-5 text-primary" />
                <div className="w-16 h-0.5 bg-primary/50" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Destino</p>
                <p className="text-2xl font-bold text-foreground">
                  {formData.destinationAirport}
                </p>
              </div>
            </div>

            {/* Calculated Values Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-card rounded-lg p-4 text-center border border-border">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ArrowRight className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Distância</span>
                </div>
                <p className="text-2xl font-bold text-emerald-500 font-mono">
                  {calculatedData.distanceNM}
                </p>
                <p className="text-xs text-muted-foreground">NM</p>
              </div>

              <div className="bg-card rounded-lg p-4 text-center border border-border">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Compass className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Proa Mag.</span>
                </div>
                <p className="text-2xl font-bold text-amber-500 font-mono">
                  {calculatedData.magneticHeading}°
                </p>
                <p className="text-xs text-muted-foreground">Magnética</p>
              </div>

              <div className="bg-card rounded-lg p-4 text-center border border-border">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Navigation className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Rumo Verd.</span>
                </div>
                <p className="text-2xl font-bold text-purple-500 font-mono">
                  {calculatedData.trueHeading}°
                </p>
                <p className="text-xs text-muted-foreground">Verdadeiro</p>
              </div>

              <div className="bg-card rounded-lg p-4 text-center border border-border">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Tempo Est.</span>
                </div>
                <p className="text-2xl font-bold text-blue-500 font-mono">
                  {formatTime(calculatedData.estimatedTimeMinutes)}
                </p>
                <p className="text-xs text-muted-foreground">Estimado</p>
              </div>

              <div className="bg-card rounded-lg p-4 text-center border border-border">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Plane className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Altitude</span>
                </div>
                <p className="text-2xl font-bold text-primary font-mono">
                  {calculatedData.suggestedAltitude}
                </p>
                <p className="text-xs text-muted-foreground">Sugerida</p>
              </div>

              <div className="bg-card rounded-lg p-4 text-center border border-border">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Fuel className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Autonomia Mín.</span>
                </div>
                <p className="text-lg font-bold text-red-500 font-mono truncate">
                  {calculatedData.suggestedEndurance}
                </p>
                <p className="text-xs text-muted-foreground">HHMM</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              * Valores calculados automaticamente. A altitude e autonomia podem ser
              ajustados nos próximos passos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* View on Map Button */}
      {calculatedData && onViewMap && (
        <div className="flex gap-4">
          <button
            onClick={() => onViewMap(formData)}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground h-12 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <MapPin className="h-5 w-5" />
            Ver no Mapa
          </button>
        </div>
      )}
    </div>
  );
}
