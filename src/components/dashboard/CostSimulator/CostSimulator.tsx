import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableCombobox } from '@/components/ui/SearchableCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plane, TrendingUp, Clock, DollarSign, AlertCircle, ArrowLeft, Save, Download, Plus, Trash2, Copy, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  TipoAeronave,
  TIPOS_AERONAVE,
  TIPO_AERONAVE_LABELS,
  calcularCustosPorTipo,
  sugerirTipoAeronave,
  isCampoAplicavel,
} from './aircraftCostProfiles';


interface CostData {
  shortTerm: number;
  mediumTerm: number;
  longTerm: number;
  total: number;
  hourlyRate: number;
}

interface FormData {
  aircraftId: string;
  aircraftName: string;
  hoursPerYear: number;
  numberOfShares: number;
  originId: string;
  originName: string;
  destinationId: string;
  destinationName: string;
  flightTimeRoundTrip: number;
  journeyDays: number;
  monthlyFlights: number;
  
  fuelCost: number;
  fuelPerHour: number;
  fuelHours: number;
  pilotDailyRate: number;
  hotelMealCost: number;
  hotelMealDays: number;
  landingTaxes: number;
  hangarageOutside: number;
  hangarageOutsideDays: number;
  
  fixedHangarage: number;
  crewSalary: number;
  navigationUpdates: number;
  preventiveMaintenance: number;
  maintenancePerHour: number;
  insurance: number;
  radioTaxes: number;
  trainingExams: number;
  otherCosts: number;
  
  engineOverhaul: number;
  propellerOverhaul: number;
  magnetoOverhaul: number;
  turboOverhaul: number;
  alternatorOverhaul: number;
  sixYearMaintenance: number;
}

interface SavedSimulation {
  id: string;
  name: string;
  description?: string;
  formData: FormData;
  costs: CostData;
  createdAt: string;
}

const DEFAULT_FORM_DATA: FormData = {
  aircraftId: '',
  aircraftName: 'Selecione uma aeronave',
  hoursPerYear: 0,
  numberOfShares: 1,
  originId: '',
  originName: '',
  destinationId: '',
  destinationName: '',
  flightTimeRoundTrip: 0,
  journeyDays: 0,
  monthlyFlights: 0,

  fuelCost: 0,
  fuelPerHour: 0,
  fuelHours: 0,
  pilotDailyRate: 0,
  hotelMealCost: 0,
  hotelMealDays: 0,
  landingTaxes: 0,
  hangarageOutside: 0,
  hangarageOutsideDays: 0,

  fixedHangarage: 0,
  crewSalary: 0,
  navigationUpdates: 0,
  preventiveMaintenance: 0,
  maintenancePerHour: 0,
  insurance: 0,
  radioTaxes: 0,
  trainingExams: 0,
  otherCosts: 0,

  engineOverhaul: 0,
  propellerOverhaul: 0,
  magnetoOverhaul: 0,
  turboOverhaul: 0,
  alternatorOverhaul: 0,
  sixYearMaintenance: 0,
};

