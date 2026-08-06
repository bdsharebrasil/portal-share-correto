import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, Plus, X, Save, Loader2, Wrench, AlertTriangle, CheckCircle2,
  CalendarClock, Gauge, PlaneLanding, RotateCcw, Trash2, Pencil,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  CATALOGO_PROGRAMA, CATEGORIAS_PROGRAMA, TIPOS_CONTROLE, categoriaConfig,
  calcularStatusItem, ordenarPorCriticidade, formatDataBR, NIVEL_STYLE,
  type ItemPrograma, type StatusPrograma, type NivelAlerta, type EstadoAeronave,
} from '@/lib/ctm-programa-manutencao';

interface Props { aircraftId: string; registration?: string; horasCelula?: number | null }

const ICON_TIPO = {
  calendario: CalendarClock,
  horas: Gauge,
  pousos: PlaneLanding,
  ciclos: RotateCcw,
} as const;

const emptyForm = {
  categoria: 'PREVENTIVA_PROGRAMADA',
  grupo: '',
  item: '',
  base_legal: '',
  tipo_controle: 'calendario',
  obrigatorio: true,
  intervalo_meses: '',
  intervalo_horas: '',
  intervalo_pousos: '',
  intervalo_ciclos: '',
  ultima_execucao_data: '',
  ultima_execucao_horas: '',
  ultima_execucao_pousos: '',
  ultima_execucao_ciclos: '',
  observacoes: '',
};

