// @ts-nocheck
import React, { useState, useMemo, useEffect, useReducer } from 'react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Layout } from "../layout/Layout";
import { ArrowLeft, Plus, CheckCircle, Loader2, Save, X, Clock, Navigation, Users, Fuel, Calendar, Search, ChevronLeft, ChevronRight, Plane, Info, AlertCircle, TrendingUp, DollarSign, Edit, Trash2, MapPin, Download, Check, ChevronDown } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { updateCrewFlightHours } from '@/services/crewFlightHours';
import { fetchManutencaoRevisao, fetchManutencaoRevisaoAtiva, updateManutencaoHoras, ensureRevisionMaintenance } from '@/services/manutencoes';
import { 
  MaintenanceStatusAlert,
  CreateMonthDialog,
  CloseMonthDialog,
  ExportLogbookDialog
} from './DiarioBordo/dialogs';
import { PartnerSelectModal } from './PartnerSelectModal';
import { SICComboBoxManual } from './DynamicLogbookForm/components/SICComboBoxManual';
import { useUserRole } from '@/hooks/useUserRole';

// ===================== NOVOS IMPORTS - REFATORAÇÃO =====================
import { timeStringToMinutes, minutesToTimeString, calculateTimeDiff, decimalToTimeString, timeStringToDecimal, calculateCrewCheckinTime, decimalToHHMM, decimalToHoursOnly } from '@/utils/timeUtils';
import { calculateDistance, calculateCostPerPartner, calculateDayNightTimes, calculateDailyAllowanceForEntry } from '@/utils/calculationUtils';
import { formatTimeFromTimestamp, formatDateFromISO, shortenClientName, formatFlightNature, getMonthName } from '@/utils/formatters';
import { logger, logSuccess, logError, logInfo } from '@/utils/logger';
import { validateFlightEntry, formatValidationErrors } from '@/validators/flightEntryValidator';
import { FlightService } from '@/services/flightService';
import { useFlightTimeCalculation } from '@/hooks/useFlightTimeCalculation';
import { TimeInput, CompactTimeInput, TimeInputGroup } from './shared/TimeInput';
import {
  calculateCelulaAtual,
  calculateCelulaDisponivel,
  calculateRunningCelula
} from './DiarioBordo/utils';

// ===================== CONSTANTES LOCAIS =====================
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const FLIGHT_NATURE = ["AE - Aérea/Regular", "CQ - Cheque", "EX - Executivo", "NR - Não Remunerado", "RE - Retorno/Reposição", "PV - Privado", "SA - Serviço Aéreo", "TN - Transporte Não Regular/Táxi Aéreo", "TR - Traslado"];

const SPLIT_FLIGHT_TYPES = [
  { code: 'CQ', label: 'CQ - Cheque (Voo de Verificação)', description: 'Rateio igual entre sócios' },
  { code: 'TR', label: 'TR - Traslado (Ferry/Posicionamento)', description: 'Rateio igual entre sócios' },
  { code: 'TN', label: 'TN - Teste (Manutenção/Teste)', description: 'Rateio igual entre sócios' }
];

// ===================== FUNÇÕES AUXILIARES =====================
const getPartnerNameById = (partnerId: string | null, partnerMap: Record<string, any>): string | null => {
  if (!partnerId) return null;
  return partnerMap[partnerId]?.name || null;
};

const getPartnersFromClient = (client: any, clientPartnersByClientId?: Record<string, any[]>) => {
  if (!client || !client.id) return [];
  if (!clientPartnersByClientId) return [];
  return clientPartnersByClientId[client.id] || [];
};

const calculateTimes = (entry: any) => {
  const result = calculateDayNightTimes({
    dep_time: entry.dep_time,
    pou_time: entry.pou_time,
    total_time: entry.total_time
  });
  return {
    ...entry,
    night_hours: result.night_time,
    day_time: result.day_time
  };
};

