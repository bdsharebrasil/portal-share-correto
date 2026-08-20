import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Eye, Calendar, Clock, ChevronRight, Paperclip, X, Save, Loader2, Pencil, Search, FolderOpen, Wrench, CheckCircle2, ListFilter } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OASTabProps { aircraftId: string; }

export function OASTab({ aircraftId }: OASTabProps) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});

  async function loadOAS() {
    setLoading(true);
    // OBS: status_aprovacao já é uma coluna própria de ctm_ordem_acompanhamento_servico.
    // Não existe FK entre esta tabela e ctm_aprovacoes_ordem_servico (aquela tabela se
    // relaciona com ctm_orcamentos), então não tentamos mais fazer o embed do Supabase
    // aqui — isso derrubava a query inteira silenciosamente.
    const { data, error } = await supabase
      .from('ctm_ordem_acompanhamento_servico')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar OAS:', error);
      toast.error('Erro ao carregar OAS: ' + error.message);
      setList([]);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    setList(rows);
    const years = [...new Set(rows.map((oas: any) => getOASYear(oas)))];
    setOpenYears((current) => Object.fromEntries(years.map((year) => [year, current[year] ?? true])));
    setLoading(false);
  }

  useEffect(() => { loadOAS(); }, [aircraftId]);

  const filteredList = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((oas: any) => [oas.numero, oas.tipo_manutencao, oas.periodo, oas.objetivo, oas.oficina_nome, oas.mecanico_responsavel]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
  }, [list, search]);

  const groupedByYear = useMemo(() => filteredList.reduce<Record<string, any[]>>((groups, oas: any) => {
    const year = getOASYear(oas);
    (groups[year] ||= []).push(oas);
    return groups;
  }, {}), [filteredList]);
  const years = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));
  const totalConcluidas = list.filter((oas: any) => String(oas.status || '').toLowerCase().includes('conclu')).length;

  if (loading) return <LoadingSpinner />;
  if (selected) return <OASDetail oas={selected} onBack={() => { setSelected(null); loadOAS(); }} aircraftId={aircraftId} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/60 p-5 shadow-xl md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-ctm-teal"><Wrench className="h-4 w-4" /> Centro de manutenção</div>
          <h2 className="text-2xl font-bold tracking-tight">Ordens de Acompanhamento de Serviço</h2>
          <p className="mt-1 text-sm text-muted-foreground">Organize os lançamentos por ano e acompanhe a execução de cada serviço.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-ctm-teal px-4 py-2.5 text-sm font-semibold text-[hsl(var(--ctm-navy))] shadow-lg shadow-ctm-teal/10 transition hover:bg-ctm-teal-light active:scale-[0.98]"><Plus className="h-4 w-4" /> Nova OAS</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard icon={FileText} label="Total de OAS" value={String(list.length)} />
        <MetricCard icon={CheckCircle2} label="Concluídas" value={String(totalConcluidas)} tone="emerald" />
        <MetricCard icon={FolderOpen} label="Pastas anuais" value={String(Object.keys(groupedByYearFromList(list)).length)} tone="blue" />
      </div>

      {showForm && <NovaOASForm aircraftId={aircraftId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadOAS(); }} />}

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-3 md:flex-row md:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="ctm-input w-full pl-9" placeholder="Buscar por número, tipo, oficina, mecânico ou objetivo..." /></div>
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><ListFilter className="h-4 w-4" /> {filteredList.length} lançamento(s)</div>
      </div>

      {list.length === 0 && !showForm ? <EmptySection icon={FileText} text="Nenhuma OAS registrada" /> : years.length === 0 ? <EmptySection icon={Search} text="Nenhuma OAS encontrada para essa busca" /> : (
        <div className="space-y-4">
          {years.map((year) => {
            const opened = openYears[year] ?? true;
            return <section key={year} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35 shadow-lg">
              <button onClick={() => setOpenYears((current) => ({ ...current, [year]: !opened }))} className="flex w-full items-center gap-4 border-b border-white/10 bg-gradient-to-r from-blue-950/80 to-slate-900/70 px-5 py-4 text-left transition hover:from-blue-900/80">
                <FolderOpen className="h-8 w-8 shrink-0 text-blue-300" />
                <span className="flex-1"><span className="block text-lg font-bold">{year}</span><span className="text-xs text-muted-foreground">{groupedByYear[year].length} lançamento(s) neste arquivo</span></span>
                <ChevronRight className={cn('h-5 w-5 text-blue-200 transition-transform', opened && 'rotate-90')} />
              </button>
              {opened && <div className="space-y-3 p-3 md:p-4">{groupedByYear[year].map((oas: any) => <OASListCard key={oas.id} oas={oas} onClick={() => setSelected(oas)} />)}</div>}
            </section>;
          })}
        </div>
      )}
    </div>
  );
}

