import { useEffect, useState } from 'react';
import { Scale, Plus, X, Save, Loader2, Edit2, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PesoBalanceamentoTabProps { aircraftId: string; }

export function PesoBalanceamentoTab({ aircraftId }: PesoBalanceamentoTabProps) {
  const [weightData, setWeightData] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [combustivel, setCombustivel] = useState(0);

  async function loadData() {
    const { data: wb } = await supabase
      .from('ctm_peso_balanceamento')
      .select('*')
      .eq('aeronave_id', aircraftId)
      .single();

    if (wb) {
      setWeightData(wb);
      const { data: wbItems } = await supabase
        .from('ctm_itens_peso_balanceamento')
        .select('*')
        .eq('peso_balanceamento_id', wb.id)
        .order('criado_em');
      if (wbItems) setItems(wbItems);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [aircraftId]);

  // Cálculo de CG
  const calcCG = () => {
    if (!weightData) return null;
    const activeItems = items.filter(i => i.incluir_no_calculo);
    const pesoTotal = activeItems.reduce((s, i) => s + Number(i.peso_sem_combustivel || 0), 0) + combustivel;
    const momentoTotal = activeItems.reduce((s, i) => s + Number(i.momento || 0), 0);
    const cgBraco = pesoTotal > 0 ? momentoTotal / pesoTotal : 0;
    const mac = Number(weightData.mac_comprimento || 1);
    const lemac = Number(weightData.lemac_distancia || 0);
    const cgPct = mac > 0 ? ((cgBraco - lemac) / mac) * 100 : 0;
    const dentroLimites = cgPct >= Number(weightData.cg_limite_dianteiro) && cgPct <= Number(weightData.cg_limite_traseiro);
    return { pesoTotal, momentoTotal, cgBraco, cgPct, dentroLimites };
  };

  const cg = calcCG();

  if (loading) return <LoadingSpinner />;

  if (!weightData && !showForm) {
    return (
      <div>
        <div className="section-accent mb-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5" /> Peso e Balanceamento
          </h2>
        </div>
        <div className="ctm-card flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground mb-2">Nenhuma configuração de Peso e Balanceamento encontrada</p>
          <p className="text-xs text-muted-foreground mb-6">Configure os limites da aeronave para começar</p>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm">
            <Plus className="h-4 w-4" /> Configurar Peso e Balanceamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5" /> Peso e Balanceamento
          </h2>
        </div>
        <div className="flex gap-2">
          {weightData && (
            <button onClick={() => setShowItemForm(true)} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm">
              <Plus className="h-4 w-4" /> Adicionar Item
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <ConfigForm
          aircraftId={aircraftId}
          existing={weightData}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadData(); }}
        />
      )}

      {showItemForm && weightData && (
        <ItemForm
          weightBalanceId={weightData.id}
          editing={editingItem}
          onClose={() => { setShowItemForm(false); setEditingItem(null); }}
          onSaved={() => { setShowItemForm(false); setEditingItem(null); loadData(); }}
        />
      )}

      {weightData && (
        <>
          {/* Cards de CG */}
          {cg && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="ctm-card p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Peso Total</p>
                <p className="text-2xl font-bold">{cg.pesoTotal.toFixed(1)} kg</p>
                <p className="text-xs mt-1">
                  {cg.pesoTotal <= Number(weightData.peso_maximo_decolagem)
                    ? <span className="text-emerald-400">✓ Dentro do limite</span>
                    : <span className="text-red-400">⚠ Acima do limite</span>}
                </p>
              </div>
              <div className={cn('ctm-card p-4 text-center', cg.dentroLimites ? 'border-emerald-500/20' : 'border-red-500/30')}>
                <p className="text-xs text-muted-foreground mb-1">CG (% MAC)</p>
                <p className={cn('text-2xl font-bold', cg.dentroLimites ? 'text-emerald-400' : 'text-red-400')}>{cg.cgPct.toFixed(1)}%</p>
                <p className="text-xs mt-1">
                  {cg.dentroLimites ? <span className="text-emerald-400 flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" />OK</span> : <span className="text-red-400">⚠ Fora dos limites</span>}
                </p>
              </div>
              <div className="ctm-card p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Limites CG</p>
                <p className="text-sm font-mono font-bold">{Number(weightData.cg_limite_dianteiro).toFixed(1)}% – {Number(weightData.cg_limite_traseiro).toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">Dianteiro – Traseiro</p>
              </div>
              <div className="ctm-card p-4">
                <p className="text-xs text-muted-foreground mb-1">Combustível (kg)</p>
                <p className="text-xl font-bold mb-2">{combustivel.toFixed(1)} kg</p>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={combustivel}
                  onChange={e => setCombustivel(Number(e.target.value) || 0)}
                  className="ctm-input w-full text-sm"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {/* Limites de Peso */}
          <div className="ctm-card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold teal-text">Configuração da Aeronave</h3>
              <div className="flex items-center gap-2">
                {weightData.validado && <span className="badge-ok flex items-center gap-1"><CheckCircle className="h-3 w-3" />Validado</span>}
                <button onClick={() => setShowForm(true)} className="text-xs teal-text hover:underline flex items-center gap-1"><Edit2 className="h-3 w-3" />Editar</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Peso Vazio Padrão</p><p className="font-semibold">{weightData.peso_vazio_padrao} kg</p></div>
              <div><p className="text-xs text-muted-foreground">PMD (Peso Máx. Decolagem)</p><p className="font-semibold">{weightData.peso_maximo_decolagem} kg</p></div>
              <div><p className="text-xs text-muted-foreground">PMaP (Peso Máx. Pouso)</p><p className="font-semibold">{weightData.peso_maximo_pouso} kg</p></div>
              {weightData.peso_maximo_sem_combustivel && <div><p className="text-xs text-muted-foreground">PMSC</p><p className="font-semibold">{weightData.peso_maximo_sem_combustivel} kg</p></div>}
              <div><p className="text-xs text-muted-foreground">MAC</p><p className="font-semibold">{weightData.mac_comprimento} m</p></div>
              <div><p className="text-xs text-muted-foreground">LEMAC</p><p className="font-semibold">{weightData.lemac_distancia} m</p></div>
              {weightData.capacidade_combustivel_total && <div><p className="text-xs text-muted-foreground">Cap. Combustível Total</p><p className="font-semibold">{weightData.capacidade_combustivel_total} L</p></div>}
              {weightData.notas && <div className="col-span-2 md:col-span-4"><p className="text-xs text-muted-foreground">Notas</p><p className="text-sm">{weightData.notas}</p></div>}
            </div>
          </div>

          {/* Itens */}
          <div className="ctm-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Itens de Peso</h3>
              <span className="text-xs text-muted-foreground">{items.length} item(s)</span>
            </div>
            {items.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                Nenhum item adicionado. Use "Adicionar Item" para incluir componentes de peso.
              </div>
            ) : (
              <div className="overflow-x-auto ctm-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Incluir</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Categoria</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Peso (kg)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Braço (m)</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Momento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className={cn('border-b border-border/50 hover:bg-secondary/50 transition-colors', !item.incluir_no_calculo && 'opacity-50')}>
                        <td className="px-4 py-3">
                          <div className={cn('h-4 w-4 rounded border-2 flex items-center justify-center', item.incluir_no_calculo ? 'border-ctm-teal bg-ctm-teal/20' : 'border-border')}>
                            {item.incluir_no_calculo && <span className="text-ctm-teal text-xs">✓</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">{item.descricao}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{item.categoria || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono">{Number(item.peso_sem_combustivel || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono">{Number(item['braço_posicao'] || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono teal-text">{Number(item.momento || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingItem(item); setShowItemForm(true); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={async () => {
                              if (!confirm('Remover item?')) return;
                              await supabase.from('ctm_itens_peso_balanceamento').delete().eq('id', item.id);
                              toast.success('Item removido');
                              loadData();
                            }} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {cg && (
                      <tr className="bg-[hsl(var(--ctm-teal)/0.08)] border-t border-[hsl(var(--ctm-teal)/0.2)]">
                        <td colSpan={3} className="px-4 py-3 font-bold teal-text">TOTAL</td>
                        <td className="px-4 py-3 text-right font-bold">{cg.pesoTotal.toFixed(2)} kg</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right font-bold teal-text">{cg.momentoTotal.toFixed(2)}</td>
                        <td className="px-4 py-3" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Config Form ───────────────────────────────────────────────────────────────
function ConfigForm({ aircraftId, existing, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    peso_vazio_padrao: existing?.peso_vazio_padrao || '',
    braco_cg_padrao: existing?.braco_cg_padrao || existing?.['braço_cg_padrao'] || '',
    peso_maximo_decolagem: existing?.peso_maximo_decolagem || '',
    peso_maximo_pouso: existing?.peso_maximo_pouso || '',
    peso_maximo_sem_combustivel: existing?.peso_maximo_sem_combustivel || '',
    cg_limite_dianteiro: existing?.cg_limite_dianteiro || '15',
    cg_limite_traseiro: existing?.cg_limite_traseiro || '35',
    mac_comprimento: existing?.mac_comprimento || '',
    lemac_distancia: existing?.lemac_distancia || '',
    capacidade_combustivel_total: existing?.capacidade_combustivel_total || '',
    capacidade_combustivel_util: existing?.capacidade_combustivel_util || '',
    notas: existing?.notas || '',
  });

  const f = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }));

  async function save() {
    if (!form.peso_vazio_padrao || !form.peso_maximo_decolagem) {
      toast.error('Peso vazio e PMD são obrigatórios');
      return;
    }
    setSaving(true);
    const payload: any = {
      aeronave_id: aircraftId,
      peso_vazio_padrao: Number(form.peso_vazio_padrao),
      braco_cg_padrao: form.braco_cg_padrao ? Number(form.braco_cg_padrao) : 0,
      peso_maximo_decolagem: Number(form.peso_maximo_decolagem),
      peso_maximo_pouso: Number(form.peso_maximo_pouso || form.peso_maximo_decolagem),
      cg_limite_dianteiro: Number(form.cg_limite_dianteiro || 15),
      cg_limite_traseiro: Number(form.cg_limite_traseiro || 35),
      mac_comprimento: Number(form.mac_comprimento || 1),
      lemac_distancia: Number(form.lemac_distancia || 0),
    };
    if (form.peso_maximo_sem_combustivel) payload.peso_maximo_sem_combustivel = Number(form.peso_maximo_sem_combustivel);
    if (form.capacidade_combustivel_total) payload.capacidade_combustivel_total = Number(form.capacidade_combustivel_total);
    if (form.capacidade_combustivel_util) payload.capacidade_combustivel_util = Number(form.capacidade_combustivel_util);
    if (form.notas) payload.notas = form.notas;

    let error;
    if (existing) {
      ({ error } = await supabase.from('ctm_peso_balanceamento').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('ctm_peso_balanceamento').insert(payload));
    }
    if (!error) { toast.success('Configuração salva!'); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Configuração de Peso e Balanceamento</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {[
          { key: 'peso_vazio_padrao', label: 'Peso Vazio Padrão (kg) *', placeholder: 'Ex: 1580' },
          { key: 'braco_cg_padrao', label: 'Braço CG Padrão (m)', placeholder: 'Ex: 2.34' },
          { key: 'peso_maximo_decolagem', label: 'Peso Máx. Decolagem (kg) *', placeholder: 'Ex: 2313' },
          { key: 'peso_maximo_pouso', label: 'Peso Máx. Pouso (kg)', placeholder: 'Ex: 2200' },
          { key: 'peso_maximo_sem_combustivel', label: 'Peso Máx. Sem Combustível (kg)', placeholder: 'Opcional' },
          { key: 'cg_limite_dianteiro', label: 'CG Limite Dianteiro (% MAC)', placeholder: 'Ex: 15' },
          { key: 'cg_limite_traseiro', label: 'CG Limite Traseiro (% MAC)', placeholder: 'Ex: 35' },
          { key: 'mac_comprimento', label: 'MAC — Comprimento (m)', placeholder: 'Ex: 1.27' },
          { key: 'lemac_distancia', label: 'LEMAC — Distância (m)', placeholder: 'Ex: 2.13' },
          { key: 'capacidade_combustivel_total', label: 'Capacidade Combustível Total (L)', placeholder: 'Ex: 420' },
          { key: 'capacidade_combustivel_util', label: 'Combustível Utilizável (L)', placeholder: 'Ex: 400' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-muted-foreground block mb-1">{label}</label>
            <input type="number" step="0.01" className="ctm-input w-full" placeholder={placeholder} value={(form as any)[key]} onChange={e => f(key, e.target.value)} />
          </div>
        ))}
        <div className="lg:col-span-3">
          <label className="text-xs text-muted-foreground block mb-1">Notas</label>
          <textarea className="ctm-input w-full h-16 resize-none" value={form.notas} onChange={e => f('notas', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configuração
        </button>
      </div>
    </div>
  );
}

// ── Item Form ─────────────────────────────────────────────────────────────────
function ItemForm({ weightBalanceId, editing, onClose, onSaved }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    descricao: editing?.descricao || '',
    categoria: editing?.categoria || '',
    peso_sem_combustivel: editing?.peso_sem_combustivel || '',
    braco_posicao: editing?.['braço_posicao'] || '',
    incluir_no_calculo: editing?.incluir_no_calculo !== false,
    observacao: editing?.observacao || '',
  });

  const f = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));
  const peso = Number(form.peso_sem_combustivel || 0);
  const braco = Number(form.braco_posicao || 0);
  const momento = peso * braco;

  async function save() {
    if (!form.descricao || !form.peso_sem_combustivel || !form.braco_posicao) {
      toast.error('Descrição, peso e braço são obrigatórios');
      return;
    }
    setSaving(true);
    const payload = {
      peso_balanceamento_id: weightBalanceId,
      descricao: form.descricao,
      categoria: form.categoria || null,
      peso_sem_combustivel: peso,
      'braço_posicao': braco,
      momento,
      incluir_no_calculo: form.incluir_no_calculo,
      observacao: form.observacao || null,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from('ctm_itens_peso_balanceamento').update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from('ctm_itens_peso_balanceamento').insert(payload));
    }
    if (!error) { toast.success(editing ? 'Item atualizado!' : 'Item adicionado!'); onSaved(); }
    else { toast.error('Erro: ' + error.message); }
    setSaving(false);
  }

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">{editing ? 'Editar Item' : 'Adicionar Item de Peso'}</h3>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Descrição *</label>
          <input className="ctm-input w-full" placeholder="Ex: Piloto, Passageiro dianteiro, Bagagem" value={form.descricao} onChange={e => f('descricao', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Categoria</label>
          <input className="ctm-input w-full" placeholder="Ex: Tripulação, Passageiros, Carga" value={form.categoria} onChange={e => f('categoria', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Peso (kg) *</label>
          <input type="number" step="0.01" className="ctm-input w-full" placeholder="Ex: 85.0" value={form.peso_sem_combustivel} onChange={e => f('peso_sem_combustivel', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Braço / Posição (m) *</label>
          <input type="number" step="0.001" className="ctm-input w-full" placeholder="Ex: 2.120" value={form.braco_posicao} onChange={e => f('braco_posicao', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Momento calculado</label>
          <div className="ctm-input bg-secondary text-muted-foreground">{momento.toFixed(3)}</div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="incluir"
            checked={form.incluir_no_calculo}
            onChange={e => f('incluir_no_calculo', e.target.checked)}
            className="h-4 w-4 rounded border-border text-ctm-teal"
          />
          <label htmlFor="incluir" className="text-sm">Incluir no cálculo de CG</label>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Observação</label>
          <input className="ctm-input w-full" value={form.observacao} onChange={e => f('observacao', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {editing ? 'Atualizar' : 'Adicionar'}
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
