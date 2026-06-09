import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plane, TrendingUp, Clock, DollarSign, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Simulador de Custos de Aeronaves - Integrado ao Portal Share Brasil
 * 
 * Busca dados do Supabase:
 * - Aerodromes para origem/destino
 * - Abastecimentos para calcular média de combustível
 * - Aeronaves disponíveis
 * 
 * Integra com APIs externas:
 * - DECEA (weather, NOTAM)
 * - Share Brasil (dados adicionais)
 */

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
  destinationId: string;
  flightTimeRoundTrip: number;
  journeyDays: number;
  monthlyFlights: number;
  
  // Curto Prazo
  fuelCost: number;
  fuelPerHour: number;
  fuelHours: number;
  pilotDailyRate: number;
  hotelMealCost: number;
  hotelMealDays: number;
  landingTaxes: number;
  hangarageOutside: number;
  hangarageOutsideDays: number;
  
  // Médio Prazo
  fixedHangarage: number;
  crewSalary: number;
  navigationUpdates: number;
  preventiveMaintenance: number;
  maintenancePerHour: number;
  insurance: number;
  radioTaxes: number;
  trainingExams: number;
  otherCosts: number;
  
  // Longo Prazo
  engineOverhaul: number;
  propellerOverhaul: number;
  magnetoOverhaul: number;
  turboOverhaul: number;
  alternatorOverhaul: number;
  sixYearMaintenance: number;
}

const DEFAULT_FORM_DATA: FormData = {
  aircraftId: '',
  aircraftName: 'Selecione uma aeronave',
  hoursPerYear: 100,
  numberOfShares: 2,
  originId: '',
  destinationId: '',
  flightTimeRoundTrip: 4.5,
  journeyDays: 3,
  monthlyFlights: 1,
  
  fuelCost: 12555,
  fuelPerHour: 4.5,
  fuelHours: 620,
  pilotDailyRate: 0,
  hotelMealCost: 660,
  hotelMealDays: 3,
  landingTaxes: 1000,
  hangarageOutside: 700,
  hangarageOutsideDays: 3,
  
  fixedHangarage: 5400,
  crewSalary: 16200,
  navigationUpdates: 225,
  preventiveMaintenance: 450,
  maintenancePerHour: 700,
  insurance: 2250,
  radioTaxes: 9,
  trainingExams: 4500,
  otherCosts: 1350,
  
  engineOverhaul: 8325,
  propellerOverhaul: 0,
  magnetoOverhaul: 0,
  turboOverhaul: 0,
  alternatorOverhaul: 0,
  sixYearMaintenance: 2000,
};

