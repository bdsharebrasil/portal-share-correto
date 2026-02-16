import { useState } from 'react';
import { Calendar, MapPin, Clock, Plane } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { FlightFormData, Aerodrome, CrewMember, FlightCategory } from '../types';
import { FlightCategorySelector } from './FlightCategorySelector';
import { SICComboBoxManual } from '@/components/diario/SICComboBoxManual';

interface Step1FormProps {
  formData: FlightFormData;
  onFormDataChange: (data: Partial<FlightFormData>) => void;
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  aerodromes: Aerodrome[];
  crew: CrewMember[];
  selectedPic: string;
  onPicChange: (picId: string) => void;
  selectedSic: string;
  onSicChange: (sicId: string) => void;
  sicName: string;
  onSicNameChange: (name: string) => void;
  flightCategory: FlightCategory;
  onFlightCategoryChange: (category: FlightCategory) => void;
  onNext: () => void;
  isLoading?: boolean;
}

export function Step1Form({
  formData,
  onFormDataChange,
  date,
  onDateChange,
  aerodromes,
  crew,
  selectedPic,
  onPicChange,
  selectedSic,
  onSicChange,
  sicName,
  onSicNameChange,
  flightCategory,
  onFlightCategoryChange,
  onNext,
  isLoading = false,
}: Step1FormProps) {
  const [picOpen, setPicOpen] = useState(false);
  const [depOpen, setDepOpen] = useState(false);
  const [arrOpen, setArrOpen] = useState(false);

  const handleTimeChange = (field: keyof FlightFormData, value: string) => {
    // Formatar como HH:MM se necessário
    if (value && value.length === 2 && !value.includes(':')) {
      value = value + ':';
    }
    onFormDataChange({ [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Data do Voo */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          Data do Voo *
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
              disabled={isLoading}
            >
              {date ? format(date, 'dd/MM/yyyy') : 'Selecione a data'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={date}
              onSelect={onDateChange}
              disabled={isLoading}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Aeroportos */}
      <div className="grid grid-cols-2 gap-4">
        {/* Aeroporto de Saída */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            DE *
          </Label>
          <Popover open={depOpen} onOpenChange={setDepOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-left"
                disabled={isLoading}
              >
                {formData.departure_airport || 'Selecione'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar aeroporto..." />
                <CommandEmpty>Nenhum aeroporto encontrado</CommandEmpty>
                <CommandGroup>
                  <CommandList>
                    {aerodromes.map((aero) => (
                      <CommandItem
                        key={aero.id}
                        value={aero.designativo}
                        onSelect={() => {
                          onFormDataChange({ departure_airport: aero.designativo });
                          setDepOpen(false);
                        }}
                      >
                        {aero.designativo} - {aero.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Aeroporto de Chegada */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            PARA *
          </Label>
          <Popover open={arrOpen} onOpenChange={setArrOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-left"
                disabled={isLoading}
              >
                {formData.arrival_airport || 'Selecione'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar aeroporto..." />
                <CommandEmpty>Nenhum aeroporto encontrado</CommandEmpty>
                <CommandGroup>
                  <CommandList>
                    {aerodromes.map((aero) => (
                      <CommandItem
                        key={aero.id}
                        value={aero.designativo}
                        onSelect={() => {
                          onFormDataChange({ arrival_airport: aero.designativo });
                          setArrOpen(false);
                        }}
                      >
                        {aero.designativo} - {aero.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tripulação */}
      <div className="grid grid-cols-2 gap-4">
        {/* PIC */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Plane className="h-4 w-4 text-muted-foreground" />
            PIC *
          </Label>
          <Popover open={picOpen} onOpenChange={setPicOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-left"
                disabled={isLoading}
              >
                {crew.find(c => c.id === selectedPic)?.full_name || 'Selecione'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar piloto..." />
                <CommandEmpty>Nenhum piloto encontrado</CommandEmpty>
                <CommandGroup>
                  <CommandList>
                    {crew.map((member) => (
                      <CommandItem
                        key={member.id}
                        value={member.full_name}
                        onSelect={() => {
                          onPicChange(member.id);
                          setPicOpen(false);
                        }}
                      >
                        {member.full_name} ({member.canac})
                      </CommandItem>
                    ))}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* SIC */}
        <SICComboBoxManual
          value={selectedSic}
          onChange={onSicChange}
          sicName={sicName}
          onSicNameChange={onSicNameChange}
          crew={crew}
          disabled={isLoading}
        />
      </div>

      {/* Horários */}
      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium">AC *</Label>
          <Input
            type="time"
            value={formData.ac_time}
            onChange={(e) => handleTimeChange('ac_time', e.target.value)}
            disabled={isLoading}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">DEP *</Label>
          <Input
            type="time"
            value={formData.departure_time}
            onChange={(e) => handleTimeChange('departure_time', e.target.value)}
            disabled={isLoading}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">POU *</Label>
          <Input
            type="time"
            value={formData.pou_time}
            onChange={(e) => handleTimeChange('pou_time', e.target.value)}
            disabled={isLoading}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium">COR *</Label>
          <Input
            type="time"
            value={formData.cor_time}
            onChange={(e) => handleTimeChange('cor_time', e.target.value)}
            disabled={isLoading}
            className="h-9"
          />
        </div>
      </div>

      {/* Categoria de Voo */}
      <FlightCategorySelector
        value={flightCategory}
        onChange={onFlightCategoryChange}
        disabled={isLoading}
      />

      {/* Botão Próximo */}
      <Button
        type="button"
        onClick={onNext}
        disabled={isLoading}
        className="w-full h-11"
      >
        Próximo Passo
      </Button>
    </div>
  );
}