export function ControleManutencaoTab({ aircraftId, registration, horasCelula }: Props) {
  const [itens, setItens] = useState<ItemPrograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ItemPrograma | null>(null);
  const [filtro, setFiltro] = useState<string>('TODAS');
  const [estado, setEstado] = useState<EstadoAeronave>({ horas: 0, pousos: 0, ciclos: 0 });
  const [medias, setMedias] = useState({ horasMes: 0, pousosMes: 0 });

  async function loadItens() {
    const { data, error } = await supabase
      .from('ctm_programa_manutencao')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .order('categoria', { ascending: true });
    if (error) {
      toast.error('Erro ao carregar programa: ' + error.message);
      setItens([]);
      setLoading(false);
      return;
    }

    const itensCarregados = (data ?? []) as ItemPrograma[];
    setItens(itensCarregados);

    if (itensCarregados.length === 0) {
      const novos = CATALOGO_PROGRAMA.map((c) => ({
        aeronave_id: aircraftId,
        categoria: c.categoria,
        grupo: c.grupo,
        item: c.item,
        base_legal: c.base_legal ?? null,
        tipo_controle: c.tipo_controle,
        obrigatorio: c.obrigatorio,
        intervalo_meses: c.intervalo_meses ?? null,
        intervalo_horas: c.intervalo_horas ?? null,
        intervalo_pousos: c.intervalo_pousos ?? null,
        intervalo_ciclos: c.intervalo_ciclos ?? null,
        observacoes: c.observacoes ?? null,
      }));

      const { error: insertError } = await supabase.from('ctm_programa_manutencao').insert(novos);
      if (!insertError) {
        const { data: reloadedData } = await supabase
          .from('ctm_programa_manutencao')
          .select('*')
          .eq('aeronave_id', aircraftId)
          .order('categoria', { ascending: true });
        setItens((reloadedData ?? []) as ItemPrograma[]);
      }
    }

    setLoading(false);
  }

  async function loadEstado() {
    const [{ data: aircraft }, { data: logs }] = await Promise.all([
      supabase.from('aeronave').select('horas_celula_atual').eq('id', aircraftId).maybeSingle(),
      supabase
        .from('lancamentos_diario_bordo')
        .select('data_registro, tempo_total, tempo_voo, pousos_total, celula')
        .eq('aeronave_id', aircraftId)
        .order('data_registro', { ascending: true }),
    ]);

    const entries = logs ?? [];
    const pousos = entries.reduce((a, e: any) => a + Number(e.pousos_total || 0), 0);
    const horasVoadas = entries.reduce((a, e: any) => a + Number(e.tempo_total || e.tempo_voo || 0), 0);
    const celulaMax = entries.reduce((a, e: any) => Math.max(a, Number(e.celula || 0)), 0);
    const aeronaveHoras = Number(horasCelula ?? aircraft?.horas_celula_atual ?? 0);
    const horas = Number.isFinite(aeronaveHoras) && aeronaveHoras > 0
      ? aeronaveHoras
      : (celulaMax > 0 ? celulaMax : horasVoadas);

    // médias dos últimos 12 meses com registro
    const meses = new Set(entries.map((e: any) => String(e.data_registro ?? '').slice(0, 7)).filter(Boolean));
    const nMeses = Math.max(1, meses.size);
    setMedias({ horasMes: horasVoadas / nMeses, pousosMes: pousos / nMeses });
    setEstado({ horas, pousos, ciclos: pousos });
  }

  useEffect(() => {
    setLoading(true);
    loadItens();
    loadEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aircraftId]);

  const statuses = useMemo(
    () => ordenarPorCriticidade(
      itens.map((i) => calcularStatusItem(i, estado, medias.horasMes, medias.pousosMes)),
    ),
    [itens, estado, medias],
  );

  const visiveis = filtro === 'TODAS' ? statuses : statuses.filter((s) => s.item.categoria === filtro);

  const contagem = useMemo(() => {
    const c: Record<NivelAlerta, number> = { vencido: 0, critico: 0, atencao: 0, ok: 0, sem_controle: 0 };
    statuses.forEach((s) => { c[s.nivel] += 1; });
    return c;
  }, [statuses]);

  async function excluir(id: string) {
    const { error } = await supabase.from('ctm_programa_manutencao').delete().eq('id', id);
    if (error) return toast.error('Erro ao excluir');
    toast.success('Item removido');
    loadItens();
  }

  async function registrarExecucao(item: ItemPrograma) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from('ctm_programa_manutencao')
      .update({
        ultima_execucao_data: hoje,
        ultima_execucao_horas: estado.horas,
        ultima_execucao_pousos: estado.pousos,
        ultima_execucao_ciclos: estado.ciclos,
      })
      .eq('id', item.id);
    if (error) return toast.error('Erro ao registrar execução');
    toast.success(`"${item.item}" marcado como executado hoje`);
    loadItens();
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="section-accent">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 teal-text" />
            Programa de Manutenção {registration ? `— ${registration}` : ''}
          </h2>
          <p className="text-xs text-muted-foreground">
            Itens regulatórios (ANAC), vida limitada, consumíveis e preventiva programada
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-2 rounded-lg bg-ctm-teal px-4 py-2 text-sm font-semibold text-[hsl(var(--ctm-navy))] transition-colors hover:bg-ctm-teal-light"
          >
            <Plus className="h-4 w-4" /> Novo item
          </button>
        </div>
      </div>

      {/* Situação atual da aeronave */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Horas de célula" value={`${estado.horas.toFixed(1)}h`} cls="teal-text" />
        <Metric label="Pousos acumulados" value={String(estado.pousos)} cls="text-blue-400" />
        <Metric label="Média horas/mês" value={`${medias.horasMes.toFixed(1)}h`} cls="text-purple-400" />
        <Metric label="Média pousos/mês" value={medias.pousosMes.toFixed(1)} cls="text-orange-400" />
      </div>

      {/* Semáforo */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(['vencido', 'critico', 'atencao', 'ok'] as NivelAlerta[]).map((n) => {
          const s = NIVEL_STYLE[n];
          return (
            <div key={n} className={cn('rounded-xl border p-4', s.bg, s.border)}>
              <div className="flex items-center gap-2">
                {n === 'ok'
                  ? <CheckCircle2 className={cn('h-4 w-4', s.text)} />
                  : <AlertTriangle className={cn('h-4 w-4', s.text)} />}
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</span>
              </div>
              <p className={cn('mt-1 text-2xl font-bold', s.text)}>{contagem[n]}</p>
            </div>
          );
        })}
      </div>

      {/* Filtros por categoria */}
      <div className="ctm-scroll mb-5 flex gap-2 overflow-x-auto pb-1">
        <FiltroChip ativo={filtro === 'TODAS'} onClick={() => setFiltro('TODAS')} label={`Todas (${statuses.length})`} />
        {CATEGORIAS_PROGRAMA.map((c) => {
          const n = statuses.filter((s) => s.item.categoria === c.value).length;
          return (
            <FiltroChip
              key={c.value}
              ativo={filtro === c.value}
              onClick={() => setFiltro(c.value)}
              label={`${c.label} (${n})`}
            />
          );
        })}
      </div>

      {showForm && (
        <ItemForm
          aircraftId={aircraftId}
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); loadItens(); }}
        />
      )}

      {visiveis.length === 0 ? (
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <Wrench className="mb-3 h-12 w-12 opacity-40 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhum item de manutenção cadastrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use “Aplicar catálogo padrão” para carregar os itens regulatórios da ANAC e os intervalos de fabricante.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiveis.map((s) => (
            <ItemRow
              key={s.item.id}
              status={s}
              onExecutar={() => registrarExecucao(s.item)}
              onEditar={() => { setEditing(s.item); setShowForm(true); }}
              onExcluir={() => excluir(s.item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="ctm-card p-4 text-center">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold', cls)}>{value}</p>
    </div>
  );
}

function FiltroChip({ ativo, onClick, label }: { ativo: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all',
        ativo
          ? 'border-[hsl(var(--ctm-teal)/0.5)] bg-[hsl(var(--ctm-teal)/0.12)] teal-text'
          : 'border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function ItemRow({ status, onExecutar, onEditar, onExcluir }: {
  status: StatusPrograma;
  onExecutar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}) {
  const { item } = status;
  const cat = categoriaConfig(item.categoria);
  const nivel = NIVEL_STYLE[status.nivel];

  return (
    <div className={cn('ctm-card border-l-4 p-5', nivel.border)} style={{ borderLeftColor: 'currentColor' }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{item.item}</p>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cat.bg, cat.border, cat.cor)}>
              {cat.label}
            </span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', nivel.bg, nivel.border, nivel.text)}>
              {nivel.label}
            </span>
            {item.obrigatorio && (
              <span className="rounded-full border border-red-500/25 bg-red-500/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                Obrigatório
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {[item.grupo, item.base_legal].filter(Boolean).join(' · ') || 'Sem base legal informada'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Última execução: {formatDataBR(item.ultima_execucao_data)}
            {item.ultima_execucao_horas != null && ` · ${Number(item.ultima_execucao_horas).toFixed(1)}h`}
            {item.ultima_execucao_pousos != null && ` · ${item.ultima_execucao_pousos} pousos`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onExecutar}
            title="Registrar execução hoje"
            className="rounded-lg border border-border/60 p-2 text-muted-foreground transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            onClick={onEditar}
            title="Editar item"
            className="rounded-lg border border-border/60 p-2 text-muted-foreground transition-colors hover:border-[hsl(var(--ctm-teal)/0.5)] hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onExcluir}
            title="Excluir item"
            className="rounded-lg border border-border/60 p-2 text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dimensões de controle */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {status.dimensoes.map((d) => {
          const Icon = ICON_TIPO[d.tipo];
          const st = NIVEL_STYLE[d.nivel];
          return (
            <div key={d.tipo} className="rounded-xl border border-border/50 bg-secondary/30 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" /> Cada {d.label}
                </span>
                <span className={cn('text-xs font-semibold', st.text)}>{d.proximo}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className={cn('h-full rounded-full transition-all', st.bar)} style={{ width: `${d.progresso}%` }} />
              </div>
              <p className={cn('mt-1.5 text-[11px] font-medium', st.text)}>{d.restanteLabel}</p>
            </div>
          );
        })}
        {status.dimensoes.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Configure um intervalo (meses, horas, pousos ou ciclos) para acompanhar este item.
          </p>
        )}
      </div>

      {status.previsaoData && (
        <p className="mt-3 text-xs text-muted-foreground">
          Previsão estimada pela utilização média: <span className="teal-text font-semibold">{formatDataBR(status.previsaoData)}</span>
        </p>
      )}
      {item.observacoes && (
        <p className="mt-2 rounded-lg bg-secondary/40 p-2.5 text-xs text-muted-foreground">{item.observacoes}</p>
      )}
    </div>
  );
}