export function CostSimulator() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);

  // Buscar aerodromes do Supabase
  const { data: aerodromes = [] } = useQuery({
    queryKey: ['aerodromes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aerodromes')
        .select('id, icao, name, city')
        .order('name');
      
      if (error) {
        console.error('Erro ao buscar aerodromes:', error);
        return [];
      }
      return data || [];
    },
  });

  // Buscar aeronaves
  const { data: aircraft = [] } = useQuery({
    queryKey: ['aircraft-for-simulator'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aeronave')
        .select('id, matricula, modelo, fabricante')
        .eq('status', 'ativo')
        .order('matricula');
      
      if (error) {
        console.error('Erro ao buscar aeronaves:', error);
        return [];
      }
      return data || [];
    },
  });

  // Buscar média de combustível por hora
  const { data: fuelAverage = 0 } = useQuery({
    queryKey: ['fuel-average', formData.aircraftId],
    queryFn: async () => {
      if (!formData.aircraftId) return 0;
      
      const { data, error } = await supabase
        .from('abastecimentos')
        .select('litros, horas_voo')
        .eq('aeronave_id', formData.aircraftId)
        .not('horas_voo', 'is', null)
        .not('litros', 'is', null);
      
      if (error || !data || data.length === 0) return 0;
      
      const totalLitros = data.reduce((sum: number, item: any) => sum + (item.litros || 0), 0);
      const totalHoras = data.reduce((sum: number, item: any) => sum + (item.horas_voo || 0), 0);
      
      return totalHoras > 0 ? totalLitros / totalHoras : 0;
    },
    enabled: !!formData.aircraftId,
  });

  // Atualizar combustível quando aeronave muda
  useEffect(() => {
    if (fuelAverage > 0) {
      setFormData(prev => ({
        ...prev,
        fuelPerHour: parseFloat(fuelAverage.toFixed(2)),
      }));
    }
  }, [fuelAverage]);

  const costs = useMemo(() => {
    const shortTerm = 
      formData.fuelCost +
      (formData.pilotDailyRate * formData.journeyDays) +
      formData.hotelMealCost +
      formData.landingTaxes +
      (formData.hangarageOutside * formData.hangarageOutsideDays);

    const mediumTerm =
      formData.fixedHangarage +
      formData.crewSalary +
      formData.navigationUpdates +
      formData.preventiveMaintenance +
      (formData.maintenancePerHour * formData.flightTimeRoundTrip * formData.monthlyFlights) +
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

    return {
      shortTerm,
      mediumTerm,
      longTerm,
      total: totalCost,
      hourlyRate,
    };
  }, [formData]);

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleAircraftChange = (aircraftId: string) => {
    const selectedAircraft = aircraft.find((a: any) => a.id === aircraftId);
    setFormData(prev => ({
      ...prev,
      aircraftId,
      aircraftName: selectedAircraft ? `${selectedAircraft.matricula} - ${selectedAircraft.modelo}` : 'Selecione uma aeronave',
    }));
  };

  const chartData = [
    {
      name: 'Curto Prazo',
      value: costs.shortTerm,
      color: '#10B981',
    },
    {
      name: 'Médio Prazo',
      value: costs.mediumTerm,
      color: '#F59E0B',
    },
    {
      name: 'Longo Prazo',
      value: costs.longTerm,
      color: '#8B5CF6',
    },
  ];

  const timelineData = [
    { period: '0-29 dias', cost: costs.shortTerm, fill: '#10B981' },
    { period: '30 dias-1 ano', cost: costs.mediumTerm, fill: '#F59E0B' },
    { period: '1-10 anos', cost: costs.longTerm, fill: '#8B5CF6' },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="flex-1 p-3 md:p-4 lg:p-6 space-y-4 md:space-y-8">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group w-fit"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs md:text-sm font-medium">Voltar</span>
      </button>

      {/* Hero Section */}
      <div className="relative rounded-xl md:rounded-2xl overflow-hidden border border-white/[0.05] shadow-lg bg-gradient-to-r from-primary/10 via-transparent to-transparent">
        <div className="relative h-28 md:h-36 lg:h-44 flex items-center px-4 md:px-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg md:rounded-xl border border-primary/30">
              <Plane className="w-6 md:w-8 h-6 md:h-8 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1 md:mb-2">
                Análise Financeira
              </p>
              <h1 className="text-lg md:text-2xl lg:text-3xl font-bold text-foreground">Simulador de Custos</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2 max-w-md hidden sm:block">
                Calcule custos operacionais de suas aeronaves com dados em tempo real
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Inputs */}
        <div className="lg:col-span-1">
          <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] sticky top-6">
            <CardHeader className="pb-3 md:pb-4">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Plane className="w-4 h-4 text-primary" />
                Parâmetros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-white/[0.02] border border-white/[0.05]">
                  <TabsTrigger value="basic" className="text-xs">Básico</TabsTrigger>
                  <TabsTrigger value="short" className="text-xs">Curto</TabsTrigger>
                  <TabsTrigger value="medium" className="text-xs">Médio</TabsTrigger>
                </TabsList>

                {/* Basic Tab */}
                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div>
                    <Label className="text-xs md:text-sm">Aeronave</Label>
                    <Select value={formData.aircraftId} onValueChange={handleAircraftChange}>
                      <SelectTrigger className="mt-1 bg-white/[0.02] border-white/[0.05]">
                        <SelectValue placeholder="Selecione uma aeronave" />
                      </SelectTrigger>
                      <SelectContent>
                        {aircraft.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.matricula} - {a.modelo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs md:text-sm">Horas/Ano</Label>
                      <Input
                        type="number"
                        value={formData.hoursPerYear}
                        onChange={(e) => handleInputChange('hoursPerYear', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs md:text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs md:text-sm">Cotas</Label>
                      <Input
                        type="number"
                        value={formData.numberOfShares}
                        onChange={(e) => handleInputChange('numberOfShares', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs md:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs md:text-sm">Origem</Label>
                    <Select value={formData.originId} onValueChange={(value) => handleInputChange('originId', value)}>
                      <SelectTrigger className="mt-1 bg-white/[0.02] border-white/[0.05]">
                        <SelectValue placeholder="Selecione origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {aerodromes.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.icao} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs md:text-sm">Destino</Label>
                    <Select value={formData.destinationId} onValueChange={(value) => handleInputChange('destinationId', value)}>
                      <SelectTrigger className="mt-1 bg-white/[0.02] border-white/[0.05]">
                        <SelectValue placeholder="Selecione destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {aerodromes.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.icao} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs md:text-sm">Tempo Voo (h)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.flightTimeRoundTrip}
                        onChange={(e) => handleInputChange('flightTimeRoundTrip', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs md:text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs md:text-sm">Dias</Label>
                      <Input
                        type="number"
                        value={formData.journeyDays}
                        onChange={(e) => handleInputChange('journeyDays', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs md:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs md:text-sm">Voos/Mês</Label>
                    <Input
                      type="number"
                      value={formData.monthlyFlights}
                      onChange={(e) => handleInputChange('monthlyFlights', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs md:text-sm"
                    />
                  </div>
                </TabsContent>

                {/* Short Term Tab */}
                <TabsContent value="short" className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                  <div>
                    <Label className="text-xs">Combustível Total (R$)</Label>
                    <Input
                      type="number"
                      value={formData.fuelCost}
                      onChange={(e) => handleInputChange('fuelCost', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
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
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Horas</Label>
                      <Input
                        type="number"
                        value={formData.fuelHours}
                        onChange={(e) => handleInputChange('fuelHours', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Hotel/Alimentação (R$)</Label>
                    <Input
                      type="number"
                      value={formData.hotelMealCost}
                      onChange={(e) => handleInputChange('hotelMealCost', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Taxas Pousos (R$)</Label>
                    <Input
                      type="number"
                      value={formData.landingTaxes}
                      onChange={(e) => handleInputChange('landingTaxes', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Hangaragem (R$)</Label>
                      <Input
                        type="number"
                        value={formData.hangarageOutside}
                        onChange={(e) => handleInputChange('hangarageOutside', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Dias</Label>
                      <Input
                        type="number"
                        value={formData.hangarageOutsideDays}
                        onChange={(e) => handleInputChange('hangarageOutsideDays', e.target.value)}
                        className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Medium Term Tab */}
                <TabsContent value="medium" className="space-y-3 mt-4 max-h-96 overflow-y-auto">
                  <div>
                    <Label className="text-xs">Hangaragem Fixa (R$)</Label>
                    <Input
                      type="number"
                      value={formData.fixedHangarage}
                      onChange={(e) => handleInputChange('fixedHangarage', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Salário Tripulação (R$)</Label>
                    <Input
                      type="number"
                      value={formData.crewSalary}
                      onChange={(e) => handleInputChange('crewSalary', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Seguros (R$)</Label>
                    <Input
                      type="number"
                      value={formData.insurance}
                      onChange={(e) => handleInputChange('insurance', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Manutenção Preventiva (R$)</Label>
                    <Input
                      type="number"
                      value={formData.preventiveMaintenance}
                      onChange={(e) => handleInputChange('preventiveMaintenance', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Manutenção/Hora (R$)</Label>
                    <Input
                      type="number"
                      value={formData.maintenancePerHour}
                      onChange={(e) => handleInputChange('maintenancePerHour', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Treinamento/Exames (R$)</Label>
                    <Input
                      type="number"
                      value={formData.trainingExams}
                      onChange={(e) => handleInputChange('trainingExams', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Outros Custos (R$)</Label>
                    <Input
                      type="number"
                      value={formData.otherCosts}
                      onChange={(e) => handleInputChange('otherCosts', e.target.value)}
                      className="mt-1 bg-white/[0.02] border-white/[0.05] text-xs"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                onClick={() => setFormData(DEFAULT_FORM_DATA)}
                variant="outline"
                className="w-full mt-4 border-white/[0.05] text-xs md:text-sm"
              >
                Resetar Valores
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] border-l-4 border-l-emerald-500/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground mb-1">Curto Prazo</p>
                    <p className="text-2xl md:text-3xl font-bold text-emerald-400">{formatCurrency(costs.shortTerm)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Até 29 dias</p>
                  </div>
                  <Clock className="w-6 md:w-8 h-6 md:h-8 text-emerald-400 opacity-30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] border-l-4 border-l-amber-500/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground mb-1">Médio Prazo</p>
                    <p className="text-2xl md:text-3xl font-bold text-amber-400">{formatCurrency(costs.mediumTerm)}</p>
                    <p className="text-xs text-muted-foreground mt-2">30 dias a 1 ano</p>
                  </div>
                  <TrendingUp className="w-6 md:w-8 h-6 md:h-8 text-amber-400 opacity-30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] border-l-4 border-l-purple-500/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground mb-1">Longo Prazo</p>
                    <p className="text-2xl md:text-3xl font-bold text-purple-400">{formatCurrency(costs.longTerm)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Até 10 anos</p>
                  </div>
                  <AlertCircle className="w-6 md:w-8 h-6 md:h-8 text-purple-400 opacity-30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05] border-l-4 border-l-primary/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground mb-1">Custo Total</p>
                    <p className="text-2xl md:text-3xl font-bold text-primary">{formatCurrency(costs.total)}</p>
                    <p className="text-xs text-muted-foreground mt-2">Por hora: {formatCurrency(costs.hourlyRate)}</p>
                  </div>
                  <DollarSign className="w-6 md:w-8 h-6 md:h-8 text-primary opacity-30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Distribuição de Custos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                      outerRadius={100}
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

            {/* Bar Chart */}
            <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base md:text-lg">Custos por Período</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="period" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                    <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="cost" fill="#FF8C00" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <Card className="bg-white/[0.02] backdrop-blur-md border-white/[0.05]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-lg">Resumo Detalhado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="text-emerald-400 font-semibold flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    Curto Prazo
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Combustível:</span>
                      <span>{formatCurrency(formData.fuelCost)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Hotel/Alimentação:</span>
                      <span>{formatCurrency(formData.hotelMealCost)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Taxas:</span>
                      <span>{formatCurrency(formData.landingTaxes)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-amber-400 font-semibold flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                    Médio Prazo
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Hangaragem Fixa:</span>
                      <span>{formatCurrency(formData.fixedHangarage)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Salário:</span>
                      <span>{formatCurrency(formData.crewSalary)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Seguros:</span>
                      <span>{formatCurrency(formData.insurance)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-purple-400 font-semibold flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    Longo Prazo
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Revisão Motor:</span>
                      <span>{formatCurrency(formData.engineOverhaul)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Revisão Hélices:</span>
                      <span>{formatCurrency(formData.propellerOverhaul)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Manutenção 6 anos:</span>
                      <span>{formatCurrency(formData.sixYearMaintenance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
