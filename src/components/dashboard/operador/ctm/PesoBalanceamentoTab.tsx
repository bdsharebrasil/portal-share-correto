// @ts-nocheck — colunas legadas com acento fora dos types gerados
import { useEffect, useMemo, useState } from 'react';
import {
  Plus, X, Save, Loader2, Gauge, Scale, Trash2, CheckCircle2, AlertTriangle, Printer, Fuel,
} from 'lucide-react';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIAS = [
  { value: 'BASICO', label: 'Peso Básico / Vazio' },
  { value: 'TRIPULACAO', label: 'Tripulação' },
  { value: 'PASSAGEIRO', label: 'Passageiros' },
  { value: 'BAGAGEM', label: 'Bagagem' },
  { value: 'COMBUSTIVEL', label: 'Combustível' },
  { value: 'OUTRO', label: 'Outro' },
];

const LIMITES = [
  { key: 'peso_vazio_padrao', label: 'Peso Vazio (kg)' },
  { key: 'braco_cg_padrao', label: 'Braço CG Vazio (m)' },
  { key: 'peso_maximo_decolagem', label: 'MTOW (kg)' },
  { key: 'peso_maximo_pouso', label: 'MLW (kg)' },
  { key: 'peso_maximo_sem_combustivel', label: 'MZFW (kg)' },
  { key: 'cg_limite_dianteiro', label: 'CG Limite Dianteiro (m)' },
  { key: 'cg_limite_traseiro', label: 'CG Limite Traseiro (m)' },
  { key: 'mac_comprimento', label: 'MAC (m)' },
  { key: 'lemac_distancia', label: 'LEMAC (m)' },
  { key: 'capacidade_combustivel_total', label: 'Combustível Total (L)' },
  { key: 'capacidade_combustivel_util', label: 'Combustível Útil (L)' },
];

const n = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const fmt = (v: number, d = 2) =>
  Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';