export function CostSimulator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);

  // Buscar aerodromes
  const { data: aerodromes = [] } = useQuery({
    queryKey: ['aerodromes-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aerodromes')
        .select('id, designativo, nome')
        .order('designativo');
      if (error) console.error('Erro ao buscar aerodromes:', error);
      return data || [];
    },
  });

  // Buscar aeronaves
  const { data: aircraft = [], refetch: refetchAircraft } = useQuery({
    queryKey: ['aircraft-all'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('aeronave')
        .select('id, matricula, modelo, fabricante, tipo_aeronave')
        .in('status', ['ativo', 'ativa'])
        .order('matricula');
      return data || [];
    },
  });

  const selectedAircraft = useMemo(
    () => (aircraft as any[]).find((a) => a.id === formData.aircraftId),
    [aircraft, formData.aircraftId]
  );

  const tipoAeronave: TipoAeronave | null =
    (selectedAircraft?.tipo_aeronave as TipoAeronave | undefined) ?? null;


  // Buscar média de combustível
  const { data: fuelAverage = 0 } = useQuery({
    queryKey: ['fuel-average', formData.aircraftId],
    queryFn: async () => {
      if (!formData.aircraftId) return 0;
      
      const { data } = await supabase
        .from('abastecimentos')
        .select('litros, horas_voo')
        .eq('aeronave_id', formData.aircraftId)
        .not('horas_voo', 'is', null)
        .not('litros', 'is', null);
      
      if (!data || data.length === 0) return 0;
      
      const totalLitros = data.reduce((sum: number, item: any) => sum + (item.litros || 0), 0);
      const totalHoras = data.reduce((sum: number, item: any) => sum + (item.horas_voo || 0), 0);
      
      return totalHoras > 0 ? totalLitros / totalHoras : 0;
    },
    enabled: !!formData.aircraftId,
  });

  // Carregar simulações salvas
  useEffect(() => {
    if (user?.id) {
      loadSavedSimulations();
    }
  }, [user?.id]);

  const loadSavedSimulations = async () => {
    try {
      const { data } = await supabase
        .from('cost_simulations')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      setSavedSimulations(data?.map(sim => ({
        id: sim.id,
        name: sim.name,
        description: sim.description,
        formData: sim.form_data,
        costs: sim.costs,
        createdAt: sim.created_at,
      })) || []);
    } catch (error) {
      console.error('Erro ao carregar simulações:', error);
    }
  };

  // Atualizar combustível
  useEffect(() => {
    if (fuelAverage > 0) {
      setFormData(prev => ({
        ...prev,
        fuelPerHour: parseFloat(fuelAverage.toFixed(2)),
      }));
    }
  }, [fuelAverage]);

  const costs = useMemo(() => {
    // Se a aeronave está classificada por tipo, ignora automaticamente
    // os campos de longo prazo que não se aplicam (ex.: hélice em jato,
    // magneto em turbina). Caso contrário mantém o cálculo original.
    if (tipoAeronave) {
      return calcularCustosPorTipo(formData as any, tipoAeronave);
    }

    const shortTerm =
      formData.fuelCost +
      formData.pilotDailyRate * formData.journeyDays +
      formData.hotelMealCost +
      formData.landingTaxes +
      formData.hangarageOutside * formData.hangarageOutsideDays;

    const mediumTerm =
      formData.fixedHangarage +
      formData.crewSalary +
      formData.navigationUpdates +
      formData.preventiveMaintenance +
      formData.maintenancePerHour * formData.flightTimeRoundTrip * formData.monthlyFlights +
      formData.insurance +
      formData.radioTaxes +
      formData.trainingExams +
      formData.otherCosts;

    const longTerm =
      formData.engineOverhaul +
      formData.propellerOverhaul +
      formData.magnetoOverhaul +
      formData.turboOverhaul +
      formData.alternatorOverhaul +
      formData.sixYearMaintenance;

    const monthlyFlightHours = formData.flightTimeRoundTrip * formData.monthlyFlights;
    const totalCost = shortTerm + mediumTerm + longTerm;
    const hourlyRate = monthlyFlightHours > 0 ? totalCost / monthlyFlightHours : 0;

    return { shortTerm, mediumTerm, longTerm, total: totalCost, hourlyRate };
  }, [formData, tipoAeronave]);

  // Mutation para classificar a aeronave (tipo_aeronave)
  const queryClient = useQueryClient();
  const [savingTipo, setSavingTipo] = useState(false);
  const saveTipoAeronave = async (novoTipo: TipoAeronave) => {
    if (!formData.aircraftId) return;
    try {
      setSavingTipo(true);
      const { error } = await (supabase as any)
        .from('aeronave')
        .update({ tipo_aeronave: novoTipo })
        .eq('id', formData.aircraftId);
      if (error) throw error;
      toast.success(`Aeronave classificada como ${TIPO_AERONAVE_LABELS[novoTipo]}`);
      await refetchAircraft();
      queryClient.invalidateQueries({ queryKey: ['aircraft-all'] });
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao salvar classificação da aeronave');
    } finally {
      setSavingTipo(false);
    }
  };


  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleAircraftChange = (id: string, label: string) => {
    setFormData(prev => ({
      ...prev,
      aircraftId: id,
      aircraftName: label,
    }));
  };

  const handleOriginChange = (id: string, label: string) => {
    setFormData(prev => ({
      ...prev,
      originId: id,
      originName: label,
    }));
  };

  const handleDestinationChange = (id: string, label: string) => {
    setFormData(prev => ({
      ...prev,
      destinationId: id,
      destinationName: label,
    }));
  };

  // Preparar dados para combobox
  const aerodromesCombobox = (aerodromes as any[]).map((a: any) => ({
    id: a.id,
    label: `${a.designativo} - ${a.nome}`,
  }));

  const aircraftCombobox = aircraft.map((a: any) => ({
    id: a.id,
    label: `${a.matricula} - ${a.modelo}`,
  }));

  const saveSimulation = async (name: string, description?: string) => {
    if (!user?.id) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      const { error } = await supabase
        .from('cost_simulations')
        .insert({
          user_id: user.id,
          aircraft_id: formData.aircraftId || null,
          name,
          description,
          form_data: formData,
          costs,
        });

      if (error) throw error;
      
      toast.success('Simulação salva com sucesso!');
      loadSavedSimulations();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar simulação');
    }
  };

  const deleteSimulation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cost_simulations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Simulação deletada');
      loadSavedSimulations();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao deletar simulação');
    }
  };

  const loadSimulation = (sim: SavedSimulation) => {
    setFormData(sim.formData);
    toast.success('Simulação carregada');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const chartData = [
    { name: 'Curto Prazo', value: costs.shortTerm, color: '#10B981' },
    { name: 'Médio Prazo', value: costs.mediumTerm, color: '#F59E0B' },
    { name: 'Longo Prazo', value: costs.longTerm, color: '#8B5CF6' },
  ];

  const timelineData = [
    { period: '0-29 dias', cost: costs.shortTerm, fill: '#10B981' },
    { period: '30 dias-1 ano', cost: costs.mediumTerm, fill: '#F59E0B' },
    { period: '1-10 anos', cost: costs.longTerm, fill: '#8B5CF6' },
  ];

  return (
    <div className="flex-1 p-2 md:p-4 lg:p-6 space-y-4 md:space-y-6 max-w-full overflow-x-hidden">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group w-fit text-xs md:text-sm"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        <span className="font-medium">Voltar</span>
      </button>

      {/* Hero Section */}
      <div className="relative rounded-lg md:rounded-2xl overflow-hidden border border-white/[0.05] shadow-lg bg-gradient-to-r from-primary/10 via-transparent to-transparent">
        <div className="relative h-20 md:h-32 lg:h-40 flex items-center px-3 md:px-6 lg:px-8">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 bg-primary/20 rounded-lg md:rounded-xl border border-primary/30">
              <Plane className="w-5 md:w-7 h-5 md:h-7 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-0.5 md:mb-1">
                Análise Financeira
              </p>
              <h1 className="text-base md:text-2xl lg:text-3xl font-bold text-foreground truncate">Simulador de Custos</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1 hidden sm:block truncate">
                Calcule custos operacionais com dados em tempo real
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 auto-rows-max lg:auto-rows-max">
        {/* Left Panel - Inputs (Mobile: Full width, Desktop: 1/3) */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] sticky top-4 md:top-6">
            <CardHeader className="pb-2 md:pb-3">
              <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                <Plane className="w-4 h-4 text-primary" />
                Parâmetros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 max-h-[70vh] overflow-y-auto">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-white/[0.02] border border-white/[0.05] text-xs md:text-sm h-8 md:h-10">
                  <TabsTrigger value="basic">Básico</TabsTrigger>
                  <TabsTrigger value="short">Curto</TabsTrigger>
                  <TabsTrigger value="medium">Médio</TabsTrigger>
                </TabsList>

                {/* Basic Tab */}
                <TabsContent value="basic" className="space-y-3 mt-3">
                  <div>
                    <Label className="text-xs md:text-sm">Aeronave</Label>
                    <SearchableCombobox
                      items={aircraftCombobox}
                      value={formData.aircraftId}
                      onChange={handleAircraftChange}
                      placeholder="Selecione aeronave"
                      searchPlaceholder="Buscar matrícula..."
                    />
                  </div>

                  {/* Classificação do tipo da aeronave — define quais custos
                      de longo prazo se aplicam (hélice, magneto, seção quente...) */}
                  {selectedAircraft && (
                    <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-2 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs flex items-center gap-1">
                          <Settings2 className="w-3 h-3" />
                          Tipo de motorização
                        </Label>
                        {tipoAeronave ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {TIPO_AERONAVE_LABELS[tipoAeronave]}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40">
                            Não classificada
                          </Badge>
                        )}
                      </div>
                      <Select
                        value={tipoAeronave ?? sugerirTipoAeronave(selectedAircraft.modelo) ?? ''}
                        onValueChange={(v) => saveTipoAeronave(v as TipoAeronave)}
                        disabled={savingTipo}
                      >
                        <SelectTrigger className="h-8 text-xs bg-white/[0.02] border-white/[0.05]">
                          <SelectValue placeholder="Classificar aeronave..." />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_AERONAVE.map((t) => (
                            <SelectItem key={t} value={t} className="text-xs">
                              {TIPO_AERONAVE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!tipoAeronave && (
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Sem classificação o cálculo soma todos os itens de longo prazo.
                          Classifique 1x para ignorar automaticamente os que não se aplicam
                          (ex.: hélice em jato, magneto em turbina).
                        </p>
                      )}
                    </div>
                  )}


                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Horas/Ano</Label>
                      <Input
                        type="number"
                        value={formData.hoursPerYear}
                        onChange={(e) => handleInputChange('hoursPerYear', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Cotas</Label>
                      <Input
                        type="number"
                        value={formData.numberOfShares}
                        onChange={(e) => handleInputChange('numberOfShares', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs md:text-sm">Origem</Label>
                    <SearchableCombobox
                      items={aerodromesCombobox}
                      value={formData.originId}
                      onChange={handleOriginChange}
                      placeholder="Selecione origem"
                      searchPlaceholder="Buscar ICAO ou nome..."
                    />
                  </div>

                  <div>
                    <Label className="text-xs md:text-sm">Destino</Label>
                    <SearchableCombobox
                      items={aerodromesCombobox}
                      value={formData.destinationId}
                      onChange={handleDestinationChange}
                      placeholder="Selecione destino"
                      searchPlaceholder="Buscar ICAO ou nome..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Tempo Voo (h)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.flightTimeRoundTrip}
                        onChange={(e) => handleInputChange('flightTimeRoundTrip', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Dias</Label>
                      <Input
                        type="number"
                        value={formData.journeyDays}
                        onChange={(e) => handleInputChange('journeyDays', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Voos/Mês</Label>
                    <Input
                      type="number"
                      value={formData.monthlyFlights}
                      onChange={(e) => handleInputChange('monthlyFlights', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                    />
                  </div>
                </TabsContent>

                {/* Short Term Tab */}
                <TabsContent value="short" className="space-y-2 mt-3">
                  <div>
                    <Label className="text-xs">Combustível (R$)</Label>
                    <Input
                      type="number"
                      value={formData.fuelCost}
                      onChange={(e) => handleInputChange('fuelCost', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">R$/Hora</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.fuelPerHour}
                        onChange={(e) => handleInputChange('fuelPerHour', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Horas</Label>
                      <Input
                        type="number"
                        value={formData.fuelHours}
                        onChange={(e) => handleInputChange('fuelHours', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Hotel/Alimentação (R$)</Label>
                    <Input
                      type="number"
                      value={formData.hotelMealCost}
                      onChange={(e) => handleInputChange('hotelMealCost', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Taxas Pousos (R$)</Label>
                    <Input
                      type="number"
                      value={formData.landingTaxes}
                      onChange={(e) => handleInputChange('landingTaxes', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                    />
                  </div>
                </TabsContent>

                {/* Medium Term Tab */}
                <TabsContent value="medium" className="space-y-2 mt-3">
                  <div>
                    <Label className="text-xs">Hangaragem Fixa (R$)</Label>
                    <Input
                      type="number"
                      value={formData.fixedHangarage}
                      onChange={(e) => handleInputChange('fixedHangarage', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Salário Tripulação (R$)</Label>
                    <Input
                      type="number"
                      value={formData.crewSalary}
                      onChange={(e) => handleInputChange('crewSalary', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Seguros (R$)</Label>
                    <Input
                      type="number"
                      value={formData.insurance}
                      onChange={(e) => handleInputChange('insurance', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Manutenção/Hora (R$)</Label>
                    <Input
                      type="number"
                      value={formData.maintenancePerHour}
                      onChange={(e) => handleInputChange('maintenancePerHour', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs h-8 md:h-10"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => setFormData(DEFAULT_FORM_DATA)}
                  variant="outline"
                  className="w-full border-white/[0.05] text-xs md:text-sm h-8 md:h-10"
                >
                  Resetar
                </Button>
                <Button
                  onClick={() => {
                    const name = prompt('Nome da simulação:');
                    if (name) saveSimulation(name);
                  }}
                  className="w-full bg-primary/90 hover:bg-primary text-xs md:text-sm h-8 md:h-10"
                >
                  <Save className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Results (Mobile: Full width, Desktop: 2/3) */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6 order-1 lg:order-2">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] border-l-4 border-l-emerald-500/50">
              <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
                <p className="text-xs text-muted-foreground mb-1">Curto Prazo</p>
                <p className="text-lg md:text-2xl font-bold text-emerald-400 truncate">{formatCurrency(costs.shortTerm)}</p>
                <p className="text-xs text-muted-foreground mt-1">Até 29 dias</p>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] border-l-4 border-l-amber-500/50">
              <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
                <p className="text-xs text-muted-foreground mb-1">Médio Prazo</p>
                <p className="text-lg md:text-2xl font-bold text-amber-400 truncate">{formatCurrency(costs.mediumTerm)}</p>
                <p className="text-xs text-muted-foreground mt-1">30 dias-1 ano</p>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] border-l-4 border-l-purple-500/50">
              <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
                <p className="text-xs text-muted-foreground mb-1">Longo Prazo</p>
                <p className="text-lg md:text-2xl font-bold text-purple-400 truncate">{formatCurrency(costs.longTerm)}</p>
                <p className="text-xs text-muted-foreground mt-1">Até 10 anos</p>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] border-l-4 border-l-primary/50">
              <CardContent className="pt-3 md:pt-4 p-3 md:p-4">
                <p className="text-xs text-muted-foreground mb-1">Total</p>
                <p className="text-lg md:text-2xl font-bold text-primary truncate">{formatCurrency(costs.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatCurrency(costs.hourlyRate)}/h</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05]">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="text-sm md:text-base">Distribuição</CardTitle>
              </CardHeader>
              <CardContent className="h-64 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05]">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="text-sm md:text-base">Por Período</CardTitle>
              </CardHeader>
              <CardContent className="h-64 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '11px' }} />
                    <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '11px' }} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="cost" fill="#FF8C00" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Saved Simulations */}
          {savedSimulations.length > 0 && (
            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05]">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="text-sm md:text-base">Simulações Salvas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedSimulations.map((sim) => (
                    <div key={sim.id} className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs md:text-sm font-medium text-foreground truncate">{sim.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(sim.costs.total)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => loadSimulation(sim)}
                          className="h-7 w-7 md:h-8 md:w-8 p-0"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteSimulation(sim.id)}
                          className="h-7 w-7 md:h-8 md:w-8 p-0 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
