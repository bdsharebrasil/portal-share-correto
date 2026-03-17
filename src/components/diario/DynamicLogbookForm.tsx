import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SICComboBoxManual } from './SICComboBoxManual';
import { cn, formatBRL, parseBRL } from '@/lib/utils';
import {
  CalendarIcon,
  Info,
  Plane,
  Clock,
  MapPin,
  Fuel,
  Check,
  ChevronRight,
  ChevronLeft,
  Users,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLogbookForm } from '@/hooks/useLogbookForm';
import { useTripulantes } from '@/hooks/useTripulantes';
import { updateCrewFlightHours } from '@/services/crewFlightHours';
import type { Aerodrome } from '@/types';
import {
  calculateBlockTime,
  calculateDayTime,
  validateTimes
} from '@/utils/flightTime';

// Tipos de voo especiais que dividem custos igualmente entre sócios
const SPECIAL_FLIGHT_TYPES = [
  { value: 'voo_check', label: 'Voo de Check', description: 'Voo de verificação - rateio igual' },
  { value: 'translado', label: 'Translado', description: 'Voo de ferry/posicionamento - rateio igual' },
  { value: 'voo_teste', label: 'Voo de Teste', description: 'Voo de manutenção/teste - rateio igual' },
] as const;

interface DynamicLogbookFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraftId: string;
  logbookMonthId?: string | null;
  prefilledDate?: Date;
  onSuccess?: () => void;
  inline?: boolean;
}

