import { useState, useEffect } from 'react';
import {
  Plane, Clock, RotateCcw, Wrench, FileText, Package,
  AlertTriangle, BookOpen, BarChart3, Droplets, ChevronLeft,
  ArrowLeft, Map
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { OASTab } from '@/components/ctm/OASTab';
import { OrcamentosTab } from '@/components/ctm/OrcamentosTab';
import { RASTab } from '@/components/ctm/RASTab';
import { ComponentesTab } from '@/components/ctm/ComponentesTab';
import { MapaComponenteTab } from '@/components/ctm/MapaComponenteTab';
import { DiarioTab } from '@/components/ctm/DiarioTab';
import { RastreamentoTab } from '@/components/ctm/RastreamentoTab';
import { AnaliseOleoTab } from '@/components/ctm/AnaliseOleoTab';
import { DirectivesTab } from '@/components/ctm/DirectivesTab';
import { cn } from '@/lib/utils';

type AppPage = string; // placeholder

interface CTMAircraftDetailProps {
  aircraft: {
    id: string;
    matricula: string;
    fabricante?: string;
    modelo?: string;
    numero_serie?: string;
    status?: string;
    url_imagem?: string | null;
    base?: string | null;
    ano?: string | null;
  };
  onBack: () => void;
}

interface AircraftData {
  id: string;
  matricula: string;
  fabricante: string;
  modelo: string;
  numero_serie: string;
  status: string;
  url_imagem: string | null;
  base: string | null;
  ano: string | null;
}

interface Stats {
  totalHours: number;
  totalLandings: number;
  openOAS: number;
  pendingApprovals: number;
  logbookData?: any[];
}

export function AircraftDetail({ aircraftId, registration, navigate }: AircraftDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('visao');
  const [aircraft, setAircraft] = useState<AircraftData | null>(null);
  const [stats, setStats] = useState<Stats>({ totalHours: 0, totalLandings: 0, openOAS: 0, pendingApprovals: 0 });
  const [loading, setLoading] = useState(true);
  const [hoursType, setHoursType] = useState<'tempo_total' | 'horas_totais'>('horas_totais');

  useEffect(() => {
    loadAircraftData();
  }, [aircraftId]);

  useEffect(() => {
    // Recalcular horas quando o tipo muda
    if (stats.logbookData) {
      let totalH = 0;
      stats.logbookData.forEach(e => {
        totalH += Number(hoursType === 'tempo_total' ? (e.tempo_total || 0) : (e.horas_totais || 0));
      });
      setStats(prev => ({ ...prev, totalHours: totalH }));
    }
  }, [hoursType]);

  async function loadAircraftData() {
    const [aircraftRes, logbookRes, oasRes] = await Promise.all([
      supabase.from('aeronave').select('*').eq('id', aircraftId).single(),
      supabase.from('lancamentos_diario_bordo').select('horas_totais, tempo_total, pousos_total').eq('aeronave_id', aircraftId),
      supabase.from('ctm_ordem_acompanhamento_servico').select('id, status').eq('aeronave_id', aircraftId),
    ]);

    console.log('aircraft:', aircraftRes.data, aircraftRes.error);
    if (aircraftRes.data) setAircraft(aircraftRes.data);

    let totalH = 0, totalL = 0;
    if (logbookRes.data) {
      logbookRes.data.forEach(e => {
        totalH += Number(e.horas_totais || 0);
        totalL += Number(e.pousos_total || 0);
      });
    }

    const openOAS = oasRes.data?.filter(o => o.status !== 'concluida' && o.status !== 'cancelada').length || 0;

    setStats({ totalHours: totalH, totalLandings: totalL, openOAS, pendingApprovals: 0, logbookData: logbookRes.data || [] });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-ctm-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 animate-fade-in">
      {/* Aircraft Header */}
      <div className="ctm-card p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left: info */}
          <div className="flex items-center gap-4 flex-1">
            {aircraft?.url_imagem && (
              <img 
                src={aircraft.url_imagem} 
                alt={registration}
                className="h-20 w-32 object-cover rounded-xl border border-border"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-white">{registration}</h1>
                <span className="badge-active">ATIVO</span>
              </div>
              <p className="text-muted-foreground mt-1">
                {aircraft?.fabricante} {aircraft?.modelo}
                {aircraft?.ano && ` · ${aircraft.ano}`}
              </p>
              {aircraft?.numero_serie && (
                <p className="text-xs text-muted-foreground font-mono mt-1">S/N: {aircraft.numero_serie}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 flex-wrap">
            <StatPill icon={Clock} label="Horas Célula" value={`${stats.totalHours.toFixed(1)}h`} color="teal" />
            <StatPill icon={RotateCcw} label="Pousos" value={String(stats.totalLandings)} color="blue" />
            <StatPill icon={FileText} label="OAS Abertas" value={String(stats.openOAS)} color={stats.openOAS > 0 ? 'orange' : 'green'} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto ctm-scroll pb-2 mb-6">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap',
                activeTab === tab.id ? 'ctm-tab-active' : 'ctm-tab'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'visao' && <VisaoGeral aircraftId={aircraftId} stats={stats} registration={registration} setTab={setActiveTab} hoursType={hoursType} setHoursType={setHoursType} />}
        {activeTab === 'oas' && <OASTab aircraftId={aircraftId} />}
        {activeTab === 'orcamentos' && <OrcamentosTab aircraftId={aircraftId} />}
        {activeTab === 'ras' && <RASTab aircraftId={aircraftId} />}
        {activeTab === 'componentes' && <ComponentesTab aircraftId={aircraftId} />}
        {activeTab === 'mapa-componente' && <MapaComponenteTab aircraftId={aircraftId} />}
        {activeTab === 'diario' && <DiarioTab aircraftId={aircraftId} registration={registration} />}
        {activeTab === 'rastreamento' && <RastreamentoTab aircraftId={aircraftId} />}
        {activeTab === 'oleo' && <AnaliseOleoTab aircraftId={aircraftId} />}
        {activeTab === 'directives' && <DirectivesTab aircraftId={aircraftId} />}
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    teal: 'text-ctm-teal bg-[hsl(var(--ctm-teal)/0.1)] border-[hsl(var(--ctm-teal)/0.2)]',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div className={cn('flex items-center gap-2.5 px-4 py-2.5 rounded-xl border', colorMap[color] || colorMap.teal)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function VisaoGeral({ aircraftId, stats, registration, setTab, hoursType, setHoursType }: {
  aircraftId: string; stats: Stats; registration: string; setTab: (t: TabId) => void; hoursType: 'tempo_total' | 'horas_totais'; setHoursType: (t: 'tempo_total' | 'horas_totais') => void;
}) {
  const [recentOAS, setRecentOAS] = useState<any[]>([]);
  const [recentRAS, setRecentRAS] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('ctm_ordem_acompanhamento_servico')
      .select('*').eq('aeronave_id', aircraftId).order('criado_em', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setRecentOAS(data); });

    supabase.from('ras')
      .select('*').eq('aeronave_id', aircraftId).order('criado_em', { ascending: false }).limit(5)
      .then(({ data }) => { if (data) setRecentRAS(data); });
  }, [aircraftId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* OAS Recentes */}
      <div className="ctm-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-ctm-teal" /> OAS Recentes
          </h3>
          <button onClick={() => setTab('oas')} className="text-xs text-ctm-teal hover:underline">Ver todas</button>
        </div>
        {recentOAS.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma OAS registrada</p>
        ) : (
          <div className="space-y-2">
            {recentOAS.map(oas => (
              <div key={oas.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div>
                  <p className="text-sm font-medium">OAS #{oas.numero}</p>
                  <p className="text-xs text-muted-foreground">{oas.tipo_manutencao} · {oas.mecanico_responsavel || 'N/A'}</p>
                </div>
                <StatusBadge status={oas.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RAS Recentes */}
      <div className="ctm-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-ctm-teal" /> RAS Recentes
          </h3>
          <button onClick={() => setTab('ras')} className="text-xs text-ctm-teal hover:underline">Ver todos</button>
        </div>
        {recentRAS.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum RAS registrado</p>
        ) : (
          <div className="space-y-2">
            {recentRAS.map(ras => (
              <div key={ras.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div>
                  <p className="text-sm font-medium">RAS #{ras.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    {ras.tipo_manutencao} · R$ {Number(ras.total_geral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <StatusBadge status={ras.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="ctm-card p-5 lg:col-span-2">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-ctm-teal" /> Resumo Operacional
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-secondary rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Horas de Célula</p>
                <p className="text-xl font-bold">{`${stats.totalHours.toFixed(1)}h`}</p>
              </div>
              <select
                value={hoursType}
                onChange={(e) => setHoursType(e.target.value as 'tempo_total' | 'horas_totais')}
                className="ml-2 px-2 py-1 text-xs bg-primary border border-border rounded cursor-pointer"
              >
                <option value="horas_totais">T. Voo</option>
                <option value="tempo_total">T. Total</option>
              </select>
            </div>
          </div>
          <QuickStat label="OAS em Aberto" value={String(stats.openOAS)} highlight={stats.openOAS > 0} />
          <QuickStat label="Aeronave" value={registration} />
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-secondary rounded-xl p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-xl font-bold', highlight ? 'text-orange-400' : 'text-white')}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (!status) return <span className="badge-pending">N/D</span>;
  const s = status.toLowerCase();
  if (s.includes('conclu') || s.includes('complet')) return <span className="badge-ok">Concluída</span>;
  if (s.includes('cancel')) return <span className="badge-expired">Cancelada</span>;
  if (s.includes('andament') || s.includes('progress')) return <span className="badge-teal">Em Andamento</span>;
  return <span className="badge-pending">{status}</span>;
}
