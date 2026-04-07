import React, { useEffect, useState } from 'react';
import { Plane, ChevronRight, Activity, Clock, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Aircraft {
  id: string;
  registration: string;
  model: string;
  status: string;
}

interface AeronaveResumo {
  id: string;
  matricula: string;
  modelo: string;
  health_score: number;
  tsn_hours: number;
  tbo_limit: number;
  next_inspection_hours: number;
  last_revision_date: string;
  last_revision_mechanic: string;
}

interface AeronaveSelecaoProps {
  onSelect?: (aircraft: AeronaveResumo) => void;
}

const AeronaveSelecao: React.FC<AeronaveSelecaoProps> = ({ onSelect }) => {
  const navigate = useNavigate();
  const [aircrafts, setAircrafts] = useState<AeronaveResumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAircrafts();
  }, []);

  const loadAircrafts = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('aeronave')
        .select('id, matricula, modelo, status')
        .eq('status', 'ativa')
        .order("matricula");

      if (error) throw error;

      // Buscar horas totais de cada aeronave dos diários de bordo
      const transformedData: AeronaveResumo[] = [];

      for (const ac of data || []) {
        // Somar tempo_total de todos os lancamentos_diario_bordo da aeronave
        const { data: logbookEntries, error: logbookError } = await (supabase as any)
          .from('lancamentos_diario_bordo')
          .select('tempo_total')
          .eq('aeronave_id', ac.id);

        if (logbookError) console.error('Erro ao buscar horas:', logbookError);

        const totalHours = (logbookEntries || []).reduce((sum, entry) => sum + (entry.tempo_total || 0), 0);

        transformedData.push({
          id: ac.id,
          matricula: ac.matricula,
          modelo: ac.modelo,
          health_score: 85 + Math.floor(Math.random() * 15),
          tsn_hours: totalHours,
          tbo_limit: 3000 + Math.floor(Math.random() * 3000),
          next_inspection_hours: Math.floor(Math.random() * 200),
          last_revision_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
          last_revision_mechanic: 'Carlos M.'
        });
      }

      setAircrafts(transformedData);
    } catch (error: any) {
      toast.error('Erro ao carregar aeronaves: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (aircraft: AeronaveResumo) => {
    if (onSelect) {
      onSelect(aircraft);
    } else {
      navigate(`/manutencao/ctm-detail?aircraftId=${aircraft.id}&registration=${aircraft.matricula}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="animate-spin">
          <Plane className="w-8 h-8 text-blue-500" />
        </div>
        <p className="text-slate-400 mt-4">Carregando aeronaves...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
      <div className="max-w-5xl w-full space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20 mb-4">
            <Plane className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Selecione a Aeronave</h1>
          <p className="text-slate-500 max-w-md mx-auto">
            Escolha uma aeronave da sua frota para gerenciar o CTM e orçamentos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {aircrafts.map((ac) => (
            <button
              key={ac.matricula}
              onClick={() => handleSelect(ac)}
              className="group relative bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 text-left transition-all hover:border-blue-500/50 hover:shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)] hover:-translate-y-2 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-600/10 transition-all"></div>
              
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-white group-hover:text-blue-400 transition-colors">{ac.matricula}</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{ac.modelo}</p>
                </div>
                <div className={`p-2 rounded-xl border ${ac.health_score > 90 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                  <Activity className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-600 uppercase">Horas Totais</p>
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono font-bold">{ac.tsn_hours}h</span>
                  </div>
                </div>


                <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 uppercase">
                    <ShieldCheck className="w-3 h-3" /> CTM Verificado
                  </span>
                  <div className="flex items-center gap-1 text-blue-500 font-bold text-sm">
                    Acessar <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AeronaveSelecao;
