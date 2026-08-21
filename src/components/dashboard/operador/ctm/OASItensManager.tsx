import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Receipt, Save, Trash2, Wrench, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;
const money = (value: any) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numberValue = (value: string) => Number(String(value).replace(',', '.')) || 0;
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type Cotista = { cliente_id: string; nome: string; percentual: number };
type Service = { id: string; oficina_nome: string | null; os_oficina: string | null; descricao: string; valor: number; numero_nota_fiscal: string | null; data_servico: string | null; tipo_rateio?: string | null };
type Piece = { id: string; descricao: string; fornecedor: string | null; quantidade: number; valor_total: number; numero_nota_fiscal: string | null; data_compra: string | null };
type Rateio = { id: string; item_tipo: string; servico_id: string | null; peca_id: string | null; cliente_id: string; tipo_rateio: string; percentual: number; valor: number; nome?: string };
type ServiceDraft = { key: string; oficina_nome: string; os_oficina: string; descricao: string; valor: string; numero_nota_fiscal: string; data_servico: string; tipo_rateio: 'cota' | 'uso' };

const blankService = (): ServiceDraft => ({ key: newKey(), oficina_nome: '', os_oficina: '', descricao: '', valor: '', numero_nota_fiscal: '', data_servico: '', tipo_rateio: 'cota' });

