import React, { useEffect, useState } from 'react';
import { Search, Filter, ArrowUpRight, Clock, Calendar, ClipboardList, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CTMTracking {
  id: string;
  aircraft_id: string;
  control_type: string;
  item_name: string;
  remaining_hours?: number | null;
  last_change_date?: string | null;
  last_change_hours?: number | null;
  left_value?: string | null;
  right_value?: string | null;
  service_order_number?: string | null;
  month: number;
  year: number;
  created_at?: string;
  status?: string;
  statusColor?: string;
}

const MaintenanceTracking: React.FC<{ aircraftId?: string }> = ({ aircraftId }) => {
  const [items, setItems] = useState<CTMTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchTracking() {
      try {
        let query = supabase.from('ctm_tracking').select('*');
        if (aircraftId) query = query.eq('aircraft_id', aircraftId);

        const { data, error } = await query.order('item_name');
        if (error) throw error;

        // Enriquecer com lógica de status se o banco não trouxer pronto
        const enriched = (data || []).map(item => ({
          ...item,
          status: item.remaining_hours && item.remaining_hours < 50 ? 'Crítico' :
            item.remaining_hours && item.remaining_hours < 100 ? 'Atenção' : 'Normal',
          statusColor: item.remaining_hours && item.remaining_hours < 50 ? 'bg-red-500' :
            item.remaining_hours && item.remaining_hours < 100 ? 'bg-amber-500' : 'bg-green-500'
        }));

        setItems(enriched);
      } catch (error) {
        console.error('Erro CTM:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTracking();
  }, [aircraftId]);

  const filteredItems = items.filter(i =>
    i.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Rastreamento CTM</h2>
          <p className="text-slate-500 text-sm">Monitoramento técnico sincronizado com o banco de dados.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50 w-64"
            />
          </div>
          <button className="bg-slate-900 border border-slate-800 p-2 rounded-lg text-slate-400 hover:text-slate-100 transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 bg-slate-900/50">
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Item CTM</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Controle</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Esq / Dir</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Última Intervenção</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">OAS / Doc</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Restante</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Status</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredItems.map((item, i) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-200">{item.item_name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-bold uppercase tracking-widest">{item.control_type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5 font-mono text-xs">
                      <span className="text-blue-400">L: {item.left_value || '-'}</span>
                      <span className="text-slate-500">R: {item.right_value || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {item.last_change_date ? new Date(item.last_change_date).toLocaleDateString() : '-'}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3 h-3" />
                        {item.last_change_hours}h TSN
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-blue-500 font-bold text-[11px] hover:underline cursor-pointer">
                      <ClipboardList className="w-3.5 h-3.5" />
                      {item.service_order_number || 'S/N'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`font-mono font-bold ${item.status === 'Crítico' ? 'text-red-400' : 'text-slate-200'}`}>
                        {item.remaining_hours}h
                      </span>
                      <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${item.statusColor}`} style={{ width: '60%' }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Normal' ? 'bg-green-500/10 text-green-400' :
                        item.status === 'Atenção' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-red-500/10 text-red-400'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'Normal' ? 'bg-green-400' :
                          item.status === 'Atenção' ? 'bg-amber-400' :
                            'bg-red-400'
                        }`} />
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-700 rounded-lg transition-all text-slate-400 hover:text-white">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceTracking;
