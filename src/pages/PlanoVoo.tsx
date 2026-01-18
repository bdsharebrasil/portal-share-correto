import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plane, MapPin, Clock, Fuel, Wind, Calendar,
  AlertTriangle, CheckCircle, FileText, Download,
  Save, Calculator, Navigation, Route,
  CloudRain, RefreshCw, Loader2
} from 'lucide-react';
import { InlineLottieSpinner } from '@/components/ui/inline-lottie-spinner';
import { useAerodromes, type Aerodromo } from '@/hooks/useAerodromes';
import { useAeronaves, type Aeronave } from '@/hooks/useAeronaves';
import { useAviationWeather, getFlightCategoryColor, getFlightCategoryBg, formatWind, formatVisibility, type AirportWeather } from '@/hooks/useAviationWeather';
import { calculateDistance, calculateMagneticHeading } from '@/lib/aviation';
import { FlightRouteMap, type RoutePoint } from '@/components/plano-voo/FlightRouteMap';
import { toast } from 'sonner';

interface FlightFormData {
  origin: string;
  destination: string;
  alternate: string;
  aircraftId: string;
  registration: string;
  flightRule: 'V' | 'I' | 'Y' | 'Z';
  cruiseAlt: string;
  cruiseSpeed: string;
  departure: string;
  passengers: number;
  route: string;
}

interface FlightCalculations {
  distance: number;
  bearing: number;
  time: number;
  ete: string;
  fuelRequired: number;
  fuelReserve: number;
  totalFuel: number;
  suggestedAlt: string;
}

