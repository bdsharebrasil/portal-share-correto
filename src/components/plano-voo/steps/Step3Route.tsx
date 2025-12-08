import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Navigation, Clock, Fuel, Calculator, ArrowRight } from "lucide-react";
import { calculateDistance, calculateMagneticHeading } from "@/lib/aviation";
import { supabase } from "@/integrations/supabase/client";
import type { FlightPlanData } from "../FlightPlanWizard";

interface Step3Props {
  formData: FlightPlanData;
  updateFormData: (data: Partial<FlightPlanData>) => void;
}

interface Aerodrome {
  id: string;
  designativo: string;
  name: string;
  coordenadas: string | null;
}

interface RouteSegment {
  from: string;
  to: string;
  distance: number;
  heading: number;
  time: number;
}

export function Step3Route({ formData, updateFormData }: Step3Props) {
  const [aerodromes, setAerodromes] = useState<Aerodrome[]>([]);
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);

  useEffect(() => {
    fetchAerodromes();
  }, []);

  const fetchAerodromes = async () => {
    const { data } = await supabase.from("aerodromes").select("*").order("designativo");
    if (data) setAerodromes(data);
  };

  const parseCoordinates = (coordStr: string | null): { lat: number; lon: number } | null => {
    if (!coordStr) return null;
    // Expected format: "S22°54'23" W43°10'21"" or decimal
    const match = coordStr.match(/([NS])(\d+)°(\d+)'(\d+)"?\s*([EW])(\d+)°(\d+)'(\d+)"?/i);
    if (match) {
      const lat = (parseInt(match[2]) + parseInt(match[3]) / 60 + parseInt(match[4]) / 3600) * (match[1].toUpperCase() === 'S' ? -1 : 1);
      const lon = (parseInt(match[6]) + parseInt(match[7]) / 60 + parseInt(match[8]) / 3600) * (match[5].toUpperCase() === 'W' ? -1 : 1);
      return { lat, lon };
    }
    // Try decimal format
    const decimalMatch = coordStr.match(/([-\d.]+),?\s*([-\d.]+)/);
    if (decimalMatch) {
      return { lat: parseFloat(decimalMatch[1]), lon: parseFloat(decimalMatch[2]) };
    }
    return null;
  };

  const calculateRoute = () => {
    const depAerodrome = aerodromes.find((a) => a.designativo === formData.departureAirport);
    const arrAerodrome = aerodromes.find((a) => a.designativo === formData.destinationAirport);

    if (!depAerodrome || !arrAerodrome) return;

    const depCoords = parseCoordinates(depAerodrome.coordenadas);
    const arrCoords = parseCoordinates(arrAerodrome.coordenadas);

    if (!depCoords || !arrCoords) return;

    const distance = calculateDistance(depCoords.lat, depCoords.lon, arrCoords.lat, arrCoords.lon);
    const heading = calculateMagneticHeading(depCoords.lat, depCoords.lon, arrCoords.lat, arrCoords.lon);

    // Assuming cruise speed of 250 kts
    const timeMinutes = (distance / 250) * 60;
    const hours = Math.floor(timeMinutes / 60);
    const minutes = Math.round(timeMinutes % 60);

    setRouteSegments([{
      from: formData.departureAirport,
      to: formData.destinationAirport,
      distance: Math.round(distance),
      heading,
      time: Math.round(timeMinutes),
    }]);

    setTotalDistance(Math.round(distance));
    updateFormData({
      estimatedTime: `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Route Header */}
      <Card className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-cyan-500/20">
                  <MapPin className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-cyan-300">Origem</p>
                  <p className="text-2xl font-bold text-white">{formData.departureAirport || "----"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-0.5 bg-cyan-500/50" />
                <Navigation className="h-5 w-5 text-cyan-400" />
                <div className="w-16 h-0.5 bg-cyan-500/50" />
              </div>
              <div>
                <p className="text-sm text-cyan-300">Destino</p>
                <p className="text-2xl font-bold text-white">{formData.destinationAirport || "----"}</p>
              </div>
            </div>
            {totalDistance > 0 && (
              <div className="text-right">
                <p className="text-sm text-cyan-300">Distância Total</p>
                <p className="text-2xl font-bold text-cyan-400">{totalDistance} NM</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departure Section */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <MapPin className="h-5 w-5 text-emerald-400" />
              </div>
              13 - Aeródromo de Partida e Hora
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Aeródromo de Partida *</Label>
                <Input
                  value={formData.departureAirport}
                  onChange={(e) => updateFormData({ departureAirport: e.target.value.toUpperCase() })}
                  placeholder="Ex: SBGR"
                  maxLength={4}
                  className="bg-slate-900/50 border-slate-600 text-white uppercase text-lg font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Hora EOBT (UTC) *</Label>
                <Input
                  value={formData.departureTime}
                  onChange={(e) => updateFormData({ departureTime: e.target.value })}
                  placeholder="Ex: 1430"
                  maxLength={4}
                  className="bg-slate-900/50 border-slate-600 text-white text-lg font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cruise Section */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Navigation className="h-5 w-5 text-blue-400" />
              </div>
              15 - Velocidade e Nível de Cruzeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Velocidade de Cruzeiro</Label>
                <Input
                  value={formData.cruiseSpeed}
                  onChange={(e) => updateFormData({ cruiseSpeed: e.target.value })}
                  placeholder="Ex: N0250"
                  className="bg-slate-900/50 border-slate-600 text-white font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Nível de Cruzeiro</Label>
                <Input
                  value={formData.cruiseAltitude}
                  onChange={(e) => updateFormData({ cruiseAltitude: e.target.value })}
                  placeholder="Ex: A085 ou F350"
                  className="bg-slate-900/50 border-slate-600 text-white font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route Section */}
        <Card className="bg-slate-800/50 border-slate-700/50 lg:col-span-2">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <ArrowRight className="h-5 w-5 text-purple-400" />
              </div>
              15 - Rota
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Textarea
              value={formData.route}
              onChange={(e) => updateFormData({ route: e.target.value.toUpperCase() })}
              placeholder="Ex: DCT ALPHA UZ1 BRAVO DCT"
              className="bg-slate-900/50 border-slate-600 text-white font-mono min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* Destination Section */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <MapPin className="h-5 w-5 text-amber-400" />
              </div>
              16 - Aeródromo de Destino e Duração
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Aeródromo de Destino *</Label>
                <Input
                  value={formData.destinationAirport}
                  onChange={(e) => updateFormData({ destinationAirport: e.target.value.toUpperCase() })}
                  placeholder="Ex: SBRJ"
                  maxLength={4}
                  className="bg-slate-900/50 border-slate-600 text-white uppercase text-lg font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Duração Total Estimada</Label>
                <Input
                  value={formData.estimatedTime}
                  onChange={(e) => updateFormData({ estimatedTime: e.target.value })}
                  placeholder="Ex: 0130"
                  maxLength={4}
                  className="bg-slate-900/50 border-slate-600 text-white text-lg font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Aeródromo Alternativo</Label>
              <Input
                value={formData.alternateAirport}
                onChange={(e) => updateFormData({ alternateAirport: e.target.value.toUpperCase() })}
                placeholder="Ex: SBSP"
                maxLength={4}
                className="bg-slate-900/50 border-slate-600 text-white uppercase font-mono"
              />
            </div>
          </CardContent>
        </Card>

        {/* Fuel & Calculate Section */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Fuel className="h-5 w-5 text-red-400" />
              </div>
              19 - Autonomia de Combustível
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Autonomia (HHMM)</Label>
              <Input
                value={formData.fuelEndurance}
                onChange={(e) => updateFormData({ fuelEndurance: e.target.value })}
                placeholder="Ex: 0400"
                maxLength={4}
                className="bg-slate-900/50 border-slate-600 text-white font-mono"
              />
            </div>
            <Button
              onClick={calculateRoute}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calcular Rota
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Route Segments */}
      {routeSegments.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="text-white">Segmentos da Rota</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 text-cyan-400">De</th>
                    <th className="text-left py-2 text-cyan-400">Para</th>
                    <th className="text-left py-2 text-cyan-400">Distância (NM)</th>
                    <th className="text-left py-2 text-cyan-400">Rumo (°)</th>
                    <th className="text-left py-2 text-cyan-400">Tempo (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {routeSegments.map((seg, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="py-3 text-white font-mono">{seg.from}</td>
                      <td className="py-3 text-white font-mono">{seg.to}</td>
                      <td className="py-3 text-emerald-400 font-mono">{seg.distance}</td>
                      <td className="py-3 text-amber-400 font-mono">{seg.heading}°</td>
                      <td className="py-3 text-blue-400 font-mono">{seg.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
