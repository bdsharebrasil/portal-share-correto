import { useEffect, useState } from 'react';
import { Wrench, AlertTriangle, Plus, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ComponentesTabProps { aircraftId: string; }

export function ComponentesTab({ aircraftId }: ComponentesTabProps) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function loadComponents() {
    // Try mapa_componente first (Supabase existing table), fallback to components
    const { data: mapaData } = await supabase
      .from('mapa_componente')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .order('status');

    if (mapaData && mapaData.length > 0) {
      setList(mapaData.map(c => ({
        ...c,
        name: c.nome,
        part_number: c.numero_da_peça,
        serial_number: c.numero_de_serie,
        location: c.localizacao,
        total_life_hours: c.total_horas_de_vida,
        current_life_hours: c.horas_de_vida_atuais,
        installed_date: c.data_instalada,
        manufacturer: c.fabricante,
        _source: 'mapa_componente',
      })));
    } else {
      // Fallback to legacy 'components' table if exists
      const { data } = await supabase.from('mapa_componente').select('*').eq('aeronave_id', aircraftId);
      setList(data || []);
    }
    setLoading(false);
  }

  useEffect(() => { loadComponents(); }, [aircraftId]);

  if (loading) return <LoadingSpinner />;

  const expired = list.filter(c => c.status === 'expired');
  const urgent = list.filter(c => c.status === 'urgent' || (getLifePct(c) >= 80 && getLifePct(c) < 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="section-accent">
          <h2 className="text-lg font-semibold">Componentes Críticos</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm"
        >
          <Plus className="h-4 w-4" /> Novo Componente
        </button>
      </div>

      {/* Alert summary */}
      {(expired.length > 0 || urgent.length > 0) && (
        <div className="flex gap-3 mb-5">
          {expired.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {expired.length} componente(s) com vida esgotada
            </div>
          )}
          {urgent.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {urgent.length} próximo(s) do limite
            </div>
          )}
        </div>
      )}

      {showForm && (
        <NovoComponenteForm
          aircraftId={aircraftId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadComponents(); }}
        />
      )}

      {list.length === 0 && !showForm ? (
        <EmptySection icon={Wrench} text="Nenhum componente registrado" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map(comp => <ComponentCard key={comp.id} component={comp} onUpdated={loadComponents} />)}
        </div>
      )}
    </div>
  );
}

function getLifePct(component: any): number {
  const hours = Number(component.horas_de_vida_atuais || component.current_life_hours || 0);
  const total = Number(component.total_horas_de_vida || component.total_life_hours || 0);
  return total > 0 ? Math.min((hours / total) * 100, 100) : 0;
}

