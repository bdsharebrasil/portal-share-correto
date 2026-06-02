import { useEffect, useState } from 'react';
import { Package, Plus, ChevronRight, Users, Check, X, Save, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OrcamentosTabProps { aircraftId: string; }

export function OrcamentosTab({ aircraftId }: OrcamentosTabProps) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function loadOrcamentos() {
    const { data, error } = await supabase
      .from('ctm_orcamentos')
      .select(`
        *,
        ctm_itens_orcamento(*),
        ctm_aprovacoes_ordem_servico(id, status, submetido_em, revisado_em, motivo_rejeicao)
      `)
      .eq('aeronave_id', aircraftId)
      .order('criado_em', { ascending: false });
    console.log('Orcamentos:', data, error);
    if (data) setList(data);
    setLoading(false);
  }

  useEffect(() => { loadOrcamentos(); }, [aircraftId]);

  if (loading) return <LoadingSpinner />;

  if (selected) {
    return (
      <OrcamentoDetail
        orcamento={selected}
        onBack={() => setSelected(null)}
        aircraftId={aircraftId}
        onRefresh={loadOrcamentos}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold">Orçamentos (OA)</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm"
        >
          <Plus className="h-4 w-4" /> Novo Orçamento
        </button>
      </div>

      {showForm && (
        <NovoOrcamentoForm
          aircraftId={aircraftId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadOrcamentos(); }}
        />
      )}

      {list.length === 0 && !showForm ? (
        <EmptySection icon={Package} text="Nenhum orçamento registrado" />
      ) : (
        <div className="space-y-3">
          {list.map(orc => {
            const items = orc.ctm_itens_orcamento || [];
            const total = orc.valor_total || items.reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0);
            const aprovacao = orc.ctm_aprovacoes_ordem_servico?.[0];
            return (
              <div key={orc.id} onClick={() => setSelected(orc)} className="ctm-card-hover p-5 group">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--ctm-teal)/0.1)] border border-[hsl(var(--ctm-teal)/0.2)] shrink-0">
                    <span className="text-xs font-bold teal-text">#{orc.numero_orcamento}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{orc.descricao || 'Orçamento'}</p>
                      <AprovBadge status={orc.status_aprovacao || aprovacao?.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {orc.nome_fornecedor || 'Fornecedor não informado'} · {items.length} item(s)
                      {orc.submetido_em && ` · ${new Date(orc.submetido_em).toLocaleDateString('pt-BR')}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-white">
                      R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

// ── Novo Orçamento Form ──────────────────────────────────────────────────────
function NovoOrcamentoForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ descricao: '', nome_fornecedor: '', tipo_fornecedor: 'serviço', notas: '' });
  const [items, setItems] = useState([{ descricao: '', quantidade: 1, valor_unitario: 0 }]);

  function addItem() {
    setItems(prev => [...prev, { descricao: '', quantidade: 1, valor_unitario: 0 }]);
  }

  function updateItem(idx: number, field: string, value: any) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((s, i) => s + (Number(i.quantidade) * Number(i.valor_unitario)), 0);

  async function save() {
    if (!form.descricao) { toast.error('Informe a descrição'); return; }
    setSaving(true);

    const { data: orcData, error: orcErr } = await supabase
      .from('ctm_orcamentos')
      .insert({
        aeronave_id: aircraftId,
        descricao: form.descricao,
        nome_fornecedor: form.nome_fornecedor,
        tipo_fornecedor: form.tipo_fornecedor,
        notas: form.notas,
        valor_total: total,
        status: 'draft',
        status_aprovacao: 'pendente',
        submetido_em: new Date().toISOString(),
      })
      .select()
      .single();

    if (orcErr || !orcData) {
      toast.error('Erro ao criar orçamento: ' + orcErr?.message);
      setSaving(false);
      return;
    }

    // Insert items
    const validItems = items.filter(i => i.descricao.trim());
    if (validItems.length > 0) {
      const { error: itemsErr } = await supabase.from('ctm_itens_orcamento').insert(
        validItems.map((it, idx) => ({
          servico_id: orcData.id,
          ordenacao: idx + 1,
          descricao: it.descricao,
          quantidade: Number(it.quantidade),
          valor_unitario: Number(it.valor_unitario),
          subtotal: Number(it.quantidade) * Number(it.valor_unitario),
        }))
      );
      if (itemsErr) console.error('Items error:', itemsErr);
    }

    toast.success('Orçamento criado com sucesso!');
    onSaved();
  }

  return (
    <div className="ctm-card p-5 mb-6 border-[hsl(var(--ctm-teal)/0.3)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold teal-text">Novo Orçamento</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Descrição *</label>
          <input
            className="ctm-input w-full"
            placeholder="Ex: Revisão 50h Motor LH"
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Fornecedor</label>
          <input
            className="ctm-input w-full"
            placeholder="Nome do fornecedor"
            value={form.nome_fornecedor}
            onChange={e => setForm(f => ({ ...f, nome_fornecedor: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
          <select
            className="ctm-input w-full"
            value={form.tipo_fornecedor}
            onChange={e => setForm(f => ({ ...f, tipo_fornecedor: e.target.value }))}
          >
            <option value="serviço">Serviço (Mão de Obra)</option>
            <option value="peça">Peça</option>
            <option value="misto">Misto</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Observações</label>
          <textarea
            className="ctm-input w-full h-16 resize-none"
            placeholder="Notas adicionais..."
            value={form.notas}
            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
          />
        </div>
      </div>

      {/* Items */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens</label>
          <button onClick={addItem} className="text-xs teal-text hover:underline flex items-center gap-1">
            <Plus className="h-3 w-3" /> Adicionar item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="ctm-input flex-1"
                placeholder="Descrição"
                value={item.descricao}
                onChange={e => updateItem(idx, 'descricao', e.target.value)}
              />
              <input
                type="number"
                min="1"
                className="ctm-input w-20 text-right"
                placeholder="Qtd"
                value={item.quantidade}
                onChange={e => updateItem(idx, 'quantidade', e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="ctm-input w-32 text-right"
                placeholder="Valor unit."
                value={item.valor_unitario}
                onChange={e => updateItem(idx, 'valor_unitario', e.target.value)}
              />
              <span className="text-sm font-medium w-28 text-right shrink-0">
                R$ {(Number(item.quantidade) * Number(item.valor_unitario)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              {items.length > 1 && (
                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 shrink-0">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3 pt-3 border-t border-border">
          <span className="font-bold teal-text">
            Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg text-sm disabled:opacity-50 hover:bg-ctm-teal-light transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Orçamento
        </button>
      </div>
    </div>
  );
}

// ── Detail View ──────────────────────────────────────────────────────────────
function OrcamentoDetail({ orcamento, onBack, aircraftId, onRefresh }: {
  orcamento: any; onBack: () => void; aircraftId: string; onRefresh: () => void;
}) {
  const [cotistas, setCotistas] = useState<any[]>([]);
  const [splitType, setSplitType] = useState<'horas' | 'igual'>('igual');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [horasVoadas, setHorasVoadas] = useState<Record<string, number>>({});
  const [splitResult, setSplitResult] = useState<Record<string, { valor: number; percentual: number }>>({});
  const [saving, setSaving] = useState(false);
  const [approvando, setApprovando] = useState(false);

  const items = orcamento.ctm_itens_orcamento || [];
  const total = orcamento.valor_total || items.reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0);

  useEffect(() => {
    supabase
      .from('cotistas_aeronave')
      .select('*, clientes(id, proprietario, razao_social, cnpj)')
      .eq('id_aeronave', aircraftId)
      .then(({ data }) => {
        if (data) setCotistas(data);
      });
  }, [aircraftId]);

  async function calcSplitByHours() {
    if (!periodoInicio || !periodoFim) {
      toast.error('Selecione o período para calcular por horas');
      return;
    }

    const { data: logs } = await supabase
      .from('lancamentos_diario_bordo')
      .select('clientes_id, horas_totais, tempo_total, natureza_voo')
      .eq('aeronave_id', aircraftId)
      .gte('data_registro', periodoInicio)
      .lte('data_registro', periodoFim);

    const horasPorCliente: Record<string, number> = {};
    let horasTeste = 0;

    (logs || []).forEach(e => {
      const h = Number(e.horas_totais || e.tempo_total || 0);
      const natureza = (e.natureza_voo || '').toUpperCase();
      if (natureza.includes('TESTE') || natureza.includes('TRANSLADO')) {
        horasTeste += h;
      } else if (e.clientes_id) {
        horasPorCliente[e.clientes_id] = (horasPorCliente[e.clientes_id] || 0) + h;
      }
    });

    const horasTestePorSocio = cotistas.length > 0 ? horasTeste / cotistas.length : 0;
    const totalH = Object.values(horasPorCliente).reduce((a, b) => a + b, 0) + horasTeste;

    const result: Record<string, { valor: number; percentual: number }> = {};
    cotistas.forEach(c => {
      const cliente = c.clientes;
      if (!cliente) return;
      const h = (horasPorCliente[cliente.id] || 0) + horasTestePorSocio;
      const pct = totalH > 0 ? (h / totalH) * 100 : 0;
      result[cliente.id] = { valor: total * (pct / 100), percentual: pct };
    });
    setSplitResult(result);
    setHorasVoadas(horasPorCliente);
  }

  function calcSplitIgual() {
    const result: Record<string, { valor: number; percentual: number }> = {};
    cotistas.forEach(c => {
      const cliente = c.clientes;
      if (!cliente) return;
      const pct = cotistas.length > 0 ? 100 / cotistas.length : 0;
      result[cliente.id] = { valor: total * (pct / 100), percentual: pct };
    });
    setSplitResult(result);
  }

  async function aprovar(acao: 'approved' | 'rejected') {
    setApprovando(true);
    const { error } = await supabase
      .from('ctm_aprovacoes_ordem_servico')
      .upsert({
        ordem_servico_id: orcamento.id,
        nivel_aprovacao: 1,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        acao,
        data_acao: new Date().toISOString(),
      });

    if (!error) {
      await supabase.from('ctm_orcamentos').update({
        status_aprovacao: acao === 'approved' ? 'aprovado' : 'rejeitado',
        aprovado_em: acao === 'approved' ? new Date().toISOString() : null,
      }).eq('id', orcamento.id);
      toast.success(acao === 'approved' ? 'Orçamento aprovado!' : 'Orçamento rejeitado!');
      onRefresh();
      onBack();
    } else {
      toast.error('Erro ao processar aprovação');
    }
    setApprovando(false);
  }

  async function saveSplitData() {
    if (Object.keys(splitResult).length === 0) { toast.error('Calcule o rateio antes de salvar'); return; }
    setSaving(true);

    const splitData = cotistas.map(c => {
      const cliente = c.clientes;
      if (!cliente) return null;
      const res = splitResult[cliente.id];
      return {
        cliente_id: cliente.id,
        nome: cliente.proprietario || cliente.razao_social,
        percentual: res?.percentual || 0,
        valor: res?.valor || 0,
        horas: horasVoadas[cliente.id] || 0,
        tipo_rateio: splitType,
      };
    }).filter(Boolean);

    const { error } = await supabase.from('ctm_orcamentos').update({
      itens_orcamento: splitData,
      detalhes_orcamento: { tipo_rateio: splitType, periodo_inicio: periodoInicio, periodo_fim: periodoFim },
    }).eq('id', orcamento.id);

    if (!error) toast.success('Rateio salvo com sucesso!');
    else toast.error('Erro ao salvar rateio');
    setSaving(false);
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        ← Voltar para lista
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          <div className="ctm-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">OA #{orcamento.numero_orcamento}</h2>
                <p className="text-muted-foreground">{orcamento.descricao}</p>
                {orcamento.nome_fornecedor && <p className="text-sm text-muted-foreground mt-1">Fornecedor: {orcamento.nome_fornecedor}</p>}
              </div>
              <AprovBadge status={orcamento.status_aprovacao} />
            </div>

            {items.length > 0 ? (
              <div className="space-y-2">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantidade} × R$ {Number(item.valor_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        {item.modelo && ` · ${item.modelo}`}
                        {item.numero_serie && ` · S/N: ${item.numero_serie}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold ml-4">R$ {Number(item.subtotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
                <div className="pt-3 border-t border-border flex justify-between font-bold">
                  <span>Total</span>
                  <span className="teal-text">R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhum item registrado</p>
            )}
          </div>

          {/* Rateio Widget */}
          {cotistas.length > 0 && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 teal-text" /> Rateio entre Sócios
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Defina como o custo de R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} será dividido.
                O cálculo por horas busca automaticamente o diário de bordo do período selecionado.
              </p>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSplitType('horas')}
                  className={cn('flex-1 py-2 text-sm font-medium rounded-lg border transition-all',
                    splitType === 'horas'
                      ? 'bg-[hsl(var(--ctm-teal)/0.15)] border-[hsl(var(--ctm-teal)/0.4)] teal-text'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  Por Horas Voadas
                </button>
                <button
                  onClick={() => setSplitType('igual')}
                  className={cn('flex-1 py-2 text-sm font-medium rounded-lg border transition-all',
                    splitType === 'igual'
                      ? 'bg-[hsl(var(--ctm-teal)/0.15)] border-[hsl(var(--ctm-teal)/0.4)] teal-text'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  Igualitário
                </button>
              </div>

              {splitType === 'horas' && (
                <div className="flex flex-wrap gap-3 mb-4 p-3 bg-secondary rounded-lg">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Período Início</label>
                    <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} className="ctm-input" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Período Fim</label>
                    <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} className="ctm-input" />
                  </div>
                </div>
              )}

              <button
                onClick={splitType === 'horas' ? calcSplitByHours : calcSplitIgual}
                className="w-full py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm mb-4"
              >
                Calcular Rateio
              </button>

              {Object.keys(splitResult).length > 0 && (
                <div className="space-y-2 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resultado do Rateio</p>
                  {cotistas.map(c => {
                    const cliente = c.clientes;
                    if (!cliente) return null;
                    const res = splitResult[cliente.id] || { valor: 0, percentual: 0 };
                    return (
                      <div key={cliente.id} className="flex items-center justify-between p-3 bg-[hsl(var(--ctm-teal)/0.08)] rounded-lg border border-[hsl(var(--ctm-teal)/0.15)]">
                        <div>
                          <p className="text-sm font-medium">{cliente.proprietario || cliente.razao_social}</p>
                          <p className="text-xs text-muted-foreground">
                            {res.percentual.toFixed(2)}%
                            {horasVoadas[cliente.id] ? ` · ${horasVoadas[cliente.id].toFixed(2)}h voadas` : ''}
                          </p>
                        </div>
                        <p className="text-base font-bold teal-text">
                          R$ {res.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}
                  <button
                    onClick={saveSplitData}
                    disabled={saving}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-secondary text-sm font-medium rounded-lg hover:bg-secondary/80 transition-colors"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Rateio no Orçamento
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="ctm-card p-5">
            <h3 className="font-semibold mb-4 teal-text">Resumo Financeiro</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal itens</span>
                <span>R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-3 border-t border-border flex justify-between font-bold">
                <span>Total</span>
                <span className="teal-text">R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Approval */}
          <div className="ctm-card p-5">
            <h3 className="font-semibold mb-4 teal-text">Aprovação</h3>
            {orcamento.status_aprovacao === 'aprovado' ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <Check className="h-8 w-8 text-emerald-400" />
                <p className="text-sm text-emerald-400 font-medium">Aprovado</p>
                {orcamento.aprovado_em && (
                  <p className="text-xs text-muted-foreground">
                    em {new Date(orcamento.aprovado_em).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            ) : orcamento.status_aprovacao === 'rejeitado' ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <X className="h-8 w-8 text-red-400" />
                <p className="text-sm text-red-400 font-medium">Rejeitado</p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => aprovar('approved')}
                  disabled={approvando}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                >
                  <Check className="h-4 w-4" /> Aprovar
                </button>
                <button
                  onClick={() => aprovar('rejected')}
                  disabled={approvando}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                >
                  <X className="h-4 w-4" /> Rejeitar
                </button>
              </div>
            )}
            {orcamento.notas && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">Notas:</p>
                <p className="text-xs mt-1">{orcamento.notas}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AprovBadge({ status }: { status?: string }) {
  const s = (status || '').toLowerCase();
  if (s.includes('aprovado') || s === 'approved') return <span className="badge-ok">Aprovado</span>;
  if (s.includes('rejeit') || s === 'rejected') return <span className="badge-expired">Rejeitado</span>;
  return <span className="badge-pending">Pendente</span>;
}

function EmptySection({ icon: Icon, text }: { icon: typeof Package; text: string }) {
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
