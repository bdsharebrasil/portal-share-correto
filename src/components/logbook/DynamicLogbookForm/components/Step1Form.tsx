import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SICComboBoxManual } from '@/components/diario/SICComboBoxManual';
import { cn } from '@/lib/utils';
import { CalendarIcon, MapPin, Clock, Check, Users, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FlightCategorySelector } from './FlightCategorySelector';
import { SPECIAL_FLIGHT_TYPES, TIME_FIELDS } from '../constants';
import type { FlightFormData, FlightCategory, CrewMember, ClientData, Partner } from '../types';
import type { Aerodrome } from '@/types';

interface Step1FormProps {
  formData: FlightFormData;
  updateField: (field: keyof FlightFormData, value: string) => void;
  date: Date | undefined;
  dateText: string;
  onDateChange: (date: Date | undefined) => void;
  onDateTextChange: (text: string) => void;
  flightCategory: FlightCategory;
  onFlightCategoryChange: (category: FlightCategory) => void;
  specialFlightType: string;
  onSpecialFlightTypeChange: (type: string) => void;
  selectedClient: string;
  onSelectedClientChange: (client: string) => void;
  selectedBorrowerClient: string;
  onSelectedBorrowerClientChange: (client: string) => void;
  selectedPic: string;
  onSelectedPicChange: (pic: string) => void;
  selectedSic: string;
  onSelectedSicChange: (sic: string) => void;
  sicName: string;
  onSicNameChange: (name: string) => void;
  selectedClientPartner: string | null;
  onClientPartnerModalOpen: () => void;
  selectedLenderPartner: string | null;
  onLenderPartnerModalOpen: () => void;
  selectedBorrowerPartner: string | null;
  onBorrowerPartnerModalOpen: () => void;
  aerodromes: Aerodrome[];
  allCrew: CrewMember[];
  clients: any[];
  allClients: { id: string; company_name: string; proprietario?: string }[];
  clientPartners: Partner[];
  lenderPartners: Partner[];
  borrowerPartners: Partner[];
  getClientName: (clientId: string) => string;
}

