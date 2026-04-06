import React, { useState } from 'react';
import { format } from 'date-fns';
import { X, Save, Droplet, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OilAnalysis {
  date: string;
  fe: number;
  cu: number;
  al: number;
  si: number;
  viscosity: number;
}

interface Props {
  aircraftId: string;
  onClose: () => void;
  onSave: () => void;
}

const OilAnalysisDialog: React.FC<Props> = ({ aircraftId, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<OilAnalysis>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    fe: 0,
    cu: 0,
    al: 0,
    si: 0,
    viscosity: 14.2
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('oil_analysis')
        .insert([{
          aeronave_id: aircraftId,
          date: formData.data,
          fe: formData.fe,
          cu: formData.cu,
          al: formData.al,
          si: formData.si,
          viscosity: formData.viscosity
        }]);

      if (error) throw error;
      
      toast.success('Análise de óleo salva com sucesso');
      onSave();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar análise:', err);
      toast.error('Erro ao salvar dados. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <Droplet className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Nova Análise SOAP</h2>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Entrada de dados laboratoriais</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Data da Coleta</label>
              <input 
                type="data" 
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-100"
                value={formData.data}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Ferro (Fe) - ppm</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-100"
                  value={formData.fe}
                  onChange={e => setFormData({...formData, fe: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Cobre (Cu) - ppm</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-100"
                  value={formData.cu}
                  onChange={e => setFormData({...formData, cu: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Alumínio (Al) - ppm</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-100"
                  value={formData.al}
                  onChange={e => setFormData({...formData, al: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Silício (Si) - ppm</label>
                <input 
                  type="number" 
                  step="0.1"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-100"
                  value={formData.si}
                  onChange={e => setFormData({...formData, si: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">Viscosidade (cSt @ 40°C)</label>
              <input 
                type="number" 
                step="0.01"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-100"
                value={formData.viscosity}
                onChange={e => setFormData({...formData, viscosity: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-[10px] text-slate-400">Certifique-se que os valores correspondem ao laudo oficial do laboratório. Estes dados impactam o score de saúde da aeronave.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl border border-slate-800 font-bold text-slate-400 hover:bg-slate-800 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Análise
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OilAnalysisDialog;
