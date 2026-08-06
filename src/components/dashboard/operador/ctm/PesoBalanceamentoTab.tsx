import { useEffect, useState } from 'react';
import { Plus, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function PesoBalanceamentoTab({ aircraftId }: { aircraftId: string }) {
  const [wb, setWb] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ descricao: '', peso_sem_combustivel: '', braco_posicao: '', momento: '' });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('ctm_peso_balanceamento').select('*').eq('aeronave_id', aircraftId).maybeSingle();
    setWb(data ?? null);
    if (data && data.id) {
      const { data: its } = await supabase.from('ctm_itens_peso_balanceamento').select('*').eq('peso_balanceamento_id', data.id);
      setItems(its ?? []);
    } else {
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [aircraftId]);

  async function saveItem() {
    if (!form.descricao.trim()) return toast.error('Descrição é obrigatória');
    setLoading(true);
    try {
      let wbId = wb?.id;
      if (!wbId) {
        const { data: insWb, error: wbErr } = await supabase.from('ctm_peso_balanceamento').insert({ aeronave_id: aircraftId, peso_vazio_padrao: 0, braco_cg_padrao: 0, mac_comprimento: 0, lemac_distancia: 0, peso_maximo_decolagem: 0, peso_maximo_pouso: 0 }).select('id');
        if (wbErr) { toast.error('Erro criando balanceamento'); setLoading(false); return; }
        wbId = insWb && insWb[0] ? insWb[0].id : undefined;
      }
      const payload = {
        peso_balanceamento_id: wbId,
        descricao: form.descricao,
        categoria: null,
        peso_sem_combustivel: form.peso_sem_combustivel ? Number(form.peso_sem_combustivel) : 0,
        braço_posicao: form.braco_posicao ? Number(form.braco_posicao) : 0,
        momento: form.momento ? Number(form.momento) : 0,
        incluir_no_calculo: true,
      };
      const { error } = await supabase.from('ctm_itens_peso_balanceamento').insert(payload);
      if (error) { toast.error('Erro ao adicionar item'); }
      else { toast.success('Item adicionado'); setForm({ descricao: '', peso_sem_combustivel: '', braco_posicao: '', momento: '' }); setShowForm(false); }
    } finally { load(); }
  }

  if (loading) return <div className="ctm-card p-6"> <Loader2 className="h-6 w-6 animate-spin" /> </div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Peso & Balanceamento</h2>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-3 py-2 rounded bg-ctm-teal text-sm text-[hsl(var(--ctm-navy))]"> <Plus className="h-4 w-4" /> Novo Item</button>
      </div>

      {showForm && (
        <div className="ctm-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Novo item</h3>
            <button onClick={() => setShowForm(false)}><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input className="ctm-input" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            <input className="ctm-input" placeholder="Peso sem combustível" value={form.peso_sem_combustivel} onChange={e => setForm(f => ({ ...f, peso_sem_combustivel: e.target.value }))} />
            <input className="ctm-input" placeholder="Braço/posição" value={form.braco_posicao} onChange={e => setForm(f => ({ ...f, braco_posicao: e.target.value }))} />
            <input className="ctm-input" placeholder="Momento" value={form.momento} onChange={e => setForm(f => ({ ...f, momento: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <button onClick={() => setShowForm(false)} className="mr-2">Cancelar</button>
            <button onClick={saveItem} className="flex items-center gap-2 rounded bg-ctm-teal px-3 py-2 text-sm text-[hsl(var(--ctm-navy))]">Salvar</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="ctm-card p-6 text-center">Nenhum item de peso cadastrado</div>
        ) : (
          <div className="grid gap-3">
            {items.map(it => (
              <div key={it.id} className="ctm-card p-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{it.descricao}</div>
                  <div className="text-xs text-muted-foreground">Peso: {it.peso_sem_combustivel ?? '—'} · Braço: {it.braço_posicao ?? '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
