import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, X, Save, Loader2, Calendar, Clock } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DirectivesTabProps { aircraftId: string; }

export function DirectivesTab({ aircraftId }: DirectivesTabProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'AD' | 'SB'>('all');
  const [showForm, setShowForm] = useState(false);

  async function loadDirectives() {
    const { data, error } = await supabase
      .from('ctm_diretrizes')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .order('status');
    console.log('Diretrizes:', data, error);
    if (data) setItems(data);
    setLoading(false);
  }

  useEffect(() => { loadDirectives(); }, [aircraftId]);

  if (loading) return <LoadingSpinner />;

  const filtered = filter === 'all' ? items : items.filter(i => i.tipo === filter);
  const ads = items.filter(i => i.tipo === 'AD');
  const sbs = items.filter(i => i.tipo === 'SB');
  const expired = items.filter(i => i.status === 'expired');
  const urgent = items.filter(i => i.status === 'urgent');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold">Diretrizes de Aeronavegabilidade (AD & SB)</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[#45d1b5] bg-transparent px-4 py-1.5 text-sm font-medium text-[#45d1b5] transition-colors hover:bg-[#45d1b5]/10"
        >
          <Plus className="h-4 w-4" /> Nova Diretriz
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="ctm-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">AD (Airworthiness)</p>
          <p className="text-2xl font-bold text-orange-400">{ads.length}</p>
        </div>
        <div className="ctm-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">SB (Service Bulletins)</p>
          <p className="text-2xl font-bold text-blue-400">{sbs.length}</p>
        </div>
        <div className="ctm-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Vencidas</p>
          <p className="text-2xl font-bold text-red-400">{expired.length}</p>
        </div>
        <div className="ctm-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Urgentes</p>
          <p className="text-2xl font-bold text-orange-400">{urgent.length}</p>
        </div>
      </div>

      {showForm && (
        <NovaDirectivaForm
          aircraftId={aircraftId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadDirectives(); }}
        />
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5">
        {(['all', 'AD', 'SB'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-4 py-1.5 text-sm font-medium rounded-lg border transition-all',
              filter === f
                ? 'bg-[hsl(var(--ctm-teal)/0.15)] border-[hsl(var(--ctm-teal)/0.4)] teal-text'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {f === 'all' ? 'Todas' : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && !showForm ? (
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhuma diretriz registrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(dir => (
            <DirectiveCard key={dir.id} directive={dir} onUpdated={loadDirectives} />
          ))}
        </div>
      )}
    </div>
  );
}

function DirectiveCard({ directive: dir, onUpdated }: { directive: any; onUpdated: () => void }) {
  const [marking, setMarking] = useState(false);

  async function markComplied() {
    setMarking(true);
    const { error } = await supabase.from('ctm_diretrizes').update({
      status: 'complied',
      data_de_conformidade: new Date().toISOString().split('T')[0],
    }).eq('id', dir.id);
    if (!error) { toast.success('Marcada como cumprida!'); onUpdated(); }
    else toast.error('Erro ao atualizar');
    setMarking(false);
  }

  return (
    <div className={cn('ctm-card p-5', dir.status === 'expired' && 'border-red-500/30', dir.status === 'urgent' && 'border-orange-500/20')}>
      <div className="flex items-start gap-4">
        <span className={cn(
          'text-xs font-bold px-2.5 py-1 rounded-lg border shrink-0',
          dir.tipo === 'AD'
            ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        )}>
          {dir.tipo}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-semibold text-sm">{dir.numero}</span>
            <DirectiveStatus status={dir.status} />
          </div>
          <p className="text-sm font-medium mt-0.5">{dir.titulo}</p>
          {dir.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dir.descricao}</p>}
          {dir.aplicabilidade && <p className="text-xs text-muted-foreground mt-1">Aplicabilidade: {dir.aplicabilidade}</p>}

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            {dir.data_vencimento && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Prazo: {new Date(dir.data_vencimento).toLocaleDateString('pt-BR')}
              </span>
            )}
            {dir.devido_horas && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Limite: {dir.devido_horas}h
              </span>
            )}
            {dir.ciclos_devidos && <span>Ciclos: {dir.ciclos_devidos}</span>}
            {dir.data_de_conformidade && (
              <span className="text-emerald-400 flex items-center gap-1">
                ✓ Cumprida em: {new Date(dir.data_de_conformidade).toLocaleDateString('pt-BR')}
              </span>
            )}
            {dir.metodo_de_conformidade && <span>Método: {dir.metodo_de_conformidade}</span>}
            {dir.responsavel && <span>Resp: {dir.responsavel}</span>}
          </div>
        </div>

        {dir.status !== 'complied' && dir.status !== 'not_applicable' && (
          <button
            onClick={markComplied}
            disabled={marking}
            className="shrink-0 text-xs px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
          >
            {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Marcar Cumprida'}
          </button>
        )}
      </div>

      {dir.observacoes && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">{dir.observacoes}</p>
        </div>
      )}
    </div>
  );
}

function NovaDirectivaForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: 'AD' as 'AD' | 'SB',
    numero: '', titulo: '', descricao: '', aplicabilidade: '',
    data_vencimento: '', devido_horas: '', ciclos_devidos: '',
    metodo_de_conformidade: '', responsavel: '', observacoes: '',
    status: 'pending',
  });

  async function save() {
    if (!form.numero || !form.titulo) { toast.error('Número e título são obrigatórios'); return; }
    setSaving(true);
    const { error } = await supabase.from('ctm_diretrizes').insert({
      aeronave_id: aircraftId,
      tipo: form.tipo,
      numero: form.numero,
      titulo: form.titulo,
      descricao: form.descricao || null,
      aplicabilidade: form.aplicabilidade || null,
      data_vencimento: form.data_vencimento || null,
      devido_horas: form.devido_horas ? Number(form.devido_horas) : null,
      ciclos_devidos: form.ciclos_devidos ? Number(form.ciclos_devidos) : null,
      metodo_de_conformidade: form.metodo_de_conformidade || null,
      responsavel: form.responsavel || null,
      observacoes: form.observacoes || null,
      status: form.status,
    });
    if (!error) { toast.success('Diretriz registrada!'); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Nova Diretriz</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
          <select className="ctm-input w-full" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'AD' | 'SB' }))}>
            <option value="AD">AD – Airworthiness Directive</option>
            <option value="SB">SB – Service Bulletin</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Número *</label>
          <input className="ctm-input w-full" placeholder="Ex: 2024-18-01" value={form.numero} onChange={e => f('numero', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Status</label>
          <select className="ctm-input w-full" value={form.status} onChange={e => f('status', e.target.value)}>
            <option value="pending">Pendente</option>
            <option value="urgent">Urgente</option>
            <option value="complied">Cumprida</option>
            <option value="not_applicable">Não Aplicável</option>
          </select>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Título *</label>
          <input className="ctm-input w-full" placeholder="Ex: Inspeção de trinca no longarina" value={form.titulo} onChange={e => f('titulo', e.target.value)} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Descrição</label>
          <textarea className="ctm-input w-full h-16 resize-none" value={form.descricao} onChange={e => f('descricao', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Aplicabilidade</label>
          <input className="ctm-input w-full" placeholder="Ex: PA-34-220T" value={form.aplicabilidade} onChange={e => f('aplicabilidade', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Prazo (data)</label>
          <input type="date" className="ctm-input w-full" value={form.data_vencimento} onChange={e => f('data_vencimento', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Limite (horas)</label>
          <input type="number" className="ctm-input w-full" placeholder="Ex: 3500" value={form.devido_horas} onChange={e => f('devido_horas', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Método de Cumprimento</label>
          <input className="ctm-input w-full" placeholder="Ex: Inspeção visual" value={form.metodo_de_conformidade} onChange={e => f('metodo_de_conformidade', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Responsável</label>
          <input className="ctm-input w-full" placeholder="Nome do mecânico/oficina" value={form.responsavel} onChange={e => f('responsavel', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Observações</label>
          <input className="ctm-input w-full" value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
      </div>
    </div>
  );
}

function DirectiveStatus({ status }: { status?: string }) {
  const s = (status || '').toLowerCase();
  if (s === 'expired') return <span className="badge-expired">Vencida</span>;
  if (s === 'urgent') return <span className="badge-urgent">Urgente</span>;
  if (s === 'attention') return <span className="badge-attention">Atenção</span>;
  if (s === 'complied') return <span className="badge-ok">Cumprida</span>;
  if (s === 'not_applicable') return <span className="badge-pending">N/A</span>;
  return <span className="badge-pending">Pendente</span>;
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 border-2 border-ctm-teal border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
