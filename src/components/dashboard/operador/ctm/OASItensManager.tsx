import { useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Receipt, Save, Trash2, Wrench, X, Paperclip, Eye, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db = supabase as any;
const money = (value: any) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numberValue = (value: string) => Number(String(value).replace(',', '.')) || 0;
const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type Cotista = { cliente_id: string; socio_id: string; nome: string; percentual: number };
type Service = { id: string; oficina_nome: string | null; os_oficina: string | null; descricao: string; valor: number; numero_nota_fiscal: string | null; nota_fiscal_path: string | null; nota_fiscal_nome: string | null; data_servico: string | null; tipo_rateio?: string | null };
type Piece = { id: string; descricao: string; fornecedor: string | null; quantidade: number; valor_total: number; numero_nota_fiscal: string | null; nota_fiscal_path: string | null; nota_fiscal_nome: string | null; data_compra: string | null };
type Rateio = { id: string; item_tipo: string; servico_id: string | null; peca_id: string | null; cliente_id: string; socio_id?: string | null; tipo_rateio: string; percentual: number; valor: number; nome?: string };
type ServiceDraft = { key: string; oficina_nome: string; os_oficina: string; descricao: string; valor: string; numero_nota_fiscal: string; data_servico: string; tipo_rateio: 'cota' | 'uso'; nota_fiscal_file: File | null };

const blankService = (): ServiceDraft => ({ key: newKey(), oficina_nome: '', os_oficina: '', descricao: '', valor: '', numero_nota_fiscal: '', data_servico: '', tipo_rateio: 'cota', nota_fiscal_file: null });

export function OASItensManager({ oasId, aircraftId, onChanged }: { oasId: string; aircraftId: string; onChanged?: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [rateios, setRateios] = useState<Rateio[]>([]);
  const [cotistas, setCotistas] = useState<Cotista[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openForm, setOpenForm] = useState<'servico' | 'peca' | null>(null);
  const [serviceLines, setServiceLines] = useState<ServiceDraft[]>([blankService()]);
  const [pieceForm, setPieceForm] = useState<{ descricao: string; fornecedor: string; quantidade: string; valor_total: string; numero_nota_fiscal: string; data_compra: string; nota_fiscal_file: File | null }>({ descricao: '', fornecedor: '', quantidade: '1', valor_total: '', numero_nota_fiscal: '', data_compra: '', nota_fiscal_file: null });
  const [rateioDrafts, setRateioDrafts] = useState<Record<string, Record<string, string>>>({});
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [editing, setEditing] = useState<{ kind: 'servico' | 'peca'; item: any } | null>(null);
  const [editForm, setEditForm] = useState<any | null>(null);
  const [editRates, setEditRates] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [{ data: serviceRows }, { data: pieceRows }, { data: rateioRows }, { data: cotistaRows }] = await Promise.all([
      db.from('ctm_oas_servicos').select('*').eq('ordem_servico_id', oasId).order('criado_em', { ascending: false }),
      db.from('ctm_pecas_trocadas').select('*').eq('ordem_servico_id', oasId).order('criado_em', { ascending: false }),
      db.from('ctm_oas_item_rateios').select('*').eq('ordem_servico_id', oasId),
      db.from('cotistas_aeronave').select('id_clientes, percentual_sociedade, clientes(id, razao_social), socios(id, nome)').eq('id_aeronave', aircraftId),
    ]);
    const cotistaList = (cotistaRows ?? []).filter((row: any) => row.id_clientes && (row.socios_id || row.socios?.id)).map((row: any) => ({ cliente_id: row.id_clientes, socio_id: row.socios_id || row.socios.id, nome: row.socios?.nome || row.clientes?.razao_social || 'Cotista', percentual: Number(row.percentual_sociedade) || Number(row.socios?.percentual_participacao) || 0 }));
    const names = new Map(cotistaList.map((cotista) => [cotista.socio_id, cotista.nome]));
    setCotistas(cotistaList);
    setServices(serviceRows ?? []);
    setPieces(pieceRows ?? []);
    setRateios((rateioRows ?? []).map((row: Rateio) => ({ ...row, nome: row.socio_id ? names.get(row.socio_id) : undefined })));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [oasId, aircraftId]);

  const totalServices = useMemo(() => services.reduce((sum, item) => sum + Number(item.valor || 0), 0), [services]);
  const totalPieces = useMemo(() => pieces.reduce((sum, item) => sum + Number(item.valor_total || 0), 0), [pieces]);
  const invoiceGroups = useMemo(() => {
    const groups = new Map<string, { number: string; items: Array<{ id: string; kind: 'Serviço' | 'Peça'; description: string; supplier: string; period: string; value: number; rateios: Rateio[]; notaPath: string | null; notaName: string | null }> }>();
    const add = (number: string | null, item: { id: string; kind: 'Serviço' | 'Peça'; description: string; supplier: string; period: string; value: number; rateios: Rateio[]; notaPath: string | null; notaName: string | null }) => {
      const key = (number || 'Sem nota fiscal').trim() || 'Sem nota fiscal';
      const group = groups.get(key) || { number: key, items: [] };
      group.items.push(item);
      groups.set(key, group);
    };
    services.forEach((item) => add(item.numero_nota_fiscal, { id: item.id, kind: 'Serviço', description: item.descricao, supplier: item.oficina_nome || 'Sem fornecedor', period: item.tipo_rateio === 'uso' ? 'Por uso' : 'Programado', value: Number(item.valor || 0), rateios: itemRateios('servico', item.id), notaPath: item.nota_fiscal_path, notaName: item.nota_fiscal_nome || item.numero_nota_fiscal }));
    pieces.forEach((item) => add(item.numero_nota_fiscal, { id: item.id, kind: 'Peça', description: item.descricao, supplier: item.fornecedor || 'Sem fornecedor', period: 'Peça aplicada', value: Number(item.valor_total || 0), rateios: itemRateios('peca', item.id), notaPath: item.nota_fiscal_path, notaName: item.nota_fiscal_nome || item.numero_nota_fiscal }));
    return [...groups.values()].sort((a, b) => a.number.localeCompare(b.number, 'pt-BR', { numeric: true }));
  }, [services, pieces, rateios]);

  function beginForm(kind: 'servico' | 'peca') {
    setOpenForm(kind);
    if (kind === 'servico') {
      const first = serviceLines[0]?.key || newKey();
      if (serviceLines.length === 0) setServiceLines([blankService()]);
      setRateioDrafts((current) => ({ ...current, [first]: Object.fromEntries(cotistas.map((cotista) => [cotista.socio_id, String(cotista.percentual || 0)])) }));
    }
  }

  function addServiceLine() {
    const line = blankService();
    setServiceLines((current) => [...current, line]);
    setRateioDrafts((current) => ({ ...current, [line.key]: Object.fromEntries(cotistas.map((cotista) => [cotista.socio_id, String(cotista.percentual || 0)])) }));
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
      if (line.nota_fiscal_file) await uploadNotaFiscal('servico', item.id, line.nota_fiscal_file);
      if (cotistas.length > 0) {
        const rows = cotistas.map((cotista) => ({ ordem_servico_id: oasId, item_tipo: 'servico', servico_id: item.id, cliente_id: cotista.cliente_id, socio_id: cotista.socio_id, tipo_rateio: line.tipo_rateio, percentual: numberValue(rateioDrafts[line.key]?.[cotista.socio_id] || '0'), valor: numberValue(line.valor) * numberValue(rateioDrafts[line.key]?.[cotista.socio_id] || '0') / 100 }));
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
    if (pieceForm.nota_fiscal_file) await uploadNotaFiscal('peca', item.id, pieceForm.nota_fiscal_file);
    const defaultRateio = Object.fromEntries(cotistas.map((cotista) => [cotista.socio_id, String(cotista.percentual || 0)]));
    if (cotistas.length > 0) {
      const rows = cotistas.map((cotista) => ({ ordem_servico_id: oasId, item_tipo: 'peca', peca_id: item.id, cliente_id: cotista.cliente_id, socio_id: cotista.socio_id, tipo_rateio: 'cota', percentual: numberValue(defaultRateio[cotista.socio_id] || '0'), valor: value * numberValue(defaultRateio[cotista.socio_id] || '0') / 100 }));
      await db.from('ctm_oas_item_rateios').insert(rows);
    }
    toast.success('Peça registrada na OAS.'); setOpenForm(null); setPieceForm({ descricao: '', fornecedor: '', quantidade: '1', valor_total: '', numero_nota_fiscal: '', data_compra: '', nota_fiscal_file: null }); await load(); onChanged?.(); setSaving(false);
  }

  async function uploadNotaFiscal(itemTipo: 'servico' | 'peca', itemId: string, file: File) {
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const path = `oas/${oasId}/${itemTipo}/${itemId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('oas_documentos').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { toast.warning('Registro salvo, mas o anexo não pôde ser enviado: ' + uploadError.message); return; }
    const table = itemTipo === 'servico' ? 'ctm_oas_servicos' : 'ctm_pecas_trocadas';
    const { error: updateError } = await db.from(table).update({ nota_fiscal_path: path, nota_fiscal_nome: file.name }).eq('id', itemId);
    if (updateError) toast.warning('Nota enviada, mas o vínculo não pôde ser salvo: ' + updateError.message);
  }

  function itemRateios(itemTipo: 'servico' | 'peca', itemId: string) { return rateios.filter((row) => row.item_tipo === itemTipo && (itemTipo === 'servico' ? row.servico_id === itemId : row.peca_id === itemId)); }
  function notaUrl(path: string) { return supabase.storage.from('oas_documentos').getPublicUrl(path).data.publicUrl; }
  function beginEdit(kind: 'servico' | 'peca', itemId: string) {
    const item: any = kind === 'servico' ? services.find((row) => row.id === itemId) : pieces.find((row) => row.id === itemId);
    if (!item) return;
    setEditing({ kind, item });
    setEditForm(kind === 'servico' ? { oficina_nome: item.oficina_nome || '', os_oficina: item.os_oficina || '', descricao: item.descricao || '', valor: String(item.valor ?? ''), numero_nota_fiscal: item.numero_nota_fiscal || '', data_servico: item.data_servico || '', tipo_rateio: item.tipo_rateio || 'cota', nota_fiscal_file: null } : { descricao: item.descricao || '', fornecedor: item.fornecedor || '', quantidade: String(item.quantidade ?? 1), valor_total: String(item.valor_total ?? ''), numero_nota_fiscal: item.numero_nota_fiscal || '', data_compra: item.data_compra || '', nota_fiscal_file: null });
    setEditRates(Object.fromEntries(itemRateios(kind, item.id).map((row) => [row.socio_id || row.cliente_id, String(row.percentual ?? 0)])));
  }
  const closeEdit = () => { setEditing(null); setEditForm(null); setEditRates({}); };
  async function saveEdit() {
    if (!editing || !editForm) return;
    const kind = editing.kind;
    const value = numberValue(kind === 'servico' ? editForm.valor : editForm.valor_total);
    if (!editForm.descricao?.trim() || value < 0) { toast.error('Informe a descrição e um valor válido.'); return; }
    const table = kind === 'servico' ? 'ctm_oas_servicos' : 'ctm_pecas_trocadas';
    const payload = kind === 'servico' ? { oficina_nome: editForm.oficina_nome || null, os_oficina: editForm.os_oficina || null, descricao: editForm.descricao.trim(), valor: value, numero_nota_fiscal: editForm.numero_nota_fiscal || null, data_servico: editForm.data_servico || null, tipo_rateio: editForm.tipo_rateio || 'cota' } : { descricao: editForm.descricao.trim(), fornecedor: editForm.fornecedor || null, quantidade: numberValue(editForm.quantidade) || 1, valor_total: value, numero_nota_fiscal: editForm.numero_nota_fiscal || null, data_compra: editForm.data_compra || null };
    setSaving(true);
    const { error } = await db.from(table).update(payload).eq('id', editing.item.id).eq('ordem_servico_id', oasId);
    if (error) { toast.error('Não foi possível atualizar: ' + error.message); setSaving(false); return; }
    const itemTipo = kind;
    const idField = kind === 'servico' ? 'servico_id' : 'peca_id';
    await db.from('ctm_oas_item_rateios').delete().eq('ordem_servico_id', oasId).eq('item_tipo', itemTipo).eq(idField, editing.item.id);
    if (cotistas.length > 0) {
      const rows = cotistas.map((cotista) => ({ ordem_servico_id: oasId, item_tipo: itemTipo, servico_id: kind === 'servico' ? editing.item.id : null, peca_id: kind === 'peca' ? editing.item.id : null, cliente_id: cotista.cliente_id, socio_id: cotista.socio_id, tipo_rateio: kind === 'servico' ? (editForm.tipo_rateio === 'uso' ? 'uso' : 'cota') : 'cota', percentual: numberValue(editRates[cotista.socio_id] || '0'), valor: value * numberValue(editRates[cotista.socio_id] || '0') / 100 }));
      const { error: rateioError } = await db.from('ctm_oas_item_rateios').insert(rows);
      if (rateioError) toast.warning('Item atualizado, mas o rateio não pôde ser atualizado.');
    }
    if (editForm.nota_fiscal_file) await uploadNotaFiscal(kind, editing.item.id, editForm.nota_fiscal_file);
    toast.success('Item atualizado.'); closeEdit(); await load(); onChanged?.(); setSaving(false);
  }

  if (loading) return <div className="ctm-card p-5 text-sm text-muted-foreground">Carregando histórico da OAS…</div>;

  return <div className="space-y-5">
    <div className="ctm-card overflow-hidden border-cyan-400/15 bg-gradient-to-br from-slate-900/80 via-slate-950/70 to-cyan-950/10">
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"><Receipt className="h-4 w-4" /> Histórico financeiro da OAS</div><h3 className="text-lg font-bold text-slate-100">Serviços e peças realizados</h3><p className="mt-1 text-xs text-slate-400">Serviços e peças desta OAS.</p></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => beginForm('servico')} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-200"><Wrench className="h-3.5 w-3.5" /> Adicionar serviço</button><button onClick={() => beginForm('peca')} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3.5 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20"><Plus className="h-3.5 w-3.5" /> Nova peça</button></div>
      </div>
      <div className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-3"><Summary label="Serviços / mão de obra" value={totalServices} icon={<Wrench className="h-4 w-4" />} /><Summary label="Peças" value={totalPieces} icon={<Plus className="h-4 w-4" />} /><Summary label="Total da OAS" value={totalServices + totalPieces} icon={<FileText className="h-4 w-4" />} strong /></div>
    </div>

    {openForm === 'servico' && <div className="ctm-card border-cyan-300/20 p-5"><div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold text-slate-100">Serviços da OAS</h4><p className="mt-1 text-xs text-slate-400">Uma linha por serviço.</p></div><button onClick={() => setOpenForm(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div><div className="space-y-4">{serviceLines.map((line, index) => <div key={line.key} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-cyan-200">Serviço {index + 1}</p><button onClick={() => removeLine(line.key)} disabled={serviceLines.length === 1} className="rounded-lg p-2 text-slate-500 transition hover:bg-red-400/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4" /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Oficina"><input className="ctm-input w-full" value={line.oficina_nome} onChange={(e) => updateLine(line.key, { oficina_nome: e.target.value })} placeholder="NEW WAY" /></Field><Field label="Nº da OS da oficina"><input className="ctm-input w-full" value={line.os_oficina} onChange={(e) => updateLine(line.key, { os_oficina: e.target.value })} placeholder="OS-0001" /></Field><Field label="Período"><input className="ctm-input w-full" value={line.tipo_rateio === 'uso' ? 'Por uso' : 'Cota aeronave'} readOnly /></Field><Field label="Nº da nota fiscal"><input className="ctm-input w-full" value={line.numero_nota_fiscal} onChange={(e) => updateLine(line.key, { numero_nota_fiscal: e.target.value })} placeholder="NFE 825" /></Field><Field label="Anexar nota fiscal"><input className="ctm-input w-full file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-400/15 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-cyan-100" type="file" accept="application/pdf,image/*" onChange={(e) => updateLine(line.key, { nota_fiscal_file: e.target.files?.[0] || null })} /></Field><Field label="Descrição do serviço" wide><textarea className="ctm-input min-h-20 w-full resize-y" value={line.descricao} onChange={(e) => updateLine(line.key, { descricao: e.target.value })} placeholder="M.O. - SERVIÇO DE INSTALAÇÃO..." /></Field><Field label="Valor"><input className="ctm-input w-full" inputMode="decimal" value={line.valor} onChange={(e) => updateLine(line.key, { valor: e.target.value })} placeholder="420,00" /></Field><Field label="Data do serviço"><input type="date" className="ctm-input w-full" value={line.data_servico} onChange={(e) => updateLine(line.key, { data_servico: e.target.value })} /></Field><Field label="Base do rateio"><select className="ctm-input w-full" value={line.tipo_rateio} onChange={(e) => updateLine(line.key, { tipo_rateio: e.target.value as 'cota' | 'uso' })}><option value="cota">Cota da aeronave</option><option value="uso">Percentual por uso</option></select></Field></div><div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rateio do serviço {index + 1}</p><span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${Math.abs(percentTotal(line.key) - 100) < 0.01 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>{percentTotal(line.key).toFixed(2)}%</span></div>{cotistas.length === 0 ? <p className="text-xs text-slate-400">Nenhum cotista com cliente vinculado foi encontrado.</p> : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{cotistas.map((cotista) => <label key={cotista.socio_id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2"><span className="min-w-0 truncate text-xs text-slate-200">{cotista.nome}</span><span className="flex items-center gap-1"><input className="ctm-input h-8 w-20 text-right" inputMode="decimal" value={rateioDrafts[line.key]?.[cotista.socio_id] || '0'} onChange={(e) => setRateioDrafts((current) => ({ ...current, [line.key]: { ...(current[line.key] || {}), [cotista.socio_id]: e.target.value } }))} /><span className="text-xs text-slate-400">%</span></span></label>)}</div>}</div></div>)}</div><div className="mt-4 flex flex-wrap justify-between gap-3"><button onClick={addServiceLine} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/5 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/10"><Plus className="h-4 w-4" /> Adicionar outra linha</button><button disabled={saving} onClick={saveServices} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar serviços'}</button></div></div>}

    {openForm === 'peca' && <div className="ctm-card border-cyan-300/20 p-5"><div className="mb-4 flex items-center justify-between"><div><h4 className="font-bold text-slate-100">Adicionar peça comprada/aplicada</h4><p className="mt-1 text-xs text-slate-400">A peça também será somada ao total e ao histórico da OAS.</p></div><button onClick={() => setOpenForm(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"><Field label="Descrição da peça" wide><input className="ctm-input w-full" value={pieceForm.descricao} onChange={(e) => setPieceForm({ ...pieceForm, descricao: e.target.value })} placeholder="Filtro, pneu, componente…" /></Field><Field label="Fornecedor"><input className="ctm-input w-full" value={pieceForm.fornecedor} onChange={(e) => setPieceForm({ ...pieceForm, fornecedor: e.target.value })} placeholder="Fornecedor" /></Field><Field label="Quantidade"><input className="ctm-input w-full" inputMode="decimal" value={pieceForm.quantidade} onChange={(e) => setPieceForm({ ...pieceForm, quantidade: e.target.value })} /></Field><Field label="Valor total"><input className="ctm-input w-full" inputMode="decimal" value={pieceForm.valor_total} onChange={(e) => setPieceForm({ ...pieceForm, valor_total: e.target.value })} placeholder="0,00" /></Field><Field label="Nº da nota fiscal"><input className="ctm-input w-full" value={pieceForm.numero_nota_fiscal} onChange={(e) => setPieceForm({ ...pieceForm, numero_nota_fiscal: e.target.value })} placeholder="NF da peça" /></Field><Field label="Anexar nota fiscal"><input className="ctm-input w-full file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-400/15 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-cyan-100" type="file" accept="application/pdf,image/*" onChange={(e) => setPieceForm({ ...pieceForm, nota_fiscal_file: e.target.files?.[0] || null })} /></Field><Field label="Data da compra"><input type="date" className="ctm-input w-full" value={pieceForm.data_compra} onChange={(e) => setPieceForm({ ...pieceForm, data_compra: e.target.value })} /></Field></div><div className="mt-4 flex justify-end"><button disabled={saving} onClick={savePiece} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Salvando…' : 'Salvar peça'}</button></div></div>}

    <ItemSection title="Documentos por nota fiscal" icon={<Receipt className="h-4 w-4" />} empty="Nenhuma nota fiscal vinculada aos itens desta OAS.">{invoiceGroups.map((group) => <InvoiceCard key={group.number} group={group} onPreview={(path, name) => setPreview({ url: notaUrl(path), name })} onEdit={(item) => beginEdit(item.kind === 'Serviço' ? 'servico' : 'peca', item.id)} />)}</ItemSection>
    <EditItemModal editing={editing} form={editForm} setForm={setEditForm} rates={editRates} setRates={setEditRates} cotistas={cotistas} saving={saving} onClose={closeEdit} onSave={saveEdit} />
    <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}><DialogContent className="flex h-[90vh] w-[96vw] max-w-5xl flex-col overflow-hidden border-cyan-300/20 bg-slate-950 p-0"><DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-white/10 px-5 py-4"><DialogTitle className="flex min-w-0 items-center gap-2 truncate text-sm text-slate-100"><FileText className="h-4 w-4 text-cyan-300" /> {preview?.name || 'Nota fiscal'}</DialogTitle></DialogHeader>{preview && (preview.url.toLowerCase().includes('.pdf') ? <iframe title={preview.name} src={preview.url} className="min-h-0 flex-1 bg-white" /> : <div className="min-h-0 flex-1 overflow-auto bg-slate-900 p-4 text-center"><img src={preview.url} alt={preview.name} className="mx-auto max-h-full max-w-full object-contain" /></div>)}</DialogContent></Dialog>
  </div>;
}

function EditItemModal({ editing, form, setForm, rates, setRates, cotistas, saving, onClose, onSave }: any) {
  if (!editing || !form) return null;
  const service = editing.kind === 'servico';
  const update = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const total = Number(Object.values(rates || {}).reduce((sum: number, value: any) => sum + numberValue(String(value)), 0));
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[92vh] w-[96vw] max-w-3xl overflow-y-auto border-cyan-300/20 bg-slate-950"><DialogHeader><DialogTitle className="text-slate-100">Editar {service ? 'serviço' : 'peça'}</DialogTitle></DialogHeader><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label={service ? 'Oficina' : 'Fornecedor'}><input className="ctm-input w-full" value={service ? form.oficina_nome : form.fornecedor} onChange={(e) => update(service ? 'oficina_nome' : 'fornecedor', e.target.value)} /></Field>{service && <Field label="Nº da OS"><input className="ctm-input w-full" value={form.os_oficina} onChange={(e) => update('os_oficina', e.target.value)} /></Field>}<Field label={service ? 'Valor' : 'Valor total'}><input className="ctm-input w-full" inputMode="decimal" value={service ? form.valor : form.valor_total} onChange={(e) => update(service ? 'valor' : 'valor_total', e.target.value)} /></Field>{!service && <Field label="Quantidade"><input className="ctm-input w-full" inputMode="decimal" value={form.quantidade} onChange={(e) => update('quantidade', e.target.value)} /></Field>}<Field label="Nº da nota fiscal"><input className="ctm-input w-full" value={form.numero_nota_fiscal} onChange={(e) => update('numero_nota_fiscal', e.target.value)} /></Field><Field label={service ? 'Data do serviço' : 'Data da compra'}><input type="date" className="ctm-input w-full" value={service ? form.data_servico : form.data_compra} onChange={(e) => update(service ? 'data_servico' : 'data_compra', e.target.value)} /></Field>{service && <Field label="Base do rateio"><select className="ctm-input w-full" value={form.tipo_rateio} onChange={(e) => update('tipo_rateio', e.target.value)}><option value="cota">Cota da aeronave</option><option value="uso">Percentual por uso</option></select></Field>}<div className="sm:col-span-2"><Field label={service ? 'Descrição do serviço' : 'Descrição da peça'}><textarea className="ctm-input min-h-24 w-full resize-y" value={form.descricao} onChange={(e) => update('descricao', e.target.value)} /></Field></div><div className="sm:col-span-2"><Field label="Substituir nota fiscal"><input className="ctm-input w-full file:mr-2 file:rounded-lg file:border-0 file:bg-cyan-400/15 file:px-2 file:py-1 file:text-xs file:text-cyan-100" type="file" accept="application/pdf,image/*" onChange={(e) => update('nota_fiscal_file', e.target.files?.[0] || null)} /></Field></div></div><div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-200">Rateio</p><span className={Math.abs(total - 100) < 0.01 ? 'text-xs text-emerald-300' : 'text-xs text-amber-200'}>{total.toFixed(2)}%</span></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{cotistas.map((cotista: any) => <label key={cotista.socio_id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"><span className="truncate text-xs text-slate-200">{cotista.nome}</span><input className="ctm-input h-8 w-20 text-right" inputMode="decimal" value={rates[cotista.socio_id] || '0'} onChange={(e) => setRates((current: any) => ({ ...current, [cotista.socio_id]: e.target.value }))} /></label>)}</div></div><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-400 hover:bg-white/5">Cancelar</button><button disabled={saving} onClick={onSave} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"><Save className="h-4 w-4" />Salvar alterações</button></div></DialogContent></Dialog>;
}

function Summary({ label, value, icon, strong = false }: { label: string; value: number; icon: React.ReactNode; strong?: boolean }) { return <div className={`bg-slate-950/45 p-4 ${strong ? 'sm:bg-cyan-950/20' : ''}`}><div className="flex items-center gap-2 text-xs font-semibold text-slate-400">{icon}{label}</div><p className={`mt-2 text-xl font-bold ${strong ? 'text-cyan-200' : 'text-slate-100'}`}>{money(value)}</p></div>; }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={wide ? 'sm:col-span-2 lg:col-span-2' : ''}><span className="mb-1 block text-xs font-semibold text-slate-300">{label}</span>{children}</label>; }
function ItemSection({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string; children: React.ReactNode }) { const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children); return <section className="ctm-card overflow-hidden"><div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 py-4"><h3 className="flex items-center gap-2 font-bold text-slate-100">{icon}<span>{title}</span></h3></div><div className="space-y-3 p-4">{hasItems ? children : <p className="py-4 text-sm text-slate-400">{empty}</p>}</div></section>; }
function InvoiceCard({ group, onPreview, onEdit }: { group: { number: string; items: Array<{ id: string; kind: 'Serviço' | 'Peça'; description: string; supplier: string; period: string; value: number; rateios: Rateio[]; notaPath: string | null; notaName: string | null }> }; onPreview: (path: string, name: string) => void; onEdit: (item: { id: string; kind: 'Serviço' | 'Peça' }) => void }) { const total = group.items.reduce((sum, item) => sum + item.value, 0); const rateio = group.items.flatMap((item) => item.rateios).reduce<Record<string, { nome?: string; valor: number }>>((acc, row) => { const key = row.socio_id || row.cliente_id; const current = acc[key] || { nome: row.nome, valor: 0 }; current.valor += Number(row.valor || 0); acc[key] = current; return acc; }, {}); const attachment = group.items.find((item) => item.notaPath); return <article className="overflow-hidden rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-950/25 via-slate-950/55 to-slate-950/70 shadow-lg shadow-cyan-950/10"><header className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-2.5 text-cyan-200"><Receipt className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200/75">Nota fiscal</p><h4 className="text-lg font-bold text-slate-100">{group.number}</h4><p className="text-xs text-slate-400">{group.items.length} {group.items.length === 1 ? 'item vinculado' : 'itens vinculados'}</p></div></div><div className="flex items-center gap-3"><div className="text-left sm:text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total da nota</p><p className="text-xl font-bold text-cyan-200">{money(total)}</p></div>{attachment && <button type="button" onClick={() => onPreview(attachment.notaPath!, attachment.notaName || group.number)} className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/20"><Eye className="h-4 w-4" /> Ver nota</button>}</div></header><div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left text-xs"><thead className="border-b border-white/10 bg-slate-950/30 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Período</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-white/10">{group.items.map((item) => <tr key={item.id} className="transition hover:bg-cyan-400/[0.04]"><td className="max-w-[460px] px-4 py-3 font-medium text-slate-200">{item.description}<span className="ml-2 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase text-slate-400">{item.kind}</span></td><td className="px-4 py-3 text-slate-300">{item.supplier}</td><td className="px-4 py-3 text-slate-400">{item.period}</td><td className="px-4 py-3 text-right font-semibold text-slate-100">{money(item.value)}</td><td className="px-4 py-3 text-right"><button type="button" onClick={() => onEdit(item)} className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/20 px-2 py-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/10"><Pencil className="h-3 w-3" /> Editar</button></td></tr>)}</tbody></table></div>{Object.keys(rateio).length > 0 && <footer className="border-t border-white/10 bg-slate-950/25 px-4 py-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rateio consolidado desta nota</p><span className="text-xs font-semibold text-cyan-200">{money(total)}</span></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{Object.entries(rateio).map(([id, row]) => <div key={id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs"><span className="truncate pr-2 text-slate-300">{row.nome || `Cotista ${id.slice(0, 6)}`}</span><span className="font-semibold text-cyan-200">{money(row.valor)}</span></div>)}</div></footer>}</article>; }
