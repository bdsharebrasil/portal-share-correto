import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ManutencaoRow } from '@/services/manutencoes';

interface LogbookMonthData {
  celula_anterior?: number | null;
  celula_atual?: number | null;
  celula_prox_revisao?: number | null;
  celula_disponivel?: number | null;
}

interface NextMaintenanceScheduleProps {
  aircraftId: string;
  aircraftRegistration: string;
  onDataChange?: () => void;
}

export function NextMaintenanceSchedule({
  aircraftId,
  aircraftRegistration,
  onDataChange,
}: NextMaintenanceScheduleProps) {
  const [nextMaintenance, setNextMaintenance] = useState<ManutencaoRow | null>(null);
  const [logbookData, setLogbookData] = useState<LogbookMonthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!aircraftId) return;

    console.log('NextMaintenanceSchedule: Loading data for aircraft:', aircraftId);
    loadAllData();

    // Subscribe to real-time updates for both tables
    const subscription1 = supabase
      .channel(`manutencoes:${aircraftId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'manutencoes',
          filter: `aeronave_id=eq.${aircraftId}`,
        },
        () => {
          console.log('NextMaintenanceSchedule: Real-time update detected (manutencoes)');
          loadAllData();
          onDataChange?.();
        }
      )
      .subscribe();

    const subscription2 = supabase
      .channel(`diario_mes:${aircraftId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'diario_mes',
          filter: `aeronave_id=eq.${aircraftId}`,
        },
        () => {
          console.log('NextMaintenanceSchedule: Real-time update detected (diario_mes)');
          loadAllData();
          onDataChange?.();
        }
      )
      .subscribe();

    return () => {
      subscription1.unsubscribe();
      subscription2.unsubscribe();
    };
  }, [aircraftId, onDataChange]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Try to load from manutencoes first
      console.log('NextMaintenanceSchedule: Fetching data for aircraft:', aircraftId);

      const { data: manutencoes, error: manutError } = await supabase
        .from('manutencoes')
        .select('*')
        .eq('aircraft_id', aircraftId)
        .order('updated_at', { ascending: false });

      if (!manutError && manutencoes && manutencoes.length > 0) {
        // Filter for hour-based maintenances
        const hourMaintenances = manutencoes.filter((m: any) => {
          const isHourType = m.vencimento_tipo && m.vencimento_tipo.toLowerCase().trim() === 'horas';
          const hasHours = m.vencimento_horas && m.vencimento_horas > 0;
          return isHourType && hasHours;
        });

        if (hourMaintenances.length > 0) {
          const nextData = hourMaintenances[0] as ManutencaoRow;
          setNextMaintenance(nextData);
          setLogbookData(null);
          console.log('NextMaintenanceSchedule: Loaded from manutencoes:', nextData.tipo);
          return;
        }
      }

      // Fallback to diario_mes
      console.log('NextMaintenanceSchedule: Fetching from diario_mes');
      const { data: logbookMonths, error: logError } = await supabase
        .from('diario_mes')
        .select('celula_anterior, celula_atual, celula_prox_revisao, celula_disponivel')
        .eq('aeronave_id', aircraftId)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1);

      if (!logError && logbookMonths && logbookMonths.length > 0) {
        const monthData = logbookMonths[0] as LogbookMonthData;
        setLogbookData(monthData);
        setNextMaintenance(null);
        console.log('NextMaintenanceSchedule: Loaded from diario_mes:', {
          celula_prox_revisao: monthData.celula_prox_revisao,
          celula_atual: monthData.celula_atual,
        });
      } else {
        setNextMaintenance(null);
        setLogbookData(null);
        console.warn('NextMaintenanceSchedule: No data found for aircraft:', aircraftId);
      }
    } catch (error) {
      console.error('NextMaintenanceSchedule: Erro ao carregar dados:', error);
      setNextMaintenance(null);
      setLogbookData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/30 border border-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Carregando dados de manutenção...</p>
        </div>
      </div>
    );
  }

  // Check if we have any data
  if (!nextMaintenance && !logbookData) {
    return null;
  }

  // Use data from logbook if available (it's the current/live data)
  let horasRealizadas = 0;
  let horasDisponiveis = 0;
  let totalProgramado = 0;
  let typeLabel = '';

  if (logbookData) {
    horasRealizadas = logbookData.celula_atual || 0;
    totalProgramado = logbookData.celula_prox_revisao || 0;
    horasDisponiveis = Math.max(0, totalProgramado - horasRealizadas);
    typeLabel = 'Revisão (Logbook)';
  } else if (nextMaintenance) {
    horasRealizadas = nextMaintenance.horas_realizadas || 0;
    totalProgramado = nextMaintenance.vencimento_horas || 0;
    horasDisponiveis = Math.max(0, totalProgramado - horasRealizadas);
    typeLabel = nextMaintenance.tipo;
  }

  const percentualRealizado = ((horasRealizadas / (totalProgramado || 1)) * 100);
  const percentualDisponivel = ((horasDisponiveis / (totalProgramado || 1)) * 100);

  // Determine status and colors
  let status = 'ok';
  let statusLabel = 'Revisão Programada';
  let statusColor = 'bg-green-500/10 border-green-500/30 text-green-400';
  let iconColor = 'text-green-400';
  let Icon = CheckCircle;

  if (horasDisponiveis <= 0) {
    status = 'vencido';
    statusLabel = 'REVISÃO VENCIDA';
    statusColor = 'bg-red-500/20 border-red-500/40 text-red-400';
    iconColor = 'text-red-500';
    Icon = AlertCircle;
  } else if (percentualDisponivel <= 20) {
    status = 'alerta';
    statusLabel = 'PRÓXIMO DO VENCIMENTO';
    statusColor = 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
    iconColor = 'text-yellow-500';
    Icon = AlertTriangle;
  }

  return (
    <div className={`border rounded-lg p-3 backdrop-blur-xl overflow-hidden relative group ${statusColor}`}>
      <div className="relative z-10 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${
              status === 'vencido' ? 'bg-red-500/30' : status === 'alerta' ? 'bg-yellow-500/30' : 'bg-green-500/30'
            }`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">{statusLabel}</p>
              <p className="text-xs opacity-70">{aircraftRegistration}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xl font-black ${iconColor}`}>{percentualRealizado.toFixed(0)}%</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-700/40 rounded-full h-2 overflow-hidden border border-current/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'vencido'
                ? 'bg-red-500'
                : status === 'alerta'
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentualRealizado, 100)}%` }}
          />
        </div>

        {/* Compact info */}
        <div className="flex items-center justify-between text-xs opacity-75 gap-2">
          <span>{horasRealizadas.toFixed(1)}h / {totalProgramado.toFixed(1)}h</span>
          {horasDisponiveis > 0 && <span>{horasDisponiveis.toFixed(1)}h restante</span>}
        </div>
      </div>
    </div>
  );
}
