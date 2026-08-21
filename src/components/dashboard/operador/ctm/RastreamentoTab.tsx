import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine,
  CalendarDays, CheckCircle2, ClipboardList, FileText, History, Loader2,
  PackageSearch, Plus, RefreshCw, Search, ShieldCheck, Wrench, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const db = supabase as any;

type Component = Record<string, any>;
type EventType = 'instalacao' | 'remocao' | 'inspecao' | 'revisao' | 'transferencia' | 'ajuste';

const EVENT_LABELS: Record<EventType, string> = {
  instalacao: 'Instalação', remocao: 'Remoção', inspecao: 'Inspeção',
  revisao: 'Revisão', transferencia: 'Transferência', ajuste: 'Ajuste de cadastro',
};

const EVENT_ICONS: Record<EventType, typeof Wrench> = {
  instalacao: ArrowDownToLine, remocao: ArrowUpFromLine, inspecao: ShieldCheck,
  revisao: Wrench, transferencia: ArrowLeftRight, ajuste: RefreshCw,
};

function dateBR(value: any) {
  return value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : '—';
}

function num(value: any) {
  return value === null || value === undefined || value === '' ? '—' : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

export function RastreamentoTab({ aircraftId }: { aircraftId: string }) {
  const [components, setComponents] = useState<Component[]>([]);
  const [events, setEvents] = useState<Component[]>([]);
  const [oas, setOas] = useState<Component[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    componente_id: '', tipo_evento: 'inspecao' as EventType, data_evento: new Date().toISOString().slice(0, 10),
    horas_aeronave: '', pousos_aeronave: '', ciclos_aeronave: '', posicao: '',
    p_n_removido: '', s_n_removido: '', p_n_instalado: '', s_n_instalado: '',
    motivo: '', descricao: '', ordem_servico_id: '', documento_url: '', documento_nome: '',
  });

  async function load() {
    setLoading(true);
    const [componentResult, eventResult, oasResult] = await Promise.all([
      db.from('ctm_mapa_componente').select('*').eq('aeronave_id', aircraftId).order('nome'),
      db.from('ctm_componente_eventos').select('*').eq('aeronave_id', aircraftId).order('data_evento', { ascending: false }),
      db.from('ctm_ordem_acompanhamento_servico').select('id, numero, os_oficina, oficina_nome, data_entrada, data_saida, status').eq('aeronave_id', aircraftId).order('data_entrada', { ascending: false }),
    ]);
    if (componentResult.error) toast.error(`Não foi possível carregar os componentes: ${componentResult.error.message}`);
    if (eventResult.error) toast.error(`Não foi possível carregar o histórico: ${eventResult.error.message}`);
    setComponents(componentResult.data ?? []);
    setEvents(eventResult.data ?? []);
    setOas(oasResult.data ?? []);
    setSelectedId((current) => current || componentResult.data?.[0]?.id || '');
    setLoading(false);
  }

  useEffect(() => { load(); }, [aircraftId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return components;
    return components.filter((item) => [item.nome, item.categoria, item.localizacao, item.numero_da_peça, item.numero_de_serie, item.fabricante]
      .some((value) => String(value || '').toLowerCase().includes(normalized)));
  }, [components, query]);

  const selected = components.find((item) => item.id === selectedId);
  const selectedEvents = events.filter((event) => event.componente_id === selectedId);
  const lastEvent = selectedEvents[0];
  const status = String(selected?.status || '').toLowerCase();

  function openNewEvent(componentId = selectedId) {
    setForm((current) => ({ ...current, componente_id: componentId, data_evento: new Date().toISOString().slice(0, 10) }));
    setShowForm(true);
  }

  async function saveEvent() {
    if (!form.componente_id || !form.data_evento || !form.descricao.trim()) {
      toast.error('Selecione o componente, informe a data e descreva o evento técnico.');
      return;
    }
    setSaving(true);
    const payload = {
      aeronave_id: aircraftId,
      componente_id: form.componente_id,
      tipo_evento: form.tipo_evento,
      data_evento: form.data_evento,
      horas_aeronave: form.horas_aeronave ? Number(form.horas_aeronave) : null,
      pousos_aeronave: form.pousos_aeronave ? Number(form.pousos_aeronave) : null,
      ciclos_aeronave: form.ciclos_aeronave ? Number(form.ciclos_aeronave) : null,
      posicao: form.posicao || null,
      p_n_removido: form.p_n_removido || null,
      s_n_removido: form.s_n_removido || null,
      p_n_instalado: form.p_n_instalado || null,
      s_n_instalado: form.s_n_instalado || null,
      motivo: form.motivo || null,
      descricao: form.descricao.trim(),
      ordem_servico_id: form.ordem_servico_id || null,
      documento_url: form.documento_url || null,
      documento_nome: form.documento_nome || null,
    };
    const { error } = await db.from('ctm_componente_eventos').insert(payload);
    if (error) toast.error(`Erro ao registrar evento: ${error.message}`);
    else {
      toast.success('Evento técnico registrado no histórico do componente.');
      setSelectedId(form.componente_id);
      setShowForm(false);
      setForm((current) => ({ ...current, descricao: '', motivo: '', ordem_servico_id: '', documento_url: '', documento_nome: '' }));
      await load();
    }
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-cyan-300" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.08] via-slate-950/70 to-slate-950/80 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200"><Activity className="h-4 w-4" /> Rastreabilidade técnica</div>
          <h2 className="mt-2 text-xl font-semibold text-white">Ciclo de vida dos componentes</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Consulte quando cada componente foi instalado, inspecionado ou removido, em qual OAS o evento ocorreu e quais documentos comprovam o serviço.</p>
        </div>
        <button onClick={() => openNewEvent()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 active:scale-[.98] disabled:opacity-50" disabled={components.length === 0}><Plus className="h-4 w-4" /> Registrar evento</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
        <section className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Inventário</p><h3 className="mt-1 font-semibold text-white">Componentes acompanhados</h3></div><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-200">{components.length}</span></div>
          <label className="relative mb-3 block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar nome, P/N, S/N ou posição" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40" /></label>
          <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {filtered.map((item) => {
              const itemEvents = events.filter((event) => event.componente_id === item.id);
              const active = item.id === selectedId;
              return <button key={item.id} onClick={() => setSelectedId(item.id)} className={cn('w-full rounded-xl border p-3 text-left transition', active ? 'border-cyan-300/35 bg-cyan-300/[0.09]' : 'border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{item.nome || 'Componente sem nome'}</p><p className="mt-1 truncate text-xs text-slate-400">{[item.localizacao, item.categoria].filter(Boolean).join(' · ') || 'Posição não informada'}</p></div><span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', statusDot(item.status))} /></div><div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>{item.numero_de_serie ? `S/N ${item.numero_de_serie}` : item.numero_da_peça ? `P/N ${item.numero_da_peça}` : 'Sem identificação'}</span><span>{itemEvents.length} evento(s)</span></div></button>;
            })}
            {filtered.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500"><PackageSearch className="mx-auto mb-2 h-6 w-6" />Nenhum componente encontrado.</div>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 sm:p-5">
          {!selected ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-slate-500"><PackageSearch className="mb-3 h-10 w-10" /><p className="text-sm">Cadastre um componente no Mapa de Componente para iniciar o rastreamento.</p></div> : <>
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-lg font-semibold text-white">{selected.nome}</h3><span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', statusBadge(status))}>{status || 'ativo'}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400"><span>P/N: <b className="text-slate-200">{selected.numero_da_peça || '—'}</b></span><span>S/N: <b className="text-slate-200">{selected.numero_de_serie || '—'}</b></span><span>Posição: <b className="text-slate-200">{selected.localizacao || '—'}</b></span></div></div><button onClick={() => openNewEvent(selected.id)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15"><Plus className="h-3.5 w-3.5" /> Novo evento</button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric icon={CalendarDays} label="Instalação atual" value={dateBR(selected.data_instalada)} /><Metric icon={Activity} label="Horas na instalação" value={`${num(selected.horas_instaladas)}h`} /><Metric icon={History} label="Último evento" value={lastEvent ? dateBR(lastEvent.data_evento) : 'Sem histórico'} /></div>
            <div className="mt-5"><div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Linha do tempo</p><h4 className="mt-1 font-semibold text-white">Histórico documentado</h4></div><span className="text-xs text-slate-500">{selectedEvents.length} registro(s)</span></div>{selectedEvents.length === 0 ? <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">Nenhum evento técnico registrado para este componente.</div> : <div className="space-y-3">{selectedEvents.map((event) => <EventCard key={event.id} event={event} oas={oas} />)}</div>}</div>
          </>}
        </section>
      </div>

      {showForm && <EventForm form={form} setForm={setForm} components={components} oas={oas} saving={saving} onClose={() => setShowForm(false)} onSave={saveEvent} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500"><Icon className="h-3.5 w-3.5 text-cyan-300" />{label}</div><p className="mt-2 text-sm font-semibold text-white">{value}</p></div>; }

function EventCard({ event, oas }: { event: Component; oas: Component[] }) {
  const type = (event.tipo_evento || 'ajuste') as EventType;
  const Icon = EVENT_ICONS[type] || RefreshCw;
  const linkedOas = oas.find((item) => item.id === event.ordem_servico_id);
  return <div className="relative rounded-xl border border-white/10 bg-white/[0.025] p-4"><div className="flex gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-sm font-semibold text-white">{EVENT_LABELS[type] || event.tipo_evento}</span><span className="ml-2 text-xs text-slate-500">{dateBR(event.data_evento)}</span></div>{linkedOas && <span className="rounded-full border border-blue-300/20 bg-blue-300/10 px-2 py-1 text-[10px] font-medium text-blue-200">OAS #{linkedOas.numero || '—'}</span>}</div><p className="mt-2 text-sm leading-5 text-slate-300">{event.descricao}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500"><span>Horas: <b className="text-slate-300">{num(event.horas_aeronave)}</b></span><span>Pousos: <b className="text-slate-300">{num(event.pousos_aeronave)}</b></span>{event.posicao && <span>Posição: <b className="text-slate-300">{event.posicao}</b></span>}{event.motivo && <span>Motivo: <b className="text-slate-300">{event.motivo}</b></span>}</div>{(event.s_n_removido || event.s_n_instalado || event.documento_url) && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs">{event.s_n_removido && <span className="text-rose-300">S/N removido: {event.s_n_removido}</span>}{event.s_n_instalado && <span className="text-emerald-300">S/N instalado: {event.s_n_instalado}</span>}{event.documento_url && <a href={event.documento_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-200 hover:text-white"><FileText className="h-3.5 w-3.5" />{event.documento_nome || 'Documento'}</a>}</div>}</div></div></div>;
}

function EventForm({ form, setForm, components, oas, saving, onClose, onSave }: any) {
  const update = (key: string, value: string) => setForm((current: any) => ({ ...current, [key]: value }));
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-cyan-300/20 bg-slate-950 p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200">Rastreabilidade</p><h3 className="mt-1 text-xl font-semibold text-white">Registrar evento técnico</h3></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Componente *"><select className="ctm-rastreamento-input" value={form.componente_id} onChange={(e) => update('componente_id', e.target.value)}><option value="">Selecione</option>{components.map((item: any) => <option key={item.id} value={item.id}>{item.nome} {item.numero_de_serie ? `· S/N ${item.numero_de_serie}` : ''}</option>)}</select></Field><Field label="Tipo de evento *"><select className="ctm-rastreamento-input" value={form.tipo_evento} onChange={(e) => update('tipo_evento', e.target.value)}>{Object.entries(EVENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Data do evento *"><input className="ctm-rastreamento-input" type="date" value={form.data_evento} onChange={(e) => update('data_evento', e.target.value)} /></Field><Field label="OAS relacionada"><select className="ctm-rastreamento-input" value={form.ordem_servico_id} onChange={(e) => update('ordem_servico_id', e.target.value)}><option value="">Sem OAS vinculada</option>{oas.map((item: any) => <option key={item.id} value={item.id}>OAS #{item.numero || '—'} · {item.oficina_nome || 'Oficina não informada'}</option>)}</select></Field><Field label="Horas da aeronave"><input className="ctm-rastreamento-input" type="number" step="0.1" value={form.horas_aeronave} onChange={(e) => update('horas_aeronave', e.target.value)} /></Field><Field label="Pousos da aeronave"><input className="ctm-rastreamento-input" type="number" value={form.pousos_aeronave} onChange={(e) => update('pousos_aeronave', e.target.value)} /></Field><Field label="P/N removido"><input className="ctm-rastreamento-input" value={form.p_n_removido} onChange={(e) => update('p_n_removido', e.target.value)} /></Field><Field label="S/N removido"><input className="ctm-rastreamento-input" value={form.s_n_removido} onChange={(e) => update('s_n_removido', e.target.value)} /></Field><Field label="P/N instalado"><input className="ctm-rastreamento-input" value={form.p_n_instalado} onChange={(e) => update('p_n_instalado', e.target.value)} /></Field><Field label="S/N instalado"><input className="ctm-rastreamento-input" value={form.s_n_instalado} onChange={(e) => update('s_n_instalado', e.target.value)} /></Field><Field label="Posição"><input className="ctm-rastreamento-input" placeholder="Ex.: Trem principal LH" value={form.posicao} onChange={(e) => update('posicao', e.target.value)} /></Field><Field label="Motivo"><input className="ctm-rastreamento-input" placeholder="Ex.: desgaste, inspeção, limite" value={form.motivo} onChange={(e) => update('motivo', e.target.value)} /></Field><div className="sm:col-span-2"><Field label="Descrição técnica *"><textarea className="ctm-rastreamento-input min-h-24 resize-y" placeholder="Descreva o que foi executado e a condição encontrada." value={form.descricao} onChange={(e) => update('descricao', e.target.value)} /></Field></div><Field label="Nome do documento"><input className="ctm-rastreamento-input" placeholder="OS, laudo ou nota fiscal" value={form.documento_nome} onChange={(e) => update('documento_nome', e.target.value)} /></Field><Field label="URL do documento"><input className="ctm-rastreamento-input" placeholder="Link do comprovante" value={form.documento_url} onChange={(e) => update('documento_url', e.target.value)} /></Field></div><div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">Cancelar</button><button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}Salvar evento</button></div></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-xs font-medium text-slate-400">{label}<div className="mt-1.5">{children}</div></label>; }

function statusDot(status: any) { const s = String(status || '').toLowerCase(); return s.includes('expir') ? 'bg-rose-400' : s.includes('urgent') ? 'bg-amber-300' : 'bg-emerald-300'; }
function statusBadge(status: string) { return status.includes('expir') ? 'border-rose-300/20 bg-rose-300/10 text-rose-200' : status.includes('urgent') ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'; }
