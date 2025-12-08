import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cloud, RefreshCw, Sun, CloudRain, Wind, Thermometer, Eye, AlertTriangle } from "lucide-react";
import { fetchMETAR, fetchTAF } from "@/lib/aviation";
import { toast } from "sonner";
import type { FlightPlanData } from "../FlightPlanWizard";

interface Step4Props {
  formData: FlightPlanData;
  updateFormData: (data: Partial<FlightPlanData>) => void;
}

interface WeatherData {
  metar: string;
  taf: string;
  conditions: string;
}

export function Step4Weather({ formData, updateFormData }: Step4Props) {
  const [loading, setLoading] = useState(false);
  const [departureWeather, setDepartureWeather] = useState<WeatherData | null>(null);
  const [destinationWeather, setDestinationWeather] = useState<WeatherData | null>(null);
  const [alternateWeather, setAlternateWeather] = useState<WeatherData | null>(null);

  const fetchWeather = async () => {
    if (!formData.departureAirport || !formData.destinationAirport) {
      toast.error("Informe os aeródromos de partida e destino");
      return;
    }

    setLoading(true);
    try {
      const airports = [formData.departureAirport, formData.destinationAirport];
      if (formData.alternateAirport) {
        airports.push(formData.alternateAirport);
      }

      const results = await Promise.all(
        airports.map(async (icao) => {
          const [metar, taf] = await Promise.all([fetchMETAR(icao), fetchTAF(icao)]);
          return {
            icao,
            metar: metar?.[0]?.rawOb || "Não disponível",
            taf: taf?.[0]?.rawTAF || "Não disponível",
            conditions: parseConditions(metar?.[0]),
          };
        })
      );

      setDepartureWeather({
        metar: results[0].metar,
        taf: results[0].taf,
        conditions: results[0].conditions,
      });
      updateFormData({
        departureMetar: results[0].metar,
        departureTaf: results[0].taf,
      });

      setDestinationWeather({
        metar: results[1].metar,
        taf: results[1].taf,
        conditions: results[1].conditions,
      });
      updateFormData({
        destinationMetar: results[1].metar,
        destinationTaf: results[1].taf,
      });

      if (results[2]) {
        setAlternateWeather({
          metar: results[2].metar,
          taf: results[2].taf,
          conditions: results[2].conditions,
        });
      }

      toast.success("Dados meteorológicos atualizados");
    } catch (error) {
      toast.error("Erro ao buscar dados meteorológicos");
    } finally {
      setLoading(false);
    }
  };

  const parseConditions = (metar: any): string => {
    if (!metar) return "UNKNOWN";
    // Simple condition parsing
    const raw = metar.rawOb || "";
    if (raw.includes("CAVOK") || raw.includes("SKC") || raw.includes("CLR")) return "VMC";
    if (raw.includes("BKN") || raw.includes("OVC")) return "IMC";
    if (raw.includes("RA") || raw.includes("SH") || raw.includes("TS")) return "IMC";
    return "MVFR";
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case "VMC":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">VMC</Badge>;
      case "MVFR":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">MVFR</Badge>;
      case "IMC":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">IMC</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">N/A</Badge>;
    }
  };

  const WeatherCard = ({
    title,
    icao,
    weather,
    icon: Icon,
    color,
  }: {
    title: string;
    icao: string;
    weather: WeatherData | null;
    icon: any;
    color: string;
  }) => (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader className="border-b border-slate-700/50">
        <CardTitle className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            {title}
            <span className="text-cyan-400 font-mono">{icao}</span>
          </div>
          {weather && getConditionBadge(weather.conditions)}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {weather ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-cyan-400">
                <Cloud className="h-4 w-4" />
                METAR
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg">
                <code className="text-sm text-white font-mono break-all">{weather.metar}</code>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Wind className="h-4 w-4" />
                TAF
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg max-h-32 overflow-y-auto">
                <code className="text-sm text-white font-mono break-all whitespace-pre-wrap">{weather.taf}</code>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Cloud className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Clique em "Consultar Meteorologia" para obter os dados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Consulta Meteorológica</h2>
          <p className="text-slate-400 text-sm mt-1">METAR e TAF dos aeródromos da rota</p>
        </div>
        <Button
          onClick={fetchWeather}
          disabled={loading}
          className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4 mr-2" />
          )}
          Consultar Meteorologia
        </Button>
      </div>

      {/* Weather Alert */}
      {(departureWeather?.conditions === "IMC" || destinationWeather?.conditions === "IMC") && (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <div>
                <p className="font-semibold text-red-400">Atenção: Condições IMC</p>
                <p className="text-sm text-red-300/80">
                  Um ou mais aeródromos apresentam condições meteorológicas por instrumentos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weather Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeatherCard
          title="Partida"
          icao={formData.departureAirport || "----"}
          weather={departureWeather}
          icon={Sun}
          color="bg-emerald-500/20 text-emerald-400"
        />
        <WeatherCard
          title="Destino"
          icao={formData.destinationAirport || "----"}
          weather={destinationWeather}
          icon={CloudRain}
          color="bg-amber-500/20 text-amber-400"
        />
      </div>

      {formData.alternateAirport && (
        <WeatherCard
          title="Alternativo"
          icao={formData.alternateAirport}
          weather={alternateWeather}
          icon={Cloud}
          color="bg-blue-500/20 text-blue-400"
        />
      )}

      {/* Legend */}
      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <span className="text-slate-400">Legenda:</span>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">VMC</Badge>
              <span className="text-slate-400">Visual Met. Conditions</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">MVFR</Badge>
              <span className="text-slate-400">Marginal VFR</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">IMC</Badge>
              <span className="text-slate-400">Instrument Met. Conditions</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
