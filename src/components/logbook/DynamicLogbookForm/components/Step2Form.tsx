// components/Step2Form.tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Fuel, Info, Plane } from 'lucide-react';
import { format } from 'date-fns';
import { formatBRL } from '@/lib/utils';
import type { FlightFormData, CrewMember } from '../types';

interface Step2FormProps {
  // Form data
  formData: FlightFormData;
  onFieldChange: (field: keyof FlightFormData, value: string) => void;
  
  // Additional fields
  passengers: string;
  onPassengersChange: (value: string) => void;
  cargoKg: string;
  onCargoKgChange: (value: string) => void;
  occurrences: string;
  onOccurrencesChange: (value: string) => void;
  discrepancies: string;
  onDiscrepanciesChange: (value: string) => void;
  
  // Daily rate
  dailyCount: string;
  onDailyCountChange: (value: string) => void;
  aircraftDailyRate: number | null;
  hasDailyRate: boolean;
  baseAerodrome: string | null;
  
  // Summary data
  date: Date | undefined;
  selectedClient: string;
  selectedPic: string;
  flightCategory: 'cliente' | 'rateio' | 'emprestimo';
  specialFlightType: string;
  allCrew: CrewMember[];
  getClientName: (clientId: string) => string;
}

export function Step2Form(props: Step2FormProps) {
  const {
    formData, onFieldChange,
    passengers, onPassengersChange,
    cargoKg, onCargoKgChange,
    occurrences, onOccurrencesChange,
    discrepancies, onDiscrepanciesChange,
    dailyCount, onDailyCountChange,
    aircraftDailyRate, hasDailyRate, baseAerodrome,
    date, selectedClient, selectedPic,
    flightCategory, specialFlightType,
    allCrew, getClientName,
  } = props;

  const SPECIAL_FLIGHT_TYPES = [
    { value: 'voo_check', label: 'Voo de Check' },
    { value: 'translado', label: 'Translado' },
    { value: 'voo_teste', label: 'Voo de Teste' },
  ];

  return (
    <div className="space-y-6">
      {/* Tempos de voo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Tempo de Voo
          </Label>
          <div className="flex items-center gap-2 h-14 px-4 bg-primary/10 rounded-lg border border-primary/20">
            <span className="text-2xl font-mono font-bold text-primary">
              {formData.flight_time_hours || '0'}h {formData.flight_time_minutes || '0'}m
            </span>
            <span className="text-xs text-muted-foreground ml-auto">DEP→POU</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tempo Noturno</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                value={formData.night_time_hours}
                onChange={e => onFieldChange('night_time_hours', e.target.value)}
                placeholder="0"
                className="h-14 text-center text-xl font-mono"
              />
              <span className="text-xs text-muted-foreground text-center block mt-1">horas</span>
            </div>
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                max="59"
                value={formData.night_time_minutes}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val && parseInt(val) > 59) {
                    val = '59';
                  }
                  onFieldChange('night_time_minutes', val);
                }}
                placeholder="0"
                className="h-14 text-center text-xl font-mono"
              />
              <span className="text-xs text-muted-foreground text-center block mt-1">minutos</span>
            </div>
          </div>
        </div>
      </div>

      {/* IFR, Pousos, FUEL */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>IFR</Label>
          <Input
            type="number"
            min="0"
            value={formData.ifr_count}
            onChange={e => onFieldChange('ifr_count', e.target.value)}
            placeholder="0"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label>Pousos</Label>
          <Input
            type="number"
            min="1"
            value={formData.landings}
            onChange={e => onFieldChange('landings', e.target.value)}
            placeholder="1"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Fuel className="h-4 w-4 text-muted-foreground" />
            FUEL
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-xs">
                    Combustível abastecido em litros
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.fuel_added}
            onChange={e => onFieldChange('fuel_added', e.target.value)}
            placeholder="0"
            className="h-11"
          />
        </div>
      </div>

      {/* Diárias - Apenas se aeronave possui diária configurada */}
      {hasDailyRate ? (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Qtd. Diárias
              {baseAerodrome && dailyCount && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning">
                  fora da base
                </span>
              )}
            </Label>
            <Input
              type="number"
              min="0"
              value={dailyCount}
              onChange={e => onDailyCountChange(e.target.value)}
              placeholder="0"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label>Valor Unitário</Label>
            <div className="flex items-center h-11 px-3 bg-muted/50 rounded-md border border-border/50">
              <span className="text-sm">
                {aircraftDailyRate ? formatBRL(aircraftDailyRate) : 'N/A'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Extras</Label>
            <Input
              value={formData.extras}
              onChange={e => onFieldChange('extras', e.target.value)}
              placeholder="Valores adicionais"
              className="h-11"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Extras</Label>
          <Input
            value={formData.extras}
            onChange={e => onFieldChange('extras', e.target.value)}
            placeholder="Valores adicionais"
            className="h-11"
          />
        </div>
      )}

      {/* Passageiros e Carga */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Passageiros</Label>
          <Input
            type="number"
            min="0"
            value={passengers}
            onChange={e => onPassengersChange(e.target.value)}
            placeholder="0"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label>Carga (kg)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={cargoKg}
            onChange={e => onCargoKgChange(e.target.value)}
            placeholder="0"
            className="h-11"
          />
        </div>
      </div>

      {/* Ocorrências e Discrepâncias */}
      <div className="space-y-2">
        <Label>Ocorrências</Label>
        <Textarea
          value={occurrences}
          onChange={e => onOccurrencesChange(e.target.value)}
          rows={2}
          placeholder="Ocorrências durante o voo..."
          className="resize-none"
        />
      </div>

      <div className="space-y-2">
        <Label>Discrepâncias</Label>
        <Textarea
          value={discrepancies}
          onChange={e => onDiscrepanciesChange(e.target.value)}
          rows={2}
          placeholder="Discrepâncias da aeronave..."
          className="resize-none"
        />
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={formData.remarks}
          onChange={e => onFieldChange('remarks', e.target.value)}
          rows={2}
          placeholder="Notas adicionais do voo..."
          className="resize-none"
        />
      </div>

      {/* Resumo */}
      <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
        <p className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Plane className="h-4 w-4" />
          Resumo do Trecho
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Data</p>
            <p className="font-medium">{date ? format(date, 'dd/MM/yyyy') : '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Rota</p>
            <p className="font-medium font-mono">
              {formData.departure_airport || '-'} → {formData.arrival_airport || '-'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Responsável</p>
            <p className="font-medium">
              {flightCategory === 'rateio'
                ? SPECIAL_FLIGHT_TYPES.find(t => t.value === specialFlightType)?.label || 'Rateio'
                : selectedClient ? getClientName(selectedClient) : '-'
              }
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">PIC</p>
            <p className="font-medium text-xs">
              {selectedPic
                ? allCrew.find(t => t.id === selectedPic)?.full_name?.split(' ')[0] || 'PIC'
                : '-'
              }
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Bloco</p>
            <p className="font-medium font-mono">
              {formData.ac_time || '--:--'} - {formData.cor_time || '--:--'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Tempo Voo</p>
            <p className="font-medium">
              {formData.flight_time_hours || '0'}h {formData.flight_time_minutes || '0'}m
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Distância</p>
            <p className="font-medium">{formData.distance_nm || '0'} NM</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Passageiros</p>
            <p className="font-medium">{passengers || '0'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Carga</p>
            <p className="font-medium">{cargoKg || '0'} kg</p>
          </div>
        </div>
      </div>
    </div>
  );
}