import { useEffect, useState } from 'react';
import { Droplets, TrendingUp, Plus, X, Save, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AnaliseOleoTabProps { aircraftId: string; }

const PARAMS = [
  { key: 'ferro', label: 'Ferro', unit: 'ppm', limit: 100 },
  { key: 'cobre', label: 'Cobre', unit: 'ppm', limit: 50 },
  { key: 'aluminio', label: 'Alumínio', unit: 'ppm', limit: 30 },
  { key: 'silicio', label: 'Silício', unit: 'ppm', limit: 20 },
  { key: 'viscosidade', label: 'Viscosidade', unit: 'cSt', limit: 35 },
];

export function AnaliseOleoTab({ aircraftId }: AnaliseOleoTabProps) {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function loadAnalises() {
    const { data, error } = await supabase
      .from('ctm_analise_oleo')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .order('data_analise', { ascending: false });
    console.log('Analise oleo ctm:', data, error);
    if (data) setAnalyses(data);
    setLoading(false);
  }

  useEffect(() => { loadAnalises(); }, [aircraftId]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Droplets className="h-5 w-5 teal-text" /> Análise de Óleo
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#45d1b5] bg-transparent px-4 py-1.5 text-sm font-medium text-[#45d1b5] transition-colors hover:bg-[#45d1b5]/10"
        >
          <Plus className="h-4 w-4" /> Nova Análise
        </button>
      </div>

      {showForm && (
        <NovaAnaliseForm
          aircraftId={aircraftId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadAnalises(); }}
        />
      )}

      {analyses.length === 0 && !showForm ? (
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <Droplets className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhuma análise de óleo registrada</p>
          <p className="text-xs text-muted-foreground mt-1">Registre análises periódicas para monitorar a saúde do motor</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Última análise em destaque */}
          {analyses[0] && (
            <div className="ctm-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-lg">Última Análise</h3>
                  {analyses[0].ordem_servico_id && (
                    <p className="text-xs text-muted-foreground mt-0.5">O.S.: {analyses[0].ordem_servico_id}</p>
                  )}
                </div>
                <span className="badge-teal">{new Date(analyses[0].data_analise + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {PARAMS.map(({ key, label, unit, limit }) => {
                  const val = Number(analyses[0][key] || 0);
                  const pct = Math.min((val / limit) * 100, 120);
                  const isOver = val > limit;
                  const isAlert = val > limit * 0.8;
                  const barColor = isOver ? 'bg-red-500' : isAlert ? 'bg-yellow-500' : 'bg-ctm-teal';
                  const textColor = isOver ? 'text-red-400' : isAlert ? 'text-yellow-400' : 'teal-text';
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        {isOver && <span className="text-xs text-red-400 font-bold">!</span>}
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="flex items-end justify-between">
                        <span className={cn('text-2xl font-bold', textColor)}>{val}</span>
                        <span className="text-xs text-muted-foreground">/{limit} {unit}</span>
                      </div>
                      <span className={cn('text-xs', isOver ? 'text-red-400' : isAlert ? 'text-yellow-400' : 'text-muted-foreground')}>
                        {isOver ? '⚠ Acima do limite' : isAlert ? '→ Atenção' : '✓ Normal'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Histórico */}
          <div className="ctm-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 teal-text" /> Histórico de Análises
              </h3>
              <span className="text-xs text-muted-foreground">{analyses.length} registro(s)</span>
            </div>
            <div className="overflow-x-auto ctm-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Data</th>
                    {PARAMS.map(p => (
                      <th key={p.key} className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">
                        {p.label} <span className="font-normal opacity-60">({p.unit})</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status Geral</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {analyses.map(a => {
                    const anyOver = PARAMS.some(p => Number(a[p.key] || 0) > p.limit);
                    const anyAlert = PARAMS.some(p => Number(a[p.key] || 0) > p.limit * 0.8);
                    return (
                      <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {new Date(a.data_analise + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        {PARAMS.map(({ key, limit }) => {
                          const val = Number(a[key] || 0);
                          return (
                            <td key={key} className={cn(
                              'px-4 py-3 text-right font-mono',
                              val > limit ? 'text-red-400 font-bold' : val > limit * 0.8 ? 'text-yellow-400' : 'text-foreground'
                            )}>
                              {val}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3">
                          {anyOver
                            ? <span className="badge-expired">Fora do Limite</span>
                            : anyAlert
                            ? <span className="badge-attention">Atenção</span>
                            : <span className="badge-ok">Normal</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (!confirm('Excluir análise?')) return;
                              await supabase.from('ctm_analise_oleo').delete().eq('id', a.id);
                              toast.success('Análise excluída');
                              loadAnalises();
                            }}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legenda de limites */}
          <div className="ctm-card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Limites de Referência</p>
            <div className="flex flex-wrap gap-4">
              {PARAMS.map(p => (
                <div key={p.key} className="flex items-center gap-2 text-xs">
                  <div className="h-2 w-8 bg-ctm-teal rounded-full" />
                  <span className="text-muted-foreground">{p.label}: até {p.limit} {p.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulário de Nova Análise ────────────────────────────────────────────────
function NovaAnaliseForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data_analise: new Date().toISOString().split('T')[0],
    ferro: '',
    cobre: '',
    aluminio: '',
    silicio: '',
    viscosidade: '',
    ordem_servico_id: '',
  });

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  async function save() {
    if (!form.data_analise) { toast.error('Data é obrigatória'); return; }
    setSaving(true);

    const { error } = await supabase.from('ctm_analise_oleo').insert({
      aeronave_id: aircraftId,
      data_analise: form.data_analise,
      ferro: form.ferro ? Number(form.ferro) : 0,
      cobre: form.cobre ? Number(form.cobre) : 0,
      aluminio: form.aluminio ? Number(form.aluminio) : 0,
      silicio: form.silicio ? Number(form.silicio) : 0,
      viscosidade: form.viscosidade ? Number(form.viscosidade) : 0,
      ordem_servico_id: form.ordem_servico_id || null,
    });

    if (!error) { toast.success('Análise de óleo registrada!'); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  // Preview de alertas
  const alerts = PARAMS.filter(p => {
    const val = Number((form as any)[p.key] || 0);
    return val > p.limit;
  });

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Nova Análise de Óleo</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data da Análise *</label>
          <input type="date" className="ctm-input w-full" value={form.data_analise} onChange={e => f('data_analise', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Referência O.S (opcional)</label>
          <input className="ctm-input w-full" placeholder="Ex: OS-2024-001" value={form.ordem_servico_id} onChange={e => f('ordem_servico_id', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {PARAMS.map(({ key, label, unit, limit }) => {
          const val = Number((form as any)[key] || 0);
          const isOver = val > limit;
          const isAlert = val > limit * 0.8;
          return (
            <div key={key}>
              <label className={cn('text-xs block mb-1', isOver ? 'text-red-400 font-semibold' : isAlert ? 'text-yellow-400' : 'text-muted-foreground')}>
                {label} ({unit}) — lim: {limit}
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                className={cn('ctm-input w-full', isOver && 'border-red-500/50', isAlert && !isOver && 'border-yellow-500/50')}
                placeholder="0"
                value={(form as any)[key]}
                onChange={e => f(key, e.target.value)}
              />
            </div>
          );
        })}
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs font-semibold text-red-400 mb-1">⚠ Parâmetros acima do limite:</p>
          <p className="text-xs text-red-300">{alerts.map(p => p.label).join(', ')}</p>
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Análise
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