// ── Nova OAS Form ────────────────────────────────────────────────────────────
function NovaOASForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [programItems, setProgramItems] = useState<any[]>([]);
  const [form, setForm] = useState({
    programa_manutencao_id: '',
    tipo_manutencao: 'CORRETIVA', periodo: '', periodo_inicio: '', periodo_fim: '',
    tipo_rateio: 'horas', oficina_nome: '', os_oficina: '', horas_celula: '', dias_previstos: '',
    data_entrada: '', data_saida: '', mecanico_responsavel: '', objetivo: '', observacoes: '',
  });

  useEffect(() => {
    supabase.from('ctm_programa_manutencao').select('*').eq('aeronave_id', aircraftId).eq('status', 'ativo').order('item', { ascending: true })
      .then(({ data }) => setProgramItems(data ?? []));
  }, [aircraftId]);

  function selecionarPrograma(id: string) {
    const item = programItems.find((candidate) => candidate.id === id);
    setForm((current) => ({
      ...current,
      programa_manutencao_id: id,
      tipo_manutencao: item ? mapProgramaTipo(item.categoria) : current.tipo_manutencao,
      periodo: item ? item.item : current.periodo,
      objetivo: item ? item.item : current.objetivo,
    }));
  }

  async function save() {
    if (!form.tipo_manutencao || !form.data_entrada) { toast.error('Tipo e data de entrada são obrigatórios'); return; }
    setSaving(true);

    // Get next OAS number
    const { data: lastOAS } = await supabase
      .from('ctm_ordem_acompanhamento_servico')
      .select('numero')
      .eq('aeronave_id', aircraftId)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastNum = lastOAS?.[0]?.numero ? Number(lastOAS[0].numero) : 0;
    const nextNum = String(lastNum + 1);

    const { error } = await (supabase.from('ctm_ordem_acompanhamento_servico') as any).insert({
      aeronave_id: aircraftId,
      numero: nextNum,
      programa_manutencao_id: form.programa_manutencao_id || null,
      tipo_manutencao: form.tipo_manutencao,
      periodo: form.periodo,
      periodo_inicio: form.periodo_inicio || null,
      periodo_fim: form.periodo_fim || null,
      tipo_rateio: form.tipo_rateio || null,
      oficina_nome: form.oficina_nome || null,
      os_oficina: form.os_oficina || null,
      horas_celula: form.horas_celula ? Number(form.horas_celula) : null,
      dias_previstos: form.dias_previstos ? Number(form.dias_previstos) : null,
      data_entrada: form.data_entrada,
      data_saida: form.data_saida || null,
      mecanico_responsavel: form.mecanico_responsavel || null,
      objetivo: form.objetivo || null,
      observacoes: form.observacoes || null,
      status: 'aberto',
    });

    if (!error) { toast.success(`OAS #${nextNum} criada!`); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Nova OAS</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>
      <div className="mb-4 rounded-xl border border-blue-400/20 bg-blue-500/5 p-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-blue-200">Item do Programa de Manutenção</label>
        <select className="ctm-input w-full" value={form.programa_manutencao_id} onChange={(e) => selecionarPrograma(e.target.value)}>
          <option value="">OAS avulsa — não vincular ao programa</option>
          {programItems.map((item) => <option key={item.id} value={item.id}>{item.item}{item.grupo ? ` · ${item.grupo}` : ''}</option>)}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">Ao finalizar esta OAS, os dados de execução serão gravados automaticamente no item selecionado.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipo de Manutenção *</label>
          <select className="ctm-input w-full" value={form.tipo_manutencao} onChange={e => f('tipo_manutencao', e.target.value)}>
            <option value="CORRETIVA">Corretiva</option>
            <option value="PREVENTIVA">Preventiva</option>
            <option value="PROGRAMADA">Programada</option>
            <option value="C.V.A">C.V.A (Certificado de Vôo Anual)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Período</label>
          <input className="ctm-input w-full" placeholder="Ex: 50 HORAS, ANUAL" value={form.periodo} onChange={e => f('periodo', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Início do Período</label>
          <input type="date" className="ctm-input w-full" value={form.periodo_inicio} onChange={e => f('periodo_inicio', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Fim do Período</label>
          <input type="date" className="ctm-input w-full" value={form.periodo_fim} onChange={e => f('periodo_fim', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data Entrada *</label>
          <input type="date" className="ctm-input w-full" value={form.data_entrada} onChange={e => f('data_entrada', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data Saída</label>
          <input type="date" className="ctm-input w-full" value={form.data_saida} onChange={e => f('data_saida', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">O.S Oficina</label>
          <input className="ctm-input w-full" placeholder="008-2025" value={form.os_oficina} onChange={e => f('os_oficina', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Horas de célula</label>
          <input type="number" step="0.1" className="ctm-input w-full" value={form.horas_celula} onChange={e => f('horas_celula', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Dias previstos MNT</label>
          <input type="number" className="ctm-input w-full" value={form.dias_previstos} onChange={e => f('dias_previstos', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Oficina</label>
          <input className="ctm-input w-full" placeholder="Nome da oficina" value={form.oficina_nome} onChange={e => f('oficina_nome', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipo de Rateio</label>
          <select className="ctm-input w-full" value={form.tipo_rateio} onChange={e => f('tipo_rateio', e.target.value)}>
            <option value="horas">Horas</option>
            <option value="valor">Valor</option>
            <option value="percentual">Percentual</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mecânico Responsável</label>
          <input className="ctm-input w-full" placeholder="Nome ou oficina" value={form.mecanico_responsavel} onChange={e => f('mecanico_responsavel', e.target.value)} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Objetivo</label>
          <input className="ctm-input w-full" placeholder="Ex: Inspeção 50 horas" value={form.objetivo} onChange={e => f('objetivo', e.target.value)} />
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
          Criar OAS
        </button>
      </div>
    </div>
  );
}

// ── OAS Detail ───────────────────────────────────────────────────────────────
function OASDetail({ oas: oasInicial, onBack, aircraftId }: { oas: any; onBack: () => void; aircraftId: string }) {
  const [oas, setOas] = useState<any>(oasInicial);
  const [editando, setEditando] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [execucoes, setExecucoes] = useState<any[]>([]);
  const [pecas, setPecas] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('ctm_documentos_oas').select('*').eq('ordem_servico_id', oas.id)
      .then(({ data }) => { if (data) setDocs(data); });

    supabase.from('ctm_orcamentos').select('*, ctm_itens_orcamento(*)')
      .eq('itens_servico_id', oas.id)
      .then(({ data }) => { if (data) setOrcamentos(data); });

    // Buscar execuções relacionadas pela referência ordem_servico (campo livre)
    supabase.from('ctm_execucoes').select('*').eq('ordem_servico', oas.id)
      .then(({ data }) => { if (data) setExecucoes(data); });

    // Buscar peças trocadas vinculadas à ordem
    supabase.from('ctm_pecas_trocadas').select('*').eq('ordem_servico_id', oas.id)
      .then(({ data }) => { if (data) setPecas(data); });
  }, [oas.id]);

  async function recarregar() {
    // Sem embed de ctm_aprovacoes_ordem_servico — ver nota em loadOAS() acima.
    const { data, error } = await supabase
      .from('ctm_ordem_acompanhamento_servico')
      .select('*')
      .eq('id', oas.id)
      .maybeSingle();
    if (error) {
      console.error('Erro ao recarregar OAS:', error);
      toast.error('Erro ao recarregar OAS: ' + error.message);
      return;
    }
    if (data) setOas(data);
  }

  const totalServicos = oas.total_mao_obra ?? (execucoes.reduce((s: number, i: any) => s + Number(i.valor || 0), 0) as number);
  const totalPecas = oas.total_pecas ?? (pecas.reduce((s: number, i: any) => s + Number(i.valor_total || 0), 0) as number);

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        ← Voltar para lista
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Header */}
          <div className="ctm-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">OAS #{oas.numero}</h2>
                <p className="text-muted-foreground">{oas.tipo_manutencao} {oas.periodo && `· ${oas.periodo}`}</p>
                {(oas as any).programa_manutencao_id && <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-200"><FolderOpen className="h-3 w-3" /> Vinculada ao Programa de Manutenção</span>}
              </div>
              <div className="flex items-center gap-3">
                <OASStatusBadge status={oas.status} aprovStatus={oas.status_aprovacao} />
                <button
                  onClick={() => setEditando(v => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-[#45d1b5] px-3 py-1 text-xs font-medium text-[#45d1b5] hover:bg-[#45d1b5]/10 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> {editando ? 'Fechar edição' : 'Editar OAS'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoItem label="O.S Oficina" value={oas.os_oficina || '—'} />
              <InfoItem label="Horas de célula" value={oas.horas_celula != null ? String(oas.horas_celula) : '—'} />
              <InfoItem label="Oficina" value={oas.oficina_nome || '—'} />
              <InfoItem label="Rateio" value={oas.tipo_rateio || '—'} />
              <InfoItem label="Entrada" value={formatDate(oas.data_entrada)} />
              <InfoItem label="Saída" value={formatDate(oas.data_saida)} />
              <InfoItem label="Dias previstos" value={oas.dias_previstos != null ? String(oas.dias_previstos) : '—'} />
              <InfoItem label="Dias efetivos" value={oas.dias_efetivos != null ? String(oas.dias_efetivos) : '—'} />
              <InfoItem label="Mecânico" value={oas.mecanico_responsavel || '—'} />
              <InfoItem label="Período (início)" value={formatDate(oas.periodo_inicio)} />
              <InfoItem label="Período (fim)" value={formatDate(oas.periodo_fim)} />
              <InfoItem label="Relatório de voo" value={`${oas.relatorio_voo_de || '—'} até ${oas.relatorio_voo_ate || '—'}`} />
            </div>
            {oas.objetivo && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Objetivo</p>
                <p className="text-sm">{oas.objetivo}</p>
              </div>
            )}
            {oas.observacoes && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Observações</p>
                <p className="text-sm">{oas.observacoes}</p>
              </div>
            )}
          </div>

          {editando && (
            <EditarOASForm
              oas={oas}
              aircraftId={aircraftId}
              onClose={() => setEditando(false)}
              onSaved={async () => { await recarregar(); setEditando(false); }}
            />
          )}

          {/* Serviços */}
          {execucoes?.length > 0 && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text">Serviços / Mão de Obra</h3>
              <div className="space-y-2">
                {execucoes.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.ordem_servico || s.oficina || s.observacoes || 'Serviço'}</p>
                      <p className="text-xs text-muted-foreground">{s.oficina || ''}{s.observacoes && ` · ${s.observacoes}`}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className="text-sm font-bold">{s.horas_aeronave_na_execucao ? `${s.horas_aeronave_na_execucao} h` : '—'}</p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2">
                  <span className="text-muted-foreground">Subtotal MO</span>
                  <span>{typeof totalServicos === 'number' ? `R$ ${totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : totalServicos}</span>
                </div>
              </div>
            </div>
          )}

          {/* Peças */}
          {pecas?.length > 0 && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text">Peças Aplicadas</h3>
              <div className="space-y-2">
                {pecas.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.fornecedor}
                        {p.p_n_instalado && ` · P/N: ${p.p_n_instalado}`}
                        {p.s_n_instalado && ` · S/N: ${p.s_n_instalado}`}
                        {p.quantidade && ` · Qtd: ${p.quantidade}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold ml-4">—</p>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2">
                  <span className="text-muted-foreground">Subtotal Peças</span>
                  <span>R$ {Number(totalPecas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Orçamentos vinculados */}
          {orcamentos.length > 0 && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text">Orçamentos Vinculados</h3>
              {orcamentos.map(orc => (
                <div key={orc.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <div>
                    <p className="text-sm font-medium">OA #{orc.numero_orcamento}</p>
                    <p className="text-xs text-muted-foreground">{orc.descricao}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AprovBadge status={orc.status_aprovacao} />
                    <p className="text-sm font-bold">R$ {Number(orc.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Documentos */}
          {docs.length > 0 && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text flex items-center gap-2">
                <Paperclip className="h-4 w-4" /> Documentos Anexos
              </h3>
              <div className="space-y-2">
                {docs.map(doc => (
                  <a
                    key={doc.id}
                    href={supabase.storage.from('oas_documentos').getPublicUrl(doc.caminho_arquivo).data.publicUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    <FileText className="h-4 w-4 teal-text shrink-0" />
                    <div>
                      <p className="text-sm">{doc.nome_arquivo}</p>
                      {doc.tipo_documento && <p className="text-xs text-muted-foreground">{doc.tipo_documento}</p>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="ctm-card p-5">
            <h3 className="font-semibold mb-4 teal-text">Resumo Financeiro</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mão de obra</span>
                <span>R$ {totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Peças</span>
                <span>R$ {totalPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-3 border-t border-border flex justify-between font-bold">
                <span>Total</span>
                <span className="teal-text">R$ {(totalServicos + totalPecas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Rateio salvo */}
          {oas.total_voado_porcentagem && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text">Rateio</h3>
              <p className="text-xs text-muted-foreground mb-2">% voado por sócio:</p>
              <p className="text-sm font-mono">{oas.total_voado_porcentagem}</p>
              {oas.porcentagem_rateio && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Para rateio:</p>
                  <p className="text-sm font-mono">{oas.porcentagem_rateio}</p>
                </div>
              )}
            </div>
          )}

          {/* Aprovação (status é uma coluna direta da OAS: status_aprovacao) */}
          {oas.status_aprovacao && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text">Aprovação</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <AprovBadge status={oas.status_aprovacao} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Editar OAS ───────────────────────────────────────────────────────────────
function normalizeCotistaPercentuais(rows: any[]): number[] {
  const pesos = rows.map((row) => Math.max(0, Number(row?.percentual_sociedade) || 0));
  const total = pesos.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];

  const exatos = pesos.map((peso) => (peso / total) * 100);
  const arredondados = exatos.map((value) => Math.floor((value + Number.EPSILON) * 100) / 100);
  let restante = Math.round((100 - arredondados.reduce((sum, value) => sum + value, 0)) * 100) / 100;
  const maiorIndice = exatos.reduce((best, value, index) => value > exatos[best] ? index : best, 0);
  arredondados[maiorIndice] = Math.round((arredondados[maiorIndice] + restante) * 100) / 100;
  return arredondados;
}

function parsePercentualRateio(value: string): number[] {
  return value.split(/[\\/;,]+/).map((part) => Number.parseFloat(part.replace(',', '.'))).filter((number) => Number.isFinite(number));
}

function OASField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

function EditarOASForm({ oas, aircraftId, onClose, onSaved }: { oas: any; aircraftId: string; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [cotistas, setCotistas] = useState<any[]>([]);
  const [form, setForm] = useState({
    numero: oas.numero ?? '',
    os_oficina: oas.os_oficina ?? '',
    horas_celula: oas.horas_celula ?? '',
    tipo_manutencao: oas.tipo_manutencao ?? 'CORRETIVA',
    periodo: oas.periodo ?? '',
    periodo_inicio: oas.periodo_inicio ?? '',
    periodo_fim: oas.periodo_fim ?? '',
    objetivo: oas.objetivo ?? '',
    dias_previstos: oas.dias_previstos ?? '',
    dias_efetivos: oas.dias_efetivos ?? '',
    data_entrada: oas.data_entrada ?? '',
    data_saida: oas.data_saida ?? '',
    relatorio_voo_de: oas.relatorio_voo_de ?? '',
    relatorio_voo_ate: oas.relatorio_voo_ate ?? '',
    oficina_nome: oas.oficina_nome ?? '',
    mecanico_responsavel: oas.mecanico_responsavel ?? '',
    tipo_rateio: oas.tipo_rateio ?? 'horas',
    status: oas.status ?? 'aberto',
    total_mao_obra: oas.total_mao_obra ?? '',
    total_pecas: oas.total_pecas ?? '',
    total_voado_porcentagem: oas.total_voado_porcentagem ?? '',
    porcentagem_rateio: oas.porcentagem_rateio ?? '',
    observacoes: oas.observacoes ?? '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any)
        .from('cotistas_aeronave')
        .select('id_clientes, socios_id, percentual_sociedade, clientes:clientes(razao_social, proprietario), socios:socios(nome)')
        .eq('id_aeronave', aircraftId);
      if (!cancelled && !error) setCotistas(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [aircraftId]);

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));
  const nomeCotista = (cotista: any) => cotista?.socios?.nome || cotista?.clientes?.razao_social || cotista?.clientes?.proprietario || 'Cotista';
  const percentualCotista = (cotista: any) => Number(cotista?.percentual_sociedade) || 0;
  const aplicarRateioPercentual = (rows = cotistas) => {
    const percentuais = normalizeCotistaPercentuais(rows);
    if (percentuais.length === 0) return false;
    const linhas = rows.map((cotista, index) => `${nomeCotista(cotista)} ${percentuais[index].toFixed(2)}`).join(' / ');
    const valores = percentuais.map((percentual) => percentual.toFixed(2)).join(' / ');
    setForm((current) => ({ ...current, tipo_rateio: 'percentual', total_voado_porcentagem: linhas, porcentagem_rateio: valores }));
    return true;
  };
  const percentualRateioTotal = parsePercentualRateio(String(form.porcentagem_rateio || '')).reduce((sum, value) => sum + value, 0);
  const percentualRateioValido = Math.abs(percentualRateioTotal - 100) < 0.005;
  useEffect(() => {
    if (form.tipo_rateio === 'percentual' && cotistas.length > 0 && !String(form.porcentagem_rateio || '').trim()) {
      aplicarRateioPercentual(cotistas);
    }
  }, [cotistas, form.tipo_rateio]);
  const selecionarTipoRateio = (tipo: string) => {
    if (tipo === 'percentual') {
      setForm((current) => ({ ...current, tipo_rateio: tipo }));
      aplicarRateioPercentual(cotistas);
    } else {
      setForm((current) => ({ ...current, tipo_rateio: tipo }));
    }
  };
  const num = (v: any) => (v === '' || v === null || v === undefined ? null : Number(v));

  async function save() {
    if (form.tipo_rateio === 'percentual' && !percentualRateioValido) {
      toast.error(`O rateio percentual precisa totalizar 100,00%. Total atual: ${percentualRateioTotal.toFixed(2)}%.`);
      return;
    }
    setSaving(true);
    const mo = num(form.total_mao_obra) ?? 0;
    const pc = num(form.total_pecas) ?? 0;
    const { error } = await supabase
      .from('ctm_ordem_acompanhamento_servico')
      .update({
        numero: form.numero || null,
        os_oficina: form.os_oficina || null,
        horas_celula: num(form.horas_celula),
        tipo_manutencao: form.tipo_manutencao || null,
        periodo: form.periodo || null,
        periodo_inicio: form.periodo_inicio || null,
        periodo_fim: form.periodo_fim || null,
        objetivo: form.objetivo || null,
        dias_previstos: num(form.dias_previstos),
        dias_efetivos: num(form.dias_efetivos),
        data_entrada: form.data_entrada || null,
        data_saida: form.data_saida || null,
        relatorio_voo_de: form.relatorio_voo_de || null,
        relatorio_voo_ate: form.relatorio_voo_ate || null,
        oficina_nome: form.oficina_nome || null,
        mecanico_responsavel: form.mecanico_responsavel || null,
        tipo_rateio: form.tipo_rateio || null,
        status: form.status || null,
        total_mao_obra: num(form.total_mao_obra),
        total_pecas: num(form.total_pecas),
        total_geral: mo + pc,
        total_voado_porcentagem: form.total_voado_porcentagem || null,
        porcentagem_rateio: form.porcentagem_rateio || null,
        observacoes: form.observacoes || null,
      } as any)
      .eq('id', oas.id);

    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      setSaving(false);
      return;
    }

    if (String(form.status).toLowerCase().includes('conclu') && oas.programa_manutencao_id) {
      await sincronizarProgramaComOAS({
        aircraftId,
        programaId: oas.programa_manutencao_id,
        oasId: oas.id,
        dataExecucao: form.data_saida || new Date().toISOString().slice(0, 10),
        horasCelula: num(form.horas_celula),
        pousos: null,
        oficina: form.oficina_nome || null,
        observacoes: `Execução concluída na OAS #${form.numero || oas.numero}${form.objetivo ? ` — ${form.objetivo}` : ''}`,
      });
    }

    toast.success('OAS atualizada!');
    onSaved();
    setSaving(false);
  }

  return (
    <div className="ctm-card p-5 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Editar OAS #{oas.numero}</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <OASField label="Nº OAS">
          <input className="ctm-input w-full" value={form.numero} onChange={e => f('numero', e.target.value)} />
        </OASField>
        <OASField label="O.S Oficina">
          <input className="ctm-input w-full" placeholder="008-2025" value={form.os_oficina} onChange={e => f('os_oficina', e.target.value)} />
        </OASField>
        <OASField label="Horas de célula">
          <input type="number" step="0.1" className="ctm-input w-full" value={form.horas_celula} onChange={e => f('horas_celula', e.target.value)} />
        </OASField>
        <OASField label="Tipo de manutenção">
          <select className="ctm-input w-full" value={form.tipo_manutencao} onChange={e => f('tipo_manutencao', e.target.value)}>
            <option value="CORRETIVA">Corretiva</option>
            <option value="PREVENTIVA">Preventiva</option>
            <option value="PROGRAMADA">Programada</option>
            <option value="C.V.A">C.V.A</option>
          </select>
        </OASField>
        <OASField label="Período">
          <input className="ctm-input w-full" placeholder="50 HORAS" value={form.periodo} onChange={e => f('periodo', e.target.value)} />
        </OASField>
        <OASField label="Objetivo da manutenção">
          <input className="ctm-input w-full" placeholder="SUBS. FARÓIS" value={form.objetivo} onChange={e => f('objetivo', e.target.value)} />
        </OASField>
        <OASField label="Dias previstos MNT">
          <input type="number" className="ctm-input w-full" value={form.dias_previstos} onChange={e => f('dias_previstos', e.target.value)} />
        </OASField>
        <OASField label="Dias efetivos MNT">
          <input type="number" className="ctm-input w-full" value={form.dias_efetivos} onChange={e => f('dias_efetivos', e.target.value)} />
        </OASField>
        <OASField label="Status">
          <select className="ctm-input w-full" value={form.status} onChange={e => f('status', e.target.value)}>
            <option value="aberto">Aberto</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluido">Concluída</option>
            <option value="cancelado">Cancelada</option>
          </select>
        </OASField>
        <OASField label="Data de entrada">
          <input type="date" className="ctm-input w-full" value={form.data_entrada} onChange={e => f('data_entrada', e.target.value)} />
        </OASField>
        <OASField label="Data de saída">
          <input type="date" className="ctm-input w-full" value={form.data_saida} onChange={e => f('data_saida', e.target.value)} />
        </OASField>
        <OASField label="Início do período">
          <input type="date" className="ctm-input w-full" value={form.periodo_inicio} onChange={e => f('periodo_inicio', e.target.value)} />
        </OASField>
        <OASField label="Fim do período">
          <input type="date" className="ctm-input w-full" value={form.periodo_fim} onChange={e => f('periodo_fim', e.target.value)} />
        </OASField>
        <OASField label="Relatório de voo de">
          <input className="ctm-input w-full" value={form.relatorio_voo_de} onChange={e => f('relatorio_voo_de', e.target.value)} />
        </OASField>
        <OASField label="Relatório de voo até">
          <input className="ctm-input w-full" value={form.relatorio_voo_ate} onChange={e => f('relatorio_voo_ate', e.target.value)} />
        </OASField>
        <OASField label="Oficina">
          <input className="ctm-input w-full" value={form.oficina_nome} onChange={e => f('oficina_nome', e.target.value)} />
        </OASField>
        <OASField label="Mecânico responsável">
          <input className="ctm-input w-full" value={form.mecanico_responsavel} onChange={e => f('mecanico_responsavel', e.target.value)} />
        </OASField>
        <OASField label="Tipo de rateio">
          <select className="ctm-input w-full" value={form.tipo_rateio} onChange={e => selecionarTipoRateio(e.target.value)}>
            <option value="horas">Horas</option>
            <option value="percentual">Percentual — cotistas da aeronave</option>
          </select>
          {form.tipo_rateio === 'percentual' && <p className={`mt-1 text-[11px] ${percentualRateioValido ? 'text-emerald-300' : 'text-amber-300'}`}>Total calculado: <strong>{percentualRateioTotal.toFixed(2)}%</strong>. {percentualRateioValido ? 'Rateio preenchido automaticamente e válido.' : 'Ajuste os valores para totalizar exatamente 100,00% antes de salvar.'}</p>}
        </OASField>
        <OASField label="Total mão de obra (R$)">
          <input type="number" step="0.01" className="ctm-input w-full" value={form.total_mao_obra} onChange={e => f('total_mao_obra', e.target.value)} />
        </OASField>
        <OASField label="Total peças (R$)">
          <input type="number" step="0.01" className="ctm-input w-full" value={form.total_pecas} onChange={e => f('total_pecas', e.target.value)} />
        </OASField>
        <OASField label="Total da OS (R$)">
          <input className="ctm-input w-full opacity-70" readOnly value={((num(form.total_mao_obra) ?? 0) + (num(form.total_pecas) ?? 0)).toFixed(2)} />
        </OASField>
        <OASField label="Total voado em % (por cotista)">
          <input className="ctm-input w-full" placeholder="CARVALIMA 50 / WATT 50" value={form.total_voado_porcentagem} onChange={e => f('total_voado_porcentagem', e.target.value)} />
        </OASField>
        <OASField label="Para rateio (%)">
          <input className="ctm-input w-full" placeholder="50.00 / 50.00" value={form.porcentagem_rateio} onChange={e => f('porcentagem_rateio', e.target.value)} />
        </OASField>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Observações</label>
          <textarea className="ctm-input w-full h-20 resize-none" value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </button>
      </div>
    </div>
  );
}

function getOASYear(oas: any) {
  const raw = oas?.data_entrada || oas?.created_at;
  return raw ? String(raw).slice(0, 4) : 'Sem data';
}

function groupedByYearFromList(rows: any[]) {
  return rows.reduce<Record<string, any[]>>((groups, oas) => {
    const year = getOASYear(oas);
    (groups[year] ||= []).push(oas);
    return groups;
  }, {});
}

function mapProgramaTipo(categoria?: string) {
  if (categoria === 'PREVENTIVA_PROGRAMADA') return 'PROGRAMADA';
  if (categoria === 'REGULATORIO_ANAC' || categoria === 'EMERGENCIA') return 'PREVENTIVA';
  return 'CORRETIVA';
}

async function sincronizarProgramaComOAS({
  aircraftId, programaId, oasId, dataExecucao, horasCelula, pousos, oficina, observacoes,
}: {
  aircraftId: string; programaId: string; oasId: string; dataExecucao: string;
  horasCelula: number | null; pousos: number | null; oficina: string | null; observacoes: string;
}) {
  const { data: programa, error: programaError } = await supabase
    .from('ctm_programa_manutencao').select('id, item').eq('id', programaId).eq('aeronave_id', aircraftId).maybeSingle();
  if (programaError || !programa) {
    toast.warning('OAS concluída, mas o item do Programa de Manutenção não foi encontrado para sincronização.');
    return;
  }

  const baseline: Record<string, any> = { ultima_execucao_data: dataExecucao, status: 'ativo' };
  if (horasCelula !== null && Number.isFinite(horasCelula)) baseline.ultima_execucao_horas = horasCelula;
  if (pousos !== null && Number.isFinite(pousos)) baseline.ultima_execucao_pousos = pousos;
  const { error: updateError } = await (supabase.from('ctm_programa_manutencao') as any).update(baseline).eq('id', programaId);
  if (updateError) {
    toast.warning('OAS concluída, mas o Programa de Manutenção não pôde ser atualizado.');
    return;
  }

  let { data: itemAeronave } = await supabase.from('ctm_itens_aeronave').select('id').eq('aeronave_id', aircraftId).eq('nome_item_override', programa.item).limit(1);
  let itemAeronaveId = itemAeronave?.[0]?.id;
  if (!itemAeronaveId) {
    const { data: created } = await supabase.from('ctm_itens_aeronave').insert({ aeronave_id: aircraftId, modelo_item_id: null, nome_item_override: programa.item, ativo: true }).select('id');
    itemAeronaveId = created?.[0]?.id;
  }

  if (itemAeronaveId) {
    const { data: existingExecution } = await supabase.from('ctm_execucoes').select('id').eq('ordem_servico', oasId).limit(1);
    if (!existingExecution?.length) {
      await supabase.from('ctm_execucoes').insert({
        item_aeronave_id: itemAeronaveId,
        data_execucao: dataExecucao,
        horas_aeronave_na_execucao: horasCelula,
        pousos_aeronave_na_execucao: pousos,
        oficina,
        ordem_servico: oasId,
        observacoes,
      });
    }
  }
  toast.success(`Programa atualizado: ${programa.item}`);
}

function MetricCard({ icon: Icon, label, value, tone = 'teal' }: { icon: any; label: string; value: string; tone?: 'teal' | 'emerald' | 'blue' }) {
  const colors = { teal: 'text-ctm-teal bg-ctm-teal/10', emerald: 'text-emerald-300 bg-emerald-500/10', blue: 'text-blue-300 bg-blue-500/10' };
  return <div className="rounded-2xl border border-white/10 bg-slate-900/45 p-4 shadow-lg"><div className="flex items-center gap-3"><div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colors[tone])}><Icon className="h-5 w-5" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div></div></div>;
}

function OASListCard({ oas, onClick }: { oas: any; onClick: () => void }) {
  const totalServicos = Number(oas.total_mao_obra ?? 0);
  const totalPecas = Number(oas.total_pecas ?? 0);
  const total = Number(oas.total_geral ?? totalServicos + totalPecas);
  return <button type="button" onClick={onClick} className="ctm-card-hover group flex w-full items-center gap-4 p-4 text-left md:p-5">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10"><span className="text-sm font-bold text-blue-200">#{oas.numero || '—'}</span></div>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{oas.tipo_manutencao || 'Manutenção'}</p>{oas.periodo && <span className="badge-teal">{oas.periodo}</span>}<OASStatusBadge status={oas.status} aprovStatus={oas.status_aprovacao} /></div><div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{oas.data_entrada && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(oas.data_entrada)}</span>}{oas.data_saida && <span>→ {formatDate(oas.data_saida)}</span>}{oas.oficina_nome && <span>{oas.oficina_nome}</span>}{oas.programa_manutencao_id && <span className="text-blue-300">Programa vinculado</span>}</div></div>
    <div className="hidden text-right sm:block"><p className="font-bold">{total > 0 ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</p>{total > 0 && <p className="text-xs text-muted-foreground">MO {totalServicos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}</div><ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-ctm-teal" />
  </button>;
}

function AprovBadge({ status, small }: { status?: string; small?: boolean }) {
  const s = (status || '').toLowerCase();
  const cls = small ? 'text-[10px] px-1.5 py-0.5' : '';
  if (s.includes('aprovado') || s === 'approved') return <span className={cn('badge-ok', cls)}>Aprovado</span>;
  if (s.includes('rejeit') || s === 'rejected') return <span className={cn('badge-expired', cls)}>Rejeitado</span>;
  if (s.includes('pendent') || s === 'pendente') return <span className={cn('badge-pending', cls)}>Pendente</span>;
  return <span className={cn('badge-pending', cls)}>{status || 'Pendente'}</span>;
}

function OASStatusBadge({ status, aprovStatus }: { status?: string; aprovStatus?: string }) {
  const s = (aprovStatus || status || '').toLowerCase();
  if (s.includes('aprovado') || s === 'approved') return <span className="badge-ok">Aprovado</span>;
  if (s.includes('rejeit') || s === 'rejected') return <span className="badge-expired">Rejeitado</span>;
  if (s.includes('conclu')) return <span className="badge-ok">Concluída</span>;
  if (s.includes('andament') || s.includes('progress')) return <span className="badge-teal">Em Andamento</span>;
  return <span className="badge-pending">{status || 'Pendente'}</span>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function formatDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
}

function EmptySection({ icon: Icon, text }: { icon: typeof FileText; text: string }) {
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
