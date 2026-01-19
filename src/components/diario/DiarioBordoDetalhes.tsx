import React, { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Layout } from "../layout/Layout";
import { ArrowLeft, Plus, CheckCircle, Loader2, Save, X, Clock, Navigation, Users, Fuel, Calendar, Search, ChevronLeft, ChevronRight, Plane, Info, AlertCircle, TrendingUp, DollarSign, Edit, Trash2, MapPin } from 'lucide-react';
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
import { useUserRole } from '@/hooks/useUserRole';

// ===================== CONSTANTES =====================
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const FLIGHT_NATURE = ["AE - Aérea/Regular", "CQ - Cheque", "EX - Executivo", "NR - Não Remunerado", "RE - Retorno/Reposição", "PV - Privado", "SA - Serviço Aéreo", "TN - Transporte Não Regular/Táxi Aéreo", "TR - Traslado"];

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
  const R = 3440.065; 
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

// ===================== COMPONENTE PRINCIPAL =====================
const DiarioBordoDetalhes = ({ aircraftId, onBack }) => {
  const { isAdmin, isGestorMaster, isPilotoChefe } = useUserRole();

  // Estados de navegação
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [crew, setCrew] = useState([]);
  const [aerodromes, setAerodromes] = useState([]);
  const [clients, setClients] = useState([]);
  const [aircraft, setAircraft] = useState(null);
  const [lastCelula, setLastCelula] = useState(0);
  const [logbookMonth, setLogbookMonth] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  
  // Estado do Novo Voo
  const [newEntry, setNewEntry] = useState({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    pic_canac: '',
    sic_canac: '',
    departure_aerodrome: '',
    arrival_aerodrome: '',
    client_id: '',
    ac_time: '',
    dep_time: '',
    pou_time: '',
    cor_time: '',
    total_time: 0,
    time: 0,
    pousos: 1,
    fuel_added: 0,
    celula: 0,
    flight_nature: 'PV - Privado'
  });

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [acRes, crewRes, aeroRes, clientRes, entriesRes, monthsRes] = await Promise.all([
          supabase.from('aircraft').select('*').eq('id', aircraftId).single(),
          supabase.from('crew_members').select('*'),
          supabase.from('aerodromes').select('*').order('designativo'),
          supabase.from('clients').select('*').order('company_name'),
          supabase.from('logbook_entries').select('*').eq('aircraft_id', aircraftId).order('entry_date', { ascending: false }),
          supabase.from('logbook_months').select('*').eq('aircraft_id', aircraftId)
        ]);

        if (acRes.data) setAircraft(acRes.data);
        if (crewRes.data) setCrew(crewRes.data);
        if (aeroRes.data) setAerodromes(aeroRes.data);
        if (clientRes.data) setClients(clientRes.data);
        if (entriesRes.data) setEntries(entriesRes.data);
        if (monthsRes.data) setAvailableMonths(monthsRes.data);

        // Buscar mês específico
        const { data: monthData } = await supabase
          .from('logbook_months')
          .select('*')
          .eq('aircraft_id', aircraftId)
          .eq('month', selectedMonth)
          .eq('year', selectedYear)
          .single();

        if (monthData) {
          setLogbookMonth(monthData);
          setLastCelula(monthData.celula_anterior || 0);
        }
      } catch (error) {
        toast.error("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [aircraftId, selectedMonth, selectedYear]);

  // Cálculo automático de tempos do novo voo
  useEffect(() => {
    if (newEntry.ac_time && newEntry.cor_time) {
      const total = calculateTimeDiff(newEntry.ac_time, newEntry.cor_time);
      const flight = (newEntry.dep_time && newEntry.pou_time) ? calculateTimeDiff(newEntry.dep_time, newEntry.pou_time) : 0;
      
      // Cálculo de cascata da célula
      const baseParaCalculo = entries.length > 0 ? Math.max(...entries.map(e => e.celula)) : lastCelula;
      
      setNewEntry(prev => ({ 
        ...prev, 
        total_time: total, 
        time: flight,
        celula: parseFloat((baseParaCalculo + total).toFixed(1))
      }));
    }
  }, [newEntry.ac_time, newEntry.cor_time, newEntry.dep_time, newEntry.pou_time, lastCelula, entries]);

  const handleSaveEntry = async () => {
    try {
      const { data, error } = await supabase
        .from('logbook_entries')
        .insert([{ ...newEntry, aircraft_id: aircraftId }])
        .select();

      if (error) throw error;

      toast.success("Voo registrado com sucesso!");
      setEntries([data[0], ...entries]);
      setShowAddForm(false);
    } catch (error) {
      toast.error("Erro ao salvar voo");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Deseja realmente excluir este registro?")) return;
    try {
      const { error } = await supabase.from('logbook_entries').delete().eq('id', id);
      if (error) throw error;
      setEntries(entries.filter(e => e.id !== id));
      toast.success("Voo excluído");
    } catch (error) {
      toast.error("Erro ao excluir");
    }
  };

  const filteredEntries = entries.filter(e => {
    const date = new Date(e.entry_date);
    return date.getUTCMonth() + 1 === selectedMonth && date.getUTCFullYear() === selectedYear;
  });

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Diário de Bordo - {aircraft?.registration}</h1>
              <p className="text-slate-500">{MONTHS[selectedMonth - 1]} de {selectedYear}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Novo Voo
            </Button>
          </div>
        </div>

        {/* Filtros de Navegação */}
        <div className="flex gap-4 bg-white p-4 rounded-lg shadow-sm border">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input 
            type="number" 
            className="w-[100px]" 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))} 
          />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar por aeródromo ou piloto..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Tabela de Registros */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b text-slate-600 font-medium">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">De</th>
                  <th className="px-4 py-3">Para</th>
                  <th className="px-4 py-3">Acion.</th>
                  <th className="px-4 py-3">Dec.</th>
                  <th className="px-4 py-3">Pou.</th>
                  <th className="px-4 py-3">Corte</th>
                  <th className="px-4 py-3">T. Voo</th>
                  <th className="px-4 py-3">Célula</th>
                  <th className="px-4 py-3">Pousos</th>
                  <th className="px-4 py-3">Combust.</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium">{formatDateFromISO(entry.entry_date)}</td>
                    <td className="px-4 py-3">{entry.departure_aerodrome}</td>
                    <td className="px-4 py-3">{entry.arrival_aerodrome}</td>
                    <td className="px-4 py-3">{formatTimeFromTimestamp(entry.ac_time)}</td>
                    <td className="px-4 py-3">{formatTimeFromTimestamp(entry.dep_time)}</td>
                    <td className="px-4 py-3">{formatTimeFromTimestamp(entry.pou_time)}</td>
                    <td className="px-4 py-3">{formatTimeFromTimestamp(entry.cor_time)}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{entry.total_time}h</td>
                    <td className="px-4 py-3 text-slate-500">{entry.celula}</td>
                    <td className="px-4 py-3">{entry.pousos}</td>
                    <td className="px-4 py-3">{entry.fuel_added}L</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={() => handleDeleteEntry(entry.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-slate-400">
                      Nenhum voo registrado para este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Novo Voo (Simplificado para Exemplo) */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Plane className="w-5 h-5 text-blue-600" /> Registrar Novo Voo
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowAddForm(false)}><X className="w-5 h-5" /></Button>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={newEntry.entry_date} onChange={e => setNewEntry({...newEntry, entry_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Origem (DEP)</Label>
                  <Input placeholder="Ex: SBMT" value={newEntry.departure_aerodrome} onChange={e => setNewEntry({...newEntry, departure_aerodrome: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-2">
                  <Label>Destino (ARR)</Label>
                  <Input placeholder="Ex: SDCO" value={newEntry.arrival_aerodrome} onChange={e => setNewEntry({...newEntry, arrival_aerodrome: e.target.value.toUpperCase()})} />
                </div>

                <div className="space-y-2">
                  <Label>Acionamento</Label>
                  <Input type="time" value={newEntry.ac_time} onChange={e => setNewEntry({...newEntry, ac_time: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Decolagem</Label>
                  <Input type="time" value={newEntry.dep_time} onChange={e => setNewEntry({...newEntry, dep_time: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Pouso</Label>
                  <Input type="time" value={newEntry.pou_time} onChange={e => setNewEntry({...newEntry, pou_time: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Corte</Label>
                  <Input type="time" value={newEntry.cor_time} onChange={e => setNewEntry({...newEntry, cor_time: e.target.value})} />
                </div>
                
                <div className="space-y-2 bg-blue-50 p-3 rounded-md border border-blue-100">
                  <Label className="text-blue-700">Tempo Total (Decimal)</Label>
                  <div className="text-2xl font-bold text-blue-600">{newEntry.total_time}h</div>
                </div>
                <div className="space-y-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                  <Label>Nova Célula</Label>
                  <div className="text-2xl font-bold text-slate-700">{newEntry.celula}</div>
                </div>
              </div>

              <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancelar</Button>
                <Button onClick={handleSaveEntry} className="bg-blue-600 hover:bg-blue-700 px-8">
                  <Save className="w-4 h-4 mr-2" /> Salvar Voo
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DiarioBordoDetalhes;