import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Cloud } from "lucide-react";
import { DetailedWeatherPanel } from "../DetailedWeatherPanel";
import { useAviationWeather } from "@/hooks/useAviationWeather";
import type { FlightPlanData } from "../FlightPlanWizard";

interface Step4Props {
  formData: FlightPlanData;
  updateFormData: (data: Partial<FlightPlanData>) => void;
}

export function Step4Weather({ formData }: Step4Props) {
  const { metar: departureMetar } = useAviationWeather(formData.departureAirport);
  const { metar: destinationMetar } = useAviationWeather(formData.destinationAirport);
  const { metar: alternateMetar } = useAviationWeather(formData.alternateAirport);

  const isIMC = (metar: any) => {
    if (!metar) return false;
    const vis = metar.visib || 10;
    const ceiling = 3000; // Simplified assumption
    return vis < 3 || ceiling < 1000;
  };

  const hasIMCConditions = isIMC(departureMetar) || isIMC(destinationMetar) || isIMC(alternateMetar);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-white">Consulta Meteorológica</h2>
        <p className="text-slate-400 text-sm mt-1">
          Informações em tempo real dos aeródromos da rota. Os dados atualizam a cada 10 minutos automaticamente.
        </p>
      </div>

      {/* Weather Alert */}
      {hasIMCConditions && (
        <Card className="bg-red-900/20 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-400">⚠️ Atenção: Condições IMC Detectadas</p>
                <p className="text-sm text-red-300/80 mt-1">
                  Um ou mais aeródromos apresentam condições meteorológicas por instrumentos. Verifique os dados detalhados antes de decolar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weather Panels */}
      <div className="space-y-4">
        {formData.departureAirport ? (
          <DetailedWeatherPanel
            icao={formData.departureAirport}
            label="Aeródromo de Partida"
          />
        ) : (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-8 text-center text-slate-400">
              <Cloud className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Selecione um aeródromo de partida para ver os dados meteorológicos</p>
            </CardContent>
          </Card>
        )}

        {formData.destinationAirport ? (
          <DetailedWeatherPanel
            icao={formData.destinationAirport}
            label="Aeródromo de Destino"
          />
        ) : (
          <Card className="bg-slate-800/50 border-slate-700/50">
            <CardContent className="p-8 text-center text-slate-400">
              <Cloud className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Selecione um aeródromo de destino para ver os dados meteorológicos</p>
            </CardContent>
          </Card>
        )}

        {formData.alternateAirport && (
          <DetailedWeatherPanel
            icao={formData.alternateAirport}
            label="Aeródromo Alternativo"
          />
        )}
      </div>

      {/* Info Box */}
      <Card className="bg-slate-800/30 border-slate-700/50">
        <CardContent className="p-4">
          <p className="text-xs text-slate-400 uppercase font-semibold mb-3">ℹ️ Informações</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              <span className="font-semibold">Categoria de Voo:</span> VFR (Condições Visuais), MVFR (VFR Marginal), IFR (Voo por Instrumentos), LIFR (IFR Baixo)
            </li>
            <li>
              <span className="font-semibold">Unidades:</span> Temperatura em °C, Vento em nós (kt), Visibilidade em Statute Miles (SM), Altímetro em polegadas de mercúrio (inHg)
            </li>
            <li>
              <span className="font-semibold">Atualizações:</span> Os dados de METAR são fornecidos pela AviationWeather.gov e atualizam automaticamente a cada 10 minutos.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