export function Step1Form(props: Step1FormProps) {
  const {
    formData, updateField,
    date, dateText, onDateChange, onDateTextChange,
    flightCategory, onFlightCategoryChange,
    specialFlightType, onSpecialFlightTypeChange,
    selectedClient, onSelectedClientChange,
    selectedBorrowerClient, onSelectedBorrowerClientChange,
    selectedPic, onSelectedPicChange,
    selectedSic, onSelectedSicChange,
    sicName, onSicNameChange,
    selectedClientPartner, onClientPartnerModalOpen,
    selectedLenderPartner, onLenderPartnerModalOpen,
    selectedBorrowerPartner, onBorrowerPartnerModalOpen,
    aerodromes, allCrew, clients, allClients,
    clientPartners, lenderPartners, borrowerPartners,
    getClientName,
  } = props;

  const [departureOpen, setDepartureOpen] = useState(false);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [borrowerClientOpen, setBorrowerClientOpen] = useState(false);
  const [picOpen, setPicOpen] = useState(false);

  const borrowerClients = allClients;

  const handleDateTextChange = (input: string) => {
    const cleaned = input.replace(/[^\d/]/g, '').slice(0, 10);
    onDateTextChange(cleaned);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
      const [d, m, y] = cleaned.split('/').map(Number);
      const parsed = new Date(y, m - 1, d);
      if (!isNaN(parsed.getTime())) {
        onDateChange(parsed);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Data e Categoria */}
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
              onChange={(e) => handleDateTextChange(e.target.value)}
              placeholder="DD/MM/AAAA"
              className="flex-1 h-11"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    onDateChange(d);
                    if (d) onDateTextChange(format(d, 'dd/MM/yyyy'));
                  }}
                  locale={pt}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <FlightCategorySelector
          value={flightCategory}
          onChange={onFlightCategoryChange}
        />
      </div>

      {/* Client selector for 'cliente' category */}
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
                          onSelect={() => { onSelectedClientChange(item.client_id); setClientOpen(false); }}
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

          {selectedClient && clientPartners.length > 0 && (
            <div className="space-y-2 mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg animate-in slide-in-from-top-2">
              <Label className="text-sm">Parceiro do Cliente (Opcional)</Label>
              <Button type="button" variant="outline" className="w-full justify-between h-10 font-normal text-sm" onClick={onClientPartnerModalOpen}>
                {selectedClientPartner ? clientPartners.find(p => p.id === selectedClientPartner)?.name : 'Selecione um parceiro...'}
              </Button>
              <p className="text-xs text-muted-foreground">💡 Se o cliente tem sócios, você pode especificar qual deles está realizando o voo.</p>
            </div>
          )}
        </div>
      )}

      {/* Rateio */}
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

          {/* Lender */}
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
                            onSelect={() => { onSelectedClientChange(item.client_id); setClientOpen(false); }}
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

          {selectedClient && lenderPartners.length > 0 && (
            <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-in slide-in-from-top-2">
              <Label className="text-sm">Parceiro do Cotista (Opcional)</Label>
              <Button type="button" variant="outline" className="w-full justify-between h-10 font-normal text-sm" onClick={onLenderPartnerModalOpen}>
                {selectedLenderPartner ? lenderPartners.find(p => p.id === selectedLenderPartner)?.name : 'Selecione um parceiro...'}
              </Button>
            </div>
          )}

          {/* Borrower */}
          <div className="space-y-2">
            <Label>Cliente que pega emprestado</Label>
            <Popover open={borrowerClientOpen} onOpenChange={setBorrowerClientOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-normal border-amber-500/30">
                  {selectedBorrowerClient
                    ? borrowerClients.find(c => c.id === selectedBorrowerClient)?.company_name || 'Cliente selecionado'
                    : 'Selecione quem pega emprestado...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente disponível.</CommandEmpty>
                    <CommandGroup heading="Clientes disponíveis">
                      {borrowerClients.map((client) => (
                        <CommandItem
                          key={client.id}
                          value={client.company_name || client.proprietario || ''}
                          onSelect={() => { onSelectedBorrowerClientChange(client.id); setBorrowerClientOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedBorrowerClient === client.id ? "opacity-100" : "opacity-0")} />
                          <span>{client.company_name || client.proprietario}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedBorrowerClient && borrowerPartners.length > 0 && (
            <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-in slide-in-from-top-2">
              <Label className="text-sm">Parceiro do Cliente que Pega Emprestado (Opcional)</Label>
              <Button type="button" variant="outline" className="w-full justify-between h-10 font-normal text-sm" onClick={onBorrowerPartnerModalOpen}>
                {selectedBorrowerPartner ? borrowerPartners.find(p => p.id === selectedBorrowerPartner)?.name : 'Selecione um parceiro...'}
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
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">PIC (Piloto em Comando)</Label>
            <Popover open={picOpen} onOpenChange={setPicOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-normal">
                  {selectedPic
                    ? (() => { const pic = allCrew.find(t => t.id === selectedPic); return pic ? `${pic.full_name} (${pic.canac})` : 'PIC selecionado'; })()
                    : 'Selecione o PIC...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar piloto por nome ou CANAC..." />
                  <CommandList>
                    <CommandEmpty>Nenhum piloto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {allCrew.map((tripulante) => (
                        <CommandItem
                          key={tripulante.id}
                          value={`${tripulante.full_name} ${tripulante.canac}`}
                          onSelect={() => { onSelectedPicChange(tripulante.id); setPicOpen(false); }}
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

          <SICComboBoxManual
            value={selectedSic ?? ''}
            sicName={sicName ?? ''}
            crew={allCrew}
            onChange={(sicCanac, sicNameValue) => { onSelectedSicChange(sicCanac ?? ''); onSicNameChange(sicNameValue ?? ''); }}
            label="SIC (Segundo Piloto)"
            placeholder="Selecione ou digite o SIC..."
          />
        </div>
      </div>

      {/* Route */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Rota *
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {(['departure_airport', 'arrival_airport'] as const).map((field, idx) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{idx === 0 ? 'DE' : 'PARA'}</Label>
              <Popover
                open={idx === 0 ? departureOpen : arrivalOpen}
                onOpenChange={idx === 0 ? setDepartureOpen : setArrivalOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-mono">
                    {formData[field] || (idx === 0 ? 'Selecione...' : 'Selecione...')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar aeródromo..." />
                    <CommandList>
                      <CommandEmpty>Não encontrado.</CommandEmpty>
                      <CommandGroup>
                        {aerodromes.map((a) => (
                          <CommandItem
                            key={a.id}
                            value={`${a.designativo} ${a.name}`}
                            onSelect={() => {
                              updateField(field, a.designativo);
                              if (idx === 0) setDepartureOpen(false);
                              else setArrivalOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData[field] === a.designativo ? "opacity-100" : "opacity-0")} />
                            <span className="font-mono mr-2">{a.designativo}</span>
                            <span className="text-xs text-muted-foreground truncate">{a.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ))}
        </div>
      </div>

      {/* Time inputs */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Horários UTC *
        </Label>
        <div className="grid grid-cols-4 gap-3">
          {TIME_FIELDS.map(({ id, label, field }) => (
            <div key={id} className="space-y-1">
              <Label className="text-xs text-muted-foreground text-center block">{label}</Label>
              <div className="relative">
                <Input
                  id={id}
                  type="time"
                  value={formData[field]}
                  onChange={e => updateField(field, e.target.value)}
                  required
                  className="text-center h-11 font-mono pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">Z</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auto-calculated fields */}
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
