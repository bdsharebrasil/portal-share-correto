import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Layout } from "../layout/Layout";
import { ArrowLeft, Plus, CheckCircle, Loader2, Save, X, Clock, Navigation, Users, Fuel, Calendar, Search, ChevronLeft, ChevronRight, Plane, Info, AlertCircle, TrendingUp, DollarSign, Edit, Trash2, MapPin, Download } from 'lucide-react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { updateCrewFlightHours } from '@/services/crewFlightHours';
import { fetchManutencaoRevisao, fetchManutencaoRevisaoAtiva, updateManutencaoHoras, ensureRevisionMaintenance } from '@/services/manutencoes';
import { MaintenanceStatusAlert } from './MaintenanceStatusAlert';
import { CreateMonthDialog } from './CreateMonthDialog';
import { CloseMonthDialog } from './CloseMonthDialog';
import { ExportLogbookDialog } from './ExportLogbookDialog';
import { useUserRole } from '@/hooks/useUserRole';

// ===================== CONSTANTES =====================
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const FLIGHT_NATURE = ["AE - Aérea/Regular", "CQ - Cheque", "EX - Executivo", "NR - Não Remunerado", "RE - Retorno/Reposição", "PV - Privado", "SA - Serviço Aéreo", "TN - Transporte Não Regular/Táxi Aéreo", "TR - Traslado"];

// Tipos especiais de voo para rateio (divisão igual de custos)
const SPLIT_FLIGHT_TYPES = [
  { code: 'CQ', label: 'CQ - Cheque (Voo de Verificação)', description: 'Rateio igual entre sócios' },
  { code: 'TR', label: 'TR - Traslado (Ferry/Posicionamento)', description: 'Rateio igual entre sócios' },
  { code: 'TN', label: 'TN - Teste (Manutenção/Teste)', description: 'Rateio igual entre sócios' }
];

// ===================== INTERFACES =====================
interface Entry {
  id: string;
  entry_date: string;
  departure_aerodrome: string;
  arrival_aerodrome: string;
  client_id?: string;
  partner_name?: string;
  is_equal_split: boolean;
  is_loan: boolean;
  total_time: number;
  pic_canac: string;
  sic_canac?: string;
  ac_time: string;
  dep_time: string;
  pou_time: string;
  cor_time: string;
  celula: number;
  fuel_added: number;
  fuel_liters: number;
  day_time: number;
  night_hours: number;
  ifr_time: number;
  pousos: number;
  time: number;
  distance_nm: number;
  passengers: number;
  cargo_kg: number;
  flight_nature: string;
  daily_rate?: number;
  daily_quantity?: number;
  created_at?: string;
  [key: string]: any;
}

interface LogbookMonth {
  id: string;
  month: number;
  year: number;
  aircraft_id: string;
  celula_anterior: number;
  celula_atual: number;
  celula_prox_revisao: number;
  celula_disponivel: number;
  base_aerodrome?: string;
  has_daily_rate: boolean;
  daily_rate?: number;
  horimetro_inicio?: number;
  horimetro_final?: number;
  horimetro_ativo?: number;
  fuel_consumption?: number;
  is_closed: boolean;
}

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  cell_hours_current: number;
  celula_prox_revisao: number;
  base?: string;
  fuel_consumption?: number;
}

// ===================== FUNÇÕES AUXILIARES =====================
const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTimeString = (minutes: number): string => {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 3440.065; // Raio da Terra em milhas náuticas
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateTimeDiff = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60;
  return parseFloat((diff / 60).toFixed(2));
};

const formatTimeFromTimestamp = (timestamp: string): string => {
  if (!timestamp) return '-';
  try {
    if (timestamp.includes('T')) {
      const date = new Date(timestamp);
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return timestamp.split(':').slice(0, 2).join(':');
  } catch {
    return timestamp;
  }
};

const formatDateFromISO = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
  } catch {
    return dateString;
  }
};