export function DynamicLogbookForm({
  open,
  onOpenChange,
  aircraftId,
  prefilledDate,
  onSuccess,
  logbookMonthId,
  inline = false,
}: DynamicLogbookFormProps) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [date, setDate] = useState<Date | undefined>(() => prefilledDate ?? new Date());
  const [dateText, setDateText] = useState<string>(() =>
    format(prefilledDate ?? new Date(), 'dd/MM/yyyy')
  );

  const [departureOpen, setDepartureOpen] = useState(false);
  const [arrivalOpen, setArrivalOpen] = useState(false);
  const [dailyCount, setDailyCount] = useState<string>('');
  const [baseAerodrome, setBaseAerodrome] = useState<string | null>(null);
  const [aircraftDailyRate, setAircraftDailyRate] = useState<number | null>(null);
  const [flightCategory, setFlightCategory] = useState<'cliente' | 'rateio' | 'emprestimo'>('cliente');
  const [specialFlightType, setSpecialFlightType] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientOpen, setClientOpen] = useState(false);
  const [selectedBorrowerClient, setSelectedBorrowerClient] = useState<string>('');
  const [borrowerClientOpen, setBorrowerClientOpen] = useState(false);

  // Parceiros
  const [selectedLenderPartner, setSelectedLenderPartner] = useState<string | null>(null);
  const [selectedBorrowerPartner, setSelectedBorrowerPartner] = useState<string | null>(null);
  const [selectedClientPartner, setSelectedClientPartner] = useState<string | null>(null);
  const [lenderPartnerModalOpen, setLenderPartnerModalOpen] = useState(false);
  const [borrowerPartnerModalOpen, setBorrowerPartnerModalOpen] = useState(false);
  const [clientPartnerModalOpen, setClientPartnerModalOpen] = useState(false);

  // Tripulação
  const [selectedPic, setSelectedPic] = useState<string>('');
  const [selectedSic, setSelectedSic] = useState<string>('');
  const [sicName, setSicName] = useState<string>('');
  const [picOpen, setPicOpen] = useState(false);
  const [sicOpen, setSicOpen] = useState(false);

  // Campos adicionais
  const [passengers, setPassengers] = useState<string>('');
  const [cargoKg, setCargoKg] = useState<string>('');
  const [occurrences, setOccurrences] = useState<string>('');
  const [discrepancies, setDiscrepancies] = useState<string>('');

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tripulantes } = useTripulantes();

  // Buscar tripulantes da tabela crew (externos)
  const { data: crewPersons = [] } = useQuery({
    queryKey: ['crew'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crew')
        .select('id, full_name, canac, status')
        .eq('status', 'ativo')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Erro ao buscar crew:', error);
        return [];
      }

      return data || [];
    }
  });

  // Combinar tripulantes de crew_members e crew
  const allCrew = [
    ...tripulantes,
    ...crewPersons.map((person: any) => ({
      id: person.id,
      full_name: person.full_name,
      canac: person.canac,
      status: person.status
    }))
  ];

  const { data: aerodromes = [] } = useQuery({
    queryKey: ['aerodromes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aerodromes')
        .select('id, designativo, name, coordenadas')
        .order('designativo');
      if (error) throw error;
      return data as Aerodrome[];
    },
  });

  // Buscar clientes vinculados à aeronave
  const { data: clients = [] } = useQuery({
    queryKey: ['aircraft-clients', aircraftId],
    queryFn: async () => {
      // Primeiro buscar os client_ids vinculados à aeronave
      const { data: clientAircraft, error: caError } = await supabase
        .from('client_aircraft')
        .select('client_id, share_percentage')
        .eq('aircraft_id', aircraftId);

      if (caError) throw caError;
      if (!clientAircraft || clientAircraft.length === 0) return [];

      // Depois buscar os dados completos dos clientes
      const clientIds = clientAircraft.map((ca: any) => ca.client_id);
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name, proprietario')
        .in('id', clientIds);

      if (clientsError) throw clientsError;

      // Mapear os dados combinados
      const clientsMap: Record<string, any> = {};
      (clientsData || []).forEach((c: any) => {
        clientsMap[c.id] = c;
      });

      return clientAircraft.map((ca: any) => ({
        client_id: ca.client_id,
        share_percentage: ca.share_percentage,
        clients: clientsMap[ca.client_id] || null
      }));
    },
    enabled: !!aircraftId,
  });

  // Buscar TODOS os clientes (para empréstimo - seleção do cliente que está usando a aeronave)
  const { data: allClients = [] } = useQuery({
    queryKey: ['all-clients-for-loan'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, proprietario')
        .order('company_name');
      if (error) {
        console.error('Erro ao buscar clientes:', error);
        throw error;
      }
      console.log('Total de clientes para empréstimo:', data?.length);
      return data || [];
    },
  });

  // Para empréstimo, mostrar TODOS os clientes disponíveis
  // O cliente que está usando a aeronave emprestada pode ser qualquer cliente cadastrado
  const borrowerClients = allClients;

  // Buscar parceiros do cliente selecionado (para cliente normal)
  const { data: clientPartners = [] } = useQuery({
    queryKey: ['client-partners', selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage')
        .eq('client_id', selectedClient)
        .order('name');
      if (error) {
        console.error('Erro ao buscar parceiros do cliente:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!selectedClient && flightCategory === 'cliente',
  });

  // Buscar parceiros do cotista que empresta (para empréstimo)
  const { data: lenderPartners = [] } = useQuery({
    queryKey: ['lender-partners', selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage')
        .eq('client_id', selectedClient)
        .order('name');
      if (error) {
        console.error('Erro ao buscar parceiros do lender:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!selectedClient && flightCategory === 'emprestimo',
  });

  // Buscar parceiros do cliente que pega emprestado
  const { data: borrowerPartners = [] } = useQuery({
    queryKey: ['borrower-partners', selectedBorrowerClient],
    queryFn: async () => {
      if (!selectedBorrowerClient) return [];
      const { data, error } = await supabase
        .from('client_partners')
        .select('id, name, cpf, share_percentage')
        .eq('client_id', selectedBorrowerClient)
        .order('name');
      if (error) {
        console.error('Erro ao buscar parceiros do borrower:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!selectedBorrowerClient && flightCategory === 'emprestimo',
  });

  // Buscar dados do logbook_month para obter base_aerodrome, daily_rate e has_daily_rate
  const { data: logbookMonth } = useQuery({
    queryKey: ['logbook-month', logbookMonthId],
    queryFn: async () => {
      if (!logbookMonthId) return null;
      const { data, error } = await supabase
        .from('logbook_months')
        .select('base_aerodrome, daily_rate, has_daily_rate')
        .eq('id', logbookMonthId)
        .single();
      if (error) {
        console.error('Erro ao buscar logbook month:', error);
        return null;
      }
      return data;
    },
    enabled: !!logbookMonthId,
  });

  // Verificar se a aeronave possui diária configurada
  const hasDailyRate = logbookMonth?.has_daily_rate ?? true;

  // Atualizar base_aerodrome e daily_rate quando logbookMonth muda
  useEffect(() => {
    if (logbookMonth) {
      setBaseAerodrome(logbookMonth.base_aerodrome);
      setAircraftDailyRate(logbookMonth.daily_rate);
    }
  }, [logbookMonth]);

  // Resetar parceiro quando cliente muda
  useEffect(() => {
    setSelectedClientPartner(null);
    setSelectedLenderPartner(null);
  }, [selectedClient]);

  // Resetar parceiro do borrower quando muda
  useEffect(() => {
    setSelectedBorrowerPartner(null);
  }, [selectedBorrowerClient]);

  const { formData, updateField, updateFields, resetForm } = useLogbookForm(aerodromes);

  // Ao abrir o formulário, garantir que exista uma data inicial (para não travar validação)
  useEffect(() => {
    if (!open) return;
    const initial = prefilledDate ?? new Date();
    setDate(initial);
    setDateText(format(initial, 'dd/MM/yyyy'));
  }, [open, prefilledDate]);

  // Atualizar data quando prefilledDate muda
  useEffect(() => {
    if (prefilledDate) {
      setDate(prefilledDate);
      setDateText(format(prefilledDate, 'dd/MM/yyyy'));
      updateField('entry_date', format(prefilledDate, 'yyyy-MM-dd'));
    }
  }, [prefilledDate, updateField]);

  // Atualizar entry_date quando date muda
  useEffect(() => {
    if (date) {
      updateField('entry_date', format(date, 'yyyy-MM-dd'));
      setDateText(format(date, 'dd/MM/yyyy'));
    } else {
      setDateText('');
    }
  }, [date, updateField]);

  // Detectar automaticamente se é voo fora da base e auto-preencher diárias (apenas se aeronave tem diária)
  useEffect(() => {
    // Se aeronave não possui diária, não preencher automaticamente
    if (!hasDailyRate) {
      setDailyCount('');
      return;
    }

    if (!baseAerodrome || !formData.departure_airport || !formData.arrival_airport) {
      setDailyCount('');
      return;
    }

    const isOutOfBase =
      (formData.departure_airport !== baseAerodrome && formData.arrival_airport !== baseAerodrome) ||
      (formData.departure_airport === baseAerodrome && formData.arrival_airport !== baseAerodrome) ||
      (formData.departure_airport !== baseAerodrome && formData.arrival_airport === baseAerodrome);

    if (isOutOfBase && !dailyCount) {
      setDailyCount('1');
    }
  }, [baseAerodrome, formData.departure_airport, formData.arrival_airport, aircraftDailyRate, dailyCount, updateField, hasDailyRate]);

  // Validações por passo
  const validateStep1 = (): boolean => {
    if (!date) {
      toast({
        title: 'Erro',
        description: 'Selecione a data do voo.',
        variant: 'destructive',
      });
      return false;
    }

    if (!formData.departure_airport || !formData.arrival_airport) {
      toast({
        title: 'Erro',
        description: 'Preencha os aeroportos DE e PARA.',
        variant: 'destructive',
      });
      return false;
    }

    // Validar PIC (obrigatório)
    if (!selectedPic) {
      toast({
        title: 'Erro',
        description: 'Selecione o Piloto em Comando (PIC).',
        variant: 'destructive',
      });
      return false;
    }

    // Validar cliente ou tipo de rateio ou empréstimo
    if (flightCategory === 'cliente' && !selectedClient) {
      toast({
        title: 'Erro',
        description: 'Selecione um cliente.',
        variant: 'destructive',
      });
      return false;
    }

    if (flightCategory === 'rateio' && !specialFlightType) {
      toast({
        title: 'Erro',
        description: 'Selecione o tipo de voo para rateio.',
        variant: 'destructive',
      });
      return false;
    }

    if (flightCategory === 'emprestimo') {
      if (!selectedClient) {
        toast({
          title: 'Erro',
          description: 'Selecione o cotista que está emprestando a aeronave.',
          variant: 'destructive',
        });
        return false;
      }
      if (!selectedBorrowerClient) {
        toast({
          title: 'Erro',
          description: 'Selecione o cliente que está pegando emprestado.',
          variant: 'destructive',
        });
        return false;
      }
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!formData.ac_time || !timeRegex.test(formData.ac_time)) {
      toast({
        title: 'Erro',
        description: 'AC inválido. Use o formato HH:MM.',
        variant: 'destructive',
      });
      return false;
    }

    if (!formData.departure_time || !timeRegex.test(formData.departure_time)) {
      toast({
        title: 'Erro',
        description: 'DEP inválido. Use o formato HH:MM.',
        variant: 'destructive',
      });
      return false;
    }

    if (!formData.pou_time || !timeRegex.test(formData.pou_time)) {
      toast({
        title: 'Erro',
        description: 'POU inválido. Use o formato HH:MM.',
        variant: 'destructive',
      });
      return false;
    }

    if (!formData.cor_time || !timeRegex.test(formData.cor_time)) {
      toast({
        title: 'Erro',
        description: 'COR inválido. Use o formato HH:MM.',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const validateStep2 = (): boolean => {
    if (
      (formData.flight_time_hours === '' || formData.flight_time_hours === '0') &&
      (formData.flight_time_minutes === '' || formData.flight_time_minutes === '0')
    ) {
      toast({
        title: 'Erro',
        description: 'Informe o tempo de voo.',
        variant: 'destructive',
      });
      return false;
    }

    if (formData.flight_time_minutes) {
      const minutes = parseInt(formData.flight_time_minutes, 10);
      if (isNaN(minutes) || minutes < 0 || minutes > 59) {
        toast({
          title: 'Erro',
          description: 'Minutos devem estar entre 0 e 59.',
          variant: 'destructive',
        });
        return false;
      }
    }

    return true;
  };

  const nextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep2()) return;

    setLoading(true);

    try {
      // Calcular tempo de voo (DEP até POU)
      const flightHours = parseFloat(formData.flight_time_hours) || 0;
      const flightMinutes = parseFloat(formData.flight_time_minutes) || 0;
      const flightTime = flightHours + flightMinutes / 60;

      // Calcular tempo de bloco (AC até COR) usando função centralizada
      const totalBlockTime = calculateBlockTime(formData.ac_time, formData.cor_time);

      // Calcular tempo noturno do bloco
      const nightHours = parseFloat(formData.night_time_hours) || 0;
      const nightMinutes = parseFloat(formData.night_time_minutes) || 0;
      const totalNight = nightHours + nightMinutes / 60;

      // Calcular tempo diurno de forma CONSISTENTE (day_time + night_hours = flight_time)
      const totalDay = calculateDayTime(flightTime, totalNight);

      // VALIDAÇÃO OBRIGATÓRIA: blockTime >= flightTime
      if (!validateTimes(totalBlockTime, flightTime)) {
        throw new Error(`Validação falhou: Tempo Total (${totalBlockTime.toFixed(2)}h) não pode ser menor que Tempo de Voo (${flightTime.toFixed(2)}h)`);
      }

      // Calcular valor das diárias
      let finalDailyRate: number | null = null;

      // Determinar tipo de voo e cliente
      const flightNature = flightCategory === 'rateio'
        ? specialFlightType.toUpperCase()
        : flightCategory === 'emprestimo'
          ? 'EP' // Empréstimo
          : 'PV';

      // Rateio entre sócios e empréstimo NÃO cobram diária
      if (flightCategory === 'cliente' && dailyCount && aircraftDailyRate) {
        const quantity = parseInt(dailyCount) || 0;
        finalDailyRate = quantity * aircraftDailyRate;
      }

      // Determinar campos de acordo com as 3 cases
      // client_id é SEMPRE o proprietário da aeronave
      const entryClientId = selectedClient;

      // Inicializar campos de parceiros e loan_recipient
      let entryClientPartnerId: string | null = null;
      let entryLoanRecipientClientId: string | null = null;
      let entryLoanRecipientPartnerId: string | null = null;

      if (flightCategory === 'cliente') {
        // Case 1 ou 2: Voos normais
        // client_partner_id = parceiro do proprietário que voou (se houver)
        entryClientPartnerId = selectedClientPartner || null;
      } else if (flightCategory === 'emprestimo') {
        // Case 3: Voos de empréstimo
        // loan_recipient_client_id = cliente que pegou emprestado
        // loan_recipient_partner_id = parceiro do cliente que pegou emprestado (se houver)
        entryLoanRecipientClientId = selectedBorrowerClient || null;
        entryLoanRecipientPartnerId = selectedBorrowerPartner || null;
      }

      // Buscar nome do cliente que pegará emprestado (para preencher partner_name)
      let borrowerPartnerName = '';
      if (flightCategory === 'emprestimo' && selectedBorrowerClient) {
        const borrowerClient = allClients.find(c => c.id === selectedBorrowerClient);
        borrowerPartnerName = borrowerClient?.company_name || '';
      }

      // Calcular célula progressiva (célula anterior + total_time)
      let celulaAnterior = 0;

      // Se há um logbook_month_id, buscar a célula_anterior desse mês
      if (logbookMonthId) {
        const { data: monthData } = await supabase
          .from('logbook_months')
          .select('celula_anterior')
          .eq('id', logbookMonthId)
          .single();

        celulaAnterior = monthData?.celula_anterior || 0;
      }

      // Calcular a célula acumulada para esta entrada
      // celula = celula_anterior + time (DEP→POU)
      const entrycelula = celulaAnterior + flightTime;

      const { data: insertedEntry, error } = await supabase.from('logbook_entries').insert([
        {
          logbook_month_id: typeof logbookMonthId !== 'undefined' ? logbookMonthId : null,
          aircraft_id: aircraftId,
          entry_date: format(date!, 'yyyy-MM-dd'),
          departure_aerodrome: formData.departure_airport,
          arrival_aerodrome: formData.arrival_airport,
          flight_nature: flightNature,
          client_id: entryClientId,
          partner_name: flightCategory === 'emprestimo' ? borrowerPartnerName : null,
          is_equal_split: flightCategory === 'rateio',
          is_loan: flightCategory === 'emprestimo',
          pic_canac: selectedPic,
          sic_canac: selectedSic || null,
          sic_name: sicName || null,
          ac_time: formData.ac_time,
          dep_time: formData.departure_time,
          pou_time: formData.pou_time,
          cor_time: formData.cor_time,
          crew_checkin_time: formData.crew_checkin_time,
          time: flightTime,
          total_time: totalBlockTime,
          day_time: totalDay,
          night_hours: totalNight,
          ifr_time: parseFloat(formData.ifr_count) || 0,
          pousos: parseInt(formData.landings) || 1,
          fuel_added: parseFloat(formData.fuel_added) || 0,
          celula: parseFloat(entrycelula.toFixed(2)),
          daily_rate: finalDailyRate || (formData.daily_rate ? parseBRL(formData.daily_rate) : null),
          distance_nm: parseFloat(formData.distance_nm) || 0,
          passengers: parseInt(passengers) || 0,
          cargo_kg: parseFloat(cargoKg) || 0,
          occurrences: occurrences || null,
          discrepancies: discrepancies || null,
          trecho: `${formData.departure_airport || ''} → ${formData.arrival_airport || ''}`,
        },
      ]).select().single();

      if (error) throw error;

      // Atualizar horas de voo da tripulação
      if (insertedEntry) {
        try {
          await updateCrewFlightHours({
            picId: selectedPic,
            sicId: selectedSic || null,
            aircraftId,
            month: date!.getMonth() + 1,
            year: date!.getFullYear(),
            totalTime: totalBlockTime,
            ifrTime: parseFloat(formData.ifr_count) || 0,
            nightHours: totalNight,
            flightDay: format(date!, 'yyyy-MM-dd'),
            operation: 'add'
          });
        } catch (error) {
          console.error('Erro ao atualizar horas de voo:', error);
          toast({
            title: 'Aviso',
            description: 'Voo registrado, mas houve erro ao atualizar horas de voo da tripulação.',
            variant: 'destructive',
          });
        }
      }

      // Se for empréstimo, registrar na tabela aircraft_loans E no banco de horas (hour_transactions)
      if (flightCategory === 'emprestimo' && insertedEntry) {
        // Buscar nome do PIC se disponível
        const picName = selectedPic ? (allCrew.find(p => p.id === selectedPic)?.full_name || null) : null;

        // Registrar na tabela aircraft_loans
        const loanData = {
          lender_aircraft_id: aircraftId,
          lender_client_id: selectedClient, // Quem emprestou
          borrower_client_id: selectedBorrowerClient, // Quem pegou emprestado
          hours_borrowed: totalBlockTime,
          entry_date: format(date!, 'yyyy-MM-dd'),
          departure_aerodrome: formData.departure_airport || '',
          arrival_aerodrome: formData.arrival_airport || '',
          trecho: `${formData.departure_airport || ''} → ${formData.arrival_airport || ''}`,
          fuel_added: parseFloat(formData.fuel_added) || null,
          pic_name: picName,
          logbook_entry_id: insertedEntry.id,
          status: 'active',
          notes: `Empréstimo registrado via diário de bordo - ${formData.departure_airport} → ${formData.arrival_airport}`,
        };

        console.log('📝 Criando aircraft_loans:', loanData);

        const { error: loanError, data: loanResult } = await supabase.from('aircraft_loans').insert([loanData]).select();

        if (loanError) {
          console.error('❌ Erro ao registrar empréstimo:', loanError);
        } else {
          console.log('✅ aircraft_loans criado com sucesso:', loanResult);
        }

        // 2. Registrar no banco de horas (hour_transactions) - crédito para quem voou
        // Quando alguém voa na aeronave emprestada, o cotista que emprestou recebe crédito
        // para poder usar a aeronave do cliente que voou
        const { error: transactionError } = await supabase.from('hour_transactions').insert([
          {
            aircraft_id: aircraftId,
            from_partner_id: selectedBorrowerClient, // Cliente que usou a aeronave (deve horas)
            to_partner_id: selectedClient, // Cotista que emprestou (recebe crédito)
            hours: totalBlockTime,
            type: 'loan',
            description: `Empréstimo: ${formData.departure_airport} → ${formData.arrival_airport} - Cliente usou aeronave emprestada`,
            logbook_entry_id: insertedEntry.id,
          },
        ]);

        if (transactionError) {
          if (transactionError.code === '403') {
            console.warn('⚠️ Sem permissão para registrar transação (erro 403), mas aircraft_loans foi criado com sucesso');
          } else {
            console.error('Erro ao registrar transação no banco de horas:', transactionError);
            toast({
              title: 'Atenção',
              description: 'Voo registrado, mas houve erro ao registrar no banco de horas.',
              variant: 'destructive',
            });
          }
        } else {
          console.log('✅ Transação de empréstimo registrada no banco de horas');
        }
      }

      toast({
        title: 'Sucesso!',
        description: 'Registro adicionado com sucesso.',
      });

      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['logbook-entries'] });
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      onSuccess?.();

      setTimeout(() => {
        onOpenChange(false);
        setDate(undefined);
        setDateText('');
        setStep(1);
        setDailyCount('');
        setFlightCategory('cliente');
        setSpecialFlightType('');
        setSelectedClient('');
        setSelectedBorrowerClient('');
        setSelectedClientPartner(null);
        setSelectedLenderPartner(null);
        setSelectedBorrowerPartner(null);
        setSelectedPic('');
        setSelectedSic('');
        setSicName('');
        setPassengers('');
        setCargoKg('');
        setOccurrences('');
        setDiscrepancies('');
        resetForm();
        setSaved(false);
      }, 700);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar registro.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c: any) => c.client_id === clientId);
    if (!client?.clients) return 'Cliente não encontrado';
    const clientData = client.clients as any;
    return clientData.company_name || clientData.proprietario || 'Sem nome';
  };

  // Se inline e aberto, renderiza sem Dialog
  const renderDialog = () => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Plane className="h-5 w-5 text-primary" />
              Novo Trecho de Voo
            </DialogTitle>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {step > 1 ? <Check className="h-4 w-4" /> : "1"}
                </div>
                <span className="text-sm font-medium">Dados do Voo</span>
              </div>
              <div className="h-px flex-1 mx-4 bg-border" />
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  2
                </div>
                <span className="text-sm font-medium">Tempos e Extras</span>
              </div>
            </div>
          </div>
        </div>

        {saved && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-background/80 backdrop-blur-sm">
            <div className="bg-success/20 rounded-full p-6 shadow-lg flex items-center justify-center animate-in zoom-in-50">
              <div className="h-16 w-16 rounded-full bg-success text-success-foreground flex items-center justify-center">
                <Check className="h-8 w-8" />
              </div>
            </div>
          </div>
        )}

        <form className="p-6 space-y-6">
          {renderFormContent()}

          {/* Navigation buttons */}
          <div className="flex justify-between gap-2 pt-4 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                setStep(1);
                setDailyCount('');
                setFlightCategory('cliente');
                setSpecialFlightType('');
                setSelectedClient('');
                setSelectedBorrowerClient('');
                setSelectedPic('');
                setSelectedSic('');
                setSicName('');
                setPassengers('');
                setCargoKg('');
                setOccurrences('');
                setDiscrepancies('');
                resetForm();
              }}
              disabled={loading || saved}
            >
              Cancelar
            </Button>

            <div className="flex gap-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={loading || saved}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
              )}

              {step === 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={loading || saved}
                  className="gap-1"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={loading || saved}
                  className="gap-2 min-w-32"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : saved ? (
                    <>
                      <Check className="h-4 w-4" />
                      Salvo!
                    </>
                  ) : (
                    'Salvar Trecho'
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  // Modal de seleção de parceiro (cliente)
  const PartnerSelectDialog = ({
    open,
    onOpenChange,
    partners,
    selectedPartner,
    onSelect,
    title = "Selecionar Parceiro"
  }: any) => {
    if (!open) return null;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {partners.map((partner: any) => (
              <button
                key={partner.id}
                onClick={() => {
                  onSelect(partner.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "w-full text-left p-3 rounded-lg border-2 transition-all",
                  selectedPartner === partner.id
                    ? "border-primary bg-primary/10"
                    : "border-input hover:border-primary/50 hover:bg-accent"
                )}
              >
                <div className="font-semibold">{partner.name}</div>
                {partner.cpf && <div className="text-xs text-muted-foreground">CPF: {partner.cpf}</div>}
                {partner.share_percentage && <div className="text-xs text-muted-foreground">{partner.share_percentage}%</div>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // Conteúdo do formulário (função para evitar remount e perda de foco nos inputs)
  const renderFormContent = () => (
    <>
      {/* PASSO 1: Dados de voo */}
      {step === 1 && (
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
                    setDateText(cleaned);

                    if (cleaned.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
                      const [day, month, year] = cleaned.split('/');
                      const newDate = new Date(Number(year), Number(month) - 1, Number(day));
                      if (!isNaN(newDate.getTime())) {
                        setDate(newDate);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!dateText) return;

                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) {
                      const [day, month, year] = dateText.split('/');
                      const newDate = new Date(Number(year), Number(month) - 1, Number(day));
                      if (!isNaN(newDate.getTime())) {
                        setDate(newDate);
                        setDateText(format(newDate, 'dd/MM/yyyy'));
                        return;
                      }
                    }

                    // Se inválido, volta para a data atual selecionada
                    setDateText(date ? format(date, 'dd/MM/yyyy') : '');
                  }}
                  placeholder="DD/MM/AAAA"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={10}
                  className="flex-1 h-11"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      defaultMonth={date}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Categoria: Cliente, Rateio ou Empréstimo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Responsável pelos Custos
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={flightCategory === 'cliente' ? 'default' : 'outline'}
                  className="flex-1 h-11 text-xs sm:text-sm"
                  onClick={() => {
                    setFlightCategory('cliente');
                    setSpecialFlightType('');
                    setSelectedBorrowerClient('');
                  }}
                >
                  Cliente
                </Button>
                <Button
                  type="button"
                  variant={flightCategory === 'rateio' ? 'default' : 'outline'}
                  className="flex-1 h-11 text-xs sm:text-sm"
                  onClick={() => {
                    setFlightCategory('rateio');
                    setSelectedClient('');
                    setSelectedBorrowerClient('');
                  }}
                >
                  Rateio
                </Button>
                <Button
                  type="button"
                  variant={flightCategory === 'emprestimo' ? 'default' : 'outline'}
                  className="flex-1 h-11 text-xs sm:text-sm bg-amber-600/20 border-amber-500/30 hover:bg-amber-600/30"
                  onClick={() => {
                    setFlightCategory('emprestimo');
                    setSpecialFlightType('');
                  }}
                >
                  Empréstimo
                </Button>
              </div>
            </div>
          </div>

          {/* Seleção de Cliente */}
          {flightCategory === 'cliente' && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <Label>Selecione o Cliente</Label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between h-11 font-normal"
                  >
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
                                setSelectedClient(item.client_id);
                                setClientOpen(false);
                              }}
                            >
                              <Check className={cn(
                                "mr-2 h-4 w-4",
                                selectedClient === item.client_id ? "opacity-100" : "opacity-0"
                              )} />
                              <span>{clientData.company_name || clientData.proprietario}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {item.share_percentage}%
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Seleção de Parceiro (se cliente tiver parceiros) */}
              {selectedClient && clientPartners.length > 0 && (
                <div className="space-y-2 mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg animate-in slide-in-from-top-2">
                  <Label className="text-sm">Parceiro do Cliente (Opcional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-10 font-normal text-sm"
                    onClick={() => setClientPartnerModalOpen(true)}
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
              <Select value={specialFlightType} onValueChange={setSpecialFlightType}>
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

          {/* Empréstimo: Selecionar cotista que empresta e cliente que pega emprestado */}
          {flightCategory === 'emprestimo' && (
            <div className="space-y-4 animate-in slide-in-from-top-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <ArrowRight className="h-4 w-4" />
                <span className="text-sm font-semibold">Configurar Empréstimo</span>
              </div>

              {/* Cotista que está emprestando (seleciona entre os cotistas da aeronave) */}
              <div className="space-y-2">
                <Label>Cotista que empresta a aeronave</Label>
                <Popover open={clientOpen} onOpenChange={setClientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-11 font-normal"
                    >
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
                                  setSelectedClient(item.client_id);
                                  setClientOpen(false);
                                }}
                              >
                                <Check className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClient === item.client_id ? "opacity-100" : "opacity-0"
                                )} />
                                <span>{clientData.company_name || clientData.proprietario}</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {item.share_percentage}%
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Parceiro do Lender (se tiver) */}
              {selectedClient && lenderPartners.length > 0 && (
                <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-in slide-in-from-top-2">
                  <Label className="text-sm">Parceiro do Cotista (Opcional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-10 font-normal text-sm"
                    onClick={() => setLenderPartnerModalOpen(true)}
                  >
                    {selectedLenderPartner
                      ? lenderPartners.find(p => p.id === selectedLenderPartner)?.name
                      : 'Selecione um parceiro...'}
                  </Button>
                </div>
              )}

              {/* Cliente que está pegando emprestado */}
              <div className="space-y-2">
                <Label>Cliente que pega emprestado</Label>
                <Popover open={borrowerClientOpen} onOpenChange={setBorrowerClientOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-11 font-normal border-amber-500/30"
                    >
                      {selectedBorrowerClient
                        ? borrowerClients.find(c => c.id === selectedBorrowerClient)?.company_name || allClients.find(c => c.id === selectedBorrowerClient)?.company_name || 'Cliente selecionado'
                        : 'Selecione quem pega emprestado...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        {borrowerClients.length === 0 ? (
                          <CommandEmpty>Nenhum cliente disponível (talvez todos sejam cotistas).</CommandEmpty>
                        ) : (
                          <CommandGroup heading="Clientes disponíveis">
                            {borrowerClients.map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.company_name || client.proprietario || ''}
                                onSelect={() => {
                                  setSelectedBorrowerClient(client.id);
                                  setBorrowerClientOpen(false);
                                }}
                              >
                                <Check className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedBorrowerClient === client.id ? "opacity-100" : "opacity-0"
                                )} />
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

              {/* Parceiro do Borrower (se tiver) */}
              {selectedBorrowerClient && borrowerPartners.length > 0 && (
                <div className="space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-in slide-in-from-top-2">
                  <Label className="text-sm">Parceiro do Cliente que Pega Emprestado (Opcional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-10 font-normal text-sm"
                    onClick={() => setBorrowerPartnerModalOpen(true)}
                  >
                    {selectedBorrowerPartner
                      ? borrowerPartners.find(p => p.id === selectedBorrowerPartner)?.name
                      : 'Selecione um parceiro...'}
                  </Button>
                </div>
              )}

              <p className="text-xs text-amber-200/80 bg-amber-500/20 p-3 rounded-lg">
                ⚠️ Este voo será registrado como empréstimo. O cotista que emprestar receberá crédito no banco de horas
                para poder usar a aeronave do cliente que voou.
              </p>
            </div>
          )}

          {/* Tripulação: PIC e SIC */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Tripulação *
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {/* PIC (obrigatório) */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">PIC (Piloto em Comando)</Label>
                <Popover open={picOpen} onOpenChange={setPicOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-11 font-normal"
                    >
                      {selectedPic
                        ? (() => {
                            const pic = allCrew.find(t => t.id === selectedPic);
                            return pic ? `${pic.full_name} (${pic.canac})` : 'PIC selecionado';
                          })()
                        : 'Selecione o PIC...'
                      }
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Buscar piloto por nome ou CANAC..." 
                        onValueChange={(value) => {
                          // Permitir busca por nome ou CANAC
                        }}
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum piloto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {allCrew.map((tripulante) => (
                            <CommandItem
                              key={tripulante.id}
                              value={`${tripulante.full_name} ${tripulante.canac}`}
                              onSelect={() => {
                                setSelectedPic(tripulante.id);
                                setPicOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedPic === tripulante.id ? "opacity-100" : "opacity-0"
                                )}
                              />
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

              {/* SIC (opcional) */}
              <SICComboBoxManual
                value={selectedSic ?? ''}
                sicName={sicName ?? ''}
                crew={allCrew}
                onChange={(sicCanac, sicNameValue) => {
                  setSelectedSic(sicCanac ?? '');
                  setSicName(sicNameValue ?? '');
                }}
                label="SIC (Segundo Piloto)"
                placeholder="Selecione ou digite o SIC..."
              />
            </div>
          </div>

          {/* Rota: DE → PARA */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Rota
            </Label>
            <div className="flex items-center gap-2">
              <Popover open={departureOpen} onOpenChange={setDepartureOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="flex-1 justify-between h-12 font-mono text-lg"
                  >
                    {formData.departure_airport || 'ICAO'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Digite o código ICAO..."
                      onValueChange={(value) => {
                        updateField('departure_airport', value.toUpperCase());
                      }}
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
                              updateField('departure_airport', value.toUpperCase());
                              setDepartureOpen(false);
                            }}
                          >
                            <span className="font-mono font-medium">{aerodrome.designativo}</span>
                            <span className="ml-2 text-muted-foreground truncate">
                              {aerodrome.name}
                            </span>
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
                  <Button
                    variant="outline"
                    role="combobox"
                    className="flex-1 justify-between h-12 font-mono text-lg"
                  >
                    {formData.arrival_airport || 'ICAO'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <Command>
                    <CommandInput
                      placeholder="Digite o código ICAO..."
                      onValueChange={(value) => {
                        updateField('arrival_airport', value.toUpperCase());
                      }}
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
                              updateField('arrival_airport', value.toUpperCase());
                              setArrivalOpen(false);
                            }}
                          >
                            <span className="font-mono font-medium">{aerodrome.designativo}</span>
                            <span className="ml-2 text-muted-foreground truncate">
                              {aerodrome.name}
                            </span>
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

          {/* Horários: AC, DEP, POU, COR */}
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
                      onChange={e => updateField(field, e.target.value)}
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

          {/* Apresentação */}
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
      )}

      {/* PASSO 2: Tempo, combustível e extras */}
      {step === 2 && (
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
                    onChange={e => updateField('night_time_hours', e.target.value)}
                    placeholder="0"
                    className="h-14 text-center text-xl font-mono"
                  />
                  <span className="text-xs text-muted-foreground text-center block mt-1">horas</span>
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    min="0"
                    value={formData.night_time_minutes}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val && parseInt(val) > 59) {
                        val = '59';
                      }
                      updateField('night_time_minutes', val);
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
                onChange={e => updateField('ifr_count', e.target.value)}
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
                onChange={e => updateField('landings', e.target.value)}
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
                onChange={e => updateField('fuel_added', e.target.value)}
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
                  onChange={e => setDailyCount(e.target.value)}
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
                  onChange={e => updateField('extras', e.target.value)}
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
                onChange={e => updateField('extras', e.target.value)}
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
                onChange={e => setPassengers(e.target.value)}
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
                onChange={e => setCargoKg(e.target.value)}
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
              onChange={e => setOccurrences(e.target.value)}
              rows={2}
              placeholder="Ocorrências durante o voo..."
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Discrepâncias</Label>
            <Textarea
              value={discrepancies}
              onChange={e => setDiscrepancies(e.target.value)}
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
              onChange={e => updateField('remarks', e.target.value)}
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
      )}
    </>
  );

  // Renderizar inline ou com Dialog
  if (inline && open) {
    return (
      <div className="bg-slate-900 border-2 border-sky-500/20 rounded-3xl p-8 shadow-3xl space-y-8 max-h-[85vh] overflow-y-auto">
        {/* Header inline */}
        <div className="flex items-center gap-3 mb-6">
          <Plane className="h-6 w-6 text-sky-400" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Novo Trecho de Voo</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="ml-auto p-2 hover:bg-slate-800 rounded-xl text-slate-500"
          >
            ✕
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6 px-0">
          <div className="flex items-center gap-2 flex-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <span className="text-sm font-medium text-slate-300">Dados do Voo</span>
          </div>
          <div className="h-px flex-1 mx-4 bg-slate-800" />
          <div className="flex items-center gap-2 flex-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
              2
            </div>
            <span className="text-sm font-medium text-slate-300">Tempos e Extras</span>
          </div>
        </div>

        {saved && (
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none bg-background/80 backdrop-blur-sm">
            <div className="bg-success/20 rounded-full p-6 shadow-lg flex items-center justify-center animate-in zoom-in-50">
              <div className="h-16 w-16 rounded-full bg-success text-success-foreground flex items-center justify-center">
                <Check className="h-8 w-8" />
              </div>
            </div>
          </div>
        )}

        {/* Form content */}
        <form className="space-y-6">
          {renderFormContent()}

          {/* Navigation buttons */}
          <div className="flex justify-between gap-2 pt-4 border-t border-slate-700">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                setStep(1);
                setDailyCount('');
                setFlightCategory('cliente');
                setSpecialFlightType('');
                setSelectedClient('');
                setSelectedPic('');
                setSelectedSic('');
                setSicName('');
                setPassengers('');
                setCargoKg('');
                setOccurrences('');
                setDiscrepancies('');
                resetForm();
              }}
              disabled={loading || saved}
            >
              Cancelar
            </Button>

            <div className="flex gap-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={loading || saved}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
              )}

              {step === 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={loading || saved}
                  className="gap-1"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={loading || saved}
                  className="gap-2 min-w-32"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : saved ? (
                    <>
                      <Check className="h-4 w-4" />
                      Salvo!
                    </>
                  ) : (
                    'Salvar Trecho'
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    );
  }

  // Retornar Dialog normal com modais
  return (
    <>
      {renderDialog()}

      {/* Modal para seleção de parceiro do cliente (voo normal) */}
      <PartnerSelectDialog
        open={clientPartnerModalOpen}
        onOpenChange={setClientPartnerModalOpen}
        partners={clientPartners}
        selectedPartner={selectedClientPartner}
        onSelect={setSelectedClientPartner}
        title="Selecionar Parceiro do Cliente"
      />

      {/* Modal para seleção de parceiro do lender (empréstimo) */}
      <PartnerSelectDialog
        open={lenderPartnerModalOpen}
        onOpenChange={setLenderPartnerModalOpen}
        partners={lenderPartners}
        selectedPartner={selectedLenderPartner}
        onSelect={setSelectedLenderPartner}
        title="Selecionar Parceiro do Cotista"
      />

      {/* Modal para seleção de parceiro do borrower (empréstimo) */}
      <PartnerSelectDialog
        open={borrowerPartnerModalOpen}
        onOpenChange={setBorrowerPartnerModalOpen}
        partners={borrowerPartners}
        selectedPartner={selectedBorrowerPartner}
        onSelect={setSelectedBorrowerPartner}
        title="Selecionar Parceiro do Cliente"
      />
    </>
  );
}
