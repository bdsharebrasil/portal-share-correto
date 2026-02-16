// components/Step1Form.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CalendarIcon, Clock, MapPin, ArrowRight, Users, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { FlightCategorySelector } from './FlightCategorySelector';
import { SICComboBoxManual } from '@/components/diario/SICComboBoxManual';
import { SPECIAL_FLIGHT_TYPES } from '../constants';
import type { FlightFormData, FlightCategory, Aerodrome, ClientData, CrewMember, Partner } from '../types';

interface Step1FormProps {
  // Date
  date: Date | undefined;
  dateText: string;
  onDateChange: (date: Date | undefined) => void;
  onDateTextChange: (text: string) => void;
  
  // Form data
  formData: FlightFormData;
  onFieldChange: (field: keyof FlightFormData, value: string) => void;
  
  // Flight category
  flightCategory: FlightCategory;
  onFlightCategoryChange: (category: FlightCategory) => void;
  specialFlightType: string;
  onSpecialFlightTypeChange: (type: string) => void;
  
  // Clients
  selectedClient: string;
  onClientChange: (clientId: string) => void;
  selectedBorrowerClient: string;
  onBorrowerClientChange: (clientId: string) => void;
  clients: ClientData[];
  allClients: any[];
  getClientName: (clientId: string) => string;
  
  // Partners
  clientPartners: Partner[];
  lenderPartners: Partner[];
  borrowerPartners: Partner[];
  selectedClientPartner: string | null;
  selectedLenderPartner: string | null;
  selectedBorrowerPartner: string | null;
  onClientPartnerModalOpen: () => void;
  onLenderPartnerModalOpen: () => void;
  onBorrowerPartnerModalOpen: () => void;
  
  // Crew
  selectedPic: string;
  onPicChange: (picId: string) => void;
  selectedSic: string;
  sicName: string;
  onSicChange: (sicId: string | null, sicNameValue: string) => void;
  allCrew: CrewMember[];
  
  // Aerodromes
  aerodromes: Aerodrome[];
}