function ComponentCard({ component, onUpdated }: { component: any; onUpdated: () => void }) {
  const lifeHours = Number(component.horas_de_vida_atuais || component.current_life_hours || 0);
  const totalHours = Number(component.total_horas_de_vida || component.total_life_hours || 0);
  const lifePct = getLifePct(component);
  const remainingHours = totalHours > 0 ? totalHours - lifeHours : null;
  const expiryDate = component.data_de_vencimento;

  const getStatus = (): string => {
    if (expiryDate && new Date(expiryDate) < new Date()) return 'expired';
    if (lifePct >= 100) return 'expired';
    if (lifePct >= 80) return 'urgent';
    if (lifePct >= 60) return 'attention';
    return 'ok';
  };

  const status = component.status || getStatus();

  const barColor = { expired: 'bg-red-500', urgent: 'bg-orange-500', attention: 'bg-yellow-500', ok: 'bg-emerald-500' }[status] || 'bg-emerald-500';
  const textColor = { expired: 'text-red-400', urgent: 'text-orange-400', attention: 'text-yellow-400', ok: 'text-emerald-400' }[status] || 'text-emerald-400';
  const badgeClass = { expired: 'badge-expired', urgent: 'badge-urgent', attention: 'badge-attention', ok: 'badge-ok' }[status] || 'badge-ok';
  const statusLabel = { expired: 'Vencido', urgent: 'Urgente', attention: 'Atenção', ok: 'OK' }[status] || 'OK';

  const pn = component.numero_da_peça || component.part_number;
  const sn = component.numero_de_serie || component.serial_number;
  const location = component.localizacao || component.location;
  const name = component.nome || component.name;
  const manufacturer = component.fabricante || component.manufacturer;
  const installedDate = component.data_instalada || component.installed_date;

  return (
    <div className={cn('ctm-card p-5', status === 'expired' && 'border-red-500/30', status === 'urgent' && 'border-orange-500/20')}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight truncate">{name}</h3>
          {location && <p className="text-xs text-muted-foreground mt-0.5">{location}</p>}
          {component.categoria && <p className="text-xs text-muted-foreground">{component.categoria}</p>}
        </div>
        <span className={badgeClass}>{statusLabel}</span>
      </div>

      {/* Life bar */}
      {totalHours > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Vida Útil</span>
            <span className={cn('font-bold', textColor)}>{lifePct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${lifePct}%` }} />
          </div>
          <div className="flex justify-between text-xs mt-1.5 text-muted-foreground">
            <span>{lifeHours.toFixed(1)}h usadas</span>
            {remainingHours !== null && <span className={cn(remainingHours < 10 ? 'text-red-400 font-bold' : '')}>{remainingHours.toFixed(1)}h restantes</span>}
          </div>
        </div>
      )}

      {/* Expiry date */}
      {expiryDate && (
        <div className="mb-3 p-2 bg-secondary rounded-lg">
          <p className="text-xs text-muted-foreground">Vencimento</p>
          <p className={cn('text-sm font-medium', new Date(expiryDate) < new Date() ? 'text-red-400' : 'text-foreground')}>
            {new Date(expiryDate).toLocaleDateString('pt-BR')}
          </p>
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border">
        {pn && <div><p className="text-xs text-muted-foreground">P/N</p><p className="text-xs font-mono">{pn}</p></div>}
        {sn && <div><p className="text-xs text-muted-foreground">S/N</p><p className="text-xs font-mono">{sn}</p></div>}
        {installedDate && <div><p className="text-xs text-muted-foreground">Instalado</p><p className="text-xs">{new Date(installedDate).toLocaleDateString('pt-BR')}</p></div>}
        {manufacturer && <div><p className="text-xs text-muted-foreground">Fabricante</p><p className="text-xs">{manufacturer}</p></div>}
        {component.tso !== null && component.tso !== undefined && <div><p className="text-xs text-muted-foreground">TSO</p><p className="text-xs">{component.tso}h</p></div>}
        {component.csn && <div><p className="text-xs text-muted-foreground">CSN</p><p className="text-xs">{component.csn}</p></div>}
      </div>

      {lifePct >= 80 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className={cn('flex items-center gap-2 text-xs', textColor)}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {lifePct >= 100 ? 'Vida esgotada — substituição obrigatória' : 'Programar substituição'}
          </div>
        </div>
      )}
    </div>
  );
}

function NovoComponenteForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '', numero_da_peça: '', numero_de_serie: '', localizacao: '', fabricante: '',
    total_horas_de_vida: '', horas_de_vida_atuais: '', data_instalada: '', data_de_vencimento: '',
    categoria: '', observacoes: '',
  });

  async function save() {
    if (!form.nome || !form.data_instalada) { toast.error('Nome e data de instalação são obrigatórios'); return; }
    setSaving(true);

    const lifePct = form.total_horas_de_vida && form.horas_de_vida_atuais
      ? (Number(form.horas_de_vida_atuais) / Number(form.total_horas_de_vida)) * 100
      : 0;

    const status = lifePct >= 100 ? 'expired' : lifePct >= 80 ? 'urgent' : lifePct >= 60 ? 'attention' : 'ok';

    const { error } = await supabase.from('mapa_componente').insert({
      aeronave_id: aircraftId,
      ...form,
      total_horas_de_vida: form.total_horas_de_vida ? Number(form.total_horas_de_vida) : null,
      horas_de_vida_atuais: form.horas_de_vida_atuais ? Number(form.horas_de_vida_atuais) : 0,
      data_de_vencimento: form.data_de_vencimento || null,
      status,
    });

    if (!error) { toast.success('Componente adicionado!'); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Novo Componente</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {[
          { key: 'nome', label: 'Nome *', placeholder: 'Ex: Filtro de óleo' },
          { key: 'numero_da_peça', label: 'P/N', placeholder: 'Part Number' },
          { key: 'numero_de_serie', label: 'S/N', placeholder: 'Serial Number' },
          { key: 'fabricante', label: 'Fabricante', placeholder: 'Ex: Continental' },
          { key: 'localizacao', label: 'Localização', placeholder: 'Ex: Motor LH' },
          { key: 'categoria', label: 'Categoria', placeholder: 'Ex: Filtros' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-muted-foreground block mb-1">{label}</label>
            <input className="ctm-input w-full" placeholder={placeholder} value={(form as any)[key]} onChange={e => f(key, e.target.value)} />
          </div>
        ))}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data Instalação *</label>
          <input type="date" className="ctm-input w-full" value={form.data_instalada} onChange={e => f('data_instalada', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Vencimento (data)</label>
          <input type="date" className="ctm-input w-full" value={form.data_de_vencimento} onChange={e => f('data_de_vencimento', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Vida Total (horas)</label>
          <input type="number" step="0.1" className="ctm-input w-full" placeholder="Ex: 1500" value={form.total_horas_de_vida} onChange={e => f('total_horas_de_vida', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Horas Atuais</label>
          <input type="number" step="0.1" className="ctm-input w-full" placeholder="Ex: 650" value={form.horas_de_vida_atuais} onChange={e => f('horas_de_vida_atuais', e.target.value)} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Observações</label>
          <textarea className="ctm-input w-full h-16 resize-none" value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
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

function EmptySection({ icon: Icon, text }: { icon: typeof Wrench; text: string }) {
  return (
    <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
      <p className="text-muted-foreground">{text}</p>
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
