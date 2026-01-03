import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { Badge } from "@/components/ui/badge";
import { 
  Plane, FileText, MapPin, Navigation, Clock, Fuel, Compass, 
  ArrowRight, Calculator, Info, Gauge
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateDistance, calculateMagneticHeading } from "@/lib/aviation";
import { 
  getSuggestedSpeedCode, 
  getSuggestedSpeed,
  getSuggestedAltitude, 
  calculateMinimumEndurance 
} from "@/lib/aircraft-speeds";
import type { FlightPlanData } from "../FlightPlanWizard";

interface Step1Props {
  formData: FlightPlanData;
  updateFormData: (data: Partial<FlightPlanData>) => void;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  manufacturer: string;
}

interface Aerodrome {
  id: string;
  designativo: string;
  name: string;
  coordenadas: string | null;
}

const FLIGHT_RULES = [
  { value: "I", label: "I - IFR" },
  { value: "V", label: "V - VFR" },
  { value: "Y", label: "Y - IFR primeiro, depois VFR" },
  { value: "Z", label: "Z - VFR primeiro, depois IFR" },
];

export function Step1AircraftInfo({ formData, updateFormData }: Step1Props) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [aerodromes, setAerodromes] = useState<Aerodrome[]>([]);
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
        supabase.from("aircraft").select("id, registration, model, manufacturer").eq("status", "Ativa"),
        supabase.from("aerodromes").select("*").order("designativo"),
      ]);

      if (aircraftRes.data) setAircraft(aircraftRes.data);
      if (aerodromesRes.data) setAerodromes(aerodromesRes.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const parseCoordinates = (coordStr: string | null): { lat: number; lon: number } | null => {
    if (!coordStr) return null;
    const match = coordStr.match(/([NS])(\d+)°(\d+)'(\d+)"?\s*([EW])(\d+)°(\d+)'(\d+)"?/i);
    if (match) {
      const lat = (parseInt(match[2]) + parseInt(match[3]) / 60 + parseInt(match[4]) / 3600) * (match[1].toUpperCase() === 'S' ? -1 : 1);
      const lon = (parseInt(match[6]) + parseInt(match[7]) / 60 + parseInt(match[8]) / 3600) * (match[5].toUpperCase() === 'W' ? -1 : 1);
      return { lat, lon };
    }
    const decimalMatch = coordStr.match(/([-\d.]+),?\s*([-\d.]+)/);
    if (decimalMatch) {
      return { lat: parseFloat(decimalMatch[1]), lon: parseFloat(decimalMatch[2]) };
    }
    return null;
  };

  const calculateRoute = useCallback(() => {
    if (!formData.departureAirport || !formData.destinationAirport || !formData.cruiseSpeed) {
      setCalculatedData(null);
      return;
    }

    const depAerodrome = aerodromes.find((a) => a.designativo === formData.departureAirport);
    const arrAerodrome = aerodromes.find((a) => a.designativo === formData.destinationAirport);

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

    const distanceNM = calculateDistance(depCoords.lat, depCoords.lon, arrCoords.lat, arrCoords.lon);
    const magneticHeading = calculateMagneticHeading(depCoords.lat, depCoords.lon, arrCoords.lat, arrCoords.lon);
    
    // True heading = magnetic heading + magnetic variation (for Brazil ~-20°)
    const trueHeading = (magneticHeading + 20 + 360) % 360;
    
    // Extract speed from format like "N0150" or just "150"
    const speedMatch = formData.cruiseSpeed.match(/(\d+)/);
    const cruiseSpeed = speedMatch ? parseInt(speedMatch[1]) : 150;
    
    const estimatedTimeMinutes = (distanceNM / cruiseSpeed) * 60;
    
    const isIFR = formData.flightRules === 'I' || formData.flightRules === 'Y';
    const suggestedAltitude = getSuggestedAltitude(distanceNM, magneticHeading, isIFR);
    const suggestedEndurance = calculateMinimumEndurance(estimatedTimeMinutes, isIFR);

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
      estimatedTime: `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`,
      cruiseAltitude: suggestedAltitude,
      fuelEndurance: suggestedEndurance,
    });
  }, [formData.departureAirport, formData.destinationAirport, formData.cruiseSpeed, formData.flightRules, aerodromes, updateFormData]);

  useEffect(() => {
    if (aerodromes.length > 0 && formData.departureAirport && formData.destinationAirport) {
      calculateRoute();
    }
  }, [formData.departureAirport, formData.destinationAirport, formData.cruiseSpeed, formData.flightRules, aerodromes.length, calculateRoute]);

  const handleAircraftChange = (aircraftId: string) => {
    const selected = aircraft.find((a) => a.id === aircraftId);
    if (selected) {
      const speedCode = getSuggestedSpeedCode(selected.registration);
      updateFormData({
        aircraftId: selected.id,
        aircraftRegistration: selected.registration,
        aircraftType: selected.model,
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
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Plane className="h-5 w-5 text-cyan-400" />
            </div>
            1. Selecione a Aeronave
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Aeronave *</Label>
              <Select value={formData.aircraftId} onValueChange={handleAircraftChange}>
                <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                  <SelectValue placeholder="Selecione a aeronave" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {aircraft.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-white">
                      {a.registration} - {a.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Tipo de Aeronave</Label>
              <Input
                value={formData.aircraftType}
                readOnly
                className="bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Velocidade de Cruzeiro
              </Label>
              <Input
                value={formData.cruiseSpeed}
                onChange={(e) => updateFormData({ cruiseSpeed: e.target.value.toUpperCase() })}
                placeholder="N0150"
                className="bg-slate-900/50 border-slate-600 text-white font-mono"
              />
              {formData.aircraftRegistration && (
                <p className="text-xs text-cyan-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Velocidade sugerida para {formData.aircraftRegistration}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Flight Rules */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <FileText className="h-5 w-5 text-blue-400" />
            </div>
            2. Regra de Voo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="max-w-xs">
            <Label className="text-slate-300">Regras de Voo *</Label>
            <Select
              value={formData.flightRules}
              onValueChange={(value) => updateFormData({ flightRules: value })}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white mt-2">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {FLIGHT_RULES.map((rule) => (
                  <SelectItem key={rule.value} value={rule.value} className="text-white">
                    {rule.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Origin, Destination, Alternate */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="border-b border-slate-700/50">
          <CardTitle className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <MapPin className="h-5 w-5 text-emerald-400" />
            </div>
            3. Origem, Destino e Alternativa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Origem (ICAO) *</Label>
              <AutocompleteInput
                value={formData.departureAirport}
                onChange={(value) => updateFormData({ departureAirport: value.toUpperCase() })}
                options={aerodromes.map(a => ({
                  id: a.id,
                  label: `${a.designativo} - ${a.name}`
                }))}
                placeholder="Ex: SBGR"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Destino (ICAO) *</Label>
              <AutocompleteInput
                value={formData.destinationAirport}
                onChange={(value) => updateFormData({ destinationAirport: value.toUpperCase() })}
                options={aerodromes.map(a => ({
                  id: a.id,
                  label: `${a.designativo} - ${a.name}`
                }))}
                placeholder="Ex: SBRJ"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Alternativa (ICAO)</Label>
              <AutocompleteInput
                value={formData.alternateAirport}
                onChange={(value) => updateFormData({ alternateAirport: value.toUpperCase() })}
                options={aerodromes.map(a => ({
                  id: a.id,
                  label: `${a.designativo} - ${a.name}`
                }))}
                placeholder="Ex: SBSP"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculated Results - Only shown after origin and destination are set */}
      {calculatedData && (
        <Card className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
          <CardHeader className="border-b border-cyan-500/30">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Calculator className="h-5 w-5 text-cyan-400" />
              </div>
              Dados Calculados
              <Badge variant="outline" className="ml-auto border-cyan-500 text-cyan-400">
                Atualizado automaticamente
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {/* Route Header */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-cyan-500/20">
                  <MapPin className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-cyan-300">Origem</p>
                  <p className="text-2xl font-bold text-white">{formData.departureAirport}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-0.5 bg-cyan-500/50" />
                <Navigation className="h-5 w-5 text-cyan-400" />
                <div className="w-16 h-0.5 bg-cyan-500/50" />
              </div>
              <div>
                <p className="text-sm text-cyan-300">Destino</p>
                <p className="text-2xl font-bold text-white">{formData.destinationAirport}</p>
              </div>
            </div>

            {/* Calculated Values Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <ArrowRight className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-slate-400">Distância</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400 font-mono">{calculatedData.distanceNM}</p>
                <p className="text-xs text-slate-500">NM</p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Compass className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-slate-400">Proa Mag.</span>
                </div>
                <p className="text-2xl font-bold text-amber-400 font-mono">{calculatedData.magneticHeading}°</p>
                <p className="text-xs text-slate-500">Magnética</p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Navigation className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-slate-400">Rumo Verd.</span>
                </div>
                <p className="text-2xl font-bold text-purple-400 font-mono">{calculatedData.trueHeading}°</p>
                <p className="text-xs text-slate-500">Verdadeiro</p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-slate-400">Tempo Est.</span>
                </div>
                <p className="text-2xl font-bold text-blue-400 font-mono">
                  {formatTime(calculatedData.estimatedTimeMinutes)}
                </p>
                <p className="text-xs text-slate-500">Estimado</p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Plane className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs text-slate-400">Altitude</span>
                </div>
                <p className="text-2xl font-bold text-cyan-400 font-mono">{calculatedData.suggestedAltitude}</p>
                <p className="text-xs text-slate-500">Sugerida</p>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Fuel className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-slate-400">Autonomia Mín.</span>
                </div>
                <p className="text-2xl font-bold text-red-400 font-mono">{calculatedData.suggestedEndurance}</p>
                <p className="text-xs text-slate-500">HHMM</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center mt-4">
              * Valores calculados automaticamente. A altitude e autonomia podem ser ajustados nos próximos passos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
