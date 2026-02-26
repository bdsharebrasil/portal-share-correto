import React, { useState, useMemo, useEffect, useReducer } from 'react';
import { format } from 'date-fns';
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
import { updateCrewFlightHours } from '@/services/crewFlightHours';
import { fetchManutencaoRevisao, fetchManutencaoRevisaoAtiva, updateManutencaoHoras, ensureRevisionMaintenance } from '@/services/manutencoes';
import { MaintenanceStatusAlert } from './MaintenanceStatusAlert';
import { CreateMonthDialog } from './CreateMonthDialog';
import { CloseMonthDialog } from './CloseMonthDialog';
import { ExportLogbookDialog } from './ExportLogbookDialog';
import { PartnerSelectModal } from './PartnerSelectModal';
import { SICComboBoxManual } from './SICComboBoxManual';
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

// ===================== CONSTANTES LOCAIS =====================
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const FLIGHT_NATURE = ["AE - Aérea/Regular", "CQ - Cheque", "EX - Executivo", "NR - Não Remunerado", "RE - Retorno/Reposição", "PV - Privado", "SA - Serviço Aéreo", "TN - Transporte Não Regular/Táxi Aéreo", "TR - Traslado"];

// Tipos especiais de voo para rateio (divisão igual de custos)
const SPLIT_FLIGHT_TYPES = [
  { code: 'CQ', label: 'CQ - Cheque (Voo de Verificação)', description: 'Rateio igual entre sócios' },
  { code: 'TR', label: 'TR - Traslado (Ferry/Posicionamento)', description: 'Rateio igual entre sócios' },
  { code: 'TN', label: 'TN - Teste (Manutenção/Teste)', description: 'Rateio igual entre sócios' }
];

// ===================== FUNÇÕES AUXILIARES ESPECÍFICAS DO COMPONENTE =====================
// (Funções genéricas foram movidas para utils/)

// Obter o nome do parceiro por ID
const getPartnerNameById = (partnerId: string | null, partnerMap: Record<string, any>): string | null => {
  if (!partnerId) return null;
  return partnerMap[partnerId]?.name || null;
};


// Extrair parceiros de um cliente (agora obtém from clientPartners state)
const getPartnersFromClient = (client: any, clientPartnerMap?: Record<string, any>) => {
  // Para compatibilidade com código existente que pode chamar sem o mapa
  // Return um array vazio se não há dados de parceiros
  return [];
};

