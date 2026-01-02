import React, { useEffect, useState } from 'react';
import { Users, FileSpreadsheet, Download, ExternalLink, Calculator, TrendingUp, Receipt, CreditCard, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RateioDespesa {
  id: string;
  aircraft_id: string;
  description: string;
  amount: number;
  status?: string;
  created_at?: string;
  client_name?: string;
  percentual?: number;
  valor_rateado?: number;
}

const ExpenseSplitting: React.FC<{ aircraftId?: string }> = ({ aircraftId }) => {
  const [splits, setSplits] = useState<RateioDespesa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSplits() {
      try {
        let query = supabase.from('rateio_despesas').select('*');
        if (aircraftId) query = query.eq('aeronave_id', aircraftId);

        const { data, error } = await query;
        if (error) throw error;
        setSplits(data || []);
      } catch (error) {
        console.error('Erro Rateio:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSplits();
  }, [aircraftId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'pendente': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold">Rateio de Despesas Real</h2>
          <p className="text-slate-500 text-sm">Distribuição proporcional baseada na tabela rateio_despesas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-blue-500/10 rounded-xl"><Users className="w-5 h-5 text-blue-400" /></div>
              <h3 className="font-bold">Distribuição Mensal</h3>
            </div>

            <div className="space-y-6">
              {splits.map((s) => (
                <div key={s.id}>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">{s.client_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold">{s.percentual}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-blue-400">R$ {s.valor_rateado.toLocaleString()}</span>
                      <span className={`block text-[9px] font-bold uppercase px-2 py-0.5 rounded border mt-1 ${getStatusBadge(s.status)}`}>
                        {s.status}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${s.percentual}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseSplitting;