export function OASItensManager({ oasId, aircraftId, onChanged }: { oasId: string; aircraftId: string; onChanged?: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [rateios, setRateios] = useState<Rateio[]>([]);
  const [cotistas, setCotistas] = useState<Cotista[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openForm, setOpenForm] = useState<'servico' | 'peca' | null>(null);
  const [serviceLines, setServiceLines] = useState<ServiceDraft[]>([blankService()]);
  const [pieceForm, setPieceForm] = useState({ descricao: '', fornecedor: '', quantidade: '1', valor_total: '', numero_nota_fiscal: '', data_compra: '' });
  const [rateioDrafts, setRateioDrafts] = useState<Record<string, Record<string, string>>>({});

  async function load() {
    setLoading(true);
    const [{ data: serviceRows }, { data: pieceRows }, { data: rateioRows }, { data: cotistaRows }] = await Promise.all([
      db.from('ctm_oas_servicos').select('*').eq('ordem_servico_id', oasId).order('criado_em', { ascending: false }),
      db.from('ctm_pecas_trocadas').select('*').eq('ordem_servico_id', oasId).order('criado_em', { ascending: false }),
      db.from('ctm_oas_item_rateios').select('*').eq('ordem_servico_id', oasId),
      db.from('cotistas_aeronave').select('id_clientes, percentual_sociedade, clientes(id, razao_social), socios(id, nome)').eq('id_aeronave', aircraftId),
    ]);
    const cotistaList = (cotistaRows ?? []).filter((row: any) => row.id_clientes).map((row: any) => ({ cliente_id: row.id_clientes, nome: row.socios?.nome || row.clientes?.razao_social || 'Cotista', percentual: Number(row.percentual_sociedade) || 0 }));
    const names = new Map(cotistaList.map((cotista) => [cotista.cliente_id, cotista.nome]));
    setCotistas(cotistaList);
    setServices(serviceRows ?? []);
    setPieces(pieceRows ?? []);
    setRateios((rateioRows ?? []).map((row: Rateio) => ({ ...row, nome: names.get(row.cliente_id) })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [oasId, aircraftId]);

  const totalServices = useMemo(() => services.reduce((sum, item) => sum + Number(item.valor || 0), 0), [services]);
  const totalPieces = useMemo(() => pieces.reduce((sum, item) => sum + Number(item.valor_total || 0), 0), [pieces]);

  function beginForm(kind: 'servico' | 'peca') {
    setOpenForm(kind);
    if (kind === 'servico') {
      const first = serviceLines[0]?.key || newKey();
      if (serviceLines.length === 0) setServiceLines([blankService()]);
      setRateioDrafts((current) => ({ ...current, [first]: Object.fromEntries(cotistas.map((cotista) => [cotista.cliente_id, String(cotista.percentual || 0)])) }));
    }
  }

  function addServiceLine() {
    const line = blankService();
    setServiceLines((current) => [...current, line]);
    setRateioDrafts((current) => ({ ...current, [line.key]: Object.fromEntries(cotistas.map((cotista) => [cotista.cliente_id, String(cotista.percentual || 0)])) }));
  }

  function updateLine(key: string, patch: Partial<ServiceDraft>) { setServiceLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line)); }
  function removeLine(key: string) { setServiceLines((current) => current.length === 1 ? current : current.filter((line) => line.key !== key)); }
  function percentTotal(key: string) { return Object.values(rateioDrafts[key] || {}).reduce((sum, value) => sum + numberValue(value), 0); }

  async function saveServices() {
    const validLines = serviceLines.filter((line) => line.descricao.trim());
    if (validLines.length === 0 || validLines.some((line) => numberValue(line.valor) < 0)) { toast.error('Informe a descrição e o valor de cada serviço.'); return; }
    if (cotistas.length > 0 && validLines.some((line) => Math.abs(percentTotal(line.key) - 100) > 0.01)) { toast.error('Cada serviço precisa ter seu rateio totalizando 100%.'); return; }
    setSaving(true);
    for (const line of validLines) {
      const { data: item, error } = await db.from('ctm_oas_servicos').insert({ ordem_servico_id: oasId, oficina_nome: line.oficina_nome || null, os_oficina: line.os_oficina || null, descricao: line.descricao.trim(), valor: numberValue(line.valor), numero_nota_fiscal: line.numero_nota_fiscal || null, data_servico: line.data_servico || null }).select('*').single();
      if (error || !item) { toast.error('Não foi possível salvar um dos serviços: ' + (error?.message || 'erro desconhecido')); setSaving(false); return; }
      if (cotistas.length > 0) {
        const rows = cotistas.map((cotista) => ({ ordem_servico_id: oasId, item_tipo: 'servico', servico_id: item.id, cliente_id: cotista.cliente_id, tipo_rateio: line.tipo_rateio, percentual: numberValue(rateioDrafts[line.key]?.[cotista.cliente_id] || '0'), valor: numberValue(line.valor) * numberValue(rateioDrafts[line.key]?.[cotista.cliente_id] || '0') / 100 }));
        const { error: rateioError } = await db.from('ctm_oas_item_rateios').insert(rows);
        if (rateioError) toast.warning('Serviço salvo, mas seu rateio não pôde ser gravado: ' + rateioError.message);
      }
    }
    toast.success(`${validLines.length} serviço(s) registrado(s) na OAS.`);
    setOpenForm(null); setServiceLines([blankService()]); setRateioDrafts({}); await load(); onChanged?.(); setSaving(false);
  }

  async function savePiece() {
    const value = numberValue(pieceForm.valor_total);
    if (!pieceForm.descricao.trim() || value < 0) { toast.error('Informe a descrição e um valor válido para a peça.'); return; }
    setSaving(true);
    const { data: item, error } = await db.from('ctm_pecas_trocadas').insert({ ordem_servico_id: oasId, descricao: pieceForm.descricao.trim(), fornecedor: pieceForm.fornecedor || null, quantidade: numberValue(pieceForm.quantidade) || 1, valor_total: value, numero_nota_fiscal: pieceForm.numero_nota_fiscal || null, data_compra: pieceForm.data_compra || null }).select('*').single();
    if (error || !item) { toast.error('Não foi possível salvar a peça: ' + (error?.message || 'erro desconhecido')); setSaving(false); return; }
    const defaultRateio = Object.fromEntries(cotistas.map((cotista) => [cotista.cliente_id, String(cotista.percentual || 0)]));
    if (cotistas.length > 0) {
      const rows = cotistas.map((cotista) => ({ ordem_servico_id: oasId, item_tipo: 'peca', peca_id: item.id, cliente_id: cotista.cliente_id, tipo_rateio: 'cota', percentual: numberValue(defaultRateio[cotista.cliente_id] || '0'), valor: value * numberValue(defaultRateio[cotista.cliente_id] || '0') / 100 }));
      await db.from('ctm_oas_item_rateios').insert(rows);
    }
    toast.success('Peça registrada na OAS.'); setOpenForm(null); setPieceForm({ descricao: '', fornecedor: '', quantidade: '1', valor_total: '', numero_nota_fiscal: '', data_compra: '' }); await load(); onChanged?.(); setSaving(false);
  }

  function itemRateios(itemTipo: 'servico' | 'peca', itemId: string) { return rateios.filter((row) => row.item_tipo === itemTipo && (itemTipo === 'servico' ? row.servico_id === itemId : row.peca_id === itemId)); }

  if (loading) return <div className="ctm-card p-5 text-sm text-muted-foreground">Carregando histórico da OAS…</div>;

  return <div className="space-y-5">
    <div className="ctm-card overflow-hidden border-cyan-400/15 bg-gradient-to-br from-slate-900/80 via-slate-950/70 to-cyan-950/10">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"><Receipt className="h-4 w-4" /> Histórico financeiro da OAS</div><h3 className="text-lg font-bold text-slate-100">Serviços e peças realizados</h3><p className="mt-1 text-xs text-slate-400">Registre cada linha da OAS 19 com oficina, OS, período, valor e nota fiscal.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => beginForm('servico')} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-200"><Wrench className="h-3.5 w-3.5" /> Adicionar serviços</button><button onClick={() => beginForm('peca')} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3.5 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20"><Plus className="h-3.5 w-3.5" /> Nova peça</button></div>
      </div>
      <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3"><Summary label="Serviços / mão de obra" value={totalServices} icon={<Wrench className="h-4 w-4" />} /><Summary label="Peças" value={totalPieces} icon={<Plus className="h-4 w-4" />} /><Summary label="Total da OAS" value={totalServices + totalPieces} icon={<FileText className="h-4 w-4" />} strong /></div>
    </div>

    {openForm === 'servico' && <div className="ctm-card border-cyan-300/20 p-5"><div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold text-slate-100">Serviços realizados nesta OAS</h4><p className="mt-1 text-xs text-slate-400">Adicione uma linha para cada serviço, mesmo quando houver oficinas ou notas fiscais diferentes.</p></div><button onClick={() => setOpenForm(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div><div className="space-y-4">{serviceLines.map((line, index) => <div key={line.key} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-cyan-200">Serviço {index + 1}</p><button onClick={() => removeLine(line.key)} disabled={serviceLines.length === 1} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-400/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Oficina"><input className="ctm-input w-full" value={line.oficina_nome} onChange={(e) => updateLine(line.key, { oficina_nome: e.target.value })} placeholder="NEW WAY" /></Field><Field label="Nº da OS da oficina"><input className="ctm-input w-full" value={line.os_oficina} onChange={(e) => updateLine(line.key, { os_oficina: e.target.value })} placeholder="OS-0001" /></Field><Field label="Período"><input className="ctm-input w-full" value={line.tipo_rateio === 'uso' ? 'Por uso' : 'Cota aeronave'} readOnly /></Field><Field label="Nº da nota fiscal"><input className="ctm-input w-full" value={line.numero_nota_fiscal} onChange={(e) => updateLine(line.key, { numero_nota_fiscal: e.target.value })} placeholder="NFE 825" /></Field><Field label="Descrição do serviço" wide><textarea className="ctm-input min-h-20 w-full resize-y" value={line.descricao} onChange={(e) => updateLine(line.key, { descricao: e.target.value })} placeholder="M.O. - SERVIÇO DE INSTALAÇÃO..." /></Field><Field label="Valor"><input className="ctm-input w-full" inputMode="decimal" value={line.valor} onChange={(e) => updateLine(line.key, { valor: e.target.value })} placeholder="420,00" /></Field><Field label="Data do serviço"><input type="date" className="ctm-input w-full" value={line.data_servico} onChange={(e) => updateLine(line.key, { data_servico: e.target.value })} /></Field><Field label="Base do rateio"><select className="ctm-input w-full" value={line.tipo_rateio} onChange={(e) => updateLine(line.key, { tipo_rateio: e.target.value as 'cota' | 'uso' })}><option value="cota">Cota da aeronave</option><option value="uso">Percentual por uso</option></select></Field></div><div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rateio do serviço {index + 1}</p><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${Math.abs(percentTotal(line.key) - 100) < 0.01 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>{percentTotal(line.key).toFixed(2)}%</span></div>{cotistas.length === 0 ? <p className="text-xs text-slate-400">Nenhum cotista com cliente vinculado foi encontrado.</p> : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{cotistas.map((cotista) => <label key={cotista.cliente_id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2"><span className="min-w-0 truncate text-xs text-slate-200">{cotista.nome}</span><span className="flex items-center gap-1"><input className="ctm-input h-8 w-20 text-right" inputMode="decimal" value={rateioDrafts[line.key]?.[cotista.cliente_id] || '0'} onChange={(e) => setRateioDrafts((current) => ({ ...current, [line.key]: { ...(current[line.key] || {}), [cotista.cliente_id]: e.target.value } }))} /><span className="text-xs text-slate-400">%</span></span></label>)}</div>}</div></div>)}</div><div className="mt-4 flex flex-wrap justify-between gap-3"><button onClick={addServiceLine} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/5 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/10"><Plus className="h-4 w-4" /> Adicionar outra linha</button><button disabled={saving} onClick={saveServices} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar serviços'}</button></div></div>}

    {openForm === 'peca' && <div className="ctm-card border-cyan-300/20 p-5"><div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold text-slate-100">Adicionar peça comprada/aplicada</h4><p className="mt-1 text-xs text-slate-400">A peça também será somada ao total e ao histórico da OAS.</p></div><button onClick={() => setOpenForm(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Descrição da peça" wide><input className="ctm-input w-full" value={pieceForm.descricao} onChange={(e) => setPieceForm({ ...pieceForm, descricao: e.target.value })} placeholder="Filtro, pneu, componente…" /></Field><Field label="Fornecedor"><input className="ctm-input w-full" value={pieceForm.fornecedor} onChange={(e) => setPieceForm({ ...pieceForm, fornecedor: e.target.value })} placeholder="Fornecedor" /></Field><Field label="Quantidade"><input className="ctm-input w-full" inputMode="decimal" value={pieceForm.quantidade} onChange={(e) => setPieceForm({ ...pieceForm, quantidade: e.target.value })} /></Field><Field label="Valor total"><input className="ctm-input w-full" inputMode="decimal" value={pieceForm.valor_total} onChange={(e) => setPieceForm({ ...pieceForm, valor_total: e.target.value })} placeholder="0,00" /></Field><Field label="Nº da nota fiscal"><input className="ctm-input w-full" value={pieceForm.numero_nota_fiscal} onChange={(e) => setPieceForm({ ...pieceForm, numero_nota_fiscal: e.target.value })} placeholder="NF da peça" /></Field><Field label="Data da compra"><input type="date" className="ctm-input w-full" value={pieceForm.data_compra} onChange={(e) => setPieceForm({ ...pieceForm, data_compra: e.target.value })} /></Field></div><div className="mt-4 flex justify-end"><button disabled={saving} onClick={savePiece} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar peça'}</button></div></div>}

    <ItemSection title="Serviços realizados" icon={<Wrench className="h-4 w-4" />} empty="Nenhum serviço detalhado registrado nesta OAS.">{services.map((item) => <ItemCard key={item.id} title={item.descricao} meta={[item.oficina_nome, item.os_oficina && `OS ${item.os_oficina}`, item.numero_nota_fiscal && `NF ${item.numero_nota_fiscal}`, item.data_servico && new Date(`${item.data_servico}T12:00:00`).toLocaleDateString('pt-BR')].filter(Boolean).join(' · ')} value={item.valor} rateios={itemRateios('servico', item.id)} />)}</ItemSection>
    <ItemSection title="Peças compradas e aplicadas" icon={<Plus className="h-4 w-4" />} empty="Nenhuma peça detalhada registrada nesta OAS.">{pieces.map((item) => <ItemCard key={item.id} title={item.descricao} meta={[item.fornecedor, `Qtd ${item.quantidade}`, item.numero_nota_fiscal && `NF ${item.numero_nota_fiscal}`, item.data_compra && new Date(`${item.data_compra}T12:00:00`).toLocaleDateString('pt-BR')].filter(Boolean).join(' · ')} value={item.valor_total} rateios={itemRateios('peca', item.id)} />)}</ItemSection>
  </div>;
}

