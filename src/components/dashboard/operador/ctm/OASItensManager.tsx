import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Receipt, Save, Trash2, Wrench, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;
const money = (value: any) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numberValue = (value: string) => Number(String(value).replace(',', '.')) || 0;

type Cotista = { cliente_id: string; nome: string; percentual: number };
type Service = { id: string; oficina_nome: string | null; os_oficina: string | null; descricao: string; valor: number; numero_nota_fiscal: string | null; data_servico: string | null };
type Piece = { id: string; descricao: string; fornecedor: string | null; quantidade: number; valor_total: number; numero_nota_fiscal: string | null; data_compra: string | null };
type Rateio = { id: string; item_tipo: string; servico_id: string | null; peca_id: string | null; cliente_id: string; tipo_rateio: string; percentual: number; valor: number; nome?: string };

export function OASItensManager({ oasId, aircraftId, onChanged }: { oasId: string; aircraftId: string; onChanged?: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [rateios, setRateios] = useState<Rateio[]>([]);
  const [cotistas, setCotistas] = useState<Cotista[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openForm, setOpenForm] = useState<'servico' | 'peca' | null>(null);
  const [serviceForm, setServiceForm] = useState({ oficina_nome: '', os_oficina: '', descricao: '', valor: '', numero_nota_fiscal: '', data_servico: '' });
  const [pieceForm, setPieceForm] = useState({ descricao: '', fornecedor: '', quantidade: '1', valor_total: '', numero_nota_fiscal: '', data_compra: '' });
  const [rateioDraft, setRateioDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [{ data: serviceRows }, { data: pieceRows }, { data: rateioRows }, { data: cotistaRows }] = await Promise.all([
      db.from('ctm_oas_servicos').select('*').eq('ordem_servico_id', oasId).order('criado_em', { ascending: false }),
      db.from('ctm_pecas_trocadas').select('*').eq('ordem_servico_id', oasId).order('criado_em', { ascending: false }),
      db.from('ctm_oas_item_rateios').select('*').eq('ordem_servico_id', oasId),
      db.from('cotistas_aeronave').select('id_clientes, percentual_sociedade, clientes(id, razao_social), socios(id, nome)').eq('id_aeronave', aircraftId),
    ]);
    const cotistaRowsSafe = cotistaRows ?? [];
    const cotistaList = cotistaRowsSafe.filter((row: any) => row.id_clientes).map((row: any) => ({ cliente_id: row.id_clientes, nome: row.socios?.nome || row.clientes?.razao_social || 'Cotista', percentual: Number(row.percentual_sociedade) || 0 }));
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
  const percentTotal = useMemo(() => Object.values(rateioDraft).reduce((sum, value) => sum + numberValue(value), 0), [rateioDraft]);

  function beginForm(kind: 'servico' | 'peca') {
    setOpenForm(kind);
    setRateioDraft(Object.fromEntries(cotistas.map((cotista) => [cotista.cliente_id, String(cotista.percentual || 0)])));
  }

  async function saveItem(kind: 'servico' | 'peca') {
    const value = kind === 'servico' ? numberValue(serviceForm.valor) : numberValue(pieceForm.valor_total);
    const description = kind === 'servico' ? serviceForm.descricao.trim() : pieceForm.descricao.trim();
    if (!description || value < 0) { toast.error('Informe a descrição e um valor válido.'); return; }
    if (cotistas.length > 0 && Math.abs(percentTotal - 100) > 0.01) { toast.error(`O rateio precisa totalizar 100%. Atual: ${percentTotal.toFixed(2)}%.`); return; }
    setSaving(true);
    const payload = kind === 'servico'
      ? { ordem_servico_id: oasId, oficina_nome: serviceForm.oficina_nome || null, os_oficina: serviceForm.os_oficina || null, descricao: description, valor: value, numero_nota_fiscal: serviceForm.numero_nota_fiscal || null, data_servico: serviceForm.data_servico || null }
      : { ordem_servico_id: oasId, descricao: description, fornecedor: pieceForm.fornecedor || null, quantidade: numberValue(pieceForm.quantidade) || 1, valor_total: value, numero_nota_fiscal: pieceForm.numero_nota_fiscal || null, data_compra: pieceForm.data_compra || null };
    const table = kind === 'servico' ? 'ctm_oas_servicos' : 'ctm_pecas_trocadas';
    const { data: item, error } = await db.from(table).insert(payload).select('*').single();
    if (error || !item) { toast.error(`Não foi possível salvar ${kind === 'servico' ? 'o serviço' : 'a peça'}: ${error?.message || 'erro desconhecido'}`); setSaving(false); return; }
    if (cotistas.length > 0) {
      const rows = cotistas.map((cotista) => ({ ordem_servico_id: oasId, item_tipo: kind, servico_id: kind === 'servico' ? item.id : null, peca_id: kind === 'peca' ? item.id : null, cliente_id: cotista.cliente_id, tipo_rateio: 'cota', percentual: numberValue(rateioDraft[cotista.cliente_id] || '0'), valor: value * numberValue(rateioDraft[cotista.cliente_id] || '0') / 100 }));
      const { error: rateioError } = await db.from('ctm_oas_item_rateios').insert(rows);
      if (rateioError) toast.warning('Item salvo, mas o rateio não pôde ser gravado: ' + rateioError.message);
    }
    toast.success(kind === 'servico' ? 'Serviço registrado na OAS.' : 'Peça registrada na OAS.');
    setOpenForm(null);
    setServiceForm({ oficina_nome: '', os_oficina: '', descricao: '', valor: '', numero_nota_fiscal: '', data_servico: '' });
    setPieceForm({ descricao: '', fornecedor: '', quantidade: '1', valor_total: '', numero_nota_fiscal: '', data_compra: '' });
    await load();
    onChanged?.();
    setSaving(false);
  }

  function itemRateios(itemTipo: 'servico' | 'peca', itemId: string) { return rateios.filter((row) => row.item_tipo === itemTipo && (itemTipo === 'servico' ? row.servico_id === itemId : row.peca_id === itemId)); }

  if (loading) return <div className="ctm-card p-5 text-sm text-muted-foreground">Carregando histórico da OAS…</div>;

  return <div className="space-y-5">
    <div className="ctm-card overflow-hidden border-cyan-400/15 bg-gradient-to-br from-slate-900/80 via-slate-950/70 to-cyan-950/10">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"><Receipt className="h-4 w-4" /> Histórico financeiro da OAS</div><h3 className="text-lg font-bold text-slate-100">Serviços e peças realizados</h3><p className="mt-1 text-xs text-slate-400">Cada oficina, nota fiscal e rateio fica registrado separadamente nesta OAS.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => beginForm('servico')} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-200"><Wrench className="h-3.5 w-3.5" /> Novo serviço</button><button onClick={() => beginForm('peca')} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3.5 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20"><Plus className="h-3.5 w-3.5" /> Nova peça</button></div>
      </div>
      <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3"><Summary label="Serviços / mão de obra" value={totalServices} icon={<Wrench className="h-4 w-4" />} /><Summary label="Peças" value={totalPieces} icon={<Plus className="h-4 w-4" />} /><Summary label="Total da OAS" value={totalServices + totalPieces} icon={<FileText className="h-4 w-4" />} strong /></div>
    </div>

    {openForm && <div className="ctm-card border-cyan-300/20 p-5"><div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold text-slate-100">{openForm === 'servico' ? 'Adicionar serviço realizado' : 'Adicionar peça comprada/aplicada'}</h4><p className="mt-1 text-xs text-slate-400">O registro ficará vinculado à OAS e será incluído no total automaticamente.</p></div><button onClick={() => setOpenForm(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div>
      {openForm === 'servico' ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Oficina"><input className="ctm-input w-full" value={serviceForm.oficina_nome} onChange={(e) => setServiceForm({ ...serviceForm, oficina_nome: e.target.value })} placeholder="Nome da oficina" /></Field><Field label="Nº da OS da oficina"><input className="ctm-input w-full" value={serviceForm.os_oficina} onChange={(e) => setServiceForm({ ...serviceForm, os_oficina: e.target.value })} placeholder="OS-0001" /></Field><Field label="Nº da nota fiscal"><input className="ctm-input w-full" value={serviceForm.numero_nota_fiscal} onChange={(e) => setServiceForm({ ...serviceForm, numero_nota_fiscal: e.target.value })} placeholder="NF do serviço" /></Field><Field label="Descrição do serviço" wide><textarea className="ctm-input min-h-20 w-full resize-y" value={serviceForm.descricao} onChange={(e) => setServiceForm({ ...serviceForm, descricao: e.target.value })} placeholder="Descreva o serviço executado" /></Field><Field label="Valor do serviço"><input className="ctm-input w-full" inputMode="decimal" value={serviceForm.valor} onChange={(e) => setServiceForm({ ...serviceForm, valor: e.target.value })} placeholder="0,00" /></Field><Field label="Data do serviço"><input type="date" className="ctm-input w-full" value={serviceForm.data_servico} onChange={(e) => setServiceForm({ ...serviceForm, data_servico: e.target.value })} /></Field></div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Descrição da peça" wide><input className="ctm-input w-full" value={pieceForm.descricao} onChange={(e) => setPieceForm({ ...pieceForm, descricao: e.target.value })} placeholder="Filtro, pneu, componente…" /></Field><Field label="Fornecedor"><input className="ctm-input w-full" value={pieceForm.fornecedor} onChange={(e) => setPieceForm({ ...pieceForm, fornecedor: e.target.value })} placeholder="Fornecedor" /></Field><Field label="Quantidade"><input className="ctm-input w-full" inputMode="decimal" value={pieceForm.quantidade} onChange={(e) => setPieceForm({ ...pieceForm, quantidade: e.target.value })} /></Field><Field label="Valor total"><input className="ctm-input w-full" inputMode="decimal" value={pieceForm.valor_total} onChange={(e) => setPieceForm({ ...pieceForm, valor_total: e.target.value })} placeholder="0,00" /></Field><Field label="Nº da nota fiscal"><input className="ctm-input w-full" value={pieceForm.numero_nota_fiscal} onChange={(e) => setPieceForm({ ...pieceForm, numero_nota_fiscal: e.target.value })} placeholder="NF da peça" /></Field><Field label="Data da compra"><input type="date" className="ctm-input w-full" value={pieceForm.data_compra} onChange={(e) => setPieceForm({ ...pieceForm, data_compra: e.target.value })} /></Field></div>}
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-200">Rateio deste {openForm === 'servico' ? 'serviço' : 'item'}</p><p className="mt-1 text-[11px] text-slate-400">Ajuste a participação de cada cotista. O total precisa fechar em 100%.</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${Math.abs(percentTotal - 100) < 0.01 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>{percentTotal.toFixed(2)}%</span></div>{cotistas.length === 0 ? <p className="text-xs text-slate-400">Nenhum cotista com cliente vinculado foi encontrado para esta aeronave.</p> : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{cotistas.map((cotista) => <div key={cotista.cliente_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2"><span className="min-w-0 truncate text-xs font-medium text-slate-200">{cotista.nome}</span><div className="flex items-center gap-1"><input className="ctm-input h-8 w-20 text-right" inputMode="decimal" value={rateioDraft[cotista.cliente_id] || '0'} onChange={(e) => setRateioDraft({ ...rateioDraft, [cotista.cliente_id]: e.target.value })} /><span className="text-xs text-slate-400">%</span></div></div>)}</div>}</div>
      <div className="mt-4 flex justify-end"><button disabled={saving} onClick={() => saveItem(openForm)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar registro'}</button></div>
    </div>}

    <ItemSection title="Serviços realizados" icon={<Wrench className="h-4 w-4" />} empty="Nenhum serviço detalhado registrado nesta OAS.">{services.map((item) => <ItemCard key={item.id} title={item.descricao} meta={[item.oficina_nome, item.os_oficina && `OS ${item.os_oficina}`, item.numero_nota_fiscal && `NF ${item.numero_nota_fiscal}`, item.data_servico && new Date(`${item.data_servico}T12:00:00`).toLocaleDateString('pt-BR')].filter(Boolean).join(' · ')} value={item.valor} rateios={itemRateios('servico', item.id)} />)}</ItemSection>
    <ItemSection title="Peças compradas e aplicadas" icon={<Plus className="h-4 w-4" />} empty="Nenhuma peça detalhada registrada nesta OAS.">{pieces.map((item) => <ItemCard key={item.id} title={item.descricao} meta={[item.fornecedor, `Qtd ${item.quantidade}`, item.numero_nota_fiscal && `NF ${item.numero_nota_fiscal}`, item.data_compra && new Date(`${item.data_compra}T12:00:00`).toLocaleDateString('pt-BR')].filter(Boolean).join(' · ')} value={item.valor_total} rateios={itemRateios('peca', item.id)} />)}</ItemSection>
  </div>;
}

