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
/**
 * Expande cada cliente em múltiplas opções (company + parceiros)
 * Retorna array com id, label e tipo (company ou partner)
 */
const expandClientsWithPartners = (clients: any[]) => {
  const expanded: any[] = [];
  
  clients.forEach(client => {
    // Adicionar company_name como opção principal
    if (client.company_name) {
      expanded.push({
        id: client.id,
        label: client.company_name,
        type: 'company',
        clientId: client.id
      });
    }
    
    // Adicionar parceiros como opções
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
  entry: any,
  baseAerodrome: string,
  allEntries: any[]
): number => {
  if (!baseAerodrome) return 0;

  const origin = entry.departure_aerodrome;
  const destination = entry.arrival_aerodrome;

  // REGRA PRINCIPAL: Voos com rateio entre sócios NÃO cobram diária
  // Quando é_rateio_igual (is_equal_split), não há cobrança de diária independente do tipo de voo
  if (entry.is_equal_split) {
    return 0; // Sem cobrança de diária quando é rateio entre sócios
  }

  // REGRA: Voos de empréstimo NÃO cobram diária
  if (entry.is_loan) {
    return 0; // Sem cobrança de diária quando é empréstimo
  }

  // REGRA 1: Saiu da base → 0 diárias
  if (origin === baseAerodrome && destination !== baseAerodrome) {
    return 0;
  }

  // REGRA 2: Voltou para base → 1 diária
  if (destination === baseAerodrome && origin !== baseAerodrome) {
    return 1;
  }

  // REGRA 3: Continua fora da base (nem origem nem destino é a base)
  if (origin !== baseAerodrome && destination !== baseAerodrome) {
    // Ordenar entradas por data
    const sortedEntries = [...allEntries].sort(
      (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
    );

    // Encontrar este voo na lista por ID ou por data+origem+destino
    const currentIndex = sortedEntries.findIndex(e =>
      e.id === entry.id ||
      (e.entry_date === entry.entry_date &&
        e.departure_aerodrome === entry.departure_aerodrome &&
        e.arrival_aerodrome === entry.arrival_aerodrome)
    );

    if (currentIndex === -1 || currentIndex === 0) {
      // Se não encontrou ou é o primeiro voo, não conta
      return 0;
    }

    // Verificar se o voo anterior foi no mesmo dia
    const currentEntry = sortedEntries[currentIndex];
    const previousEntry = sortedEntries[currentIndex - 1];

    const currentDate = new Date(currentEntry.entry_date);
    const previousDate = new Date(previousEntry.entry_date);

    // Se é um dia diferente do anterior, conta 1 diária
    if (currentDate.toDateString() !== previousDate.toDateString()) {
      return 1;
    }

    return 0;
  }

  // REGRA 4: Origem e destino são a base → 0 diárias
  return 0;
};

// ===================== COMPONENTE PRINCIPAL =====================
const DiarioBordoDetalhes = ({ aircraftId, onBack }) => {
  // Verificar permissões do usuário
  const { isAdmin, isGestorMaster, isPilotoChefe } = useUserRole();

  // Estados de navegação e UI (declarados primeiro para uso no useEffect)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHoursBank, setShowHoursBank] = useState(false);
  const [showTechnicalStatus, setShowTechnicalStatus] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [availableMonths, setAvailableMonths] = useState<Array<{ month: number; year: number }>>([]);

  const canEditCelulaFields = isAdmin || isGestorMaster || isPilotoChefe;

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [crew, setCrew] = useState([]);
  const [aerodromes, setAerodromes] = useState([]);
  const [clients, setClients] = useState([]);
  const [partners, setPartners] = useState([]);
  const [aircraft, setAircraft] = useState(null);
  const [lastCelula, setLastCelula] = useState(0);
  const [logbookMonth, setLogbookMonth] = useState(null);

  // Estado para diárias contabilizadas (key: entryId_date, value: boolean)
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
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editingMonthInfo, setEditingMonthInfo] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldValue, setEditFieldValue] = useState<string>('');
  const [creatingMonth, setCreatingMonth] = useState(false);
  const [showCreateMonthDialog, setShowCreateMonthDialog] = useState(false);
  const [showCloseMonthDialog, setShowCloseMonthDialog] = useState(false);
  const [previousMonthData, setPreviousMonthData] = useState<any>(null);

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
  const [flightType, setFlightType] = useState<'cliente' | 'rateio' | 'emprestimo'>('cliente'); // Novo: tipo de voo
  const [newEntry, setNewEntry] = useState({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    pic_canac: '',
    sic_canac: '',
    sic_name: '',
    crew_checkin_time: '',
    departure_aerodrome: '',
    arrival_aerodrome: '',
    client_id: '',
    partner_name: '',
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
    daily_quantity: 0 // Novo: quantidade de diárias para este voo
  });

  // ===================== CÁLCULO DE DIÁRIAS =====================
  const calculatePerDiemInfo = useMemo(() => {
    // Se a aeronave não possui diária configurada, retorna vazio
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

      // IMPORTANTE: Voos com rateio entre sócios NÃO contam para diárias
      if (flight.is_equal_split) {
        byEntry[flight.id] = 0;
        continue; // Ignora este voo no cálculo de diárias
      }

      // Saiu da base
      if (!isAwayFromBase && origin === baseAerodrome && destination !== baseAerodrome) {
        isAwayFromBase = true;
        lastAwayDate = new Date(flightDate);
        byEntry[flight.id] = 0; // Dia de saída não conta
      }
      // Voltou para base
      else if (isAwayFromBase && destination === baseAerodrome) {
        if (lastAwayDate) {
          let currentDate = new Date(lastAwayDate);
          currentDate.setDate(currentDate.getDate() + 1); // Começa no dia seguinte

          // Conta os dias entre a saída e o retorno
          while (currentDate <= flightDate) {
            perDiems.push({
              date: currentDate.toLocaleDateString('pt-BR'),
              location: `Fora da Base (${baseAerodrome})`,
              entryId: flight.id
            });

            // Se é o último dia (dia do retorno), atribui a este voo
            if (currentDate.toDateString() === flightDate.toDateString()) {
              byEntry[flight.id] = (byEntry[flight.id] || 0) + 1;
            }

            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
        isAwayFromBase = false;
        lastAwayDate = null;
      }
      // Continua fora da base
      else if (isAwayFromBase && origin !== baseAerodrome && destination !== baseAerodrome) {
        if (lastAwayDate) {
          const lastDate = new Date(lastAwayDate);
          // Se é um novo dia, conta diária
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
      }
      // Não estava fora e não saiu (voos dentro da base)
      else {
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
        supabase.from('logbook_entries').select('*').eq('aircraft_id', aircraftId).order('entry_date', { ascending: false }),
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

        // Buscar logbook_months para o período selecionado
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
          // Buscar o último mês para obter a célula anterior, mas NÃO criar automaticamente
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

          // Não criar automaticamente - deixar vazio para o usuário criar manualmente
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

  // Ajustar o mês selecionado se não estiver disponível
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
  }, [availableMonths]);

  // Sincronizar diárias marcadas com localStorage
  useEffect(() => {
    localStorage.setItem(`marked-dailies-${aircraftId}-${selectedMonth}-${selectedYear}`, JSON.stringify(markedDailies));
  }, [markedDailies, aircraftId, selectedMonth, selectedYear]);

  // ===================== AUTOMAÇÕES =====================

  // AUTOMAÇÃO 1: Apresentação = Acionamento - 30 min
  useEffect(() => {
    if (newEntry.ac_time) {
      const acMin = timeStringToMinutes(newEntry.ac_time);
      const checkinMin = acMin - 30;
      const finalMin = checkinMin < 0 ? checkinMin + 1440 : checkinMin;
      const checkinTime = minutesToTimeString(finalMin);
      setNewEntry(prev => ({ ...prev, crew_checkin_time: checkinTime }));
    }
  }, [newEntry.ac_time]);

  // AUTOMAÇÃO 2: Origem = Último Destino
  useEffect(() => {
    if (showAddForm && entries.length > 0) {
      const lastEntry = entries[0];
      if (lastEntry.arrival_aerodrome && !newEntry.departure_aerodrome) {
        setNewEntry(prev => ({ ...prev, departure_aerodrome: lastEntry.arrival_aerodrome }));
      }
    }
  }, [showAddForm, entries]);

  // AUTOMAÇÃO 3: Resetar data quando mês/ano muda
  useEffect(() => {
    const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const isoDate = format(firstDayOfMonth, 'yyyy-MM-dd');
    setNewEntry(prev => ({ ...prev, entry_date: isoDate }));
  }, [selectedMonth, selectedYear]);

  // AUTOMAÇÃO 3.5: Recalcular célula_atual sempre que entries mudam
  // Isso garante que o card sempre mostra o valor correto dos voos lançados
  useEffect(() => {
    if (entries.length > 0 && logbookMonth) {
      updateCelulaAtual(entries);
    }
  }, [entries, logbookMonth?.id]);

  // AUTOMAÇÃO 4: Cálculo automático de distância
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

  // AUTOMAÇÃO 5: Cálculo consolidado de todos os tempos
  useEffect(() => {
    if (newEntry.ac_time?.trim() && newEntry.cor_time?.trim()) {
      try {
        // 1. Calcular tempo total (AC até COR)
        const totalTime = calculateTimeDiff(newEntry.ac_time, newEntry.cor_time);

        // 2. Calcular tempo de voo (DEP até POU)
        let flightTime = 0;
        if (newEntry.dep_time?.trim() && newEntry.pou_time?.trim()) {
          flightTime = calculateTimeDiff(newEntry.dep_time, newEntry.pou_time);
        }

        // 3. Lógica de Acúmulo de Célula (CASCATA)
        // Passo A: Começamos com a célula inicial do mês/aeronave (vindo do banco)
        let baseParaCalculo = lastCelula;

        // Passo B: Verificamos se já existem voos lançados na lista carregada (entries)
        if (entries && entries.length > 0) {
          // Extraímos todas as células dos voos existentes
          const celulasExistentes = entries.map(e => Number(e.celula) || 0);

          // Pegamos o MAIOR valor encontrado.
          // Isso garante que estamos somando sobre o último voo realizado,
          // criando o efeito "cascata" de saldo acumulado.
          const ultimaCelulaRegistrada = Math.max(...celulasExistentes);

          // Se o último voo registrado for maior que o saldo inicial, usamos ele como base
          if (ultimaCelulaRegistrada > baseParaCalculo) {
            baseParaCalculo = ultimaCelulaRegistrada;
          }
        }

        // Passo C: Somamos a base + o tempo do voo atual
        // toFixed(1) garante o formato "3227.1"
        const newCelula = parseFloat((baseParaCalculo + totalTime).toFixed(1));

        // 4. Calcular tempos diurno/noturno automaticamente
        const calculated = calculateTimes({
          ...newEntry,
          total_time: totalTime,
          time: flightTime,
          dep_time: newEntry.dep_time,
          pou_time: newEntry.pou_time
        });

        // 5. Atualizar tudo de uma vez (evita loops)
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
  }, [newEntry.ac_time, newEntry.cor_time, newEntry.dep_time, newEntry.pou_time, lastCelula]);

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

  // Ordenar clientes: vinculados à aeronave primeiro
  const sortedClients = useMemo(() => {
    if (!clients.length) return [];
    const linkedClients = clients.filter(c => c.client_aircraft?.some(ca => ca.aircraft_id === aircraftId));
    const otherClients = clients.filter(c => !c.client_aircraft?.some(ca => ca.aircraft_id === aircraftId));
    return [...linkedClients, ...otherClients];
  }, [clients, aircraftId]);

  // ===================== FUNÇÕES DE NAVEGAÇÃO =====================
  const isMonthAvailable = (month: number, year: number): boolean => {
    return availableMonths.some(m => m.month === month && m.year === year);
  };

  // ===================== CÁLCULO E ATUALIZAÇÃO DE CÉLULA =====================
  // Calcula e atualiza a célula_atual do mês (célula_anterior + soma dos tempos de voo do mês)
  const updateCelulaAtual = async (entriesData?: any[]) => {
    if (!logbookMonth) return;

    try {
      // Usar entries passadas ou as do state
      const entriesToUse = entriesData || entries;

      // Buscar todos os voos do mês
      const periodEntries = entriesToUse.filter(e => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth &&
          date.getUTCFullYear() === selectedYear;
      });

      // Calcular o tempo total de voo do mês
      // Cada voo tem total_time que é o tempo de voo em horas decimais
      const totalFlightTimeThisMonth = periodEntries.reduce((sum, e) => {
        const flightTime = Number(e.total_time) || 0;
        return sum + flightTime;
      }, 0);

      // A célula_atual é a célula anterior + tempo total de voos do mês
      const newCelulaAtual = parseFloat(((logbookMonth.celula_anterior ?? 0) + totalFlightTimeThisMonth).toFixed(2));

      // Calcular célula_disponível (próxima revisão - célula atual)
      const newCelulaDisponivel = parseFloat(((logbookMonth.celula_prox_revisao ?? 0) - newCelulaAtual).toFixed(2));

      // Atualizar no Supabase
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
        // Atualizar estado local
        setLogbookMonth({
          ...logbookMonth,
          celula_atual: newCelulaAtual,
          celula_disponivel: newCelulaDisponivel
        });
        console.log(`✅ Célula_Atual atualizada: ${Number(newCelulaAtual).toFixed(2)} | Disponível: ${newCelulaDisponivel.toFixed(2)}`);

        // Atualizar horas de manutenção
        await updateMaintenanceHours(newCelulaAtual);
      }
    } catch (error) {
      console.error('Erro ao recalcular célula:', error);
    }
  };

  // Atualiza as horas_realizadas na manutenção de revisão
  const updateMaintenanceHours = async (celulaAtual: number) => {
    try {
      // Primeiro tentar buscar manutenção ativa (não concluída)
      let manutencao = await fetchManutencaoRevisaoAtiva(aircraftId);

      // Se não encontrar, tentar buscar por período específico
      if (!manutencao) {
        manutencao = await fetchManutencaoRevisao(aircraftId, selectedMonth, selectedYear);
      }

      if (manutencao && manutencao.id) {
        // Calcular horas realizadas desde a célula anterior
        // A célula_anterior é o ponto de partida para contabilizar horas da manutenção
        const horasRealizadas = celulaAtual - (logbookMonth?.celula_anterior ?? 0);

        // Garantir que o valor não seja negativo
        const horasFinais = Math.max(0, horasRealizadas);

        await updateManutencaoHoras(manutencao.id, horasFinais);

        console.log(`✅ Manutenção de revisão atualizada: ${horasFinais.toFixed(2)}h realizadas (limite: ${manutencao.vencimento_horas}h)`);
      }
    } catch (error) {
      console.error('Erro ao atualizar horas de manutenção:', error);
      // Não falha o fluxo se a manutenção não puder ser atualizada
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

      // Atualizar estado local
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

    // Verificar se o usuário tem permissão para editar este campo
    if ((editingField === 'celula_anterior' || editingField === 'celula_prox_revisao') && !canEditCelulaFields) {
      toast.error('Apenas admin, gestor master, piloto chefe e PIC podem editar célula anterior e próxima revisão');
      setEditingField(null);
      return;
    }

    // Converter para número se for um campo numérico
    const fieldsToConvertToNumber = ['horimetro_inicio', 'horimetro_final', 'horimetro_ativo', 'daily_rate', 'celula_prox_revisao', 'celula_anterior'];
    const valueToSave = fieldsToConvertToNumber.includes(editingField)
      ? parseFloat(editFieldValue)
      : editFieldValue;

    await saveLogbookMonthField(editingField, valueToSave);
    setEditFieldValue('');
  };

  // Estado para controlar mês/ano do próximo diário
  const [nextMonthTarget, setNextMonthTarget] = useState<{ month: number; year: number } | null>(null);

  // Abre o dialog para criar o PRÓXIMO mês (com dados herdados do mês atual)
  const handleOpenCreateNextMonthDialog = async () => {
    try {
      // Calcular o próximo mês
      let nextMonth = selectedMonth + 1;
      let nextYear = selectedYear;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }

      // Verificar se o mês já existe
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

      // Guardar o mês alvo para uso no dialog
      setNextMonthTarget({ month: nextMonth, year: nextYear });

      // Usar dados do mês atual como base
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

  // ===================== CALLBACK DE SUCESSO DO FORMULÁRIO =====================
  const handleFormSuccess = async () => {
    // Recarregar entries
    const { data } = await supabase
      .from('logbook_entries')
      .select('*')
      .eq('aircraft_id', aircraftId)
      .order('entry_date', { ascending: false });
    setEntries(data || []);
  };

  // SALVAR NOVO VOO (mantido para compatibilidade)
  const handleSaveFlight = async () => {
    // Validação básica obrigatória
    if (!newEntry.pic_canac || !newEntry.departure_aerodrome || !newEntry.arrival_aerodrome) {
      toast.error('Preencha todos os campos obrigatórios: PIC, Origem e Destino');
      return;
    }

    // Validação por tipo de voo
    if (flightType === 'cliente' && !newEntry.client_id) {
      toast.error('Selecione um cliente para este voo');
      return;
    }

    if (flightType === 'emprestimo') {
      if (!newEntry.client_id) {
        toast.error('Selecione o cotista que está emprestando a aeronave');
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
      // ====== INÍCIO DO CÁLCULO DE DIÁRIAS ======

      // 1. Buscar TODOS os voos do período (para cálculo correto)
      const periodEntriesForCalc = entries.filter(e => {
        const date = new Date(e.entry_date);
        return date.getUTCMonth() + 1 === selectedMonth &&
          date.getUTCFullYear() === selectedYear;
      });

      // 2. Criar entrada temporária com ID único
      const tempEntry = {
        ...newEntry,
        id: `temp-${Date.now()}`,
        departure_aerodrome: newEntry.departure_aerodrome,
        arrival_aerodrome: newEntry.arrival_aerodrome,
        entry_date: newEntry.entry_date
      };

      // 3. Adicionar à lista para cálculo
      const allEntriesForCalc = [...periodEntriesForCalc, tempEntry];

      // 4. Calcular diárias (automático ou manual)
      let dailyAllowance = 0;

      if (newEntry.daily_quantity > 0) {
        // Se o usuário informou manualmente, usar esse valor
        dailyAllowance = newEntry.daily_quantity * (logbookMonth.daily_rate || 0);
        console.log('📋 Diárias (Manual):', {
          quantidade: newEntry.daily_quantity,
          taxa_diaria: logbookMonth.daily_rate,
          total: dailyAllowance
        });
      } else {
        // Caso contrário, calcular automaticamente
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

      // ====== FIM DO CÁLCULO DE DIÁRIAS ======

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
        client_id: newEntry.is_equal_split ? null : (newEntry.is_loan ? newEntry.client_id : newEntry.client_id),
        partner_name: newEntry.is_equal_split ? null : (newEntry.partner_name || null),
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

      // Buscar o ID da entrada que foi inserida
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

      // Atualizar horas de voo da tripulação (PIC e SIC)
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

      // Recarregar entries para atualizar célula_atual
      const { data: updatedEntries } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('entry_date', { ascending: false });
      if (updatedEntries) {
        setEntries(updatedEntries);
        // Atualizar célula_atual do mês com os dados mais recentes
        await updateCelulaAtual(updatedEntries);
      }

      // Reset form
      setNewEntry({
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        pic_canac: '',
        sic_canac: '',
        sic_name: '',
        crew_checkin_time: '',
        departure_aerodrome: '',
        arrival_aerodrome: '',
        client_id: '',
        partner_name: '',
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

      // Recarregar entries
      const { data } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('entry_date', { ascending: false });
      setEntries(data || []);
    } catch (error) {
      console.error("Erro ao salvar voo:", error);
      toast.error("Erro ao salvar voo: " + error.message);
    }
  };

  // EDITAR ENTRADA
  const handleEditEntry = (entry: any) => {
    setEditingEntry({ ...entry });
    setEditingEntryId(entry.id);
  };

  const handleCancelEdit = () => {
    setEditingEntryId(null);
    setEditingEntry(null);
  };

  const handleSaveEditedEntry = async () => {
    if (!editingEntry.pic_canac || !editingEntry.departure_aerodrome || !editingEntry.arrival_aerodrome) {
      toast.error('Preencha todos os campos obrigatórios: PIC, Origem e Destino');
      return;
    }

    // Validação por tipo de voo
    if (!editingEntry.is_equal_split && !editingEntry.is_loan && !editingEntry.client_id) {
      toast.error('Selecione um cliente para este voo ou marque como rateio/empréstimo');
      return;
    }

    if (editingEntry.is_loan) {
      if (!editingEntry.client_id) {
        toast.error('Selecione o cotista que está emprestando a aeronave');
        return;
      }
    }

    if (!editingEntry.ac_time || !editingEntry.cor_time) {
      toast.error('Preencha os horários de acionamento e corte');
      return;
    }

    try {
      // Buscar dados antigos da entrada para recalcular horas corretamente
      const oldEntry = entries.find(e => e.id === editingEntryId);

      // Recalcular diária com a nova regra
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
        is_equal_split: editingEntry.is_equal_split,
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
        daily_rate: recalculatedDailyRate,
        occurrences: editingEntry.occurrences || null,
        discrepancies: editingEntry.discrepancies || null,
        corrective_actions: editingEntry.corrective_actions || null
      }).eq('id', editingEntryId);

      if (error) throw error;

      // Recalcular horas de voo da tripulação
      // Se houver mudanças em crew, datas ou valores de horas, atualizar crew_flight_hours
      if (oldEntry) {
        const oldDate = new Date(oldEntry.entry_date);
        const newDate = new Date(editingEntry.entry_date);

        // Se a data, PIC, SIC, total_time, ifr_time ou night_hours mudou, recalcular
        const crewChanged = oldEntry.pic_canac !== editingEntry.pic_canac ||
                           oldEntry.sic_canac !== editingEntry.sic_canac;
        const dateChanged = oldDate.getMonth() !== newDate.getMonth() ||
                           oldDate.getFullYear() !== newDate.getFullYear();
        const hoursChanged = oldEntry.total_time !== editingEntry.total_time ||
                            oldEntry.ifr_time !== editingEntry.ifr_time ||
                            oldEntry.night_hours !== editingEntry.night_hours;

        if (crewChanged || dateChanged || hoursChanged) {
          // Remover horas antigas
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

          // Adicionar horas novas
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
        .order('entry_date', { ascending: false });
      if (data) {
        setEntries(data);
        // Atualizar célula_atual do mês com os dados mais recentes
        await updateCelulaAtual(data);
      }
    } catch (error) {
      console.error("Erro ao atualizar voo:", error);
      toast.error("Erro ao atualizar voo: " + error.message);
    }
  };

  // DELETAR ENTRADA
  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este lançamento?')) {
      return;
    }

    try {
      // Buscar dados da entrada antes de deletar para poder remover as horas
      const { data: entryToDelete } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('id', id)
        .single();

      // Deletar a entrada
      const { error } = await supabase.from('logbook_entries').delete().eq('id', id);
      if (error) throw error;

      // Remover as horas de voo da tripulação
      if (entryToDelete) {
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
      }

      toast.success("Lançamento deletado com sucesso!");

      const { data } = await supabase
        .from('logbook_entries')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('entry_date', { ascending: false });
      if (data) {
        setEntries(data);
        // Atualizar célula_atual do mês com os dados mais recentes
        await updateCelulaAtual(data);
      }
    } catch (error) {
      console.error("Erro ao deletar lançamento:", error);
      toast.error("Erro ao deletar lançamento: " + error.message);
    }
  };

  // REDIMENSIONAMENTO DE COLUNAS
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

  // ABRIR DIALOG PARA CRIAR MÊS
  const handleOpenCreateMonthDialog = async () => {
    try {
      // Buscar o último mês para obter dados anteriores
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
        // Se não há mês anterior, usar dados da aeronave
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
      // Abrir dialog mesmo com erro
      setPreviousMonthData({
        celula_atual: aircraft?.cell_hours_current || 0,
        celula_prox_revisao: 0,
      });
      setShowCreateMonthDialog(true);
    }
  };

  // CRIAR MÊS COM DADOS DO FORMULÁRIO
  const handleCreateMonthWithData = async (monthData: any) => {
    try {
      setCreatingMonth(true);
      
      // Usa mês/ano do dialog (monthData pode ter mês/ano selecionado pelo usuário)
      const targetMonth = monthData.month || selectedMonth;
      const targetYear = monthData.year || selectedYear;

      const { data: newMonth, error } = await supabase
        .from('logbook_months')
        .insert([monthData])
        .select()
        .single();

      if (error) throw error;

      if (newMonth) {
        // Atualiza o mês selecionado para o mês criado
        setSelectedMonth(targetMonth);
        setSelectedYear(targetYear);
        setLogbookMonth(newMonth);

        // Criar/atualizar manutenção de revisão automaticamente se houver próxima revisão
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
        
        // Atualizar lista de meses disponíveis
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

            <button onClick={() => setShowHoursBank(!showHoursBank)} className="px-6 h-12 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-2xl text-purple-400 font-black uppercase text-xs transition-all">
              <TrendingUp className="inline mr-2" size={16} />
              Banco de Horas
            </button>

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
        {!showAddForm && !showHoursBank && <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
          <input placeholder="Pesquisar por ICAO de origem, destino ou piloto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 h-14 bg-slate-900/50 border border-slate-800 rounded-2xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-sky-500 focus:outline-none" />
        </div>}

        {/* BANCO DE HORAS */}
        {showHoursBank && <div className="bg-slate-900 border-2 border-purple-500/20 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Banco de Horas - Compartilhamento</h2>
            <button onClick={() => setShowHoursBank(false)} className="text-slate-500 hover:text-white">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(client => <div key={client.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-white">{client.company_name}</h3>
                <DollarSign className="text-purple-500" size={20} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Cota Mensal:</span>
                  <span className="text-white font-bold">50.0h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Utilizado:</span>
                  <span className="text-emerald-400 font-bold">12.5h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Banco (Acúmulo):</span>
                  <span className="text-sky-400 font-bold">+5.0h</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500" style={{
                    width: '25%'
                  }}></div>
                </div>
              </div>
            </div>)}
          </div>
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
                <Select value={newEntry.pic_canac} onValueChange={v => setNewEntry({
                  ...newEntry,
                  pic_canac: v
                })}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                    <SelectValue placeholder="Selecione o PIC" />
                  </SelectTrigger>
                  <SelectContent>
                    {crew.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.canac})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Copiloto (SIC)</Label>
                <Select value={newEntry.sic_canac || '__none__'} onValueChange={v => setNewEntry({
                  ...newEntry,
                  sic_canac: v === '__none__' ? '' : v
                })}>
                  <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                    <SelectValue placeholder="Opcional - Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum (SIC Opcional)</SelectItem>
                    {crew.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.canac})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                        setFlightType('cliente');
                        setNewEntry({...newEntry, is_equal_split: false, is_loan: false, client_id: ''});
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
                        setNewEntry({...newEntry, is_equal_split: true, is_loan: false, client_id: ''});
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
                        setNewEntry({...newEntry, is_equal_split: false, is_loan: true, flight_nature: 'PV - Privado'});
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
                        setNewEntry({
                          ...newEntry,
                          client_id: v,
                          partner_name: '' // Reset partner when client changes
                        });
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

                    {/* Seleção de Sócio/Partner */}
                    {(() => {
                      const selectedClient = clients.find(c => c.id === newEntry.client_id);
                      const partnerOptions = [];
                      if (selectedClient?.partner_name) partnerOptions.push(selectedClient.partner_name);
                      if (selectedClient?.partner_name2) partnerOptions.push(selectedClient.partner_name2);
                      if (selectedClient?.partner_name3) partnerOptions.push(selectedClient.partner_name3);
                      
                      if (partnerOptions.length > 0) {
                        return (
                          <div className="space-y-1 mt-2">
                            <Label className="text-[9px] uppercase text-amber-500 ml-1 block">Sócio Responsável pelo Voo</Label>
                            <Select value={newEntry.partner_name} onValueChange={v => setNewEntry({
                              ...newEntry,
                              partner_name: v
                            })}>
                              <SelectTrigger className="bg-slate-950 border-amber-500/30 text-amber-400">
                                <SelectValue placeholder="Selecione o Sócio" />
                              </SelectTrigger>
                              <SelectContent>
                                {partnerOptions.map((partner, idx) => (
                                  <SelectItem key={idx} value={partner}>
                                    {partner}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                    
                    {/* Cotista que empresta */}
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-amber-400 ml-1 block">Cotista que Empresta a Aeronave *</Label>
                      <Select value={newEntry.client_id} onValueChange={v => setNewEntry({
                        ...newEntry,
                        client_id: v
                      })}>
                        <SelectTrigger className="bg-slate-950 border-amber-500/30 text-amber-400">
                          <SelectValue placeholder="Selecione o cotista" />
                        </SelectTrigger>
                        <SelectContent>
                          {expandClientsWithPartners(
                            sortedClients.filter(cl => cl.client_aircraft?.some(ca => ca.aircraft_id === aircraftId))
                          ).map(option => (
                            <SelectItem key={option.id} value={option.clientId}>
                              {option.label} ✓
                            </SelectItem>
                          ))
                          }
                        </SelectContent>
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
                      {decimalToHHMM(newEntry.time)}
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

              <Button onClick={handleSaveFlight} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 h-14 font-black uppercase text-sm rounded-2xl">
                <Save size={18} className="mr-2" />
                Salvar Voo
              </Button>
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
                      className={`border rounded-lg p-3 transition-all cursor-pointer ${
                        isMarked
                          ? 'bg-sky-500/20 border-sky-500/50'
                          : 'bg-slate-950 border-yellow-500/30'
                      }`}
                      onClick={() => {
                        const newMarked = {...markedDailies};
                        newMarked[uniqueKey] = !isMarked;
                        setMarkedDailies(newMarked);
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isMarked}
                          onChange={() => {}}
                          className="w-4 h-4 mt-0.5 accent-sky-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[9px] uppercase font-bold mb-1 ${
                            isMarked ? 'text-sky-400' : 'text-yellow-500'
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
                } = await supabase.from('logbook_entries').select('*').eq('aircraft_id', aircraftId).order('entry_date', {
                  ascending: false
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
                console.error("Erro ao salvar situação técnica:", error);
                toast.error("Erro ao salvar: " + error.message);
              }
            }} className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 h-12 font-black uppercase text-sm rounded-2xl transition-all flex items-center justify-center shadow-xl">
              <Save size={18} className="mr-2" />
              Salvar Situação Técnica
            </button>
          </div>
        </div>}

        {/* BOTÃO NOVO LANÇAMENTO */}
        {!showHoursBank && <div className="mb-6 flex items-start justify-end px-[11px] bg-transparent">
          <button onClick={() => setShowAddForm(!showAddForm)} className={`${showAddForm ? 'bg-slate-700 text-slate-400' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/90'} rounded-2xl px-6 font-black uppercase text-xs h-12 shadow-lg transition-all border border-slate-700/50`}>
            {showAddForm ? <X className="mr-2 inline" size={16} /> : <Plus className="mr-2 inline" size={16} />}
            {showAddForm ? "Cancelar" : "Novo lançamento"}
          </button>
        </div>}

        {/* TABELA DE REGISTROS */}
        {!showHoursBank && <div className="bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl rounded">
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
                  <th className="p-2 text-center relative group select-none" style={{ width: `${columnWidths.voo_para}px` }}>
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
                </tr> : filteredEntries.map(e => {
                  const picCrew = crew.find(c => c.id === e.pic_canac);
                  const sicCrew = crew.find(c => c.id === e.sic_canac);
                  const clientName = clients.find(c => c.id === e.client_id)?.company_name;
                  return <tr key={e.id} className="hover:bg-slate-800/30 transition-colors group border-b border-slate-800/50">
                    <td className="p-2 whitespace-nowrap text-center text-xs" style={{ width: `${columnWidths.date}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-slate-500 text-[10px]" title={`Número sequencial: ${e.sequential_number}`}>#{e.sequential_number}</span>
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
                      <span className="text-white text-xs">{sicCrew?.full_name.split(' ')[0] || '-'}</span>
                    </td>
                    <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.canac_sic}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span className="text-slate-400 text-xs font-bold">{sicCrew?.canac || '-'}</span>
                    </td>
                    {logbookMonth?.has_daily_rate && (
                      <td className="p-2 whitespace-nowrap text-center" style={{ width: `${columnWidths.diarias}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.daily_rate > 0 ? (
                          <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg font-bold text-sm">
                            {e.daily_rate}
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
                      ) : (
                        <span className="text-cyan-400 text-xs font-semibold">{shortenClientName(clientName)}</span>
                      )}
                    </td>
                    <td className="p-2 text-center" style={{ width: `${columnWidths.check}px`, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${e.confirmed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 text-slate-600'}`}>
                        <CheckCircle size={14} />
                      </div>
                    </td>
                    <td className="p-2 text-center" style={{ width: `${columnWidths.acoes}px`, overflow: 'hidden' }}>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEditEntry(e)} className="p-2 hover:bg-sky-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 text-sky-400 hover:text-sky-300" title="Editar lançamento">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDeleteEntry(e.id)} className="p-2 hover:bg-rose-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300" title="Deletar lançamento">
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
            const partnerTotals: Record<string, { hours: number; dailyRates: number; voos: number }> = {};
            let splitHours = 0;

            filteredEntries.forEach(e => {
              if (e.is_equal_split) {
                splitHours += (e.time || 0);
              } else if (e.partner_name) {
                // Se houver partner, adiciona aos totais do partner
                if (!partnerTotals[e.partner_name]) {
                  partnerTotals[e.partner_name] = { hours: 0, dailyRates: 0, voos: 0 };
                }
                partnerTotals[e.partner_name].hours += (e.time || 0);
                partnerTotals[e.partner_name].dailyRates += (e.daily_rate || 0);
                partnerTotals[e.partner_name].voos += 1;
              } else if (e.client_id) {
                const clientName = clients.find(c => c.id === e.client_id)?.company_name || 'Outros';
                if (!clientTotals[e.client_id]) {
                  clientTotals[e.client_id] = { hours: 0, dailyRates: 0, name: clientName };
                }
                clientTotals[e.client_id].hours += (e.time || 0);
                clientTotals[e.client_id].dailyRates += (e.daily_rate || 0);
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
                        {filteredEntries.reduce((sum, e) => sum + (e.daily_rate || 0), 0)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Horas por sócio (quando houver partners) */}
                {hasPartners && (
                  <div className="pt-2 border-t border-slate-800/50">
                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-2">Horas por Sócio</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {Object.entries(partnerTotals).map(([partnerName, pt], idx) => (
                        <div key={idx} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/50">
                          <div className="text-[9px] font-semibold text-slate-400 uppercase mb-1 truncate">{partnerName}</div>
                          <div className="text-sm font-black text-orange-400 mb-0.5">{decimalToHHMM(pt.hours)}</div>
                          <div className="text-[8px] text-slate-500">{pt.voos} voo{pt.voos > 1 ? 's' : ''}</div>
                          {logbookMonth?.has_daily_rate && pt.dailyRates > 0 && (
                            <div className="text-[8px] text-yellow-400 font-semibold mt-1">{pt.dailyRates} diária{pt.dailyRates > 1 ? 's' : ''}</div>
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
                            <span className="text-yellow-400"> • {ct.dailyRates} diária{ct.dailyRates > 1 ? 's' : ''}</span>
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
        </div>}

        {/* MODAL DE EDIÇÃO DE LANÇAMENTO */}
        {editingEntry && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 text-white max-w-2xl w-full rounded-3xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tight">Editar Lançamento</h2>
              <button onClick={handleCancelEdit} className="p-2 hover:bg-slate-800 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
              {/* SEÇÃO 1: DATA E TRIPULAÇÃO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-500 mb-2">
                  <Calendar size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">1. Data e Tripulação</span>
                </div>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Data *</Label>
                    <Input type="date" value={editingEntry.entry_date} onChange={e => setEditingEntry({
                      ...editingEntry,
                      entry_date: e.target.value
                    })} className="bg-slate-950 border-slate-800 text-white" />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="split-toggle-edit"
                      checked={editingEntry.is_equal_split}
                      onChange={e => setEditingEntry({
                        ...editingEntry,
                        is_equal_split: e.target.checked,
                        client_id: e.target.checked ? '' : editingEntry.client_id
                      })}
                      className="w-4 h-4 rounded cursor-pointer accent-emerald-500"
                    />
                    <Label htmlFor="split-toggle-edit" className="text-[9px] uppercase text-slate-400 cursor-pointer">
                      Rateio Igual (Sócios)
                    </Label>
                  </div>

                  {editingEntry.is_equal_split ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                      <p className="text-[9px] text-emerald-400 uppercase font-bold tracking-widest mb-2">
                        Tipo de Voo para Rateio
                      </p>
                      <Select value={editingEntry.flight_nature} onValueChange={v => setEditingEntry({
                        ...editingEntry,
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
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Cliente *</Label>
                      <Select value={editingEntry.client_id} onValueChange={v => setEditingEntry({
                        ...editingEntry,
                        client_id: v
                      })}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">PIC *</Label>
                    <Select value={editingEntry.pic_canac} onValueChange={v => setEditingEntry({
                      ...editingEntry,
                      pic_canac: v
                    })}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {crew.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.canac})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">SIC (Opcional)</Label>
                    <Select value={editingEntry.sic_canac || '__none__'} onValueChange={v => setEditingEntry({
                      ...editingEntry,
                      sic_canac: v === '__none__' ? null : v
                    })}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                        <SelectValue placeholder="Selecione ou deixe em branco" />
                      </SelectTrigger>
                      <SelectContent>
                        {crew.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.canac})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: AERÓDROMOS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-500 mb-2">
                  <Navigation size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">2. Aeródromos</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Origem *</Label>
                    <Select value={editingEntry.departure_aerodrome} onValueChange={v => setEditingEntry({
                      ...editingEntry,
                      departure_aerodrome: v
                    })}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aerodromes.map(a => <SelectItem key={a.id} value={a.designativo}>{a.designativo} - {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Destino *</Label>
                    <Select value={editingEntry.arrival_aerodrome} onValueChange={v => setEditingEntry({
                      ...editingEntry,
                      arrival_aerodrome: v
                    })}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 text-white">
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
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-cyan-500 mb-2">
                  <Clock size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">3. Horários</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Acionamento *</Label>
                    <Input type="time" step="60" value={editingEntry.ac_time} onChange={e => setEditingEntry({
                      ...editingEntry,
                      ac_time: e.target.value
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Corte *</Label>
                    <Input type="time" step="60" value={editingEntry.cor_time} onChange={e => setEditingEntry({
                      ...editingEntry,
                      cor_time: e.target.value
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-white" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Decolagem</Label>
                    <Input type="time" step="60" value={editingEntry.dep_time} onChange={e => setEditingEntry({
                      ...editingEntry,
                      dep_time: e.target.value
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Pouso</Label>
                    <Input type="time" step="60" value={editingEntry.pou_time} onChange={e => setEditingEntry({
                      ...editingEntry,
                      pou_time: e.target.value
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-white" />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 4: COMBUSTÍVEL */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-orange-500 mb-2">
                  <Fuel size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">4. Combustível</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Combustível Inicial (L)</Label>
                    <Input type="number" step="0.1" value={editingEntry.fuel_liters} onChange={e => setEditingEntry({
                      ...editingEntry,
                      fuel_liters: parseFloat(e.target.value) || 0
                    })} className="bg-slate-950 border-slate-800 text-orange-400" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Combustível Consumido (L)</Label>
                    <Input type="number" step="0.1" value={editingEntry.fuel_consu} onChange={e => setEditingEntry({
                      ...editingEntry,
                      fuel_consu: parseFloat(e.target.value) || 0
                    })} className="bg-slate-950 border-slate-800 text-orange-300" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Preço/L (R$)</Label>
                    <Input type="number" step="0.01" value={editingEntry.fuel_price_per_liter} onChange={e => setEditingEntry({
                      ...editingEntry,
                      fuel_price_per_liter: parseFloat(e.target.value) || 0
                    })} className="bg-slate-950 border-slate-800 text-orange-400" />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 5: TEMPOS */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-purple-500 mb-2">
                  <TrendingUp size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">5. Tempos</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Tempo Diurno</Label>
                    <Input type="time" step="60" value={decimalToTimeString(editingEntry.day_time)} onChange={e => setEditingEntry({
                      ...editingEntry,
                      day_time: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Tempo Noturno</Label>
                    <Input type="time" step="60" value={decimalToTimeString(editingEntry.night_hours)} onChange={e => setEditingEntry({
                      ...editingEntry,
                      night_hours: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-sky-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">IFR</Label>
                    <Input type="time" step="60" value={decimalToTimeString(editingEntry.ifr_time)} onChange={e => setEditingEntry({
                      ...editingEntry,
                      ifr_time: timeStringToDecimal(e.target.value)
                    })} style={{
                      accentColor: 'white',
                      colorScheme: 'dark'
                    }} className="bg-slate-950 border-slate-800 text-white" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Pousos</Label>
                    <Input type="number" value={editingEntry.pousos} onChange={e => setEditingEntry({
                      ...editingEntry,
                      pousos: parseInt(e.target.value) || 1
                    })} className="bg-slate-950 border-slate-800 text-white" />
                  </div>
                </div>
              </div>

              {/* SEÇÃO 6: PERFORMANCE & CÉLULA */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-pink-500 mb-2">
                  <Fuel size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">6. Performance & Célula</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">POB (Pessoas)</Label>
                    <Input type="number" value={editingEntry.passengers} onChange={e => setEditingEntry({
                      ...editingEntry,
                      passengers: parseInt(e.target.value) || 0
                    })} className="bg-slate-950 border-slate-800 text-sky-400" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase text-slate-500 ml-1 block">Carga (kg)</Label>
                    <Input type="number" step="0.1" value={editingEntry.cargo_kg} onChange={e => setEditingEntry({
                      ...editingEntry,
                      cargo_kg: parseFloat(e.target.value) || 0
                    })} className="bg-slate-950 border-slate-800 text-emerald-400" />
                  </div>
                </div>
              </div>

            </div>

            {/* BOTÕES DE AÇÃO */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-slate-800">
              <Button onClick={handleCancelEdit} className="flex-1 bg-slate-800 hover:bg-slate-700 h-12 font-black uppercase text-sm rounded-2xl">
                <X size={18} className="mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSaveEditedEntry} className="flex-1 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 h-12 font-black uppercase text-sm rounded-2xl shadow-xl">
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