export function Step1Form(props: Step1FormProps) {
  const {
    date, dateText, onDateChange, onDateTextChange,
    formData, onFieldChange,
    flightCategory, onFlightCategoryChange,
    specialFlightType, onSpecialFlightTypeChange,
    selectedClient, onClientChange,
    selectedBorrowerClient, onBorrowerClientChange,
    clients, allClients, getClientName,
    clientPartners, lenderPartners, borrowerPartners,
    selectedClientPartner, selectedLenderPartner, selectedBorrowerPartner,
    onClientPartnerModalOpen, onLenderPartnerModalOpen, onBorrowerPartnerModalOpen,
    selectedPic, onPicChange,
    selectedSic, sicName, onSicChange,
    allCrew, aerodromes,
  } = props;

  const [departureOpen, setDepartureOpen] = useState(false);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [borrowerClientOpen, setBorrowerClientOpen] = useState(false);
  const [picOpen, setPicOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Data e Categoria do Voo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            Data do Voo
          </Label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={dateText}
              onChange={(e) => {
                const input = e.target.value;
                const cleaned = input.replace(/[^\d/]/g, '').slice(0, 10);
                onDateTextChange(cleaned);

                if (cleaned.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
                  const [day, month, year] = cleaned.split('/');
                  const newDate = new Date(Number(year), Number(month) - 1, Number(day));
                  if (!isNaN(newDate.getTime())) {
                    onDateChange(newDate);
                  }
                }
              }}
              onBlur={() => {
                if (!dateText) return;

                if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) {
                  const [day, month, year] = dateText.split('/');
                  const newDate = new Date(Number(year), Number(month) - 1, Number(day));
                  if (!isNaN(newDate.getTime())) {
                    onDateChange(newDate);
                    onDateTextChange(format(newDate, 'dd/MM/yyyy'));
                    return;
                  }
                }

                onDateTextChange(date ? format(date, 'dd/MM/yyyy') : '');
              }}
              placeholder="DD/MM/AAAA"
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              className="flex-1 h-11"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={onDateChange}
                  defaultMonth={date}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Categoria */}
        <FlightCategorySelector
          value={flightCategory}
          onChange={onFlightCategoryChange}
        />
      </div>

      {/* Seleção de Cliente */}
      {flightCategory === 'cliente' && (
        <div className="space-y-2 animate-in slide-in-from-top-2">
          <Label>Selecione o Cliente</Label>
          <Popover open={clientOpen} onOpenChange={setClientOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-normal">
                {selectedClient ? getClientName(selectedClient) : 'Selecione um cliente...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar cliente..." />
                <CommandList>
                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    {clients.map((item: any) => {
                      const clientData = item.clients as any;
                      if (!clientData) return null;
                      return (
                        <CommandItem
                          key={item.client_id}
                          value={clientData.company_name || clientData.proprietario}
                          onSelect={() => {
                            onClientChange(item.client_id);
                            setClientOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedClient === item.client_id ? "opacity-100" : "opacity-0")} />
                          <span>{clientData.company_name || clientData.proprietario}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{item.share_percentage}%</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Parceiro do Cliente */}
          {selectedClient && clientPartners.length > 0 && (
            <div className="space-y-2 mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg animate-in slide-in-from-top-2">
              <Label className="text-sm">Parceiro do Cliente (Opcional)</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between h-10 font-normal text-sm"
                onClick={onClientPartnerModalOpen}
              >
                {selectedClientPartner
                  ? clientPartners.find(p => p.id === selectedClientPartner)?.name
                  : 'Selecione um parceiro...'}
              </Button>
              <p className="text-xs text-muted-foreground">
                💡 Se o cliente tem sócios, você pode especificar qual deles está realizando o voo.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tipos de Voo Especiais para Rateio */}
      {flightCategory === 'rateio' && (
        <div className="space-y-3 animate-in slide-in-from-top-2">
          <Label>Tipo de Voo (Rateio Igual entre Sócios)</Label>
          <Select value={specialFlightType} onValueChange={onSpecialFlightTypeChange}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione o tipo de voo" />
            </SelectTrigger>
            <SelectContent>
              {SPECIAL_FLIGHT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-muted-foreground">{type.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            💡 As despesas deste voo serão divididas igualmente entre todos os sócios da aeronave.
          </p>
        </div>
      )}

      {/* Empréstimo */}
      {flightCategory === 'emprestimo' && (
        <div className="space-y-4 animate-in slide-in-from-top-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <ArrowRight className="h-4 w-4" />
            <span className="text-sm font-semibold">Configurar Empréstimo</span>
          </div>

          {/* Cotista que empresta */}
          <div className="space-y-2">
            <Label>Cotista que empresta a aeronave</Label>
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-normal">
                  {selectedClient ? getClientName(selectedClient) : 'Selecione o cotista...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cotista..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cotista encontrado.</CommandEmpty>
                    <CommandGroup heading="Cotistas da aeronave">
                      {clients.map((item: any) => {
                        const clientData = item.clients as any;
                        if (!clientData) return null;
                        return (
                          <CommandItem
                            key={item.client_id}
                            value={clientData.company_name || clientData.proprietario}
                            onSelect={() => {
                              onClientChange(item.client_id);
                              setClientOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedClient === item.client_id ? "opacity-100" : "opacity-0")} />
                            <span>{clientData.company_name || clientData.proprietario}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{item.share_percentage}%</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Parceiro do Lender */}
          {selectedClient && lenderPartners.length > 0 && (
            <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Label className="text-sm">Parceiro do Cotista (Opcional)</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between h-10 font-normal text-sm"
                onClick={onLenderPartnerModalOpen}
              >
                {selectedLenderPartner
                  ? lenderPartners.find(p => p.id === selectedLenderPartner)?.name
                  : 'Selecione um parceiro...'}
              </Button>
            </div>
          )}

          {/* Cliente que pega emprestado */}
          <div className="space-y-2">
            <Label>Cliente que pega emprestado</Label>
            <Popover open={borrowerClientOpen} onOpenChange={setBorrowerClientOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-normal border-amber-500/30">
                  {selectedBorrowerClient
                    ? allClients.find(c => c.id === selectedBorrowerClient)?.company_name || 'Cliente selecionado'
                    : 'Selecione quem pega emprestado...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    {allClients.length === 0 ? (
                      <CommandEmpty>Nenhum cliente disponível.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {allClients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.company_name || client.proprietario || ''}
                            onSelect={() => {
                              onBorrowerClientChange(client.id);
                              setBorrowerClientOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedBorrowerClient === client.id ? "opacity-100" : "opacity-0")} />
                            <span>{client.company_name || client.proprietario}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Parceiro do Borrower */}
          {selectedBorrowerClient && borrowerPartners.length > 0 && (
            <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <Label className="text-sm">Parceiro do Cliente que Pega Emprestado (Opcional)</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between h-10 font-normal text-sm"
                onClick={onBorrowerPartnerModalOpen}
              >
                {selectedBorrowerPartner
                  ? borrowerPartners.find(p => p.id === selectedBorrowerPartner)?.name
                  : 'Selecione um parceiro...'}
              </Button>
            </div>
          )}

          <p className="text-xs text-amber-200/80 bg-amber-500/20 p-3 rounded-lg">
            ⚠️ Este voo será registrado como empréstimo. O cotista que emprestar receberá crédito no banco de horas.
          </p>
        </div>
      )}

      {/* Tripulação */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Tripulação *
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {/* PIC */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">PIC (Piloto em Comando)</Label>
            <Popover open={picOpen} onOpenChange={setPicOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-normal">
                  {selectedPic
                    ? (() => {
                        const pic = allCrew.find(t => t.id === selectedPic);
                        return pic ? `${pic.full_name} (${pic.canac})` : 'PIC selecionado';
                      })()
                    : 'Selecione o PIC...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar piloto..." />
                  <CommandList>
                    <CommandEmpty>Nenhum piloto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {allCrew.map((tripulante) => (
                        <CommandItem
                          key={tripulante.id}
                          value={`${tripulante.full_name} ${tripulante.canac}`}
                          onSelect={() => {
                            onPicChange(tripulante.id);
                            setPicOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedPic === tripulante.id ? "opacity-100" : "opacity-0")} />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{tripulante.full_name}</span>
                            <span className="text-xs text-muted-foreground">CANAC: {tripulante.canac}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* SIC */}
          <SICComboBoxManual
            value={selectedSic}
            sicName={sicName}
            crew={allCrew}
            onChange={onSicChange}
            label="SIC (Segundo Piloto)"
            placeholder="Selecione ou digite o SIC..."
          />
        </div>
      </div>

      {/* Rota */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Rota
        </Label>
        <div className="flex items-center gap-2">
          <Popover open={departureOpen} onOpenChange={setDepartureOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="flex-1 justify-between h-12 font-mono text-lg">
                {formData.departure_airport || 'ICAO'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Digite o código ICAO..."
                  onValueChange={(value) => onFieldChange('departure_airport', value.toUpperCase())}
                />
                <CommandList>
                  <CommandEmpty>Nenhum aeródromo encontrado.</CommandEmpty>
                  <CommandGroup>
                    {aerodromes
                      .filter(a =>
                        !formData.departure_airport ||
                        a.designativo.includes(formData.departure_airport.toUpperCase()) ||
                        a.name.toUpperCase().includes(formData.departure_airport.toUpperCase())
                      )
                      .map(aerodrome => (
                        <CommandItem
                          key={aerodrome.id}
                          value={aerodrome.designativo}
                          onSelect={value => {
                            onFieldChange('departure_airport', value.toUpperCase());
                            setDepartureOpen(false);
                          }}
                        >
                          <span className="font-mono font-medium">{aerodrome.designativo}</span>
                          <span className="ml-2 text-muted-foreground truncate">{aerodrome.name}</span>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="flex items-center justify-center w-10">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          <Popover open={arrivalOpen} onOpenChange={setArrivalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="flex-1 justify-between h-12 font-mono text-lg">
                {formData.arrival_airport || 'ICAO'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput
                  placeholder="Digite o código ICAO..."
                  onValueChange={(value) => onFieldChange('arrival_airport', value.toUpperCase())}
                />
                <CommandList>
                  <CommandEmpty>Nenhum aeródromo encontrado.</CommandEmpty>
                  <CommandGroup>
                    {aerodromes
                      .filter(a =>
                        !formData.arrival_airport ||
                        a.designativo.includes(formData.arrival_airport.toUpperCase()) ||
                        a.name.toUpperCase().includes(formData.arrival_airport.toUpperCase())
                      )
                      .map(aerodrome => (
                        <CommandItem
                          key={aerodrome.id}
                          value={aerodrome.designativo}
                          onSelect={value => {
                            onFieldChange('arrival_airport', value.toUpperCase());
                            setArrivalOpen(false);
                          }}
                        >
                          <span className="font-mono font-medium">{aerodrome.designativo}</span>
                          <span className="ml-2 text-muted-foreground truncate">{aerodrome.name}</span>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {formData.distance_nm && (
          <p className="text-xs text-muted-foreground text-center">
            Distância: <span className="font-medium text-foreground">{formData.distance_nm} NM</span>
          </p>
        )}
      </div>

      {/* Horários */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Horários (UTC)
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'ac', label: 'AC', field: 'ac_time' as const },
            { id: 'dep', label: 'DEP', field: 'departure_time' as const },
            { id: 'pou', label: 'POU', field: 'pou_time' as const },
            { id: 'cor', label: 'COR', field: 'cor_time' as const },
          ].map(({ id, label, field }) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={id} className="text-xs text-muted-foreground text-center block">
                {label}
              </Label>
              <div className="relative">
                <Input
                  id={id}
                  type="time"
                  value={formData[field]}
                  onChange={e => onFieldChange(field, e.target.value)}
                  required
                  className="text-center h-11 font-mono pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                  Z
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Apresentação e Distância */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Apresentação</Label>
          <div className="flex items-center gap-2 h-11 px-3 bg-muted/50 rounded-md border border-border/50">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{formData.crew_checkin_time || '--:--'}</span>
            <span className="text-xs text-muted-foreground ml-auto">UTC (auto)</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Distância</Label>
          <div className="flex items-center gap-2 h-11 px-3 bg-muted/50 rounded-md border border-border/50">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{formData.distance_nm || '0'}</span>
            <span className="text-xs text-muted-foreground ml-auto">NM (auto)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
