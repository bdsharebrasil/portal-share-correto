import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, User, MapPin, Clock, Navigation, Cloud, FileText, Building2 } from "lucide-react";
import type { FlightPlanData } from "../FlightPlanWizard";

interface Step6Props {
  formData: FlightPlanData;
}

export function Step6Summary({ formData }: Step6Props) {
  const formatTime = (time: string) => {
    if (!time || time.length !== 4) return time;
    return `${time.slice(0, 2)}:${time.slice(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Flight Plan Header */}
      <Card className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwNjY5OTIwIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
        <CardContent className="p-8 relative">
          <div className="text-center mb-6">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-lg px-4 py-1 mb-4">
              PLANO DE VOO
            </Badge>
            <h1 className="text-3xl font-bold text-white">
              {formData.departureAirport} → {formData.destinationAirport}
            </h1>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4 text-center">
              <Plane className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Aeronave</p>
              <p className="text-lg font-bold text-white">{formData.aircraftRegistration}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 text-center">
              <Clock className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-xs text-slate-400">EOBT</p>
              <p className="text-lg font-bold text-white">{formatTime(formData.departureTime)} UTC</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 text-center">
              <Navigation className="h-6 w-6 text-amber-400 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Duração Est.</p>
              <p className="text-lg font-bold text-white">{formatTime(formData.estimatedTime)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 text-center">
              <MapPin className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-slate-400">Alternativo</p>
              <p className="text-lg font-bold text-white">{formData.alternateAirport || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aircraft & Crew */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <Plane className="h-5 w-5 text-cyan-400" />
              Aeronave e Tripulação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Identificação</span>
                <span className="text-white font-mono">{formData.aircraftRegistration}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Tipo</span>
                <span className="text-white font-mono">{formData.aircraftType}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Piloto em Comando</span>
                <span className="text-white">{formData.pilotInCommand}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Cliente</span>
                <span className="text-white">{formData.clientName || "N/A"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Flight Rules */}
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <FileText className="h-5 w-5 text-blue-400" />
              Regras de Voo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Regras de Voo</span>
                <Badge className="bg-cyan-500/20 text-cyan-400">{formData.flightRules}</Badge>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Tipo de Voo</span>
                <Badge className="bg-blue-500/20 text-blue-400">{formData.flightType}</Badge>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Categoria de Esteira</span>
                <span className="text-white">{formData.wakeCategory}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Equipamento</span>
                <span className="text-white font-mono">{formData.equipment}/{formData.transponder}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Route */}
        <Card className="bg-slate-800/50 border-slate-700/50 lg:col-span-2">
          <CardHeader className="border-b border-slate-700/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <Navigation className="h-5 w-5 text-purple-400" />
              Rota
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Velocidade</p>
                <p className="text-white font-mono">{formData.cruiseSpeed}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Nível</p>
                <p className="text-white font-mono">{formData.cruiseAltitude}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Autonomia</p>
                <p className="text-white font-mono">{formatTime(formData.fuelEndurance)}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-400">Nº Aeronaves</p>
                <p className="text-white font-mono">{formData.numberOfAircraft}</p>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-2">Rota Completa</p>
              <p className="text-white font-mono">{formData.route || "DCT"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Weather Summary */}
        {(formData.departureMetar || formData.destinationMetar) && (
          <Card className="bg-slate-800/50 border-slate-700/50 lg:col-span-2">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="flex items-center gap-2 text-white">
                <Cloud className="h-5 w-5 text-amber-400" />
                Meteorologia
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <p className="text-xs text-cyan-400 mb-2">METAR {formData.departureAirport}</p>
                  <code className="text-sm text-white font-mono">{formData.departureMetar || "N/A"}</code>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <p className="text-xs text-amber-400 mb-2">METAR {formData.destinationAirport}</p>
                  <code className="text-sm text-white font-mono">{formData.destinationMetar || "N/A"}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
