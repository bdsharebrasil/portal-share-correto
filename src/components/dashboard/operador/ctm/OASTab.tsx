import { useEffect, useState } from 'react';
import { FileText, Plus, Eye, Calendar, Clock, ChevronRight, Paperclip, X, Save, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OASTabProps { aircraftId: string; }

export function OASTab({ aircraftId }: OASTabProps) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function loadOAS() {
    const { data, error } = await supabase
      .from('ctm_ordem_acompanhamento_servico')
      .select(`*, ctm_aprovacoes_ordem_servico(id, status, submetido_em, revisado_em, motivo_rejeicao)`)
      .eq('aeronave_id', aircraftId)
      .order('created_at', { ascending: false });
    console.log('OAS:', data, error);
    if (data) setList(data);
    setLoading(false);
  }

  useEffect(() => { loadOAS(); }, [aircraftId]);

  if (loading) return <LoadingSpinner />;
  if (selected) return <OASDetail oas={selected} onBack={() => { setSelected(null); loadOAS(); }} aircraftId={aircraftId} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="section-accent">
          <h2 className="text-lg font-semibold">Ordens de Acompanhamento de Serviço</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-ctm-teal text-[hsl(var(--ctm-navy))] font-semibold rounded-lg hover:bg-ctm-teal-light transition-colors text-sm"
        >
          <Plus className="h-4 w-4" /> Nova OAS
        </button>
      </div>

      {showForm && (
        <NovaOASForm aircraftId={aircraftId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); loadOAS(); }} />
      )}

      {list.length === 0 && !showForm ? (
        <EmptySection icon={FileText} text="Nenhuma OAS registrada" />
      ) : (
        <div className="space-y-3">
          {list.map(oas => {
            const totalServicos = oas.total_mao_obra ?? 0;
            const totalPecas = oas.total_pecas ?? 0;
            const total = (oas.total_geral ?? (totalServicos + totalPecas)) as number;
            const aprovacao = oas.ctm_aprovacoes_ordem_servico?.[0];
            return (
              <div key={oas.id} onClick={() => setSelected(oas)} className="ctm-card-hover p-5 group">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--ctm-teal)/0.1)] border border-[hsl(var(--ctm-teal)/0.2)] shrink-0">
                    <span className="text-sm font-bold teal-text">#{oas.numero}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{oas.tipo_manutencao || 'Manutenção'}</p>
                      {oas.periodo && <span className="badge-teal">{oas.periodo}</span>}
                      <OASStatusBadge status={oas.status} aprovStatus={aprovacao?.status || oas.status_aprovacao} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      {oas.data_entrada && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(oas.data_entrada)}</span>}
                      {oas.data_saida && <span>→ {formatDate(oas.data_saida)}</span>}
                      {oas.mecanico_responsavel && <span>Mecânico: {oas.mecanico_responsavel}</span>}
                      {oas.oficina_nome && <span>Oficina: {oas.oficina_nome}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-white">
                      {total > 0 ? `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </p>
                    {total > 0 && (
                      <p className="text-xs text-muted-foreground">
                        MO: {totalServicos.toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'BRL' })}
                      </p>
                    )}
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

// ── Nova OAS Form ────────────────────────────────────────────────────────────
function NovaOASForm({ aircraftId, onClose, onSaved }: {
  aircraftId: string; onClose: () => void; onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo_manutencao: 'CORRETIVA', periodo: '', periodo_inicio: '', periodo_fim: '',
    tipo_rateio: 'horas', oficina_nome: '',
    data_entrada: '', data_saida: '', mecanico_responsavel: '', objetivo: '', observacoes: '',
  });

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

    const { error } = await supabase.from('ctm_ordem_acompanhamento_servico').insert({
      aeronave_id: aircraftId,
      numero: nextNum,
      tipo_manutencao: form.tipo_manutencao,
      periodo: form.periodo,
      periodo_inicio: form.periodo_inicio || null,
      periodo_fim: form.periodo_fim || null,
      tipo_rateio: form.tipo_rateio || null,
      oficina_nome: form.oficina_nome || null,
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
function OASDetail({ oas, onBack, aircraftId }: { oas: any; onBack: () => void; aircraftId: string }) {
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

  const totalServicos = oas.total_mao_obra ?? (execucoes.reduce((s: number, i: any) => s + Number(i.valor || 0), 0) as number);
  const totalPecas = oas.total_pecas ?? (pecas.reduce((s: number, i: any) => s + Number(i.valor_total || 0), 0) as number);
  const aprovacao = oas.ctm_aprovacoes_ordem_servico?.[0];

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
              </div>
              <OASStatusBadge status={oas.status} aprovStatus={aprovacao?.status || oas.status_aprovacao} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <InfoItem label="Oficina" value={oas.oficina_nome || '—'} />
              <InfoItem label="Entrada" value={formatDate(oas.data_entrada)} />
              <InfoItem label="Saída" value={formatDate(oas.data_saida)} />
              <InfoItem label="Rateio" value={oas.tipo_rateio || '—'} />
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

          {/* Approval */}
          {aprovacao && (
            <div className="ctm-card p-5">
              <h3 className="font-semibold mb-3 teal-text">Aprovação</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={aprovacao.status === 'approved' ? 'text-emerald-400' : aprovacao.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'}>
                    {aprovacao.status === 'approved' ? 'Aprovado' : aprovacao.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                  </span>
                </div>
                {aprovacao.submetido_em && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Submetido</span>
                    <span>{formatDate(aprovacao.submetido_em)}</span>
                  </div>
                )}
                {aprovacao.revisado_em && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revisado</span>
                    <span>{formatDate(aprovacao.revisado_em)}</span>
                  </div>
                )}
                {aprovacao.motivo_rejeicao && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-red-400">{aprovacao.motivo_rejeicao}</p>
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
