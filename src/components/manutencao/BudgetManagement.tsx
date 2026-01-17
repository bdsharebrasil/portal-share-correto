import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Eye, Plus, CheckCircle, Clock as ClockIcon,
  Image as ImageIcon, File as FileIcon, FileSpreadsheet, FileArchive,
  AlertCircle, X, Send, Link as LinkIcon, Zap, Edit3, Loader2, Trash2
} from 'lucide-react';
import ServiceOrderDetails from './ServiceOrderDetails';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BudgetItem {
  id: string;
  aircraft_id: string;
  month: number;
  year: number;
  status: 'draft' | 'submitted' | 'approved';
  created_at: string;
  updated_at?: string;
  vendor?: string | null;
  description?: string | null;
  value?: number | null;
  linkedOasNumber?: string | null;
  budget_file_name?: string | null;
  budget_file_path?: string | null;
  oas_file_name?: string | null;
  oas_file_path?: string | null;
  report_file_name?: string | null;
  report_file_path?: string | null;
}

const BudgetStatus = {
  RASCUNHO: 'draft' as const,
  ENVIADO: 'submitted' as const,
  APROVADO: 'approved' as const,
} as const;

const BudgetManagement: React.FC<{ aircraftId?: string }> = ({ aircraftId }) => {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingOasBudget, setViewingOasBudget] = useState<BudgetItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newBudget, setNewBudget] = useState({
    vendor: '',
    description: '',
    value: '',
  });

  useEffect(() => {
    async function fetchBudgets() {
      try {
        let query = supabase.from('ctm_budgets').select('*');
        if (aircraftId) query = query.eq('aircraft_id', aircraftId);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        setBudgets((data || []) as BudgetItem[]);
      } catch (error) {
        console.error('Erro Budgets:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchBudgets();
  }, [aircraftId]);

  const getStatusStyles = (status: BudgetItem['status']) => {
    switch (status) {
      case 'approved':
        return { container: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]', icon: CheckCircle };
      case 'submitted':
        return { container: 'bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-[0_0_15px_-3px_rgba(14,165,233,0.3)]', icon: ClockIcon };
      case 'draft':
        return { container: 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]', icon: Edit3 };
      default:
        return { container: 'bg-slate-700/30 text-slate-400 border-slate-600/50', icon: AlertCircle };
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        aircraft_id: aircraftId,
        vendor: newBudget.vendor,
        description: newBudget.description,
        value: `R$ ${newBudget.value}`,
        status: 'draft',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      };

      const { data, error } = await supabase.from('ctm_budgets').insert([payload]).select();
      if (error) throw error;

      setBudgets([data[0] as BudgetItem, ...budgets]);
      setIsModalOpen(false);
      setNewBudget({ vendor: '', description: '', value: '' });
      toast.success('Orçamento criado com sucesso');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao criar orçamento');
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      const { error } = await supabase.from('ctm_budgets').delete().eq('id', budgetId);
      if (error) throw error;

      setBudgets(budgets.filter(b => b.id !== budgetId));
      setDeletingId(null);
      toast.success('Orçamento deletado com sucesso');
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast.error('Erro ao deletar orçamento');
    }
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Gestão de Orçamentos & OAS</h2>
          <p className="text-slate-500 text-sm">Controle real de aprovações e documentação técnica.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all text-xs border border-slate-700"
          >
            <Plus className="w-4 h-4" /> Novo Orçamento
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 bg-slate-900/50">
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">ID / Data</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Fornecedor / Serviço</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Valor</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Status</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Vínculo Técnico</th>
                <th className="px-6 py-4 font-bold tracking-wider uppercase text-[10px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {budgets.map((b) => {
                const style = getStatusStyles(b.status);
                const Icon = style.icon;
                return (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">{b.id.slice(0, 8)}</span>
                        <span className="text-[10px] text-slate-500">{new Date(b.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-200">{b.vendor || 'N/A'}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[200px]">{b.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-200">{b.value}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border w-fit ${style.container}`}>
                        <Icon className="w-3.5 h-3.5" /> {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {b.linkedOasNumber ? (
                        <span className="text-yellow-500 font-black text-xs">OAS #{b.linkedOasNumber}</span>
                      ) : (
                        <span className="text-slate-600 text-xs italic">Não vinculado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => setViewingOasBudget(b)} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors" title="Visualizar">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(b.id)}
                          className="p-2 bg-red-900/20 border border-red-700/30 rounded-lg text-red-400 hover:bg-red-900/40 transition-colors"
                          title="Deletar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-4">Novo Orçamento</h3>
            <form onSubmit={handleAddBudget} className="space-y-4">
              <input required placeholder="Fornecedor" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100" value={newBudget.vendor} onChange={e => setNewBudget({ ...newBudget, vendor: e.target.value })} />
              <textarea required placeholder="Descrição" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl h-24 text-slate-100" value={newBudget.description} onChange={e => setNewBudget({ ...newBudget, description: e.target.value })} />
              <input required placeholder="Valor" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-100" value={newBudget.value} onChange={e => setNewBudget({ ...newBudget, value: e.target.value })} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-3 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 p-3 rounded-xl font-bold transition-colors">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-red-800/30 w-full max-w-sm rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-900/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold">Deletar Orçamento?</h3>
            </div>
            <p className="text-slate-400 text-sm mb-6">Esta ação não pode ser desfeita. O orçamento será removido permanentemente.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 p-3 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteBudget(deletingId)}
                className="flex-1 bg-red-600 hover:bg-red-500 p-3 rounded-xl font-bold transition-colors text-white"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetManagement;