function Summary({ label, value, icon, strong = false }: { label: string; value: number; icon: React.ReactNode; strong?: boolean }) { return <div className={`bg-slate-950/45 p-4 ${strong ? 'sm:bg-cyan-950/20' : ''}`}><div className="flex items-center gap-2 text-xs font-semibold text-slate-400">{icon}{label}</div><p className={`mt-2 text-xl font-bold ${strong ? 'text-cyan-200' : 'text-slate-100'}`}>{money(value)}</p></div>; }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={wide ? 'sm:col-span-2 lg:col-span-2' : ''}><span className="mb-1 block text-xs font-semibold text-slate-300">{label}</span>{children}</label>; }
function ItemSection({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string; children: React.ReactNode }) { const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children); return <section className="ctm-card overflow-hidden"><div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 py-4"><h3 className="flex items-center gap-2 font-bold text-slate-100">{icon}<span>{title}</span></h3></div><div className="space-y-3 p-4">{hasItems ? children : <p className="py-4 text-sm text-slate-400">{empty}</p>}</div></section>; }
function ItemCard({ title, meta, value, rateios }: { title: string; meta: string; value: number; rateios: Rateio[] }) { return <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-300/20 hover:bg-cyan-950/10"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h4 className="font-semibold text-slate-100">{title}</h4><p className="mt-1 text-xs text-slate-400">{meta || 'Sem informações complementares'}</p></div><p className="shrink-0 text-base font-bold text-cyan-200">{money(value)}</p></div>{rateios.length > 0 && <div className="mt-4 border-t border-white/10 pt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Rateio deste lançamento</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{rateios.map((row) => <div key={row.id} className="flex items-center justify-between rounded-lg bg-white/[0.035] px-3 py-2 text-xs"><span className="truncate pr-2 text-slate-300">{row.nome || `Cotista ${row.cliente_id.slice(0, 6)}`}</span><span className="font-semibold text-cyan-200">{Number(row.percentual || 0).toFixed(2)}% · {money(row.valor)}</span></div>)}</div></div>}</article>; }