const decimalToHHMM = (decimal?: number | null): string => {
  if (!decimal || decimal === 0) return '-';
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const decimalToTimeString = (decimal: number): string => {
  if (!decimal || decimal === 0) return '00:00';
  const totalMinutes = Math.round(decimal * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const timeStringToDecimal = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return parseFloat(((h * 60 + m) / 60).toFixed(2));
};

const shortenClientName = (fullName?: string): string => {
  if (!fullName) return '-';
  const firstName = fullName.split(' ')[0];
  return firstName.substring(0, 5);
};

// ===================== EXPANDIR CLIENTES COM PARCEIROS =====================
const expandClientsWithPartners = (clients: any[]) => {
  const expanded: any[] = [];
  
  clients.forEach(client => {
    if (client.company_name) {
      expanded.push({
        id: client.id,
        label: client.company_name,
        type: 'company',
        clientId: client.id
      });
    }
    
    if (client.partner_name) {
      expanded.push({
        id: `${client.id}_partner1`,
        label: client.partner_name,
        type: 'partner',
        clientId: client.id,
        partnerName: client.partner_name
      });
    }
    if (client.partner_name2) {
      expanded.push({
        id: `${client.id}_partner2`,
        label: client.partner_name2,
        type: 'partner',
        clientId: client.id,
        partnerName: client.partner_name2
      });
    }
    if (client.partner_name3) {
      expanded.push({
        id: `${client.id}_partner3`,
        label: client.partner_name3,
        type: 'partner',
        clientId: client.id,
        partnerName: client.partner_name3
      });
    }
  });
  
  return expanded;
};

// ===================== CÁLCULO DE CUSTO COM RATEIO =====================
const calculateCostPerPartner = (
  totalCost: number,
  isEqualSplit: boolean,
  partnersCount: number
): number => {
  if (!isEqualSplit || partnersCount === 0) {
    return totalCost;
  }
  return parseFloat((totalCost / partnersCount).toFixed(2));
};

// Função para calcular tempos diurno/noturno automaticamente
const calculateTimes = (entry: any) => {
  if (!entry.dep_time || !entry.pou_time || entry.total_time <= 0) return entry;

  const flightStartMin = timeStringToMinutes(entry.dep_time);
  const flightEndMin = timeStringToMinutes(entry.pou_time);
  const sunriseMin = 360; // 06:00
  const sunsetMin = 1080; // 18:00

  let nightTimeMinutes = 0;
  const flightDurationMin = entry.total_time * 60;

  if (flightStartMin < sunriseMin || flightEndMin > sunsetMin) {
    if (flightStartMin < sunriseMin) {
      nightTimeMinutes += Math.min(sunriseMin - flightStartMin, flightDurationMin);
    }
    if (flightEndMin > sunsetMin) {
      nightTimeMinutes += Math.min(flightEndMin - sunsetMin, flightDurationMin - nightTimeMinutes);
    }
  }

  const nightHours = parseFloat((nightTimeMinutes / 60).toFixed(2));
  const dayHours = parseFloat((entry.total_time - nightHours).toFixed(2));

  return {
    ...entry,
    night_hours: nightHours,
    day_time: dayHours
  };
};

// ===================== CÁLCULO DE DIÁRIAS =====================
const calculateDailyAllowanceForEntry = (
  entry: Entry,
  baseAerodrome: string,
  allEntries: Entry[]
): number => {
  if (!baseAerodrome) return 0;

  const origin = entry.departure_aerodrome;
  const destination = entry.arrival_aerodrome;

  // REGRA PRINCIPAL: Voos com rateio entre sócios NÃO cobram diária
  if (entry.is_equal_split) {
    return 0;
  }

  // REGRA: Voos de empréstimo NÃO cobram diária
  if (entry.is_loan) {
    return 0;
  }

  // REGRA 1: Saiu da base → 0 diárias
  if (origin === baseAerodrome && destination !== baseAerodrome) {
    return 0;
  }

  // REGRA 2: Voltou para base → 1 diária
  if (destination === baseAerodrome && origin !== baseAerodrome) {
    return 1;
  }

  // REGRA 3: Continua fora da base
  if (origin !== baseAerodrome && destination !== baseAerodrome) {
    const sortedEntries = [...allEntries].sort(
      (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    const currentIndex = sortedEntries.findIndex(e =>
      e.id === entry.id ||
      (e.entry_date === entry.entry_date &&
        e.departure_aerodrome === entry.departure_aerodrome &&
        e.arrival_aerodrome === entry.arrival_aerodrome)
    );

    if (currentIndex === -1 || currentIndex === 0) {
      return 0;
    }

    const currentEntry = sortedEntries[currentIndex];
    const previousEntry = sortedEntries[currentIndex - 1];

    const currentDate = new Date(currentEntry.entry_date);
    const previousDate = new Date(previousEntry.entry_date);

    if (currentDate.toDateString() !== previousDate.toDateString()) {
      return 1;
    }

    return 0;
  }

  return 0;
};

// ===================== COMPONENTE PRINCIPAL =====================
interface DiarioBordoDetalhesProps {
  aircraftId: string;
  onBack: () => void;
}

const DiarioBordoDetalhes: React.FC<DiarioBordoDetalhesProps> = ({ aircraftId, onBack }) => {
  const { isAdmin, isGestorMaster, isPilotoChefe, isCoordenadorVoo, isTripulante } = useUserRole();

  // Estados de navegação e UI
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTechnicalStatus, setShowTechnicalStatus] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [availableMonths, setAvailableMonths] = useState<Array<{ month: number; year: number }>>([]);

  const canEditCelulaFields = isAdmin || isGestorMaster || isPilotoChefe;

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [crew, setCrew] = useState<any[]>([]);
  const [aerodromes, setAerodromes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [lastCelula, setLastCelula] = useState(0);
  const [logbookMonth, setLogbookMonth] = useState<LogbookMonth | null>(null);

  // Estado para diárias contabilizadas
  const [markedDailies, setMarkedDailies] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`marked-dailies-${aircraftId}-${selectedMonth}-${selectedYear}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Estados de edição
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Estados para redimensionamento de colunas
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
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editingMonthInfo, setEditingMonthInfo] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldValue, setEditFieldValue] = useState<string>('');
  const [creatingMonth, setCreatingMonth] = useState(false);
  const [showCreateMonthDialog, setShowCreateMonthDialog] = useState(false);
  const [showCloseMonthDialog, setShowCloseMonthDialog] = useState(false);
  const [previousMonthData, setPreviousMonthData] = useState<any>(null);

  // Estado para Banco de Horas
  const [loans, setLoans] = useState<any[]>([]);

  // Estado para Situação Técnica da Aeronave
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

  // Estado do Novo Voo
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
    borrower_client_id: '',
    partner_name: '',
    borrower_partner_name: '',
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

  // Estado para controlar mês/ano do próximo diário
  const [nextMonthTarget, setNextMonthTarget] = useState<{ month: number; year: number } | null>(null);

  // ===================== CÁLCULO DE DIÁRIAS =====================
  const calculatePerDiemInfo = useMemo(() => {
    if (!logbookMonth?.has_daily_rate || !logbookMonth?.base_aerodrome || !logbookMonth?.daily_rate) {
      return { count: 0, total: 0, details: [], byEntry: {} };
    }

    const baseAerodrome = logbookMonth.base_aerodrome;
    const dailyRate = logbookMonth.daily_rate;

    const periodEntries = entries
      .filter(e => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
      })
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

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

  // ===================== CARGA DE DADOS =====================
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [acRes, crewRes, aeroRes, clientRes, entriesRes, monthsRes, partnersRes] = await Promise.all([
          supabase.from('aircraft').select('*').eq('id', aircraftId).single(),
          supabase.from('crew_members').select('*'),
          supabase.from('aerodromes').select('*').order('designativo'),
          supabase.from('clients').select('id, company_name, cnpj, partner_name, partner_name2, partner_name3, client_aircraft(aircraft_id)').order('company_name'),
          supabase.from('logbook_entries').select('*').eq('aircraft_id', aircraftId).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('logbook_months').select('month, year').eq('aircraft_id', aircraftId).eq('is_closed', false).order('year', { ascending: false }).order('month', { ascending: false }),
          supabase.from('aircraft_partners').select('*, clients(id, company_name)').eq('aircraft_id', aircraftId)
        ]);

        if (acRes.data) {
          setAircraft(acRes.data);
          setLastCelula(acRes.data.cell_hours_current || 0);
        }
        if (crewRes.data) setCrew(crewRes.data || []);
        if (aeroRes.data) setAerodromes(aeroRes.data || []);
        if (clientRes.data) setClients(clientRes.data || []);
        if (entriesRes.data) setEntries(entriesRes.data || []);
        if (monthsRes.data) setAvailableMonths(monthsRes.data || []);
        if (partnersRes.data) setPartners(partnersRes.data || []);

        const loansRes = await supabase
          .from('aircraft_loans')
          .select(`
            *,
            lender_client:lender_client_id (
              id,
              company_name
            ),
            borrower_client:borrower_client_id (
              id,
              company_name
            ),
            logbook_entry:logbook_entry_id (
              id,
              entry_date,
              departure_aerodrome,
              arrival_aerodrome,
              fuel_liters,
              fuel_added
            )
          `)
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
        console.error("Erro ao carregar dados:", error);
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

  // ===================== AUTOMAÇÕES =====================

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
      const dep = aerodromes.find(a => a.designativo === newEntry.departure_aerodrome);
      const arr = aerodromes.find(a => a.designativo === newEntry.arrival_aerodrome);
      if (dep?.coordenadas && arr?.coordenadas) {
        try {
          const [lat1, lon1] = dep.coordenadas.split(',').map(Number);
          const [lat2, lon2] = arr.coordenadas.split(',').map(Number);
          const distance = calculateDistance(lat1, lon1, lat2, lon2);
          setNewEntry(prev => ({ ...prev, distance_nm: Math.round(distance) }));
        } catch (e) {
          console.error("Erro ao calcular distância:", e);
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
          const celulasExistentes = entries.map(e => Number(e.celula) || 0);
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
        console.error("Erro ao calcular tempos:", error);
      }
    }
  }, [newEntry.ac_time, newEntry.cor_time, newEntry.dep_time, newEntry.pou_time, lastCelula, entries]);

  // ===================== FILTROS E ORDENAÇÃO =====================
  const filteredEntries = useMemo(() => {
    let filtered = entries.filter(e => {
      const date = new Date(e.entry_date);
      const matchesPeriod = date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        e.departure_aerodrome?.toLowerCase().includes(searchLower) ||
        e.arrival_aerodrome?.toLowerCase().includes(searchLower) ||
        crew.find(c => c.id === e.pic_canac)?.full_name.toLowerCase().includes(searchLower);
      return matchesPeriod && matchesSearch;
    });

    filtered.sort((a, b) => {
      const dateA = new Date(a.entry_date).getTime();
      const dateB = new Date(b.entry_date).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [entries, selectedMonth, selectedYear, searchTerm, crew, sortDirection]);

  const sortedClients = useMemo(() => {
    if (!clients.length) return [];
    const linkedClients = clients.filter(c => c.client_aircraft?.some((ca: any) => ca.aircraft_id === aircraftId));
    const otherClients = clients.filter(c => !c.client_aircraft?.some((ca: any) => ca.aircraft_id === aircraftId));
    return [...linkedClients, ...otherClients];
  }, [clients, aircraftId]);

  // ===================== FUNÇÕES DE NAVEGAÇÃO =====================
  const isMonthAvailable = (month: number, year: number): boolean => {
    return availableMonths.some(m => m.month === month && m.year === year);
  };

  // ===================== CÁLCULO E ATUALIZAÇÃO DE CÉLULA =====================
  const updateCelulaAtual = async (entriesData?: Entry[]) => {
    if (!logbookMonth) return;

    try {
      const entriesToUse = entriesData || entries;

      const periodEntries = entriesToUse.filter(e => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth &&
          date.getUTCFullYear() === selectedYear;
      });

      const totalFlightTimeThisMonth = periodEntries.reduce((sum, e) => {
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
        console.error('Erro ao atualizar célula_atual:', error);
      } else {
        setLogbookMonth({
          ...logbookMonth,
          celula_atual: newCelulaAtual,
          celula_disponivel: newCelulaDisponivel
        });
        console.log(`✅ Célula_Atual atualizada: ${Number(newCelulaAtual).toFixed(2)} | Disponível: ${newCelulaDisponivel.toFixed(2)}`);

        await updateMaintenanceHours(newCelulaAtual);
      }
    } catch (error) {
      console.error('Erro ao recalcular célula:', error);
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

        console.log(`✅ Manutenção de revisão atualizada: ${horasFinais.toFixed(2)}h realizadas (limite: ${manutencao.vencimento_horas}h)`);
      }
    } catch (error) {
      console.error('Erro ao atualizar horas de manutenção:', error);
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
      console.error(`Erro ao atualizar ${field}:`, error);
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
      toast.error('Apenas admin, gestor master, piloto chefe e PIC podem editar célula anterior e próxima revisão');
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
      console.error("Erro ao preparar criação do próximo mês:", error);
      toast.error(error.message || "Erro ao preparar criação do próximo mês");
    }
  };

  // ===================== FUNÇÕES DE CRUD =====================

  const handleFormSuccess = async () => {
    const { data } = await supabase
      .from('logbook_entries')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false });
    setEntries(data || []);
  };

  const handleSaveFlight = async () => {
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
      if (!newEntry.borrower_client_id) {
        toast.error('Selecione o cliente que está pegando emprestado (quem está usando a aeronave)');
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
      const periodEntriesForCalc = entries.filter(e => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth &&
          date.getUTCFullYear() === selectedYear;
      });

      const tempEntry: Entry = {
        ...newEntry,
        id: `temp-${Date.now()}`,
        departure_aerodrome: newEntry.departure_aerodrome,
        arrival_aerodrome: newEntry.arrival_aerodrome,
        entry_date: newEntry.entry_date
      } as Entry;

      const allEntriesForCalc = [...periodEntriesForCalc, tempEntry];

      let dailyAllowance = 0;

      if (newEntry.daily_quantity > 0) {
        dailyAllowance = newEntry.daily_quantity * (logbookMonth.daily_rate || 0);
        console.log('📋 Diárias (Manual):', {
          quantidade: newEntry.daily_quantity,
          taxa_diaria: logbookMonth.daily_rate,
          total: dailyAllowance
        });
      } else {
        dailyAllowance = calculateDailyAllowanceForEntry(
          tempEntry,
          logbookMonth.base_aerodrome || '',
          allEntriesForCalc
        );
        console.log('🔍 DEBUG - Cálculo de Diárias (Automático):', {
          base: logbookMonth.base_aerodrome,
          origem: newEntry.departure_aerodrome,
          destino: newEntry.arrival_aerodrome,
          data: newEntry.entry_date,
          diarias_calculadas: dailyAllowance,
          total_voos_periodo: allEntriesForCalc.length
        });
      }

      const { error } = await supabase.from('logbook_entries').insert([{
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
        client_id: newEntry.is_equal_split
          ? null
          : (newEntry.is_loan ? newEntry.borrower_client_id : newEntry.client_id),
        partner_name: newEntry.is_equal_split 
          ? null 
          : (newEntry.is_loan 
              ? (newEntry.borrower_partner_name || null)
              : (newEntry.partner_name || null)),
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
        confirmed: false,
        daily_rate: dailyAllowance
      }]);

      if (error) throw error;

      const { data: insertedEntry } = await supabase
        .from('logbook_entries')
        .select('id')
        .eq('aircraft_id', aircraftId)
        .eq('entry_date', newEntry.entry_date)
        .eq('departure_aerodrome', newEntry.departure_aerodrome)
        .eq('arrival_aerodrome', newEntry.arrival_aerodrome)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (flightType === 'emprestimo' && insertedEntry?.id) {
        const { error: loanError } = await supabase.from('aircraft_loans').insert([
          {
            lender_aircraft_id: aircraftId,
            lender_client_id: newEntry.client_id,
            borrower_client_id: newEntry.borrower_client_id,
            hours_borrowed: newEntry.total_time,
            entry_date: newEntry.entry_date,
            logbook_entry_id: insertedEntry.id,
            status: 'active',
            notes: `Empréstimo registrado via diário de bordo - ${newEntry.departure_aerodrome} → ${newEntry.arrival_aerodrome}`,
          },
        ]);

        if (loanError) {
          console.error('Erro ao registrar empréstimo:', loanError);
        }

        const { error: transactionError } = await supabase.from('hour_transactions').insert([
          {
            aircraft_id: aircraftId,
            from_partner_id: newEntry.borrower_client_id,
            to_partner_id: newEntry.client_id,
            hours: newEntry.total_time,
            type: 'loan',
            description: `Empréstimo: ${newEntry.departure_aerodrome} → ${newEntry.arrival_aerodrome} - Cliente usou aeronave emprestada`,
            logbook_entry_id: insertedEntry.id,
          },
        ]);

        if (transactionError) {
          console.error('Erro ao registrar transação no banco de horas:', transactionError);
        }
      }

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

      toast.success(`Voo registrado! ${dailyAllowance > 0 ? `${dailyAllowance} diária(s)` : 'Sem diárias'}`);
      setLastCelula(newEntry.celula);

      const { data: updatedEntries } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (updatedEntries) {
        setEntries(updatedEntries);
        await updateCelulaAtual(updatedEntries);
      }

      setNewEntry({
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        pic_canac: '',
        sic_canac: '',
        sic_name: '',
        crew_checkin_time: '',
        departure_aerodrome: '',
        arrival_aerodrome: '',
        client_id: '',
        borrower_client_id: '',
        partner_name: '',
        borrower_partner_name: '',
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
      setShowAddForm(false);

      const { data } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      setEntries(data || []);
    } catch (error: any) {
      console.error("Erro ao salvar voo:", error);
      toast.error("Erro ao salvar voo: " + error.message);
    }
  };

  const handleEditEntry = (entry: Entry) => {
    setEditingEntry({ ...entry });
    setEditingEntryId(entry.id);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditingEntry(null);
  };

  const handleSaveEditedEntry = async () => {
    if (!editingEntry) return;

    if (!editingEntry.pic_canac || !editingEntry.departure_aerodrome || !editingEntry.arrival_aerodrome) {
      toast.error('Preencha todos os campos obrigatórios: PIC, Origem e Destino');
      return;
    }

    if (!editingEntry.is_equal_split && !editingEntry.is_loan && !editingEntry.client_id) {
      toast.error('Selecione um cliente para este voo ou marque como rateio/empréstimo');
      return;
    }

    if (editingEntry.is_loan && !editingEntry.client_id) {
      toast.error('Selecione o cotista que está emprestando a aeronave');
      return;
    }

    if (!editingEntry.ac_time || !editingEntry.cor_time) {
      toast.error('Preencha os horários de acionamento e corte');
      return;
    }

    try {
      const oldEntry = entries.find(e => e.id === editingEntryId);

      const periodEntriesForCalc = entries.filter(e => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth &&
          date.getUTCFullYear() === selectedYear;
      });

      const allEntriesForCalc = periodEntriesForCalc.map(e =>
        e.id === editingEntryId ? editingEntry : e
      );

      const recalculatedDailyRate = calculateDailyAllowanceForEntry(
        editingEntry,
        logbookMonth?.base_aerodrome || '',
        allEntriesForCalc
      );

      let finalDailyRate = recalculatedDailyRate;
      if (editingEntry.daily_quantity && editingEntry.daily_quantity > 0) {
        finalDailyRate = editingEntry.daily_quantity * (logbookMonth?.daily_rate || 0);
      }

      const { error } = await supabase.from('logbook_entries').update({
        entry_date: editingEntry.entry_date,
        departure_aerodrome: editingEntry.departure_aerodrome,
        arrival_aerodrome: editingEntry.arrival_aerodrome,
        crew_checkin_time: editingEntry.crew_checkin_time,
        ac_time: editingEntry.ac_time,
        dep_time: editingEntry.dep_time,
        pou_time: editingEntry.pou_time,
        cor_time: editingEntry.cor_time,
        pic_canac: editingEntry.pic_canac,
        sic_canac: editingEntry.sic_canac || null,
        sic_name: editingEntry.sic_name || null,
        client_id: editingEntry.is_equal_split ? null : editingEntry.client_id,
        partner_name: editingEntry.partner_name || null,
        is_equal_split: editingEntry.is_equal_split,
        is_loan: editingEntry.is_loan || false,
        total_time: editingEntry.total_time,
        time: editingEntry.time,
        day_time: editingEntry.day_time,
        night_hours: editingEntry.night_hours,
        ifr_time: editingEntry.ifr_time,
        pousos: editingEntry.pousos,
        fuel_added: editingEntry.fuel_added,
        fuel_liters: editingEntry.fuel_liters,
        fuel_type: editingEntry.fuel_type || null,
        fuel_location: editingEntry.fuel_location || null,
        fuel_price_per_liter: editingEntry.fuel_price_per_liter || null,
        refueled: editingEntry.refueled,
        celula: editingEntry.celula,
        distance_nm: editingEntry.distance_nm,
        passengers: editingEntry.passengers,
        cargo_kg: editingEntry.cargo_kg,
        flight_nature: editingEntry.flight_nature,
        daily_quantity: editingEntry.daily_quantity,
        daily_rate: finalDailyRate,
        occurrences: editingEntry.occurrences || null,
        discrepancies: editingEntry.discrepancies || null,
        corrective_actions: editingEntry.corrective_actions || null
      }).eq('id', editingEntryId);

      if (error) throw error;

      if (oldEntry) {
        const oldDate = new Date(oldEntry.entry_date);
        const newDate = new Date(editingEntry.entry_date);

        const crewChanged = oldEntry.pic_canac !== editingEntry.pic_canac ||
                           oldEntry.sic_canac !== editingEntry.sic_canac;
        const dateChanged = oldDate.getMonth() !== newDate.getMonth() ||
                           oldDate.getFullYear() !== newDate.getFullYear();
        const hoursChanged = oldEntry.total_time !== editingEntry.total_time ||
                            oldEntry.ifr_time !== editingEntry.ifr_time ||
                            oldEntry.night_hours !== editingEntry.night_hours;

        if (crewChanged || dateChanged || hoursChanged) {
          if (oldEntry) {
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
          }

          await updateCrewFlightHours({
            picId: editingEntry.pic_canac,
            sicId: editingEntry.sic_canac || null,
            aircraftId,
            month: newDate.getMonth() + 1,
            year: newDate.getFullYear(),
            totalTime: editingEntry.total_time,
            ifrTime: editingEntry.ifr_time || 0,
            nightHours: editingEntry.night_hours || 0,
            flightDay: editingEntry.entry_date,
            operation: 'add'
          });
        }
      }

      toast.success("Voo atualizado com sucesso!");
      handleCancelEdit();
      const { data } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) {
        setEntries(data);
        await updateCelulaAtual(data);
      }
    } catch (error: any) {
      console.error("Erro ao atualizar voo:", error);
      toast.error("Erro ao atualizar voo: " + error.message);
    }
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
          console.error('Erro ao deletar aircraft_loans:', loansError);
        }

        const { error: transError } = await supabase
          .from('hour_transactions')
          .delete()
          .eq('logbook_entry_id', id);

        if (transError) {
          console.error('Erro ao deletar hour_transactions:', transError);
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
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) {
        setEntries(data);
        await updateCelulaAtual(data);
      }
    } catch (error: any) {
      console.error("Erro ao deletar lançamento:", error);
      toast.error("Erro ao deletar lançamento: " + error.message);
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
      console.error("Erro ao buscar dados do mês anterior:", error);
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
        console.error('Erro ao verificar diários existentes:', checkError);
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
            console.log("✅ Manutenção de revisão criada/atualizada automaticamente");
          } catch (maintenanceError) {
            console.error("Erro ao criar manutenção automática:", maintenanceError);
          }
        }

        toast.success(`Diário de ${MONTHS[targetMonth - 1]}/${targetYear} criado com sucesso!`);
        
        setAvailableMonths(prev => [...prev, { month: targetMonth, year: targetYear }]);
      }
    } catch (error: any) {
      console.error("Erro ao criar mês:", error);
      toast.error("Erro ao criar diário do mês: " + error.message);
      throw error;
    } finally {
      setCreatingMonth(false);
    }
  };

  // ===================== RENDERS CONDICIONAIS =====================
  if (loading) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center bg-[#070910]">
          <Loader2 className="animate-spin text-sky-500" size={48} />
        </div>
      </Layout>
    );
  }

  if (!aircraft) {
    return (
      <Layout>
        <div className="h-screen flex items-center justify-center bg-[#070910] text-white">
          <div className="text-center">
            <Plane size={48} className="mx-auto mb-4 text-slate-500" />
            <p>Aeronave não encontrada</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-[#070910] via-[#0a0f1c] to-[#070910] text-white p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">Diário de Bordo</h1>
              <p className="text-slate-400">{aircraft.registration} - {aircraft.model}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
              className="border-slate-700 hover:bg-slate-800"
            >
              <Download size={16} className="mr-2" />
              Exportar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="border-sky-500 text-sky-500 hover:bg-sky-500/10"
            >
              <Plus size={16} className="mr-2" />
              Novo Voo
            </Button>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="mb-6 flex items-center justify-between bg-slate-900/50 rounded-lg p-4 border border-slate-800">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousMonth}
            disabled={!isMonthAvailable(selectedMonth - 1, selectedYear)}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ChevronLeft size={20} />
          </Button>

          <div className="text-center">
            <h2 className="text-xl font-semibold text-white">
              {MONTHS[selectedMonth - 1]} {selectedYear}
            </h2>
            {logbookMonth && (
              <div className="text-sm text-slate-400 mt-1">
                Célula: {logbookMonth.celula_atual?.toFixed(1) || '0.0'}h
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            disabled={!isMonthAvailable(selectedMonth + 1, selectedYear)}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ChevronRight size={20} />
          </Button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              type="text"
              placeholder="Buscar por aeródromo ou PIC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Entries Table */}
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/70">
                  <th className="p-3 text-left text-sm font-medium text-slate-300">Data</th>
                  <th className="p-3 text-left text-sm font-medium text-slate-300">De</th>
                  <th className="p-3 text-left text-sm font-medium text-slate-300">Para</th>
                  <th className="p-3 text-left text-sm font-medium text-slate-300">PIC</th>
                  <th className="p-3 text-left text-sm font-medium text-slate-300">Total</th>
                  <th className="p-3 text-left text-sm font-medium text-slate-300">Célula</th>
                  <th className="p-3 text-left text-sm font-medium text-slate-300">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum voo registrado neste período
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="p-3 text-sm text-white">
                        {formatDateFromISO(entry.entry_date)}
                      </td>
                      <td className="p-3 text-sm text-white">{entry.departure_aerodrome}</td>
                      <td className="p-3 text-sm text-white">{entry.arrival_aerodrome}</td>
                      <td className="p-3 text-sm text-white">
                        {crew.find(c => c.id === entry.pic_canac)?.full_name || '-'}
                      </td>
                      <td className="p-3 text-sm text-white">
                        {decimalToHHMM(entry.total_time)}
                      </td>
                      <td className="p-3 text-sm text-white">
                        {entry.celula?.toFixed(1) || '-'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditEntry(entry)}
                            className="text-slate-400 hover:text-sky-500 hover:bg-sky-500/10"
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dialogs */}
        {showCreateMonthDialog && (
          <CreateMonthDialog
            open={showCreateMonthDialog}
            onOpenChange={setShowCreateMonthDialog}
            aircraftId={aircraftId}
            previousMonthData={previousMonthData}
            onSuccess={handleCreateMonthWithData}
          />
        )}

        {showExportDialog && (
          <ExportLogbookDialog
            open={showExportDialog}
            onOpenChange={setShowExportDialog}
            aircraftId={aircraftId}
            month={selectedMonth}
            year={selectedYear}
          />
        )}
      </div>
    </Layout>
  );
};

export default DiarioBordoDetalhes;