export function PesoBalanceamentoTab({ aircraftId }: { aircraftId: string }) {
  const [aeronave, setAeronave] = useState<any>(null);
  const [wb, setWb] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLimits, setSavingLimits] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ descricao: '', categoria: 'OUTRO', peso: '', braco: '' });
  const [fuelPct, setFuelPct] = useState(100);

  async function load() {
    setLoading(true);
    const [{ data: av }, { data }] = await Promise.all([
      supabase.from('aeronave').select('matricula, modelo, fabricante, numero_serie, ano').eq('id', aircraftId).maybeSingle(),
      supabase.from('ctm_peso_balanceamento').select('*').eq('aeronave_id', aircraftId).maybeSingle(),
    ]);
    setAeronave(av ?? null);
    setWb(data ?? null);
    setLimits(
      LIMITES.reduce((acc, l) => ({ ...acc, [l.key]: data?.[l.key] != null ? String(data[l.key]) : '' }), {}),
    );
    if (data?.id) {
      const { data: its } = await supabase
        .from('ctm_itens_peso_balanceamento')
        .select('*')
        .eq('peso_balanceamento_id', data.id)
        .order('criado_em', { ascending: true });
      setItems(its ?? []);
    } else {
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [aircraftId]);

  async function ensureWb(): Promise<string | null> {
    if (wb?.id) return wb.id;
    const { data, error } = await supabase
      .from('ctm_peso_balanceamento')
      .insert({ aeronave_id: aircraftId })
      .select('*')
      .single();
    if (error) { toast.error('Erro ao criar ficha: ' + error.message); return null; }
    setWb(data);
    return data.id;
  }

  async function saveLimits() {
    setSavingLimits(true);
    const id = await ensureWb();
    if (!id) { setSavingLimits(false); return; }
    const payload: any = {};
    LIMITES.forEach((l) => { payload[l.key] = limits[l.key] === '' ? null : Number(limits[l.key]); });
    const { error } = await supabase.from('ctm_peso_balanceamento').update(payload).eq('id', id);
    if (error) toast.error('Erro ao salvar limites');
    else { toast.success('Ficha da aeronave atualizada'); load(); }
    setSavingLimits(false);
  }

  async function saveItem() {
    if (!form.descricao.trim()) return toast.error('Descrição é obrigatória');
    const id = await ensureWb();
    if (!id) return;
    const peso = n(form.peso);
    const braco = n(form.braco);
    const { error } = await supabase.from('ctm_itens_peso_balanceamento').insert({
      peso_balanceamento_id: id,
      descricao: form.descricao.trim().toUpperCase(),
      categoria: form.categoria,
      peso_sem_combustivel: peso,
      'braço_posicao': braco,
      momento: peso * braco,
      incluir_no_calculo: true,
    });
    if (error) return toast.error('Erro ao adicionar item');
    toast.success('Estação adicionada');
    setForm({ descricao: '', categoria: 'OUTRO', peso: '', braco: '' });
    setShowForm(false);
    load();
  }

  async function updateItem(item: any, patch: any) {
    const peso = patch.peso_sem_combustivel ?? item.peso_sem_combustivel;
    const braco = patch['braço_posicao'] ?? item['braço_posicao'];
    const merged = { ...patch, momento: n(peso) * n(braco) };
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...merged } : i)));
    const { error } = await supabase.from('ctm_itens_peso_balanceamento').update(merged).eq('id', item.id);
    if (error) toast.error('Erro ao atualizar item');
  }

  async function deleteItem(id: string) {
    if (!window.confirm('Excluir esta estação?')) return;
    const { error } = await supabase.from('ctm_itens_peso_balanceamento').delete().eq('id', id);
    if (error) return toast.error('Erro ao excluir');
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success('Estação removida');
  }

  /* ---------------- Cálculo automático ---------------- */
  const calc = useMemo(() => {
    const ativos = items.filter((i) => i.incluir_no_calculo !== false);
    const linhas = ativos.map((i) => {
      const isFuel = String(i.categoria || '').toUpperCase() === 'COMBUSTIVEL';
      const peso = n(i.peso_sem_combustivel) * (isFuel ? fuelPct / 100 : 1);
      const braco = n(i['braço_posicao']);
      return { id: i.id, descricao: i.descricao, isFuel, peso, braco, momento: peso * braco };
    });

    const pesoVazio = n(wb?.peso_vazio_padrao);
    const bracoVazio = n(wb?.braco_cg_padrao);
    const temVazio = pesoVazio > 0;

    const pesoItens = linhas.reduce((a, l) => a + l.peso, 0);
    const momentoItens = linhas.reduce((a, l) => a + l.momento, 0);

    const pesoTotal = pesoItens + (temVazio ? pesoVazio : 0);
    const momentoTotal = momentoItens + (temVazio ? pesoVazio * bracoVazio : 0);
    const cg = pesoTotal > 0 ? momentoTotal / pesoTotal : 0;

    const pesoCombustivel = linhas.filter((l) => l.isFuel).reduce((a, l) => a + l.peso, 0);
    const zfw = pesoTotal - pesoCombustivel;

    const mtow = n(wb?.peso_maximo_decolagem);
    const mlw = n(wb?.peso_maximo_pouso);
    const mzfw = n(wb?.peso_maximo_sem_combustivel);
    const cgFwd = n(wb?.cg_limite_dianteiro);
    const cgAft = n(wb?.cg_limite_traseiro);
    const mac = n(wb?.mac_comprimento);
    const lemac = n(wb?.lemac_distancia);
    const cgMac = mac > 0 ? ((cg - lemac) / mac) * 100 : null;

    const alerts: { level: 'error' | 'warn'; msg: string }[] = [];
    if (mtow > 0 && pesoTotal > mtow) alerts.push({ level: 'error', msg: `Peso acima do MTOW em ${fmt(pesoTotal - mtow)} kg` });
    if (mzfw > 0 && zfw > mzfw) alerts.push({ level: 'error', msg: `ZFW acima do máximo em ${fmt(zfw - mzfw)} kg` });
    if (mlw > 0 && pesoTotal > mlw) alerts.push({ level: 'warn', msg: 'Peso acima do MLW — planeje consumo antes do pouso' });
    if (cgFwd > 0 && cg < cgFwd) alerts.push({ level: 'error', msg: 'CG à frente do limite dianteiro' });
    if (cgAft > 0 && cg > cgAft) alerts.push({ level: 'error', msg: 'CG atrás do limite traseiro' });

    const dentroLimites =
      alerts.filter((a) => a.level === 'error').length === 0 && pesoTotal > 0 && cgFwd > 0 && cgAft > 0 && mtow > 0;

    return {
      linhas, pesoTotal, momentoTotal, cg, cgMac, zfw, pesoCombustivel,
      mtow, mlw, mzfw, cgFwd, cgAft, alerts, dentroLimites, pesoVazio, bracoVazio, temVazio,
    };
  }, [items, wb, fuelPct]);

  const envelope = useMemo(() => {
    const { cgFwd, cgAft, mtow } = calc;
    if (!(cgFwd > 0 && cgAft > 0 && mtow > 0)) return null;
    const pesoMin = Math.max(calc.pesoVazio || mtow * 0.55, mtow * 0.4);
    return { cgFwd, cgAft, mtow, pesoMin };
  }, [calc]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-950/50 p-16">
        <Loader2 className="h-6 w-6 animate-spin text-ctm-teal" />
      </div>
    );
  }

  return (
    <div className="space-y-5 print:space-y-3">
      {/* Cabeçalho / Ficha */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ctm-teal/25 bg-ctm-teal/10 text-ctm-teal">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Ficha de Peso &amp; Balanceamento</h2>
            <p className="text-xs text-slate-400">
              {[aeronave?.matricula, [aeronave?.fabricante, aeronave?.modelo].filter(Boolean).join(' ')]
                .filter(Boolean).join(' · ') || '—'}
              {aeronave?.numero_serie ? ` · S/N ${aeronave.numero_serie}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
              calc.dentroLimites
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400',
            )}
          >
            {calc.dentroLimites ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {calc.dentroLimites ? 'Dentro dos limites' : 'Verificar limites'}
          </span>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 print:hidden"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Peso Total" value={`${fmt(calc.pesoTotal, 1)} kg`} sub={calc.mtow ? `MTOW ${fmt(calc.mtow, 0)} kg` : undefined}
          progress={calc.mtow ? calc.pesoTotal / calc.mtow : undefined} />
        <Kpi label="ZFW" value={`${fmt(calc.zfw, 1)} kg`} sub={calc.mzfw ? `Máx ${fmt(calc.mzfw, 0)} kg` : undefined}
          progress={calc.mzfw ? calc.zfw / calc.mzfw : undefined} />
        <Kpi label="Momento" value={fmt(calc.momentoTotal, 1)} sub="kg·m" />
        <Kpi label="CG" value={`${fmt(calc.cg, 3)} m`} sub={calc.cgFwd ? `Limites ${fmt(calc.cgFwd, 3)} – ${fmt(calc.cgAft, 3)}` : undefined} />
        <Kpi label="CG % MAC" value={calc.cgMac != null ? `${fmt(calc.cgMac, 1)}%` : '—'} sub="ref. LEMAC" />
      </div>

      {calc.alerts.length > 0 && (
        <div className="space-y-2">
          {calc.alerts.map((a, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
                a.level === 'error'
                  ? 'border-red-500/25 bg-red-500/10 text-red-400'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-400',
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" /> {a.msg}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_1fr]">
        {/* Estações / itens */}
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-200">Estações de Carregamento</h3>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ctm-teal px-3 py-1.5 text-xs font-semibold text-[hsl(var(--ctm-navy))] print:hidden"
            >
              <Plus className="h-3.5 w-3.5" /> Nova estação
            </button>
          </div>

          {showForm && (
            <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 print:hidden">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">Nova estação</p>
                <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-slate-400" /></button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className="ctm-input" placeholder="Descrição (ex.: PILOTO)" value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
                <select className="ctm-input" value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input className="ctm-input" placeholder="Peso (kg)" inputMode="decimal" value={form.peso}
                  onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))} />
                <input className="ctm-input" placeholder="Braço (m)" inputMode="decimal" value={form.braco}
                  onChange={(e) => setForm((f) => ({ ...f, braco: e.target.value }))} />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="rounded-lg px-3 py-1.5 text-xs text-slate-400">Cancelar</button>
                <button onClick={saveItem} className="inline-flex items-center gap-1.5 rounded-lg bg-ctm-teal px-3 py-1.5 text-xs font-semibold text-[hsl(var(--ctm-navy))]">
                  <Save className="h-3.5 w-3.5" /> Salvar
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 text-left">Estação</th>
                  <th className="px-2 py-2 text-right">Peso (kg)</th>
                  <th className="px-2 py-2 text-right">Braço (m)</th>
                  <th className="px-2 py-2 text-right">Momento</th>
                  <th className="px-2 py-2 text-center print:hidden">Incluir</th>
                  <th className="px-2 py-2 print:hidden" />
                </tr>
              </thead>
              <tbody>
                {calc.temVazio && (
                  <tr className="border-b border-slate-900/70 bg-slate-900/30">
                    <td className="px-2 py-2 font-semibold text-slate-300">PESO BÁSICO (VAZIO)</td>
                    <td className="px-2 py-2 text-right text-slate-300">{fmt(calc.pesoVazio, 1)}</td>
                    <td className="px-2 py-2 text-right text-slate-300">{fmt(calc.bracoVazio, 3)}</td>
                    <td className="px-2 py-2 text-right text-slate-300">{fmt(calc.pesoVazio * calc.bracoVazio, 1)}</td>
                    <td className="print:hidden" /><td className="print:hidden" />
                  </tr>
                )}
                {items.map((it) => {
                  const isFuel = String(it.categoria || '').toUpperCase() === 'COMBUSTIVEL';
                  const pesoEfetivo = n(it.peso_sem_combustivel) * (isFuel ? fuelPct / 100 : 1);
                  return (
                    <tr key={it.id} className="border-b border-slate-900/70 odd:bg-slate-900/20">
                      <td className="px-2 py-1.5">
                        <p className="font-medium text-slate-200">{it.descricao}</p>
                        <p className="text-[10px] uppercase text-slate-500">
                          {CATEGORIAS.find((c) => c.value === String(it.categoria).toUpperCase())?.label || 'Outro'}
                        </p>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-slate-200 outline-none hover:border-slate-700 focus:border-ctm-teal"
                          defaultValue={it.peso_sem_combustivel ?? 0}
                          onBlur={(e) => updateItem(it, { peso_sem_combustivel: n(e.target.value) })}
                        />
                        {isFuel && fuelPct < 100 && (
                          <p className="text-[10px] text-cyan-400">→ {fmt(pesoEfetivo, 1)}</p>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <input
                          className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-slate-200 outline-none hover:border-slate-700 focus:border-ctm-teal"
                          defaultValue={it['braço_posicao'] ?? 0}
                          onBlur={(e) => updateItem(it, { 'braço_posicao': n(e.target.value) })}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-300">
                        {fmt(pesoEfetivo * n(it['braço_posicao']), 1)}
                      </td>
                      <td className="px-2 py-1.5 text-center print:hidden">
                        <input
                          type="checkbox"
                          checked={it.incluir_no_calculo !== false}
                          onChange={(e) => updateItem(it, { incluir_no_calculo: e.target.checked })}
                          className="h-3.5 w-3.5 accent-cyan-500"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right print:hidden">
                        <button onClick={() => deleteItem(it.id)} className="text-slate-500 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && !calc.temVazio && (
                  <tr><td colSpan={6} className="py-8 text-center text-slate-500">Nenhuma estação cadastrada</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 text-sm font-bold text-slate-100">
                  <td className="px-2 py-2">TOTAL</td>
                  <td className="px-2 py-2 text-right">{fmt(calc.pesoTotal, 1)}</td>
                  <td className="px-2 py-2 text-right text-cyan-400">{fmt(calc.cg, 3)}</td>
                  <td className="px-2 py-2 text-right">{fmt(calc.momentoTotal, 1)}</td>
                  <td className="print:hidden" /><td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Simulador de combustível */}
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40 p-4 print:hidden">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Fuel className="h-3.5 w-3.5 text-cyan-400" /> Simulação de combustível a bordo
              </span>
              <span className="font-bold text-cyan-400">{fuelPct}% · {fmt(calc.pesoCombustivel, 1)} kg</span>
            </div>
            <input
              type="range" min={0} max={100} step={5} value={fuelPct}
              onChange={(e) => setFuelPct(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
        </div>

        {/* Gráficos */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Gauge className="h-4 w-4 text-cyan-400" /> Envelope de Centro de Gravidade
            </h3>
            {envelope ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart margin={{ top: 10, right: 16, bottom: 16, left: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.25} />
                  <XAxis
                    type="number" dataKey="cg" name="CG"
                    domain={[envelope.cgFwd - 0.15, envelope.cgAft + 0.15]}
                    tickFormatter={(v) => Number(v).toFixed(2)}
                    stroke="hsl(var(--muted-foreground))" fontSize={11}
                    label={{ value: 'CG (m)', position: 'insideBottom', offset: -8, fontSize: 11 }}
                  />
                  <YAxis
                    type="number" dataKey="peso" name="Peso"
                    domain={[Math.round(envelope.pesoMin * 0.9), Math.round(envelope.mtow * 1.05)]}
                    stroke="hsl(var(--muted-foreground))" fontSize={11}
                    label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <ReferenceArea
                    x1={envelope.cgFwd} x2={envelope.cgAft}
                    y1={envelope.pesoMin} y2={envelope.mtow}
                    fill="#06b6d4" fillOpacity={0.12} stroke="#06b6d4" strokeOpacity={0.5}
                  />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }}
                    formatter={(v: any, k: any) => [Number(v).toFixed(k === 'cg' ? 3 : 1), k === 'cg' ? 'CG (m)' : 'Peso (kg)']}
                  />
                  <Scatter
                    name="Condição atual"
                    data={[{ cg: calc.cg, peso: calc.pesoTotal }]}
                    fill={calc.dentroLimites ? '#10b981' : '#ef4444'}
                    shape="circle"
                    line={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-xs text-slate-500">
                Informe MTOW e os limites de CG na ficha abaixo para desenhar o envelope.
              </p>
            )}
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Ponto atual: CG {fmt(calc.cg, 3)} m · {fmt(calc.pesoTotal, 1)} kg
            </p>
          </div>

          {/* Limites / ficha técnica */}
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Dados Certificados da Aeronave</h3>
              <button
                onClick={saveLimits}
                disabled={savingLimits}
                className="inline-flex items-center gap-1.5 rounded-lg bg-ctm-teal px-3 py-1.5 text-xs font-semibold text-[hsl(var(--ctm-navy))] disabled:opacity-50 print:hidden"
              >
                {savingLimits ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {LIMITES.map((l) => (
                <label key={l.key} className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{l.label}</span>
                  <input
                    className="ctm-input w-full"
                    inputMode="decimal"
                    value={limits[l.key] ?? ''}
                    onChange={(e) => setLimits((p) => ({ ...p, [l.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, progress }: { label: string; value: string; sub?: string; progress?: number }) {
  const pct = progress != null && Number.isFinite(progress) ? Math.min(progress * 100, 130) : null;
  const over = pct != null && pct > 100;
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold tracking-tight text-slate-100">{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
      {pct != null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={cn('h-full rounded-full transition-all', over ? 'bg-red-500' : 'bg-cyan-500')}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