function ItemForm({ aircraftId, initial, onClose, onSaved }: {
  aircraftId: string;
  initial: ItemPrograma | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initial
    ? {
      categoria: initial.categoria,
      grupo: initial.grupo ?? '',
      item: initial.item,
      base_legal: initial.base_legal ?? '',
      tipo_controle: initial.tipo_controle,
      obrigatorio: initial.obrigatorio ?? true,
      intervalo_meses: initial.intervalo_meses?.toString() ?? '',
      intervalo_horas: initial.intervalo_horas?.toString() ?? '',
      intervalo_pousos: initial.intervalo_pousos?.toString() ?? '',
      intervalo_ciclos: initial.intervalo_ciclos?.toString() ?? '',
      ultima_execucao_data: initial.ultima_execucao_data?.slice(0, 10) ?? '',
      ultima_execucao_horas: initial.ultima_execucao_horas?.toString() ?? '',
      ultima_execucao_pousos: initial.ultima_execucao_pousos?.toString() ?? '',
      ultima_execucao_ciclos: initial.ultima_execucao_ciclos?.toString() ?? '',
      observacoes: initial.observacoes ?? '',
    }
    : { ...emptyForm });

  const f = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v === '' ? null : Number(String(v).replace(',', '.')));

  async function save() {
    if (!form.item.trim()) return toast.error('Informe o nome do item');
    setSaving(true);
    const payload = {
      aeronave_id: aircraftId,
      categoria: form.categoria,
      grupo: form.grupo || null,
      item: form.item,
      base_legal: form.base_legal || null,
      tipo_controle: form.tipo_controle,
      obrigatorio: form.obrigatorio,
      intervalo_meses: num(form.intervalo_meses),
      intervalo_horas: num(form.intervalo_horas),
      intervalo_pousos: num(form.intervalo_pousos),
      intervalo_ciclos: num(form.intervalo_ciclos),
      ultima_execucao_data: form.ultima_execucao_data || null,
      ultima_execucao_horas: num(form.ultima_execucao_horas),
      ultima_execucao_pousos: num(form.ultima_execucao_pousos),
      ultima_execucao_ciclos: num(form.ultima_execucao_ciclos),
      observacoes: form.observacoes || null,
    };

    const { error } = initial
      ? await supabase.from('ctm_programa_manutencao').update(payload).eq('id', initial.id)
      : await supabase.from('ctm_programa_manutencao').insert(payload);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      setSaving(false);
      return;
    }
    toast.success(initial ? 'Item atualizado' : 'Item adicionado ao programa');
    onSaved();
  }

  return (
    <div className="ctm-card mb-6 border-[hsl(var(--ctm-teal)/0.3)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold teal-text">{initial ? 'Editar item' : 'Novo item do programa'}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">Item *</label>
          <input className="ctm-input w-full" placeholder="Ex: Inspeção Anual de Manutenção (IAM)"
            value={form.item} onChange={(e) => f('item', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Categoria</label>
          <select className="ctm-input w-full" value={form.categoria} onChange={(e) => f('categoria', e.target.value)}>
            {CATEGORIAS_PROGRAMA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Grupo</label>
          <input className="ctm-input w-full" placeholder="Ex: Motor, Trem de pouso"
            value={form.grupo} onChange={(e) => f('grupo', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Base legal / referência</label>
          <input className="ctm-input w-full" placeholder="Ex: RBAC 91.409"
            value={form.base_legal} onChange={(e) => f('base_legal', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Tipo de controle</label>
          <select className="ctm-input w-full" value={form.tipo_controle} onChange={(e) => f('tipo_controle', e.target.value)}>
            {TIPOS_CONTROLE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Intervalos (preencha os aplicáveis)</p>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Campo label="Meses" value={form.intervalo_meses} onChange={(v) => f('intervalo_meses', v)} />
        <Campo label="Horas" value={form.intervalo_horas} onChange={(v) => f('intervalo_horas', v)} />
        <Campo label="Pousos" value={form.intervalo_pousos} onChange={(v) => f('intervalo_pousos', v)} />
        <Campo label="Ciclos" value={form.intervalo_ciclos} onChange={(v) => f('intervalo_ciclos', v)} />
      </div>

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Última execução</p>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Data</label>
          <input type="date" className="ctm-input w-full" value={form.ultima_execucao_data}
            onChange={(e) => f('ultima_execucao_data', e.target.value)} />
        </div>
        <Campo label="Horas de célula" value={form.ultima_execucao_horas} onChange={(v) => f('ultima_execucao_horas', v)} />
        <Campo label="Pousos" value={form.ultima_execucao_pousos} onChange={(v) => f('ultima_execucao_pousos', v)} />
        <Campo label="Ciclos" value={form.ultima_execucao_ciclos} onChange={(v) => f('ultima_execucao_ciclos', v)} />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-muted-foreground">Observações</label>
        <textarea className="ctm-input h-16 w-full resize-none" value={form.observacoes}
          onChange={(e) => f('observacoes', e.target.value)} />
      </div>

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={form.obrigatorio} onChange={(e) => f('obrigatorio', e.target.checked)}
          className="h-4 w-4 rounded border-border accent-[hsl(var(--ctm-teal))]" />
        Item obrigatório (regulatório ou operacionalmente exigido)
      </label>

      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-ctm-teal px-4 py-2 text-sm font-semibold text-[hsl(var(--ctm-navy))] transition-colors hover:bg-ctm-teal-light disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {initial ? 'Salvar alterações' : 'Adicionar item'}
        </button>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input type="number" step="0.01" min="0" className="ctm-input w-full" placeholder="—"
        value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ctm-teal border-t-transparent" />
    </div>
  );
}