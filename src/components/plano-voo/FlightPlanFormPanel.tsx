import React, { useState } from 'react';
import { Waypoint } from '@/hooks/useFlightPlanCalcs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';

export type RouteMethod = 'direct' | 'airways' | 'custom';

interface FlightPlanFormPanelProps {
  waypoints: Waypoint[];
  setWaypoints: (waypoints: Waypoint[]) => void;
  selectedAircraft: string;
  setSelectedAircraft: (aircraft: string) => void;
  cruiseSpeed: number;
  setCruiseSpeed: (speed: number) => void;
  altitude: number;
  setAltitude: (altitude: number) => void;
  fuelOnBoard: number;
  setFuelOnBoard: (fuel: number) => void;
  routeMethod: RouteMethod;
  setRouteMethod: (method: RouteMethod) => void;
  calcs: any;
  onSavePlan: () => void;
  onLoadPlan: () => void;
}

export const FlightPlanFormPanel: React.FC<FlightPlanFormPanelProps> = ({
  waypoints,
  setWaypoints,
  selectedAircraft,
  setSelectedAircraft,
  cruiseSpeed,
  setCruiseSpeed,
  altitude,
  setAltitude,
  fuelOnBoard,
  setFuelOnBoard,
  routeMethod,
  setRouteMethod,
  calcs,
  onSavePlan,
  onLoadPlan,
}) => {
  const [newWaypointIcao, setNewWaypointIcao] = useState('');
  const [newWaypointName, setNewWaypointName] = useState('');
  const [newWaypointLat, setNewWaypointLat] = useState('');
  const [newWaypointLng, setNewWaypointLng] = useState('');
  const [waypointType, setWaypointType] = useState<'departure' | 'arrival' | 'waypoint'>('waypoint');

  const handleAddWaypoint = () => {
    if (!newWaypointIcao || !newWaypointLat || !newWaypointLng) {
      toast.error('Preencha ICAO, latitude e longitude');
      return;
    }

    const newWaypoint: Waypoint = {
      icao: newWaypointIcao.toUpperCase(),
      name: newWaypointName || newWaypointIcao,
      lat: parseFloat(newWaypointLat),
      lng: parseFloat(newWaypointLng),
      type: waypointType,
    };

    setWaypoints([...waypoints, newWaypoint]);
    setNewWaypointIcao('');
    setNewWaypointName('');
    setNewWaypointLat('');
    setNewWaypointLng('');
    setWaypointType('waypoint');
    toast.success('Waypoint adicionado');
  };

  const handleRemoveWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
    toast.success('Waypoint removido');
  };

  return (
    <div className="w-96 bg-surface-dark/80 border-r border-border-dark flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border-dark shrink-0">
        <h2 className="font-bold text-white mb-1">Flight Plan</h2>
        <p className="text-xs text-text-secondary">Defina sua rota e parâmetros</p>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* Aircraft Selection */}
          <div className="space-y-2">
            <Label className="text-white text-sm">Aeronave</Label>
            <Input
              placeholder="Ex: PP-XYZ"
              value={selectedAircraft}
              onChange={(e) => setSelectedAircraft(e.target.value)}
              className="bg-background-dark/50 border-border-dark text-white"
            />
          </div>

          {/* Route Method */}
          <div className="space-y-2">
            <Label className="text-white text-sm">Tipo de Rota</Label>
            <Select value={routeMethod} onValueChange={(value) => setRouteMethod(value as RouteMethod)}>
              <SelectTrigger className="bg-background-dark/50 border-border-dark text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-dark border-border-dark">
                <SelectItem value="direct" className="text-white">Direto</SelectItem>
                <SelectItem value="airways" className="text-white">Aerovias</SelectItem>
                <SelectItem value="custom" className="text-white">Customizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Performance Section */}
          <Card className="bg-background-dark/30 border-border-dark/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-text-secondary">Velocidade (Kt)</Label>
                <Input
                  type="number"
                  value={cruiseSpeed}
                  onChange={(e) => setCruiseSpeed(parseFloat(e.target.value))}
                  className="bg-background-dark/50 border-border-dark text-white text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-text-secondary">Altitude (ft)</Label>
                <Input
                  type="number"
                  value={altitude}
                  onChange={(e) => setAltitude(parseFloat(e.target.value))}
                  className="bg-background-dark/50 border-border-dark text-white text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-text-secondary">Combustível a Bordo (L)</Label>
                <Input
                  type="number"
                  value={fuelOnBoard}
                  onChange={(e) => setFuelOnBoard(parseFloat(e.target.value))}
                  className="bg-background-dark/50 border-border-dark text-white text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Add Waypoint Section */}
          <Card className="bg-background-dark/30 border-border-dark/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-white">Adicionar Waypoint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-text-secondary">ICAO</Label>
                <Input
                  placeholder="Ex: SBGR"
                  value={newWaypointIcao}
                  onChange={(e) => setNewWaypointIcao(e.target.value)}
                  className="bg-background-dark/50 border-border-dark text-white text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-text-secondary">Nome</Label>
                <Input
                  placeholder="Ex: Guarulhos"
                  value={newWaypointName}
                  onChange={(e) => setNewWaypointName(e.target.value)}
                  className="bg-background-dark/50 border-border-dark text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs text-text-secondary">Latitude</Label>
                  <Input
                    placeholder="-23.5505"
                    value={newWaypointLat}
                    onChange={(e) => setNewWaypointLat(e.target.value)}
                    className="bg-background-dark/50 border-border-dark text-white text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-text-secondary">Longitude</Label>
                  <Input
                    placeholder="-46.4693"
                    value={newWaypointLng}
                    onChange={(e) => setNewWaypointLng(e.target.value)}
                    className="bg-background-dark/50 border-border-dark text-white text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-text-secondary">Tipo</Label>
                <Select value={waypointType} onValueChange={(value) => setWaypointType(value as any)}>
                  <SelectTrigger className="bg-background-dark/50 border-border-dark text-white h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-dark border-border-dark">
                    <SelectItem value="departure" className="text-white">Origem</SelectItem>
                    <SelectItem value="arrival" className="text-white">Destino</SelectItem>
                    <SelectItem value="waypoint" className="text-white">Waypoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAddWaypoint}
                className="w-full bg-primary hover:bg-primary/90 text-white text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </CardContent>
          </Card>

          {/* Waypoints List */}
          {waypoints.length > 0 && (
            <Card className="bg-background-dark/30 border-border-dark/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-white">Waypoints ({waypoints.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {waypoints.map((wp, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-background-dark/50 rounded border border-border-dark/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-primary">{wp.icao}</p>
                      <p className="text-xs text-text-secondary truncate">{wp.name}</p>
                      <p className="text-xs text-text-secondary/70 font-mono">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveWaypoint(idx)}
                      className="text-destructive hover:text-destructive/90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Calculations Summary */}
          {calcs.legs.length > 0 && (
            <Card className="bg-background-dark/30 border-border-dark/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-white">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Distância Total:</span>
                  <span className="text-white font-mono">{calcs.totalDistanceNM.toFixed(1)} NM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Tempo Estimado:</span>
                  <span className="text-white font-mono">{calcs.estimatedTimeHours}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Consumo de Fuel:</span>
                  <span className="text-white font-mono">{calcs.fuelBurnLiters.toFixed(0)} L</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-border-dark space-y-2 shrink-0">
        <Button onClick={onSavePlan} className="w-full bg-primary hover:bg-primary/90 text-white">
          <Save className="h-4 w-4 mr-2" />
          Salvar Plano
        </Button>
        <Button onClick={onLoadPlan} variant="outline" className="w-full border-border-dark text-white hover:bg-background-dark/50">
          <Upload className="h-4 w-4 mr-2" />
          Carregar Plano
        </Button>
      </div>
    </div>
  );
};
