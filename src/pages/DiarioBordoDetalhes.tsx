import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Check, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CreateLogbookDialog } from "@/components/diario/CreateLogbookDialog";
const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
interface LogbookEntry {
  id?: string;
  data: string;
  de: string;
  para: string;
  ac: string;
  dep: string;
  pou: string;
  cor: string;
  tvoo: string;
  tdia: string;
  tnoit: string;
  total: string;
  ifr: string;
  pousos: string;
  abast: string;
  fuel: string;
  ctm: string;
  pic: string;
  sic: string;
  diarias: string;
  extras: string;
  voo_para: string;
  confere: boolean;
}

// Calculate time difference in decimal hours
const calcTimeDiff = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMinutes = sh * 60 + sm;
  let endMinutes = eh * 60 + em;
  // Handle crossing midnight
  if (endMinutes < startMinutes) endMinutes += 24 * 60;
  const diff = (endMinutes - startMinutes) / 60;
  return Math.round(diff * 100) / 100;
};

// Format decimal hours to HH:MM display
const formatDecimalToHHMM = (decimal: number): string => {
  if (!decimal || isNaN(decimal)) return '';
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};
export default function DiarioBordoDetalhes() {
  const {
    aircraftId
  } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    roles
  } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(searchParams.get('month') || String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(searchParams.get('year') || String(new Date().getFullYear()));
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [editingRows, setEditingRows] = useState<Set<number>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [deSearchOpen, setDeSearchOpen] = useState<number | null>(null);
  const [paraSearchOpen, setParaSearchOpen] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [showNextMonthDialog, setShowNextMonthDialog] = useState(false);
  const [createLogbookOpen, setCreateLogbookOpen] = useState(false);
  const canEdit = roles.some(role => role === "admin" || role === "piloto_chefe" || role === "gestor_master" || role === "operacoes" || role === "tripulante");
  const canConfirm = roles.some(role => role === "admin" || role === "piloto_chefe" || role === "gestor_master");
  const canEditClosed = roles.some(role => role === "admin" || role === "gestor_master");
  const {
    data: aircraft
  } = useQuery({
    queryKey: ['aircraft', aircraftId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('aircraft').select('*').eq('id', aircraftId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!aircraftId
  });
  const {
    data: logbookMonth,
    refetch: refetchMonth
  } = useQuery({
    queryKey: ['logbook-month', aircraftId, selectedYear, selectedMonth],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('logbook_months').select('*').eq('aircraft_id', aircraftId).eq('year', parseInt(selectedYear)).eq('month', parseInt(selectedMonth)).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!aircraftId
  });
  const {
    data: crewMembers
  } = useQuery({
    queryKey: ['crew-members'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('crew_members').select('id, canac, full_name').order('full_name');
      if (error) throw error;
      return data;
    }
  });
  const {
    data: clients
  } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('clients').select('id, company_name').order('company_name');
      if (error) throw error;
      return data;
    }
  });
  const {
    data: allAircraft
  } = useQuery({
    queryKey: ['aircraft-list'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('aircraft').select('id, registration, model, fuel_consumption').order('registration');
      if (error) throw error;
      return data;
    }
  });
  const {
    data: company
  } = useQuery({
    queryKey: ['company-settings-latest'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('company_settings').select('logo_url, razao_social').order('created_at', {
        ascending: false
      }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    }
  });
  const {
    data: aerodromes
  } = useQuery({
    queryKey: ['aerodromes'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('aerodromes').select('id, designativo, name').order('designativo', {
        ascending: true
      });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true
  });
  useEffect(() => {
    setSearchParams({
      month: selectedMonth,
      year: selectedYear
    });
  }, [selectedMonth, selectedYear, setSearchParams]);
  useEffect(() => {
    if (logbookMonth) {
      loadEntries();
      if (logbookMonth.is_closed) {
        const nextMonth = parseInt(selectedMonth) + 1;
        if (nextMonth <= 12) {
          setShowNextMonthDialog(true);
        }
      }
    }
  }, [logbookMonth, selectedMonth]);
  const loadEntries = async () => {
    if (!logbookMonth || !aircraftId) return;
    const startDate = new Date(logbookMonth.year, logbookMonth.month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(logbookMonth.year, logbookMonth.month, 0).toISOString().split('T')[0];
    const {
      data,
      error
    } = await supabase.from('logbook_entries').select('*, pic:crew_members!pic_canac(id, canac), sic:crew_members!sic_canac(id, canac)').eq('aircraft_id', aircraftId).gte('entry_date', startDate).lte('entry_date', endDate).order('entry_date', {
      ascending: true
    });
    if (error) {
      console.error('Error loading entries:', error.message);
      toast.error(`Erro ao carregar entradas`);
      return;
    }
    const formattedEntries = data.map(entry => ({
      id: entry.id,
      data: entry.entry_date,
      de: entry.departure_aerodrome || '',
      para: entry.arrival_aerodrome || '',
      ac: entry.ac_time ? new Date(entry.ac_time).toISOString().substring(11, 16) : '',
      dep: entry.dep_time ? new Date(entry.dep_time).toISOString().substring(11, 16) : '',
      pou: entry.pou_time ? new Date(entry.pou_time).toISOString().substring(11, 16) : '',
      cor: entry.cor_time ? new Date(entry.cor_time).toISOString().substring(11, 16) : '',
      tvoo: (Number(entry.time) || 0).toString(),
      tdia: (Number(entry.day_time) || 0).toString(),
      tnoit: (Number(entry.night_hours) || 0).toString(),
      total: (Number(entry.total_time) || 0).toString(),
      ifr: (Number(entry.ifr_time) || 0).toString(),
      pousos: entry.pousos?.toString() || '',
      abast: entry.fuel_added?.toString() || '',
      fuel: entry.fuel_liters?.toString() || '',
      ctm: entry.celula?.toString() || '',
      pic: entry.pic?.canac || '',
      sic: entry.sic?.canac || '',
      diarias: entry.daily_rate?.toString() || '',
      extras: entry.extras || '',
      voo_para: entry.client_id || '',
      confere: entry.confirmed || false
    }) as LogbookEntry);
    setEntries(formattedEntries);
  };
  const addNewRow = () => {
    if (!canEdit) {
      toast.error("Você não tem permissão para adicionar entradas");
      return;
    }
    const newEntry: LogbookEntry = {
      data: '',
      de: '',
      para: '',
      ac: '',
      dep: '',
      pou: '',
      cor: '',
      tvoo: '',
      tdia: '',
      tnoit: '',
      total: '',
      ifr: '',
      pousos: '1',
      abast: '',
      fuel: '',
      ctm: '',
      pic: '',
      sic: '',
      diarias: '',
      extras: '',
      voo_para: '',
      confere: false
    };
    setEntries([...entries, newEntry]);
    setEditingRows(new Set([...editingRows, entries.length]));
  };
  const updateEntry = (index: number, field: keyof LogbookEntry, value: any) => {
    const updated = [...entries];
    updated[index] = {
      ...updated[index],
      [field]: value
    };

    // Auto-calculate T VOO when DEP or POU changes
    if (field === 'dep' || field === 'pou') {
      const tvoo = calcTimeDiff(updated[index].dep, updated[index].pou);
      updated[index].tvoo = tvoo > 0 ? tvoo.toString() : '';
      // Default tdia to tvoo if not set
      if (!updated[index].tdia && tvoo > 0) {
        updated[index].tdia = tvoo.toString();
      }
    }

    // Auto-calculate TOTAL when AC or COR changes
    if (field === 'ac' || field === 'cor') {
      const total = calcTimeDiff(updated[index].ac, updated[index].cor);
      updated[index].total = total > 0 ? total.toString() : '';
    }
    setEntries(updated);
    setEditingRows(new Set([...editingRows, index]));
    setExpandedRows(new Set([...expandedRows, index]));
  };
  const saveEntry = async (index: number) => {
    if (!logbookMonth) {
      toast.error("Diário de bordo não encontrado");
      return;
    }
    const entry = entries[index];
    if (!entry.data) {
      toast.error("Preencha a data");
      return;
    }
    const picMember = crewMembers?.find(c => c.canac === entry.pic);
    const sicMember = crewMembers?.find(c => c.canac === entry.sic);
    const entryData = {
      logbook_month_id: logbookMonth.id,
      aircraft_id: aircraftId,
      entry_date: entry.data,
      departure_aerodrome: entry.de,
      arrival_aerodrome: entry.para,
      ac_time: entry.ac ? new Date(`${entry.data}T${entry.ac}:00`).toISOString() : null,
      dep_time: entry.dep ? new Date(`${entry.data}T${entry.dep}:00`).toISOString() : null,
      pou_time: entry.pou ? new Date(`${entry.data}T${entry.pou}:00`).toISOString() : null,
      cor_time: entry.cor ? new Date(`${entry.data}T${entry.cor}:00`).toISOString() : null,
      time: parseFloat(entry.tvoo) || 0,
      day_time: parseFloat(entry.tdia) || 0,
      night_hours: parseFloat(entry.tnoit) || 0,
      total_time: parseFloat(entry.total) || 0,
      ifr_time: parseFloat(entry.ifr) || 0,
      pousos: parseInt(entry.pousos) || 0,
      fuel_added: parseFloat(entry.abast) || 0,
      fuel_liters: parseFloat(entry.fuel) || 0,
      celula: parseFloat(entry.ctm) || 0,
      pic_canac: picMember?.id || null,
      sic_canac: sicMember?.id || null,
      daily_rate: parseFloat(entry.diarias) || 0,
      extras: entry.extras,
      client_id: entry.voo_para || null,
      confirmed: entry.confere
    } as Record<string, any>;
    try {
      if (entry.id) {
        const {
          error
        } = await supabase.from('logbook_entries').update(entryData).eq('id', entry.id);
        if (error) throw error;
      } else {
        const {
          data,
          error
        } = await supabase.from('logbook_entries').insert([entryData as any]).select().single();
        if (error) throw error;
        const updated = [...entries];
        updated[index].id = data.id;
        setEntries(updated);
      }
      const newEditing = new Set(editingRows);
      newEditing.delete(index);
      setEditingRows(newEditing);
      const newExpanded = new Set(expandedRows);
      newExpanded.delete(index);
      setExpandedRows(newExpanded);
      toast.success("Entrada salva");
      loadEntries();
    } catch (error: any) {
      toast.error("Erro ao salvar entrada");
      console.error(error);
    }
  };
  const toggleConfirm = async (index: number) => {
    if (!canConfirm) {
      toast.error("Você não tem permissão para confirmar");
      return;
    }
    const entry = entries[index];
    if (!entry.id) {
      toast.error("Salve a entrada primeiro");
      return;
    }
    const newStatus = !entry.confere;
    const {
      error
    } = await supabase.from('logbook_entries').update({
      confirmed: newStatus,
      confirmed_by: newStatus ? (await supabase.auth.getUser()).data.user?.id : null,
      confirmed_at: newStatus ? new Date().toISOString() : null
    }).eq('id', entry.id);
    if (error) {
      toast.error("Erro ao confirmar");
      return;
    }
    updateEntry(index, 'confere', newStatus);
    toast.success(newStatus ? "Confirmado" : "Confirmação removida");
  };
  const openNextMonth = async () => {
    const nextMonth = parseInt(selectedMonth) + 1;
    if (nextMonth > 12) return;
    const {
      data: existing
    } = await supabase.from('logbook_months').select('id').eq('aircraft_id', aircraftId).eq('year', parseInt(selectedYear)).eq('month', nextMonth).maybeSingle();
    if (existing) {
      setSelectedMonth(nextMonth.toString());
      setShowNextMonthDialog(false);
    } else {
      setCreateLogbookOpen(true);
      setShowNextMonthDialog(false);
    }
  };
  const closeMonth = async () => {
    if (!logbookMonth || !canConfirm) return;
    const {
      error
    } = await supabase.from('logbook_months').update({
      is_closed: true,
      confirmed_by: (await supabase.auth.getUser()).data.user?.id,
      confirmed_at: new Date().toISOString()
    }).eq('id', logbookMonth.id);
    if (error) {
      toast.error("Erro ao fechar");
      return;
    }
    toast.success("Diário fechado");
    refetchMonth();
  };

  // Totals calculation
  const totals = useMemo(() => {
    return entries.reduce((acc, e) => ({
      tvoo: acc.tvoo + (parseFloat(e.tvoo) || 0),
      tdia: acc.tdia + (parseFloat(e.tdia) || 0),
      tnoit: acc.tnoit + (parseFloat(e.tnoit) || 0),
      total: acc.total + (parseFloat(e.total) || 0),
      ifr: acc.ifr + (parseFloat(e.ifr) || 0),
      pousos: acc.pousos + (parseInt(e.pousos) || 0),
      abast: acc.abast + (parseFloat(e.abast) || 0),
      diarias: acc.diarias + (parseFloat(e.diarias) || 0)
    }), {
      tvoo: 0,
      tdia: 0,
      tnoit: 0,
      total: 0,
      ifr: 0,
      pousos: 0,
      abast: 0,
      diarias: 0
    });
  }, [entries]);
  if (!logbookMonth) {
    return <Layout>
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/diario-bordo')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Diário de Bordo não encontrado</h1>
        </div>
        <p>Crie um diário de bordo para este ano e aeronave.</p>
      </div>
    </Layout>;
  }
  const monthName = MONTHS[parseInt(selectedMonth) - 1];
  const isClosed = logbookMonth?.is_closed;
  const cellStart = logbookMonth?.celula_anterior || 0;
  const cellEnd = logbookMonth?.celula_atual || 0;
  const horimeterStart = logbookMonth?.horimetro_inicial || 0;
  const horimeterEnd = logbookMonth?.horimetro_final || 0;
  const canAddOrEdit = isClosed ? canEditClosed : canEdit;
  const filteredAerodromes = aerodromes?.filter(a => a.designativo?.toLowerCase().includes(searchValue.toLowerCase()) || a.name?.toLowerCase().includes(searchValue.toLowerCase())) || [];
  return <Layout>
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto p-4 space-y-4 bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-lg border-2 border-[#8fbc8f] bg-sky-950">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/diario-bordo')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src="/logoshare.branco.png" alt="Share Brasil Logo" className="h-16 w-auto shadow-sm object-cover" />
            <div>
              <h1 className="text-2xl font-bold text-slate-50">
                DIÁRIO {monthName} {selectedYear} <span className="text-green-400">{aircraft?.registration}</span>
              </h1>
            </div>
            {isClosed && <span className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded">FECHADO</span>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32 bg-slate-700 border-[#8fbc8f] text-slate-100 hover:bg-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {MONTHS.map((month, idx) => <SelectItem key={idx} value={String(idx + 1)} className="text-slate-100 hover:bg-slate-600 focus:bg-slate-600">{month}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24 bg-slate-700 border-[#8fbc8f] text-slate-100 hover:bg-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-700 border-slate-600">
                {Array.from({
                  length: 10
                }, (_, i) => new Date().getFullYear() - 5 + i).map(year => <SelectItem key={year} value={String(year)} className="text-slate-100 hover:bg-slate-600 focus:bg-slate-600">{year}</SelectItem>)}
              </SelectContent>
            </Select>
            {canAddOrEdit && <Button onClick={addNewRow} className="text-slate-100 my-[6px] py-[7px] mx-[9px] px-[11px] text-xs font-normal border border-slate-400 border-none rounded-2xl shadow-md bg-slate-950 hover:bg-slate-800">
              <Plus className="h-4 w-4 mr-1" /> Novo Trecho
            </Button>}
            {!isClosed && canConfirm && entries.length > 0 && <Button onClick={closeMonth} variant="destructive">Fechar Diário</Button>}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-slate-800 border-2 border-[#008B8B]">
            <h3 className="font-bold text-sm text-[#008B8B] mb-2">AERONAVE</h3>
            <div className="grid grid-cols-2 gap-1 text-sm text-slate-200">
              <span className="font-semibold">Prefixo:</span>
              <span className="font-bold text-lg text-green-400">{aircraft?.registration}</span>
              <span className="font-semibold">Modelo:</span>
              <span className="text-slate-300">{aircraft?.model}</span>
              <span className="font-semibold">Cons. Méd:</span>
              <span className="font-bold text-slate-300">{aircraft?.fuel_consumption} L/H</span>
            </div>
          </Card>

          <Card className="p-4 bg-slate-800 border-2 border-[#1e40af]">
            <h3 className="font-bold text-sm text-[#60a5fa] mb-2">CÉLULA</h3>
            <div className="grid grid-cols-2 gap-1 text-sm text-slate-200">
              <span className="font-semibold">ANTERIOR:</span>
              <span className="font-bold text-slate-100">{cellStart.toFixed(1)} H</span>
              <span className="font-semibold">ATUAL:</span>
              <span className="font-bold text-green-400">{cellEnd.toFixed(1)} H</span>
              <span className="font-semibold">P.REV.:</span>
              <span className="font-bold text-[#008B8B]">{(Math.ceil(cellEnd / 10) * 10).toFixed(1)} H</span>
              <span className="font-semibold">DISP.:</span>
              <span className="font-bold text-red-400">{Math.max(0, Math.ceil(cellEnd / 10) * 10 - cellEnd).toFixed(2)} H</span>
            </div>
          </Card>

          <Card className="p-4 bg-slate-800 border-2 border-[#1E90FF]">
            <h3 className="font-bold text-sm text-[#1E90FF] mb-2">HORÍMETRO</h3>
            <div className="grid grid-cols-2 gap-1 text-sm text-slate-200">
              <span className="font-semibold">INÍCIO:</span>
              <span className="font-bold text-slate-100">{horimeterStart.toFixed(1)} H</span>
              <span className="font-semibold">FINAL:</span>
              <span className="font-bold text-slate-100">{horimeterEnd.toFixed(1)} H</span>
              <span className="font-semibold">ATIVO:</span>
              <span className="font-bold text-green-400">{(horimeterEnd - horimeterStart).toFixed(1)} H</span>
            </div>
          </Card>
        </div>

        {/* Main Table */}
        <div className="bg-slate-800 rounded-lg border-4 border-slate-600 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse bg-slate-800">
              <thead>
                <tr className="bg-[#1f2937]">
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white w-20">DATA</th>
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white w-14">DE</th>
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white w-14">PARA</th>
                  <th colSpan={4} className="border border-gray-500 p-1 text-[10px] font-bold text-white bg-[#008B8B]">HORÁRIOS</th>
                  <th colSpan={5} className="border border-gray-500 p-1 text-[10px] font-bold text-white bg-[#1e40af]">TEMPO DE VOO</th>
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white w-12">POUSOS</th>
                  <th colSpan={2} className="border border-gray-500 p-1 text-[10px] font-bold text-white bg-[#1E90FF]">COMBUSTÍVEL</th>
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white w-14">CTM</th>
                  <th colSpan={2} className="border border-gray-500 p-1 text-[10px] font-bold text-white bg-cyan-950">CANAC</th>
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white bg-[#374151] w-12">DIÁRIAS</th>
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white w-16">EXTRAS</th>
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white w-24">VOO PARA</th>
                  <th rowSpan={2} className="border border-gray-500 p-1.5 text-[10px] font-bold text-white w-16">CONFERE</th>
                </tr>
                <tr className="bg-[#111827]">
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#008B8B] w-14">AC</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#008B8B] w-14">DEP</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#008B8B] w-14">POU</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#008B8B] w-14">COR</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#1e40af] w-12">T VOO</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#1e40af] w-12">T DIA</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#1e40af] w-12">T NOITE</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#1e40af] w-12">TOTAL</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#1e40af] w-12">IFR</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#1E90FF] w-12">ABAST</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white bg-[#1E90FF] w-12">FUEL</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white w-14 bg-cyan-950">PIC</th>
                  <th className="border border-gray-500 p-1 text-[9px] font-bold text-white w-14 bg-cyan-950">SIC</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const isEditing = editingRows.has(index) || !entry.id;
                  const isExpanded = expandedRows.has(index);
                  const rowBg = index % 2 === 0 ? 'bg-slate-700' : 'bg-slate-600';
                  const cellHeight = isExpanded ? 'h-12' : 'h-6';
                  return <tr key={entry.id || index} className={`${rowBg} hover:bg-slate-500 transition-all ${isExpanded ? 'h-12' : 'h-6'}`}>
                    <td className="border border-slate-500 p-0.5 group relative">
                      <div className="flex items-center gap-1">
                        <Input type="date" value={entry.data} onChange={e => updateEntry(index, 'data', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-slate-700 p-1 font-semibold text-slate-100 flex-1`} />
                        {isEditing && <button onClick={() => setExpandedRows(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(index)) {
                            newSet.delete(index);
                          } else {
                            newSet.add(index);
                          }
                          return newSet;
                        })} className="p-0.5 hover:bg-slate-500 rounded text-slate-300 hover:text-white transition-colors" title={isExpanded ? "Recolher" : "Expandir"}>
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>}
                      </div>
                    </td>
                    <td className="border border-slate-500 p-0.5">
                      <Popover open={deSearchOpen === index} onOpenChange={open => {
                        setDeSearchOpen(open ? index : null);
                        setSearchValue('');
                      }}>
                        <PopoverTrigger asChild>
                          <Input value={deSearchOpen === index ? searchValue : entry.de} onChange={e => setSearchValue(e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-slate-700 p-1 uppercase font-mono font-semibold text-slate-100`} placeholder="ICAO" />
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-0" align="start">
                          <div className="max-h-32 overflow-y-auto">
                            {filteredAerodromes.slice(0, 10).map(a => <button key={a.id} onClick={() => {
                              updateEntry(index, 'de', a.designativo);
                              setDeSearchOpen(null);
                            }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-300 border-b bg-slate-50 text-slate-900">
                              <span className="font-bold">{a.designativo}</span>
                              <span className="text-slate-600 ml-1 text-[10px]">{a.name?.substring(0, 15)}</span>
                            </button>)}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    <td className="border border-slate-500 p-0.5">
                      <Popover open={paraSearchOpen === index} onOpenChange={open => {
                        setParaSearchOpen(open ? index : null);
                        setSearchValue('');
                      }}>
                        <PopoverTrigger asChild>
                          <Input value={paraSearchOpen === index ? searchValue : entry.para} onChange={e => setSearchValue(e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-slate-700 p-1 uppercase font-mono font-semibold text-slate-100`} placeholder="ICAO" />
                        </PopoverTrigger>
                        <PopoverContent className="w-40 p-0" align="start">
                          <div className="max-h-32 overflow-y-auto">
                            {filteredAerodromes.slice(0, 10).map(a => <button key={a.id} onClick={() => {
                              updateEntry(index, 'para', a.designativo);
                              setParaSearchOpen(null);
                            }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-300 border-b bg-slate-50 text-slate-900">
                              <span className="font-bold">{a.designativo}</span>
                              <span className="text-slate-600 ml-1 text-[10px]">{a.name?.substring(0, 15)}</span>
                            </button>)}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                    {/* HORÁRIOS - Input type time */}
                    <td className="border border-slate-500 p-0.5 bg-[#008B8B]/20">
                      <Input type="time" value={entry.ac} onChange={e => updateEntry(index, 'ac', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#008B8B]/30 p-0.5 font-mono font-semibold text-slate-100`} />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#008B8B]/20">
                      <Input type="time" value={entry.dep} onChange={e => updateEntry(index, 'dep', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#008B8B]/30 p-0.5 font-mono font-semibold text-slate-100`} />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#008B8B]/20">
                      <Input type="time" value={entry.pou} onChange={e => updateEntry(index, 'pou', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#008B8B]/30 p-0.5 font-mono font-semibold text-slate-100`} />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#008B8B]/20">
                      <Input type="time" value={entry.cor} onChange={e => updateEntry(index, 'cor', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#008B8B]/30 p-0.5 font-mono font-semibold text-slate-100`} />
                    </td>
                    {/* TEMPO DE VOO - Decimal inputs */}
                    <td className="border border-slate-500 p-0.5 bg-[#1e40af]/20">
                      <Input type="number" step="0.01" value={entry.tvoo} onChange={e => updateEntry(index, 'tvoo', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#1e40af]/30 p-0.5 text-center font-mono font-semibold text-slate-100`} placeholder="0.00" />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#1e40af]/20">
                      <Input type="number" step="0.01" value={entry.tdia} onChange={e => updateEntry(index, 'tdia', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#1e40af]/30 p-0.5 text-center font-mono font-semibold text-slate-100`} placeholder="0.00" />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#1e40af]/20">
                      <Input type="number" step="0.01" value={entry.tnoit} onChange={e => updateEntry(index, 'tnoit', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#1e40af]/30 p-0.5 text-center font-mono font-semibold text-slate-100`} placeholder="0.00" />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#1e40af]/20">
                      <Input type="number" step="0.01" value={entry.total} onChange={e => updateEntry(index, 'total', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#1e40af]/30 p-0.5 text-center font-mono font-bold text-slate-100`} placeholder="0.00" />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#1e40af]/20">
                      <Input type="number" step="0.01" value={entry.ifr} onChange={e => updateEntry(index, 'ifr', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#1e40af]/30 p-0.5 text-center font-mono font-semibold text-slate-100`} placeholder="0.00" />
                    </td>
                    <td className="border border-slate-500 p-0.5">
                      <Input type="number" value={entry.pousos} onChange={e => updateEntry(index, 'pousos', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-slate-700 p-0.5 text-center font-semibold text-slate-100`} />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#1E90FF]/20">
                      <Input type="number" value={entry.abast} onChange={e => updateEntry(index, 'abast', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#1E90FF]/30 p-0.5 text-center font-semibold text-slate-100`} />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#1E90FF]/20">
                      <Input type="number" value={entry.fuel} onChange={e => updateEntry(index, 'fuel', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-[#1E90FF]/30 p-0.5 text-center font-semibold text-slate-100`} />
                    </td>
                    <td className="border border-slate-500 p-0.5">
                      <Input type="number" step="0.1" value={entry.ctm} onChange={e => updateEntry(index, 'ctm', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-slate-700 p-0.5 text-center font-mono font-semibold text-slate-100`} />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#00008B]/20">
                      <Input value={entry.pic} onChange={e => updateEntry(index, 'pic', e.target.value)} disabled={!canAddOrEdit} list="crew-list" className={`${cellHeight} text-[10px] border border-slate-400 bg-[#00008B]/30 p-0.5 text-center font-mono font-semibold text-slate-100`} placeholder="CANAC" />
                    </td>
                    <td className="border border-slate-500 p-0.5 bg-[#00008B]/20">
                      <Input value={entry.sic} onChange={e => updateEntry(index, 'sic', e.target.value)} disabled={!canAddOrEdit} list="crew-list" className={`${cellHeight} text-[10px] border border-slate-400 bg-[#00008B]/30 p-0.5 text-center font-mono font-semibold text-slate-100`} placeholder="CANAC" />
                    </td>
                    <td className={`border border-slate-500 p-0.5 text-center bg-[#374151] flex items-center justify-center ${cellHeight}`}>
                      <input type="checkbox" checked={Number(entry.diarias) === 1} onChange={e => updateEntry(index, 'diarias', e.target.checked ? '1' : '0')} disabled={!canAddOrEdit} className="h-4 w-4 accent-green-500" />
                    </td>
                    <td className="border border-slate-500 p-0.5">
                      <Input value={entry.extras} onChange={e => updateEntry(index, 'extras', e.target.value)} disabled={!canAddOrEdit} className={`${cellHeight} text-[10px] border border-slate-400 bg-slate-700 p-0.5 font-semibold text-slate-100`} />
                    </td>
                    <td className="border border-slate-500 p-0.5">
                      <Select value={entry.voo_para || '__none__'} onValueChange={val => updateEntry(index, 'voo_para', val === '__none__' ? '' : val)} disabled={!canAddOrEdit}>
                        <SelectTrigger className={`${cellHeight} text-[10px] border border-slate-400 bg-slate-700 text-slate-100 p-0.5 font-semibold`}>
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="__none__" className="text-slate-100 hover:bg-slate-600 focus:bg-slate-600">-</SelectItem>
                          {clients?.map(c => <SelectItem key={c.id} value={c.id} className="text-slate-100 hover:bg-slate-600 focus:bg-slate-600">{c.company_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className={`border border-gray-400 p-0.5 text-center flex items-center justify-center ${cellHeight}`}>
                      {isEditing ? <Button size="sm" onClick={() => saveEntry(index)} className="h-6 px-2 text-[10px] bg-[#006400] hover:bg-[#004d00]">
                        <Save className="h-3 w-3 mr-1" /> Salvar
                      </Button> : <Button size="sm" variant={entry.confere ? "default" : "outline"} onClick={() => toggleConfirm(index)} disabled={!canConfirm} className={`h-6 w-6 p-0 ${entry.confere ? 'bg-[#006400]' : ''}`}>
                        {entry.confere && <Check className="h-3 w-3" />}
                      </Button>}
                    </td>
                  </tr>;
                })}

                {/* Totals Row */}
                <tr className="bg-[#1f2937] font-bold">
                  <td colSpan={7} className="border border-slate-500 p-2 text-right text-[11px] text-slate-100">TOTAIS DO MÊS:</td>
                  <td className="border border-slate-500 p-1 text-center text-[11px] text-slate-100 bg-[#1e40af]/30">{formatDecimalToHHMM(totals.tvoo) || totals.tvoo.toFixed(2)}</td>
                  <td className="border border-slate-500 p-1 text-center text-[11px] text-slate-100 bg-[#1e40af]/30">{formatDecimalToHHMM(totals.tdia) || totals.tdia.toFixed(2)}</td>
                  <td className="border border-slate-500 p-1 text-center text-[11px] text-slate-100 bg-[#1e40af]/30">{formatDecimalToHHMM(totals.tnoit) || totals.tnoit.toFixed(2)}</td>
                  <td className="border border-slate-500 p-1 text-center text-[11px] font-bold text-slate-100 bg-[#1e40af]/30">{formatDecimalToHHMM(totals.total) || totals.total.toFixed(2)}</td>
                  <td className="border border-slate-500 p-1 text-center text-[11px] text-slate-100 bg-[#1e40af]/30">{formatDecimalToHHMM(totals.ifr) || totals.ifr.toFixed(2)}</td>
                  <td className="border border-slate-500 p-1 text-center text-[11px] text-slate-100">{totals.pousos}</td>
                  <td className="border border-slate-500 p-1 text-center text-[11px] text-slate-100 bg-[#1E90FF]/30">{totals.abast.toFixed(1)}</td>
                  <td colSpan={4} className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1 text-center text-[11px] text-slate-100 bg-[#374151]">{totals.diarias}</td>
                  <td colSpan={3} className="border border-slate-500 p-1"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <datalist id="crew-list">
          {crewMembers?.map(c => <option key={c.canac} value={c.canac}>{c.full_name}</option>)}
        </datalist>

        <AlertDialog open={showNextMonthDialog} onOpenChange={setShowNextMonthDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Próximo Mês</AlertDialogTitle>
              <AlertDialogDescription>
                O diário de {MONTHS[parseInt(selectedMonth) - 1]} está fechado. Abrir {MONTHS[parseInt(selectedMonth)]}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Não</AlertDialogCancel>
              <AlertDialogAction onClick={openNextMonth}>Sim</AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <CreateLogbookDialog open={createLogbookOpen} onOpenChange={setCreateLogbookOpen} aircraft={allAircraft || []} initialAircraftId={aircraftId} initialYear={parseInt(selectedYear)} initialMonth={parseInt(selectedMonth) + 1} />
      </div>
    </div>
  </Layout>;
}