// Calcular tempos dia/noite
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
    date: 70,
    from: 60,
    to: 60,
    ac: 55,
    dep: 55,
    pou: 55,
    cor: 55,
    tvoo: 65,
    dia: 65,
    noite: 65,
    ifr: 60,
    pousos: 60,
    fuel_add: 70,
    celula: 65,
    pic: 60,
    canac_pic: 70,
    sic: 60,
    canac_sic: 70,
    diarias: 70,
    voo_para: 80,
    check: 40,
    acoes: 70
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState(0);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editingEntryIdForm, setEditingEntryIdForm] = useState<string | null>(null);
  const [editingMonthInfo, setEditingMonthInfo] = useState(false);
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
    crew_records: [{
      date: '',
      system: '',
      discrepancy: '',
      canac: ''
    }],
    service_return: [{
      date: '',
      corrective_action: '',
      responsible_canac: '',
      pic_canac: ''
    }]
  });

  const [flightType, setFlightType] = useState<'cliente' | 'rateio' | 'emprestimo'>('cliente');
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

  const calculatePerDiemInfo = useMemo(() => {
    if (!logbookMonth?.has_daily_rate || !logbookMonth?.base_aerodrome || !logbookMonth?.daily_rate) {
      return { count: 0, total: 0, details: [], byEntry: {} };
    }

    const baseAerodrome = logbookMonth.base_aerodrome;
    const dailyRate = logbookMonth.daily_rate;

    const periodEntries = entries
      .filter((e: any) => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
      })
      .sort((a: any, b: any) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

    const perDiems: Array<{ date: string; location: string; entryId: string }> = [];
    const byEntry: Record<string, number> = {};

    let isAwayFromBase = false;
    let lastAwayDate: Date | null = null;

    for (const flight of periodEntries) {
      const flightDate = new Date(flight.entry_date);
      const origin = flight.departure_aerodrome;
      const destination = flight.arrival_aerodrome;

      if (flight.is_equal_split) {
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [acRes, crewMembersRes, crewTableRes, aeroRes, clientRes, entriesRes, monthsRes, partnersRes, clientPartnersRes] = await Promise.all([
          supabase.from('aircraft').select('*').eq('id', aircraftId).single(),
          supabase.from('crew_members').select('*').eq('status', 'ativo').order('full_name', { ascending: true }),
          supabase.from('crew').select('id, full_name, canac, status').eq('status', 'ativo').order('full_name', { ascending: true }),
          supabase.from('aerodromes').select('*').order('designativo'),
          supabase.from('clients').select('id, company_name, cnpj').order('company_name'),
          supabase.from('logbook_entries').select('*').eq('aircraft_id', aircraftId).order('sequential_number', { ascending: true }),
          supabase.from('logbook_months').select('month, year').eq('aircraft_id', aircraftId).eq('is_closed', false).order('year', { ascending: false }).order('month', { ascending: false }),
          supabase.from('aircraft_partners').select('*, clients(id, company_name)').eq('aircraft_id', aircraftId),
          supabase.from('client_partners').select('id, name')
        ]);

        if (acRes.data) {
          setAircraft(acRes.data);
          setLastCelula(acRes.data.cell_hours_current || 0);
        }
        // Merge crew_members + crew table (dedup by id)
        const crewMembersData = crewMembersRes.data || [];
        const crewTableData = (crewTableRes.data || []).map((p: any) => ({
          id: p.id,
          full_name: p.full_name,
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

        // Criar mapa de client_partners para busca rápida por ID
        if (clientPartnersRes.data) {
          const partnerMap: Record<string, any> = {};
          clientPartnersRes.data.forEach((p: any) => {
            partnerMap[p.id] = p;
          });
          setClientPartners(partnerMap);
          logSuccess('Client Partners carregados', { count: clientPartnersRes.data.length });
        }

        const loansRes = await supabase
          .from('aircraft_loans')
          .select('*')
          .eq('lender_aircraft_id', aircraftId)
          .order('entry_date', { ascending: false });

        if (loansRes.data) setLoans(loansRes.data || []);

        let { data: monthData } = await supabase
          .from('logbook_months')
          .select('*')
          .eq('aircraft_id', aircraftId)
          .eq('month', selectedMonth)
          .eq('year', selectedYear)
          .single();

        if (monthData) {
          setLogbookMonth(monthData);
          setLastCelula(monthData.celula_anterior || 0);
        } else {
          const { data: lastMonthData } = await supabase
            .from('logbook_months')
            .select('*')
            .eq('aircraft_id', aircraftId)
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(1)
            .single();

          let celulaAnterior = acRes.data?.cell_hours_current || 0;
          if (lastMonthData && lastMonthData.celula_atual) {
            celulaAnterior = lastMonthData.celula_atual;
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
        setSelectedMonth(firstAvailable.month);
        setSelectedYear(firstAvailable.year);
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
      const checkinTime = minutesToTimeString(finalMin);
      setNewEntry(prev => ({ ...prev, crew_checkin_time: checkinTime }));
    }
  }, [newEntry.ac_time]);

  useEffect(() => {
    if (showAddForm && entries.length > 0) {
      const lastEntry = entries[0];
      if (lastEntry.arrival_aerodrome && !newEntry.departure_aerodrome) {
        setNewEntry(prev => ({ ...prev, departure_aerodrome: lastEntry.arrival_aerodrome }));
      }
    }
  }, [showAddForm, entries, newEntry.departure_aerodrome]);

  useEffect(() => {
    const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const isoDate = format(firstDayOfMonth, 'yyyy-MM-dd');
    setNewEntry(prev => ({ ...prev, entry_date: isoDate }));
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (entries.length > 0 && logbookMonth) {
      updateCelulaAtual(entries);
    }
  }, [entries, logbookMonth?.id]);

  useEffect(() => {
    if (newEntry.departure_aerodrome && newEntry.arrival_aerodrome) {
      const dep = aerodromes.find((a: any) => a.designativo === newEntry.departure_aerodrome);
      const arr = aerodromes.find((a: any) => a.designativo === newEntry.arrival_aerodrome);
      if (dep?.coordenadas && arr?.coordenadas) {
        try {
          const [lat1, lon1] = dep.coordenadas.split(',').map(Number);
          const [lat2, lon2] = arr.coordenadas.split(',').map(Number);
          const distance = calculateDistance(lat1, lon1, lat2, lon2);
          setNewEntry(prev => ({ ...prev, distance_nm: Math.round(distance) }));
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
          const celulasExistentes = entries.map((e: any) => Number(e.celula) || 0);
          const ultimaCelulaRegistrada = Math.max(...celulasExistentes);

          if (ultimaCelulaRegistrada > baseParaCalculo) {
            baseParaCalculo = ultimaCelulaRegistrada;
          }
        }

        const newCelula = parseFloat((baseParaCalculo + totalTime).toFixed(1));

        const calculated = calculateTimes({
          ...newEntry,
          total_time: totalTime,
          time: flightTime,
          dep_time: newEntry.dep_time,
          pou_time: newEntry.pou_time
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

  const filteredEntries = useMemo(() => {
    let filtered = entries.filter((e: any) => {
      const date = new Date(e.entry_date);
      const matchesPeriod = date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        e.departure_aerodrome?.toLowerCase().includes(searchLower) ||
        e.arrival_aerodrome?.toLowerCase().includes(searchLower) ||
        crew.find((c: any) => c.id === e.pic_canac)?.full_name.toLowerCase().includes(searchLower);
      return matchesPeriod && matchesSearch;
    });

    // Ordenar por sequential_number (ordem correta do diário)
    filtered.sort((a: any, b: any) => {
      const seqA = a.sequential_number || 0;
      const seqB = b.sequential_number || 0;
      return sortDirection === 'asc' ? seqA - seqB : seqB - seqA;
    });

    return filtered;
  }, [entries, selectedMonth, selectedYear, searchTerm, crew, sortDirection]);

  const sortedClients = useMemo(() => {
    if (!clients.length) return [];
    const linkedClients = clients.filter((c: any) => c.client_aircraft?.some((ca: any) => ca.aircraft_id === aircraftId));
    const otherClients = clients.filter((c: any) => !c.client_aircraft?.some((ca: any) => ca.aircraft_id === aircraftId));
    return [...linkedClients, ...otherClients];
  }, [clients, aircraftId]);

  const isMonthAvailable = (month: number, year: number): boolean => {
    return availableMonths.some(m => m.month === month && m.year === year);
  };

  const updateCelulaAtual = async (entriesData?: any[]) => {
    if (!logbookMonth) return;

    try {
      const entriesToUse = entriesData || entries;

      const periodEntries = entriesToUse.filter((e: any) => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth &&
          date.getUTCFullYear() === selectedYear;
      });

      const totalFlightTimeThisMonth = periodEntries.reduce((sum: number, e: any) => {
        const flightTime = Number(e.total_time) || 0;
        return sum + flightTime;
      }, 0);

      const newCelulaAtual = parseFloat(((logbookMonth.celula_anterior ?? 0) + totalFlightTimeThisMonth).toFixed(2));
      const newCelulaDisponivel = parseFloat(((logbookMonth.celula_prox_revisao ?? 0) - newCelulaAtual).toFixed(2));

      const { error } = await supabase
        .from('logbook_months')
        .update({
          celula_atual: newCelulaAtual,
          celula_disponivel: newCelulaDisponivel
        })
        .eq('id', logbookMonth.id);

      if (error) {
        logError('Erro ao atualizar célula_atual:', error);
      } else {
        setLogbookMonth({
          ...logbookMonth,
          celula_atual: newCelulaAtual,
          celula_disponivel: newCelulaDisponivel
        });
        logInfo(`✅ Célula_Atual atualizada: ${Number(newCelulaAtual).toFixed(2)} | Disponível: ${newCelulaDisponivel.toFixed(2)}`);

        await updateMaintenanceHours(newCelulaAtual);
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
        const horasRealizadas = celulaAtual - (logbookMonth?.celula_anterior ?? 0);
        const horasFinais = Math.max(0, horasRealizadas);

        await updateManutencaoHoras(manutencao.id, horasFinais);

        logInfo(`✅ Manutenção de revisão atualizada: ${horasFinais.toFixed(2)}h realizadas (limite: ${manutencao.vencimento_horas}h)`);
      }
    } catch (error) {
      logError('Erro ao atualizar horas de manutenção:', error);
    }
  };

  const goToPreviousMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    if (isMonthAvailable(newMonth, newYear)) {
      setSelectedMonth(newMonth);
      setSelectedYear(newYear);
    }
  };

  const goToNextMonth = () => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    if (isMonthAvailable(newMonth, newYear)) {
      setSelectedMonth(newMonth);
      setSelectedYear(newYear);
    }
  };

  const saveLogbookMonthField = async (field: string, value: any) => {
    if (!logbookMonth) return;

    try {
      const { error } = await supabase
        .from('logbook_months')
        .update({ [field]: value })
        .eq('id', logbookMonth.id);

      if (error) throw error;

      setLogbookMonth({
        ...logbookMonth,
        [field]: value
      });

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

    if ((editingField === 'celula_anterior' || editingField === 'celula_prox_revisao') && !canEditCelulaFields) {
      toast.error('Apenas admin, gestor master, piloto chefe e podem editar célula anterior e próxima revisão');
      setEditingField(null);
      return;
    }

    const fieldsToConvertToNumber = ['horimetro_inicio', 'horimetro_final', 'horimetro_ativo', 'daily_rate', 'celula_prox_revisao', 'celula_anterior'];
    const valueToSave = fieldsToConvertToNumber.includes(editingField)
      ? parseFloat(editFieldValue)
      : editFieldValue;

    await saveLogbookMonthField(editingField, valueToSave);
    setEditFieldValue('');
  };

  const [nextMonthTarget, setNextMonthTarget] = useState<{ month: number; year: number } | null>(null);

  const handleOpenCreateNextMonthDialog = async () => {
    try {
      let nextMonth = selectedMonth + 1;
      let nextYear = selectedYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }

      const { data: existingMonth } = await supabase
        .from('logbook_months')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .eq('month', nextMonth)
        .eq('year', nextYear)
        .single();

      if (existingMonth) {
        toast.error("Este mês já existe");
        return;
      }

      setNextMonthTarget({ month: nextMonth, year: nextYear });

      if (logbookMonth) {
        setPreviousMonthData({
          celula_atual: logbookMonth.celula_atual ?? 0,
          celula_prox_revisao: logbookMonth.celula_prox_revisao ?? 0,
          horimetro_final: logbookMonth.horimetro_final ?? null,
          base_aerodrome: logbookMonth.base_aerodrome ?? null,
          fuel_consumption: logbookMonth.fuel_consumption ?? null,
          has_daily_rate: logbookMonth.has_daily_rate ?? false,
          daily_rate: logbookMonth.daily_rate ?? null,
        });
      } else {
        setPreviousMonthData({
          celula_atual: aircraft?.cell_hours_current || 0,
          celula_prox_revisao: aircraft?.celula_prox_revisao || 0,
          horimetro_final: null,
          base_aerodrome: aircraft?.base || null,
          fuel_consumption: aircraft?.fuel_consumption?.toString() || null,
          has_daily_rate: false,
          daily_rate: null,
        });
      }

      setShowMonthPicker(false);
      setShowCreateMonthDialog(true);
    } catch (error: any) {
      logError("Erro ao preparar criação do próximo mês:", error);
      toast.error(error.message || "Erro ao preparar criação do próximo mês");
    }
  };

  const handleFormSuccess = async () => {
    const { data } = await supabase
      .from('logbook_entries')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .order('logbook_month_id', { ascending: false })
      .order('sequential_number', { ascending: true });
    setEntries(data || []);
  };

  /**
   * Função unificada para salvar voo (novo ou edição)
   * Consolidação de handleSaveFlightEntry + handleSaveEditedEntryForm
   */
  const handleSaveFlightEntry = async () => {
    const isEdit = !!editingEntryIdForm;

    logInfo(`${isEdit ? '✏️ Editando' : '✅ Criando'} voo`, {
      entryId: editingEntryIdForm || 'novo',
      flightType,
      is_loan: newEntry.is_loan,
      is_equal_split: newEntry.is_equal_split
    });

    // ==================== VALIDAÇÃO ====================
    if (!newEntry.pic_canac || !newEntry.departure_aerodrome || !newEntry.arrival_aerodrome) {
      toast.error('Preencha todos os campos obrigatórios: PIC, Origem e Destino');
      return;
    }

    if (flightType === 'cliente' && !newEntry.client_id) {
      toast.error('Selecione um cliente para este voo');
      return;
    }

    if (flightType === 'emprestimo') {
      if (!newEntry.client_id) {
        toast.error('Selecione o cotista que está emprestando a aeronave');
        return;
      }
      if (!newEntry.loan_recipient_client_id) {
        toast.error('Selecione o cliente que está pegando emprestado');
        return;
      }
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
      // ==================== PREPARAR DADOS ====================
      const periodEntriesForCalc = entries.filter((e: any) => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth &&
          date.getUTCFullYear() === selectedYear;
      });

      // Preparar lista de entradas para cálculo de diárias
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
          departure_aerodrome: newEntry.departure_aerodrome,
          arrival_aerodrome: newEntry.arrival_aerodrome,
          entry_date: newEntry.entry_date
        };
        allEntriesForCalc = [...periodEntriesForCalc, tempEntry];
      }

      // ==================== CALCULAR DIÁRIAS ====================
      let dailyAllowance = 0;

      if (newEntry.daily_quantity > 0) {
        dailyAllowance = newEntry.daily_quantity * (logbookMonth.daily_rate || 0);
        logInfo('Diárias (Manual):', {
          quantidade: newEntry.daily_quantity,
          taxa_diaria: logbookMonth.daily_rate,
          total: dailyAllowance
        });
      } else {
        dailyAllowance = calculateDailyAllowanceForEntry(
          newEntry,
          logbookMonth.base_aerodrome || '',
          allEntriesForCalc
        );
        logInfo('Diárias (Automático):', {
          base: logbookMonth.base_aerodrome,
          origem: newEntry.departure_aerodrome,
          destino: newEntry.arrival_aerodrome,
          diarias_calculadas: dailyAllowance
        });
      }

      // ==================== PREPARAR PAYLOAD ====================
      const entryPayload = {
        logbook_month_id: logbookMonth.id,
        aircraft_id: aircraftId,
        entry_date: newEntry.entry_date,
        departure_aerodrome: newEntry.departure_aerodrome,
        arrival_aerodrome: newEntry.arrival_aerodrome,
        crew_checkin_time: newEntry.crew_checkin_time,
        ac_time: newEntry.ac_time,
        dep_time: newEntry.dep_time,
        pou_time: newEntry.pou_time,
        cor_time: newEntry.cor_time,
        pic_canac: newEntry.pic_canac,
        sic_canac: newEntry.sic_canac || null,
        sic_name: newEntry.sic_name || null,
        client_id: newEntry.is_equal_split ? null : newEntry.client_id,
        client_partner_id: newEntry.is_equal_split
          ? null
          : (newEntry.is_loan ? null : newEntry.client_partner_id || null),
        loan_recipient_client_id: newEntry.is_loan ? newEntry.loan_recipient_client_id || null : null,
        loan_recipient_partner_id: newEntry.is_loan ? newEntry.loan_recipient_partner_id || null : null,
        is_equal_split: newEntry.is_equal_split,
        is_loan: newEntry.is_loan || false,
        total_time: newEntry.total_time,
        time: newEntry.time,
        day_time: newEntry.day_time,
        night_hours: newEntry.night_hours,
        ifr_time: newEntry.ifr_time,
        pousos: newEntry.pousos,
        fuel_added: newEntry.fuel_added,
        fuel_liters: newEntry.fuel_liters,
        fuel_type: newEntry.fuel_type || null,
        fuel_location: newEntry.fuel_location || null,
        fuel_price_per_liter: newEntry.fuel_price_per_liter || null,
        refueled: newEntry.refueled,
        celula: newEntry.celula,
        distance_nm: newEntry.distance_nm,
        passengers: newEntry.passengers,
        cargo_kg: newEntry.cargo_kg,
        flight_nature: newEntry.flight_nature,
        occurrences: newEntry.occurrences || null,
        discrepancies: newEntry.discrepancies || null,
        corrective_actions: newEntry.corrective_actions || null,
        confirmed: isEdit ? (oldEntry?.confirmed || false) : false,
        daily_rate: dailyAllowance,
        trecho: `${newEntry.departure_aerodrome || ''} → ${newEntry.arrival_aerodrome || ''}`
      };

      // ==================== SALVAR NO BANCO ====================
      let savedEntry: any;
      let insertedEntryId: string;

      if (isEdit) {
        // UPDATE
        const { error } = await supabase
          .from('logbook_entries')
          .update(entryPayload)
          .eq('id', editingEntryIdForm);

        if (error) throw error;
        insertedEntryId = editingEntryIdForm;
        savedEntry = { ...entryPayload, id: editingEntryIdForm };
        logSuccess('Voo atualizado no banco');
      } else {
        // INSERT
        const { error } = await supabase
          .from('logbook_entries')
          .insert([entryPayload]);

        if (error) throw error;

        const { data: insertedData } = await supabase
          .from('logbook_entries')
          .select('id')
          .eq('aircraft_id', aircraftId)
          .eq('entry_date', newEntry.entry_date)
          .eq('departure_aerodrome', newEntry.departure_aerodrome)
          .eq('arrival_aerodrome', newEntry.arrival_aerodrome)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!insertedData?.id) throw new Error('Falha ao recuperar ID do voo inserido');
        insertedEntryId = insertedData.id;
        savedEntry = { ...entryPayload, id: insertedEntryId };
        logSuccess('Voo criado no banco');
      }

      // ==================== SINCRONIZAR EMPRÉSTIMOS ====================
      if (isEdit && oldEntry) {
        const wasLoan = oldEntry?.is_loan === true;
        const isLoanNow = newEntry.is_loan === true;

        logInfo('Sincronizando empréstimos:', { wasLoan, isLoanNow, entryId: editingEntryIdForm });

        if (wasLoan && !isLoanNow) {
          // Era empréstimo, não é mais → DELETE
          await supabase.from('aircraft_loans').delete().eq('logbook_entry_id', editingEntryIdForm);
          logSuccess('Empréstimo deletado');
        } else if (!wasLoan && isLoanNow) {
          // Não era empréstimo, agora é → INSERT
          const picName = newEntry.pic_canac ? (crew.find((t: any) => t.canac === newEntry.pic_canac)?.full_name || null) : null;

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
            notes: `Empréstimo ${isEdit ? 'editado' : 'criado'} via diário de bordo`,
          };

          const { error: loanError } = await supabase.from('aircraft_loans').insert([loanData]);
          if (loanError) throw loanError;

          const transData = {
            aircraft_id: aircraftId,
            from_partner_id: newEntry.loan_recipient_client_id,
            to_partner_id: newEntry.client_id,
            hours: newEntry.total_time,
            type: 'loan',
            description: `Empréstimo: ${newEntry.departure_aerodrome} → ${newEntry.arrival_aerodrome}`,
            logbook_entry_id: insertedEntryId,
          };

          const { error: transError } = await supabase.from('hour_transactions').insert([transData]);
          if (transError && transError.code !== '403') {
            throw transError;
          }
          logSuccess('Empréstimo registrado');
        } else if (wasLoan && isLoanNow) {
          // Continue sendo empréstimo → UPDATE
          const picName = newEntry.pic_canac ? (crew.find((t: any) => t.canac === newEntry.pic_canac)?.full_name || null) : null;

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

          // Atualizar transação se horas mudaram
          if ((oldEntry?.total_time || 0) !== newEntry.total_time) {
            await supabase.from('hour_transactions').delete().eq('logbook_entry_id', editingEntryIdForm).eq('type', 'loan');

            const transData = {
              aircraft_id: aircraftId,
              from_partner_id: newEntry.loan_recipient_client_id,
              to_partner_id: newEntry.client_id,
              hours: newEntry.total_time,
              type: 'loan',
              description: `Empréstimo: ${newEntry.departure_aerodrome} → ${newEntry.arrival_aerodrome}`,
              logbook_entry_id: editingEntryIdForm,
            };

            const { error: transError } = await supabase.from('hour_transactions').insert([transData]);
            if (transError && transError.code !== '403') {
              logger.warning('Erro ao atualizar transação, mas empréstimo foi atualizado');
            }
          }
          logSuccess('Empréstimo atualizado');
        }
      } else if (!isEdit && newEntry.is_loan) {
        // Novo voo é empréstimo → INSERT aircraft_loans
        const picName = newEntry.pic_canac ? (crew.find((t: any) => t.canac === newEntry.pic_canac)?.full_name || null) : null;

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

        const transData = {
          aircraft_id: aircraftId,
          from_partner_id: newEntry.loan_recipient_client_id,
          to_partner_id: newEntry.client_id,
          hours: newEntry.total_time,
          type: 'loan',
          description: `Empréstimo: ${newEntry.departure_aerodrome} → ${newEntry.arrival_aerodrome}`,
          logbook_entry_id: insertedEntryId,
        };

        const { error: transError } = await supabase.from('hour_transactions').insert([transData]);
        if (transError && transError.code !== '403') {
          throw transError;
        }
        logSuccess('Empréstimo registrado');
      }

      // ==================== ATUALIZAR HORAS DE TRIPULAÇÃO ====================
      if (isEdit && oldEntry) {
        const oldDate = new Date(oldEntry.entry_date);
        const newDate = new Date(newEntry.entry_date);

        const crewChanged = oldEntry.pic_canac !== newEntry.pic_canac ||
          oldEntry.sic_canac !== newEntry.sic_canac;
        const dateChanged = oldDate.getMonth() !== newDate.getMonth() ||
          oldDate.getFullYear() !== newDate.getFullYear();
        const hoursChanged = oldEntry.total_time !== newEntry.total_time ||
          oldEntry.ifr_time !== newEntry.ifr_time ||
          oldEntry.night_hours !== newEntry.night_hours;

        if (crewChanged || dateChanged || hoursChanged) {
          // Remover horas do voo anterior
          await updateCrewFlightHours({
            picId: oldEntry.pic_canac,
            sicId: oldEntry.sic_canac || null,
            aircraftId,
            month: oldDate.getMonth() + 1,
            year: oldDate.getFullYear(),
            totalTime: oldEntry.total_time,
            ifrTime: oldEntry.ifr_time || 0,
            nightHours: oldEntry.night_hours || 0,
            flightDay: oldEntry.entry_date,
            operation: 'remove'
          });

          // Adicionar horas do novo voo
          await updateCrewFlightHours({
            picId: newEntry.pic_canac,
            sicId: newEntry.sic_canac || null,
            aircraftId,
            month: newDate.getMonth() + 1,
            year: newDate.getFullYear(),
            totalTime: newEntry.total_time,
            ifrTime: newEntry.ifr_time || 0,
            nightHours: newEntry.night_hours || 0,
            flightDay: newEntry.entry_date,
            operation: 'add'
          });
          logSuccess('Horas de tripulação atualizadas');
        }
      } else {
        // Novo voo - apenas adicionar horas
        const entryDate = new Date(newEntry.entry_date);
        await updateCrewFlightHours({
          picId: newEntry.pic_canac,
          sicId: newEntry.sic_canac || null,
          aircraftId,
          month: entryDate.getMonth() + 1,
          year: entryDate.getFullYear(),
          totalTime: newEntry.total_time,
          ifrTime: newEntry.ifr_time || 0,
          nightHours: newEntry.night_hours || 0,
          flightDay: newEntry.entry_date,
          operation: 'add'
        });
        logSuccess('Horas de tripulação adicionadas');
      }

      // ==================== ATUALIZAR CÉLULA ====================
      if (!isEdit) {
        setLastCelula(newEntry.celula);
      }

      // ==================== FEEDBACK E RESET ====================
      toast.success(
        isEdit
          ? `Voo atualizado!`
          : `Voo registrado! ${dailyAllowance > 0 ? `${dailyAllowance} diária(s)` : 'Sem diárias'}`
      );

      // Recarregar entradas
      const { data: updatedEntries } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('logbook_month_id', { ascending: false })
        .order('sequential_number', { ascending: true });

      if (updatedEntries) {
        setEntries(updatedEntries);
        await updateCelulaAtual(updatedEntries);
      }

      // Resetar formulário
      setNewEntry({
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

      setFlightType('cliente');
      setEditingEntryIdForm(null);
      setShowAddForm(false);

    } catch (error: any) {
      logError(`Erro ao ${isEdit ? 'atualizar' : 'criar'} voo:`, error);
      toast.error(`Erro ao ${isEdit ? 'atualizar' : 'criar'} voo: ${error.message || 'Erro desconhecido'}`);
    }
  };



  const handleEditEntry = (entry: any) => {
    // Carregar dados da entrada no formulário de novo lançamento
    // Para empréstimos: partner_name contém o nome de quem pegou emprestado
    setNewEntry({
      entry_date: entry.entry_date,
      pic_canac: entry.pic_canac || '',
      sic_canac: entry.sic_canac || '',
      sic_name: entry.sic_name || '',
      crew_checkin_time: entry.crew_checkin_time || '',
      departure_aerodrome: entry.departure_aerodrome || '',
      arrival_aerodrome: entry.arrival_aerodrome || '',
      client_id: entry.client_id || '',
      borrower_client_id: '', // Será preenchido ao buscar o cliente que pega emprestado
      partner_name: entry.partner_name || '',
      borrower_partner_name: entry.is_loan ? entry.partner_name : '',
      is_equal_split: entry.is_equal_split || false,
      is_loan: entry.is_loan || false,
      ac_time: entry.ac_time || '',
      dep_time: entry.dep_time || '',
      pou_time: entry.pou_time || '',
      cor_time: entry.cor_time || '',
      total_time: entry.total_time || 0,
      day_time: entry.day_time || 0,
      night_hours: entry.night_hours || 0,
      time: entry.time || 0,
      ifr_time: entry.ifr_time || 0,
      pousos: entry.pousos || 1,
      fuel_added: entry.fuel_added || 0,
      fuel_liters: entry.fuel_liters || 0,
      fuel_type: entry.fuel_type || '',
      fuel_location: entry.fuel_location || '',
      fuel_price_per_liter: entry.fuel_price_per_liter || 0,
      refueled: entry.refueled || false,
      celula: entry.celula || 0,
      distance_nm: entry.distance_nm || 0,
      passengers: entry.passengers || 0,
      cargo_kg: entry.cargo_kg || 0,
      flight_nature: entry.flight_nature || 'PV - Privado',
      occurrences: entry.occurrences || '',
      discrepancies: entry.discrepancies || '',
      corrective_actions: entry.corrective_actions || '',
      daily_quantity: entry.daily_quantity || 0
    });

    // Se for empréstimo, buscar o ID do cliente que pegou emprestado
    if (entry.is_loan && entry.partner_name) {
      // Buscar cliente pelo partner_name (company_name)
      const borrower = clients.find((c: any) => c.company_name === entry.partner_name);
      if (borrower) {
        setNewEntry(prev => ({
          ...prev,
          borrower_client_id: borrower.id
        }));
      }
    }

    // Definir tipo de voo
    if (entry.is_equal_split) {
      setFlightType('rateio');
    } else if (entry.is_loan) {
      setFlightType('emprestimo');
    } else {
      setFlightType('cliente');
    }

    // Abrir formulário em modo edição
    setEditingEntryIdForm(entry.id);
    setShowAddForm(true);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditingEntry(null);
    setEditingEntryIdForm(null);
    setShowAddForm(false);
  };

  const handleDeleteEntry = async (id: string) => {
    const canDeleteEntry = isAdmin || isGestorMaster || isPilotoChefe || isCoordenadorVoo || isTripulante;

    if (!canDeleteEntry) {
      toast.error('Você não tem permissão para deletar lançamentos do diário de bordo');
      return;
    }

    if (!window.confirm('Tem certeza que deseja deletar este lançamento?')) {
      return;
    }

    try {
      const { data: entryToDelete } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('id', id)
        .single();

      if (!entryToDelete) {
        throw new Error('Entrada não encontrada');
      }

      if (entryToDelete.is_loan) {
        const { error: loansError } = await supabase
          .from('aircraft_loans')
          .delete()
          .eq('logbook_entry_id', id);

        if (loansError) {
          logError('Erro ao deletar aircraft_loans:', loansError);
        }

        const { error: transError } = await supabase
          .from('hour_transactions')
          .delete()
          .eq('logbook_entry_id', id);

        if (transError) {
          logError('Erro ao deletar hour_transactions:', transError);
        }
      }

      const { error } = await supabase.from('logbook_entries').delete().eq('id', id);
      if (error) throw error;

      const entryDate = new Date(entryToDelete.entry_date);
      await updateCrewFlightHours({
        picId: entryToDelete.pic_canac,
        sicId: entryToDelete.sic_canac || null,
        aircraftId,
        month: entryDate.getMonth() + 1,
        year: entryDate.getFullYear(),
        totalTime: entryToDelete.total_time,
        ifrTime: entryToDelete.ifr_time || 0,
        nightHours: entryToDelete.night_hours || 0,
        flightDay: entryToDelete.entry_date,
        operation: 'remove'
      });

      toast.success("Lançamento deletado com sucesso!");

      const { data } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('logbook_month_id', { ascending: false })
        .order('sequential_number', { ascending: true });
      if (data) {
        setEntries(data);
        await updateCelulaAtual(data);
      }
    } catch (error: any) {
      logError("Erro ao deletar lançamento:", error);
      toast.error("Erro ao deletar lançamento: " + (error.message || 'Erro desconhecido'));
    }
  };

  const handleResizeMouseDown = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(columnKey);
    setResizeStart(e.clientX);
  };

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStart;
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: Math.max(40, (prev[resizingColumn] || 50) + delta)
      }));
      setResizeStart(e.clientX);
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStart]);

  const handleOpenCreateMonthDialog = async () => {
    try {
      const { data: lastMonthData } = await supabase
        .from('logbook_months')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .single();

      if (lastMonthData) {
        setPreviousMonthData(lastMonthData);
      } else {
        setPreviousMonthData({
          celula_atual: aircraft?.cell_hours_current || 0,
          celula_prox_revisao: aircraft?.celula_prox_revisao || 0,
          horimetro_final: null,
          base_aerodrome: aircraft?.base || null,
          fuel_consumption: aircraft?.fuel_consumption?.toString() || null,
          has_daily_rate: false,
          daily_rate: null,
        });
      }

      setShowCreateMonthDialog(true);
    } catch (error) {
      logError("Erro ao buscar dados do mês anterior:", error);
      setPreviousMonthData({
        celula_atual: aircraft?.cell_hours_current || 0,
        celula_prox_revisao: 0,
      });
      setShowCreateMonthDialog(true);
    }
  };

  const handleCreateMonthWithData = async (monthData: any) => {
    try {
      setCreatingMonth(true);

      const targetMonth = monthData.month || selectedMonth;
      const targetYear = monthData.year || selectedYear;

      const { data: existingMonth, error: checkError } = await supabase
        .from('logbook_months')
        .select('id, month, year')
        .eq('aircraft_id', aircraftId)
        .eq('month', targetMonth)
        .eq('year', targetYear)
        .maybeSingle();

      if (checkError) {
        logError('Erro ao verificar diários existentes:', checkError);
      }

      if (existingMonth) {
        toast.error(`Já existe um diário de bordo para ${MONTHS[targetMonth - 1]} de ${targetYear}. Selecione outro mês ou ano.`);
        setCreatingMonth(false);
        return;
      }

      const { data: newMonth, error } = await supabase
        .from('logbook_months')
        .insert([monthData])
        .select()
        .single();

      if (error) throw error;

      if (newMonth) {
        setSelectedMonth(targetMonth);
        setSelectedYear(targetYear);
        setLogbookMonth(newMonth);

        if (monthData.celula_prox_revisao && monthData.celula_prox_revisao > 0) {
          try {
            await ensureRevisionMaintenance(
              aircraftId,
              targetMonth,
              targetYear,
              monthData.celula_prox_revisao,
              MONTHS
            );
            logInfo("✅ Manutenção de revisão criada/atualizada automaticamente");
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

  if (!aircraft) return <Layout>
    <div className="h-screen flex items-center justify-center bg-[#070910] text-white">
      <div className="text-center">
        <Plane size={48} className="mx-auto mb-4 text-slate-500" />
        <p>Aeronave não encontrada</p>
      </div>
    </div>
  </Layout>;
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
              <h1 className="text-3xl font-black text-white tracking-tighter">{aircraft?.registration}</h1>
              <p className="text-[10px] font-bold text-sky-500 uppercase tracking-[0.2em] py-[7px]">{aircraft?.model}</p>

            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Navegação de Mês */}
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
              <button
                onClick={() => setShowExportDialog(true)}
                className="px-6 h-12 bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 rounded-2xl text-sky-400 font-black uppercase text-xs transition-all"
              >
                <Download className="inline mr-2" size={16} />
                Exportar PDF
              </button>
            )}

            {logbookMonth && (
              <button
                onClick={() => setShowCloseMonthDialog(true)}
                className="px-6 h-12 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-2xl text-red-400 font-black uppercase text-xs transition-all"
              >
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
            <button
              onClick={handleOpenCreateMonthDialog}
              disabled={creatingMonth}
              className="px-8 py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 text-white font-black uppercase text-sm rounded-xl transition-all shadow-lg"
            >
              {creatingMonth ? (
                <>
                  <Loader2 className="inline mr-2 animate-spin" size={16} />
                  Criando...
                </>
              ) : (
                <>
                  <Plus className="inline mr-2" size={16} />
                  Configurar Diário de {MONTHS[selectedMonth - 1]}
                </>
              )}
            </button>
          </div>
        )}

        {/* Dialog para criar mês */}
        <CreateMonthDialog
          open={showCreateMonthDialog}
          onOpenChange={setShowCreateMonthDialog}
          aircraftId={aircraftId}
          aircraftRegistration={aircraft?.registration || ''}
          month={selectedMonth}
          year={selectedYear}
          previousMonthData={previousMonthData}
          onCreate={handleCreateMonthWithData}
        />

        {/* Dialog para fechar mês */}
        <CloseMonthDialog
          open={showCloseMonthDialog}
          onOpenChange={setShowCloseMonthDialog}
          aircraftId={aircraftId}
          month={selectedMonth - 1}
          year={selectedYear}
          totalHours={entries.reduce((sum, e) => sum + (Number(e.total_time) || 0), 0)}
          totalLandings={entries.reduce((sum, e) => sum + (Number(e.pousos) || 0), 0)}
          totalFuelAdded={entries.reduce((sum, e) => sum + (Number(e.combustivel_adicionado) || 0), 0)}
          onSuccess={() => { setShowCloseMonthDialog(false); onBack(); }}
        />

        {/* Dialog para exportar diário em PDF */}
        <ExportLogbookDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          aircraftId={aircraftId}
          aircraftRegistration={aircraft?.registration || ''}
          aircraftModel={aircraft?.model || ''}
          clientName={''}
          availableMonths={availableMonths}
          entries={entries}
          currentMonth={selectedMonth}
          currentYear={selectedYear}
        />

        {/* Modal para seleção de parceiro */}
        {(() => {
          const selectedClient = clients.find(c => c.id === pendingClientId);
          const partners = getPartnersFromClient(selectedClient);

          // Determina qual field está sendo preenchido
          const isLoanFlow = flightType === 'emprestimo';
          // Find the selected partner based on the current partner ID
          const currentPartnerId = flightType === 'emprestimo' && pendingClientId === newEntry.loan_recipient_client_id
            ? newEntry.loan_recipient_partner_id
            : newEntry.client_partner_id;
          const currentPartnerName = partners.find(p => p.id === currentPartnerId)?.name || '';

          return (
            <PartnerSelectModal
              open={showPartnerModal}
              onOpenChange={setShowPartnerModal}
              clientName={selectedClient?.company_name || ''}
              partners={partners}
              selectedPartner={currentPartnerName}
              onSelectPartner={(partnerName) => {
                // Find partner ID from name
                const partner = partners.find(p => p.name === partnerName);
                const partnerId = partner?.id || null;

                // Verifica qual fluxo está ativo
                if (flightType === 'emprestimo') {
                  if (pendingClientId === newEntry.client_id) {
                    // Selecionando parceiro do cliente que empresta - mas não usamos para empréstimos
                    // client_partner_id deve ser null para empréstimos
                    setNewEntry({
                      ...newEntry,
                      client_partner_id: null
                    });
                  } else if (pendingClientId === newEntry.loan_recipient_client_id) {
                    // Selecionando parceiro do cliente que pega emprestado
                    setNewEntry({
                      ...newEntry,
                      loan_recipient_partner_id: partnerId
                    });
                  }
                } else {
                  // Fluxo de cliente normal - set client_partner_id
                  setNewEntry({
                    ...newEntry,
                    client_partner_id: partnerId
                  });
                }
                setShowPartnerModal(false);
              }}
            />
          );
        })()}

        {/* INFORMAÇÕES TÉCNICAS DO PERÍODO */}
        {logbookMonth && <div className="space-y-6">
          {/* MÉTRICAS PRINCIPAIS DESTACADAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-0 px-[28px]">
            {/* CÉLULA ANTERIOR */}
            <div className="group relative bg-slate-900 border rounded-2xl p-6 shadow-xl transition-all border-violet-400 overflow-visible">
              {canEditCelulaFields && (
                <button
                  onClick={() => openEditModal('celula_anterior', logbookMonth.celula_anterior?.toString() || '0.00')}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-violet-500/40 hover:bg-violet-500/60 text-violet-200 hover:text-violet-100 transition-all duration-200 z-10 shadow-lg"
                  title="Editar Célula Anterior"
                >
                  <Edit size={20} />
                </button>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[9px] uppercase font-bold tracking-widest mb-1 text-violet-400">Célula Anterior</p>
                  <p className="text-3xl font-black text-violet-400">{logbookMonth.celula_anterior?.toFixed(2) || '0.00'}</p>
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
                  <p className="text-3xl font-black text-emerald-400">{logbookMonth.celula_atual?.toFixed(2) || lastCelula.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500 mt-1">horas</p>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"></div>
            </div>

            {/* PRÓXIMA REVISÃO */}
            <div className="group relative bg-slate-900 border border-orange-500/30 rounded-2xl p-6 shadow-xl hover:border-orange-500/50 transition-all overflow-visible">
              {canEditCelulaFields && (
                <button
                  onClick={() => openEditModal('celula_prox_revisao', logbookMonth.celula_prox_revisao?.toString() || '0.00')}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-orange-500/40 hover:bg-orange-500/60 text-orange-200 hover:text-orange-100 transition-all duration-200 z-10 shadow-lg"
                  title="Editar Próxima Revisão"
                >
                  <Edit size={20} />
                </button>
              )}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-[9px] text-orange-500 uppercase font-bold tracking-widest mb-1">Próx. Revisão</p>
                  <p className="text-3xl font-black text-orange-400">{logbookMonth.celula_prox_revisao?.toFixed(2) || '-'}</p>
                  <p className="text-[10px] text-slate-500 mt-1">horas</p>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"></div>
            </div>

            {/* DISPONÍVEL */}
            <div className={`bg-slate-900 rounded-2xl p-6 shadow-xl transition-all ${(logbookMonth.celula_disponivel || 0) < 0 ? 'border-2 border-red-500 hover:border-red-400 shadow-lg shadow-red-500/20' : 'border border-blue-500/30 hover:border-blue-500/50'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className={`text-[9px] uppercase font-bold tracking-widest mb-1 ${(logbookMonth.celula_disponivel || 0) < 0 ? 'text-red-500' : 'text-blue-500'}`}>Disponível</p>
                  <p className={`text-3xl font-black ${(logbookMonth.celula_disponivel || 0) < 0 ? 'text-red-400' : 'text-blue-400'}`}>{logbookMonth.celula_disponivel?.toFixed(2) || '0.00'}</p>
                  <p className="text-[10px] text-slate-500 mt-1">horas</p>
                </div>
              </div>
              <div className={`h-1 rounded-full ${(logbookMonth.celula_disponivel || 0) < 0 ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`}></div>
            </div>
          </div>

          {/* INFORMAÇÕES ADICIONAIS */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl py-[5px] px-[13px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">Informações Técnicas Adicionais</h2>

            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Base Aeródromo */}
              <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <button
                  onClick={() => openEditModal('base_aerodrome', logbookMonth.base_aerodrome || '')}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/40 text-sky-400 hover:text-sky-300 transition-all duration-200"
                  title="Editar Base Aeródromo"
                >
                  <Edit size={18} />
                </button>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Base Aeródromo</p>
                <p className="text-lg font-black text-white">{logbookMonth.base_aerodrome || '-'}</p>
              </div>

              {/* Horimetro Início */}
              <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <button
                  onClick={() => openEditModal('horimetro_inicio', logbookMonth.horimetro_inicio?.toString() || '0.0')}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 hover:text-cyan-300 transition-all duration-200"
                  title="Editar Horimetro Início"
                >
                  <Edit size={18} />
                </button>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Horimetro Início</p>
                <p className="text-xl font-black text-blue-400">{logbookMonth.horimetro_inicio?.toFixed(1) || '0.0'}h</p>
              </div>

              {/* Horimetro Final */}
              <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <button
                  onClick={() => openEditModal('horimetro_final', logbookMonth.horimetro_final?.toString() || '0.0')}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 hover:text-orange-300 transition-all duration-200"
                  title="Editar Horimetro Final"
                >
                  <Edit size={18} />
                </button>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Horimetro Final</p>
                <p className="text-xl font-black text-orange-400">{logbookMonth.horimetro_final?.toFixed(1) || '0.0'}h</p>
              </div>

              {/* Horimetro Ativo */}
              <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                <button
                  onClick={() => openEditModal('horimetro_ativo', logbookMonth.horimetro_ativo?.toString() || '0.0')}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 text-pink-400 hover:text-pink-300 transition-all duration-200"
                  title="Editar Horimetro Ativo"
                >
                  <Edit size={18} />
                </button>
                <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Horimetro Ativo</p>
                <p className="text-xl font-black text-pink-400">{logbookMonth.horimetro_ativo?.toFixed(1) || '0.0'}h</p>
              </div>

              {/* Valor Diária - Só mostra quando tem diária marcada */}
              {logbookMonth?.has_daily_rate && (
                <div className="group relative bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                  <button
                    onClick={() => openEditModal('daily_rate', logbookMonth.daily_rate?.toString() || '0.00')}
                    className="absolute top-2 right-2 p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-all duration-200"
                    title="Editar Valor Diária"
                  >
                    <Edit size={18} />
                  </button>
                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Valor Diária</p>
                  <p className="text-lg font-black text-green-400">R$ {logbookMonth.daily_rate?.toFixed(2) || '0.00'}</p>
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
                <span className="text-[10px] font-black uppercase tracking-widest">1. Tripulação </span>
              </div>

              <Input type="date" value={newEntry.entry_date} onChange={e => {
                const selectedDate = new Date(e.target.value);
                const selectedDateMonth = selectedDate.getUTCMonth() + 1;
                const selectedDateYear = selectedDate.getUTCFullYear();
                if (selectedDateMonth !== selectedMonth || selectedDateYear !== selectedYear) {
                  toast.error(`A data deve estar no mês selecionado: ${MONTHS[selectedMonth - 1]} de ${selectedYear}`);
                  return;
                }
                setNewEntry({
                  ...newEntry,
                  entry_date: e.target.value
                });
              }} className="bg-slate-950 border-slate-800 text-white" />

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Comandante (PIC) *</Label>
                <Popover open={picNewOpen} onOpenChange={setPicNewOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between h-11 font-normal bg-slate-950 border-slate-800 text-white hover:bg-slate-900"
                    >
                      {newEntry.pic_canac
                        ? (() => {
                          const pic = crew.find(c => c.id === newEntry.pic_canac);
                          return pic ? `${pic.full_name} (${pic.canac})` : 'Selecione o PIC...';
                        })()
                        : 'Selecione o PIC...'
                      }
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-slate-950 border-slate-800" align="start">
                    <Command className="bg-slate-950">
                      <CommandInput
                        placeholder="Buscar piloto por nome ou CANAC..."
                        className="bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum piloto encontrado.</CommandEmpty>
                        <CommandGroup>
                          {crew.map((pilot) => (
                            <CommandItem
                              key={pilot.id}
                              value={`${pilot.full_name} ${pilot.canac}`}
                              onSelect={() => {
                                setNewEntry({
                                  ...newEntry,
                                  pic_canac: pilot.id
                                });
                                setPicNewOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newEntry.pic_canac === pilot.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col gap-0.5 flex-1">
                                <span className="font-medium text-white">{pilot.full_name}</span>
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
                onChange={(sicCanac, sicName) => setNewEntry({
                  ...newEntry,
                  sic_canac: sicCanac,  // deixar como null/undefined, não converter para string vazia
                  sic_name: sicName
                })}
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
                  <Input placeholder="SBCY" value={newEntry.departure_aerodrome} onChange={e => setNewEntry({
                    ...newEntry,
                    departure_aerodrome: e.target.value.toUpperCase()
                  })} className="bg-slate-950 border-slate-800 text-white uppercase" list="aerodromes-list" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Destino *</Label>
                  <Input placeholder="SBMT" value={newEntry.arrival_aerodrome} onChange={e => setNewEntry({
                    ...newEntry,
                    arrival_aerodrome: e.target.value.toUpperCase()
                  })} className="bg-slate-950 border-slate-800 text-white uppercase" list="aerodromes-list" />
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
                {/* Seleção do Tipo de Voo: Cliente | Rateio | Empréstimo */}
                <div className="space-y-2">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Responsável pelos Custos</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={flightType === 'cliente' ? 'default' : 'outline'}
                      className="flex-1 h-10 text-xs font-semibold"
                      onClick={() => {
                        // Obter o primeiro cliente vinculado à aeronave (proprietário)
                        const linkedClientId = sortedClients.find(c => c.client_aircraft?.some((ca: any) => ca.aircraft_id === aircraftId))?.id || '';

                        setFlightType('cliente');
                        setNewEntry({
                          ...newEntry,
                          is_equal_split: false,
                          is_loan: false,
                          client_id: linkedClientId,
                          client_partner_id: null,
                          loan_recipient_client_id: null,
                          loan_recipient_partner_id: null,
                        });
                      }}
                    >
                      Cliente
                    </Button>
                    <Button
                      type="button"
                      variant={flightType === 'rateio' ? 'default' : 'outline'}
                      className="flex-1 h-10 text-xs font-semibold"
                      onClick={() => {
                        setFlightType('rateio');
                        setNewEntry({
                          ...newEntry,
                          is_equal_split: true,
                          is_loan: false,
                          client_id: '',
                          client_partner_id: null,
                          loan_recipient_client_id: null,
                          loan_recipient_partner_id: null,
                        });
                      }}
                    >
                      Rateio
                    </Button>
                    <Button
                      type="button"
                      variant={flightType === 'emprestimo' ? 'default' : 'outline'}
                      className="flex-1 h-10 text-xs font-semibold bg-amber-600/20 border-amber-500/30 hover:bg-amber-600/30"
                      onClick={() => {
                        setFlightType('emprestimo');
                        setNewEntry({
                          ...newEntry,
                          is_equal_split: false,
                          is_loan: true,
                          flight_nature: 'PV - Privado',
                          client_partner_id: null,
                          loan_recipient_client_id: null,
                          loan_recipient_partner_id: null,
                        });
                      }}
                    >
                      Empréstimo
                    </Button>
                  </div>
                </div>

                {/* SEÇÃO: Tipo Cliente */}
                {flightType === 'cliente' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Cliente / Cotista *</Label>
                      <Select value={newEntry.client_id} onValueChange={v => {
                        const selectedClient = clients.find(c => c.id === v);
                        const partners = getPartnersFromClient(selectedClient);

                        setNewEntry({
                          ...newEntry,
                          client_id: v,
                          client_partner_id: null,
                          loan_recipient_client_id: null,
                          loan_recipient_partner_id: null
                        });

                        // Se o cliente tem parceiros, abre o modal
                        if (partners.length > 0) {
                          setPendingClientId(v);
                          setShowPartnerModal(true);
                        }
                      }}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                          <SelectValue placeholder="Selecione o Cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedClients
                            .filter(cl => cl.client_aircraft?.some(ca => ca.aircraft_id === aircraftId))
                            .map(cl => (
                              <SelectItem key={cl.id} value={cl.id}>
                                {cl.company_name}
                                <span className="text-emerald-400"> ✓</span>
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Seleção de Sócio/Partner - mostra apenas se foi selecionado */}
                    {newEntry.client_id && (() => {
                      const selectedClient = clients.find(c => c.id === newEntry.client_id);
                      const partners = getPartnersFromClient(selectedClient);

                      if (newEntry.client_partner_id && partners.length > 0) {
                        return (
                          <div className="space-y-1 mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <Label className="text-[9px] uppercase text-amber-500 ml-1 block">Sócio Selecionado</Label>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-amber-400">{partners.find(p => p.id === newEntry.client_partner_id)?.name || 'Selecionado'}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingClientId(newEntry.client_id);
                                  setShowPartnerModal(true);
                                }}
                                className="text-xs px-2 py-1 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/50 text-amber-400 rounded transition-all"
                              >
                                Alterar
                              </button>
                            </div>
                            {selectedClient?.cnpj && (
                              <p className="text-[8px] text-slate-500 mt-1">
                                CNPJ: {selectedClient.cnpj}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {/* SEÇÃO: Tipo Rateio */}
                {flightType === 'rateio' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <p className="text-[9px] text-emerald-400 uppercase font-bold tracking-widest">
                      Tipo de Voo para Rateio
                    </p>
                    <Select value={newEntry.flight_nature} onValueChange={v => setNewEntry({
                      ...newEntry,
                      flight_nature: v
                    })}>
                      <SelectTrigger className="bg-slate-950 border border-emerald-500/30 text-emerald-400">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {SPLIT_FLIGHT_TYPES.map(type => (
                          <SelectItem key={type.code} value={type.code}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[8px] text-slate-400 mt-2 italic">
                      💡 Custos serão divididos igualmente entre todos os sócios
                    </p>
                  </div>
                )}

                {/* SEÇÃO: Tipo Empréstimo */}
                {flightType === 'emprestimo' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-[9px] text-amber-400 uppercase font-bold tracking-widest mb-3">
                      Configurar Empréstimo
                    </p>

                    {/* Cliente que está emprestando */}
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-amber-400 ml-1 block">Cliente que Empresta a Aeronave *</Label>
                      <Select value={newEntry.client_id} onValueChange={v => {
                        const selectedClient = clients.find(c => c.id === v);

                        setNewEntry({
                          ...newEntry,
                          client_id: v,
                          client_partner_id: null,
                          loan_recipient_client_id: null,
                          loan_recipient_partner_id: null
                        });

                        // Note: Para empréstimos, não usamos partner_name do lender
                        // client_partner_id deve ser null para empréstimos
                      }}>
                        <SelectTrigger className="bg-slate-950 border-amber-500/30 text-amber-400">
                          <SelectValue placeholder="Selecione o Cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedClients.map(cl => {
                            // Verificar se o cliente está vinculado à aeronave
                            const isLinkedToAircraft = cl.client_aircraft?.some(ca => ca.aircraft_id === aircraftId);
                            // Mostrar apenas clientes vinculados à aeronave (sócios)
                            const shouldShow = isLinkedToAircraft;

                            return shouldShow ? (
                              <SelectItem key={cl.id} value={cl.id}>
                                {cl.company_name}
                              </SelectItem>
                            ) : null;
                          })}
                        </SelectContent>
                      </Select>
                    </div>


                    {/* Cliente que está usando a aeronave emprestada (deve aparecer TODOS os clientes) */}
                    <div className="space-y-1 mt-2">
                      <Label className="text-[9px] uppercase text-amber-500 ml-1 block">
                        Cliente que Pega Emprestado (Usa a Aeronave) *
                      </Label>
                      <Select
                        value={newEntry.loan_recipient_client_id || ''}
                        onValueChange={(v) => {
                          const selectedBorrowerClient = clients.find(c => c.id === v);
                          const borrowerPartners = getPartnersFromClient(selectedBorrowerClient);

                          setNewEntry({
                            ...newEntry,
                            loan_recipient_client_id: v,
                            loan_recipient_partner_id: null,
                          });

                          // Se o cliente tem parceiros, abre o modal para seleção de parceiro do cliente que pega emprestado
                          if (borrowerPartners.length > 0) {
                            setPendingClientId(v);
                            setShowPartnerModal(true);
                          }
                        }}
                      >
                        <SelectTrigger className="bg-slate-950 border-amber-500/30 text-amber-400">
                          <SelectValue placeholder="Selecione o cliente que está usando" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((cl) => (
                            <SelectItem key={cl.id} value={cl.id}>
                              {cl.company_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Sócio/Cotista do cliente que pega emprestado (se houver) */}
                    {newEntry.loan_recipient_client_id && (() => {
                      const selectedBorrowerClient = clients.find(c => c.id === newEntry.loan_recipient_client_id);
                      const borrowerPartners = getPartnersFromClient(selectedBorrowerClient);

                      if (newEntry.loan_recipient_partner_id && borrowerPartners.length > 0) {
                        return (
                          <div className="space-y-1 mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                            <Label className="text-[9px] uppercase text-amber-500 ml-1 block">Cotista que Pega Emprestado</Label>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-amber-400">{borrowerPartners.find(p => p.id === newEntry.loan_recipient_partner_id)?.name || 'Selecionado'}</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingClientId(newEntry.loan_recipient_client_id);
                                  setShowPartnerModal(true);
                                }}
                                className="text-xs px-2 py-1 bg-amber-600/20 hover:bg-amber-600/40 border border-amber-500/50 text-amber-400 rounded transition-all"
                              >
                                Alterar
                              </button>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

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
                  <Input type="time" step="60" value={newEntry.ac_time} onChange={e => setNewEntry({
                    ...newEntry,
                    ac_time: e.target.value
                  })} style={{
                    accentColor: 'white',
                    colorScheme: 'dark'
                  }} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Decolagem *</Label>
                  <Input type="time" step="60" value={newEntry.dep_time} onChange={e => setNewEntry({
                    ...newEntry,
                    dep_time: e.target.value
                  })} style={{
                    accentColor: 'white',
                    colorScheme: 'dark'
                  }} className="bg-slate-950 border-slate-800 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-800/50 pt-4">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Pouso *</Label>
                  <Input type="time" step="60" value={newEntry.pou_time} onChange={e => setNewEntry({
                    ...newEntry,
                    pou_time: e.target.value
                  })} style={{
                    accentColor: 'white',
                    colorScheme: 'dark'
                  }} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Corte *</Label>
                  <Input type="time" step="60" value={newEntry.cor_time} onChange={e => setNewEntry({
                    ...newEntry,
                    cor_time: e.target.value
                  })} style={{
                    accentColor: 'white',
                    colorScheme: 'dark'
                  }} className="bg-slate-950 border-slate-800 text-white" />
                </div>
              </div>

            </div>

            {/* SEÇÃO 4: TEMPOS (Resumo de Cálculos) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-purple-500 mb-2">
                <TrendingUp size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">4. Tempos</span>
              </div>

              {newEntry.total_time > 0 ? <div className="space-y-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] uppercase text-orange-500 font-bold">T. VOO</Label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-black text-sm min-w-24 text-center">
                      {decimalToHoursOnly(newEntry.time)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] uppercase text-emerald-500 font-bold">T. DIA</Label>
                    <Input type="time" step="60" value={decimalToTimeString(newEntry.day_time)} onChange={e => setNewEntry({
                      ...newEntry,
                      day_time: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-emerald-400 font-bold text-sm w-24 text-center" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] uppercase text-sky-500 font-bold">T. NOITE</Label>
                    <Input type="time" step="60" value={decimalToTimeString(newEntry.night_hours)} onChange={e => setNewEntry({
                      ...newEntry,
                      night_hours: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-sky-400 font-bold text-sm w-24 text-center" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] uppercase text-white font-bold">TOTAL</Label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-black text-sm min-w-24 text-center">
                      {decimalToHHMM(newEntry.total_time)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] uppercase text-purple-500 font-bold">IFR</Label>
                    <Input type="time" step="60" value={decimalToTimeString(newEntry.ifr_time)} onChange={e => setNewEntry({
                      ...newEntry,
                      ifr_time: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-purple-400 font-bold text-sm w-24 text-center" />
                  </div>
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
                  <Input type="number" value={newEntry.pousos} onChange={e => setNewEntry({
                    ...newEntry,
                    pousos: parseInt(e.target.value) || 1
                  })} className="bg-slate-950 border-slate-800 text-white" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Combustível Inicial (L)</Label>
                  <Input type="number" step="0.1" placeholder="0" value={newEntry.fuel_liters} onChange={e => setNewEntry({
                    ...newEntry,
                    fuel_liters: parseFloat(e.target.value) || 0
                  })} className="bg-slate-950 border-slate-800 text-orange-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Combustível Abastecido (L)</Label>
                  <Input type="number" step="0.1" placeholder="0" value={newEntry.fuel_added} onChange={e => setNewEntry({
                    ...newEntry,
                    fuel_added: parseFloat(e.target.value) || 0
                  })} className="bg-slate-950 border-slate-800 text-orange-300" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block">POB (Pessoas)</Label>
                  <Input type="number" value={newEntry.passengers} onChange={e => setNewEntry({
                    ...newEntry,
                    passengers: parseInt(e.target.value) || 0
                  })} className="bg-slate-950 border-slate-800 text-sky-400" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Carga (kg)</Label>
                <Input type="number" step="0.1" placeholder="0" value={newEntry.cargo_kg} onChange={e => setNewEntry({
                  ...newEntry,
                  cargo_kg: parseFloat(e.target.value) || 0
                })} className="bg-slate-950 border-slate-800 text-emerald-400" />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Natureza do Voo *</Label>
                <Select value={newEntry.flight_nature} onValueChange={v => setNewEntry({
                  ...newEntry,
                  flight_nature: v
                })}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLIGHT_NATURE.map(fn => <SelectItem key={fn} value={fn}>{fn}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {logbookMonth?.has_daily_rate && (
                <div className="space-y-1 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <Label className="text-[9px] uppercase text-yellow-500 font-bold ml-1 block">
                    Quantidade de Diárias
                  </Label>
                  <div className="flex gap-2 items-end">
                    <Input
                      type="number"
                      min="0"
                      value={newEntry.daily_quantity}
                      onChange={e => setNewEntry({
                        ...newEntry,
                        daily_quantity: parseInt(e.target.value) || 0
                      })}
                      className="bg-slate-950 border-yellow-500/30 text-yellow-400 font-bold text-center flex-1"
                      placeholder="0"
                    />
                    <div className="text-sm font-bold text-yellow-400">
                      × R$ {(logbookMonth?.daily_rate || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-yellow-500/20 text-right">
                    <div className="text-[9px] uppercase text-yellow-500 font-bold">Total de Diárias</div>
                    <div className="text-lg font-black text-yellow-400">
                      R$ {((newEntry.daily_quantity || 0) * (logbookMonth?.daily_rate || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {editingEntryIdForm ? (
                <div className="flex gap-3">
                  <Button onClick={() => {
                    setEditingEntryIdForm(null);
                    setShowAddForm(false);
                    setNewEntry({
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
                    setFlightType('cliente');
                  }} className="flex-1 bg-slate-800 hover:bg-slate-700 h-14 font-black uppercase text-sm rounded-2xl flex items-center justify-center">
                    <X size={18} className="mr-2" />
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveFlightEntry} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 h-14 font-black uppercase text-sm rounded-2xl">
                    <Save size={18} className="mr-2" />
                    Atualizar Voo
                  </Button>
                </div>
              ) : (
                <Button onClick={handleSaveFlightEntry} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 h-14 font-black uppercase text-sm rounded-2xl">
                  <Save size={18} className="mr-2" />
                  Salvar Voo
                </Button>
              )}
            </div>

            {/* SEÇÃO 6: OBSERVAÇÕES & MANUTENÇÃO */}
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-center gap-2 text-yellow-500 mb-2">
                <AlertCircle size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">6. Observações & Manutenção</span>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Ocorrência(s):</Label>
                <textarea placeholder="Descreva qualquer ocorrência durante o voo..." value={newEntry.occurrences} onChange={e => setNewEntry({
                  ...newEntry,
                  occurrences: e.target.value
                })} className="w-full h-20 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs resize-none focus:ring-2 focus:ring-sky-500 focus:outline-none" />
              </div>
            </div>
          </div>
          {logbookMonth?.has_daily_rate && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-2">Diárias do Período</p>
              <p className="text-lg font-black text-yellow-400">{calculatePerDiemInfo.count} diárias</p>
              <p className="text-xs text-emerald-400 mt-1">R$ {(calculatePerDiemInfo.total || 0).toFixed(2)}</p>
            </div>
          )}
          {logbookMonth?.has_daily_rate && calculatePerDiemInfo.count > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="text-yellow-500" size={18} />
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">
                  Detalhamento de Diárias (Clique para marcar como contabilizada)
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {calculatePerDiemInfo.details.map((pd, idx) => {
                  const uniqueKey = pd.entryId ? `${pd.entryId}_${pd.date}` : `${idx}`;
                  const isMarked = markedDailies[uniqueKey] || false;
                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-3 transition-all cursor-pointer ${isMarked
                          ? 'bg-sky-500/20 border-sky-500/50'
                          : 'bg-slate-950 border-yellow-500/30'
                        }`}
                      onClick={() => {
                        const newMarked = { ...markedDailies };
                        newMarked[uniqueKey] = !isMarked;
                        setMarkedDailies(newMarked);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isMarked}
                          onChange={() => { }}
                          className="w-4 h-4 mt-0.5 accent-sky-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[9px] uppercase font-bold mb-1 ${isMarked ? 'text-sky-400' : 'text-yellow-500'
                            }`}>
                            {pd.date}
                          </p>
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
                    {calculatePerDiemInfo.count} × R$ {(logbookMonth.daily_rate || 0).toFixed(2)} =
                    R$ {(calculatePerDiemInfo.total || 0).toFixed(2)}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Alertas e Informações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4 flex items-start gap-3">
              <Info className="text-sky-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-sky-200">
                <strong>Cálculo Automático:</strong> A apresentação é calculada 30min antes do acionamento. Os tempos são calculados automaticamente.
              </div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
              <Info className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-emerald-200">
                <strong>Sistema Dual:</strong> Selecione "Rateio Igual" para dividir custos entre sócios ou escolha um cliente específico. Tipos de rateio: Cheque (CQ), Traslado (TR) e Teste (TN).
              </div>
            </div>
          </div>
        </div>
        }

        {/* MODAL SITUAÇÃO TÉCNICA DA AERONAVE */}
        {showTechnicalStatus && <div className="bg-slate-900 border-2 border-emerald-500/20 rounded-[2.5rem] p-8 shadow-3xl space-y-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Situação Técnica da Aeronave</h2>
            <button onClick={() => setShowTechnicalStatus(false)} className="text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* SEÇÃO 1: DADOS DE MANUTENÇÃO */}
          <div className="space-y-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-2 text-emerald-500 mb-4">
              <AlertCircle size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Histórico de Manutenção</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Tipo da última intervenção de manutenção</Label>
                <input type="text" value={technicalStatus.last_maintenance_type} onChange={e => setTechnicalStatus({
                  ...technicalStatus,
                  last_maintenance_type: e.target.value
                })} className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Ex: Revisão completa, Manutenção preventiva..." />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Horas de célula para próxima intervenção</Label>
                <input type="number" step="0.01" value={technicalStatus.airframe_hours_next_maintenance} onChange={e => setTechnicalStatus({
                  ...technicalStatus,
                  airframe_hours_next_maintenance: e.target.value
                })} className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Ex: 50.00" />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Tipo da próxima intervenção de manutenção</Label>
                <input type="text" value={technicalStatus.next_maintenance_type} onChange={e => setTechnicalStatus({
                  ...technicalStatus,
                  next_maintenance_type: e.target.value
                })} className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Ex: Manutenção programada..." />
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">CANAC e Rubrica PIC</Label>
                <input type="text" value={technicalStatus.maintenance_approval_responsible} onChange={e => setTechnicalStatus({
                  ...technicalStatus,
                  maintenance_approval_responsible: e.target.value
                })} className="w-full h-10 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="Ex: 001234 / Rubrica" />
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: REGISTROS DA TRIPULAÇÃO */}
          <div className="space-y-4 pb-6 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-500">
                <Users size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Registros da Tripulação</span>
              </div>
              <button onClick={() => setTechnicalStatus({
                ...technicalStatus,
                crew_records: [...technicalStatus.crew_records, {
                  date: '',
                  system: '',
                  discrepancy: '',
                  canac: ''
                }]
              })} className="px-3 h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-bold uppercase transition-all">
                <Plus size={14} className="inline mr-1" /> Adicionar Registro
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800/50 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800">
                    <th className="p-2 text-center">Data</th>
                    <th className="p-2 text-center">Sist.</th>
                    <th className="p-2 text-center">Discrepância</th>
                    <th className="p-2 text-center">CANAC</th>
                    <th className="p-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {technicalStatus.crew_records.map((record, idx) => <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-2 text-center">
                      <input type="date" value={record.date} onChange={e => {
                        const newRecords = [...technicalStatus.crew_records];
                        newRecords[idx].date = e.target.value;
                        setTechnicalStatus({
                          ...technicalStatus,
                          crew_records: newRecords
                        });
                      }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </td>
                    <td className="p-2 text-center">
                      <input type="text" value={record.system} onChange={e => {
                        const newRecords = [...technicalStatus.crew_records];
                        newRecords[idx].system = e.target.value;
                        setTechnicalStatus({
                          ...technicalStatus,
                          crew_records: newRecords
                        });
                      }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Sistema" />
                    </td>
                    <td className="p-2 text-center">
                      <input type="text" value={record.discrepancy} onChange={e => {
                        const newRecords = [...technicalStatus.crew_records];
                        newRecords[idx].discrepancy = e.target.value;
                        setTechnicalStatus({
                          ...technicalStatus,
                          crew_records: newRecords
                        });
                      }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Discrepância" />
                    </td>
                    <td className="p-2 text-center">
                      <input type="text" value={record.canac} onChange={e => {
                        const newRecords = [...technicalStatus.crew_records];
                        newRecords[idx].canac = e.target.value;
                        setTechnicalStatus({
                          ...technicalStatus,
                          crew_records: newRecords
                        });
                      }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="CANAC" />
                    </td>
                    <td className="p-2 text-center">
                      <button onClick={() => setTechnicalStatus({
                        ...technicalStatus,
                        crew_records: technicalStatus.crew_records.filter((_, i) => i !== idx)
                      })} className="p-1 hover:bg-red-600/30 text-red-400 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>

          {/* SEÇÃO 3: APROVAÇÃO DE RETORNO AO SERVIÇO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500">
                <CheckCircle size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Aprovação de Retorno ao Serviço</span>
              </div>
              <button onClick={() => setTechnicalStatus({
                ...technicalStatus,
                service_return: [...technicalStatus.service_return, {
                  date: '',
                  corrective_action: '',
                  responsible_canac: '',
                  pic_canac: ''
                }]
              })} className="px-3 h-8 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg font-bold uppercase transition-all">
                <Plus size={14} className="inline mr-1" /> Adicionar Registro
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800/50 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800">
                    <th className="p-2 text-center">Data</th>
                    <th className="p-2 text-center">Ação Corretiva</th>
                    <th className="p-2 text-center">CANAC Responsável</th>
                    <th className="p-2 text-center">CANAC PIC</th>
                    <th className="p-2 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {technicalStatus.service_return.map((record, idx) => <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-2 text-center">
                      <input type="date" value={record.date} onChange={e => {
                        const newRecords = [...technicalStatus.service_return];
                        newRecords[idx].date = e.target.value;
                        setTechnicalStatus({
                          ...technicalStatus,
                          service_return: newRecords
                        });
                      }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none" />
                    </td>
                    <td className="p-2 text-center">
                      <input type="text" value={record.corrective_action} onChange={e => {
                        const newRecords = [...technicalStatus.service_return];
                        newRecords[idx].corrective_action = e.target.value;
                        setTechnicalStatus({
                          ...technicalStatus,
                          service_return: newRecords
                        });
                      }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="Ação corretiva" />
                    </td>
                    <td className="p-2 text-center">
                      <input type="text" value={record.responsible_canac} onChange={e => {
                        const newRecords = [...technicalStatus.service_return];
                        newRecords[idx].responsible_canac = e.target.value;
                        setTechnicalStatus({
                          ...technicalStatus,
                          service_return: newRecords
                        });
                      }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="CANAC" />
                    </td>
                    <td className="p-2 text-center">
                      <input type="text" value={record.pic_canac} onChange={e => {
                        const newRecords = [...technicalStatus.service_return];
                        newRecords[idx].pic_canac = e.target.value;
                        setTechnicalStatus({
                          ...technicalStatus,
                          service_return: newRecords
                        });
                      }} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none" placeholder="CANAC PIC" />
                    </td>
                    <td className="p-2 text-center">
                      <button onClick={() => setTechnicalStatus({
                        ...technicalStatus,
                        service_return: technicalStatus.service_return.filter((_, i) => i !== idx)
                      })} className="p-1 hover:bg-red-600/30 text-red-400 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex gap-3 pt-6 border-t border-slate-800">
            <button onClick={() => {
              setShowTechnicalStatus(false);
              setTechnicalStatus({
                last_maintenance_type: '',
                airframe_hours_next_maintenance: '',
                next_maintenance_type: '',
                maintenance_approval_responsible: '',
                crew_records: [{
                  date: '',
                  system: '',
                  discrepancy: '',
                  canac: ''
                }],
                service_return: [{
                  date: '',
                  corrective_action: '',
                  responsible_canac: '',
                  pic_canac: ''
                }]
              });
            }} className="flex-1 bg-slate-800 hover:bg-slate-700 h-12 font-black uppercase text-sm rounded-2xl transition-colors flex items-center justify-center">
              <X size={18} className="mr-2" />
              Cancelar
            </button>
            <button onClick={async () => {
              try {
                // Parse celula_prox_revisao from airframe_hours_next_maintenance
                const celulaProxRevisao = technicalStatus.airframe_hours_next_maintenance
                  ? parseFloat(technicalStatus.airframe_hours_next_maintenance)
                  : logbookMonth.celula_prox_revisao;

                // Atualizar logbook_months com celula_prox_revisao e recalcular disponivel
                const celulaDisponivel = parseFloat(((celulaProxRevisao ?? 0) - (logbookMonth.celula_atual ?? 0)).toFixed(2));
                const { error: monthError } = await supabase
                  .from('logbook_months')
                  .update({
                    celula_prox_revisao: celulaProxRevisao,
                    celula_disponivel: celulaDisponivel
                  })
                  .eq('id', logbookMonth.id);

                if (monthError) throw monthError;

                // Salvar os dados da situação técnica para cada entrada de log do mês atual
                const {
                  error
                } = await (supabase as any).from('logbook_entries').update({
                  last_maintenance_type: technicalStatus.last_maintenance_type || null,
                  airframe_hours_next_maintenance: technicalStatus.airframe_hours_next_maintenance ? parseFloat(technicalStatus.airframe_hours_next_maintenance) : null,
                  next_maintenance_type: technicalStatus.next_maintenance_type || null,
                  maintenance_approval_responsible: technicalStatus.maintenance_approval_responsible || null,
                  pilot_signature_date: new Date().toISOString()
                }).eq('aircraft_id', aircraftId).eq('entry_month', selectedMonth).eq('entry_year', selectedYear);
                if (error) throw error;

                // Atualizar estado local
                setLogbookMonth({
                  ...logbookMonth,
                  celula_prox_revisao: celulaProxRevisao,
                  celula_disponivel: celulaDisponivel
                });

                toast.success("Situação técnica salva com sucesso!");
                setShowTechnicalStatus(false);

                // Recarregar entries
                const {
                  data
                } = await supabase.from('logbook_entries').select('*').eq('aircraft_id', aircraftId).order('sequential_number', {
                  ascending: true
                });
                setEntries(data || []);
                setTechnicalStatus({
                  last_maintenance_type: '',
                  airframe_hours_next_maintenance: '',
                  next_maintenance_type: '',
                  maintenance_approval_responsible: '',
                  crew_records: [{
                    date: '',
                    system: '',
                    discrepancy: '',
                    canac: ''
                  }],
                  service_return: [{
                    date: '',
                    corrective_action: '',
                    responsible_canac: '',
                    pic_canac: ''
                  }]
                });
              } catch (error) {
                logError("Erro ao salvar situação técnica:", error);
                toast.error("Erro ao salvar: " + error.message);
              }
            }} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 h-12 font-black uppercase text-sm rounded-2xl transition-all flex items-center justify-center shadow-xl">
              <Save size={18} className="mr-2" />
              Salvar Situação Técnica
            </button>
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
                  <th onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')} className="p-2 text-center cursor-pointer hover:text-sky-400 transition-colors group px-[7px] relative select-none" style={{ width: `${columnWidths.date}px` }}>
                    <div className="flex items-center justify-center gap-1">
                      <span>Data</span>
                      <span className="text-[7px] opacity-60 group-hover:opacity-100 transition-opacity font-extrabold bg-transparent text-primary-glow px-[4px]">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    </div>
                    <div onMouseDown={(e) => handleResizeMouseDown('date', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.from}px` }}>
                    De
                    <div onMouseDown={(e) => handleResizeMouseDown('from', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.to}px` }}>
                    Para
                    <div onMouseDown={(e) => handleResizeMouseDown('to', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.ac}px` }}>
                    Ac
                    <div onMouseDown={(e) => handleResizeMouseDown('ac', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.dep}px` }}>
                    Dep
                    <div onMouseDown={(e) => handleResizeMouseDown('dep', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.pou}px` }}>
                    Pou
                    <div onMouseDown={(e) => handleResizeMouseDown('pou', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.cor}px` }}>
                    Cor
                    <div onMouseDown={(e) => handleResizeMouseDown('cor', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.tvoo}px` }}>
                    T.Voo
                    <div onMouseDown={(e) => handleResizeMouseDown('tvoo', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.dia}px` }}>
                    Dia
                    <div onMouseDown={(e) => handleResizeMouseDown('dia', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.noite}px` }}>
                    Noite
                    <div onMouseDown={(e) => handleResizeMouseDown('noite', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.ifr}px` }}>
                    IFR
                    <div onMouseDown={(e) => handleResizeMouseDown('ifr', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.pousos}px` }}>
                    Pousos
                    <div onMouseDown={(e) => handleResizeMouseDown('pousos', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.fuel_add}px` }}>
                    Abas+
                    <div onMouseDown={(e) => handleResizeMouseDown('fuel_add', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.celula}px` }}>
                    FUEL
                    <div onMouseDown={(e) => handleResizeMouseDown('fuel_liters', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.celula}px` }}>
                    Célula
                    <div onMouseDown={(e) => handleResizeMouseDown('celula', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.pic}px` }}>
                    Pic
                    <div onMouseDown={(e) => handleResizeMouseDown('pic', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.canac_pic}px` }}>
                    Canac
                    <div onMouseDown={(e) => handleResizeMouseDown('canac_pic', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.sic}px` }}>
                    Sic
                    <div onMouseDown={(e) => handleResizeMouseDown('sic', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.canac_sic}px` }}>
                    Canac Sic
                    <div onMouseDown={(e) => handleResizeMouseDown('canac_sic', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  {logbookMonth?.has_daily_rate && <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.diarias}px` }}>
                    Diárias
                    <div onMouseDown={(e) => handleResizeMouseDown('diarias', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>}
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.voo_para}px` }} title="Cliente proprietário da aeronave (Client ID). Para empréstimos: mostra proprietário → tomador">
                    Voo Para
                    <div onMouseDown={(e) => handleResizeMouseDown('voo_para', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.check}px` }}>
                    ✓
                    <div onMouseDown={(e) => handleResizeMouseDown('check', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.acoes}px` }}>
                    Ações
                    <div onMouseDown={(e) => handleResizeMouseDown('acoes', e)} className="absolute right-0 top-0 w-1 h-full bg-slate-700 hover:bg-blue-500 cursor-col-resize opacity-0 group-hover:opacity-100 transition-opacity" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEntries.length === 0 ? <tr>
                  <td colSpan={18} className="p-20 text-center">
                    <Plane className="mx-auto mb-4 text-slate-700" size={48} />
                    <div className="text-slate-600 uppercase font-black text-xs tracking-widest">
                      Nenhum registro encontrado para este período
                    </div>
                    <div className="text-slate-700 text-xs mt-2">
                      Clique em "Novo Lançamento" para adicionar um voo
                    </div>
                  </td>
                </tr> : filteredEntries.map((e, idx) => {
                  const picCrew = crew.find(c => c.id === e.pic_canac);
                  const sicCrew = crew.find(c => c.id === e.sic_canac);
                  // Exibir apenas o cliente do voo (client_id) - nunca o partner_name
                  // (partner_name em empréstimo contém quem pegou emprestado, não o dono)
                  const lenderClient = clients.find(c => c.id === e.client_id);
                  const displayClientName = lenderClient?.company_name;
                  const borrowerClient = e.loan_recipient_client_id ? clients.find(c => c.id === e.loan_recipient_client_id) : null;
                  const displayBorrowerName = borrowerClient?.company_name;

                  // Para empréstimos: buscar nome do parceiro do tomador se existir
                  const borrowerPartnerName = e.is_loan && e.loan_recipient_partner_id
                    ? getPartnerNameById(e.loan_recipient_partner_id, clientPartners)
                    : null;

                  // Para voos normais: buscar nome do parceiro do cliente se existir
                  const clientPartnerName = !e.is_loan && e.client_partner_id
                    ? getPartnerNameById(e.client_partner_id, clientPartners)
                    : null;
                  return <tr key={e.id} className="hover:bg-slate-800/30 transition-colors group border-b border-slate-800/50">
                    <td className="p-2 whitespace-nowrap text-center text-xs" style={{ width: `${columnWidths.date}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-500 text-[10px]" title={`Sequência do mês: ${e.sequential_number}`}>#{e.sequential_number}</span>
                        <span className="text-white font-bold">{formatDateFromISO(e.entry_date)}</span>
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.from}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-sky-400 font-bold text-xs">{e.departure_aerodrome}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.to}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-emerald-400 font-bold text-xs">{e.arrival_aerodrome}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.ac}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-white font-bold text-xs">{formatTimeFromTimestamp(e.ac_time)}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.dep}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-slate-300 text-xs">{formatTimeFromTimestamp(e.dep_time)}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.pou}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-slate-300 text-xs">{formatTimeFromTimestamp(e.pou_time)}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.cor}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-white font-bold text-xs">{formatTimeFromTimestamp(e.cor_time)}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.tvoo}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-white font-bold text-sm">{decimalToHHMM(e.time)}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.dia}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.day_time > 0 ? <span className="text-emerald-400 font-bold text-sm">{decimalToHHMM(e.day_time)}</span> : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.noite}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.night_hours > 0 ? <span className="text-sky-400 font-bold text-sm">{decimalToHHMM(e.night_hours)}</span> : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.ifr}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.ifr_time > 0 ? <span className="text-purple-400 font-bold text-sm">{decimalToHHMM(e.ifr_time)}</span> : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.pousos}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-slate-300 text-xs">{e.pousos || '-'}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.fuel_add}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-slate-300 text-xs">{e.fuel_added > 0 ? e.fuel_added?.toFixed(1) : '-'}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.celula}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-orange-400 font-bold text-sm">{Math.round(e.fuel_liters || 0)}L</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.celula}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-purple-400 font-bold text-xs">{e.celula?.toFixed(1)}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.pic}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-white text-xs">{picCrew?.full_name.split(' ')[0] || '-'}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.canac_pic}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-slate-400 text-xs font-bold">{picCrew?.canac || '-'}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.sic}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.sic_name ? (
                        <span className="text-amber-300 text-xs font-semibold" title={e.sic_name}>{e.sic_name}</span>
                      ) : (
                        <span className="text-white text-xs">{sicCrew?.full_name.split(' ')[0] || '-'}</span>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.canac_sic}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.sic_name ? (
                        <span className="text-slate-600">-</span>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold">{sicCrew?.canac || '-'}</span>
                      )}
                    </td>
                    {logbookMonth?.has_daily_rate && (
                      <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.diarias}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.daily_rate > 0 ? (
                          <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg font-bold text-sm">
                            R${(e.daily_rate || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    )}
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.voo_para}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.is_equal_split ? (
                        <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold uppercase">
                          Rateio
                        </span>
                      ) : e.is_loan ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-amber-400 text-xs font-bold" title={`Proprietário: ${displayClientName || 'Desconhecido'}`}>
                            {shortenClientName(displayClientName || 'Desconhecido')}
                          </span>
                          {borrowerClient && (
                            <span className="text-amber-300 text-xs font-semibold" title={`Tomador: ${borrowerPartnerName || displayBorrowerName || 'Desconhecido'}`}>
                              → {shortenClientName(borrowerPartnerName || displayBorrowerName || 'Desconhecido')}
                            </span>
                          )}
                        </div>
                      ) : displayClientName ? (
                        <span className="text-cyan-400 text-xs font-semibold" title={`Cliente: ${displayClientName}${clientPartnerName ? ` - ${clientPartnerName}` : ''}`}>
                          {shortenClientName(displayClientName)}{clientPartnerName ? ` - ${shortenClientName(clientPartnerName)}` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="p-2 text-center" style={{ width: `${columnWidths.check}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${e.confirmed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 text-slate-600'}`}>
                        <CheckCircle size={14} />
                      </div>
                    </td>
                    <td className="p-2 text-center" style={{ width: `${columnWidths.acoes}px`, overflow: 'hidden' }}>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEditEntry(e)} className="p-2 hover:bg-sky-500/20 rounded-lg transition-all text-sky-400 hover:text-sky-300 hover:scale-110" title="Editar lançamento">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDeleteEntry(e.id)} className="p-2 hover:bg-rose-500/20 rounded-lg transition-all text-rose-400 hover:text-rose-300 hover:scale-110" title="Deletar lançamento">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          {/* Totalizador */}
          {filteredEntries.length > 0 && (() => {
            // Calcular totais por cliente
            const clientTotals: Record<string, { hours: number; dailyRates: number; name: string }> = {};
            // Calcular totais por sócio/partner
            const partnerTotals: Record<string, { hours: number; dailyRates: number; voos: number; partnerName: string }> = {};
            let splitHours = 0;

            filteredEntries.forEach(e => {
              if (e.is_equal_split) {
                splitHours += (e.time || 0);
              } else if (e.client_id) {
                const clientName = clients.find(c => c.id === e.client_id)?.company_name?.split(' ')[0] || 'Cliente';

                // Se é empréstimo (is_loan = true), agregar pelo cliente dono
                if (e.is_loan) {
                  if (!clientTotals[e.client_id]) {
                    clientTotals[e.client_id] = { hours: 0, dailyRates: 0, name: clientName };
                  }
                  clientTotals[e.client_id].hours += (e.time || 0);
                  clientTotals[e.client_id].dailyRates += (e.daily_rate || 0);
                } else {
                  // Voo normal: tentar agrupar por parceiro se houver
                  const hasClientPartner = e.client_partner_id;

                  if (hasClientPartner) {
                    // Agregar pelo client_partner_id
                    const partnerName = getPartnerNameById(e.client_partner_id, clientPartners) || 'Parceiro Desconhecido';
                    const partnerKey = e.client_partner_id;

                    if (!partnerTotals[partnerKey]) {
                      partnerTotals[partnerKey] = { hours: 0, dailyRates: 0, voos: 0, partnerName };
                    }
                    partnerTotals[partnerKey].hours += (e.time || 0);
                    partnerTotals[partnerKey].dailyRates += (e.daily_rate || 0);
                    partnerTotals[partnerKey].voos += 1;
                  } else if (e.partner_name) {
                    // Fallback: usar partner_name se existir (compatibilidade com dados antigos)
                    if (!partnerTotals[e.partner_name]) {
                      partnerTotals[e.partner_name] = { hours: 0, dailyRates: 0, voos: 0, partnerName: e.partner_name };
                    }
                    partnerTotals[e.partner_name].hours += (e.time || 0);
                    partnerTotals[e.partner_name].dailyRates += (e.daily_rate || 0);
                    partnerTotals[e.partner_name].voos += 1;
                  } else {
                    // Sem parceiro: agregar pelo cliente
                    if (!clientTotals[e.client_id]) {
                      clientTotals[e.client_id] = { hours: 0, dailyRates: 0, name: clientName };
                    }
                    clientTotals[e.client_id].hours += (e.time || 0);
                    clientTotals[e.client_id].dailyRates += (e.daily_rate || 0);
                  }
                }
              }
            });

            const totalDistance = filteredEntries.reduce((sum, e) => sum + (parseFloat(e.distance_nm) || 0), 0);
            const dailyRateValue = logbookMonth?.daily_rate || 0;
            const hasPartners = Object.keys(partnerTotals).length > 0;

            return (
              <div className="border-t border-slate-800 bg-slate-950/50 p-4 space-y-3">
                <div className="grid grid-cols-8 gap-3 text-center text-xs">
                  <div>
                    <div className="text-[8px] uppercase text-slate-500 font-black mb-1">Voos</div>
                    <div className="text-lg font-black text-white">{filteredEntries.length}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase text-slate-500 font-black mb-1">T.Voo</div>
                    <div className="text-lg font-black text-orange-400">
                      {decimalToHHMM(filteredEntries.reduce((sum, e) => sum + (e.time || 0), 0))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase text-slate-500 font-black mb-1">Dia</div>
                    <div className="text-lg font-black text-emerald-400">
                      {decimalToHHMM(filteredEntries.reduce((sum, e) => sum + (e.day_time || 0), 0))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase text-slate-500 font-black mb-1">Noite</div>
                    <div className="text-lg font-black text-sky-400">
                      {decimalToHHMM(filteredEntries.reduce((sum, e) => sum + (e.night_hours || 0), 0))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase text-slate-500 font-black mb-1">T.Total</div>
                    <div className="text-lg font-black text-pink-400">
                      {decimalToHHMM(filteredEntries.reduce((sum, e) => sum + (e.total_time || 0), 0))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase text-slate-500 font-black mb-1">Comb.Add</div>
                    <div className="text-lg font-black text-red-400">
                      {filteredEntries.reduce((sum, e) => sum + (e.fuel_added || 0), 0).toFixed(1)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[8px] uppercase text-slate-500 font-black mb-1">Dist.</div>
                    <div className="text-lg font-black text-cyan-400">
                      {totalDistance.toFixed(0)}NM
                    </div>
                  </div>
                  {logbookMonth?.has_daily_rate && (
                    <div>
                      <div className="text-[8px] uppercase text-slate-500 font-black mb-1">Diárias</div>
                      <div className="text-lg font-black text-yellow-400">
                        R${(filteredEntries.reduce((sum, e) => sum + (e.daily_rate || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Horas por sócio (quando houver partners) */}
                {hasPartners && (
                  <div className="pt-2 border-t border-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-2">Horas por Sócio</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {Object.entries(partnerTotals).map(([key, pt], idx) => (
                        <div key={idx} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/50">
                          <div className="text-[9px] font-semibold text-slate-400 uppercase mb-1 truncate">{pt.partnerName}</div>
                          <div className="text-sm font-black text-orange-400 mb-0.5">{decimalToHHMM(pt.hours)}</div>
                          <div className="text-[8px] text-slate-500">{pt.voos} voo{pt.voos > 1 ? 's' : ''}</div>
                          {logbookMonth?.has_daily_rate && pt.dailyRates > 0 && (
                            <div className="text-[8px] text-yellow-400 font-semibold mt-1">R${(pt.dailyRates).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Horas por cliente (apenas quando não houver partners) */}
                {!hasPartners && (
                  <div className="pt-2 border-t border-slate-800/50">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                      {Object.values(clientTotals).map((ct, idx) => (
                        <span key={idx}>
                          <span className="text-cyan-400 font-semibold">{ct.name.split(' ')[0]}</span>
                          {' '}{decimalToHHMM(ct.hours)}h
                          {logbookMonth?.has_daily_rate && ct.dailyRates > 0 && (
                            <span className="text-yellow-400"> • R${(ct.dailyRates).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          )}
                        </span>
                      ))}
                      {splitHours > 0 && (
                        <span>
                          <span className="text-emerald-400 font-semibold">Traslado/Rateio</span>
                          {' '}{decimalToHHMM(splitHours)}h
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* MODAL DE EDIÇÃO DE LANÇAMENTO */}
        {editingEntry && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 text-white max-w-4xl w-full rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black uppercase tracking-tight">Editar Lançamento</h2>
              <button onClick={handleCancelEdit} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              {/* SEÇÃO 1: DATA E TRIPULAÇÃO */}
              <div className="space-y-6 bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-blue-500 mb-4">
                  <Calendar size={18} />
                  <span className="text-sm font-black uppercase tracking-widest">1. Data e Tripulação</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Data *</Label>
                    <Input type="date" value={editingEntry.entry_date ?? ''} onChange={e => setEditingEntry({
                      ...editingEntry,
                      entry_date: e.target.value
                    })} className="bg-slate-900 border border-slate-700 text-white h-10" />
                  </div>

                  <div className="flex items-center gap-3 pt-2 pb-4 border-b border-slate-700">
                    <input
                      type="checkbox"
                      id="split-toggle-edit"
                      checked={editingEntry.is_equal_split}
                      onChange={e => setEditingEntry({
                        ...editingEntry,
                        is_equal_split: e.target.checked,
                        client_id: e.target.checked ? '' : editingEntry.client_id
                      })}
                      className="w-5 h-5 rounded cursor-pointer accent-emerald-500"
                    />
                    <Label htmlFor="split-toggle-edit" className="text-sm uppercase text-slate-300 cursor-pointer font-semibold">
                      Rateio Igual (Sócios)
                    </Label>
                  </div>

                  {editingEntry.is_equal_split ? (
                    <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-4 space-y-3">
                      <p className="text-xs text-emerald-400 uppercase font-bold tracking-widest">
                        Tipo de Voo para Rateio
                      </p>
                      <Select value={editingEntry.flight_nature} onValueChange={v => setEditingEntry({
                        ...editingEntry,
                        flight_nature: v
                      })}>
                        <SelectTrigger className="bg-slate-900 border border-emerald-500/50 text-emerald-300 h-10">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {SPLIT_FLIGHT_TYPES.map(type => (
                            <SelectItem key={type.code} value={type.code}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Cliente *</Label>
                      <Select value={editingEntry.client_id} onValueChange={v => setEditingEntry({
                        ...editingEntry,
                        client_id: v
                      })}>
                        <SelectTrigger className="bg-slate-900 border border-slate-700 text-white h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">PIC *</Label>
                    <Popover open={picEditOpen} onOpenChange={setPicEditOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between h-11 font-normal bg-slate-900 border-slate-700 text-white hover:bg-slate-800"
                        >
                          {editingEntry.pic_canac
                            ? (() => {
                              const pic = crew.find(c => c.id === editingEntry.pic_canac);
                              return pic ? `${pic.full_name} (${pic.canac})` : 'Selecione o PIC...';
                            })()
                            : 'Selecione o PIC...'
                          }
                          <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0 bg-slate-900 border-slate-700" align="start">
                        <Command className="bg-slate-900">
                          <CommandInput
                            placeholder="Buscar piloto por nome ou CANAC..."
                            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                          />
                          <CommandList>
                            <CommandEmpty>Nenhum piloto encontrado.</CommandEmpty>
                            <CommandGroup>
                              {crew.map((pilot) => (
                                <CommandItem
                                  key={pilot.id}
                                  value={`${pilot.full_name} ${pilot.canac}`}
                                  onSelect={() => {
                                    setEditingEntry({
                                      ...editingEntry,
                                      pic_canac: pilot.id
                                    });
                                    setPicEditOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      editingEntry.pic_canac === pilot.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col gap-0.5 flex-1">
                                    <span className="font-medium text-white">{pilot.full_name}</span>
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
                    value={editingEntry.sic_canac ?? ''}
                    sicName={editingEntry.sic_name ?? ''}
                    crew={crew}
                    onChange={(sicCanac, sicName) => setEditingEntry({
                      ...editingEntry,
                      sic_canac: sicCanac,  // deixar como null/undefined quando é manual
                      sic_name: sicName
                    })}
                    label="SIC (Opcional)"
                    placeholder="Selecione ou digite"
                  />
                </div>
              </div>

              {/* SEÇÃO 2: AERÓDROMOS */}
              <div className="space-y-6 bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-green-500 mb-4">
                  <Navigation size={18} />
                  <span className="text-sm font-black uppercase tracking-widest">2. Aeródromos</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Origem *</Label>
                    <Select value={editingEntry.departure_aerodrome} onValueChange={v => setEditingEntry({
                      ...editingEntry,
                      departure_aerodrome: v
                    })}>
                      <SelectTrigger className="bg-slate-900 border border-slate-700 text-white h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aerodromes.map(a => <SelectItem key={a.id} value={a.designativo}>{a.designativo} - {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Destino *</Label>
                    <Select value={editingEntry.arrival_aerodrome} onValueChange={v => setEditingEntry({
                      ...editingEntry,
                      arrival_aerodrome: v
                    })}>
                      <SelectTrigger className="bg-slate-900 border border-slate-700 text-white h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aerodromes.map(a => <SelectItem key={a.id} value={a.designativo}>{a.designativo} - {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: HORÁRIOS */}
              <div className="space-y-6 bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-cyan-500 mb-4">
                  <Clock size={18} />
                  <span className="text-sm font-black uppercase tracking-widest">3. Horários</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Acionamento *</Label>
                    <Input type="time" step="60" value={editingEntry.ac_time ?? ''} onChange={e => setEditingEntry({
                      ...editingEntry,
                      ac_time: e.target.value
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-900 border border-slate-700 text-white h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Corte *</Label>
                    <Input type="time" step="60" value={editingEntry.cor_time ?? ''} onChange={e => setEditingEntry({
                      ...editingEntry,
                      cor_time: e.target.value
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-900 border border-slate-700 text-white h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Decolagem</Label>
                    <Input type="time" step="60" value={editingEntry.dep_time ?? ''} onChange={e => setEditingEntry({
                      ...editingEntry,
                      dep_time: e.target.value
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-900 border border-slate-700 text-white h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Pouso</Label>
                    <Input type="time" step="60" value={editingEntry.pou_time ?? ''} onChange={e => setEditingEntry({
                      ...editingEntry,
                      pou_time: e.target.value
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-900 border border-slate-700 text-white h-10" />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 4: COMBUSTÍVEL */}
              <div className="space-y-6 bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-orange-500 mb-4">
                  <Fuel size={18} />
                  <span className="text-sm font-black uppercase tracking-widest">4. Combustível</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Combustível Inicial (L)</Label>
                    <Input type="number" step="0.1" value={editingEntry.fuel_liters ?? 0} onChange={e => setEditingEntry({
                      ...editingEntry,
                      fuel_liters: parseFloat(e.target.value) || 0
                    })} className="bg-slate-900 border border-slate-700 text-orange-400 h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Combustível Consumido (L)</Label>
                    <Input type="number" step="0.1" value={editingEntry.fuel_consu ?? 0} onChange={e => setEditingEntry({
                      ...editingEntry,
                      fuel_consu: parseFloat(e.target.value) || 0
                    })} className="bg-slate-900 border border-slate-700 text-orange-300 h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Preço/L (R$)</Label>
                    <Input type="number" step="0.01" value={editingEntry.fuel_price_per_liter ?? 0} onChange={e => setEditingEntry({
                      ...editingEntry,
                      fuel_price_per_liter: parseFloat(e.target.value) || 0
                    })} className="bg-slate-900 border border-slate-700 text-orange-400 h-10" />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 5: TEMPOS */}
              <div className="space-y-6 bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-purple-500 mb-4">
                  <TrendingUp size={18} />
                  <span className="text-sm font-black uppercase tracking-widest">5. Tempos</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Tempo Diurno</Label>
                    <Input type="time" step="60" value={decimalToTimeString(editingEntry.day_time)} onChange={e => setEditingEntry({
                      ...editingEntry,
                      day_time: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-900 border border-slate-700 text-emerald-400 h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Tempo Noturno</Label>
                    <Input type="time" step="60" value={decimalToTimeString(editingEntry.night_hours)} onChange={e => setEditingEntry({
                      ...editingEntry,
                      night_hours: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-900 border border-slate-700 text-sky-400 h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">IFR</Label>
                    <Input type="time" step="60" value={decimalToTimeString(editingEntry.ifr_time)} onChange={e => setEditingEntry({
                      ...editingEntry,
                      ifr_time: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-900 border border-slate-700 text-white h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Pousos</Label>
                    <Input type="number" value={editingEntry.pousos ?? 1} onChange={e => setEditingEntry({
                      ...editingEntry,
                      pousos: parseInt(e.target.value) || 1
                    })} className="bg-slate-900 border border-slate-700 text-white h-10" />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 6: PERFORMANCE & CÉLULA */}
              <div className="space-y-6 bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
                <div className="flex items-center gap-2 text-pink-500 mb-4">
                  <Fuel size={18} />
                  <span className="text-sm font-black uppercase tracking-widest">6. Performance & Célula</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">POB (Pessoas)</Label>
                    <Input type="number" value={editingEntry.passengers ?? 0} onChange={e => setEditingEntry({
                      ...editingEntry,
                      passengers: parseInt(e.target.value) || 0
                    })} className="bg-slate-900 border border-slate-700 text-sky-400 h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Carga (kg)</Label>
                    <Input type="number" step="0.1" value={editingEntry.cargo_kg ?? 0} onChange={e => setEditingEntry({
                      ...editingEntry,
                      cargo_kg: parseFloat(e.target.value) || 0
                    })} className="bg-slate-900 border border-slate-700 text-emerald-400 h-10" />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 7: DIÁRIAS */}
              {logbookMonth?.has_daily_rate && (
                <div className="space-y-6 bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
                  <div className="flex items-center gap-2 text-amber-500 mb-4">
                    <DollarSign size={18} />
                    <span className="text-sm font-black uppercase tracking-widest">7. Diárias</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Quantidade de Diárias</Label>
                      <Input type="number" step="0.1" value={editingEntry.daily_quantity ?? 0} onChange={e => setEditingEntry({
                        ...editingEntry,
                        daily_quantity: parseFloat(e.target.value) || 0
                      })} className="bg-slate-900 border border-slate-700 text-amber-400 h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-slate-400 ml-1 block font-bold">Valor Unitário (R$)</Label>
                      <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 h-10 flex items-center text-amber-400 font-semibold">
                        R$ {logbookMonth?.daily_rate?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs uppercase text-slate-400 font-bold">Total de Diárias</span>
                      <span className="text-lg font-black text-amber-400">R$ {((editingEntry.daily_quantity || 0) * (logbookMonth?.daily_rate || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-800">
              <Button onClick={handleCancelEdit} className="flex-1 bg-slate-800 hover:bg-slate-700 h-12 font-black uppercase text-sm rounded-2xl">
                <X size={18} className="mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSaveFlightEntry} className="flex-1 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 h-12 font-black uppercase text-sm rounded-2xl shadow-xl">
                <Save size={18} className="mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </div>
        </div>}

        {/* MODAL DE EDIÇÃO DE INFORMAÇÕES TÉCNICAS */}
        {editingField && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 text-white max-w-sm w-full rounded-3xl p-6 shadow-2xl">
              <h2 className="text-xl font-black uppercase tracking-tight mb-6">Editar {editingField === 'base_aerodrome' ? 'Base Aeródromo' : editingField === 'horimetro_inicio' ? 'Horímetro Início' : editingField === 'horimetro_final' ? 'Horímetro Final' : editingField === 'horimetro_ativo' ? 'Horímetro Ativo' : editingField === 'daily_rate' ? 'Valor Diária' : editingField === 'celula_prox_revisao' ? 'Próxima Revisão' : editingField}</h2>

              <div className="space-y-4">
                <div>
                  <Label className="text-[9px] uppercase text-slate-500 ml-1 block mb-2">Novo Valor *</Label>
                  <Input
                    type={['horimetro_inicio', 'horimetro_final', 'horimetro_ativo', 'daily_rate', 'celula_prox_revisao'].includes(editingField) ? 'number' : 'text'}
                    step={['horimetro_inicio', 'horimetro_final', 'horimetro_ativo', 'daily_rate', 'celula_prox_revisao'].includes(editingField) ? '0.1' : undefined}
                    value={editFieldValue}
                    onChange={(e) => setEditFieldValue(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white"
                    placeholder="Digite o novo valor"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <Button
                    onClick={() => {
                      setEditingField(null);
                      setEditFieldValue('');
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 h-10 font-black uppercase text-xs rounded-lg"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveField}
                    className="flex-1 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 h-10 font-black uppercase text-xs rounded-lg shadow-lg"
                  >
                    <Save size={14} className="mr-2" />
                    Salvar
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
                return <button key={m} onClick={() => {
                  setSelectedMonth(monthNum);
                  setShowMonthPicker(false);
                }} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${selectedMonth === monthNum ? 'bg-sky-600 text-white shadow-lg' : 'bg-slate-950 text-slate-500 hover:bg-slate-800'}`}>
                  {m.substring(0, 3)}
                </button>;
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 pt-6 px-4">
              <button onClick={() => setSelectedYear(y => y - 1)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                <ChevronLeft />
              </button>
              <span className="text-2xl font-black">{selectedYear}</span>
              <button onClick={() => setSelectedYear(y => y + 1)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                <ChevronRight />
              </button>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleOpenCreateNextMonthDialog}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 disabled:from-slate-700 disabled:to-slate-600 h-12 rounded-2xl font-bold uppercase text-xs transition-colors text-white shadow-lg"
              >
                {loading ? 'Criando...' : 'Criar Próximo Mês'}
              </button>
              <button
                onClick={() => setShowMonthPicker(false)}
                disabled={loading}
                className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 h-12 rounded-2xl font-bold uppercase text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>}
      </div>
    </div>
  </Layout>;
};
export default DiarioBordoDetalhes;
