import { useEffect, useState } from 'react';
import { Zap, Plus, X, Save, Loader2, Trash2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DespesasMotorTabProps { aircraftId: string; }

const TIPOS = {
  overhaul: { label: 'Overhaul', color: 'badge-expired' },
  reparo: { label: 'Reparo', color: 'badge-urgent' },
  manutencao: { label: 'Manutenção', color: 'badge-teal' },
  inspecao: { label: 'Inspeção', color: 'badge-ok' },
};

const LADOS = {
  LH: 'Motor Esquerdo (LH)',
  RH: 'Motor Direito (RH)',
  ambos: 'Ambos os Motores',
};

export function DespesasMotorTab({ aircraftId }: DespesasMotorTabProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterLado, setFilterLado] = useState('');

  async function loadDespesas() {
    const { data, error } = await supabase
      .from('ctm_despesas_motor')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .order('data', { ascending: false });
    console.log('Despesas Motor:', data, error);
    if (data) setItems(data);
    setLoading(false);
  }

  useEffect(() => { loadDespesas(); }, [aircraftId]);

  const filtered = items.filter(i => {
    if (filterTipo && i.tipo !== filterTipo) return false;
    if (filterLado && i.lado_motor !== filterLado) return false;
    return true;
  });

  const totalGeral = items.reduce((s, i) => s + Number(i.valor || 0), 0);
  const totalLH = items.filter(i => i.lado_motor === 'LH' || i.lado_motor === 'ambos').reduce((s, i) => s + Number(i.valor || 0), 0);
  const totalRH = items.filter(i => i.lado_motor === 'RH' || i.lado_motor === 'ambos').reduce((s, i) => s + Number(i.valor || 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 teal-text" /> Despesas de Motor
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm"
        >
          <Plus className="h-4 w-4" /> Nova Despesa
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="ctm-card p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Investido em Motores</p>
          <p className="text-2xl font-bold teal-text">R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="ctm-card p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">Motor Esquerdo (LH)</p>
          <p className="text-xl font-bold text-blue-400">R$ {totalLH.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="ctm-card p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">Motor Direito (RH)</p>
          <p className="text-xl font-bold text-purple-400">R$ {totalRH.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {showForm && (
        <NovaDespesaMotorForm
          aircraftId={aircraftId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadDespesas(); }}
        />
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <select className="ctm-input" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="ctm-input" value={filterLado} onChange={e => setFilterLado(e.target.value)}>
          <option value="">Todos os motores</option>
          {Object.entries(LADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {filtered.length === 0 && !showForm ? (
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <Zap className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhuma despesa de motor registrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const tipo = TIPOS[item.tipo as keyof typeof TIPOS] || { label: item.tipo, color: 'badge-pending' };
            const lado = LADOS[item.lado_motor as keyof typeof LADOS] || item.lado_motor;
            return (
              <div key={item.id} className="ctm-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm">{lado}</h4>
                      <span className={tipo.color}>{tipo.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.descricao}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span>Data: {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      {item.horas_motor && <span>Horas motor: {item.horas_motor}h</span>}
                      {item.fornecedor && <span>Fornecedor: {item.fornecedor}</span>}
                      {item.numero_oas && <span>OAS: #{item.numero_oas}</span>}
                    </div>
                    {item.observacoes && <p className="text-xs text-muted-foreground italic">{item.observacoes}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold teal-text">
                        R$ {Number(item.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('Excluir despesa?')) return;
                        await supabase.from('ctm_despesas_motor').delete().eq('id', item.id);
                        toast.success('Despesa excluída');
                        loadDespesas();
                      }}
                      className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NovaDespesaMotorForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data: new Date().toISOString().split('T')[0],
    tipo: 'manutencao',
    lado_motor: 'LH',
    descricao: '',
    valor: '',
    horas_motor: '',
    fornecedor: '',
    numero_oas: '',
    observacoes: '',
  });

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  async function save() {
    if (!form.descricao || !form.valor || !form.data) {
      toast.error('Descrição, valor e data são obrigatórios');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('ctm_despesas_motor').insert({
      aeronave_id: aircraftId,
      data: form.data,
      tipo: form.tipo,
      lado_motor: form.lado_motor,
      descricao: form.descricao,
      valor: Number(form.valor),
      horas_motor: form.horas_motor ? Number(form.horas_motor) : null,
      fornecedor: form.fornecedor || null,
      numero_oas: form.numero_oas || null,
      observacoes: form.observacoes || null,
    });
    if (!error) { toast.success('Despesa de motor registrada!'); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Nova Despesa de Motor</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data *</label>
          <input type="date" className="ctm-input w-full" value={form.data} onChange={e => f('data', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipo *</label>
          <select className="ctm-input w-full" value={form.tipo} onChange={e => f('tipo', e.target.value)}>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Motor *</label>
          <select className="ctm-input w-full" value={form.lado_motor} onChange={e => f('lado_motor', e.target.value)}>
            {Object.entries(LADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Descrição *</label>
          <input className="ctm-input w-full" placeholder="Ex: Revisão geral do motor LH conforme OAS #12" value={form.descricao} onChange={e => f('descricao', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Valor (R$) *</label>
          <input type="number" min="0" step="0.01" className="ctm-input w-full" placeholder="Ex: 85000,00" value={form.valor} onChange={e => f('valor', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Horas do Motor</label>
          <input type="number" step="0.1" className="ctm-input w-full" placeholder="Ex: 1850.5" value={form.horas_motor} onChange={e => f('horas_motor', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Referência OAS</label>
          <input className="ctm-input w-full" placeholder="Número da OAS" value={form.numero_oas} onChange={e => f('numero_oas', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Fornecedor</label>
          <input className="ctm-input w-full" placeholder="Nome da oficina/fornecedor" value={form.fornecedor} onChange={e => f('fornecedor', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Observações</label>
          <input className="ctm-input w-full" value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Registrar Despesa
        </button>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 border-2 border-ctm-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