// Parse coordenadas do banco de dados
function parseCoordinates(coordStr: string | null): { lat: number; lng: number } | null {
  if (!coordStr) return null;

  // Formato decimal: "-23.5505,-46.6333"
  if (coordStr.includes(',') && !coordStr.includes(' ')) {
    const [lat, lng] = coordStr.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // Formato DMS: "42 47 34.95 W 4 57 33.97 S"
  const dmsRegex = /(\d+)\s+(\d+)\s+([\d.]+)\s*([NSEW])\s+(\d+)\s+(\d+)\s+([\d.]+)\s*([NSEW])/i;
  const match = coordStr.match(dmsRegex);
  if (match) {
    let lng = parseInt(match[1]) + parseInt(match[2]) / 60 + parseFloat(match[3]) / 3600;
    let lat = parseInt(match[5]) + parseInt(match[6]) / 60 + parseFloat(match[7]) / 3600;

    if (match[4].toUpperCase() === 'W') lng = -lng;
    if (match[8].toUpperCase() === 'S') lat = -lat;

    return { lat, lng };
  }

  return null;
}

export default function PlanoVooPage() {
  const [activeTab, setActiveTab] = useState('planejar');
  const [formData, setFormData] = useState<FlightFormData>({
    origin: '',
    destination: '',
    alternate: '',
    aircraftId: '',
    registration: '',
    flightRule: 'V',
    cruiseAlt: '',
    cruiseSpeed: '',
    departure: '',
    passengers: 1,
    route: ''
  });

  const [calculations, setCalculations] = useState<FlightCalculations | null>(null);
  const [originWeather, setOriginWeather] = useState<AirportWeather | null>(null);
  const [destWeather, setDestWeather] = useState<AirportWeather | null>(null);
  const [savedPlans, setSavedPlans] = useState<Array<{ id: number; date: string; formData: FlightFormData; calculations: FlightCalculations }>>([]);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  const { aerodromes, isLoadingAerodromes } = useAerodromes();
  const { aeronaves, isLoadingAeronaves } = useAeronaves();
  const { getWeather } = useAviationWeather();

  // Carregar planos salvos do localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('flightPlansV2') || '[]');
    setSavedPlans(saved);
  }, []);

  // Obter aeródromo por designativo
  const getAerodromeByCode = useCallback((code: string): Aerodromo | undefined => {
    return aerodromes.find(a => a.designativo === code);
  }, [aerodromes]);

  // Obter aeronave por ID
  const getAircraftById = useCallback((id: string): Aeronave | undefined => {
    return aeronaves.find(a => a.id === id);
  }, [aeronaves]);

  // Pontos para o mapa
  const routePoints = useMemo((): RoutePoint[] => {
    const points: RoutePoint[] = [];

    const originAerodrome = getAerodromeByCode(formData.origin);
    if (originAerodrome) {
      const coords = parseCoordinates(originAerodrome.coordenadas);
      if (coords) {
        points.push({
          icao: originAerodrome.designativo,
          name: originAerodrome.name,
          lat: coords.lat,
          lng: coords.lng,
          type: 'departure'
        });
      }
    }

    const destAerodrome = getAerodromeByCode(formData.destination);
    if (destAerodrome) {
      const coords = parseCoordinates(destAerodrome.coordenadas);
      if (coords) {
        points.push({
          icao: destAerodrome.designativo,
          name: destAerodrome.name,
          lat: coords.lat,
          lng: coords.lng,
          type: 'arrival'
        });
      }
    }

    const altAerodrome = getAerodromeByCode(formData.alternate);
    if (altAerodrome) {
      const coords = parseCoordinates(altAerodrome.coordenadas);
      if (coords) {
        points.push({
          icao: altAerodrome.designativo,
          name: altAerodrome.name,
          lat: coords.lat,
          lng: coords.lng,
          type: 'alternate'
        });
      }
    }

    return points;
  }, [formData.origin, formData.destination, formData.alternate, getAerodromeByCode]);

  // Calcular plano de voo
  const calculateFlightPlan = useCallback(() => {
    const originAerodrome = getAerodromeByCode(formData.origin);
    const destAerodrome = getAerodromeByCode(formData.destination);
    const aircraft = getAircraftById(formData.aircraftId);

    if (!originAerodrome || !destAerodrome) {
      toast.error('Selecione origem e destino');
      return;
    }

    const originCoords = parseCoordinates(originAerodrome.coordenadas);
    const destCoords = parseCoordinates(destAerodrome.coordenadas);

    if (!originCoords || !destCoords) {
      toast.error('Coordenadas não disponíveis para os aeródromos selecionados');
      return;
    }

    const distance = calculateDistance(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng);
    const bearing = calculateMagneticHeading(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng);

    // Velocidade de cruzeiro - usar do formulário ou da aeronave ou default
    const cruiseSpeed = formData.cruiseSpeed ? parseInt(formData.cruiseSpeed) : 180;
    const fuelConsumption = aircraft?.fuel_consumption || 50; // L/h default

    const timeHours = distance / cruiseSpeed;
    const fuelRequired = timeHours * fuelConsumption;
    const fuelReserve = fuelRequired * 0.45; // 45% reserva
    const totalFuel = fuelRequired + fuelReserve;

    // Altitude sugerida baseada em regras VFR/IFR
    const isIFR = formData.flightRule === 'I';
    let suggestedAlt: string;
    if (bearing >= 0 && bearing < 180) {
      suggestedAlt = isIFR ? 'FL070' : '5500';
    } else {
      suggestedAlt = isIFR ? 'FL080' : '6500';
    }

    setCalculations({
      distance: Math.round(distance),
      bearing: Math.round(bearing),
      time: timeHours,
      fuelRequired: Math.round(fuelRequired),
      fuelReserve: Math.round(fuelReserve),
      totalFuel: Math.round(totalFuel),
      suggestedAlt,
      ete: `${Math.floor(timeHours)}h ${Math.round((timeHours % 1) * 60)}min`
    });

    setActiveTab('resultados');
    toast.success('Plano de voo calculado');
  }, [formData, getAerodromeByCode, getAircraftById]);

  // Buscar meteorologia
  const fetchWeatherData = useCallback(async () => {
    if (!formData.origin && !formData.destination) {
      toast.error('Selecione origem e/ou destino');
      return;
    }

    setIsLoadingWeather(true);
    try {
      if (formData.origin) {
        const weather = await getWeather(formData.origin);
        setOriginWeather(weather);
      }
      if (formData.destination) {
        const weather = await getWeather(formData.destination);
        setDestWeather(weather);
      }
      toast.success('Dados meteorológicos atualizados');
    } catch (error) {
      console.error('Error fetching weather:', error);
      toast.error('Erro ao buscar meteorologia');
    } finally {
      setIsLoadingWeather(false);
    }
  }, [formData.origin, formData.destination, getWeather]);

  // Salvar plano
  const savePlan = useCallback(() => {
    if (!calculations) {
      toast.error('Calcule o plano primeiro');
      return;
    }

    const plan = {
      id: Date.now(),
      date: new Date().toISOString(),
      formData,
      calculations
    };
    const updated = [...savedPlans, plan];
    setSavedPlans(updated);
    localStorage.setItem('flightPlansV2', JSON.stringify(updated));
    toast.success('Plano de voo salvo!');
  }, [formData, calculations, savedPlans]);

  // Excluir plano
  const deletePlan = useCallback((id: number) => {
    const updated = savedPlans.filter(p => p.id !== id);
    setSavedPlans(updated);
    localStorage.setItem('flightPlansV2', JSON.stringify(updated));
    toast.success('Plano excluído');
  }, [savedPlans]);

  // Atualizar aircraft quando mudar
  const handleAircraftChange = useCallback((aircraftId: string) => {
    const aircraft = aeronaves.find(a => a.id === aircraftId);
    setFormData(prev => ({
      ...prev,
      aircraftId,
      registration: aircraft?.registration || ''
    }));
  }, [aeronaves]);

  // Renderizar componente de weather card
  const renderWeatherCard = (weather: AirportWeather | null, title: string, icao: string) => {
    if (!weather) {
      return (
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CloudRain className="w-5 h-5 text-cyan-400" />
            <h3 className="text-white font-semibold">{icao || title}</h3>
          </div>
          <p className="text-slate-400 text-sm">Clique em "Buscar METAR" para carregar</p>
        </Card>
      );
    }

    if (weather.loading) {
      return (
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="flex items-center gap-2">
            <InlineLottieSpinner size="md" />
            <span className="text-white">Carregando...</span>
          </div>
        </Card>
      );
    }

    if (weather.error && !weather.metar) {
      return (
        <Card className="bg-slate-800/50 border-slate-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-semibold">{icao}</h3>
          </div>
          <p className="text-amber-400 text-sm">{weather.error}</p>
        </Card>
      );
    }

    const metar = weather.metar;
    if (!metar) return null;

    return (
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CloudRain className="w-5 h-5 text-cyan-400" />
            <h3 className="text-white font-semibold">{metar.icaoId}</h3>
          </div>
          <Badge className={`${getFlightCategoryBg(metar.fltcat)} ${getFlightCategoryColor(metar.fltcat)} border`}>
            {metar.fltcat || 'N/A'}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Temperatura:</span>
            <span className="text-white font-mono">{metar.temp !== null ? `${metar.temp}°C` : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Ponto de Orvalho:</span>
            <span className="text-white font-mono">{metar.dewp !== null ? `${metar.dewp}°C` : '--'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Vento:</span>
            <span className="text-white font-mono">{formatWind(metar.wdir, metar.wspd, metar.wgst)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Visibilidade:</span>
            <span className="text-white font-mono">{formatVisibility(metar.visib)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">QNH:</span>
            <span className="text-white font-mono">{metar.altim ? `${metar.altim} hPa` : '--'}</span>
          </div>
        </div>

        {metar.rawOb && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-500 font-mono break-all">{metar.rawOb}</p>
          </div>
        )}

        {weather.taf && weather.taf.rawTAF && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <h4 className="text-xs text-slate-400 mb-1">TAF:</h4>
            <p className="text-xs text-slate-500 font-mono break-all">{weather.taf.rawTAF}</p>
          </div>
        )}
      </Card>
    );
  };

  return (
    <Layout>
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plane className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Plano de Voo</h1>
            </div>
            <p className="text-muted-foreground">
              Planejamento com cálculos automáticos, meteorologia real e mapa interativo
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-surface-dark border border-border-dark">
              <TabsTrigger value="planejar" className="data-[state=active]:bg-primary/20">
                <Calculator className="w-4 h-4 mr-2" />
                Planejar
              </TabsTrigger>
              <TabsTrigger value="resultados" className="data-[state=active]:bg-primary/20">
                <Route className="w-4 h-4 mr-2" />
                Resultados
              </TabsTrigger>
              <TabsTrigger value="meteorologia" className="data-[state=active]:bg-primary/20">
                <CloudRain className="w-4 h-4 mr-2" />
                Meteorologia
              </TabsTrigger>
              <TabsTrigger value="salvos" className="data-[state=active]:bg-primary/20">
                <FileText className="w-4 h-4 mr-2" />
                Salvos ({savedPlans.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB: Planejar */}
            <TabsContent value="planejar" className="space-y-4">
              <Card className="bg-surface-dark border-border-dark p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Navigation className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">Informações de Voo</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Origem */}
                  <div>
                    <Label className="text-muted-foreground">Aeródromo de Origem *</Label>
                    <select
                      value={formData.origin}
                      onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      disabled={isLoadingAerodromes}
                    >
                      <option value="">Selecione</option>
                      {aerodromes.map((ad) => (
                        <option key={ad.id} value={ad.designativo}>
                          {ad.designativo} - {ad.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Destino */}
                  <div>
                    <Label className="text-muted-foreground">Aeródromo de Destino *</Label>
                    <select
                      value={formData.destination}
                      onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      disabled={isLoadingAerodromes}
                    >
                      <option value="">Selecione</option>
                      {aerodromes.map((ad) => (
                        <option key={ad.id} value={ad.designativo}>
                          {ad.designativo} - {ad.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Alternativa */}
                  <div>
                    <Label className="text-muted-foreground">Alternativa</Label>
                    <select
                      value={formData.alternate}
                      onChange={(e) => setFormData({ ...formData, alternate: e.target.value })}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      disabled={isLoadingAerodromes}
                    >
                      <option value="">Opcional</option>
                      {aerodromes.map((ad) => (
                        <option key={ad.id} value={ad.designativo}>
                          {ad.designativo} - {ad.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  {/* Aeronave */}
                  <div>
                    <Label className="text-muted-foreground">Aeronave *</Label>
                    <select
                      value={formData.aircraftId}
                      onChange={(e) => handleAircraftChange(e.target.value)}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                      disabled={isLoadingAeronaves}
                    >
                      <option value="">Selecione</option>
                      {aeronaves.map((ac) => (
                        <option key={ac.id} value={ac.id}>
                          {ac.registration} - {ac.model}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Matrícula */}
                  <div>
                    <Label className="text-muted-foreground">Matrícula</Label>
                    <Input
                      value={formData.registration}
                      onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
                      placeholder="PT-ABC"
                      className="mt-1 bg-background border-border text-foreground"
                    />
                  </div>

                  {/* Regra de Voo */}
                  <div>
                    <Label className="text-muted-foreground">Regra de Voo</Label>
                    <select
                      value={formData.flightRule}
                      onChange={(e) => setFormData({ ...formData, flightRule: e.target.value as 'V' | 'I' | 'Y' | 'Z' })}
                      className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-2 text-foreground"
                    >
                      <option value="V">VFR</option>
                      <option value="I">IFR</option>
                      <option value="Y">IFR/VFR</option>
                      <option value="Z">VFR/IFR</option>
                    </select>
                  </div>

                  {/* Passageiros */}
                  <div>
                    <Label className="text-muted-foreground">Passageiros</Label>
                    <Input
                      type="number"
                      value={formData.passengers}
                      onChange={(e) => setFormData({ ...formData, passengers: parseInt(e.target.value) || 1 })}
                      min="1"
                      className="mt-1 bg-background border-border text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Velocidade de Cruzeiro */}
                  <div>
                    <Label className="text-muted-foreground">Velocidade Cruzeiro (kt)</Label>
                    <Input
                      value={formData.cruiseSpeed}
                      onChange={(e) => setFormData({ ...formData, cruiseSpeed: e.target.value })}
                      placeholder="180"
                      className="mt-1 bg-background border-border text-foreground"
                    />
                  </div>

                  {/* Data/Hora */}
                  <div>
                    <Label className="text-muted-foreground">Data/Hora de Partida</Label>
                    <Input
                      type="datetime-local"
                      value={formData.departure}
                      onChange={(e) => setFormData({ ...formData, departure: e.target.value })}
                      className="mt-1 bg-background border-border text-foreground"
                    />
                  </div>

                  {/* Rota */}
                  <div>
                    <Label className="text-muted-foreground">Rota</Label>
                    <Input
                      value={formData.route}
                      onChange={(e) => setFormData({ ...formData, route: e.target.value.toUpperCase() })}
                      placeholder="DCT ou via pontos"
                      className="mt-1 bg-background border-border text-foreground"
                    />
                  </div>
                </div>

                <Button
                  onClick={calculateFlightPlan}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={!formData.origin || !formData.destination}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Calcular Plano de Voo
                </Button>
              </Card>
            </TabsContent>

            {/* TAB: Resultados */}
            <TabsContent value="resultados" className="space-y-4">
              {calculations ? (
                <>
                  {/* Resumo da Rota */}
                  <Card className="bg-surface-dark border-border-dark p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Route className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Resumo do Voo</h2>
                      </div>
                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Plano Válido
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between py-6">
                      <div className="text-center">
                        <MapPin className="w-6 h-6 text-green-400 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-foreground">{formData.origin}</p>
                        <p className="text-sm text-muted-foreground">{getAerodromeByCode(formData.origin)?.name}</p>
                      </div>

                      <div className="flex-1 mx-4 border-t border-dashed border-primary/50 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-dark px-3">
                          <span className="text-primary font-bold">{calculations.distance} NM</span>
                        </div>
                      </div>

                      <div className="text-center">
                        <MapPin className="w-6 h-6 text-red-400 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-foreground">{formData.destination}</p>
                        <p className="text-sm text-muted-foreground">{getAerodromeByCode(formData.destination)?.name}</p>
                      </div>
                    </div>
                  </Card>

                  {/* Mapa e Detalhes */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Mapa */}
                    <Card className="bg-surface-dark border-border-dark p-4 h-[400px]">
                      <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        Visualização da Rota
                      </h3>
                      <FlightRouteMap points={routePoints} className="h-[340px]" />
                    </Card>

                    {/* Detalhes */}
                    <div className="space-y-4">
                      <Card className="bg-surface-dark border-border-dark p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          Tempo e Velocidade
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tempo Estimado:</span>
                            <span className="text-foreground font-mono">{calculations.ete}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Proa Magnética:</span>
                            <span className="text-foreground font-mono">{calculations.bearing}°</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Altitude Sugerida:</span>
                            <span className="text-foreground font-mono">{calculations.suggestedAlt}</span>
                          </div>
                        </div>
                      </Card>

                      <Card className="bg-surface-dark border-border-dark p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Fuel className="w-4 h-4 text-primary" />
                          Combustível
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Consumo Estimado:</span>
                            <span className="text-foreground font-mono">{calculations.fuelRequired} L</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Reserva (45%):</span>
                            <span className="text-foreground font-mono">{calculations.fuelReserve} L</span>
                          </div>
                          <div className="flex justify-between border-t border-border-dark pt-2">
                            <span className="text-muted-foreground font-semibold">Total Necessário:</span>
                            <span className="text-primary font-mono font-bold">{calculations.totalFuel} L</span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Ações */}
                  <Card className="bg-surface-dark border-border-dark p-4">
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={savePlan} variant="outline" className="border-border-dark">
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Plano
                      </Button>
                      <Button variant="outline" className="border-border-dark" disabled>
                        <Download className="w-4 h-4 mr-2" />
                        Exportar PDF
                      </Button>
                    </div>
                  </Card>
                </>
              ) : (
                <Card className="bg-surface-dark border-border-dark p-12 text-center">
                  <Calculator className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Preencha os dados e calcule o plano de voo</p>
                </Card>
              )}
            </TabsContent>

            {/* TAB: Meteorologia */}
            <TabsContent value="meteorologia" className="space-y-4">
              <div className="flex justify-end mb-2">
                <Button
                  onClick={fetchWeatherData}
                  disabled={isLoadingWeather || (!formData.origin && !formData.destination)}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isLoadingWeather ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Buscar METAR
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderWeatherCard(originWeather, 'Origem', formData.origin)}
                {renderWeatherCard(destWeather, 'Destino', formData.destination)}
              </div>
            </TabsContent>

            {/* TAB: Salvos */}
            <TabsContent value="salvos" className="space-y-4">
              {savedPlans.length === 0 ? (
                <Card className="bg-surface-dark border-border-dark p-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum plano de voo salvo ainda</p>
                </Card>
              ) : (
                savedPlans.map((plan) => (
                  <Card key={plan.id} className="bg-surface-dark border-border-dark p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Plane className="w-4 h-4 text-primary" />
                          <span className="text-foreground font-semibold">
                            {plan.formData.origin} → {plan.formData.destination}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {new Date(plan.date).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span>Aeronave: {plan.formData.registration || 'N/A'}</span>
                          <span className="mx-2">•</span>
                          <span>Distância: {plan.calculations.distance} NM</span>
                          <span className="mx-2">•</span>
                          <span>Tempo: {plan.calculations.ete}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePlan(plan.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        Excluir
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
