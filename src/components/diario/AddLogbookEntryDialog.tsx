import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatBRL, parseBRL } from "@/lib/utils";
import { CalendarIcon, Info } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AddLogbookEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  logbookMonthId?: string | null;
  prefilledDate?: Date;
  onSuccess?: () => void;
}

export function AddLogbookEntryDialog({ open, onOpenChange, aircraftId, prefilledDate, onSuccess, logbookMonthId }: AddLogbookEntryDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(prefilledDate);
  const [departureOpen, setDepartureOpen] = useState(false);
  const [arrivalOpen, setArrivalOpen] = useState(false);

  useEffect(() => {
    if (prefilledDate) {
      setDate(prefilledDate);
    }
  }, [prefilledDate]);

  const { data: aerodromes } = useQuery({
    queryKey: ['aerodromes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aerodromes')
        .select('*')
        .order('designativo');
      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState({
    departure_airport: "",
    arrival_airport: "",
    ac_time: "",
    departure_time: "",
    pou_time: "",
    cor_time: "",
    crew_checkin_time: "",
    flight_time_hours: "",
    flight_time_minutes: "",
    night_time_hours: "",
    night_time_minutes: "",
    ifr_count: "",
    landings: "1",
    fuel_added: "",
    fuel_liters: "",
    fuel_cell: "",
    pc: "",
    isc: "",
    daily_rate: "",
    extras: "",
    flight_type: "",
    remarks: "",
    distance_nm: "",
  });

  // Wizard step state
  const [step, setStep] = useState<number>(1);
  const totalSteps = 4;
  const [saved, setSaved] = useState(false);

  const validateStep = (s: number) => {
    // Simple validations per step
    if (s === 1) {
      if (!date) {
        toast({ title: 'Erro', description: 'Selecione a data do voo.', variant: 'destructive' });
        return false;
      }
      if (!formData.departure_airport || !formData.arrival_airport) {
        toast({ title: 'Erro', description: 'Preencha DE e PARA (aeroportos).', variant: 'destructive' });
        return false;
      }
      // Distância não negativa
      if (formData.distance_nm && parseFloat(formData.distance_nm) < 0) {
        toast({ title: 'Erro', description: 'A distância deve ser um valor positivo.', variant: 'destructive' });
        return false;
      }
    }
    if (s === 2) {
      // Validar formato HH:MM
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!formData.ac_time || !timeRegex.test(formData.ac_time)) {
        toast({ title: 'Erro', description: 'AC inválido. Use o formato HH:MM.', variant: 'destructive' });
        return false;
      }
      if (!formData.cor_time || !timeRegex.test(formData.cor_time)) {
        toast({ title: 'Erro', description: 'COR inválido. Use o formato HH:MM.', variant: 'destructive' });
        return false;
      }
      // minutos válidos
      const [, acMin] = formData.ac_time.split(':').map(Number);
      const [, corMin] = formData.cor_time.split(':').map(Number);
      if (acMin < 0 || acMin > 59 || corMin < 0 || corMin > 59) {
        toast({ title: 'Erro', description: 'Minutos devem estar entre 0 e 59.', variant: 'destructive' });
        return false;
      }
    }
    if (s === 3) {
      if ((formData.flight_time_hours === '' || formData.flight_time_hours === null) && (formData.flight_time_minutes === '' || formData.flight_time_minutes === null)) {
        toast({ title: 'Erro', description: 'Informe o tempo de voo (horas e/ou minutos).', variant: 'destructive' });
        return false;
      }
      // Valida minutos entre 0 e 59
      if (formData.flight_time_minutes) {
        const fm = parseInt(formData.flight_time_minutes as unknown as string, 10);
        if (isNaN(fm) || fm < 0 || fm > 59) {
          toast({ title: 'Erro', description: 'Minutos do tempo de voo devem estar entre 0 e 59.', variant: 'destructive' });
          return false;
        }
      }
      // Fuel and distance non-negative
      if (formData.fuel_added && parseFloat(formData.fuel_added) < 0) {
        toast({ title: 'Erro', description: 'Fuel deve ser um valor não-negativo.', variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      if (step < totalSteps) setStep(s => s + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(s => s - 1);
  };

  // Calcular distância entre aeródromos usando Haversine
  const calculateDistance = async (departure: string, arrival: string) => {
    if (!departure || !arrival) return;

    const depAero = aerodromes?.find(a => a.designativo === departure.toUpperCase());
    const arrAero = aerodromes?.find(a => a.designativo === arrival.toUpperCase());

    if (!depAero?.coordenadas || !arrAero?.coordenadas) return;

    try {
      const [lat1Str, lon1Str] = depAero.coordenadas.split(',');
      const [lat2Str, lon2Str] = arrAero.coordenadas.split(',');
      
      const lat1 = parseFloat(lat1Str);
      const lon1 = parseFloat(lon1Str);
      const lat2 = parseFloat(lat2Str);
      const lon2 = parseFloat(lon2Str);

      const R = 3440.065; // Raio da Terra em milhas náuticas
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      setFormData(prev => ({ ...prev, distance_nm: Math.round(distance * 100) / 100 + "" }));
    } catch (err) {
      console.error('Erro ao calcular distância:', err);
    }
  };

  // Calcular horário de apresentação (30 min antes do AC)
  const calculateCheckinTime = (acTime: string) => {
    if (!acTime) return "";
    
    try {
      const [hours, minutes] = acTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes - 30;
      const checkinHours = Math.floor(totalMinutes / 60);
      const checkinMinutes = totalMinutes % 60;
      
      return `${String(checkinHours).padStart(2, '0')}:${String(checkinMinutes).padStart(2, '0')}`;
    } catch {
      return "";
    }
  };

  // Calcular tempo de voo (AC até COR)
  const calculateFlightTime = (acTime: string, corTime: string) => {
    if (!acTime || !corTime) return { hours: "", minutes: "" };
    
    try {
      const [acHours, acMinutes] = acTime.split(':').map(Number);
      const [corHours, corMinutes] = corTime.split(':').map(Number);
      
      const acTotalMinutes = acHours * 60 + acMinutes;
      const corTotalMinutes = corHours * 60 + corMinutes;
      
      let diffMinutes = corTotalMinutes - acTotalMinutes;
      if (diffMinutes < 0) diffMinutes += 24 * 60; // Se passou da meia-noite
      
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      
      return { hours: hours.toString(), minutes: minutes.toString() };
    } catch {
      return { hours: "", minutes: "" };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) {
      toast({
        title: "Erro",
        description: "Selecione a data do voo.",
        variant: "destructive",
      });
      return;
    }

    // Validar horário de apresentação (não pode ser menos de 30 min antes do AC)
    if (formData.crew_checkin_time && formData.ac_time) {
      const [checkinHours, checkinMinutes] = formData.crew_checkin_time.split(':').map(Number);
      const [acHours, acMinutes] = formData.ac_time.split(':').map(Number);
      
      const checkinTotal = checkinHours * 60 + checkinMinutes;
      const acTotal = acHours * 60 + acMinutes;
      
      if (acTotal - checkinTotal < 30) {
        toast({
          title: "Erro",
          description: "O horário de apresentação deve ser no mínimo 30 minutos antes do acionamento.",
          variant: "destructive",
        });
        return;
      }
    }

  setLoading(true);

  try {
      const flightHours = parseFloat(formData.flight_time_hours) || 0;
      const flightMinutes = parseFloat(formData.flight_time_minutes) || 0;
      const totalTime = flightHours + (flightMinutes / 60);

      const { error } = await supabase.from('logbook_entries').insert([{
        logbook_month_id: (typeof logbookMonthId !== 'undefined') ? logbookMonthId : null,
        aircraft_id: aircraftId,
        entry_date: format(date, 'yyyy-MM-dd'),
        departure_aerodrome: formData.departure_airport,
        arrival_aerodrome: formData.arrival_airport,
        flight_nature: 'PV',
        pic_canac: '' as any,
        ac_time: formData.ac_time ? new Date(`${format(date, 'yyyy-MM-dd')}T${formData.ac_time}:00`).toISOString() : null,
        dep_time: formData.departure_time ? new Date(`${format(date, 'yyyy-MM-dd')}T${formData.departure_time}:00`).toISOString() : null,
        pou_time: formData.pou_time ? new Date(`${format(date, 'yyyy-MM-dd')}T${formData.pou_time}:00`).toISOString() : null,
        cor_time: formData.cor_time ? new Date(`${format(date, 'yyyy-MM-dd')}T${formData.cor_time}:00`).toISOString() : null,
        crew_checkin_time: formData.crew_checkin_time ? new Date(`${format(date, 'yyyy-MM-dd')}T${formData.crew_checkin_time}:00`).toISOString() : null,
        time: totalTime,
        total_time: totalTime,
        night_hours: parseFloat(formData.night_time_hours) || 0,
        ifr_time: parseFloat(formData.ifr_count) || 0,
        pousos: parseInt(formData.landings) || 1,
        fuel_added: parseFloat(formData.fuel_added) || 0,
        celula: parseFloat(formData.fuel_cell) || 0,
        daily_rate: formData.daily_rate ? parseBRL(formData.daily_rate) : null,
        extras: formData.extras || null,
        distance_nm: parseFloat(formData.distance_nm) || 0,
      }]);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Registro adicionado com sucesso.",
      });

      // mostrar confirmação visual antes de fechar
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['logbook-entries'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      onSuccess?.();

      // esperar breve animação de sucesso e então fechar e resetar
      setTimeout(() => {
        onOpenChange(false);
        setDate(undefined);
        setFormData({
          departure_airport: "",
          arrival_airport: "",
          ac_time: "",
          departure_time: "",
          pou_time: "",
          cor_time: "",
          crew_checkin_time: "",
          flight_time_hours: "",
          flight_time_minutes: "",
          night_time_hours: "",
          night_time_minutes: "",
          ifr_count: "",
          landings: "1",
          fuel_added: "",
          fuel_liters: "",
          fuel_cell: "",
          pc: "",
          isc: "",
          daily_rate: "",
          extras: "",
          flight_type: "",
          remarks: "",
          distance_nm: "",
        });
        setSaved(false);
      }, 700);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao adicionar registro.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto relative">
        <DialogHeader>
          <DialogTitle>Adicionar Registro de Voo</DialogTitle>
        </DialogHeader>
        {saved && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 rounded-full p-4 shadow-lg flex items-center justify-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                ✓
              </div>
            </div>
          </div>
        )}
        <form className="space-y-4">
          {/* Step indicator */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Passo {step} de {totalSteps}</div>
              <div className="text-sm font-medium">{step === 1 ? 'Dados básicos' : step === 2 ? 'Horários' : step === 3 ? 'Tempo e combustível' : 'Resumo'}</div>
            </div>
            <div className="w-full h-2 bg-muted rounded overflow-hidden">
              <div
                className="h-2 bg-cyan-600 transition-all"
                style={{ width: `${Math.round((step / totalSteps) * 100)}%` }}
                aria-hidden
              />
            </div>
          </div>

          {/* Step 1 - básicos: data, tipo, aeródromos, distância */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data do Voo *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                        {date ? format(date, "PPP", { locale: pt }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="flight_type">Tipo de Voo</Label>
                  <Input
                    id="flight_type"
                    value={formData.flight_type}
                    onChange={(e) => setFormData({ ...formData, flight_type: e.target.value })}
                    placeholder="TRANSLADO, EXECUTIVO, etc."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="departure_airport">DE (Aeroporto) *</Label>
                  <Popover open={departureOpen} onOpenChange={setDepartureOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {formData.departure_airport || "Selecione ou digite..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Digite o código ICAO..."
                          value={formData.departure_airport}
                          onValueChange={(value) => setFormData({ ...formData, departure_airport: value.toUpperCase() })}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum aeródromo encontrado.</CommandEmpty>
                          <CommandGroup>
                            {aerodromes?.map((aerodrome) => (
                              <CommandItem
                                key={aerodrome.id}
                                value={aerodrome.designativo}
                                onSelect={(value) => {
                                  setFormData({ ...formData, departure_airport: value.toUpperCase() });
                                  setDepartureOpen(false);
                                }}
                              >
                                {aerodrome.designativo} - {aerodrome.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arrival_airport">PARA (Aeroporto) *</Label>
                  <Popover open={arrivalOpen} onOpenChange={setArrivalOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {formData.arrival_airport || "Selecione ou digite..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Digite o código ICAO..."
                          value={formData.arrival_airport}
                          onValueChange={(value) => setFormData({ ...formData, arrival_airport: value.toUpperCase() })}
                        />
                        <CommandList>
                          <CommandEmpty>Nenhum aeródromo encontrado.</CommandEmpty>
                          <CommandGroup>
                            {aerodromes?.map((aerodrome) => (
                              <CommandItem
                                key={aerodrome.id}
                                value={aerodrome.designativo}
                                onSelect={(value) => {
                                  const newFormData = { ...formData, arrival_airport: value.toUpperCase() };
                                  setFormData(newFormData);
                                  setArrivalOpen(false);
                                  // Calcular distância automaticamente
                                  if (formData.departure_airport) {
                                    calculateDistance(formData.departure_airport, value);
                                  }
                                }}
                              >
                                {aerodrome.designativo} - {aerodrome.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crew_checkin_time">Apresentação (UTC)</Label>
                  <div className="relative">
                    <Input
                      id="crew_checkin_time"
                      type="time"
                      step="1"
                      value={formData.crew_checkin_time}
                      onChange={(e) => setFormData({ ...formData, crew_checkin_time: e.target.value })}
                      className="pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">z</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distance_nm">Distância (NM)</Label>
                  <Input
                    id="distance_nm"
                    type="number"
                    step="0.01"
                    value={formData.distance_nm}
                    onChange={(e) => setFormData({ ...formData, distance_nm: e.target.value })}
                    placeholder="Auto-calculado"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2 - Horários */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ac_time">AC (UTC) *</Label>
                  <div className="relative">
                    <Input
                      id="ac_time"
                      type="time"
                      step="1"
                      value={formData.ac_time}
                      onChange={(e) => {
                        const newAcTime = e.target.value;
                        setFormData({ 
                          ...formData, 
                          ac_time: newAcTime,
                          crew_checkin_time: calculateCheckinTime(newAcTime)
                        });
                        // Recalcular tempo de voo se COR já estiver preenchido
                        if (formData.cor_time) {
                          const { hours, minutes } = calculateFlightTime(newAcTime, formData.cor_time);
                          setFormData(prev => ({ ...prev, flight_time_hours: hours, flight_time_minutes: minutes }));
                        }
                      }}
                      required
                      className="pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">z</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departure_time">DEP (UTC) *</Label>
                  <div className="relative">
                    <Input
                      id="departure_time"
                      type="time"
                      step="1"
                      value={formData.departure_time}
                      onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                      required
                      className="pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">z</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pou_time">POU (UTC) *</Label>
                  <div className="relative">
                    <Input
                      id="pou_time"
                      type="time"
                      step="1"
                      value={formData.pou_time}
                      onChange={(e) => setFormData({ ...formData, pou_time: e.target.value })}
                      required
                      className="pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">z</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cor_time">COR (UTC) *</Label>
                  <div className="relative">
                    <Input
                      id="cor_time"
                      type="time"
                      step="1"
                      value={formData.cor_time}
                      onChange={(e) => {
                        const newCorTime = e.target.value;
                        setFormData({ ...formData, cor_time: newCorTime });
                        // Calcular tempo de voo automaticamente
                        if (formData.ac_time) {
                          const { hours, minutes } = calculateFlightTime(formData.ac_time, newCorTime);
                          setFormData(prev => ({ ...prev, flight_time_hours: hours, flight_time_minutes: minutes }));
                        }
                      }}
                      required
                      className="pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">z</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 - Tempo / Combustível */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="flight_time_hours">Tempo Voo (H) *</Label>
                  <Input
                    id="flight_time_hours"
                    type="number"
                    step="1"
                    value={formData.flight_time_hours}
                    onChange={(e) => setFormData({ ...formData, flight_time_hours: e.target.value })}
                    placeholder="1"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="flight_time_minutes">Tempo Voo (M) *</Label>
                  <Input
                    id="flight_time_minutes"
                    type="number"
                    step="1"
                    max="59"
                    value={formData.flight_time_minutes}
                    onChange={(e) => setFormData({ ...formData, flight_time_minutes: e.target.value })}
                    placeholder="30"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="night_time_hours">Noturno (H)</Label>
                  <Input
                    id="night_time_hours"
                    type="number"
                    step="1"
                    value={formData.night_time_hours}
                    onChange={(e) => setFormData({ ...formData, night_time_hours: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="night_time_minutes">Noturno (M)</Label>
                  <Input
                    id="night_time_minutes"
                    type="number"
                    step="1"
                    max="59"
                    value={formData.night_time_minutes}
                    onChange={(e) => setFormData({ ...formData, night_time_minutes: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ifr_count">IFR</Label>
                  <Input
                    id="ifr_count"
                    type="number"
                    value={formData.ifr_count}
                    onChange={(e) => setFormData({ ...formData, ifr_count: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="landings">Pousos</Label>
                  <Input
                    id="landings"
                    type="number"
                    value={formData.landings}
                    onChange={(e) => setFormData({ ...formData, landings: e.target.value })}
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="fuel_added">FUEL</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm">
                            O total de combustível por etapa de voo deve ser registrado com a quantidade existente no momento da partida dos motores, no formato de número inteiro, com arredondamento para o menor se necessário, nas unidades alternativas: massa (kg), volume (L), massa em libras (lb), ou volume em galões (gal).
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="fuel_added"
                    type="number"
                    step="0.1"
                    value={formData.fuel_added}
                    onChange={(e) => setFormData({ ...formData, fuel_added: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4 - Rates, extras, remarks and summary */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="daily_rate">Diárias (R$)</Label>
                  <Input
                    id="daily_rate"
                    type="text"
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    value={formData.daily_rate}
                    onChange={(e) => {
                      const val = e.target.value
                      const num = parseBRL(val)
                      const formatted = val.trim() === '' ? '' : formatBRL(num)
                      setFormData({ ...formData, daily_rate: formatted })
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="extras">Extras</Label>
                  <Input
                    id="extras"
                    value={formData.extras}
                    onChange={(e) => setFormData({ ...formData, extras: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Observações</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="bg-muted/10 p-3 rounded">
                <div className="text-sm font-medium mb-2">Resumo</div>
                <div className="text-xs">
                  <div>Data: {date ? format(date, 'yyyy-MM-dd') : '-'}</div>
                  <div>De: {formData.departure_airport || '-' } → Para: {formData.arrival_airport || '-'}</div>
                  <div>AC: {formData.ac_time || '-' } • COR: {formData.cor_time || '-'}</div>
                  <div>Tempo Voo: {formData.flight_time_hours || '0'}h {formData.flight_time_minutes || '0'}m</div>
                  <div>Distância: {formData.distance_nm || '-' } NM</div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); setStep(1); }} disabled={loading || saved}>
              Cancelar
            </Button>
            <div className="flex gap-2">
              {step > 1 && (
                <Button type="button" variant="outline" onClick={prevStep} disabled={loading || saved}>
                  Voltar
                </Button>
              )}
              {step < totalSteps ? (
                <Button type="button" onClick={nextStep} disabled={loading || saved}>
                  Próximo
                </Button>
              ) : (
                <Button type="button" disabled={loading || saved} onClick={handleSubmit}>
                  {loading ? "Salvando..." : saved ? "Salvo" : "Salvar"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
