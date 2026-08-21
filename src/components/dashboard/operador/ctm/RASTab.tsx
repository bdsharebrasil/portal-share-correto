import { useEffect, useState, useRef } from 'react';
import { BookOpen, Image, Plus, Upload, ChevronRight, X, Loader2, Save, Clock, RefreshCw, FileDown, Pencil } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { gerarRelatorioRAS } from './rasRelatorio';

interface RASTabProps { aircraftId: string; }

export function RASTab({ aircraftId }: RASTabProps) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [aeronave, setAeronave] = useState<{ matricula?: string | null; modelo?: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('aeronave')
        .select('matricula, modelo')
        .eq('id', aircraftId)
        .maybeSingle();
      if (data) setAeronave(data as any);
    })();
  }, [aircraftId]);

  async function loadRAS() {
    const { data, error } = await supabase
      .from('ctm_ras')
      .select(`*, ctm_ras_itens(*), ctm_ras_fotos(*)`)
      .eq('aeronave_id', aircraftId)
      .order('criado_em', { ascending: false });
    console.log('RAS ctm:', data, error);
    if (data) setList(data);
    setLoading(false);
  }

  useEffect(() => { loadRAS(); }, [aircraftId]);

  if (loading) return <LoadingSpinner />;
  if (selected) return (
    <RASDetail
      ras={selected}
      aeronave={aeronave}
      onBack={() => setSelected(null)}
      onRefresh={async () => {
        // Re-busca o RAS selecionado atualizado
        const { data } = await supabase
          .from('ctm_ras')
          .select(`*, ctm_ras_itens(*), ctm_ras_fotos(*)`)
          .eq('id', selected.id)
          .single();
        if (data) setSelected(data);
        loadRAS();
      }}
    />
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold">Relatório de Acompanhamento de Serviço (RAS)</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-cyan-400/35 bg-transparent px-4 py-1.5 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/10"
        >
          <Plus className="h-4 w-4" /> Novo RAS
        </button>
      </div>

      {showForm && (
        <NovoRASForm
          aircraftId={aircraftId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadRAS(); }}
        />
      )}

      {list.length === 0 && !showForm ? (
        <EmptySection icon={BookOpen} text="Nenhum RAS registrado" />
      ) : (
        <div className="space-y-3">
          {list.map(ras => {
            const servicos = (ras.ctm_ras_itens || []).filter((i: any) => i.item_tipo === 'trabalho' || i.item_tipo === 'service');
            const pecas = (ras.ctm_ras_itens || []).filter((i: any) => i.item_tipo === 'peca' || i.item_tipo === 'part');
            const fotos = ras.ctm_ras_fotos || [];
            return (
              <div key={ras.id} onClick={() => setSelected(ras)} className="ctm-card-hover p-5 group">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--ctm-teal)/0.1)] border border-[hsl(var(--ctm-teal)/0.2)] shrink-0">
                    <BookOpen className="h-5 w-5 teal-text" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">RAS #{ras.numero}</p>
                      <span className={ras.tipo_manutencao?.toLowerCase().includes('correti') ? 'badge-urgent' : 'badge-teal'}>
                        {ras.tipo_manutencao || 'Manutenção'}
                      </span>
                      <RASStatusBadge status={ras.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>Entrada: {formatDate(ras.data_entrada)}</span>
                      {ras.data_saida && <span>Saída: {formatDate(ras.data_saida)}</span>}
                      {ras.horas_celula_entrada && (
                        <span className="flex items-center gap-1 teal-text font-medium">
                          <Clock className="h-3 w-3" /> {ras.horas_celula_entrada}h célula
                        </span>
                      )}
                      <span>{servicos.length} serviços · {pecas.length} peças</span>
                      {fotos.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Image className="h-3 w-3" /> {fotos.length} fotos
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-ctm-teal transition-colors shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Novo RAS Form ────────────────────────────────────────────────────────────
function NovoRASForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [loadingHoras, setLoadingHoras] = useState(true);
  const [ultimoVoo, setUltimoVoo] = useState<{ celula: number | null; data: string | null; trecho: string | null } | null>(null);
  const [form, setForm] = useState({
    numero: '',
    tipo_manutencao: 'corretiva',
    data_entrada: '',
    data_saida: '',
    objetivo: '',
    descricao: '',
    oas_numero: '',
    horas_celula_entrada: '',
    horas_celula_saida: '',
    oficina_nome: '',
    mecanico_responsavel: '',
  });
  const [servicos, setServicos] = useState([{ descricao: '', fornecedor: '', periodo: '', motivo: '' }]);
  const [pecas, setPecas] = useState([{ descricao: '', fornecedor: '', periodo: '', motivo: '', quantidade: 1, numero_fatura: '', numero_peca: '', numero_serie: '' }]);
  const [novasFotos, setNovasFotos] = useState<{ file: File; preview: string; legenda: string }[]>([]);
  const novoFileRef = useRef<HTMLInputElement>(null);

  // Busca automática das horas de célula no diário de bordo
  useEffect(() => {
    async function fetchHorasCelula() {
      setLoadingHoras(true);

      // Estratégia 1: último lançamento com celula preenchida e > 0
      const { data: lastFlight } = await supabase
        .from('lancamentos_diario_bordo')
        .select('celula, celula_tvoo, data_registro, aerodromo_partida, aerodromo_chegada, trecho, criado_em')
        .eq('aeronave_id', aircraftId)
        .not('celula', 'is', null)
        .gt('celula', 0)
        .order('data_registro', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('Horas célula - último lançamento:', lastFlight);

      if (lastFlight && Number(lastFlight.celula) > 0) {
        const horas = Number(lastFlight.celula);
        const trecho = lastFlight.trecho ||
          `${lastFlight.aerodromo_partida || ''}→${lastFlight.aerodromo_chegada || ''}`;
        setUltimoVoo({ celula: horas, data: lastFlight.data_registro, trecho });
        setForm(f => ({ ...f, horas_celula_entrada: String(horas) }));
        setLoadingHoras(false);
        return;
      }

      // Estratégia 2: diário mensal (celula_atual_ttotal ou horimetro_final)
      const { data: diarioMes } = await supabase
        .from('diario_mes')
        .select('celula_atual_ttotal, celula_atual_tvoo, horimetro_final, horimetro_ativo, ano, mes')
        .eq('aeronave_id', aircraftId)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('Horas célula - diário mês:', diarioMes);

      if (diarioMes) {
        const horas = Number(
          diarioMes.celula_atual_ttotal ||
          diarioMes.horimetro_final ||
          diarioMes.horimetro_ativo ||
          diarioMes.celula_atual_tvoo ||
          0
        );
        if (horas > 0) {
          const mesStr = `${diarioMes.ano}-${String(diarioMes.mes).padStart(2, '0')}-01`;
          const mesLabel = `Fim de ${new Date(mesStr + 'T12:00:00').toLocaleString('pt-BR', { month: 'long' })}/${diarioMes.ano}`;
          setUltimoVoo({ celula: horas, data: mesStr, trecho: mesLabel });
          setForm(f => ({ ...f, horas_celula_entrada: String(horas) }));
          setLoadingHoras(false);
          return;
        }
      }

      // Estratégia 3: último lançamento (celula_tvoo como fallback mesmo que seja 0)
      const { data: anyFlight } = await supabase
        .from('lancamentos_diario_bordo')
        .select('celula, celula_tvoo, data_registro, aerodromo_partida, aerodromo_chegada, trecho, criado_em')
        .eq('aeronave_id', aircraftId)
        .order('data_registro', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log('Horas célula - fallback:', anyFlight);

      if (anyFlight) {
        const horas = Number(anyFlight.celula || anyFlight.celula_tvoo || 0);
        const trecho = anyFlight.trecho ||
          `${anyFlight.aerodromo_partida || ''}→${anyFlight.aerodromo_chegada || ''}`;
        setUltimoVoo({ celula: horas > 0 ? horas : null, data: anyFlight.data_registro, trecho });
        if (horas > 0) setForm(f => ({ ...f, horas_celula_entrada: String(horas) }));
      }

      setLoadingHoras(false);
    }
    fetchHorasCelula();
  }, [aircraftId]);

  function atualizarHorasDoUltimoVoo() {
    if (ultimoVoo?.celula !== null && ultimoVoo?.celula !== undefined && ultimoVoo.celula > 0) {
      setForm(f => ({ ...f, horas_celula_entrada: String(ultimoVoo.celula) }));
      toast.success(`Horas de célula preenchidas: ${ultimoVoo.celula}h`);
    } else {
      toast.error('Nenhum valor de célula encontrado no diário de bordo');
    }
  }

  function addFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setNovasFotos(prev => [...prev, ...files.map(file => ({ file, preview: URL.createObjectURL(file), legenda: '' }))]);
    if (novoFileRef.current) novoFileRef.current.value = '';
  }

  async function save() {
    if (!form.numero || !form.data_entrada) { toast.error('Número e data de entrada são obrigatórios'); return; }
    setSaving(true);

    const { data: rasData, error } = await supabase
      .from('ctm_ras')
      .insert({
        aeronave_id: aircraftId,
        numero: form.numero,
        oas_numero: form.oas_numero || null,
        tipo_manutencao: form.tipo_manutencao,
        objetivo: form.objetivo || null,
        data_entrada: form.data_entrada,
        data_saida: form.data_saida || null,
        descricao: form.descricao || null,
        horas_celula_entrada: form.horas_celula_entrada ? Number(form.horas_celula_entrada) : null,
        horas_celula_saida: form.horas_celula_saida ? Number(form.horas_celula_saida) : null,
        status: 'em_andamento',
      })
      .select()
      .single();

    if (error || !rasData) { toast.error('Erro ao criar RAS: ' + error?.message); setSaving(false); return; }

    const validServicos = servicos.filter(s => s.descricao.trim());
    const validPecas = pecas.filter(p => p.descricao.trim());

    const allItems = [
      ...validServicos.map(s => ({
        ras_id: rasData.id,
        item_tipo: 'trabalho',
        descricao: s.descricao,
        fornecedor: s.fornecedor || null,
        periodo: s.periodo || null,
        motivo: s.motivo || null,
      })),
      ...validPecas.map(p => ({
        ras_id: rasData.id,
        item_tipo: 'peca',
        descricao: p.descricao,
        fornecedor: p.fornecedor || null,
        periodo: p.periodo || null,
        motivo: p.motivo || null,
        quantidade: Number(p.quantidade) || 1,
        numero_fatura: p.numero_fatura || null,
        numero_peca: p.numero_peca || null,
        numero_serie: p.numero_serie || null,
      })),
    ];
    if (allItems.length > 0) {
      await (supabase as any).from('ctm_ras_itens').insert(allItems);
    }

    for (const foto of novasFotos) {
      const ext = foto.file.name.split('.').pop();
      const path = `ras/${rasData.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('ras-photos').upload(path, foto.file, { upsert: true });
      if (upErr) { toast.error('Erro no upload da foto: ' + upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from('ras-photos').getPublicUrl(path);
      await supabase.from('ctm_ras_fotos').insert({ ras_id: rasData.id, url_foto: publicUrl, legenda: foto.legenda || null });
    }

    toast.success('RAS criado com sucesso!');
    onSaved();
  }

  return (
    <div className="ctm-card mb-6 border-[hsl(var(--ctm-teal)/0.3)] p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
        <h3 className="font-semibold teal-text">Novo RAS</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Linha 1 */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Número RAS *</label>
          <input className="ctm-input w-full" placeholder="Ex: 71" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">N° O.S Oficina</label>
          <input className="ctm-input w-full" placeholder="Ex: OS 008-2025" value={form.oas_numero} onChange={e => setForm(f => ({ ...f, oas_numero: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipo de Manutenção</label>
          <select className="ctm-input w-full" value={form.tipo_manutencao} onChange={e => setForm(f => ({ ...f, tipo_manutencao: e.target.value }))}>
            <option value="corretiva">Corretiva</option>
            <option value="preventiva">Preventiva</option>
            <option value="programada">Programada</option>
            <option value="revisao_geral">Revisão Geral</option>
            <option value="inspecao_50h">Inspeção 50h</option>
            <option value="inspecao_100h">Inspeção 100h</option>
            <option value="inspecao_anual">Inspeção Anual</option>
          </select>
        </div>

        {/* Linha 2 */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data Entrada *</label>
          <input type="date" className="ctm-input w-full" value={form.data_entrada} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data Saída</label>
          <input type="date" className="ctm-input w-full" value={form.data_saida} onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Período</label>
          <input className="ctm-input w-full" placeholder="Ex: 50h / Anual / 2025" value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} />
        </div>

        {/* Linha 3 — Horas de Célula com busca automática */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
            Horas Célula (Entrada)
            {loadingHoras && <Loader2 className="h-3 w-3 animate-spin text-ctm-teal" />}
          </label>
          <div className="flex gap-1.5">
            <input
              type="number"
              step="0.1"
              className="ctm-input flex-1"
              placeholder="Ex: 3231.5"
              value={form.horas_celula_entrada}
              onChange={e => setForm(f => ({ ...f, horas_celula_entrada: e.target.value }))}
            />
            <button
              onClick={atualizarHorasDoUltimoVoo}
              title="Buscar horas do último voo no diário"
              className="px-2 rounded-lg border border-[hsl(var(--ctm-teal)/0.3)] text-ctm-teal hover:bg-[hsl(var(--ctm-teal)/0.1)] transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          {/* Referência do último voo */}
          {ultimoVoo && (
            <p className="text-xs mt-1 text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-ctm-teal shrink-0" />
              Último voo: {formatDate(ultimoVoo.data)}
              {ultimoVoo.trecho && ultimoVoo.trecho !== '→' && ` · ${ultimoVoo.trecho}`}
              {ultimoVoo.celula !== null && (
                <span className="teal-text font-semibold ml-1">{ultimoVoo.celula}h</span>
              )}
            </p>
          )}
          {!loadingHoras && !ultimoVoo && (
            <p className="text-xs mt-1 text-orange-400">Nenhum voo registrado no diário</p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Horas Célula (Saída)</label>
          <input
            type="number"
            step="0.1"
            className="ctm-input w-full"
            placeholder="Preencher ao concluir"
            value={form.horas_celula_saida}
            onChange={e => setForm(f => ({ ...f, horas_celula_saida: e.target.value }))}
          />
        </div>

        {/* Linha 4 — Oficina */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Oficina</label>
          <input className="ctm-input w-full" placeholder="Nome da oficina" value={form.oficina_nome} onChange={e => setForm(f => ({ ...f, oficina_nome: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Mecânico Responsável</label>
          <input className="ctm-input w-full" placeholder="Nome do mecânico" value={form.mecanico_responsavel} onChange={e => setForm(f => ({ ...f, mecanico_responsavel: e.target.value }))} />
        </div>

        {/* Linha 5 — Descrição */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Descrição / Objetivo das Inspeções Realizadas</label>
          <textarea
            className="ctm-input h-28 w-full resize-y"
            placeholder="Descreva os serviços realizados, discrepâncias encontradas, etc."
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          />
        </div>
      </div>

      {/* Serviços */}
      <RASItemsList
        title="Serviços Executados"
        items={servicos}
        tipo="trabalho"
        onAdd={() => setServicos(prev => [...prev, { descricao: '', fornecedor: '', periodo: '', motivo: '' }])}
        onUpdate={(idx, field, val) => setServicos(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it)))}
        onRemove={idx => setServicos(prev => prev.filter((_, i) => i !== idx))}
      />

      {/* Peças */}
      <RASItemsList
        title="Peças Trocadas"
        items={pecas}
        tipo="peca"
        onAdd={() => setPecas(prev => [...prev, { descricao: '', fornecedor: '', periodo: '', motivo: '', quantidade: 1, numero_fatura: '', numero_peca: '', numero_serie: '' }])}
        onUpdate={(idx, field, val) => setPecas(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it)))}
        onRemove={idx => setPecas(prev => prev.filter((_, i) => i !== idx))}
      />

      {/* Fotos */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fotos do Relatório</label>
          <button onClick={() => novoFileRef.current?.click()} className="flex items-center gap-1 text-xs teal-text hover:underline">
            <Upload className="h-3 w-3" /> Adicionar fotos
          </button>
          <input ref={novoFileRef} type="file" accept="image/*" multiple className="hidden" onChange={addFotos} />
        </div>
        {novasFotos.length === 0 ? (
          <button
            onClick={() => novoFileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-secondary/30 py-8 text-muted-foreground hover:border-[hsl(var(--ctm-teal)/0.5)]"
          >
            <Image className="h-6 w-6 opacity-60" />
            <span className="text-xs">Anexe fotos das peças trocadas / serviços executados</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {novasFotos.map((foto, idx) => (
              <div key={idx} className="relative rounded-xl border border-border/60 bg-secondary/40 p-2">
                <button
                  onClick={() => setNovasFotos(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute right-3 top-3 rounded-md bg-card/80 p-1 text-red-400 hover:text-red-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <img src={foto.preview} alt={foto.legenda || `Foto ${idx + 1}`} className="h-28 w-full rounded-lg object-cover" />
                <input
                  className="ctm-input mt-2 w-full text-xs"
                  placeholder="Legenda / descrição"
                  value={foto.legenda}
                  onChange={e => setNovasFotos(prev => prev.map((f, i) => (i === idx ? { ...f, legenda: e.target.value } : f)))}
                />
              </div>
            ))}
          </div>
        )}
      </div>


      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar RAS
        </button>
      </div>
    </div>
  );
}

// ── Lista de Itens do RAS ────────────────────────────────────────────────────
function RASItemsList({ title, items, tipo, onAdd, onUpdate, onRemove }: any) {
  const isPeca = tipo === 'peca';
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</label>
        <button onClick={onAdd} className="text-xs teal-text hover:underline flex items-center gap-1">
          <Plus className="h-3 w-3" /> Adicionar
        </button>
      </div>
      <div className="space-y-3">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="relative rounded-xl border border-border/60 bg-secondary/40 p-4">
            {items.length > 1 && (
              <button
                onClick={() => onRemove(idx)}
                className="absolute right-2 top-2 rounded-md p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="grid grid-cols-2 gap-3 pr-8 sm:grid-cols-3 lg:grid-cols-4">
              <div className="col-span-2 sm:col-span-3 lg:col-span-2">
                <label className="text-xs text-muted-foreground">Descrição *</label>
                <input className="ctm-input w-full mt-0.5 text-sm" placeholder="Descrição do item" value={item.descricao} onChange={e => onUpdate(idx, 'descricao', e.target.value)} />
              </div>
              {isPeca && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">P/N</label>
                    <input className="ctm-input w-full mt-0.5 text-sm" placeholder="Part Number" value={item.numero_peca || ''} onChange={e => onUpdate(idx, 'numero_peca', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">S/N</label>
                    <input className="ctm-input w-full mt-0.5 text-sm" placeholder="Serial Number" value={item.numero_serie || ''} onChange={e => onUpdate(idx, 'numero_serie', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Qtd</label>
                    <input type="number" min="1" step="0.01" className="ctm-input w-full mt-0.5 text-sm text-center" value={item.quantidade} onChange={e => onUpdate(idx, 'quantidade', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">NF/Fatura</label>
                    <input className="ctm-input w-full mt-0.5 text-sm" placeholder="Nº fatura" value={item.numero_fatura || ''} onChange={e => onUpdate(idx, 'numero_fatura', e.target.value)} />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Fornecedor / Oficina</label>
                <input className="ctm-input w-full mt-0.5 text-sm" placeholder="Fornecedor" value={item.fornecedor} onChange={e => onUpdate(idx, 'fornecedor', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Período</label>
                <input className="ctm-input w-full mt-0.5 text-sm" placeholder="Ex: 50h" value={item.periodo} onChange={e => onUpdate(idx, 'periodo', e.target.value)} />
              </div>
              <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                <label className="text-xs text-muted-foreground">{isPeca ? 'Motivo da troca' : 'Motivo / o que aconteceu'}</label>
                <textarea
                  rows={2}
                  className="ctm-input w-full mt-0.5 text-sm"
                  placeholder={isPeca ? 'Ex: peça apresentava desgaste excessivo detectado na inspeção...' : 'Descreva o que motivou o serviço'}
                  value={item.motivo || ''}
                  onChange={e => onUpdate(idx, 'motivo', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RAS Detail ───────────────────────────────────────────────────────────────
function RASDetail({ ras, aeronave, onBack, onRefresh }: {
  ras: any;
  aeronave?: { matricula?: string | null; modelo?: string | null } | null;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [fotos, setFotos] = useState<any[]>(ras.ctm_ras_fotos || []);
  const [editandoLegenda, setEditandoLegenda] = useState<string | null>(null);
  const [legendaDraft, setLegendaDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const items = ras.ctm_ras_itens || [];
  const servicos = items.filter((i: any) => i.item_tipo === 'trabalho' || i.item_tipo === 'service');
  const pecas = items.filter((i: any) => i.item_tipo === 'peca' || i.item_tipo === 'part');

  async function uploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);

    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `ras/${ras.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

      const { error: upErr } = await supabase.storage.from('ras-photos').upload(path, file, { upsert: true });
      if (upErr) { toast.error('Erro ao fazer upload: ' + upErr.message); continue; }

      const { data: { publicUrl } } = supabase.storage.from('ras-photos').getPublicUrl(path);

      const { data: fotoData } = await supabase.from('ctm_ras_fotos').insert({
        ras_id: ras.id,
        url_foto: publicUrl,
        legenda: null,
      }).select().single();

      if (fotoData) setFotos(prev => [...prev, fotoData]);
    }

    toast.success(files.length > 1 ? 'Fotos adicionadas!' : 'Foto adicionada!');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function salvarLegenda(fotoId: string) {
    const legenda = legendaDraft.trim() || null;
    await supabase.from('ctm_ras_fotos').update({ legenda }).eq('id', fotoId);
    setFotos(prev => prev.map(f => (f.id === fotoId ? { ...f, legenda } : f)));
    setEditandoLegenda(null);
    toast.success('Legenda salva');
  }

  async function deleteFoto(foto: any) {
    // Tenta remover do storage se tiver path identificável
    const urlParts = foto.url_foto?.split('ras-photos/');
    if (urlParts?.[1]) {
      await supabase.storage.from('ras-photos').remove([decodeURIComponent(urlParts[1])]);
    }
    await supabase.from('ctm_ras_fotos').delete().eq('id', foto.id);
    setFotos(prev => prev.filter(f => f.id !== foto.id));
    toast.success('Foto removida');
  }

  // Cálculo de dias na oficina
  const diasNaOficina = ras.data_entrada && ras.data_saida
    ? Math.round((new Date(ras.data_saida).getTime() - new Date(ras.data_entrada).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const horasVoladasMaint = (ras.horas_celula_entrada && ras.horas_celula_saida)
    ? Number(ras.horas_celula_saida) - Number(ras.horas_celula_entrada)
    : null;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        ← Voltar para lista
      </button>

      <div className="mb-5 flex justify-end">
        <button
          onClick={() => gerarRelatorioRAS({ ...ras, ctm_ras_itens: items }, fotos, aeronave)}
          className="flex items-center gap-2 rounded-full border border-cyan-400/35 px-4 py-1.5 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-400/10"
        >
          <FileDown className="h-4 w-4" /> Gerar Relatório (com fotos)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Header */}
          <div className="ctm-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">RAS #{ras.numero}</h2>
                <p className="text-muted-foreground">{ras.tipo_manutencao}</p>
                {ras.objetivo && <p className="text-xs text-muted-foreground mt-0.5">Período: {ras.objetivo}</p>}
              </div>
              <RASStatusBadge status={ras.status} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <InfoItem label="Data Entrada" value={formatDate(ras.data_entrada)} />
              <InfoItem label="Data Saída" value={formatDate(ras.data_saida)} />
              {diasNaOficina !== null && <InfoItem label="Dias na Oficina" value={`${diasNaOficina} dias`} />}
              <InfoItem label="O.S Oficina" value={ras.oas_numero || '—'} />
            </div>
            {/* Horas de célula */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-4 border-t border-border">
              <InfoItem label="Horas Célula (Entrada)" value={ras.horas_celula_entrada ? `${ras.horas_celula_entrada}h` : '—'} teal />
              <InfoItem label="Horas Célula (Saída)" value={ras.horas_celula_saida ? `${ras.horas_celula_saida}h` : '—'} teal />
              {horasVoladasMaint !== null && <InfoItem label="Δ Horas Voo" value={`${horasVoladasMaint.toFixed(1)}h`} teal />}
              {ras.oficina_nome && <InfoItem label="Oficina" value={ras.oficina_nome} />}
              {ras.mecanico_responsavel && <InfoItem label="Mecânico" value={ras.mecanico_responsavel} />}
            </div>
            {ras.descricao && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Descrição / Inspeções Realizadas</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{ras.descricao}</p>
              </div>
            )}
          </div>

          {/* Services */}
          {servicos.length > 0 && (
            <div className="ctm-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold teal-text">Serviços (Mão de Obra)</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Descrição</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Fornecedor / Oficina</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Período</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Motivo / O que aconteceu</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/40 hover:bg-secondary/40 align-top">
                      <td className="px-4 py-2.5 font-medium">{s.descricao}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.fornecedor || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{s.periodo || '—'}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-pre-wrap">{s.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Parts */}
          {pecas.length > 0 && (
            <div className="ctm-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold teal-text">Peças Trocadas</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Descrição</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">P/N</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">S/N</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Fornecedor</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Qtd</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Motivo da troca</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map((p: any) => (
                    <tr key={p.id} className="border-b border-border/40 hover:bg-secondary/40 align-top">
                      <td className="px-4 py-2.5 font-medium">{p.descricao}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.numero_peca || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.numero_serie || '—'}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">{p.fornecedor || '—'}</td>
                      <td className="px-4 py-2.5 text-right">{p.quantidade || 1}</td>
                      <td className="px-4 py-2.5 text-xs whitespace-pre-wrap">{p.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Photos */}
          <div className="ctm-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold teal-text flex items-center gap-2">
                <Image className="h-4 w-4" /> Fotos ({fotos.length})
              </h3>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Adicionar Foto
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={uploadFoto} />
            </div>
            {fotos.length === 0 ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-[hsl(var(--ctm-teal)/0.4)] transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Clique para adicionar fotos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {fotos.map((foto: any) => (
                  <div key={foto.id} className="relative group">
                    <a href={foto.url_foto} target="_blank" rel="noopener noreferrer">
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-border hover:border-ctm-teal transition-colors">
                        <img src={foto.url_foto} alt={foto.legenda || 'Foto RAS'} className="w-full h-full object-cover" />
                      </div>
                    </a>
                    <button
                      onClick={() => deleteFoto(foto)}
                      className="absolute top-1 right-1 h-6 w-6 bg-red-500/80 rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                    {editandoLegenda === foto.id ? (
                      <div className="mt-1 flex gap-1">
                        <input
                          autoFocus
                          className="ctm-input flex-1 text-xs"
                          value={legendaDraft}
                          placeholder="Legenda da foto (sai no relatório)"
                          onChange={e => setLegendaDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') salvarLegenda(foto.id); }}
                        />
                        <button onClick={() => salvarLegenda(foto.id)} className="teal-text px-1">
                          <Save className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditandoLegenda(foto.id); setLegendaDraft(foto.legenda || ''); }}
                        className="mt-1 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3 shrink-0" />
                        <span className="truncate">{foto.legenda || 'Adicionar legenda'}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Horas célula info */}
          {(ras.horas_celula_entrada || ras.horas_celula_saida) && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text flex items-center gap-2">
                <Clock className="h-4 w-4" /> Horas de Célula
              </h3>
              <div className="space-y-2 text-sm">
                {ras.horas_celula_entrada && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entrada</span>
                    <span className="font-mono font-semibold">{ras.horas_celula_entrada}h</span>
                  </div>
                )}
                {ras.horas_celula_saida && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saída</span>
                    <span className="font-mono font-semibold">{ras.horas_celula_saida}h</span>
                  </div>
                )}
                {horasVoladasMaint !== null && (
                  <div className="flex justify-between pt-2 border-t border-border font-bold">
                    <span className="text-muted-foreground">Variação</span>
                    <span className="teal-text font-mono">+{horasVoladasMaint.toFixed(1)}h</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function RASStatusBadge({ status }: { status?: string }) {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s.includes('conclu')) return <span className="badge-ok">Concluído</span>;
  if (s === 'cancelled' || s.includes('cancel')) return <span className="badge-expired">Cancelado</span>;
  return <span className="badge-teal">Em Andamento</span>;
}

function InfoItem({ label, value, teal }: { label: string; value: string; teal?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-medium', teal && value !== '—' && 'teal-text')}>{value}</p>
    </div>
  );
}

function formatDate(d?: string) {
  if (!d) return '—';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return d; }
}

function EmptySection({ icon: Icon, text }: { icon: typeof BookOpen; text: string }) {
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
