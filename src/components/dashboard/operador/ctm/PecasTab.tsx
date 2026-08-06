import { useEffect, useState } from 'react';
import { Package, Plus, X, Save, Loader2, Search } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

interface PecasTabProps { aircraftId: string; }

export function PecasTab({ aircraftId }: PecasTabProps) {
  const [pecas, setPecas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  async function loadPecas() {
    const { data: rasData, error: rasError } = await supabase
      .from('ctm_ras')
      .select('id, numero, data_entrada, tipo_manutencao')
      .eq('aeronave_id', aircraftId);

    if (rasError) {
      console.error('Erro ao carregar RAS para filtro de peças:', rasError);
      setLoading(false);
      return;
    }

    const rasMap = new Map((rasData ?? []).map((r: any) => [r.id, r]));
    const rasIds = Array.from(rasMap.keys());

    if (rasIds.length === 0) {
      setPecas([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('ctm_pecas_trocadas')
      .select('*')
      .in('ordem_servico_id', rasIds)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro ao carregar peças trocadas:', error);
      setLoading(false);
      return;
    }

    setPecas((data ?? [])
      .map((p: any) => ({ ...p, ctm_ras: rasMap.get(p.ordem_servico_id) })));
    setLoading(false);
  }

  useEffect(() => { loadPecas(); }, [aircraftId]);

  const filtered = pecas.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.descricao || '').toLowerCase().includes(s) ||
      (p.p_n_instalado || '').toLowerCase().includes(s) ||
      (p.p_n_removido || '').toLowerCase().includes(s) ||
      (p.s_n_instalado || '').toLowerCase().includes(s) ||
      (p.fornecedor || '').toLowerCase().includes(s)
    );
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 teal-text" /> Histórico de Peças
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm"
        >
          <Plus className="h-4 w-4" /> Registrar Troca
        </button>
      </div>

      {showForm && (
        <NovaPecaForm
          aircraftId={aircraftId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadPecas(); }}
        />
      )}

      {/* Busca */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="ctm-input pl-9 w-full"
          placeholder="Buscar por descrição, P/N, S/N, fornecedor..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && !showForm ? (
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhuma peça registrada</p>
          <p className="text-xs text-muted-foreground mt-1">O histórico de peças instaladas/removidas aparecerá aqui</p>
        </div>
      ) : (
        <div className="ctm-card overflow-hidden">
          <div className="overflow-x-auto ctm-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">P/N Removido</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">S/N Removido</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">P/N Instalado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">S/N Instalado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Qtd</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Fornecedor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Ref. OAS/RAS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Observações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const rasNum = p.ctm_ras?.numero;
                  const dataEntrada = p.ctm_ras?.data_entrada;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {dataEntrada
                          ? new Date(dataEntrada + 'T12:00:00').toLocaleDateString('pt-BR')
                          : p.criado_em
                          ? new Date(p.criado_em).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium max-w-[200px]">
                        <p className="truncate" title={p.descricao}>{p.descricao}</p>
                        {p.ctm_ras?.tipo_manutencao && (
                          <p className="text-xs text-muted-foreground mt-0.5">{p.ctm_ras.tipo_manutencao}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.p_n_removido || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.s_n_removido || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs teal-text font-semibold">{p.p_n_instalado || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{p.s_n_instalado || '—'}</td>
                      <td className="px-4 py-3 text-right">{p.quantidade || 1}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.fornecedor || '—'}</td>
                                      <td className="px-4 py-3">
                        {rasNum ? (
                          <span className="badge-teal">RAS #{rasNum}</span>
                        ) : (
                          <span className="badge-pending">Ordem</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px]">
                        <p className="truncate" title={p.observacoes}>{p.observacoes || '—'}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
            {filtered.length} peça(s) encontrada(s)
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form Nova Peça ────────────────────────────────────────────────────────────
function NovaPecaForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [rasList, setRasList] = useState<any[]>([]);
  const [form, setForm] = useState({
    ras_id: '',
    descricao: '',
    p_n_removido: '',
    s_n_removido: '',
    p_n_instalado: '',
    s_n_instalado: '',
    quantidade: '1',
    fornecedor: '',
    observacoes: '',
  });

  useEffect(() => {
    supabase.from('ctm_ras').select('id, numero, tipo_manutencao, data_entrada')
      .eq('aeronave_id', aircraftId)
      .order('data_entrada', { ascending: false })
      .then(({ data }) => { if (data) setRasList(data); });
  }, [aircraftId]);

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  async function save() {
    if (!form.descricao) { toast.error('Descrição é obrigatória'); return; }
    if (!form.ras_id) { toast.error('Selecione um RAS para vincular a peça'); return; }
    setSaving(true);

    const { error } = await supabase.from('ctm_pecas_trocadas').insert({
      ordem_servico_id: form.ras_id,
      descricao: form.descricao,
      p_n_removido: form.p_n_removido || null,
      s_n_removido: form.s_n_removido || null,
      p_n_instalado: form.p_n_instalado || null,
      s_n_instalado: form.s_n_instalado || null,
      quantidade: Number(form.quantidade || 1),
      fornecedor: form.fornecedor || null,
      observacoes: form.observacoes || null,
    });

    if (!error) { toast.success('Peça registrada!'); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Registrar Troca de Peça</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Referência RAS *</label>
          <select className="ctm-input w-full" value={form.ras_id} onChange={e => f('ras_id', e.target.value)}>
            <option value="">— Selecione um RAS —</option>
            {rasList.map(r => (
              <option key={r.id} value={r.id}>
                RAS #{r.numero} — {r.tipo_manutencao} ({r.data_entrada ? new Date(r.data_entrada + 'T12:00:00').toLocaleDateString('pt-BR') : '—'})
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Descrição da Peça *</label>
          <input className="ctm-input w-full" placeholder="Ex: Filtro de óleo — OH-6 (Continental)" value={form.descricao} onChange={e => f('descricao', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">P/N Removido</label>
          <input className="ctm-input w-full" placeholder="Part Number antigo" value={form.p_n_removido} onChange={e => f('p_n_removido', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">S/N Removido</label>
          <input className="ctm-input w-full" placeholder="Serial Number antigo" value={form.s_n_removido} onChange={e => f('s_n_removido', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Quantidade</label>
          <input type="number" min="1" className="ctm-input w-full" value={form.quantidade} onChange={e => f('quantidade', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">P/N Instalado</label>
          <input className="ctm-input w-full" placeholder="Part Number novo" value={form.p_n_instalado} onChange={e => f('p_n_instalado', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">S/N Instalado</label>
          <input className="ctm-input w-full" placeholder="Serial Number novo" value={form.s_n_instalado} onChange={e => f('s_n_instalado', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Fornecedor</label>
          <input className="ctm-input w-full" placeholder="Nome do fornecedor" value={form.fornecedor} onChange={e => f('fornecedor', e.target.value)} />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Observações (motivo da troca, condição da peça removida, etc.)</label>
          <textarea className="ctm-input w-full h-20 resize-none" placeholder="Ex: Desgaste conforme inspeção 50h. Pneu com trinca lateral 2mm." value={form.observacoes} onChange={e => f('observacoes', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Registrar Peça
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