// ===================== COMPONENTE PRINCIPAL =====================
const DiarioBordoDetalhes = ({ aircraftId, onBack }: any) => {
  const { isAdmin, isGestorMaster, isPilotoChefe, isCoordenadorVoo, isTripulante } = useUserRole();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTechnicalStatus, setShowTechnicalStatus] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [picNewOpen, setPicNewOpen] = useState(false);
  const [picEditOpen, setPicEditOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [availableMonths, setAvailableMonths] = useState<Array<{ month: number; year: number }>>([]);

  const canEditCelulaFields = isAdmin || isGestorMaster || isPilotoChefe;

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<any[]>([]);
  const [crew, setCrew] = useState<any[]>([]);
  const [aerodromes, setAerodromes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [clientPartners, setClientPartners] = useState<Record<string, any>>({});
  const [clientPartnersByClientId, setClientPartnersByClientId] = useState<Record<string, any[]>>({});
  const [aircraft, setAircraft] = useState<any>(null);
  const [lastCelula, setLastCelula] = useState(0);
  const [logbookMonth, setLogbookMonth] = useState<any>(null);

  const [markedDailies, setMarkedDailies] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`marked-dailies-${aircraftId}-${selectedMonth}-${selectedYear}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    date: 70, from: 60, to: 60, ac: 55, dep: 55, pou: 55, cor: 55,
    tvoo: 65, dia: 65, noite: 65, ifr: 60, pousos: 60, fuel_add: 70,
    celula: 65, pic: 60, canac_pic: 70, sic: 60, canac_sic: 70,
    diarias: 70, voo_para: 80, check: 40, acoes: 70
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState(0);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editingEntryIdForm, setEditingEntryIdForm] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldValue, setEditFieldValue] = useState<string>('');
  const [creatingMonth, setCreatingMonth] = useState(false);
  const [showCreateMonthDialog, setShowCreateMonthDialog] = useState(false);
  const [showCloseMonthDialog, setShowCloseMonthDialog] = useState(false);
  const [previousMonthData, setPreviousMonthData] = useState<any>(null);

  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [pendingClientId, setPendingClientId] = useState<string>('');

  const [loans, setLoans] = useState<any[]>([]);

  const [technicalStatus, setTechnicalStatus] = useState({
    last_maintenance_type: '',
    airframe_hours_next_maintenance: '',
    next_maintenance_type: '',
    maintenance_approval_responsible: '',
    crew_records: [{ date: '', system: '', discrepancy: '', canac: '' }],
    service_return: [{ date: '', corrective_action: '', responsible_canac: '', pic_canac: '' }]
  });

  const [flightType, setFlightType] = useState<'cliente' | 'rateio' | 'emprestimo'>('cliente');

  // Estado do novo lançamento — nomes são aliases internos do componente,
  // mapeados para o schema na hora de montar o payload
  const [newEntry, setNewEntry] = useState({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    pic_canac: '',
    sic_canac: '',
    sic_name: '',
    crew_checkin_time: '',
    departure_aerodrome: '',
    arrival_aerodrome: '',
    client_id: '',
    client_partner_id: null as string | null,
    loan_recipient_client_id: null as string | null,
    loan_recipient_partner_id: null as string | null,
    is_equal_split: false,
    is_loan: false,
    ac_time: '',
    dep_time: '',
    pou_time: '',
    cor_time: '',
    total_time: 0,
    day_time: 0,
    night_hours: 0,
    time: 0,
    ifr_time: 0,
    pousos: 1,
    fuel_added: 0,
    fuel_liters: 0,
    fuel_type: '',
    fuel_location: '',
    fuel_price_per_liter: 0,
    refueled: false,
    celula: 0,
    distance_nm: 0,
    passengers: 0,
    cargo_kg: 0,
    flight_nature: 'PV - Privado',
    occurrences: '',
    discrepancies: '',
    corrective_actions: '',
    daily_quantity: 0
  });

  // ==================== CALCULAR DIÁRIAS ====================
  const calculatePerDiemInfo = useMemo(() => {
    // Usa campos corretos do schema: aerodromo_base, tarifa_diaria, tem_tarifa_diaria
    if (!logbookMonth?.tem_tarifa_diaria || !logbookMonth?.aerodromo_base || !logbookMonth?.tarifa_diaria) {
      return { count: 0, total: 0, details: [], byEntry: {} };
    }

    const baseAerodrome = logbookMonth.aerodromo_base;
    const dailyRate = logbookMonth.tarifa_diaria;

    const periodEntries = entries
      .filter((e: any) => {
        if (!e.data_registro) return false;
        const date = new Date(e.data_registro);
        if (isNaN(date.getTime())) return false;
        return date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.data_registro);
        const dateB = new Date(b.data_registro);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return dateA.getTime() - dateB.getTime();
      });

    const perDiems: Array<{ date: string; location: string; entryId: string }> = [];
    const byEntry: Record<string, number> = {};

    let isAwayFromBase = false;
    let lastAwayDate: Date | null = null;

    for (const flight of periodEntries) {
      const flightDate = new Date(flight.data_registro);
      const origin = flight.aerodromo_partida;
      const destination = flight.aerodromo_chegada;

      if (flight.divisao_igual) {
        byEntry[flight.id] = 0;
        continue;
      }

      if (!isAwayFromBase && origin === baseAerodrome && destination !== baseAerodrome) {
        isAwayFromBase = true;
        lastAwayDate = new Date(flightDate);
        byEntry[flight.id] = 0;
      } else if (isAwayFromBase && destination === baseAerodrome) {
        if (lastAwayDate) {
          let currentDate = new Date(lastAwayDate);
          currentDate.setDate(currentDate.getDate() + 1);
          while (currentDate <= flightDate) {
            perDiems.push({
              date: currentDate.toLocaleDateString('pt-BR'),
              location: `Fora da Base (${baseAerodrome})`,
              entryId: flight.id
            });
            if (currentDate.toDateString() === flightDate.toDateString()) {
              byEntry[flight.id] = (byEntry[flight.id] || 0) + 1;
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
        isAwayFromBase = false;
        lastAwayDate = null;
      } else if (isAwayFromBase && origin !== baseAerodrome && destination !== baseAerodrome) {
        if (lastAwayDate) {
          const lastDate = new Date(lastAwayDate);
          if (flightDate.toDateString() !== lastDate.toDateString()) {
            perDiems.push({
              date: flightDate.toLocaleDateString('pt-BR'),
              location: `Fora da Base (${baseAerodrome})`,
              entryId: flight.id
            });
            byEntry[flight.id] = (byEntry[flight.id] || 0) + 1;
            lastAwayDate = flightDate;
          } else {
            byEntry[flight.id] = byEntry[flight.id] || 0;
          }
        }
      } else {
        byEntry[flight.id] = 0;
      }
    }

    return {
      count: perDiems.length,
      total: perDiems.length * dailyRate,
      details: perDiems,
      byEntry
    };
  }, [entries, selectedMonth, selectedYear, logbookMonth]);

  // ==================== LOAD DATA ====================
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [acRes, crewMembersRes, crewTableRes, aeroRes, clientRes, entriesRes, monthsRes, partnersRes, clientPartnersRes] = await Promise.all([
          supabase.from('aeronave').select('*').eq('status', 'ativa').eq('id', aircraftId).single(),
          supabase.from('membros_tripulacao').select('*').eq('status', 'ativo').order('full_name', { ascending: true }),
          supabase.from('crew').select('id, nome_completo, canac, status').eq('status', 'ativo').order('full_name', { ascending: true }),
          supabase.from('aerodromes').select('*').order('designativo'),
          supabase.from('clientes').select('id, razao_social, cnpj, client_aircraft(aircraft_id, share_percentage)').order('razao_social'),
          // Tabela correta: lancamentos_diario_bordo
          supabase.from('lancamentos_diario_bordo').select('*').eq('aeronave_id', aircraftId).order('numero_sequencial', { ascending: true }),
          supabase.from('diario_mes').select('mes, ano').eq('aeronave_id', aircraftId).eq('fechado', false).order('ano', { ascending: false }).order('mes', { ascending: false }),
          supabase.from('aircraft_partners').select('*, clients(id, razao_social)').eq('aeronave_id', aircraftId),
          supabase.from('socios_cliente').select('id, name, cpf, client_id').order('name')
        ]);

        if (acRes.data) {
          setAircraft(acRes.data);
          setLastCelula(acRes.data.cell_hours_current || 0);
        } else {
          toast.error('Aeronave não encontrada ou não está ativa');
          onBack?.();
          return;
        }

        const crewMembersData = crewMembersRes.data || [];
        const crewTableData = (crewTableRes.data || []).map((p: any) => ({
          id: p.id,
          full_name: p.nome_completo,
          canac: p.canac,
          status: p.status
        }));
        const existingIds = new Set(crewMembersData.map((c: any) => c.id));
        const mergedCrew = [
          ...crewMembersData,
          ...crewTableData.filter((c: any) => !existingIds.has(c.id))
        ];
        setCrew(mergedCrew);
        if (aeroRes.data) setAerodromes(aeroRes.data || []);
        if (clientRes.data) {
          logSuccess('Clientes carregados', { count: clientRes.data.length });
          setClients(clientRes.data || []);
        }
        if (entriesRes.data) {
          logSuccess('Entradas carregadas', { count: entriesRes.data.length });
          setEntries(entriesRes.data || []);
        }
        if (monthsRes.data) setAvailableMonths(monthsRes.data || []);
        if (partnersRes.data) setPartners(partnersRes.data || []);

        if (clientPartnersRes.data) {
          const partnerMap: Record<string, any> = {};
          const partnersByClientId: Record<string, any[]> = {};
          clientPartnersRes.data.forEach((p: any) => {
            partnerMap[p.id] = p;
            if (!partnersByClientId[p.client_id]) {
              partnersByClientId[p.client_id] = [];
            }
            partnersByClientId[p.client_id].push(p);
          });
          setClientPartners(partnerMap);
          setClientPartnersByClientId(partnersByClientId);
        }

        const loansRes = await (supabase as any)
          .from('aircraft_loans')
          .select('*')
          .eq('lender_aircraft_id', aircraftId)
          .order('entry_date', { ascending: false });
        if (loansRes.data) setLoans(loansRes.data || []);

        let { data: monthData } = await supabase
          .from('diario_mes')
          .select('*')
          .eq('aeronave_id', aircraftId)
          .eq('mes', selectedMonth)
          .eq('ano', selectedYear)
          .maybeSingle();

        if (monthData) {
          setLogbookMonth(monthData);
          // Usa campo correto: celula_anterior_ttotal
          setLastCelula(monthData.celula_anterior_ttotal || 0);
        } else {
          const { data: lastMonthData } = await supabase
            .from('diario_mes')
            .select('*')
            .eq('aeronave_id', aircraftId)
            .order('ano', { ascending: false })
            .order('mes', { ascending: false })
            .limit(1)
            .maybeSingle();

          let celulaAnterior = acRes.data?.cell_hours_current || 0;
          if (lastMonthData && lastMonthData.celula_atual_ttotal) {
            celulaAnterior = lastMonthData.celula_atual_ttotal;
          }
          setLastCelula(celulaAnterior);
          setLogbookMonth(null);
        }
      } catch (error) {
        logError("Erro ao carregar dados", error);
        toast.error("Erro ao carregar dados do sistema");
      } finally {
        setLoading(false);
      }
    };

    if (aircraftId) loadData();
  }, [aircraftId, selectedMonth, selectedYear]);

  useEffect(() => {
    if (availableMonths.length > 0) {
      const currentMonthAvailable = availableMonths.some(
        m => m.month === selectedMonth && m.year === selectedYear
      );
      if (!currentMonthAvailable) {
        const firstAvailable = availableMonths[0];
        if (firstAvailable?.month && firstAvailable?.year) {
          setSelectedMonth(firstAvailable.month);
          setSelectedYear(firstAvailable.year);
        }
      }
    }
  }, [availableMonths, selectedMonth, selectedYear]);

  useEffect(() => {
    localStorage.setItem(`marked-dailies-${aircraftId}-${selectedMonth}-${selectedYear}`, JSON.stringify(markedDailies));
  }, [markedDailies, aircraftId, selectedMonth, selectedYear]);

  useEffect(() => {
    if (newEntry.ac_time) {
      const acMin = timeStringToMinutes(newEntry.ac_time);
      const checkinMin = acMin - 30;
      const finalMin = checkinMin < 0 ? checkinMin + 1440 : checkinMin;
      setNewEntry(prev => ({ ...prev, crew_checkin_time: minutesToTimeString(finalMin) }));
    }
  }, [newEntry.ac_time]);

  useEffect(() => {
    if (showAddForm && entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      // Usa campo correto: aerodromo_chegada
      if (lastEntry.aerodromo_chegada && !newEntry.departure_aerodrome) {
        setNewEntry(prev => ({ ...prev, departure_aerodrome: lastEntry.aerodromo_chegada }));
      }
    }
  }, [showAddForm, entries, newEntry.departure_aerodrome]);

  useEffect(() => {
    if (selectedYear && selectedMonth) {
      const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
      if (!isNaN(firstDayOfMonth.getTime())) {
        setNewEntry(prev => ({ ...prev, entry_date: format(firstDayOfMonth, 'yyyy-MM-dd') }));
      }
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (newEntry.departure_aerodrome && newEntry.arrival_aerodrome) {
      const dep = aerodromes.find((a: any) => a.designativo === newEntry.departure_aerodrome);
      const arr = aerodromes.find((a: any) => a.designativo === newEntry.arrival_aerodrome);
      if (dep?.coordenadas && arr?.coordenadas) {
        try {
          const [lat1, lon1] = dep.coordenadas.split(',').map(Number);
          const [lat2, lon2] = arr.coordenadas.split(',').map(Number);
          setNewEntry(prev => ({ ...prev, distance_nm: Math.round(calculateDistance(lat1, lon1, lat2, lon2)) }));
        } catch (e) {
          logError("Erro ao calcular distância", e);
        }
      }
    }
  }, [newEntry.departure_aerodrome, newEntry.arrival_aerodrome, aerodromes]);

  useEffect(() => {
    if (newEntry.ac_time?.trim() && newEntry.cor_time?.trim()) {
      try {
        const totalTime = calculateTimeDiff(newEntry.ac_time, newEntry.cor_time);
        let flightTime = 0;
        if (newEntry.dep_time?.trim() && newEntry.pou_time?.trim()) {
          flightTime = calculateTimeDiff(newEntry.dep_time, newEntry.pou_time);
        }

        let baseParaCalculo = lastCelula;
        if (entries && entries.length > 0) {
          // Usa campo correto: celula
          const celulasExistentes = entries.map((e: any) => Number(e.celula) || 0);
          const ultimaCelulaRegistrada = Math.max(...celulasExistentes);
          if (ultimaCelulaRegistrada > baseParaCalculo) {
            baseParaCalculo = ultimaCelulaRegistrada;
          }
        }

        const newCelula = parseFloat((baseParaCalculo + flightTime).toFixed(1));
        const calculated = calculateTimes({
          ...newEntry,
          total_time: totalTime,
          time: flightTime,
        });

        setNewEntry(prev => ({
          ...prev,
          total_time: totalTime,
          time: flightTime,
          celula: newCelula,
          day_time: calculated.day_time,
          night_hours: calculated.night_hours
        }));
      } catch (error) {
        logError("Erro ao calcular tempos:", error);
      }
    }
  }, [newEntry.ac_time, newEntry.cor_time, newEntry.dep_time, newEntry.pou_time, lastCelula, entries]);

  // ==================== FILTERED ENTRIES ====================
  const filteredEntries = useMemo(() => {
    let filtered = entries.filter((e: any) => {
      // Usa campo correto: data_registro
      if (!e.data_registro) return false;
      const date = new Date(e.data_registro);
      if (isNaN(date.getTime())) return false;
      const matchesPeriod = date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        e.aerodromo_partida?.toLowerCase().includes(searchLower) ||
        e.aerodromo_chegada?.toLowerCase().includes(searchLower) ||
        crew.find((c: any) => c.id === e.pic_canac)?.nome_completo.toLowerCase().includes(searchLower);
      return matchesPeriod && matchesSearch;
    });

    filtered.sort((a: any, b: any) => {
      const seqA = a.numero_sequencial || 0;
      const seqB = b.numero_sequencial || 0;
      return sortDirection === 'asc' ? seqA - seqB : seqB - seqA;
    });

    return filtered;
  }, [entries, selectedMonth, selectedYear, searchTerm, crew, sortDirection]);

  const sortedClients = useMemo(() => {
    if (!clients.length) return [];
    const linkedClients = clients.filter((c: any) => c.client_aircraft?.some((ca: any) => ca.aeronave_id === aircraftId));
    const otherClients = clients.filter((c: any) => !c.client_aircraft?.some((ca: any) => ca.aeronave_id === aircraftId));
    return [...linkedClients, ...otherClients];
  }, [clients, aircraftId]);

  const isMonthAvailable = (month: number, year: number): boolean => {
    return availableMonths.some(m => m.month === month && m.year === year);
  };

  // ==================== ATUALIZAR CÉLULA ====================
  const updateCelulaAtual = async (flightTimeIncrement: number = 0) => {
    if (!logbookMonth) return;

    try {
      // Busca na tabela correta: lancamentos_diario_bordo
      const { data: monthEntries } = await supabase
        .from('lancamentos_diario_bordo')
        .select('id, tempo_total, numero_sequencial')
        .eq('aeronave_id', aircraftId)
        .gte('data_registro', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)
        .lt('data_registro', selectedMonth === 12
          ? `${selectedYear + 1}-01-01`
          : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`)
        .order('numero_sequencial', { ascending: true });

      // Usa campo correto: celula_anterior_ttotal
      const celulaAnterior = logbookMonth.celula_anterior_ttotal ?? 0;

      // Mapear tempo_total para compatibilidade com calculateCelulaAtual
      const mappedEntries = (monthEntries || []).map(e => ({
        ...e,
        total_time: e.tempo_total,
        sequential_number: e.numero_sequencial
      }));

      const newCelulaAtual = calculateCelulaAtual(mappedEntries, celulaAnterior);

      // Usa campo correto: celula_prox_revisao_ttotal
      const newCelulaDisponivel = calculateCelulaDisponivel(
        logbookMonth.celula_prox_revisao_ttotal ?? 0,
        newCelulaAtual
      );

      const newCelulaAtualFormatted = parseFloat(newCelulaAtual.toFixed(2));
      const newCelulaDisponvelFormatted = parseFloat(newCelulaDisponivel.toFixed(2));

      // Atualiza campos corretos no schema: celula_atual_ttotal, celula_disponivel_ttotal
      const { error } = await supabase
        .from('diario_mes')
        .update({
          celula_atual_ttotal: newCelulaAtualFormatted,
          celula_disponivel_ttotal: newCelulaDisponvelFormatted
        })
        .eq('id', logbookMonth.id);

      if (error) {
        logError('Erro ao atualizar célula_atual:', error);
      } else {
        setLogbookMonth({
          ...logbookMonth,
          celula_atual_ttotal: newCelulaAtualFormatted,
          celula_disponivel_ttotal: newCelulaDisponvelFormatted
        });
        await updateMaintenanceHours(newCelulaAtualFormatted);
      }
    } catch (error) {
      logError('Erro ao recalcular célula:', error);
    }
  };

  const updateMaintenanceHours = async (celulaAtual: number) => {
    try {
      let manutencao = await fetchManutencaoRevisaoAtiva(aircraftId);
      if (!manutencao) {
        manutencao = await fetchManutencaoRevisao(aircraftId, selectedMonth, selectedYear);
      }
      if (manutencao && manutencao.id) {
        const horasRealizadas = celulaAtual - (logbookMonth?.celula_anterior_ttotal ?? 0);
        await updateManutencaoHoras(manutencao.id, Math.max(0, horasRealizadas));
      }
    } catch (error) {
      logError('Erro ao atualizar horas de manutenção:', error);
    }
  };

  const goToPreviousMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 1) { newMonth = 12; newYear -= 1; }
    if (isMonthAvailable(newMonth, newYear)) { setSelectedMonth(newMonth); setSelectedYear(newYear); }
  };

  const goToNextMonth = () => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 12) { newMonth = 1; newYear += 1; }
    if (isMonthAvailable(newMonth, newYear)) { setSelectedMonth(newMonth); setSelectedYear(newYear); }
  };

  const saveLogbookMonthField = async (field: string, value: any) => {
    if (!logbookMonth) return;
    try {
      const { error } = await supabase.from('diario_mes').update({ [field]: value }).eq('id', logbookMonth.id);
      if (error) throw error;
      setLogbookMonth({ ...logbookMonth, [field]: value });
      setEditingField(null);
      toast.success('Valor atualizado com sucesso!');
    } catch (error: any) {
      logError(`Erro ao atualizar ${field}:`, error);
      toast.error(`Erro ao atualizar ${field}`);
    }
  };

  const openEditModal = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditFieldValue(currentValue || '');
  };

  const handleSaveField = async () => {
    if (!editingField || editFieldValue === '') return;

    if ((editingField === 'celula_anterior_ttotal' || editingField === 'celula_prox_revisao_ttotal') && !canEditCelulaFields) {
      toast.error('Apenas admin, gestor master ou piloto chefe podem editar estes campos');
      setEditingField(null);
      return;
    }

    // Campos numéricos do schema diario_mes
    const numericFields = ['horimetro_inicio', 'horimetro_final', 'horimetro_ativo', 'tarifa_diaria', 'celula_prox_revisao_ttotal', 'celula_anterior_ttotal'];
    const valueToSave = numericFields.includes(editingField) ? parseFloat(editFieldValue) : editFieldValue;
    await saveLogbookMonthField(editingField, valueToSave);
    setEditFieldValue('');
  };

  const [nextMonthTarget, setNextMonthTarget] = useState<{ month: number; year: number } | null>(null);

  const handleOpenCreateNextMonthDialog = async () => {
    try {
      let nextMonth = selectedMonth + 1;
      let nextYear = selectedYear;
      if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }

      const { data: existingMonth } = await supabase
        .from('diario_mes')
        .select('*')
        .eq('aeronave_id', aircraftId)
        .eq('mes', nextMonth)
        .eq('ano', nextYear)
        .maybeSingle();

      if (existingMonth) { toast.error("Este mês já existe"); return; }

      setNextMonthTarget({ month: nextMonth, year: nextYear });

      if (logbookMonth) {
        setPreviousMonthData({
          // Mapeia campos corretos do schema
          celula_atual_ttotal: logbookMonth.celula_atual_ttotal ?? 0,
          celula_prox_revisao_ttotal: logbookMonth.celula_prox_revisao_ttotal ?? 0,
          horimetro_final: logbookMonth.horimetro_final ?? null,
          aerodromo_base: logbookMonth.aerodromo_base ?? null,
          consumo_combustivel: logbookMonth.consumo_combustivel ?? null,
          tem_tarifa_diaria: logbookMonth.tem_tarifa_diaria ?? false,
          tarifa_diaria: logbookMonth.tarifa_diaria ?? null,
        });
      } else {
        setPreviousMonthData({
          celula_atual_ttotal: aircraft?.cell_hours_current || 0,
          celula_prox_revisao_ttotal: aircraft?.celula_prox_revisao || 0,
          horimetro_final: null,
          aerodromo_base: aircraft?.base || null,
          consumo_combustivel: aircraft?.fuel_consumption?.toString() || null,
          tem_tarifa_diaria: false,
          tarifa_diaria: null,
        });
      }

      setShowMonthPicker(false);
      setShowCreateMonthDialog(true);
    } catch (error: any) {
      logError("Erro ao preparar criação do próximo mês:", error);
      toast.error(error.message || "Erro ao preparar criação do próximo mês");
    }
  };

  // ==================== SALVAR VOO ====================
  /**
   * Função unificada para salvar voo (novo ou edição).
   * Monta o payload usando os nomes corretos do schema lancamentos_diario_bordo.
   */
  const handleSaveFlightEntry = async () => {
    const isEdit = !!editingEntryIdForm;

    if (!newEntry.pic_canac || !newEntry.departure_aerodrome || !newEntry.arrival_aerodrome) {
      toast.error('Preencha todos os campos obrigatórios: PIC, Origem e Destino');
      return;
    }
    if (flightType === 'cliente' && !newEntry.client_id) {
      toast.error('Selecione um cliente para este voo');
      return;
    }
    if (flightType === 'emprestimo') {
      if (!newEntry.client_id) { toast.error('Selecione o cotista que está emprestando a aeronave'); return; }
      if (!newEntry.loan_recipient_client_id) { toast.error('Selecione o cliente que está pegando emprestado'); return; }
    }
    if (!newEntry.ac_time || !newEntry.cor_time) {
      toast.error('Preencha os horários de acionamento e corte');
      return;
    }
    if (!logbookMonth) {
      toast.error('Erro ao carregar período do diário. Recarregue a página.');
      return;
    }

    try {
      const periodEntriesForCalc = entries.filter((e: any) => {
        if (!e.data_registro) return false;
        const date = new Date(e.data_registro);
        if (isNaN(date.getTime())) return false;
        return date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
      });

      let allEntriesForCalc: any[];
      let oldEntry: any = null;

      if (isEdit) {
        oldEntry = entries.find((e: any) => e.id === editingEntryIdForm);
        allEntriesForCalc = periodEntriesForCalc.map((e: any) =>
          e.id === editingEntryIdForm ? newEntry : e
        );
      } else {
        const tempEntry = {
          ...newEntry,
          id: `temp-${Date.now()}`,
          aerodromo_partida: newEntry.departure_aerodrome,
          aerodromo_chegada: newEntry.arrival_aerodrome,
          data_registro: newEntry.entry_date
        };
        allEntriesForCalc = [...periodEntriesForCalc, tempEntry];
      }

      // Calcular diárias
      let dailyCount = 0;
      let dailyValue = 0;

      if (newEntry.daily_quantity > 0) {
        dailyCount = newEntry.daily_quantity;
        dailyValue = dailyCount * (logbookMonth.tarifa_diaria || 0);
      } else {
        // Para calculateDailyAllowanceForEntry, adaptar entradas com campos internos
        const adaptedEntries = allEntriesForCalc.map(e => ({
          ...e,
          departure_aerodrome: e.aerodromo_partida || e.departure_aerodrome,
          arrival_aerodrome: e.aerodromo_chegada || e.arrival_aerodrome,
          entry_date: e.data_registro || e.entry_date,
          is_equal_split: e.divisao_igual ?? e.is_equal_split
        }));

        dailyCount = calculateDailyAllowanceForEntry(
          { ...newEntry, departure_aerodrome: newEntry.departure_aerodrome, arrival_aerodrome: newEntry.arrival_aerodrome },
          logbookMonth.aerodromo_base || '',
          adaptedEntries
        );
        dailyValue = dailyCount * (logbookMonth.tarifa_diaria || 0);
      }

      // ==================== PAYLOAD com nomes corretos do schema ====================
      const entryPayload = {
        diario_mes: logbookMonth.id,                    // FK → diario_mes.id
        aeronave_id: aircraftId,
        data_registro: newEntry.entry_date,              // date
        aerodromo_partida: newEntry.departure_aerodrome,
        aerodromo_chegada: newEntry.arrival_aerodrome,
        tripulacao_checkin_hora: newEntry.crew_checkin_time || null,
        tempo_ac: newEntry.ac_time || null,
        tempo_dep: newEntry.dep_time || null,
        tempo_pou: newEntry.pou_time || null,
        tempo_cor: newEntry.cor_time || null,
        pic_canac: newEntry.pic_canac,
        sic_canac: newEntry.sic_canac || null,
        sic_name: newEntry.sic_name || null,
        clientes_id: newEntry.is_equal_split ? null : newEntry.client_id || null,
        socios_cliente_id: newEntry.is_equal_split
          ? null
          : (newEntry.is_loan ? null : newEntry.client_partner_id || null),
        cliente_tomador_emprestimo_id: newEntry.is_loan ? newEntry.loan_recipient_client_id || null : null,
        parceiro_tomador_emprestimo_id: newEntry.is_loan ? newEntry.loan_recipient_partner_id || null : null,
        divisao_igual: newEntry.is_equal_split,
        empreendimento: newEntry.is_loan || false,
        tempo_total: newEntry.total_time,               // total_time → tempo_total
        tempo_voo: newEntry.time,                       // time → tempo_voo
        horas_diurnas: newEntry.day_time,               // day_time → horas_diurnas
        horas_noturnas: newEntry.night_hours,           // night_hours → horas_noturnas
        tempo_ifr: newEntry.ifr_time,                   // ifr_time → tempo_ifr
        pousos_total: newEntry.pousos,                  // pousos → pousos_total
        combustivel_adicionado: newEntry.fuel_added,    // fuel_added → combustivel_adicionado
        litros_combustivel: newEntry.fuel_liters,       // fuel_liters → litros_combustivel
        tipo_combustivel: newEntry.fuel_type || null,
        local_combustivel: newEntry.fuel_location || null,
        preco_combustivel_litro: newEntry.fuel_price_per_liter || null,
        abastecido: newEntry.refueled,                  // refueled → abastecido
        celula: newEntry.celula,
        distancia_nm: newEntry.distance_nm,             // distance_nm → distancia_nm
        passageiros: newEntry.passengers,               // passengers → passageiros
        carga_kg: newEntry.cargo_kg?.toString() || null, // cargo_kg é text no schema
        natureza_voo: newEntry.flight_nature,           // flight_nature → natureza_voo
        ocorrencias: newEntry.occurrences || null,      // occurrences → ocorrencias
        discrepancias: newEntry.discrepancies || null,  // discrepancies → discrepancias
        acoes_corretivas: newEntry.corrective_actions || null, // corrective_actions → acoes_corretivas
        confirmado: isEdit ? (oldEntry?.confirmado || false) : false,
        tarifa_diaria: dailyValue?.toString() || null,  // tarifa_diaria é text no lancamentos
        trecho: `${newEntry.departure_aerodrome || ''} → ${newEntry.arrival_aerodrome || ''}`
      };

      let insertedEntryId: string;

      if (isEdit) {
        const { error } = await supabase
          .from('lancamentos_diario_bordo')
          .update(entryPayload)
          .eq('id', editingEntryIdForm);
        if (error) throw error;
        insertedEntryId = editingEntryIdForm;
        logSuccess('Voo atualizado no banco');
      } else {
        const { error } = await supabase
          .from('lancamentos_diario_bordo')
          .insert([entryPayload]);
        if (error) throw error;

        const { data: insertedData } = await supabase
          .from('lancamentos_diario_bordo')
          .select('id')
          .eq('aeronave_id', aircraftId)
          .eq('data_registro', newEntry.entry_date)
          .eq('aerodromo_partida', newEntry.departure_aerodrome)
          .eq('aerodromo_chegada', newEntry.arrival_aerodrome)
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!insertedData?.id) throw new Error('Falha ao recuperar ID do voo inserido');
        insertedEntryId = insertedData.id;
        logSuccess('Voo criado no banco');
      }

      // ==================== SINCRONIZAR EMPRÉSTIMOS ====================
      if (isEdit && oldEntry) {
        const wasLoan = oldEntry?.empreendimento === true;
        const isLoanNow = newEntry.is_loan === true;

        if (wasLoan && !isLoanNow) {
          await supabase.from('aircraft_loans').delete().eq('logbook_entry_id', editingEntryIdForm);
        } else if (!wasLoan && isLoanNow) {
          const picName = newEntry.pic_canac
            ? (crew.find((t: any) => t.canac === newEntry.pic_canac)?.nome_completo || null)
            : null;
          const loanData = {
            lender_aircraft_id: aircraftId,
            lender_client_id: newEntry.client_id,
            borrower_client_id: newEntry.loan_recipient_client_id,
            hours_borrowed: newEntry.total_time,
            entry_date: newEntry.entry_date,
            departure_aerodrome: newEntry.departure_aerodrome || '',
            arrival_aerodrome: newEntry.arrival_aerodrome || '',
            trecho: `${newEntry.departure_aerodrome || ''} → ${newEntry.arrival_aerodrome || ''}`,
            fuel_added: newEntry.fuel_added || null,
            pic_name: picName,
            logbook_entry_id: insertedEntryId,
            status: 'active',
            notes: `Empréstimo editado via diário de bordo`,
          };
          const { error: loanError } = await supabase.from('aircraft_loans').insert([loanData]);
          if (loanError) throw loanError;
        } else if (wasLoan && isLoanNow) {
          const picName = newEntry.pic_canac
            ? (crew.find((t: any) => t.canac === newEntry.pic_canac)?.nome_completo || null)
            : null;
          const loanUpdateData = {
            hours_borrowed: newEntry.total_time,
            entry_date: newEntry.entry_date,
            departure_aerodrome: newEntry.departure_aerodrome,
            arrival_aerodrome: newEntry.arrival_aerodrome,
            trecho: `${newEntry.departure_aerodrome} → ${newEntry.arrival_aerodrome}`,
            fuel_added: newEntry.fuel_added || null,
            pic_name: picName,
            borrower_client_id: newEntry.loan_recipient_client_id,
          };
          const { error: updateError } = await supabase
            .from('aircraft_loans')
            .update(loanUpdateData)
            .eq('logbook_entry_id', editingEntryIdForm);
          if (updateError) throw updateError;
        }
      } else if (!isEdit && newEntry.is_loan) {
        const picName = newEntry.pic_canac
          ? (crew.find((t: any) => t.canac === newEntry.pic_canac)?.nome_completo || null)
          : null;
        const loanData = {
          lender_aircraft_id: aircraftId,
          lender_client_id: newEntry.client_id,
          borrower_client_id: newEntry.loan_recipient_client_id,
          hours_borrowed: newEntry.total_time,
          entry_date: newEntry.entry_date,
          departure_aerodrome: newEntry.departure_aerodrome || '',
          arrival_aerodrome: newEntry.arrival_aerodrome || '',
          trecho: `${newEntry.departure_aerodrome || ''} → ${newEntry.arrival_aerodrome || ''}`,
          fuel_added: newEntry.fuel_added || null,
          pic_name: picName,
          logbook_entry_id: insertedEntryId,
          status: 'active',
          notes: `Empréstimo criado via diário de bordo`,
        };
        const { error: loanError } = await supabase.from('aircraft_loans').insert([loanData]);
        if (loanError) throw loanError;
      }

      // ==================== ATUALIZAR HORAS DE TRIPULAÇÃO ====================
      if (isEdit && oldEntry) {
        const oldDate = oldEntry.data_registro ? new Date(oldEntry.data_registro) : null;
        const newDate = newEntry.entry_date ? new Date(newEntry.entry_date) : null;
        if (!oldDate || isNaN(oldDate.getTime()) || !newDate || isNaN(newDate.getTime())) {
          toast.error('Data inválida. Verifique os dados do voo.');
          setIsSubmitting(false);
          return;
        }
        const crewChanged = oldEntry.pic_canac !== newEntry.pic_canac || oldEntry.sic_canac !== newEntry.sic_canac;
        const dateChanged = oldDate.getMonth() !== newDate.getMonth() || oldDate.getFullYear() !== newDate.getFullYear();
        const hoursChanged = oldEntry.tempo_total !== newEntry.total_time || oldEntry.tempo_ifr !== newEntry.ifr_time || oldEntry.horas_noturnas !== newEntry.night_hours;

        if (crewChanged || dateChanged || hoursChanged) {
          await updateCrewFlightHours({
            picId: oldEntry.pic_canac, sicId: oldEntry.sic_canac || null, aircraftId,
            month: oldDate.getMonth() + 1, year: oldDate.getFullYear(),
            totalTime: oldEntry.tempo_total, ifrTime: oldEntry.tempo_ifr || 0,
            nightHours: oldEntry.horas_noturnas || 0, flightDay: oldEntry.data_registro, operation: 'remove'
          });
          await updateCrewFlightHours({
            picId: newEntry.pic_canac, sicId: newEntry.sic_canac || null, aircraftId,
            month: newDate.getMonth() + 1, year: newDate.getFullYear(),
            totalTime: newEntry.total_time, ifrTime: newEntry.ifr_time || 0,
            nightHours: newEntry.night_hours || 0, flightDay: newEntry.entry_date, operation: 'add'
          });
        }
      } else {
        const entryDate = new Date(newEntry.entry_date);
        await updateCrewFlightHours({
          picId: newEntry.pic_canac, sicId: newEntry.sic_canac || null, aircraftId,
          month: entryDate.getMonth() + 1, year: entryDate.getFullYear(),
          totalTime: newEntry.total_time, ifrTime: newEntry.ifr_time || 0,
          nightHours: newEntry.night_hours || 0, flightDay: newEntry.entry_date, operation: 'add'
        });
      }

      if (!isEdit) setLastCelula(newEntry.celula);

      toast.success(isEdit ? 'Voo atualizado!' : 'Voo registrado!');

      // Recarregar da tabela correta
      const { data: updatedEntries } = await supabase
        .from('lancamentos_diario_bordo')
        .select('*')
        .eq('aeronave_id', aircraftId)
        .order('diario_mes', { ascending: false })
        .order('numero_sequencial', { ascending: true });

      if (updatedEntries) {
        setEntries(updatedEntries);
        let flightTimeIncrement = newEntry.total_time || 0;
        if (isEdit && oldEntry) {
          flightTimeIncrement = (newEntry.total_time || 0) - (oldEntry.tempo_total || 0);
        }
        await updateCelulaAtual(flightTimeIncrement);
      }

      // Reset form
      resetNewEntry();
      setFlightType('cliente');
      setEditingEntryIdForm(null);
      setShowAddForm(false);

    } catch (error: any) {
      logError(`Erro ao ${isEdit ? 'atualizar' : 'criar'} voo:`, error);
      toast.error(`Erro ao ${isEdit ? 'atualizar' : 'criar'} voo: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const resetNewEntry = () => {
    setNewEntry({
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      pic_canac: '', sic_canac: '', sic_name: '', crew_checkin_time: '',
      departure_aerodrome: '', arrival_aerodrome: '',
      client_id: '', client_partner_id: null, loan_recipient_client_id: null, loan_recipient_partner_id: null,
      is_equal_split: false, is_loan: false,
      ac_time: '', dep_time: '', pou_time: '', cor_time: '',
      total_time: 0, day_time: 0, night_hours: 0, time: 0, ifr_time: 0,
      pousos: 1, fuel_added: 0, fuel_liters: 0, fuel_type: '', fuel_location: '',
      fuel_price_per_liter: 0, refueled: false, celula: 0, distance_nm: 0,
      passengers: 0, cargo_kg: 0, flight_nature: 'PV - Privado',
      occurrences: '', discrepancies: '', corrective_actions: '', daily_quantity: 0
    });
  };

  // ==================== EDITAR ENTRADA ====================
  const handleEditEntry = (entry: any) => {
    // Mapeia campos do schema de volta para os aliases internos do componente
    setNewEntry({
      ...newEntry,
      entry_date: entry.data_registro,
      pic_canac: entry.pic_canac || '',
      sic_canac: entry.sic_canac || '',
      sic_name: entry.sic_name || '',
      crew_checkin_time: entry.tripulacao_checkin_hora || '',
      departure_aerodrome: entry.aerodromo_partida || '',
      arrival_aerodrome: entry.aerodromo_chegada || '',
      client_id: entry.clientes_id || '',
      client_partner_id: entry.socios_cliente_id || null,
      loan_recipient_client_id: entry.empreendimento ? (entry.cliente_tomador_emprestimo_id || null) : null,
      loan_recipient_partner_id: entry.empreendimento ? (entry.parceiro_tomador_emprestimo_id || null) : null,
      is_equal_split: entry.divisao_igual || false,
      is_loan: entry.empreendimento || false,
      ac_time: entry.tempo_ac || '',
      dep_time: entry.tempo_dep || '',
      pou_time: entry.tempo_pou || '',
      cor_time: entry.tempo_cor || '',
      total_time: entry.tempo_total || 0,
      day_time: entry.horas_diurnas || 0,
      night_hours: entry.horas_noturnas || 0,
      time: entry.tempo_voo || 0,
      ifr_time: entry.tempo_ifr || 0,
      pousos: entry.pousos_total || 1,
      fuel_added: entry.combustivel_adicionado || 0,
      fuel_liters: entry.litros_combustivel || 0,
      fuel_type: entry.tipo_combustivel || '',
      fuel_location: entry.local_combustivel || '',
      fuel_price_per_liter: entry.preco_combustivel_litro || 0,
      refueled: entry.abastecido || false,
      celula: entry.celula || 0,
      distance_nm: entry.distancia_nm || 0,
      passengers: entry.passageiros || 0,
      cargo_kg: parseFloat(entry.carga_kg) || 0,
      flight_nature: entry.natureza_voo || 'PV - Privado',
      occurrences: entry.ocorrencias || '',
      discrepancies: entry.discrepancias || '',
      corrective_actions: entry.acoes_corretivas || '',
      daily_quantity: parseFloat(entry.tarifa_diaria) > 0 && logbookMonth?.tarifa_diaria > 0
        ? Math.round(parseFloat(entry.tarifa_diaria) / logbookMonth.tarifa_diaria)
        : 0
    });

    if (entry.divisao_igual) {
      setFlightType('rateio');
    } else if (entry.empreendimento) {
      setFlightType('emprestimo');
    } else {
      setFlightType('cliente');
    }

    setEditingEntryIdForm(entry.id);
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditingEntry(null);
    setEditingEntryIdForm(null);
    setShowAddForm(false);
  };

  // ==================== DELETAR ENTRADA ====================
  const handleDeleteEntry = async (id: string) => {
    const canDeleteEntry = isAdmin || isGestorMaster || isPilotoChefe || isCoordenadorVoo || isTripulante;
    if (!canDeleteEntry) {
      toast.error('Você não tem permissão para deletar lançamentos');
      return;
    }
    if (!window.confirm('Tem certeza que deseja deletar este lançamento?')) return;

    try {
      const { data: entryToDelete } = await supabase
        .from('lancamentos_diario_bordo')
        .select('*')
        .eq('id', id)
        .single();

      if (!entryToDelete) throw new Error('Entrada não encontrada');

      if (entryToDelete.empreendimento) {
        await supabase.from('aircraft_loans').delete().eq('logbook_entry_id', id);
        await supabase.from('hour_transactions').delete().eq('logbook_entry_id', id);
      }

      const { error } = await supabase.from('lancamentos_diario_bordo').delete().eq('id', id);
      if (error) throw error;

      if (entryToDelete.data_registro) {
        const entryDate = new Date(entryToDelete.data_registro);
        if (!isNaN(entryDate.getTime())) {
          await updateCrewFlightHours({
            picId: entryToDelete.pic_canac,
            sicId: entryToDelete.sic_canac || null,
            aircraftId,
            month: entryDate.getMonth() + 1,
            year: entryDate.getFullYear(),
            totalTime: entryToDelete.tempo_total,
            ifrTime: entryToDelete.tempo_ifr || 0,
            nightHours: entryToDelete.horas_noturnas || 0,
            flightDay: entryToDelete.data_registro,
            operation: 'remove'
          });
        }
      }

      toast.success("Lançamento deletado com sucesso!");

      const { data } = await supabase
        .from('lancamentos_diario_bordo')
        .select('*')
        .eq('aeronave_id', aircraftId)
        .order('diario_mes', { ascending: false })
        .order('numero_sequencial', { ascending: true });

      if (data) {
        setEntries(data);
        await updateCelulaAtual(-(entryToDelete.tempo_total || 0));
      }
    } catch (error: any) {
      logError("Erro ao deletar lançamento:", error);
      toast.error("Erro ao deletar lançamento: " + (error.message || 'Erro desconhecido'));
    }
  };

  // ==================== RESIZE ====================
  const handleResizeMouseDown = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(columnKey);
    setResizeStart(e.clientX);
  };

  useEffect(() => {
    if (!resizingColumn) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStart;
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: Math.max(40, (prev[resizingColumn] || 50) + delta) }));
      setResizeStart(e.clientX);
    };
    const handleMouseUp = () => setResizingColumn(null);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [resizingColumn, resizeStart]);

  // ==================== CRIAR MÊS ====================
  const handleOpenCreateMonthDialog = async () => {
    try {
      const { data: lastMonthData } = await supabase
        .from('diario_mes')
        .select('*')
        .eq('aeronave_id', aircraftId)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1)
        .single();

      if (lastMonthData) {
        setPreviousMonthData(lastMonthData);
      } else {
        setPreviousMonthData({
          celula_atual_ttotal: aircraft?.cell_hours_current || 0,
          celula_prox_revisao_ttotal: aircraft?.celula_prox_revisao || 0,
          horimetro_final: null,
          aerodromo_base: aircraft?.base || null,
          consumo_combustivel: aircraft?.fuel_consumption?.toString() || null,
          tem_tarifa_diaria: false,
          tarifa_diaria: null,
        });
      }
      setShowCreateMonthDialog(true);
    } catch (error) {
      logError("Erro ao buscar dados do mês anterior:", error);
      setPreviousMonthData({ celula_atual_ttotal: aircraft?.cell_hours_current || 0, celula_prox_revisao_ttotal: 0 });
      setShowCreateMonthDialog(true);
    }
  };

  const handleCreateMonthWithData = async (monthData: any) => {
    try {
      setCreatingMonth(true);
      const targetMonth = monthData.mes || selectedMonth;
      const targetYear = monthData.ano || selectedYear;

      const { data: existingMonth } = await supabase
        .from('diario_mes')
        .select('id, mes, ano')
        .eq('aeronave_id', aircraftId)
        .eq('mes', targetMonth)
        .eq('ano', targetYear)
        .maybeSingle();

      if (existingMonth) {
        toast.error(`Já existe um diário para ${MONTHS[targetMonth - 1]} de ${targetYear}.`);
        setCreatingMonth(false);
        return;
      }

      const { data: newMonth, error } = await supabase
        .from('diario_mes')
        .insert([monthData])
        .select()
        .single();

      if (error) throw error;

      if (newMonth) {
        setSelectedMonth(targetMonth);
        setSelectedYear(targetYear);
        setLogbookMonth(newMonth);

        if (monthData.celula_prox_revisao_ttotal && monthData.celula_prox_revisao_ttotal > 0) {
          try {
            await ensureRevisionMaintenance(aircraftId, targetMonth, targetYear, monthData.celula_prox_revisao_ttotal, MONTHS);
          } catch (maintenanceError) {
            logError("Erro ao criar manutenção automática:", maintenanceError);
          }
        }

        toast.success(`Diário de ${MONTHS[targetMonth - 1]}/${targetYear} criado com sucesso!`);
        setAvailableMonths(prev => [...prev, { month: targetMonth, year: targetYear }]);
      }
    } catch (error: any) {
      logError("Erro ao criar mês:", error);
      toast.error("Erro ao criar diário do mês: " + (error.message || 'Erro desconhecido'));
      throw error;
    } finally {
      setCreatingMonth(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center bg-[#070910]">
          <Loader2 className="animate-spin text-sky-500" size={48} />
        </div>
      </Layout>
    );
  }

  if (!aircraft) return (
    <Layout>
      <div className="h-screen flex items-center justify-center bg-[#070910] text-white">
        <div className="text-center">
          <Plane size={48} className="mx-auto mb-4 text-slate-500" />
          <p>Aeronave não encontrada</p>
        </div>
      </div>
    </Layout>
  );

  return <Layout>
    <div className="min-h-screen bg-[#070910] text-white">
      <div className="max-w-[1800px] mx-auto p-6 space-y-6">

        {/* HEADER */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="p-3 bg-slate-950 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all">
              <ArrowLeft size={20} className="text-slate-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter">{aircraft?.matricula}</h1>
              <p className="text-[10px] font-bold text-sky-500 uppercase tracking-[0.2em] py-[7px]">{aircraft?.model}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button onClick={goToPreviousMonth} disabled={!isMonthAvailable(selectedMonth === 1 ? 12 : selectedMonth - 1, selectedMonth === 1 ? selectedYear - 1 : selectedYear)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronLeft size={20} />
              </button>
              <button onClick={() => setShowMonthPicker(true)} className="px-6 py-2 text-sm font-black text-white uppercase hover:text-sky-500 transition-colors">
                {MONTHS[selectedMonth - 1]} {selectedYear}
              </button>
              <button onClick={goToNextMonth} disabled={!isMonthAvailable(selectedMonth === 12 ? 1 : selectedMonth + 1, selectedMonth === 12 ? selectedYear + 1 : selectedYear)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronRight size={20} />
              </button>
            </div>

            <button onClick={() => setShowTechnicalStatus(!showTechnicalStatus)} className={`${showTechnicalStatus ? 'bg-slate-800 text-slate-400' : 'bg-emerald-600 text-white'} rounded-2xl px-6 font-black uppercase text-xs h-12 shadow-lg transition-all`}>
              {showTechnicalStatus ? <X className="mr-2" size={16} /> : <Plus className="mr-2" size={16} />}
              {showTechnicalStatus ? "Cancelar" : "Situação Técnica"}
            </button>

            {logbookMonth && (
              <button onClick={() => setShowExportDialog(true)} className="px-6 h-12 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-2xl text-sky-400 font-black uppercase text-xs transition-all">
                <Download className="inline mr-2" size={16} />
                Exportar PDF
              </button>
            )}

            {logbookMonth && (
              <button onClick={() => setShowCloseMonthDialog(true)} className="px-6 h-12 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-2xl text-red-400 font-black uppercase text-xs transition-all">
                <X className="inline mr-2" size={16} />
                Fechar Diário
              </button>
            )}
          </div>
        </div>

        {/* MENSAGEM QUANDO DIÁRIO NÃO EXISTE */}
        {!logbookMonth && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center shadow-2xl">
            <Calendar size={48} className="mx-auto mb-6 text-slate-500" />
            <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Diário de {MONTHS[selectedMonth - 1]} não existe</h2>
            <p className="text-slate-400 text-sm mb-8">Configure e crie um novo diário para começar a registrar voos neste período.</p>
            <button onClick={handleOpenCreateMonthDialog} disabled={creatingMonth} className="px-8 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 text-white font-black uppercase text-sm rounded-xl transition-all shadow-lg">
              {creatingMonth ? <><Loader2 className="inline mr-2 animate-spin" size={16} />Criando...</> : <><Plus className="inline mr-2" size={16} />Configurar Diário de {MONTHS[selectedMonth - 1]}</>}
            </button>
          </div>
        )}

        {/* Dialogs */}
        <CreateMonthDialog
          open={showCreateMonthDialog}
          onOpenChange={setShowCreateMonthDialog}
          aircraftId={aircraftId}
          aircraftRegistration={aircraft?.matricula || ''}
          month={selectedMonth}
          year={selectedYear}
          previousMonthData={previousMonthData}
          onCreate={handleCreateMonthWithData}
        />

        <CloseMonthDialog
          open={showCloseMonthDialog}
          onOpenChange={setShowCloseMonthDialog}
          aircraftId={aircraftId}
          month={selectedMonth - 1}
          year={selectedYear}
          totalHours={entries.reduce((sum, e) => sum + (Number(e.tempo_total) || 0), 0)}
          totalLandings={entries.reduce((sum, e) => sum + (Number(e.pousos_total) || 0), 0)}
          totalFuelAdded={entries.reduce((sum, e) => sum + (Number(e.combustivel_adicionado) || 0), 0)}
          onSuccess={() => { setShowCloseMonthDialog(false); onBack(); }}
        />

        <ExportLogbookDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          aircraftId={aircraftId}
          aircraftRegistration={aircraft?.matricula || ''}
          aircraftModel={aircraft?.model || ''}
          clientName={''}
          availableMonths={availableMonths}
          entries={entries}
          currentMonth={selectedMonth}
          currentYear={selectedYear}
        />

        {/* Modal de seleção de parceiro */}
        {(() => {
          const selectedClient = clients.find(c => c.id === pendingClientId);
          const clientPartnersForModal = getPartnersFromClient(selectedClient, clientPartnersByClientId);
          const currentPartnerId = flightType === 'emprestimo' && pendingClientId === newEntry.loan_recipient_client_id
            ? newEntry.loan_recipient_partner_id
            : newEntry.client_partner_id;
          const currentPartnerName = clientPartnersForModal.find(p => p.id === currentPartnerId)?.name || '';
          const partnersWithIndex = clientPartnersForModal.map((p, idx) => ({ ...p, index: idx }));

          return (
            <PartnerSelectModal
              open={showPartnerModal}
              onOpenChange={setShowPartnerModal}
              clientName={selectedClient?.razao_social || ''}
              partners={partnersWithIndex}
              selectedPartner={currentPartnerName}
              onSelectPartner={(partnerName) => {
                const partner = clientPartnersForModal.find(p => p.name === partnerName);
                const partnerId = partner?.id || null;
                if (flightType === 'emprestimo') {
                  if (pendingClientId === newEntry.loan_recipient_client_id) {
                    setNewEntry({ ...newEntry, loan_recipient_partner_id: partnerId });
                  } else {
                    setNewEntry({ ...newEntry, client_partner_id: null });
                  }
                } else {
                  setNewEntry({ ...newEntry, client_partner_id: partnerId });
                }
                setShowPartnerModal(false);
              }}
            />
          );
        })()}

        {/* INFORMAÇÕES TÉCNICAS DO PERÍODO */}
        {logbookMonth && <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-0 px-[28px]">
            {/* CÉLULA ANTERIOR */}
            <div className="group relative bg-slate-900 border rounded-2xl p-6 shadow-xl transition-all border-violet-400 overflow-visible">
              {canEditCelulaFields && (
                <button onClick={() => openEditModal('celula_anterior_ttotal', logbookMonth.celula_anterior_ttotal?.toString() || '0.00')} className="absolute top-2 right-2 p-2 rounded-lg bg-violet-500/40 hover:bg-violet-500/60 text-violet-200 hover:text-violet-100 transition-all duration-200 z-10 shadow-lg" title="Editar Célula Anterior">
                  <Edit size={20} />
                </button>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[9px] uppercase font-bold tracking-widest mb-1 text-violet-400">Célula Anterior</p>
                  {/* Campo correto: celula_anterior_ttotal */}
                  <p className="text-3xl font-black text-violet-400">{logbookMonth.celula_anterior_ttotal?.toFixed(2) || '0.00'}</p>
                  <p className="text-[10px] text-slate-500 mt-1">horas</p>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-sky-600 to-sky-400 rounded-full text-violet-400"></div>
            </div>

            {/* CÉLULA ATUAL */}
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl hover:border-emerald-500/50 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[9px] text-emerald-500 uppercase font-bold tracking-widest mb-1">Célula Atual</p>
                  {/* Campo correto: celula_atual_ttotal */}
                  <p className="text-3xl font-black text-emerald-400">{logbookMonth.celula_atual_ttotal?.toFixed(2) || lastCelula.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">horas</p>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"></div>
            </div>

            {/* PRÓXIMA REVISÃO */}
            <div className="group relative bg-slate-900 border border-orange-500/30 rounded-2xl p-6 shadow-xl hover:border-orange-500/50 transition-all overflow-visible">
              {canEditCelulaFields && (
                <button onClick={() => openEditModal('celula_prox_revisao_ttotal', logbookMonth.celula_prox_revisao_ttotal?.toString() || '0.00')} className="absolute top-2 right-2 p-2 rounded-lg bg-orange-500/40 hover:bg-orange-500/60 text-orange-200 hover:text-orange-100 transition-all duration-200 z-10 shadow-lg" title="Editar Próxima Revisão">
                  <Edit size={20} />
                </button>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[9px] text-orange-500 uppercase font-bold tracking-widest mb-1">Próx. Revisão</p>
                  {/* Campo correto: celula_prox_revisao_ttotal */}
                  <p className="text-3xl font-black text-orange-400">{logbookMonth.celula_prox_revisao_ttotal?.toFixed(2) || '-'}</p>
                  <p className="text-[10px] text-slate-500 mt-1">horas</p>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"></div>
            </div>

            {/* DISPONÍVEL */}
            <div className={`bg-slate-900 rounded-2xl p-6 shadow-xl transition-all ${(logbookMonth.celula_disponivel_ttotal || 0) < 0 ? 'border-2 border-red-500 hover:border-red-400 shadow-lg shadow-red-500/20' : 'border border-blue-500/30 hover:border-blue-500/50'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className={`text-[9px] uppercase font-bold tracking-widest mb-1 ${(logbookMonth.celula_disponivel_ttotal || 0) < 0 ? 'text-red-500' : 'text-blue-500'}`}>Disponível</p>
                  {/* Campo correto: celula_disponivel_ttotal */}
                  <p className={`text-3xl font-black ${(logbookMonth.celula_disponivel_ttotal || 0) < 0 ? 'text-red-400' : 'text-blue-400'}`}>{logbookMonth.celula_disponivel_ttotal?.toFixed(2) || '0.00'}</p>
                  <p className="text-[10px] text-slate-500 mt-1">horas</p>
                </div>
              </div>
              <div className={`h-1 rounded-full ${(logbookMonth.celula_disponivel_ttotal || 0) < 0 ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`}></div>
            </div>
          </div>

          {/* INFORMAÇÕES ADICIONAIS */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl py-[5px] px-[13px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">Informações Técnicas Adicionais</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Base Aeródromo — campo correto: aerodromo_base */}
              <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <button onClick={() => openEditModal('aerodromo_base', logbookMonth.aerodromo_base || '')} className="absolute top-2 right-2 p-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 text-sky-400 hover:text-sky-300 transition-all duration-200" title="Editar Base Aeródromo">
                  <Edit size={18} />
                </button>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Base Aeródromo</p>
                <p className="text-lg font-black text-white">{logbookMonth.aerodromo_base || '-'}</p>
              </div>

              {/* Horimetro Início */}
              <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <button onClick={() => openEditModal('horimetro_inicio', logbookMonth.horimetro_inicio?.toString() || '0.0')} className="absolute top-2 right-2 p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 hover:text-cyan-300 transition-all duration-200" title="Editar Horimetro Início">
                  <Edit size={18} />
                </button>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Horimetro Início</p>
                <p className="text-xl font-black text-blue-400">{logbookMonth.horimetro_inicio?.toFixed(1) || '0.0'}h</p>
              </div>

              {/* Horimetro Final */}
              <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <button onClick={() => openEditModal('horimetro_final', logbookMonth.horimetro_final?.toString() || '0.0')} className="absolute top-2 right-2 p-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 hover:text-orange-300 transition-all duration-200" title="Editar Horimetro Final">
                  <Edit size={18} />
                </button>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Horimetro Final</p>
                <p className="text-xl font-black text-orange-400">{logbookMonth.horimetro_final?.toFixed(1) || '0.0'}h</p>
              </div>

              {/* Horimetro Ativo */}
              <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <button onClick={() => openEditModal('horimetro_ativo', logbookMonth.horimetro_ativo?.toString() || '0.0')} className="absolute top-2 right-2 p-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 text-pink-400 hover:text-pink-300 transition-all duration-200" title="Editar Horimetro Ativo">
                  <Edit size={18} />
                </button>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Horimetro Ativo</p>
                <p className="text-xl font-black text-pink-400">{logbookMonth.horimetro_ativo?.toFixed(1) || '0.0'}h</p>
              </div>

              {/* Valor Diária — campo correto: tem_tarifa_diaria, tarifa_diaria */}
              {logbookMonth?.tem_tarifa_diaria && (
                <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                  <button onClick={() => openEditModal('tarifa_diaria', logbookMonth.tarifa_diaria?.toString() || '0.00')} className="absolute top-2 right-2 p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-all duration-200" title="Editar Valor Diária">
                    <Edit size={18} />
                  </button>
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Valor Diária</p>
                  <p className="text-lg font-black text-green-400">R$ {logbookMonth.tarifa_diaria?.toFixed(2) || '0.00'}</p>
                </div>
              )}
            </div>
          </div>
        </div>}

        {/* BUSCA */}
        {!showAddForm && <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input placeholder="Pesquisar por ICAO de origem, destino ou piloto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 h-14 bg-slate-900/50 border border-slate-800 rounded-2xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-sky-500 focus:outline-none" />
        </div>}

        {/* FORMULÁRIO DE NOVO LANÇAMENTO */}
        {showAddForm && <div className="bg-slate-900 border-2 border-sky-500/20 rounded-[2.5rem] p-8 shadow-3xl space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

            {/* SEÇÃO 1: TRIPULAÇÃO & DATA */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sky-500 mb-2">
                <Users size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">1. Tripulação</span>
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-slate-950 border-slate-800 hover:bg-slate-900", !newEntry.entry_date && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4 text-sky-400" />
                    {newEntry.entry_date ? format(parse(newEntry.entry_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={newEntry.entry_date ? parse(newEntry.entry_date, 'yyyy-MM-dd', new Date()) : undefined}
                    onSelect={(date) => {
                      if (!date) return;
                      const dateMonth = date.getMonth() + 1;
                      const dateYear = date.getFullYear();
                      if (dateMonth !== selectedMonth || dateYear !== selectedYear) {
                        toast.error(`A data deve estar no mês: ${MONTHS[selectedMonth - 1]} de ${selectedYear}`);
                        return;
                      }
                      setNewEntry({ ...newEntry, entry_date: format(date, 'yyyy-MM-dd') });
                    }}
                    defaultMonth={new Date(selectedYear, selectedMonth - 1)}
                    locale={ptBR}
                    className="rounded-md"
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium text-white",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 border border-slate-700 rounded-md inline-flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse space-y-1",
                      head_row: "flex",
                      head_cell: "text-slate-400 rounded-md w-9 font-medium text-[0.75rem]",
                      row: "flex w-full mt-2",
                      cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                      day: "h-9 w-9 p-0 font-normal text-slate-300 hover:bg-sky-500/20 hover:text-white rounded-lg transition-colors inline-flex items-center justify-center",
                      day_selected: "bg-sky-500 text-white hover:bg-sky-400 rounded-lg font-semibold",
                      day_today: "bg-sky-500/20 text-sky-400 font-semibold",
                      day_outside: "text-slate-600 opacity-50",
                      day_disabled: "text-slate-700 opacity-50",
                      day_hidden: "invisible",
                    }}
                  />
                </PopoverContent>
              </Popover>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Comandante (PIC) *</Label>
                <Popover open={picNewOpen} onOpenChange={setPicNewOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between h-11 font-normal bg-slate-950 border-slate-800 text-white hover:bg-slate-900">
                      {newEntry.pic_canac ? (() => { const pic = crew.find(c => c.id === newEntry.pic_canac); return pic ? `${pic.nome_completo} (${pic.canac})` : 'Selecione o PIC...'; })() : 'Selecione o PIC...'}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-slate-950 border-slate-800" align="start">
                    <Command className="bg-slate-950">
                      <CommandInput placeholder="Buscar piloto por nome ou CANAC..." className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500" />
                      <CommandList>
                        <CommandEmpty>Nenhum piloto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {crew.map((pilot) => (
                            <CommandItem key={pilot.id} value={`${pilot.nome_completo} ${pilot.canac}`} onSelect={() => { setNewEntry({ ...newEntry, pic_canac: pilot.id }); setPicNewOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", newEntry.pic_canac === pilot.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col gap-0.5 flex-1">
                                <span className="font-medium text-white">{pilot.nome_completo}</span>
                                <span className="text-xs text-slate-500">CANAC: {pilot.canac}</span>
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
                value={newEntry.sic_canac ?? ''}
                sicName={newEntry.sic_name ?? ''}
                crew={crew}
                onChange={(sicCanac, sicName) => setNewEntry({ ...newEntry, sic_canac: sicCanac, sic_name: sicName })}
                label="Copiloto (SIC)"
                placeholder="Opcional - Selecione ou digite"
              />
            </div>

            {/* SEÇÃO 2: NAVEGAÇÃO & CLIENTE */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-500 mb-2">
                <Navigation size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">2. Navegação & Cliente</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Origem *</Label>
                  <Input placeholder="SBCY" value={newEntry.departure_aerodrome} onChange={e => setNewEntry({ ...newEntry, departure_aerodrome: e.target.value.toUpperCase() })} className="bg-slate-950 border-slate-800 text-white uppercase" list="aerodromes-list" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Destino *</Label>
                  <Input placeholder="SBMT" value={newEntry.arrival_aerodrome} onChange={e => setNewEntry({ ...newEntry, arrival_aerodrome: e.target.value.toUpperCase() })} className="bg-slate-950 border-slate-800 text-white uppercase" list="aerodromes-list" />
                </div>
              </div>

              <datalist id="aerodromes-list">
                {aerodromes.map(a => <option key={a.id} value={a.designativo}>{a.name}</option>)}
              </datalist>

              {newEntry.distance_nm > 0 && <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
                <div className="text-[9px] uppercase text-slate-500 font-black">Distância</div>
                <div className="text-2xl font-black text-sky-500">{newEntry.distance_nm} <span className="text-xs">NM</span></div>
              </div>}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Responsável pelos Custos</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={flightType === 'cliente' ? 'default' : 'outline'} className="flex-1 h-10 text-xs font-semibold" onClick={() => {
                      const linkedClientId = sortedClients.find(c => c.client_aircraft?.some((ca: any) => ca.aeronave_id === aircraftId))?.id || '';
                      setFlightType('cliente');
                      setNewEntry({ ...newEntry, is_equal_split: false, is_loan: false, client_id: linkedClientId, client_partner_id: null, loan_recipient_client_id: null, loan_recipient_partner_id: null });
                    }}>Cliente</Button>
                    <Button type="button" variant={flightType === 'rateio' ? 'default' : 'outline'} className="flex-1 h-10 text-xs font-semibold" onClick={() => {
                      setFlightType('rateio');
                      setNewEntry({ ...newEntry, is_equal_split: true, is_loan: false, client_id: '', client_partner_id: null, loan_recipient_client_id: null, loan_recipient_partner_id: null });
                    }}>Rateio</Button>
                    <Button type="button" variant={flightType === 'emprestimo' ? 'default' : 'outline'} className="flex-1 h-10 text-xs font-semibold bg-amber-600/20 border-amber-500/30 hover:bg-amber-600/30" onClick={() => {
                      setFlightType('emprestimo');
                      setNewEntry({ ...newEntry, is_equal_split: false, is_loan: true, flight_nature: 'PV - Privado', client_partner_id: null, loan_recipient_client_id: null, loan_recipient_partner_id: null });
                    }}>Empréstimo</Button>
                  </div>
                </div>

                {flightType === 'cliente' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Cliente / Cotista *</Label>
                      <Select value={newEntry.client_id} onValueChange={v => {
                        const selectedClient = clients.find(c => c.id === v);
                        const clientPartnersForSelect = getPartnersFromClient(selectedClient, clientPartnersByClientId);
                        setNewEntry({ ...newEntry, client_id: v, client_partner_id: null, loan_recipient_client_id: null, loan_recipient_partner_id: null });
                        if (clientPartnersForSelect.length > 0) { setPendingClientId(v); setShowPartnerModal(true); }
                      }}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-white"><SelectValue placeholder="Selecione o Cliente" /></SelectTrigger>
                        <SelectContent>
                          {sortedClients.filter(cl => cl.client_aircraft?.some(ca => ca.aeronave_id === aircraftId)).map(cl => (
                            <SelectItem key={cl.id} value={cl.id}>{cl.razao_social}<span className="text-emerald-400"> ✓</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newEntry.client_id && (() => {
                      const selectedClient = clients.find(c => c.id === newEntry.client_id);
                      const clientPartnersForList = getPartnersFromClient(selectedClient, clientPartnersByClientId);
                      if (clientPartnersForList.length > 0) {
                        return (
                          <div className="space-y-1 mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <Label className="text-[9px] uppercase text-amber-500 ml-1 block">{newEntry.client_partner_id ? 'Sócio Selecionado' : 'Selecionar Sócio'}</Label>
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-bold ${newEntry.client_partner_id ? 'text-amber-400' : 'text-slate-400'}`}>
                                {newEntry.client_partner_id ? clientPartnersForList.find(p => p.id === newEntry.client_partner_id)?.name || 'Selecionado' : 'Nenhum sócio selecionado'}
                              </p>
                              <button type="button" onClick={() => { setPendingClientId(newEntry.client_id); setShowPartnerModal(true); }} className="text-xs px-2 py-1 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/50 text-amber-400 rounded transition-all">
                                {newEntry.client_partner_id ? 'Alterar' : 'Selecionar'}
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {flightType === 'rateio' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-[9px] text-emerald-400 uppercase font-bold tracking-widest">Tipo de Voo para Rateio</p>
                    <Select value={newEntry.flight_nature} onValueChange={v => setNewEntry({ ...newEntry, flight_nature: v })}>
                      <SelectTrigger className="bg-slate-950 border border-emerald-500/30 text-emerald-400"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>{SPLIT_FLIGHT_TYPES.map(type => <SelectItem key={type.code} value={type.code}>{type.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-[8px] text-slate-400 mt-2 italic">💡 Custos serão divididos igualmente entre todos os sócios</p>
                  </div>
                )}

                {flightType === 'emprestimo' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-[9px] text-amber-400 uppercase font-bold tracking-widest mb-3">Configurar Empréstimo</p>
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-amber-400 ml-1 block">Cliente que Empresta *</Label>
                      <Select value={newEntry.client_id} onValueChange={v => setNewEntry({ ...newEntry, client_id: v, client_partner_id: null, loan_recipient_client_id: null, loan_recipient_partner_id: null })}>
                        <SelectTrigger className="bg-slate-950 border-amber-500/30 text-amber-400"><SelectValue placeholder="Selecione o Cliente" /></SelectTrigger>
                        <SelectContent>{sortedClients.filter(cl => cl.client_aircraft?.some(ca => ca.aeronave_id === aircraftId)).map(cl => <SelectItem key={cl.id} value={cl.id}>{cl.razao_social}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 mt-2">
                      <Label className="text-[9px] uppercase text-amber-500 ml-1 block">Cliente que Pega Emprestado *</Label>
                      <Select value={newEntry.loan_recipient_client_id || ''} onValueChange={(v) => {
                        const selectedBorrowerClient = clients.find(c => c.id === v);
                        const borrowerPartnersForModal = getPartnersFromClient(selectedBorrowerClient, clientPartnersByClientId);
                        setNewEntry({ ...newEntry, loan_recipient_client_id: v, loan_recipient_partner_id: null });
                        if (borrowerPartnersForModal.length > 0) { setPendingClientId(v); setShowPartnerModal(true); }
                      }}>
                        <SelectTrigger className="bg-slate-950 border-amber-500/30 text-amber-400"><SelectValue placeholder="Selecione o cliente que está usando" /></SelectTrigger>
                        <SelectContent>{clients.map((cl) => <SelectItem key={cl.id} value={cl.id}>{cl.razao_social}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SEÇÃO 3: TEMPOS OPERACIONAIS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-500 mb-2">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">3. Tempos Operacionais</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-sky-500 font-bold ml-1 block">Apresentação</Label>
                  <Input value={newEntry.crew_checkin_time} disabled className="bg-slate-800 border-transparent text-slate-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Acionamento *</Label>
                  <Input type="time" step="60" value={newEntry.ac_time} onChange={e => setNewEntry({ ...newEntry, ac_time: e.target.value })} style={{ accentColor: 'white', colorScheme: 'dark' }} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Decolagem</Label>
                  <Input type="time" step="60" value={newEntry.dep_time} onChange={e => setNewEntry({ ...newEntry, dep_time: e.target.value })} style={{ accentColor: 'white', colorScheme: 'dark' }} className="bg-slate-950 border-slate-800 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-800/50 pt-4">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Pouso</Label>
                  <Input type="time" step="60" value={newEntry.pou_time} onChange={e => setNewEntry({ ...newEntry, pou_time: e.target.value })} style={{ accentColor: 'white', colorScheme: 'dark' }} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Corte *</Label>
                  <Input type="time" step="60" value={newEntry.cor_time} onChange={e => setNewEntry({ ...newEntry, cor_time: e.target.value })} style={{ accentColor: 'white', colorScheme: 'dark' }} className="bg-slate-950 border-slate-800 text-white" />
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: TEMPOS CALCULADOS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-purple-500 mb-2">
                <TrendingUp size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">4. Tempos</span>
              </div>

              {newEntry.total_time > 0 ? <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] uppercase text-orange-500 font-bold">T. VOO</Label>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-black text-sm min-w-24 text-center">{decimalToHoursOnly(newEntry.time)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] uppercase text-emerald-500 font-bold">T. DIA</Label>
                  <Input type="time" step="60" value={decimalToTimeString(newEntry.day_time)} onChange={e => setNewEntry({ ...newEntry, day_time: timeStringToDecimal(e.target.value) })} style={{ accentColor: 'white', colorScheme: 'dark' }} className="bg-slate-950 border-slate-800 text-emerald-400 font-bold text-sm w-24 text-center" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] uppercase text-sky-500 font-bold">T. NOITE</Label>
                  <Input type="time" step="60" value={decimalToTimeString(newEntry.night_hours)} onChange={e => setNewEntry({ ...newEntry, night_hours: timeStringToDecimal(e.target.value) })} style={{ accentColor: 'white', colorScheme: 'dark' }} className="bg-slate-950 border-slate-800 text-sky-400 font-bold text-sm w-24 text-center" />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] uppercase text-white font-bold">TOTAL</Label>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-black text-sm min-w-24 text-center">{decimalToHHMM(newEntry.total_time)}</div>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] uppercase text-purple-500 font-bold">IFR</Label>
                  <Input type="time" step="60" value={decimalToTimeString(newEntry.ifr_time)} onChange={e => setNewEntry({ ...newEntry, ifr_time: timeStringToDecimal(e.target.value) })} style={{ accentColor: 'white', colorScheme: 'dark' }} className="bg-slate-950 border-slate-800 text-purple-400 font-bold text-sm w-24 text-center" />
                </div>
              </div> : <div className="bg-slate-950/50 border border-slate-800/50 rounded-xl p-4 text-center">
                <span className="text-slate-600 text-xs uppercase font-bold">Preencha acionamento e corte para ver cálculos</span>
              </div>}
            </div>

            {/* SEÇÃO 5: PERFORMANCE & CÉLULA */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-pink-500 mb-2">
                <Fuel size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">5. Performance & Célula</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Pousos</Label>
                  <Input type="number" value={newEntry.pousos} onChange={e => setNewEntry({ ...newEntry, pousos: parseInt(e.target.value) || 1 })} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Combustível Inicial (L)</Label>
                  <Input type="number" step="0.1" placeholder="0" value={newEntry.fuel_liters} onChange={e => setNewEntry({ ...newEntry, fuel_liters: parseFloat(e.target.value) || 0 })} className="bg-slate-950 border-slate-800 text-orange-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Combustível Abastecido (L)</Label>
                  <Input type="number" step="0.1" placeholder="0" value={newEntry.fuel_added} onChange={e => setNewEntry({ ...newEntry, fuel_added: parseFloat(e.target.value) || 0 })} className="bg-slate-950 border-slate-800 text-orange-300" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">POB (Pessoas)</Label>
                  <Input type="number" value={newEntry.passengers} onChange={e => setNewEntry({ ...newEntry, passengers: parseInt(e.target.value) || 0 })} className="bg-slate-950 border-slate-800 text-sky-400" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Carga (kg)</Label>
                <Input type="number" step="0.1" placeholder="0" value={newEntry.cargo_kg} onChange={e => setNewEntry({ ...newEntry, cargo_kg: parseFloat(e.target.value) || 0 })} className="bg-slate-950 border-slate-800 text-emerald-400" />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Natureza do Voo *</Label>
                <Select value={newEntry.flight_nature} onValueChange={v => setNewEntry({ ...newEntry, flight_nature: v })}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>{FLIGHT_NATURE.map(fn => <SelectItem key={fn} value={fn}>{fn}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Diárias — usa tem_tarifa_diaria e tarifa_diaria */}
              {logbookMonth?.tem_tarifa_diaria && (
                <div className="space-y-1 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <Label className="text-[9px] uppercase text-yellow-500 font-bold ml-1 block">Quantidade de Diárias</Label>
                  <div className="flex gap-2 items-end">
                    <Input type="number" min="0" value={newEntry.daily_quantity} onChange={e => setNewEntry({ ...newEntry, daily_quantity: parseInt(e.target.value) || 0 })} className="bg-slate-950 border-yellow-500/30 text-yellow-400 font-bold text-center flex-1" placeholder="0" />
                    <div className="text-sm font-bold text-yellow-400">× R$ {(logbookMonth?.tarifa_diaria || 0).toFixed(2)}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-yellow-500/20 text-right">
                    <div className="text-[9px] uppercase text-yellow-500 font-bold">Total de Diárias</div>
                    <div className="text-lg font-black text-yellow-400">R$ {((newEntry.daily_quantity || 0) * (logbookMonth?.tarifa_diaria || 0)).toFixed(2)}</div>
                  </div>
                </div>
              )}

              {editingEntryIdForm ? (
                <div className="flex gap-3">
                  <Button onClick={() => { setEditingEntryIdForm(null); setShowAddForm(false); resetNewEntry(); setFlightType('cliente'); }} className="flex-1 bg-slate-800 hover:bg-slate-700 h-14 font-black uppercase text-sm rounded-2xl flex items-center justify-center">
                    <X size={18} className="mr-2" />Cancelar
                  </Button>
                  <Button onClick={handleSaveFlightEntry} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 h-14 font-black uppercase text-sm rounded-2xl">
                    <Save size={18} className="mr-2" />Atualizar Voo
                  </Button>
                </div>
              ) : (
                <Button onClick={handleSaveFlightEntry} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 h-14 font-black uppercase text-sm rounded-2xl">
                  <Save size={18} className="mr-2" />Salvar Voo
                </Button>
              )}
            </div>

            {/* SEÇÃO 6: OBSERVAÇÕES */}
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2 text-yellow-500 mb-2">
                <AlertCircle size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">6. Observações & Manutenção</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Ocorrência(s):</Label>
                <textarea placeholder="Descreva qualquer ocorrência durante o voo..." value={newEntry.occurrences} onChange={e => setNewEntry({ ...newEntry, occurrences: e.target.value })} className="w-full h-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs resize-none focus:ring-2 focus:ring-sky-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Diárias do período */}
          {logbookMonth?.tem_tarifa_diaria && calculatePerDiemInfo.count > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="text-yellow-500" size={18} />
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">Detalhamento de Diárias</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {calculatePerDiemInfo.details.map((pd, idx) => {
                  const uniqueKey = pd.entryId ? `${pd.entryId}_${pd.date}` : `${idx}`;
                  const isMarked = markedDailies[uniqueKey] || false;
                  return (
                    <div key={idx} className={`border rounded-lg p-3 transition-all cursor-pointer ${isMarked ? 'bg-sky-500/20 border-sky-500/50' : 'bg-slate-950 border-yellow-500/30'}`} onClick={() => { const nm = { ...markedDailies }; nm[uniqueKey] = !isMarked; setMarkedDailies(nm); }}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={isMarked} onChange={() => { }} className="w-4 h-4 mt-0.5 accent-sky-500 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[9px] uppercase font-bold mb-1 ${isMarked ? 'text-sky-400' : 'text-yellow-500'}`}>{pd.date}</p>
                          <p className="text-xs text-slate-400 truncate">{pd.location}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-right">
                <p className="text-sm text-slate-400">
                  Total: <span className="text-2xl font-black text-yellow-400">
                    {calculatePerDiemInfo.count} × R$ {(logbookMonth.tarifa_diaria || 0).toFixed(2).replace('.', ',')} = R$ {(calculatePerDiemInfo.total || 0).toFixed(2).replace('.', ',')}
                  </span>
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4 flex items-start gap-3">
              <Info className="text-sky-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-sky-200"><strong>Cálculo Automático:</strong> A apresentação é calculada 30min antes do acionamento.</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
              <Info className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-emerald-200"><strong>Sistema Dual:</strong> Selecione "Rateio Igual" para dividir custos entre sócios ou escolha um cliente específico.</div>
            </div>
          </div>
        </div>}

        {/* BOTÃO NOVO LANÇAMENTO */}
        <div className="mb-6 flex items-start justify-end px-[11px] bg-transparent">
          <button onClick={() => setShowAddForm(!showAddForm)} className={`${showAddForm ? 'bg-slate-700 text-slate-400' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/90'} rounded-2xl px-6 font-black uppercase text-xs h-12 shadow-lg transition-all border border-slate-700/50`}>
            {showAddForm ? <X className="mr-2 inline" size={16} /> : <Plus className="mr-2 inline" size={16} />}
            {showAddForm ? "Cancelar" : "Novo lançamento"}
          </button>
        </div>

        {/* TABELA DE REGISTROS */}
        <div className="bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl rounded">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/50 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800">
                  {[
                    { key: 'date', label: 'Data', sortable: true },
                    { key: 'from', label: 'De' }, { key: 'to', label: 'Para' },
                    { key: 'ac', label: 'Ac' }, { key: 'dep', label: 'Dep' },
                    { key: 'pou', label: 'Pou' }, { key: 'cor', label: 'Cor' },
                    { key: 'tvoo', label: 'T.Voo' }, { key: 'dia', label: 'Dia' },
                    { key: 'noite', label: 'Noite' }, { key: 'ifr', label: 'IFR' },
                    { key: 'pousos', label: 'Pousos' }, { key: 'fuel_add', label: 'Abas+' },
                    { key: 'celula', label: 'FUEL' }, { key: 'celula', label: 'Célula' },
                    { key: 'pic', label: 'Pic' }, { key: 'canac_pic', label: 'Canac' },
                    { key: 'sic', label: 'Sic' }, { key: 'canac_sic', label: 'Canac Sic' },
                    ...(logbookMonth?.tem_tarifa_diaria ? [{ key: 'diarias', label: 'Diárias' }] : []),
                    { key: 'voo_para', label: 'Voo Para' },
                    { key: 'check', label: '✓' }, { key: 'acoes', label: 'Ações' }
                  ].map(({ key, label, sortable }) => (
                    <th
                      key={`${key}-${label}`}
                      onClick={sortable ? () => setSortDirection(d => d === 'asc' ? 'desc' : 'asc') : undefined}
                      className={`p-2 text-center relative group select-none px-[7px] ${sortable ? 'cursor-pointer hover:text-sky-400 transition-colors' : ''}`}
                      style={{ width: `${columnWidths[key]}px` }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{label}</span>
                        {sortable && <span className="text-[7px] opacity-60 group-hover:opacity-100 transition-opacity font-extrabold">{sortDirection === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                      <div onMouseDown={(e) => handleResizeMouseDown(key, e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={24} className="p-20 text-center">
                      <Plane className="mx-auto mb-4 text-slate-700" size={48} />
                      <div className="text-slate-600 uppercase font-black text-xs tracking-widest">Nenhum registro encontrado para este período</div>
                      <div className="text-slate-700 text-xs mt-2">Clique em "Novo Lançamento" para adicionar um voo</div>
                    </td>
                  </tr>
                ) : filteredEntries.map((e, idx) => {
                  const picCrew = crew.find(c => c.id === e.pic_canac);
                  const sicCrew = crew.find(c => c.id === e.sic_canac);
                  // Usa campos corretos: clientes_id, empreendimento, divisao_igual
                  const lenderClient = clients.find(c => c.id === e.clientes_id);
                  const displayClientName = lenderClient?.razao_social;
                  const borrowerClient = e.cliente_tomador_emprestimo_id ? clients.find(c => c.id === e.cliente_tomador_emprestimo_id) : null;
                  const displayBorrowerName = borrowerClient?.razao_social;
                  const borrowerPartnerName = e.empreendimento && e.parceiro_tomador_emprestimo_id
                    ? getPartnerNameById(e.parceiro_tomador_emprestimo_id, clientPartners)
                    : null;
                  const clientPartnerName = !e.empreendimento && e.socios_cliente_id
                    ? getPartnerNameById(e.socios_cliente_id, clientPartners)
                    : null;

                  return <tr key={e.id} className="hover:bg-slate-800/30 transition-colors group border-b border-slate-800/50">
                    {/* Data — campo correto: data_registro */}
                    <td className="p-2 whitespace-nowrap text-center text-xs" style={{ width: `${columnWidths.date}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-500 text-[10px]">#{e.numero_sequencial}</span>
                        <span className="text-white font-bold">{formatDateFromISO(e.data_registro)}</span>
                      </div>
                    </td>
                    {/* Aeródromos — campos corretos: aerodromo_partida, aerodromo_chegada */}
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-sky-400 font-bold text-xs">{e.aerodromo_partida}</span></td>
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-emerald-400 font-bold text-xs">{e.aerodromo_chegada}</span></td>
                    {/* Horários — campos corretos: tempo_ac, tempo_dep, tempo_pou, tempo_cor */}
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-white font-bold text-xs">{formatTimeFromTimestamp(e.tempo_ac)}</span></td>
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-slate-300 text-xs">{formatTimeFromTimestamp(e.tempo_dep)}</span></td>
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-slate-300 text-xs">{formatTimeFromTimestamp(e.tempo_pou)}</span></td>
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-white font-bold text-xs">{formatTimeFromTimestamp(e.tempo_cor)}</span></td>
                    {/* Tempos — campos corretos: tempo_voo, horas_diurnas, horas_noturnas, tempo_ifr */}
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-white font-bold text-sm">{decimalToHHMM(e.tempo_voo)}</span></td>
                    <td className="p-2 whitespace-nowrap text-center">{e.horas_diurnas > 0 ? <span className="text-emerald-400 font-bold text-sm">{decimalToHHMM(e.horas_diurnas)}</span> : <span className="text-slate-600">-</span>}</td>
                    <td className="p-2 whitespace-nowrap text-center">{e.horas_noturnas > 0 ? <span className="text-sky-400 font-bold text-sm">{decimalToHHMM(e.horas_noturnas)}</span> : <span className="text-slate-600">-</span>}</td>
                    <td className="p-2 whitespace-nowrap text-center">{e.tempo_ifr > 0 ? <span className="text-purple-400 font-bold text-sm">{decimalToHHMM(e.tempo_ifr)}</span> : <span className="text-slate-600">-</span>}</td>
                    {/* pousos_total, combustivel_adicionado, litros_combustivel */}
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-slate-300 text-xs">{e.pousos_total || '-'}</span></td>
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-slate-300 text-xs">{e.combustivel_adicionado > 0 ? e.combustivel_adicionado?.toFixed(1) : '-'}</span></td>
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-orange-400 font-bold text-sm">{Math.round(e.litros_combustivel || 0)}L</span></td>
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-purple-400 font-bold text-xs">{e.celula?.toFixed(1)}</span></td>
                    {/* Tripulação */}
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-white text-xs">{picCrew?.nome_completo.split(' ')[0] || '-'}</span></td>
                    <td className="p-2 whitespace-nowrap text-center"><span className="text-slate-400 text-xs font-bold">{picCrew?.canac || '-'}</span></td>
                    <td className="p-2 whitespace-nowrap text-center">
                      {e.sic_name ? <span className="text-amber-300 text-xs font-semibold">{e.sic_name}</span> : <span className="text-white text-xs">{sicCrew?.nome_completo.split(' ')[0] || '-'}</span>}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center">
                      {e.sic_name ? <span className="text-slate-600">-</span> : <span className="text-slate-400 text-xs font-bold">{sicCrew?.canac || '-'}</span>}
                    </td>
                    {/* Diárias — campo correto: tarifa_diaria */}
                    {logbookMonth?.tem_tarifa_diaria && (
                      <td className="p-2 whitespace-nowrap text-center">
                        {parseFloat(e.tarifa_diaria) > 0 ? (
                          <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg font-bold text-sm">
                            R${parseFloat(e.tarifa_diaria || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : <span className="text-slate-600">-</span>}
                      </td>
                    )}
                    {/* Voo Para — campos corretos: divisao_igual, empreendimento, clientes_id, socios_cliente_id */}
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.voo_para}px` }}>
                      {e.divisao_igual ? (
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold uppercase">Rateio</span>
                      ) : e.empreendimento ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-amber-400 text-xs font-bold">{shortenClientName(displayClientName || 'Desconhecido')}</span>
                          {borrowerClient && <span className="text-amber-300 text-xs font-semibold">→ {shortenClientName(borrowerPartnerName || displayBorrowerName || 'Desconhecido')}</span>}
                        </div>
                      ) : displayClientName ? (
                        <span className="text-cyan-400 text-xs font-semibold">{shortenClientName(displayClientName)}{clientPartnerName ? ` - ${shortenClientName(clientPartnerName)}` : ''}</span>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    {/* Confirmado — campo correto: confirmado */}
                    <td className="p-2 text-center">
                      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${e.confirmado ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 text-slate-600'}`}>
                        <CheckCircle size={14} />
                      </div>
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEditEntry(e)} className="p-2 hover:bg-sky-500/20 rounded-lg transition-all text-sky-400 hover:text-sky-300 hover:scale-110" title="Editar lançamento"><Edit size={16} /></button>
                        <button onClick={() => handleDeleteEntry(e.id)} className="p-2 hover:bg-rose-500/20 rounded-lg transition-all text-rose-400 hover:text-rose-300 hover:scale-110" title="Deletar lançamento"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          {/* Totalizador */}
          {filteredEntries.length > 0 && (() => {
            const clientTotals: Record<string, { hours: number; dailyRates: number; name: string }> = {};
            const partnerTotals: Record<string, { hours: number; dailyRates: number; voos: number; partnerName: string }> = {};
            let splitHours = 0;

            filteredEntries.forEach(e => {
              if (e.divisao_igual) {
                splitHours += (e.tempo_voo || 0);
              } else if (e.clientes_id) {
                const clientName = clients.find(c => c.id === e.clientes_id)?.razao_social?.split(' ')[0] || 'Cliente';

                if (e.empreendimento) {
                  if (!clientTotals[e.clientes_id]) clientTotals[e.clientes_id] = { hours: 0, dailyRates: 0, name: clientName };
                  clientTotals[e.clientes_id].hours += (e.tempo_voo || 0);
                  clientTotals[e.clientes_id].dailyRates += (parseFloat(e.tarifa_diaria) || 0);
                } else if (e.socios_cliente_id) {
                  const partnerName = getPartnerNameById(e.socios_cliente_id, clientPartners) || 'Parceiro Desconhecido';
                  if (!partnerTotals[e.socios_cliente_id]) partnerTotals[e.socios_cliente_id] = { hours: 0, dailyRates: 0, voos: 0, partnerName };
                  partnerTotals[e.socios_cliente_id].hours += (e.tempo_voo || 0);
                  partnerTotals[e.socios_cliente_id].dailyRates += (parseFloat(e.tarifa_diaria) || 0);
                  partnerTotals[e.socios_cliente_id].voos += 1;
                } else {
                  if (!clientTotals[e.clientes_id]) clientTotals[e.clientes_id] = { hours: 0, dailyRates: 0, name: clientName };
                  clientTotals[e.clientes_id].hours += (e.tempo_voo || 0);
                  clientTotals[e.clientes_id].dailyRates += (parseFloat(e.tarifa_diaria) || 0);
                }
              }
            });

            const totalDistance = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.distancia_nm) || 0), 0);
            const hasPartners = Object.keys(partnerTotals).length > 0;

            return (
              <div className="border-t border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div className="grid grid-cols-8 gap-3 text-center text-xs">
                  <div><div className="text-[8px] uppercase text-slate-500 font-black mb-1">Voos</div><div className="text-lg font-black text-white">{filteredEntries.length}</div></div>
                  {/* tempo_voo */}
                  <div><div className="text-[8px] uppercase text-slate-500 font-black mb-1">T.Voo</div><div className="text-lg font-black text-orange-400">{decimalToHHMM(filteredEntries.reduce((sum, e) => sum + (e.tempo_voo || 0), 0))}</div></div>
                  {/* horas_diurnas */}
                  <div><div className="text-[8px] uppercase text-slate-500 font-black mb-1">Dia</div><div className="text-lg font-black text-emerald-400">{decimalToHHMM(filteredEntries.reduce((sum, e) => sum + (e.horas_diurnas || 0), 0))}</div></div>
                  {/* horas_noturnas */}
                  <div><div className="text-[8px] uppercase text-slate-500 font-black mb-1">Noite</div><div className="text-lg font-black text-sky-400">{decimalToHHMM(filteredEntries.reduce((sum, e) => sum + (e.horas_noturnas || 0), 0))}</div></div>
                  {/* tempo_total */}
                  <div><div className="text-[8px] uppercase text-slate-500 font-black mb-1">T.Total</div><div className="text-lg font-black text-pink-400">{decimalToHHMM(filteredEntries.reduce((sum, e) => sum + (e.tempo_total || 0), 0))}</div></div>
                  {/* combustivel_adicionado */}
                  <div><div className="text-[8px] uppercase text-slate-500 font-black mb-1">Comb.Add</div><div className="text-lg font-black text-red-400">{filteredEntries.reduce((sum, e) => sum + (e.combustivel_adicionado || 0), 0).toFixed(1)}</div></div>
                  {/* distancia_nm */}
                  <div><div className="text-[8px] uppercase text-slate-500 font-black mb-1">Dist.</div><div className="text-lg font-black text-cyan-400">{totalDistance.toFixed(0)}NM</div></div>
                  {logbookMonth?.tem_tarifa_diaria && (
                    <div><div className="text-[8px] uppercase text-slate-500 font-black mb-1">Diárias</div><div className="text-lg font-black text-yellow-400">R${filteredEntries.reduce((sum, e) => sum + (parseFloat(e.tarifa_diaria) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
                  )}
                </div>

                {hasPartners && (
                  <div className="pt-2 border-t border-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-2">Horas por Sócio</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {Object.entries(partnerTotals).map(([key, pt], idx) => (
                        <div key={idx} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/50">
                          <div className="text-[9px] font-semibold text-slate-400 uppercase mb-1 truncate">{pt.partnerName}</div>
                          <div className="text-sm font-black text-orange-400 mb-0.5">{decimalToHHMM(pt.hours)}</div>
                          <div className="text-[8px] text-slate-500">{pt.voos} voo{pt.voos > 1 ? 's' : ''}</div>
                          {logbookMonth?.tem_tarifa_diaria && pt.dailyRates > 0 && <div className="text-[8px] text-yellow-400 font-semibold mt-1">R${pt.dailyRates.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!hasPartners && (
                  <div className="pt-2 border-t border-slate-800/50">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                      {Object.values(clientTotals).map((ct, idx) => (
                        <span key={idx}>
                          <span className="text-cyan-400 font-semibold">{ct.name.split(' ')[0]}</span>
                          {' '}{decimalToHHMM(ct.hours)}h
                          {logbookMonth?.tem_tarifa_diaria && ct.dailyRates > 0 && <span className="text-yellow-400"> • R${ct.dailyRates.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                        </span>
                      ))}
                      {splitHours > 0 && <span><span className="text-emerald-400 font-semibold">Traslado/Rateio</span>{' '}{decimalToHHMM(splitHours)}h</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* MODAL EDIÇÃO DE INFORMAÇÕES TÉCNICAS */}
        {editingField && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 text-white max-w-sm w-full rounded-3xl p-6 shadow-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight mb-6">
                Editar {
                  editingField === 'aerodromo_base' ? 'Base Aeródromo' :
                  editingField === 'horimetro_inicio' ? 'Horímetro Início' :
                  editingField === 'horimetro_final' ? 'Horímetro Final' :
                  editingField === 'horimetro_ativo' ? 'Horímetro Ativo' :
                  editingField === 'tarifa_diaria' ? 'Valor Diária' :
                  editingField === 'celula_prox_revisao_ttotal' ? 'Próxima Revisão' :
                  editingField === 'celula_anterior_ttotal' ? 'Célula Anterior' :
                  editingField
                }
              </h2>
              <div className="space-y-4">
                <div>
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block mb-2">Novo Valor *</Label>
                  <Input
                    type={['horimetro_inicio', 'horimetro_final', 'horimetro_ativo', 'tarifa_diaria', 'celula_prox_revisao_ttotal', 'celula_anterior_ttotal'].includes(editingField) ? 'number' : 'text'}
                    step={['horimetro_inicio', 'horimetro_final', 'horimetro_ativo', 'tarifa_diaria', 'celula_prox_revisao_ttotal', 'celula_anterior_ttotal'].includes(editingField) ? '0.1' : undefined}
                    value={editFieldValue}
                    onChange={(e) => setEditFieldValue(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white"
                    placeholder="Digite o novo valor"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <Button onClick={() => { setEditingField(null); setEditFieldValue(''); }} className="flex-1 bg-slate-800 hover:bg-slate-700 h-10 font-black uppercase text-xs rounded-lg">Cancelar</Button>
                  <Button onClick={handleSaveField} className="flex-1 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 h-10 font-black uppercase text-xs rounded-lg shadow-lg">
                    <Save size={14} className="mr-2" />Salvar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SELETOR DE MÊS/ANO */}
        {showMonthPicker && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 text-white max-w-sm w-full rounded-3xl p-6 shadow-2xl">
            <div className="text-center uppercase font-black tracking-widest mb-6">Selecionar Período</div>
            <div className="grid grid-cols-3 gap-2 py-6">
              {MONTHS.map((m, i) => {
                const monthNum = i + 1;
                const isAvailable = availableMonths.some(am => am.month === monthNum && am.year === selectedYear);
                if (!isAvailable) return null;
                return <button key={m} onClick={() => { setSelectedMonth(monthNum); setShowMonthPicker(false); }} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedMonth === monthNum ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500 hover:bg-slate-800'}`}>{m.substring(0, 3)}</button>;
              })}
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-6 px-4">
              <button onClick={() => setSelectedYear(y => y - 1)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><ChevronLeft /></button>
              <span className="text-2xl font-black">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><ChevronRight /></button>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleOpenCreateNextMonthDialog} disabled={loading} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 disabled:from-slate-700 disabled:to-slate-600 h-12 rounded-2xl font-bold uppercase text-xs transition-colors text-white shadow-lg">
                {loading ? 'Criando...' : 'Criar Próximo Mês'}
              </button>
              <button onClick={() => setShowMonthPicker(false)} disabled={loading} className="flex-1 bg-slate-800 hover:bg-slate-700 h-12 rounded-2xl font-bold uppercase text-xs transition-colors">Fechar</button>
            </div>
          </div>
        </div>}
      </div>
    </div>
  </Layout>;
};

export default DiarioBordoDetalhes;