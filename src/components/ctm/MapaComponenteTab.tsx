import { useEffect, useState } from 'react';
import { Map, Wrench, Plus, X, Save, Loader2, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MapaComponenteTabProps { aircraftId: string; }

export function MapaComponenteTab({ aircraftId }: MapaComponenteTabProps) {
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => { loadComponents(); }, [aircraftId]);

  async function loadComponents() {
    const { data, error } = await supabase
      .from('ctm_mapa_componente')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .order('status');
    console.log('Mapa Componente:', data, error);
    if (data) setComponents(data);
    setLoading(false);
  }

  const filteredComponents = filter === 'all'
    ? components
    : components.filter(c => (c.status || calcStatus(c)) === filter);

  const expired = components.filter(c => (c.status || calcStatus(c)) === 'expired').length;
  const urgent = components.filter(c => (c.status || calcStatus(c)) === 'urgent').length;

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Map className="h-5 w-5" /> Mapa de Componentes
          </h2>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm"
        >
          <Plus className="h-4 w-4" /> Novo Componente
        </button>
      </div>

      {/* Alertas */}
      {(expired > 0 || urgent > 0) && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {expired > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4" /> {expired} componente(s) com vida esgotada
            </div>
          )}
          {urgent > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
              <AlertTriangle className="h-4 w-4" /> {urgent} próximo(s) do limite
            </div>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <ComponenteForm
          aircraftId={aircraftId}
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); loadComponents(); }}
        />
      )}

      {/* Filtros */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'ok', label: 'OK' },
          { key: 'attention', label: 'Atenção' },
          { key: 'urgent', label: 'Urgente' },
          { key: 'expired', label: 'Vencido' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filter === key
                ? 'bg-ctm-teal text-[hsl(var(--ctm-navy))]'
                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filteredComponents.length === 0 && !showForm ? (
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhum componente registrado</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 text-sm teal-text hover:underline"
          >
            Adicionar primeiro componente
          </button>
        </div>
      ) : (
        <div className="ctm-card overflow-hidden">
          <div className="overflow-x-auto ctm-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">P/N</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">S/N</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Localização</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Vida Útil</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Restante</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Instalado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Vencimento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.map(comp => (
                  <ComponentRow
                    key={comp.id}
                    component={comp}
                    onEdit={() => { setEditing(comp); setShowForm(true); }}
                    onDelete={async () => {
                      if (!confirm('Excluir este componente?')) return;
                      await supabase.from('ctm_mapa_componente').delete().eq('id', comp.id);
                      toast.success('Componente excluído');
                      loadComponents();
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function calcStatus(c: any): string {
  const lifeHours = Number(c.horas_de_vida_atuais || 0);
  const totalHours = Number(c.total_horas_de_vida || 0);
  const pct = totalHours > 0 ? (lifeHours / totalHours) * 100 : 0;
  if (c.data_de_vencimento && new Date(c.data_de_vencimento) < new Date()) return 'expired';
  if (pct >= 100) return 'expired';
  if (pct >= 80) return 'urgent';
  if (pct >= 60) return 'attention';
  return 'ok';
}

function ComponentRow({ component: comp, onEdit, onDelete }: { component: any; onEdit: () => void; onDelete: () => void }) {
  const lifeHours = Number(comp.horas_de_vida_atuais || 0);
  const totalHours = Number(comp.total_horas_de_vida || 0);
  const lifePct = totalHours > 0 ? Math.min((lifeHours / totalHours) * 100, 100) : 0;
  const remaining = totalHours > 0 ? totalHours - lifeHours : null;
  const status = comp.status || calcStatus(comp);

  const badgeCls = { expired: 'badge-expired', urgent: 'badge-urgent', attention: 'badge-attention', ok: 'badge-ok' }[status] || 'badge-ok';
  const badgeLabel = { expired: 'Vencido', urgent: 'Urgente', attention: 'Atenção', ok: 'OK' }[status] || 'OK';
  const statusColor = { expired: 'bg-red-500', urgent: 'bg-orange-500', attention: 'bg-yellow-500', ok: 'bg-emerald-500' }[status] || 'bg-emerald-500';
  const textColor = { expired: 'text-red-400', urgent: 'text-orange-400', attention: 'text-yellow-400', ok: 'text-emerald-400' }[status] || 'text-emerald-400';

  return (
    <tr className={cn('border-b border-border/50 hover:bg-secondary/50 transition-colors', status === 'expired' && 'bg-red-500/5')}>
      <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{comp.nome}</td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{comp.categoria || '—'}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{comp.numero_da_peça || '—'}</td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{comp.numero_de_serie || '—'}</td>
      <td className="px-4 py-3 text-muted-foreground text-xs">{comp.localizacao || '—'}</td>
      <td className="px-4 py-3"><span className={badgeCls}>{badgeLabel}</span></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full', statusColor)} style={{ width: `${lifePct}%` }} />
          </div>
          <span className={cn('text-xs font-bold whitespace-nowrap', textColor)}>{lifePct.toFixed(0)}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {remaining !== null ? <span className={Number(remaining) < 10 ? 'text-red-400 font-bold' : ''}>{remaining.toFixed(1)}h</span> : '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
        {comp.data_instalada ? new Date(comp.data_instalada).toLocaleDateString('pt-BR') : '—'}
      </td>
      <td className="px-4 py-3 text-xs whitespace-nowrap">
        {comp.data_de_vencimento
          ? <span className={new Date(comp.data_de_vencimento) < new Date() ? 'text-red-400 font-bold' : 'text-muted-foreground'}>
              {new Date(comp.data_de_vencimento).toLocaleDateString('pt-BR')}
            </span>
          : <span className="text-muted-foreground">—</span>
        }
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-400">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Formulário de Componente ─────────────────────────────────────────────────
function ComponenteForm({ aircraftId, editing, onClose, onSaved }: {
  aircraftId: string; editing: any | null; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: editing?.nome || '',
    numero_da_peça: editing?.numero_da_peça || '',
    numero_de_serie: editing?.numero_de_serie || '',
    localizacao: editing?.localizacao || '',
    fabricante: editing?.fabricante || '',
    categoria: editing?.categoria || '',
    total_horas_de_vida: editing?.total_horas_de_vida || '',
    horas_de_vida_atuais: editing?.horas_de_vida_atuais || '',
    ciclos_de_vida_totais: editing?.ciclos_de_vida_totais || '',
    ciclos_de_vida_atuais: editing?.ciclos_de_vida_atuais || '',
    data_instalada: editing?.data_instalada || '',
    data_de_vencimento: editing?.data_de_vencimento || '',
    tso: editing?.tso || '',
    csn: editing?.csn || '',
    observacoes: editing?.observacoes || '',
  });

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  async function save() {
    if (!form.nome || !form.data_instalada) { toast.error('Nome e data de instalação são obrigatórios'); return; }
    setSaving(true);

    const lifeHours = Number(form.horas_de_vida_atuais || 0);
    const totalHours = Number(form.total_horas_de_vida || 0);
    const lifePct = totalHours > 0 ? (lifeHours / totalHours) * 100 : 0;
    const status = lifePct >= 100 ? 'expired' : lifePct >= 80 ? 'urgent' : lifePct >= 60 ? 'attention' : 'ok';
    const remainingHours = totalHours > 0 ? totalHours - lifeHours : null;
    const porcentagemRestante = totalHours > 0 ? 100 - lifePct : null;

    const payload = {
      aeronave_id: aircraftId,
      nome: form.nome,
      numero_da_peça: form.numero_da_peça || null,
      numero_de_serie: form.numero_de_serie || null,
      localizacao: form.localizacao || null,
      fabricante: form.fabricante || null,
      categoria: form.categoria || null,
      total_horas_de_vida: form.total_horas_de_vida ? Number(form.total_horas_de_vida) : null,
      horas_de_vida_atuais: lifeHours,
      ciclos_de_vida_totais: form.ciclos_de_vida_totais ? Number(form.ciclos_de_vida_totais) : null,
      ciclos_de_vida_atuais: form.ciclos_de_vida_atuais ? Number(form.ciclos_de_vida_atuais) : 0,
      data_instalada: form.data_instalada,
      data_de_vencimento: form.data_de_vencimento || null,
      tso: form.tso ? Number(form.tso) : null,
      csn: form.csn ? Number(form.csn) : null,
      observacoes: form.observacoes || null,
      status,
      remaining_hours: remainingHours,
      porcentagem_restante: porcentagemRestante,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from('ctm_mapa_componente').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('ctm_mapa_componente').insert(payload));
    }

    if (!error) { toast.success(editing ? 'Componente atualizado!' : 'Componente adicionado!'); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">{editing ? 'Editar Componente' : 'Novo Componente'}</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Nome do Componente *</label>
          <input className="ctm-input w-full" placeholder="Ex: Filtro de óleo, Pneu principal LH" value={form.nome} onChange={e => f('nome', e.target.value)} />
        </div>
        {[
          { key: 'numero_da_peça', label: 'Part Number (P/N)', placeholder: 'Ex: LW-12334' },
          { key: 'numero_de_serie', label: 'Serial Number (S/N)', placeholder: 'Ex: SN-2024-001' },
          { key: 'fabricante', label: 'Fabricante', placeholder: 'Ex: Continental, Lycoming' },
          { key: 'localizacao', label: 'Localização', placeholder: 'Ex: Motor LH, Trem principal' },
          { key: 'categoria', label: 'Categoria', placeholder: 'Ex: Motor, Filtros, Pneus' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-muted-foreground block mb-1">{label}</label>
            <input className="ctm-input w-full" placeholder={placeholder} value={(form as any)[key]} onChange={e => f(key, e.target.value)} />
          </div>
        ))}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data de Instalação *</label>
          <input type="date" className="ctm-input w-full" value={form.data_instalada} onChange={e => f('data_instalada', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data de Vencimento</label>
          <input type="date" className="ctm-input w-full" value={form.data_de_vencimento} onChange={e => f('data_de_vencimento', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-4 bg-secondary rounded-xl">
        <div className="col-span-2 md:col-span-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Controle de Vida Útil (Horas)</p>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Vida Total (h)</label>
          <input type="number" step="0.1" className="ctm-input w-full" placeholder="Ex: 1500" value={form.total_horas_de_vida} onChange={e => f('total_horas_de_vida', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Horas Atuais</label>
          <input type="number" step="0.1" className="ctm-input w-full" placeholder="Ex: 650" value={form.horas_de_vida_atuais} onChange={e => f('horas_de_vida_atuais', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">TSO (Time Since Overhaul)</label>
          <input type="number" step="0.1" className="ctm-input w-full" placeholder="Ex: 320" value={form.tso} onChange={e => f('tso', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Vida por Ciclos (total)</label>
          <input type="number" className="ctm-input w-full" placeholder="Ex: 5000" value={form.ciclos_de_vida_totais} onChange={e => f('ciclos_de_vida_totais', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Ciclos Atuais</label>
          <input type="number" className="ctm-input w-full" placeholder="Ex: 1200" value={form.ciclos_de_vida_atuais} onChange={e => f('ciclos_de_vida_atuais', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">CSN (Cycles Since New)</label>
          <input type="number" className="ctm-input w-full" placeholder="Ex: 1200" value={form.csn} onChange={e => f('csn', e.target.value)} />
        </div>
      </div>

      {/* Preview do status */}
      {form.total_horas_de_vida && form.horas_de_vida_atuais && (
        <div className="mb-4 p-3 bg-secondary rounded-lg">
          {(() => {
            const pct = (Number(form.horas_de_vida_atuais) / Number(form.total_horas_de_vida)) * 100;
            const remaining = Number(form.total_horas_de_vida) - Number(form.horas_de_vida_atuais);
            const status = pct >= 100 ? 'expired' : pct >= 80 ? 'urgent' : pct >= 60 ? 'attention' : 'ok';
            const color = { expired: 'bg-red-500', urgent: 'bg-orange-500', attention: 'bg-yellow-500', ok: 'bg-emerald-500' }[status];
            const textColor = { expired: 'text-red-400', urgent: 'text-orange-400', attention: 'text-yellow-400', ok: 'text-emerald-400' }[status];
            return (
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Previsão de vida útil</span>
                  <span className={cn('font-bold', textColor)}>{pct.toFixed(1)}% — {remaining.toFixed(1)}h restantes</span>
                </div>
                <div className="h-2 bg-primary rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="mb-4">
        <label className="text-xs text-muted-foreground block mb-1">Observações</label>
        <textarea className="ctm-input w-full h-16 resize-none" value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {editing ? 'Atualizar' : 'Salvar Componente'}
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
