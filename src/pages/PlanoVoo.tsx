// @ts-nocheck
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plane, Shield, FileText, CloudRain, AlertTriangle, Download, Loader2, XCircle, AlertCircle, Info, Radio, CheckCircle, Clock, Fuel, MapPin, Save, Navigation, Route, CheckCircle2, ChevronRight, PanelLeftOpen } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAerodromes } from '@/hooks/useAerodromes';
import { useAeronaves } from '@/hooks/useAeronaves';
import { useAISWeb } from '@/hooks/useAISWeb';
import { useFlightPlans } from '@/hooks/useFlightPlans';
import { usePreferredRoutes } from '@/hooks/usePreferredRoutes';
import { useAuth } from '@/contexts/AuthContext';
import { useSolarData } from '@/hooks/useSolarData';
import { calculateDistance, calculateMagneticHeading, calculateOptimalAltitude, isAerodromeOperational, type NOTAMData, type ROTAERData } from '@/lib/aviation';
import { fetchAISWebMETAR, type AISWebMETARData } from '@/services/aiswebWeather';
import { fetchAirportCharts, type ChartData } from '@/services/chartsService';
import { FlightPlanSidebar, type FlightPlanFormData } from '@/components/plano-voo/FlightPlanSidebar';
import { SkyVectorMap } from '@/components/plano-voo/SkyVectorMap';
import type { RoutePoint } from '@/components/plano-voo/FlightRouteMap';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Parse coordinates from DB
function parseCoordinates(coordStr: string | null): { lat: number; lng: number } | null {
  if (!coordStr) return null;
  if (coordStr.includes(',') && !coordStr.includes(' ')) {
    const [lat, lng] = coordStr.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
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

function formatNOTAMDate(dateValue: any): string {
  try {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Data Inválida';
    return date.toLocaleDateString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch { return 'Data Inválida'; }
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
  altitudeWarnings: string[];
  alternatives: string[];
}

interface ValidationResult {
  valid: boolean;
  notams: Record<string, NOTAMData[]>;
  originStatus: { operational: boolean; reason: string | null; criticalNOTAMs: NOTAMData[]; warnings?: string[] };
  destinationStatus: { operational: boolean; reason: string | null; criticalNOTAMs: NOTAMData[]; warnings?: string[] };
  restrictions: any[];
  warnings: string[];
}

export default function PlanoVooPage() {
  const [formData, setFormData] = useState<FlightPlanFormData>({
    aircraftId: '', registration: '', origin: '', destination: '', alternate: '',
    cruiseSpeed: 0, altitude: 5500, fuelOnBoard: 0, route: '', flightRule: 'V', departure: '', picId: '',
  });
  const [calculations, setCalculations] = useState<FlightCalculations | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [originWeather, setOriginWeather] = useState<AISWebMETARData | null>(null);
  const [destWeather, setDestWeather] = useState<AISWebMETARData | null>(null);
  const [originROTAER, setOriginROTAER] = useState<ROTAERData | null>(null);
  const [destROTAER, setDestROTAER] = useState<ROTAERData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [originCharts, setOriginCharts] = useState<ChartData[]>([]);
  const [destCharts, setDestCharts] = useState<ChartData[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [restrictionsModal, setRestrictionsModal] = useState<{ icao: string; restrictions: string[] } | null>(null);

  const { user } = useAuth();
  const { aerodromes } = useAerodromes();
  const { aeronaves } = useAeronaves();
  const { getNOTAMs, getMultipleNOTAMs, getROTAER, validateFlightPlan, loading: aiswebLoading, error: aiswebError } = useAISWeb();
  const { flightPlans, createFlightPlan, deleteFlightPlan } = useFlightPlans();
  const { routes: preferredRoutes, loading: loadingRoutes, fetchRoutes } = usePreferredRoutes();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((value) => !value), []);
  const { solarData: originSolar } = useSolarData(formData.origin || null);
  const { solarData: destSolar } = useSolarData(formData.destination || null);

  // Crew members
  const { data: crewMembers = [] } = useQuery({
    queryKey: ['crew-members-pic'],
    queryFn: async () => {
      const { data } = await supabase.from('membros_tripulacao').select('id, nome_completo, canac, status').eq('status', 'ativo').order('nome_completo');
      return (data || []).map((m: any) => ({ id: m.id, full_name: m.nome_completo, canac: m.canac }));
    }
  });

  const getAerodromeByCode = useCallback((code: string) => aerodromes.find(a => a.designativo === code), [aerodromes]);

  // Route points for map
  const routePoints = useMemo((): RoutePoint[] => {
    const points: RoutePoint[] = [];
    const addPoint = (code: string, type: RoutePoint['type']) => {
      const ad = getAerodromeByCode(code);
      if (!ad) return;
      const coords = parseCoordinates(ad.coordenadas);
      if (coords) points.push({ icao: ad.designativo, name: ad.nome, lat: coords.lat, lng: coords.lng, type });
    };
    if (formData.origin) addPoint(formData.origin, 'departure');
    if (formData.destination) addPoint(formData.destination, 'arrival');
    if (formData.alternate) addPoint(formData.alternate, 'alternate');
    return points;
  }, [formData.origin, formData.destination, formData.alternate, getAerodromeByCode]);

  // Leg calculations
  const legCalcs = useMemo(() => {
    const legs: Array<{ from: string; to: string; distanceNM: number; bearing: number }> = [];
    const mainPoints = routePoints.filter(p => p.tipo !== 'alternate');
    for (let i = 0; i < mainPoints.length - 1; i++) {
      const from = mainPoints[i], to = mainPoints[i + 1];
      const dist = calculateDistance(from.lat, from.lng, to.lat, to.lng);
      const brg = calculateMagneticHeading(from.lat, from.lng, to.lat, to.lng);
      legs.push({ from: from.icao, to: to.icao, distanceNM: dist, bearing: brg });
    }
    const totalDistanceNM = legs.reduce((s, l) => s + l.distanceNM, 0);
    const speed = formData.cruiseSpeed || 150;
    const estimatedTimeMinutes = (totalDistanceNM / speed) * 60;
    const aircraft = aeronaves.find(a => a.id === formData.aeronaveId);
    const consumption = aircraft?.fuel_consumption || 50;
    const fuelBurnLiters = (totalDistanceNM / speed) * consumption;
    return { totalDistanceNM, estimatedTimeMinutes, fuelBurnLiters, legs };
  }, [routePoints, formData.cruiseSpeed, formData.aeronaveId, aeronaves]);

  // Auto-fetch weather when origin/destination change
  useEffect(() => {
    const fetchWeather = async () => {
      if (!formData.origin && !formData.destination) return;
      setIsLoadingWeather(true);
      try {
        const [ow, dw] = await Promise.all([
          formData.origin ? fetchAISWebMETAR(formData.origin) : Promise.resolve(null),
          formData.destination ? fetchAISWebMETAR(formData.destination) : Promise.resolve(null),
        ]);
        setOriginWeather(ow);
        setDestWeather(dw);
      } catch { /* silently fail */ }
      finally { setIsLoadingWeather(false); }
    };
    fetchWeather();
  }, [formData.origin, formData.destination]);

  // Auto-fetch ROTAER
  useEffect(() => {
    const fetch = async () => {
      if (formData.origin) setOriginROTAER(await getROTAER(formData.origin));
      if (formData.destination) setDestROTAER(await getROTAER(formData.destination));
    };
    if (formData.origin || formData.destination) fetch();
  }, [formData.origin, formData.destination, getROTAER]);

  // Auto-fetch charts
  useEffect(() => {
    const fetch = async () => {
      setIsLoadingCharts(true);
      try {
        const [oc, dc] = await Promise.all([
          formData.origin ? fetchAirportCharts(formData.origin) : Promise.resolve([]),
          formData.destination ? fetchAirportCharts(formData.destination) : Promise.resolve([]),
        ]);
        setOriginCharts(oc);
        setDestCharts(dc);
      } catch { /* */ }
      finally { setIsLoadingCharts(false); }
    };
    if (formData.origin || formData.destination) fetch();
  }, [formData.origin, formData.destination]);

  // Auto-fetch preferred routes
  useEffect(() => {
    if (formData.origin && formData.destination) {
      fetchRoutes(formData.origin, formData.destination);
    }
  }, [formData.origin, formData.destination, fetchRoutes]);

  // Form change handler
  const handleFormChange = useCallback((partial: Partial<FlightPlanFormData>) => {
    setFormData(prev => ({ ...prev, ...partial }));
  }, []);

  // Calculate & validate
  const handleCalculate = useCallback(async () => {
    const originAd = getAerodromeByCode(formData.origin);
    const destAd = getAerodromeByCode(formData.destination);
    if (!originAd || !destAd) { toast.error('Selecione origem e destino'); return; }
    const oc = parseCoordinates(originAd.coordenadas);
    const dc = parseCoordinates(destAd.coordenadas);
    if (!oc || !dc) { toast.error('Coordenadas não disponíveis'); return; }

    setIsValidating(true);
    try {
      const distance = calculateDistance(oc.lat, oc.lng, dc.lat, dc.lng);
      const bearing = calculateMagneticHeading(oc.lat, oc.lng, dc.lat, dc.lng);
      const speed = formData.cruiseSpeed || 150;
      const aircraft = aeronaves.find(a => a.id === formData.aeronaveId);
      const fuelCons = aircraft?.fuel_consumption || 50;
      const timeHours = distance / speed;
      const fuelReq = timeHours * fuelCons;
      const fuelRes = fuelReq * 0.45;

      // Validate
      const altitude = formData.altitude || 5500;
      const vResult = await validateFlightPlan(formData.origin, formData.destination, [oc, dc], altitude);
      setValidation(vResult);

      const altData = calculateOptimalAltitude(
        bearing,
        formData.flightRule,
        (vResult?.restrictions as any[]) || []
      );

      setCalculations({
        distance: Math.round(distance), bearing: Math.round(bearing), time: timeHours,
        fuelRequired: Math.round(fuelReq), fuelReserve: Math.round(fuelRes), totalFuel: Math.round(fuelReq + fuelRes),
        suggestedAlt: altData.suggested, altitudeWarnings: altData.warnings, alternatives: altData.alternatives,
        ete: `${Math.floor(timeHours)}h ${Math.round(timeHours % 1 * 60)}min`,
      });

      setShowBriefing(true);
      toast.success('Plano calculado e validado');
    } catch (err) {
      toast.error('Erro ao calcular plano');
    } finally { setIsValidating(false); }
  }, [formData, getAerodromeByCode, aeronaves, validateFlightPlan]);

  // Save plan
  const handleSavePlan = useCallback(async () => {
    if (!calculations || !user) { toast.error('Calcule o plano primeiro'); return; }
    const picName = crewMembers.find(c => c.id === formData.picId)?.full_name || 'Piloto';
    const flightDate = formData.departure ? formData.departure.split('T')[0] : new Date().toISOString().split('T')[0];
    await createFlightPlan({
      flight_date: flightDate, departure_airport: formData.origin, arrival_airport: formData.destination,
      aeronave_id: formData.aeronaveId || undefined, pilot_in_command: picName,
      alternate_airport: formData.alternate || undefined, cruise_altitude: String(formData.altitude),
      estimated_time: calculations.ete, fuel_endurance: `${calculations.totalFuel}L`,
      route: formData.route || 'DCT', status: 'draft', calculations, validation,
      weather: { origin: originWeather, destination: destWeather, timestamp: Date.now() },
    });
    setIsSidebarOpen(false);
  }, [formData, calculations, validation, originWeather, destWeather, createFlightPlan, user, crewMembers]);

  // Load plan into form
  const handleLoadPlan = useCallback(() => {
    setShowBriefing(true);
  }, []);

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Sidebar */}
        <div className={isSidebarOpen ? 'w-80' : 'w-0'}>
          {isSidebarOpen && (
            <FlightPlanSidebar
              aerodromes={aerodromes}
              aeronaves={aeronaves}
              formData={formData}
              onFormChange={handleFormChange}
              calcs={legCalcs}
              preferredRoutes={preferredRoutes}
              loadingRoutes={loadingRoutes}
              onSavePlan={handleSavePlan}
              onLoadPlan={handleLoadPlan}
              onCalculate={handleCalculate}
              isCalculating={isValidating}
              crewMembers={crewMembers}
              onCollapse={toggleSidebar}
            />
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {!isSidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="absolute top-4 left-4 z-[1200] flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-lg text-xs font-bold text-foreground hover:bg-muted"
              title="Reabrir plano de voo"
            >
              <PanelLeftOpen className="w-4 h-4 text-primary" />
              Plano de voo
            </button>
          )}

          <SkyVectorMap
            waypoints={routePoints}
            legs={legCalcs.legs}
            originWeather={originWeather}
            destWeather={destWeather}
            loadingWeather={isLoadingWeather}
            weatherError={aiswebError}
          />
        </div>
      </div>

      {/* Briefing Dialog */}
      <Dialog open={showBriefing} onOpenChange={setShowBriefing}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-primary" />
              Briefing - {formData.origin} → {formData.destination}
            </DialogTitle>
            <DialogDescription>Resumo completo do plano de voo</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="summary" className="mt-4">
            <TabsList>
              <TabsTrigger value="summary"><Route className="w-4 h-4 mr-1" /> Resumo</TabsTrigger>
              <TabsTrigger value="notam"><Shield className="w-4 h-4 mr-1" /> NOTAMs</TabsTrigger>
              <TabsTrigger value="weather"><CloudRain className="w-4 h-4 mr-1" /> Meteo</TabsTrigger>
              <TabsTrigger value="charts"><FileText className="w-4 h-4 mr-1" /> Cartas</TabsTrigger>
              <TabsTrigger value="rotaer"><Radio className="w-4 h-4 mr-1" /> ROTAER</TabsTrigger>
              <TabsTrigger value="saved"><FileText className="w-4 h-4 mr-1" /> Salvos ({flightPlans.length})</TabsTrigger>
            </TabsList>

            {/* Summary */}
            <TabsContent value="summary" className="space-y-4">
              {calculations ? (
                <>
                  {/* Status */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold flex items-center gap-2"><Route className="w-4 h-4 text-primary" /> Status</h3>
                      {validation && (
                        <Badge variant="outline" className={validation.valid ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}>
                          {validation.valid ? <><CheckCircle className="w-3 h-3 mr-1" /> Válido</> : <><XCircle className="w-3 h-3 mr-1" /> Atenção</>}
                        </Badge>
                      )}
                    </div>
                    {validation?.warnings && validation.warnings.length > 0 && (
                      <Alert className="mb-4 bg-yellow-500/10 border-yellow-500/50">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>
                          {validation.warnings.length} alerta(s): {validation.warnings.slice(0, 2).join('; ')}
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex items-center justify-between py-4">
                      <div className="text-center">
                        <MapPin className="w-5 h-5 text-green-400 mx-auto mb-1" />
                        <p className="text-xl font-bold">{formData.origin}</p>
                        <p className="text-xs text-muted-foreground">{getAerodromeByCode(formData.origin)?.nome}</p>
                      </div>
                      <div className="flex-1 mx-4 border-t border-dashed border-primary/50 relative">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3">
                          <span className="text-primary font-bold">{calculations.distance} NM</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <MapPin className="w-5 h-5 text-red-400 mx-auto mb-1" />
                        <p className="text-xl font-bold">{formData.destination}</p>
                        <p className="text-xs text-muted-foreground">{getAerodromeByCode(formData.destination)?.nome}</p>
                      </div>
                    </div>
                  </Card>

                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Navegação</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">ETE:</span><span className="font-mono">{calculations.ete}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Proa:</span><span className="font-mono">{calculations.bearing}°</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Alt. Sugerida:</span><span className="font-mono font-bold text-primary">{calculations.suggestedAlt}</span></div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Fuel className="w-4 h-4 text-primary" /> Combustível</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Consumo:</span><span className="font-mono">{calculations.fuelRequired} L</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Reserva (45%):</span><span className="font-mono">{calculations.fuelReserve} L</span></div>
                        <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground font-semibold">Total:</span><span className="font-mono font-bold text-primary">{calculations.totalFuel} L</span></div>
                      </div>
                    </Card>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleSavePlan}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
                    <Button variant="outline" disabled><Download className="w-4 h-4 mr-2" /> PDF</Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Plane className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Calcule o plano para ver o briefing</p>
                </div>
              )}
            </TabsContent>

            {/* NOTAMs */}
            <TabsContent value="notam" className="space-y-4">
              {validation ? Object.entries(validation.notams).map(([icao, notams]) => (
                <Card key={icao} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /><h3 className="font-semibold">{icao}</h3></div>
                    <Badge variant="outline">{notams.length} NOTAM{notams.length !== 1 ? 'S' : ''}</Badge>
                  </div>
                  {notams.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum NOTAM ativo</p> : (
                    <div className="space-y-2">
                      {notams.map((n, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${n.priority === 'critical' ? 'bg-red-500/10 border-red-500/50' : n.priority === 'high' ? 'bg-orange-500/10 border-orange-500/50' : n.priority === 'medium' ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-blue-500/10 border-blue-500/50'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-muted-foreground">{n.number}</span>
                            <Badge variant="outline" className="text-xs">{(n.priority ?? 'info').toUpperCase()}</Badge>
                          </div>
                          <p className="text-sm mb-1">{n.message}</p>
                          <div className="text-xs text-muted-foreground">
                            Válido: {formatNOTAMDate(n.startDate)} - {formatNOTAMDate(n.endDate)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )) : (
                <div className="text-center py-12 text-muted-foreground">Calcule o plano para ver NOTAMs</div>
              )}
            </TabsContent>

            {/* Weather */}
            <TabsContent value="weather" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[{ w: originWeather, title: 'Origem', icao: formData.origin },
                  { w: destWeather, title: 'Destino', icao: formData.destination }].map(({ w, title, icao }) => (
                  <Card key={title} className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CloudRain className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">{icao || title}</h3>
                      {w && <Badge variant="outline">{w.flightCategory}</Badge>}
                    </div>
                    {w ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Temp:</span><span className="font-mono">{w.temp}°C / {w.dewp}°C</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Vento:</span><span className="font-mono">{w.wdir}° {w.wspd}kt{w.wgst ? ` G${w.wgst}` : ''}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Visib:</span><span className="font-mono">{w.visib}</span></div>
                        {w.rawOb && <div className="mt-3 pt-3 border-t"><p className="text-xs font-mono break-all text-muted-foreground">{w.rawOb}</p></div>}
                        {w.taf && <div className="mt-2 pt-2 border-t"><p className="text-xs text-muted-foreground mb-1 font-semibold">TAF:</p><p className="text-xs font-mono break-all text-muted-foreground">{w.taf}</p></div>}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Aguardando dados...</p>}
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Charts */}
            <TabsContent value="charts" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[{ charts: originCharts, label: formData.origin },
                  { charts: destCharts, label: formData.destination }].map(({ charts, label }) => (
                  <div key={label}>
                    <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> {label || '---'}</h3>
                    {charts.length > 0 ? (
                      <div className="space-y-2">
                        {charts.map((c, i) => (
                          <div key={i} className="p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-start justify-between mb-1">
                              <h4 className="text-sm font-semibold">{c.title}</h4>
                              <Badge variant="outline" className="text-xs">{c.tipo}</Badge>
                            </div>
                            {c.descricao && <p className="text-xs text-muted-foreground mb-1">{c.descricao}</p>}
                            {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary text-xs font-semibold"><Download className="w-3 h-3" /> Download</a> : <span className="text-xs text-muted-foreground">Sem link</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{isLoadingCharts ? 'Carregando...' : 'Nenhuma carta'}</p>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ROTAER */}
            <TabsContent value="rotaer" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[{ r: originROTAER, icao: formData.origin, solar: originSolar },
                  { r: destROTAER, icao: formData.destination, solar: destSolar }].map(({ r, icao, solar }) => (
                  <Card key={icao} className="p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2"><Radio className="w-4 h-4 text-primary" /> {icao}</h3>
                    {r ? (
                      <div className="space-y-3 text-sm">
                        <div><span className="text-muted-foreground">Nome:</span> {r.nome}</div>
                        <div><span className="text-muted-foreground">Elevação:</span> {r.elevation}ft</div>
                        <div><span className="text-muted-foreground">Coord:</span> {r.coordinates ? `${r.coordinates.lat.toFixed(2)}°, ${r.coordinates.lng.toFixed(2)}°` : '—'}</div>
                        {solar?.day && (
                          <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 text-xs">
                            Nascer: {solar.day.sunrise} | Pôr: {solar.day.sunset}
                          </div>
                        )}
                        {r.runways?.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-1 flex items-center gap-1"><Navigation className="w-3 h-3 text-primary" /> Pistas:</h4>
                            {r.runways.map((rwy, i) => (
                              <div key={i} className="ml-4 mb-1">
                                <span className="font-mono font-bold text-primary">{rwy.designator}</span> {rwy.length}m × {rwy.width}m ({rwy.surface})
                              </div>
                            ))}
                          </div>
                        )}
                        {r.frequencies?.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-1">Frequências:</h4>
                            {r.frequencies.map((f, i) => (
                              <div key={i} className="ml-4 text-xs"><span className="text-muted-foreground">{f.tipo}:</span> {f.frequency} MHz</div>
                            ))}
                          </div>
                        )}
                        {r.services && (
                          <div className="flex flex-wrap gap-1">
                            {r.services.fuel && <Badge variant="outline" className="text-xs bg-green-500/20">Combustível</Badge>}
                            {r.services.maintenance && <Badge variant="outline" className="text-xs bg-orange-500/20">Manutenção</Badge>}
                            {r.services.hangar && <Badge variant="outline" className="text-xs bg-blue-500/20">Hangar</Badge>}
                          </div>
                        )}
                        {r.restrictions?.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-red-400 mb-1">Restrições:</h4>
                            {r.restrictions.slice(0, 3).map((rest, i) => (
                              <p key={i} className="text-xs ml-4 border-l-2 border-red-500 pl-2 py-1">{rest}</p>
                            ))}
                            {r.restrictions.length > 3 && (
                              <button onClick={() => setRestrictionsModal({ icao: r.icao, restrictions: r.restrictions })}
                                className="text-xs text-red-400 hover:text-red-300 ml-4 mt-1 flex items-center gap-1">
                                <ChevronRight className="w-3 h-3" /> Ver mais {r.restrictions.length - 3}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Dados ROTAER não disponíveis</p>}
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Saved Plans */}
            <TabsContent value="saved" className="space-y-4">
              {flightPlans.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum plano salvo</div>
              ) : flightPlans.map(plan => (
                <Card key={plan.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Plane className="w-4 h-4 text-primary" />
                        <span className="font-semibold">{plan.departure_airport} → {plan.arrival_airport}</span>
                        <Badge variant="outline" className="text-xs">{new Date(plan.flight_date).toLocaleDateString('pt-BR')}</Badge>
                        <Badge variant="outline" className="text-xs">{plan.status.toUpperCase()}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Piloto: {plan.pilot_in_command} • {plan.estimated_time || '--'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        handleFormChange({
                          origin: plan.departure_airport, destination: plan.arrival_airport,
                          alternate: plan.alternate_airport || '', aircraftId: plan.aeronave_id || '',
                          route: plan.route || '',
                        });
                        if (plan.calculations) setCalculations(plan.calculations);
                        if (plan.validation) setValidation(plan.validation);
                        setShowBriefing(false);
                        toast.success('Plano carregado');
                      }} className="text-primary">Editar</Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteFlightPlan(plan.id)} className="text-destructive">Excluir</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Restrictions Modal */}
      <Dialog open={!!restrictionsModal} onOpenChange={(open) => !open && setRestrictionsModal(null)}>
        <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /> Restrições - {restrictionsModal?.icao}</DialogTitle>
            <DialogDescription>Restrições operacionais do aeródromo</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {restrictionsModal?.restrictions.map((r, idx) => (
              <div key={idx} className="border-l-4 border-destructive pl-4 py-3 rounded bg-destructive/10">
                <p className="text-sm">{r}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
