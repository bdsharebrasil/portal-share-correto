import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calculator, Plus, Cloud, Star, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface FlightPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string;
}

interface CrewMember {
  id: string;
  full_name: string;
  canac: string;
}

interface Client {
  id: string;
  company_name: string;
  cnpj: string;
}

export function FlightPlanDialog({ open, onOpenChange }: FlightPlanDialogProps) {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [favoriteRoutes, setFavoriteRoutes] = useState<any[]>([]);
  const [aircraftChecklist, setAircraftChecklist] = useState([
    { id: "1", item: "Documentação da aeronave", checked: false },
    { id: "2", item: "Inspeção externa", checked: false },
    { id: "3", item: "Nível de combustível", checked: false },
    { id: "4", item: "Nível de óleo", checked: false },
    { id: "5", item: "Pneus e freios", checked: false },
  ]);
  const [commissaryChecklist, setCommissaryChecklist] = useState([
    { id: "1", item: "Kit de primeiros socorros", checked: false },
    { id: "2", item: "Extintores de incêndio", checked: false },
    { id: "3", item: "Coletes salva-vidas", checked: false },
    { id: "4", item: "Oxigênio de emergência", checked: false },
    { id: "5", item: "Provisões e água", checked: false },
  ]);
  
  const [formData, setFormData] = useState({
    mission_number: "",
    client_id: "",
    departure_airport: "",
    arrival_airport: "",
    flight_date: "",
    flight_time: "",
    aeronave_id: "",
    route: "",
    flight_plan: "",
    fuel_calculation: "",
    time_calculation: "",
    weather_observations: "",
    selected_crew: [] as string[],
    // Fuel calculation fields
    cruise_speed: "",
    flight_distance: "",
    climb_fuel: "",
    cruise_fuel: "",
    descent_fuel: "",
    contingency_percentage: "10",
    fuel_density: "0.7",
  });

  useEffect(() => {
    if (open) {
      loadData();
      loadFavoriteRoutes();
    }
  }, [open]);

  const loadFavoriteRoutes = async () => {
    try {
      const { data, error } = await supabase
        .from("favorite_routes")
        .select("*");
      
      if (error) throw error;
      setFavoriteRoutes(data || []);
    } catch (error) {
      console.error("Error loading favorite routes:", error);
    }
  };

  const saveFavoriteRoute = async () => {
    if (!formData.departure_airport || !formData.arrival_airport || !formData.route) {
      toast.error("Preencha origem, destino e rota para salvar como favorita");
      return;
    }

    try {
      const { error } = await supabase.from("favorite_routes").insert({
        departure_airport: formData.departure_airport,
        arrival_airport: formData.arrival_airport,
        route: formData.route,
        name: `${formData.departure_airport} - ${formData.arrival_airport}`,
      });

      if (error) throw error;
      toast.success("Rota salva como favorita!");
      loadFavoriteRoutes();
    } catch (error) {
      console.error("Error saving favorite route:", error);
      toast.error("Erro ao salvar rota favorita");
    }
  };

  const loadFavoriteRoute = (route: any) => {
    setFormData(prev => ({
      ...prev,
      departure_airport: route.departure_airport,
      arrival_airport: route.arrival_airport,
      route: route.route,
    }));
    toast.success("Rota favorita carregada!");
  };

  const deleteFavoriteRoute = async (id: string) => {
    try {
      const { error } = await supabase.from("favorite_routes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Rota removida!");
      loadFavoriteRoutes();
    } catch (error) {
      console.error("Error deleting route:", error);
      toast.error("Erro ao remover rota");
    }
  };

  const calculateFuel = () => {
    const distance = parseFloat(formData.flight_distance) || 0;
    const speed = parseFloat(formData.cruise_speed) || 1;
    const climbFuel = parseFloat(formData.climb_fuel) || 0;
    const cruiseFuelRate = parseFloat(formData.cruise_fuel) || 0;
    const descentFuel = parseFloat(formData.descent_fuel) || 0;
    const contingency = parseFloat(formData.contingency_percentage) || 10;
    const density = parseFloat(formData.fuel_density) || 0.7;

    // Calculate cruise time in hours
    const cruiseTime = distance / speed;
    
    // Total fuel in liters
    const totalCruiseFuel = cruiseTime * cruiseFuelRate;
    const totalFuelLiters = climbFuel + totalCruiseFuel + descentFuel;
    
    // Add contingency
    const fuelWithContingency = totalFuelLiters * (1 + contingency / 100);
    
    // Convert to weight (kg)
    const fuelWeight = fuelWithContingency * density;
    
    const calculation = `
CÁLCULO DE COMBUSTÍVEL:
━━━━━━━━━━━━━━━━━━━━━━━━━
Distância: ${distance} km
Velocidade de Cruzeiro: ${speed} km/h
Tempo de Cruzeiro: ${cruiseTime.toFixed(2)} horas

Combustível por Fase:
- Subida: ${climbFuel} L
- Cruzeiro: ${totalCruiseFuel.toFixed(2)} L
- Descida: ${descentFuel} L

Subtotal: ${totalFuelLiters.toFixed(2)} L
Contingência (${contingency}%): ${(totalFuelLiters * contingency / 100).toFixed(2)} L

TOTAL COM CONTINGÊNCIA: ${fuelWithContingency.toFixed(2)} L
PESO DO COMBUSTÍVEL: ${fuelWeight.toFixed(2)} kg

Densidade usada: ${density} kg/L
    `.trim();

    setFormData(prev => ({
      ...prev,
      fuel_calculation: calculation,
    }));
    
    toast.success("Combustível calculado!");
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [aircraftRes, crewRes, clientsRes] = await Promise.all([
        supabase.from('aeronave').select('id, matricula, modelo').eq("status", "ativa"),
        supabase.from("tripulacao").select("id, nome_completo, canac").eq("status", "ativo"),
        supabase.from("clientes").select("id, razao_social, cnpj"),
      ]);

      if (aircraftRes.error) throw aircraftRes.error;
      if (crewRes.error) throw crewRes.error;
      if (clientsRes.error) throw clientsRes.error;

      setAircraft(aircraftRes.data || []);
      setCrewMembers(crewRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const fetchWeather = async () => {
    if (!formData.departure_airport) {
      toast.error("Informe o aeródromo de partida");
      return;
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${formData.departure_airport}&appid=3e244e4c886d3209157976b0bb4d2774&units=metric&lang=pt_br`
      );
      
      if (!response.ok) throw new Error("Erro ao buscar dados meteorológicos");
      
      const data = await response.json();
      const weatherInfo = `
METAR Consultado para ${formData.departure_airport}:
Temperatura: ${data.main.temp}°C
Condição: ${data.weather[0].descricao}
Vento: ${data.wind.speed} m/s
Pressão: ${data.main.pressure} hPa
Umidade: ${data.main.humidity}%
Visibilidade: ${data.visibility / 1000} km
      `.trim();

      setFormData(prev => ({
        ...prev,
        weather_observations: weatherInfo,
      }));
      toast.success("Dados meteorológicos consultados");
    } catch (error) {
      console.error("Error fetching weather:", error);
      toast.error("Erro ao consultar METAR");
    }
  };

  const handleSubmit = async () => {
    if (!formData.cliente_id || !formData.departure_airport || !formData.arrival_airport || 
        !formData.flight_date || !formData.aeronave_id) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { error } = await supabase.from("flight_plans").insert({
        aeronave_id: formData.aeronave_id,
        departure_airport: formData.departure_airport,
        arrival_airport: formData.arrival_airport,
        flight_date: formData.flight_date || new Date().toISOString().split('T')[0],
        route: formData.route,
        remarks: formData.weather_observations,
        pilot_in_command: "",
      });

      if (error) throw error;

      toast.success("Plano de voo criado com sucesso!");
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating flight plan:", error);
      toast.error("Erro ao criar plano de voo");
    }
  };

  const resetForm = () => {
    setFormData({
      mission_number: "",
      client_id: "",
      departure_airport: "",
      arrival_airport: "",
      flight_date: "",
      flight_time: "",
      aeronave_id: "",
      route: "",
      flight_plan: "",
      fuel_calculation: "",
      time_calculation: "",
      weather_observations: "",
      selected_crew: [],
      cruise_speed: "",
      flight_distance: "",
      climb_fuel: "",
      cruise_fuel: "",
      descent_fuel: "",
      contingency_percentage: "10",
      fuel_density: "0.7",
    });
    setAircraftChecklist([
      { id: "1", item: "Documentação da aeronave", checked: false },
      { id: "2", item: "Inspeção externa", checked: false },
      { id: "3", item: "Nível de combustível", checked: false },
      { id: "4", item: "Nível de óleo", checked: false },
      { id: "5", item: "Pneus e freios", checked: false },
    ]);
    setCommissaryChecklist([
      { id: "1", item: "Kit de primeiros socorros", checked: false },
      { id: "2", item: "Extintores de incêndio", checked: false },
      { id: "3", item: "Coletes salva-vidas", checked: false },
      { id: "4", item: "Oxigênio de emergência", checked: false },
      { id: "5", item: "Provisões e água", checked: false },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Voo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Número da Missão</Label>
              <Input
                placeholder="Auto-gerado se vazio"
                value={formData.mission_number}
                onChange={(e) => setFormData(prev => ({ ...prev, mission_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>Cliente *</Label>
              <Select value={formData.cliente_id} onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Partida (ICAO) *</Label>
              <Input
                placeholder="SBMT"
                value={formData.departure_airport}
                onChange={(e) => setFormData(prev => ({ ...prev, departure_airport: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <Label>Chegada (ICAO) *</Label>
              <Input
                placeholder="SBGO"
                value={formData.arrival_airport}
                onChange={(e) => setFormData(prev => ({ ...prev, arrival_airport: e.target.value.toUpperCase() }))}
              />
            </div>
            <div>
              <Label>Data do Voo *</Label>
              <Input
                type="data"
                value={formData.flight_date}
                onChange={(e) => setFormData(prev => ({ ...prev, flight_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Horário (UTC) *</Label>
              <Input
                type="time"
                value={formData.flight_time}
                onChange={(e) => setFormData(prev => ({ ...prev, flight_time: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>Aeronave *</Label>
            <Select value={formData.aeronave_id} onValueChange={(value) => setFormData(prev => ({ ...prev, aeronave_id: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a aeronave" />
              </SelectTrigger>
              <SelectContent>
                {aircraft.map((ac) => (
                  <SelectItem key={ac.id} value={ac.id}>
                    {ac.registration} - {ac.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="planejamento" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="planejamento">Planejamento</TabsTrigger>
              <TabsTrigger value="combustivel">Combustível</TabsTrigger>
              <TabsTrigger value="meteorologia">Meteorologia</TabsTrigger>
              <TabsTrigger value="checklist">Check-lists</TabsTrigger>
              <TabsTrigger value="tripulacao">Tripulação</TabsTrigger>
            </TabsList>

            <TabsContent value="planejamento" className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Construir Rota de Voo</Label>
                  <Button onClick={saveFavoriteRoute} variant="ghost" size="sm">
                    <Star className="h-4 w-4 mr-2" />
                    Salvar como Favorita
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: ATL 30.2,-82.1, ORL"
                    value={formData.route}
                    onChange={(e) => setFormData(prev => ({ ...prev, route: e.target.value }))}
                  />
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Ponto
                  </Button>
                </div>
              </div>

              {favoriteRoutes.length > 0 && (
                <div>
                  <Label>Rotas Favoritas</Label>
                  <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                    {favoriteRoutes.map((route) => (
                      <div key={route.id} className="flex items-center justify-between p-2 border rounded hover:bg-accent">
                        <button
                          onClick={() => loadFavoriteRoute(route)}
                          className="flex-1 text-left text-sm"
                        >
                          <div className="font-medium">{route.nome}</div>
                          <div className="text-xs text-muted-foreground">{route.route}</div>
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFavoriteRoute(route.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Plano de Voo Completo</Label>
                <Textarea
                  placeholder="Exemplo: KLEX;ATL;30.2,-82.1;ORL;KMCO"
                  value={formData.flight_plan}
                  onChange={(e) => setFormData(prev => ({ ...prev, flight_plan: e.target.value }))}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: ICAO_ORIGEM;PONTO1;COORDENADAS;PONTO2;ICAO_DESTINO
                </p>
              </div>

              <div>
                <Label>Plano de Voo Completo</Label>
                <Textarea
                  placeholder="Exemplo: KLEX;ATL;30.2,-82.1;ORL;KMCO"
                  value={formData.flight_plan}
                  onChange={(e) => setFormData(prev => ({ ...prev, flight_plan: e.target.value }))}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formato: ICAO_ORIGEM;PONTO1;COORDENADAS;PONTO2;ICAO_DESTINO
                </p>
              </div>
            </TabsContent>

            <TabsContent value="combustivel" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Distância (km)</Label>
                  <Input
                    type="number"
                    placeholder="500"
                    value={formData.flight_distance}
                    onChange={(e) => setFormData(prev => ({ ...prev, flight_distance: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Velocidade de Cruzeiro (km/h)</Label>
                  <Input
                    type="number"
                    placeholder="450"
                    value={formData.cruise_speed}
                    onChange={(e) => setFormData(prev => ({ ...prev, cruise_speed: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Combustível Subida (L)</Label>
                  <Input
                    type="number"
                    placeholder="50"
                    value={formData.climb_fuel}
                    onChange={(e) => setFormData(prev => ({ ...prev, climb_fuel: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Consumo Cruzeiro (L/h)</Label>
                  <Input
                    type="number"
                    placeholder="150"
                    value={formData.cruise_fuel}
                    onChange={(e) => setFormData(prev => ({ ...prev, cruise_fuel: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Combustível Descida (L)</Label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={formData.descent_fuel}
                    onChange={(e) => setFormData(prev => ({ ...prev, descent_fuel: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Contingência (%)</Label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={formData.contingency_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, contingency_percentage: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Densidade Combustível (kg/L)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.7"
                    value={formData.fuel_density}
                    onChange={(e) => setFormData(prev => ({ ...prev, fuel_density: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={calculateFuel} variant="default">
                  <Calculator className="h-4 w-4 mr-2" />
                  Calcular Combustível
                </Button>
              </div>

              <div>
                <Label>Resultado do Cálculo</Label>
                <Textarea
                  value={formData.fuel_calculation}
                  onChange={(e) => setFormData(prev => ({ ...prev, fuel_calculation: e.target.value }))}
                  rows={12}
                  className="font-mono text-xs"
                />
              </div>
            </TabsContent>

            <TabsContent value="meteorologia" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Consulta Meteorológica (METAR)</Label>
                <Button onClick={fetchWeather} variant="outline">
                  <Cloud className="h-4 w-4 mr-2" />
                  Consultar METAR
                </Button>
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  placeholder="Observações adicionais..."
                  value={formData.weather_observations}
                  onChange={(e) => setFormData(prev => ({ ...prev, weather_observations: e.target.value }))}
                  rows={6}
                />
              </div>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4">
              <div>
                <Label className="text-base font-semibold">Check-list da Aeronave</Label>
                <div className="space-y-2 mt-3 p-4 border rounded-lg">
                  {aircraftChecklist.map((item, index) => (
                    <div key={item.id} className="flex items-center space-x-3 p-2 hover:bg-accent rounded">
                      <Checkbox
                        id={`aircraft-${item.id}`}
                        checked={item.checked}
                        onCheckedChange={(checked) => {
                          const newList = [...aeronaveChecklist];
                          newList[index].checked = checked as boolean;
                          setAircraftChecklist(newList);
                        }}
                      />
                      <Input
                        value={item.item}
                        onChange={(e) => {
                          const newList = [...aeronaveChecklist];
                          newList[index].item = e.target.value;
                          setAircraftChecklist(newList);
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAircraftChecklist(aircraftChecklist.filter((_, i) => i !== index));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAircraftChecklist([
                        ...aeronaveChecklist,
                        { id: Date.now().toString(), item: "Novo item", checked: false }
                      ]);
                    }}
                    className="w-full mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold">Check-list Comissaria</Label>
                <div className="space-y-2 mt-3 p-4 border rounded-lg">
                  {commissaryChecklist.map((item, index) => (
                    <div key={item.id} className="flex items-center space-x-3 p-2 hover:bg-accent rounded">
                      <Checkbox
                        id={`commissary-${item.id}`}
                        checked={item.checked}
                        onCheckedChange={(checked) => {
                          const newList = [...commissaryChecklist];
                          newList[index].checked = checked as boolean;
                          setCommissaryChecklist(newList);
                        }}
                      />
                      <Input
                        value={item.item}
                        onChange={(e) => {
                          const newList = [...commissaryChecklist];
                          newList[index].item = e.target.value;
                          setCommissaryChecklist(newList);
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCommissaryChecklist(commissaryChecklist.filter((_, i) => i !== index));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCommissaryChecklist([
                        ...commissaryChecklist,
                        { id: Date.now().toString(), item: "Novo item", checked: false }
                      ]);
                    }}
                    className="w-full mt-2"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Item
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tripulacao" className="space-y-4">
              <div>
                <Label>Tripulação</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {crewMembers.map((crew) => (
                    <div key={crew.id} className="flex items-center space-x-2 p-2 border rounded">
                      <input
                        type="checkbox"
                        id={crew.id}
                        checked={formData.selected_crew.includes(crew.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              selected_crew: [...prev.selected_crew, crew.id]
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              selected_crew: prev.selected_crew.filter(id => id !== crew.id)
                            }));
                          }
                        }}
                        className="rounded"
                      />
                      <label htmlFor={crew.id} className="flex-1 cursor-pointer">
                        <div className="font-medium">{crew.full_name}</div>
                        <div className="text-xs text-muted-foreground">CANAC: {crew.canac}</div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              Criar Solicitação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
