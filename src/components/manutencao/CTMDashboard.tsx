import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Droplet,
  Wrench,
  Search,
  Activity,
  ShieldCheck,
  Maximize2,
  Plane,
  Loader2,
  Zap,
  Plus
} from 'lucide-react';
import OilAnalysisDialog from './OilAnalysisDialog';
import { 
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  health_score?: number;
  tsn_hours?: number;
  tbo_limit?: number;
  next_inspection_hours?: number;
  last_revision_date?: string | null;
  last_revision_mechanic?: string | null;
}

interface ComponentData {
  id: string;
  name: string;
  status: string;
  health: number;
  info: string;
  top: string;
  left: string;
  type: string;
}

interface OilAnalysis {
  date: string;
  fe: number;
  cu: number;
  al: number;
  si: number;
  viscosity: number;
}

const CTMDashboard: React.FC<{ aircraft: Aircraft; aircraftId: string }> = ({ aircraft, aircraftId }) => {
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [oilTrend, setOilTrend] = useState<OilAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickingPosition, setPickingPosition] = useState(false);
  const [selectedComponentForPositioning, setSelectedComponentForPositioning] = useState<string | null>(null);
  const [newComponentName, setNewComponentName] = useState('');
  const [newComponentType, setNewComponentType] = useState('component_health');
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [showOilAnalysisDialog, setShowOilAnalysisDialog] = useState(false);
  const [stats, setStats] = useState({
    healthScore: aircraft.health_score || 0,
    totalHours: aircraft.tsn_hours || 0,
    nextInspectionHours: aircraft.next_inspection_hours || 0,
    lastRevisionDate: aircraft.last_revision_date,
    lastRevisionMechanic: aircraft.last_revision_mechanic,
  });

  useEffect(() => {
    loadDashboardData();
  }, [aircraftId]);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (pickingPosition || selectedComponentForPositioning)) {
        setPickingPosition(false);
        setSelectedComponentForPositioning(null);
      }
    };
    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [pickingPosition, selectedComponentForPositioning]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pickingPosition && !selectedComponentForPositioning) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (selectedComponentForPositioning) {
      setComponents(components.map(comp =>
        comp.id === selectedComponentForPositioning
          ? { ...comp, left: `${x.toFixed(1)}%`, top: `${y.toFixed(1)}%` }
          : comp
      ));
      setSelectedComponentForPositioning(null);
    }
    setPickingPosition(false);
  };

  const addNewComponent = () => {
    if (!newComponentName.trim()) return;

    const newComponent: ComponentData = {
      id: `comp-${Date.now()}`,
      name: newComponentName,
      status: 'ok',
      health: 85,
      info: `${newComponentType} | Novo componente`,
      top: '50%',
      left: '50%',
      type: newComponentType,
    };

    setComponents([...components, newComponent]);
    setNewComponentName('');
    setShowAddComponent(false);
  };

  const deleteComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Buscar componentes do CTM
      const { data: ctmData, error: ctmError } = await supabase
        .from('ctm_tracking')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!ctmError && ctmData && ctmData.length > 0) {
        const mappedComponents = ctmData.map((item, idx) => ({
          id: item.id,
          name: item.item_name,
          status: item.remaining_hours && item.remaining_hours < 50 ? 'warning' : 'ok',
          health: item.remaining_hours ? Math.min(100, item.remaining_hours) : 80,
          info: `${item.control_type} | Restantes: ${item.remaining_hours || 0}h`,
          top: `${30 + (idx % 3) * 20}%`,
          left: `${20 + (idx % 5) * 15}%`,
          type: item.control_type,
        }));
        setComponents(mappedComponents);
      } else {
        // Componentes padrão se não houver dados
        setComponents([
          { id: 'eng-l', name: 'Motor Esquerdo (PT6A)', status: 'ok', health: 90, info: 'Engine | TSN: 3389h', top: '44%', left: '26%', type: 'component_health' },
          { id: 'eng-r', name: 'Motor Direito (PT6A)', status: 'ok', health: 88, info: 'Engine | TSN: 3380h', top: '44%', left: '74%', type: 'component_health' },
          { id: 'oil', name: 'Sistema de Óleo', status: 'ok', health: 95, info: 'Oil Change | Próx: 50h', top: '30%', left: '50%', type: 'oil_change' },
        ]);
      }

      // Buscar análise de óleo (se houver tabela)
      const { data: oilData } = await supabase
        .from('oil_analysis')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('date', { ascending: true })
        .limit(5);

      if (oilData && oilData.length > 0) {
        setOilTrend(oilData);
      } else {
        // Dados padrão
        setOilTrend([
          { date: 'Mês -4', fe: 8, cu: 2, al: 1, si: 3, viscosity: 14.5 },
          { date: 'Mês -3', fe: 9, cu: 3, al: 2, si: 4, viscosity: 14.4 },
          { date: 'Mês -2', fe: 10, cu: 3, al: 2, si: 5, viscosity: 14.5 },
          { date: 'Mês -1', fe: 11, cu: 4, al: 2, si: 5, viscosity: 14.3 },
          { date: 'Atual', fe: 12, cu: 4, al: 3, si: 6, viscosity: 14.2 },
        ]);
      }

    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOilAnalysisData = async () => {
    try {
      const { data: oilData } = await supabase
        .from('oil_analysis')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('date', { ascending: true })
        .limit(5);

      if (oilData && oilData.length > 0) {
        setOilTrend(oilData);
      }
    } catch (err) {
      console.error('Error loading oil analysis data:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando Dashboard CTM...</p>
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      label: 'SAÚDE DA AERONAVE',
      value: `${stats.healthScore}%`,
      status: stats.healthScore > 80 ? 'Excelente' : 'Atenção',
      color: stats.healthScore > 80 ? 'text-emerald-400' : 'text-amber-400',
      bg: stats.healthScore > 80 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
    },
    {
      label: 'HORAS TOTAIS (TSN)',
      value: `${stats.totalHours.toFixed(1)}h`,
      sub: 'Registradas nos diários',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'PRÓXIMA INSPEÇÃO',
      value: stats.nextInspectionHours > 0 ? `${stats.nextInspectionHours}h` : '—',
      sub: stats.nextInspectionHours > 0 ? 'Restantes' : 'Sem agendamento',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'ÚLTIMA REVISÃO',
      value: stats.lastRevisionDate ? new Date(stats.lastRevisionDate).toLocaleDateString('pt-BR') : '—',
      sub: stats.lastRevisionMechanic ? `Mecânico: ${stats.lastRevisionMechanic}` : 'Sem registro',
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
    },
  ];

  const latestOil = oilTrend[oilTrend.length - 1];
  const alertComponents = components.filter(c => c.status === 'warning');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 ${stat.bg} rounded-full blur-3xl opacity-50 transition-opacity group-hover:opacity-100`}></div>
            <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-4 block">{stat.label}</span>
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
            </div>
            {stat.sub && <p className="text-[11px] text-slate-400">{stat.sub}</p>}
            {stat.status && <p className={`text-[11px] font-bold mt-2 ${stat.color}`}>{stat.status}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Mapa de Componentes */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden flex flex-col relative min-h-[500px] shadow-2xl">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Plane className="text-blue-400 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Mapa de Componentes CTM</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{aircraft.model} | {aircraft.registration}</p>
              </div>
            </div>
            <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex flex-col md:flex-row bg-[#020617] relative">
            <div className="flex-1 relative flex items-center justify-center p-12 overflow-hidden">
              <div
                className={`relative w-full h-full max-w-[400px] flex items-center justify-center transition-all ${
                  pickingPosition || selectedComponentForPositioning
                    ? 'cursor-crosshair ring-2 ring-blue-500/50 rounded-2xl'
                    : 'cursor-default'
                }`}
                onClick={handleMapClick}
              >
                {/* Aeronave SVG */}
                <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800 fill-slate-900/30 filter drop-shadow-[0_0_20px_rgba(30,41,59,0.8)]">
                  <path d="M50 5 C56 5 58 15 58 35 L 58 85 C 58 92 54 95 50 95 C 46 95 42 92 42 85 L 42 35 C 42 15 44 5 50 5 Z" stroke="currentColor" strokeWidth="0.4" />
                  <path d="M 50 30 L 95 45 L 95 55 L 50 45 L 5 55 L 5 45 Z" stroke="currentColor" strokeWidth="0.4" />
                  <path d="M 50 85 L 75 92 L 75 96 L 50 90 L 25 96 L 25 92 Z" stroke="currentColor" strokeWidth="0.4" />
                  <rect x="22" y="38" width="8" height="15" rx="4" fill="#0f172a" stroke="currentColor" strokeWidth="0.4" />
                  <rect x="70" y="38" width="8" height="15" rx="4" fill="#0f172a" stroke="currentColor" strokeWidth="0.4" />
                </svg>

                {/* Componentes interativos */}
                {components.map((comp) => (
                  <div
                    key={comp.id}
                    onMouseEnter={() => !selectedComponentForPositioning && setActiveComponent(comp.id)}
                    onMouseLeave={() => !selectedComponentForPositioning && setActiveComponent(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedComponentForPositioning(comp.id);
                      setPickingPosition(true);
                    }}
                    className={`absolute group/spot transition-all duration-300 ${
                      selectedComponentForPositioning === comp.id ? 'z-40 scale-150 cursor-move' : 'z-20 cursor-pointer'
                    } ${activeComponent === comp.id && !selectedComponentForPositioning ? 'scale-150' : 'scale-100'}`}
                    style={{ top: comp.top, left: comp.left, transform: 'translate(-50%, -50%)' }}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border-2 border-slate-950 flex items-center justify-center relative shadow-lg ${
                      selectedComponentForPositioning === comp.id ? 'bg-blue-500 ring-2 ring-blue-300 animate-pulse' :
                      comp.status === 'warning' ? 'bg-amber-500 animate-pulse' : 'bg-green-500'
                    }`}>
                      {(comp.status === 'warning' || selectedComponentForPositioning === comp.id) &&
                        <div className="absolute inset-0 rounded-full animate-ping bg-current/50"></div>
                      }
                    </div>

                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover/spot:opacity-100 transition-all translate-y-2 group-hover/spot:translate-y-0 pointer-events-none z-30">
                      <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl min-w-[220px] backdrop-blur-xl">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{comp.type}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${comp.health > 80 ? 'bg-green-500/10 text-green-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            {comp.health}% Health
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100 mb-1">{comp.name}</h4>
                        <p className="text-[10px] text-slate-400 mb-2 font-mono">{comp.info}</p>
                        <p className="text-[9px] text-blue-400 font-mono mb-2">↑ Clique para reposicionar</p>
                        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${comp.health > 80 ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${comp.health}%` }} />
                        </div>
                      </div>
                      <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 mx-auto -mt-1.5"></div>
                    </div>
                  </div>
                ))}

                {/* Picking Position Indicator */}
                {(pickingPosition || selectedComponentForPositioning) && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-sm font-bold text-blue-400 mb-2">Clique no mapa para posicionar</p>
                      <div className="animate-pulse text-blue-500">+</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full md:w-72 border-l border-slate-800 flex flex-col bg-slate-900/30">
              <div className="p-4 border-b border-slate-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtrar componentes..."
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30 text-slate-200"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
                <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2 px-2">Componentes CTM</h4>
                {components.length === 0 ? (
                  <p className="text-[9px] text-slate-500 text-center py-4">Nenhum componente adicionado</p>
                ) : (
                  components.map((c) => (
                    <div
                      key={c.id}
                      onMouseEnter={() => !selectedComponentForPositioning && setActiveComponent(c.id)}
                      onMouseLeave={() => !selectedComponentForPositioning && setActiveComponent(null)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all group/item ${
                        selectedComponentForPositioning === c.id
                          ? 'bg-blue-600/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
                          : activeComponent === c.id
                          ? 'bg-blue-600/10 border-blue-500/40 shadow-lg shadow-blue-500/5'
                          : c.status === 'warning'
                          ? 'bg-amber-500/5 border-amber-500/20'
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => {
                          setActiveComponent(c.id);
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full ${c.status === 'warning' ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                        <div>
                          <p className={`text-xs font-bold transition-colors ${activeComponent === c.id || selectedComponentForPositioning === c.id ? 'text-blue-400' : 'text-slate-200'}`}>
                            {c.name}
                          </p>
                          <p className="text-[9px] text-slate-500 font-mono">Health: {c.health}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setSelectedComponentForPositioning(c.id);
                            setPickingPosition(true);
                          }}
                          className="p-1.5 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-colors text-[8px]"
                          title="Reposicionar"
                        >
                          ↗
                        </button>
                        <button
                          onClick={() => deleteComponent(c.id)}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors text-[8px]"
                          title="Deletar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-slate-950/50 border-t border-slate-800 space-y-2">
                {showAddComponent ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nome do componente"
                      value={newComponentName}
                      onChange={(e) => setNewComponentName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-600"
                    />
                    <select
                      value={newComponentType}
                      onChange={(e) => setNewComponentType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="component_health">Componente</option>
                      <option value="oil_change">Óleo</option>
                      <option value="inspection">Inspeção</option>
                      <option value="maintenance">Manutenção</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={addNewComponent}
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
                      >
                        Adicionar
                      </button>
                      <button
                        onClick={() => {
                          setShowAddComponent(false);
                          setNewComponentName('');
                        }}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowAddComponent(true)}
                      className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                    >
                      + Novo Componente
                    </button>
                    <button className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 uppercase tracking-widest">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      Laudo Técnico
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Análise e Alertas */}
        <div className="space-y-6">
          {/* Análise de Óleo */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden group relative">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                  <Droplet className="text-blue-400 w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Análise de Óleo (SOAP)</h4>
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{aircraft.registration}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20 uppercase">
                <span className="w-1 h-1 rounded-full bg-emerald-400"></span> Normal
              </div>
            </div>

            <div className="p-6 space-y-4">
              {latestOil && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Ferro (Fe)', val: latestOil.fe, unit: 'ppm' },
                    { label: 'Cobre (Cu)', val: latestOil.cu, unit: 'ppm' },
                    { label: 'Alumínio (Al)', val: latestOil.al, unit: 'ppm' },
                    { label: 'Silício (Si)', val: latestOil.si, unit: 'ppm' },
                  ].map((m, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter mb-1">{m.label}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-100">{m.val}</span>
                        <span className="text-[8px] text-slate-600 font-bold uppercase">{m.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="h-32 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={oilTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="date" hide />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }} />
                    <Line type="monotone" dataKey="fe" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowOilAnalysisDialog(true)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 uppercase tracking-widest">
                  <Plus className="w-3.5 h-3.5" /> Nova Análise
                </button>
                <button className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 uppercase tracking-widest">
                  <Activity className="w-3.5 h-3.5" /> Ver Laudo
                </button>
              </div>
            </div>
          </div>

          {/* Alertas */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
            <h4 className="font-bold mb-4 flex items-center gap-2 uppercase text-xs tracking-widest">
              <Zap className="text-yellow-500 w-4 h-4" /> Alertas do Sistema
            </h4>
            <div className="space-y-3">
              {alertComponents.length > 0 ? (
                alertComponents.map(c => (
                  <div key={c.id} className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-500">{c.name}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{c.info}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <p className="text-xs font-bold text-emerald-500">✓ Nenhum alerta crítico detectado.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showOilAnalysisDialog && (
        <OilAnalysisDialog
          aircraftId={aircraftId}
          onClose={() => setShowOilAnalysisDialog(false)}
          onSave={loadOilAnalysisData}
        />
      )}
    </div>
  );
};

export default CTMDashboard;