function Summary({ label, value, icon, strong = false }: { label: string; value: number; icon: React.ReactNode; strong?: boolean }) { return <div className={`bg-slate-950/45 p-4 ${strong ? 'sm:bg-cyan-950/20' : ''}`}><div className="flex items-center gap-2 text-xs font-semibold text-slate-400">{icon}{label}</div><p className={`mt-2 text-xl font-bold ${strong ? 'text-cyan-200' : 'text-slate-100'}`}>{money(value)}</p></div>; }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={wide ? 'sm:col-span-2 lg:col-span-2' : ''}><span className="mb-1 block text-xs font-semibold text-slate-300">{label}</span>{children}</label>; }
function ItemSection({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string; children: React.ReactNode }) { const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children); return <section className="ctm-card overflow-hidden"><div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 py-4"><h3 className="flex items-center gap-2 font-bold text-slate-100">{icon}<span>{title}</span></h3></div><div className="space-y-3 p-4">{hasItems ? children : <p className="py-4 text-sm text-slate-400">{empty}</p>}</div></section>; }
function ItemCard({ title, meta, value, rateios }: { title: string; meta: string; value: number; rateios: Rateio[] }) { return <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/20 hover:bg-cyan-950/10"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h4 className="font-semibold text-slate-100">{title}</h4><p className="mt-1 text-xs text-slate-400">{meta || 'Sem informações complementares'}</p></div><p className="shrink-0 text-base font-bold text-cyan-200">{money(value)}</p></div>{rateios.length > 0 && <div className="mt-4 border-t border-white/10 pt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Rateio deste lançamento</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{rateios.map((row) => <div key={row.id} className="flex items-center justify-between rounded-lg bg-white/[0.035] px-3 py-2 text-xs"><span className="truncate pr-2 text-slate-300">{row.nome || `Cotista ${row.cliente_id.slice(0, 6)}`}</span><span className="font-semibold text-cyan-200">{Number(row.percentual || 0).toFixed(2)}% · {money(row.valor)}</span></div>)}</div></div>}</article>; }
