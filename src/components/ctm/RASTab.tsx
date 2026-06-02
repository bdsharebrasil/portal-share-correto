import { useEffect, useState, useRef } from 'react';
import { BookOpen, Image, Plus, Upload, ChevronRight, X, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RASTabProps { aircraftId: string; }

export function RASTab({ aircraftId }: RASTabProps) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function loadRAS() {
    const { data, error } = await supabase
      .from('ras')
      .select(`
        *,
        ras_itens(*),
        ras_fotos(*)
      `)
      .eq('aeronave_id', aircraftId)
      .order('criado_em', { ascending: false });
    console.log('RAS:', data, error);
    if (data) setList(data);
    setLoading(false);
  }

  useEffect(() => { loadRAS(); }, [aircraftId]);

  if (loading) return <LoadingSpinner />;
  if (selected) return <RASDetail ras={selected} onBack={() => setSelected(null)} onRefresh={loadRAS} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold">Relatório de Acompanhamento de Serviço (RAS)</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm"
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
            const servicos = (ras.ras_itens || []).filter((i: any) => i.item_tipo === 'service');
            const pecas = (ras.ras_itens || []).filter((i: any) => i.item_tipo === 'part');
            const fotos = ras.ras_fotos || [];
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
                      <span>{servicos.length} serviços · {pecas.length} peças</span>
                      {fotos.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Image className="h-3 w-3" /> {fotos.length} fotos
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold">
                      R$ {Number(ras.total_geral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
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
  const [form, setForm] = useState({
    numero: '',
    tipo_manutencao: 'corretiva',
    data_entrada: '',
    data_saida: '',
    descricao: '',
    oas_numero: '',
    horas_celula_entrada: '',
  });
  const [servicos, setServicos] = useState([{ descricao: '', fornecedor: '', periodo: '', valor_total: 0 }]);
  const [pecas, setPecas] = useState([{ descricao: '', fornecedor: '', periodo: '', valor_total: 0, numero_fatura: '' }]);

  async function save() {
    if (!form.numero || !form.data_entrada) { toast.error('Número e data de entrada são obrigatórios'); return; }
    setSaving(true);

    const laborTotal = servicos.reduce((a, s) => a + Number(s.valor_total), 0);
    const partsTotal = pecas.reduce((a, p) => a + Number(p.valor_total), 0);

    const { data: rasData, error } = await supabase
      .from('ras')
      .insert({
        aeronave_id: aircraftId,
        numero: form.numero,
        oas_numero: form.oas_numero || null,
        tipo_manutencao: form.tipo_manutencao,
        data_entrada: form.data_entrada,
        data_saida: form.data_saida || null,
        descricao: form.descricao,
        horas_celula_entrada: form.horas_celula_entrada ? Number(form.horas_celula_entrada) : null,
        total_trabalho: laborTotal,
        total_pecas: partsTotal,
        total_geral: laborTotal + partsTotal,
        status: 'in_progress',
      })
      .select()
      .single();

    if (error || !rasData) { toast.error('Erro ao criar RAS: ' + error?.message); setSaving(false); return; }

    const validServicos = servicos.filter(s => s.descricao.trim());
    const validPecas = pecas.filter(p => p.descricao.trim());

    const allItems = [
      ...validServicos.map(s => ({ ras_id: rasData.id, item_tipo: 'service', descricao: s.descricao, fornecedor: s.fornecedor, periodo: s.periodo, valor_total: Number(s.valor_total) })),
      ...validPecas.map(p => ({ ras_id: rasData.id, item_tipo: 'part', descricao: p.descricao, fornecedor: p.fornecedor, periodo: p.periodo, valor_total: Number(p.valor_total), numero_fatura: p.numero_fatura })),
    ];
    if (allItems.length > 0) {
      await supabase.from('ras_itens').insert(allItems);
    }

    toast.success('RAS criado com sucesso!');
    onSaved();
  }

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Novo RAS</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Número RAS *</label>
          <input className="ctm-input w-full" placeholder="Ex: 71" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">N° O.S Oficina</label>
          <input className="ctm-input w-full" placeholder="Ex: OS 008-2025" value={form.oas_numero} onChange={e => setForm(f => ({ ...f, oas_numero: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
          <select className="ctm-input w-full" value={form.tipo_manutencao} onChange={e => setForm(f => ({ ...f, tipo_manutencao: e.target.value }))}>
            <option value="corretiva">Corretiva</option>
            <option value="preventiva">Preventiva</option>
            <option value="programada">Programada</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data Entrada *</label>
          <input type="date" className="ctm-input w-full" value={form.data_entrada} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Data Saída</label>
          <input type="date" className="ctm-input w-full" value={form.data_saida} onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Horas Célula (entrada)</label>
          <input type="number" step="0.1" className="ctm-input w-full" placeholder="Ex: 3231.5" value={form.horas_celula_entrada} onChange={e => setForm(f => ({ ...f, horas_celula_entrada: e.target.value }))} />
        </div>
        <div className="md:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Descrição das Inspeções Realizadas</label>
          <textarea className="ctm-input w-full h-24 resize-none" placeholder="Descreva os serviços realizados..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
      </div>

      {/* Serviços */}
      <ItemsList
        title="Serviços (Mão de Obra)"
        items={servicos}
        onAdd={() => setServicos(prev => [...prev, { descricao: '', fornecedor: '', periodo: '', valor_total: 0 }])}
        onUpdate={(idx, field, val) => setServicos(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))}
        onRemove={idx => setServicos(prev => prev.filter((_, i) => i !== idx))}
        showNF={false}
      />

      {/* Peças */}
      <ItemsList
        title="Peças Aplicadas"
        items={pecas}
        onAdd={() => setPecas(prev => [...prev, { descricao: '', fornecedor: '', periodo: '', valor_total: 0, numero_fatura: '' }])}
        onUpdate={(idx, field, val) => setPecas(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it))}
        onRemove={idx => setPecas(prev => prev.filter((_, i) => i !== idx))}
        showNF
      />

      <div className="flex gap-3 justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar RAS
        </button>
      </div>
    </div>
  );
}

function ItemsList({ title, items, onAdd, onUpdate, onRemove, showNF }: any) {
  const total = items.reduce((a: number, i: any) => a + Number(i.valor_total || 0), 0);
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</label>
        <button onClick={onAdd} className="text-xs teal-text hover:underline flex items-center gap-1">
          <Plus className="h-3 w-3" /> Adicionar
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            <input className="ctm-input flex-1 min-w-48" placeholder="Descrição" value={item.descricao} onChange={e => onUpdate(idx, 'descricao', e.target.value)} />
            <input className="ctm-input w-32" placeholder="Fornecedor" value={item.fornecedor} onChange={e => onUpdate(idx, 'fornecedor', e.target.value)} />
            <input className="ctm-input w-28" placeholder="Período" value={item.periodo} onChange={e => onUpdate(idx, 'periodo', e.target.value)} />
            {showNF && <input className="ctm-input w-28" placeholder="NF/Recibo" value={item.numero_fatura || ''} onChange={e => onUpdate(idx, 'numero_fatura', e.target.value)} />}
            <input type="number" min="0" step="0.01" className="ctm-input w-32 text-right" placeholder="R$ Valor" value={item.valor_total} onChange={e => onUpdate(idx, 'valor_total', e.target.value)} />
            {items.length > 1 && <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-300"><X className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-2 text-sm text-muted-foreground">
        Total: <span className="ml-1 font-semibold teal-text">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
    </div>
  );
}

// ── RAS Detail ───────────────────────────────────────────────────────────────
function RASDetail({ ras, onBack, onRefresh }: { ras: any; onBack: () => void; onRefresh: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [fotos, setFotos] = useState<any[]>(ras.ras_fotos || []);
  const fileRef = useRef<HTMLInputElement>(null);

  const items = ras.ras_itens || [];
  const servicos = items.filter((i: any) => i.item_tipo === 'service');
  const pecas = items.filter((i: any) => i.item_tipo === 'part');

  async function uploadFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const ext = file.name.split('.').pop();
    const path = `ras/${ras.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from('ras-photos').upload(path, file, { upsert: true });
    if (upErr) { toast.error('Erro ao fazer upload: ' + upErr.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('ras-photos').getPublicUrl(path);

    const { data: fotoData } = await supabase.from('ras_fotos').insert({
      ras_id: ras.id,
      url_foto: publicUrl,
      arquivo_path: path,
      legenda: file.name,
    }).select().single();

    if (fotoData) setFotos(prev => [...prev, fotoData]);
    toast.success('Foto adicionada!');
    setUploading(false);
  }

  async function deleteFoto(foto: any) {
    await supabase.storage.from('ras-photos').remove([foto.arquivo_path]);
    await supabase.from('ras_fotos').delete().eq('id', foto.id);
    setFotos(prev => prev.filter(f => f.id !== foto.id));
    toast.success('Foto removida');
  }

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
                <h2 className="text-xl font-bold">RAS #{ras.numero}</h2>
                <p className="text-muted-foreground">{ras.tipo_manutencao}</p>
              </div>
              <RASStatusBadge status={ras.status} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoItem label="Entrada" value={formatDate(ras.data_entrada)} />
              <InfoItem label="Saída" value={formatDate(ras.data_saida)} />
              <InfoItem label="Horas Célula" value={ras.horas_celula_entrada ? `${ras.horas_celula_entrada}h` : '—'} />
              <InfoItem label="O.S Oficina" value={ras.oas_numero || '—'} />
            </div>
            {ras.descricao && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">Descrição das Inspeções Realizadas</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{ras.descricao}</p>
              </div>
            )}
          </div>

          {/* Services */}
          {servicos.length > 0 && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text">Serviços</h3>
              <div className="space-y-2">
                {servicos.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.descricao}</p>
                      <p className="text-xs text-muted-foreground">{s.fornecedor}{s.periodo && ` · ${s.periodo}`}{s.numero_fatura && ` · ${s.numero_fatura}`}</p>
                    </div>
                    <p className="text-sm font-bold ml-4">R$ {Number(s.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parts */}
          {pecas.length > 0 && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text">Peças Aplicadas</h3>
              <div className="space-y-2">
                {pecas.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.descricao}</p>
                      <p className="text-xs text-muted-foreground">{p.fornecedor}{p.periodo && ` · ${p.periodo}`}{p.numero_fatura && ` · ${p.numero_fatura}`}</p>
                    </div>
                    <p className="text-sm font-bold ml-4">R$ {Number(p.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
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
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadFoto} />
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
                        <img
                          src={foto.url_foto}
                          alt={foto.legenda || 'Foto RAS'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </a>
                    <button
                      onClick={() => deleteFoto(foto)}
                      className="absolute top-1 right-1 h-6 w-6 bg-red-500/80 rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                    {foto.legenda && <p className="text-xs text-muted-foreground mt-1 text-center truncate">{foto.legenda}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="ctm-card p-5 h-fit">
          <h3 className="font-semibold mb-4 teal-text">Resumo Financeiro</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mão de obra</span>
              <span>R$ {Number(ras.total_trabalho || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peças</span>
              <span>R$ {Number(ras.total_pecas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pt-3 border-t border-border flex justify-between font-bold">
              <span>Total</span>
              <span className="teal-text">R$ {Number(ras.total_geral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RASStatusBadge({ status }: { status?: string }) {
  const s = (status || '').toLowerCase();
  if (s === 'completed' || s.includes('conclu')) return <span className="badge-ok">Concluído</span>;
  if (s === 'cancelled' || s.includes('cancel')) return <span className="badge-expired">Cancelado</span>;
  return <span className="badge-teal">Em Andamento</span>;
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
