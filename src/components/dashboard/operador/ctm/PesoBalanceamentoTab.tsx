/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Plus, X, Save, Loader2, Gauge, Scale, Trash2, CheckCircle2, AlertTriangle, Printer,
} from 'lucide-react';
import {
  ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const db = supabase as any;

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

const CATEGORIAS = ['TRIPULACAO', 'PASSAGEIRO', 'BAGAGEM', 'COMBUSTIVEL', 'OUTRO'];
const FUEL_DENSITY_KG_PER_L = 0.72;
const n = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);
const fmt = (v: number, d = 2) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const dateBR = (v: string) => v ? new Date(`${v}T00:00:00`).toLocaleDateString('pt-BR') : '—';

function calculateBalance(items: any[], wb: any, fuelLitros = 0) {
  const fuelStation = items.find((item) => String(item.categoria).toUpperCase() === 'COMBUSTIVEL');
  const fuelWeight = fuelLitros > 0 ? fuelLitros * FUEL_DENSITY_KG_PER_L : n(fuelStation?.peso_sem_combustivel);
  const lines = items.map((item) => {
    const isFuel = String(item.categoria || '').toUpperCase() === 'COMBUSTIVEL';
    const weight = isFuel ? fuelWeight : n(item.peso_kg ?? item.peso_sem_combustivel);
    const arm = n(item.braco_posicao ?? item['braço_posicao']);
    return { ...item, pesoCalculado: weight, bracoCalculado: arm, momentoCalculado: weight * arm, isFuel };
  });
  const emptyWeight = n(wb?.peso_vazio_padrao);
  const emptyArm = n(wb?.braco_cg_padrao);
  const totalWeight = emptyWeight + lines.reduce((sum, item) => sum + item.pesoCalculado, 0);
  const totalMoment = emptyWeight * emptyArm + lines.reduce((sum, item) => sum + item.momentoCalculado, 0);
  const cg = totalWeight > 0 ? totalMoment / totalWeight : 0;
  const zfw = totalWeight - (fuelStation ? fuelWeight : 0);
  const alerts: { level: 'error' | 'warn'; msg: string }[] = [];
  const mtow = n(wb?.peso_maximo_decolagem);
  const mlw = n(wb?.peso_maximo_pouso);
  const mzfw = n(wb?.peso_maximo_sem_combustivel);
  const cgFwd = n(wb?.cg_limite_dianteiro);
  const cgAft = n(wb?.cg_limite_traseiro);
  if (mtow > 0 && totalWeight > mtow) alerts.push({ level: 'error', msg: `Peso acima do MTOW em ${fmt(totalWeight - mtow)} kg` });
  if (mzfw > 0 && zfw > mzfw) alerts.push({ level: 'error', msg: `ZFW acima do máximo em ${fmt(zfw - mzfw)} kg` });
  if (mlw > 0 && totalWeight > mlw) alerts.push({ level: 'warn', msg: 'Peso acima do MLW — planeje consumo antes do pouso' });
  if (cgFwd > 0 && cg < cgFwd) alerts.push({ level: 'error', msg: 'CG à frente do limite dianteiro' });
  if (cgAft > 0 && cg > cgAft) alerts.push({ level: 'error', msg: 'CG atrás do limite traseiro' });
  const hasLimits = mtow > 0 && cgFwd > 0 && cgAft > 0;
  return { lines, totalWeight, totalMoment, cg, zfw, mtow, mlw, mzfw, cgFwd, cgAft, alerts, dentroLimites: hasLimits && totalWeight > 0 && !alerts.some((alert) => alert.level === 'error') };
}

/* ---------------------------------------------------------------------- */
/* Indicador visual de CG — aviãozinho que se inclina conforme o desvio   */
/* ---------------------------------------------------------------------- */

function AircraftCGIndicator({ calc }: { calc: any }) {
  const { cg, cgFwd, cgAft, totalWeight, mtow, alerts } = calc;
  const hasEnvelope = cgFwd > 0 && cgAft > 0 && cgAft > cgFwd;

  // posição normalizada do CG dentro do envelope: 0 = limite dianteiro, 1 = limite traseiro
  const range = hasEnvelope ? cgAft - cgFwd : 0;
  const pos = hasEnvelope ? (cg - cgFwd) / range : 0.5;

  // quanto passou do limite (negativo = à frente do dianteiro, positivo = atrás do traseiro)
  const overshoot = pos < 0 ? pos : pos > 1 ? pos - 1 : 0;

  // ângulo de inclinação do aviãozinho: nariz baixo (CG à frente), nariz alto (CG atrás)
  const tiltDeg = Math.max(-22, Math.min(22, overshoot * 45));

  const overWeight = mtow > 0 && totalWeight > mtow;
  const hasError = alerts?.some((a: any) => a.level === 'error') || overWeight;
  const hasWarn = !hasError && alerts?.some((a: any) => a.level === 'warn');

  const bodyColor = hasError ? '#f87171' : hasWarn ? '#fbbf24' : '#45d1b5';
  const statusLabel = !hasEnvelope
    ? 'Sem limites cadastrados'
    : hasError
    ? (overshoot < 0 ? 'CG muito à frente do limite' : overshoot > 0 ? 'CG muito atrás do limite' : 'Fora dos limites')
    : hasWarn
    ? 'Atenção'
    : 'Dentro do envelope';

  // ---- régua estendida: mostra visualmente o quanto passou do limite ----
  // faixa exibida: -30% a 130% do range original (margem de "excesso" visível pra ambos os lados)
  const DISPLAY_MIN = -0.3;
  const DISPLAY_MAX = 1.3;
  const DISPLAY_SPAN = DISPLAY_MAX - DISPLAY_MIN;

  const toDisplayPct = (value: number) => ((value - DISPLAY_MIN) / DISPLAY_SPAN) * 100;
  const clampedPos = Math.max(DISPLAY_MIN, Math.min(DISPLAY_MAX, pos));
  const markerPct = toDisplayPct(clampedPos);
  const safeZoneStartPct = toDisplayPct(0);
  const safeZoneEndPct = toDisplayPct(1);
  const isOutOfRange = pos < DISPLAY_MIN || pos > DISPLAY_MAX;

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-200">Situação do carregamento</h3><span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">CG em tempo real</span></div>

      <div className="flex items-center justify-center py-4">
        <svg width="280" height="160" viewBox="0 0 280 160" role="img" aria-label="Avião indicando o centro de gravidade">
          <defs>
            <linearGradient id="aircraftBody" x1="0" x2="1"><stop offset="0" stopColor={bodyColor} stopOpacity="0.72" /><stop offset="0.55" stopColor={bodyColor} /><stop offset="1" stopColor={bodyColor} stopOpacity="0.82" /></linearGradient>
            <filter id="aircraftGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <line x1="14" y1="98" x2="266" y2="98" stroke="#334155" strokeWidth="1" strokeDasharray="5 5" />
          <g transform={`rotate(${tiltDeg} 140 84)`} style={{ transition: 'transform 300ms ease-out' }} filter="url(#aircraftGlow)">
            {/* avião em vista lateral: nariz à direita */}
            <path d="M34 84 C55 78 70 77 92 77 L205 77 C224 77 240 80 255 84 C240 88 224 91 205 91 L92 91 C70 91 55 90 34 84Z" fill="url(#aircraftBody)" />
            <path d="M187 77 L226 48 L239 48 L215 79Z" fill={bodyColor} opacity="0.88" />
            <path d="M187 91 L226 120 L239 120 L215 89Z" fill={bodyColor} opacity="0.62" />
            <path d="M78 78 L53 55 L62 54 L104 78Z" fill={bodyColor} opacity="0.7" />
            <path d="M78 90 L53 113 L62 114 L104 90Z" fill={bodyColor} opacity="0.52" />
            <path d="M38 82 L18 66 L24 84 L18 102 L38 86Z" fill={bodyColor} opacity="0.72" />
            <path d="M220 78 L250 84 L220 90Z" fill={bodyColor} />
            <path d="M132 78 L142 78 L139 89 L129 89Z" fill="#dbeafe" opacity="0.85" />
            <path d="M145 78 L155 78 L152 89 L142 89Z" fill="#dbeafe" opacity="0.62" />
            <circle cx={140 - (pos - 0.5) * 120} cy="84" r="7" fill="#0f172a" stroke="#fff" strokeWidth="2" />
            <circle cx={140 - (pos - 0.5) * 120} cy="84" r="2.5" fill={bodyColor} />
          </g>
        </svg>
      </div>

      {hasEnvelope && (
        <div className="mb-2">
          <div className="relative h-3 overflow-visible rounded-full bg-slate-800">
            {/* zona segura (dentro do envelope) */}
            <div
              className="absolute top-0 h-3 rounded-full bg-ctm-teal/25"
              style={{ left: `${safeZoneStartPct}%`, width: `${safeZoneEndPct - safeZoneStartPct}%` }}
            />
            {/* limites dianteiro/traseiro */}
            <div className="absolute top-0 h-3 w-[2px] bg-slate-500" style={{ left: `${safeZoneStartPct}%` }} />
            <div className="absolute top-0 h-3 w-[2px] bg-slate-500" style={{ left: `${safeZoneEndPct}%` }} />
            {/* marcador do CG, pode ir além da zona segura */}
            <div
              className="absolute -top-1.5 h-6 w-6 -translate-x-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${markerPct}%`, background: bodyColor }}
              title={`CG ${fmt(cg, 3)} m`}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>Dianteiro {fmt(cgFwd, 3)} m</span>
            <span>Traseiro {fmt(cgAft, 3)} m</span>
          </div>
          {overshoot !== 0 && (
            <p className="mt-1 text-center text-[11px] text-slate-400">
              {isOutOfRange ? 'Muito' : ''} {fmt(Math.abs(overshoot) * range, 3)} m {overshoot < 0 ? 'à frente do limite dianteiro' : 'atrás do limite traseiro'}
            </p>
          )}
        </div>
      )}

      <p
        className={cn(
          'text-center text-sm font-semibold',
          hasError ? 'text-red-400' : hasWarn ? 'text-amber-400' : 'text-ctm-teal'
        )}
      >
        {statusLabel}
      </p>
    </div>
  );
}

export function PesoBalanceamentoTab({ aircraftId }: { aircraftId: string }) {
  const [activeTab, setActiveTab] = useState<'ficha' | 'carregamentos'>('ficha');
  const [aeronave, setAeronave] = useState<any>(null);
  const [wb, setWb] = useState<any>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLimits, setSavingLimits] = useState(false);
  const [showStationForm, setShowStationForm] = useState(false);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [stationForm, setStationForm] = useState({ descricao: '', categoria: 'OUTRO', peso: '', braco: '' });
  const [loadings, setLoadings] = useState<any[]>([]);
  const [showNewLoading, setShowNewLoading] = useState(false);
  const [loadingForm, setLoadingForm] = useState({ data_voo: new Date().toISOString().slice(0, 10), numero_voo: '', fuel_litros: '' });
  const [loadingItems, setLoadingItems] = useState<any[]>([]);
  const [justification, setJustification] = useState('');
  const [savingLoading, setSavingLoading] = useState(false);

  async function loadTechnicalSheet() {
    setLoading(true);
    const [{ data: aircraft }, { data: sheet, error: sheetError }] = await Promise.all([
      db.from('aeronave').select('matricula, modelo, fabricante, numero_serie, ano').eq('id', aircraftId).maybeSingle(),
      db.from('ctm_peso_balanceamento').select('*').eq('aeronave_id', aircraftId).maybeSingle(),
    ]);
    if (sheetError) toast.error('Não foi possível carregar a ficha técnica');
    setAeronave(aircraft ?? null);
    setWb(sheet ?? null);
    setLimits(LIMITES.reduce((acc, limit) => ({ ...acc, [limit.key]: sheet?.[limit.key] != null ? String(sheet[limit.key]) : '' }), {}));
    if (sheet?.id) {
      const { data, error } = await db.from('ctm_estacoes').select('*').eq('peso_balanceamento_id', sheet.id).order('criado_em', { ascending: true });
      if (error) toast.error('Não foi possível carregar as estações');
      setStations(data ?? []);
    } else setStations([]);
    setLoading(false);
  }

  async function loadLoadings() {
    const { data, error } = await db.from('ctm_carregamentos').select('*').eq('aeronave_id', aircraftId).order('data_voo', { ascending: false }).order('criado_em', { ascending: false });
    if (error) toast.error('Não foi possível carregar os carregamentos');
    setLoadings(data ?? []);
  }

  useEffect(() => { void Promise.all([loadTechnicalSheet(), loadLoadings()]); }, [aircraftId]);

  async function ensureWb() {
    if (wb?.id) return wb.id;
    const { data, error } = await db.from('ctm_peso_balanceamento').insert({
      aeronave_id: aircraftId,
      peso_vazio_padrao: 0,
      braco_cg_padrao: 0,
      momento_padrao: 0,
      peso_maximo_decolagem: 0,
      peso_maximo_pouso: 0,
      peso_maximo_sem_combustivel: 0,
      cg_limite_dianteiro: 0,
      cg_limite_traseiro: 0,
      mac_comprimento: 0,
      lemac_distancia: 0,
      capacidade_combustivel_total: 0,
      capacidade_combustivel_util: 0,
    }).select('*').maybeSingle();
    if (error) { toast.error(`Erro ao criar ficha: ${error.message}`); return null; }
    setWb(data);
    return data?.id ?? null;
  }

  async function saveLimits() {
    setSavingLimits(true);
    const id = await ensureWb();
    if (!id) { setSavingLimits(false); return; }
    const payload: any = {};
    LIMITES.forEach((limit) => { payload[limit.key] = limits[limit.key] === '' ? null : Number(limits[limit.key]); });
    const { error } = await db.from('ctm_peso_balanceamento').update(payload).eq('id', id);
    if (error) toast.error('Erro ao salvar limites');
    else { toast.success('Ficha técnica atualizada'); await loadTechnicalSheet(); }
    setSavingLimits(false);
  }

  async function saveStation() {
    if (!stationForm.descricao.trim()) return toast.error('Descrição é obrigatória');
    const id = await ensureWb();
    if (!id) return;
    const weight = n(stationForm.peso);
    const arm = n(stationForm.braco);
    const { error } = await db.from('ctm_estacoes').insert({
      peso_balanceamento_id: id,
      descricao: stationForm.descricao.trim().toUpperCase(),
      categoria: stationForm.categoria,
      peso_sem_combustivel: weight,
      'braço_posicao': arm,
      momento: weight * arm,
      incluir_no_calculo: true,
    });
    if (error) return toast.error(`Erro ao adicionar estação: ${error.message}`);
    toast.success('Estação adicionada');
    setStationForm({ descricao: '', categoria: 'OUTRO', peso: '', braco: '' });
    setShowStationForm(false);
    await loadTechnicalSheet();
  }

  async function updateStation(item: any, patch: any) {
    const weight = patch.peso_sem_combustivel ?? item.peso_sem_combustivel;
    const arm = patch['braço_posicao'] ?? item['braço_posicao'];
    const merged = { ...patch, momento: n(weight) * n(arm) };
    setStations((current) => current.map((station) => station.id === item.id ? { ...station, ...merged } : station));
    const { error } = await db.from('ctm_estacoes').update(merged).eq('id', item.id);
    if (error) toast.error('Erro ao atualizar estação');
  }

  async function deleteStation(id: string) {
    if (!window.confirm('Excluir esta estação da ficha técnica?')) return;
    const { error } = await db.from('ctm_estacoes').delete().eq('id', id);
    if (error) return toast.error('Erro ao excluir estação');
    setStations((current) => current.filter((station) => station.id !== id));
  }

  function openNewLoading() {
    if (!wb?.id) return toast.error('Salve a ficha técnica antes de criar um carregamento');
    setLoadingItems(stations.filter((station) => station.incluir_no_calculo !== false).map((station) => ({
      estacao_id: station.id,
      descricao: station.descricao,
      categoria: station.categoria,
      braco_posicao: n(station['braço_posicao']),
      peso_kg: String(String(station.categoria).toUpperCase() === 'COMBUSTIVEL' ? '' : n(station.peso_sem_combustivel)),
    })));
    setJustification('');
    setShowNewLoading(true);
  }

  const loadingCalc = useMemo(() => calculateBalance(loadingItems, wb, n(loadingForm.fuel_litros)), [loadingItems, wb, loadingForm.fuel_litros]);
  const requiresJustification = loadingCalc.alerts.length > 0;

  function updateLoadingItem(id: string, value: string) {
    setLoadingItems((current) => current.map((item) => item.estacao_id === id ? { ...item, peso_kg: value } : item));
  }

  async function finalizeLoading() {
    if (!wb?.id) return toast.error('Ficha técnica não encontrada');
    if (!loadingForm.data_voo) return toast.error('Informe a data do voo');
    if (requiresJustification && !justification.trim()) return toast.error('Informe a justificativa operacional para finalizar fora do envelope');
    if (!loadingCalc.dentroLimites && !requiresJustification) return toast.error('Preencha os limites da ficha e confira o carregamento');
    setSavingLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const pilot = userData.user?.email || 'Piloto responsável';
    const { data: created, error } = await db.from('ctm_carregamentos').insert({
      aeronave_id: aircraftId,
      peso_balanceamento_id: wb.id,
      data_voo: loadingForm.data_voo,
      numero_voo: loadingForm.numero_voo.trim() || null,
      piloto_responsavel: pilot,
      fuel_litros: n(loadingForm.fuel_litros),
      peso_total_kg: loadingCalc.totalWeight,
      cg_calculado: loadingCalc.cg,
      dentro_dos_limites: loadingCalc.dentroLimites,
      status: 'FINALIZADO',
      snapshot_limites: {
        ficha_tecnica: { ...wb, estacoes: stations },
        justificativa_operacional: justification.trim() || null,
        densidade_combustivel_kg_l: FUEL_DENSITY_KG_PER_L,
      },
    }).select('id').maybeSingle();
    if (error || !created?.id) {
      toast.error(`Erro ao finalizar carregamento: ${error?.message || 'registro não criado'}`);
      setSavingLoading(false);
      return;
    }
    const { error: itemsError } = await db.from('ctm_carregamento_itens').insert(loadingCalc.lines.map((item) => ({
      carregamento_id: created.id,
      estacao_id: item.estacao_id,
      descricao: item.descricao,
      categoria: item.categoria || 'OUTRO',
      braco_posicao: item.bracoCalculado,
      peso_kg: item.pesoCalculado,
      momento: item.momentoCalculado,
    })));
    if (itemsError) {
      toast.error(`Carregamento criado, mas os itens não foram salvos: ${itemsError.message}`);
      setSavingLoading(false);
      return;
    }
    toast.success('Carregamento finalizado');
    setShowNewLoading(false);
    setLoadingForm({ data_voo: new Date().toISOString().slice(0, 10), numero_voo: '', fuel_litros: '' });
    await loadLoadings();
    setSavingLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-950/50 p-16"><Loader2 className="h-6 w-6 animate-spin text-ctm-teal" /></div>;

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ctm-teal/25 bg-ctm-teal/10 text-ctm-teal"><Scale className="h-6 w-6" /></div>
          <div><h2 className="text-lg font-bold text-slate-100">Peso &amp; Balanceamento</h2><p className="text-xs text-slate-400">{[aeronave?.matricula, [aeronave?.fabricante, aeronave?.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '—'}</p></div>
        </div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 self-start rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 print:hidden"><Printer className="h-3.5 w-3.5" /> Imprimir</button>
      </div>

      <div className="flex gap-2 border-b border-slate-800 print:hidden">
        <TabButton active={activeTab === 'ficha'} onClick={() => setActiveTab('ficha')}>Ficha Técnica <span className="hidden sm:inline">(oficina)</span></TabButton>
        <TabButton active={activeTab === 'carregamentos'} onClick={() => setActiveTab('carregamentos')}>Carregamentos <span className="ml-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px]">{loadings.length}</span></TabButton>
      </div>

      {activeTab === 'ficha' ? <TechnicalSheet
        wb={wb} stations={stations} limits={limits} setLimits={setLimits} savingLimits={savingLimits} saveLimits={saveLimits}
        showStationForm={showStationForm} setShowStationForm={setShowStationForm} stationForm={stationForm} setStationForm={setStationForm}
        saveStation={saveStation} updateStation={updateStation} deleteStation={deleteStation}
      /> : <LoadingsView
        loadings={loadings} showNewLoading={showNewLoading} openNewLoading={openNewLoading} setShowNewLoading={setShowNewLoading}
        loadingForm={loadingForm} setLoadingForm={setLoadingForm} loadingItems={loadingItems} updateLoadingItem={updateLoadingItem}
        loadingCalc={loadingCalc} justification={justification} setJustification={setJustification} finalizeLoading={finalizeLoading} savingLoading={savingLoading}
      />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={cn('border-b-2 px-3 py-3 text-sm font-semibold transition-colors', active ? 'border-ctm-teal text-ctm-teal' : 'border-transparent text-slate-500 hover:text-slate-200')}>{children}</button>;
}

function TechnicalSheet({ wb, stations, limits, setLimits, savingLimits, saveLimits, showStationForm, setShowStationForm, stationForm, setStationForm, saveStation, updateStation, deleteStation }: any) {
  const calc = useMemo(() => calculateBalance(stations, wb), [stations, wb]);
  const envelope = calc.cgFwd > 0 && calc.cgAft > 0 && calc.mtow > 0 ? { cgFwd: calc.cgFwd, cgAft: calc.cgAft, mtow: calc.mtow, pesoMin: Math.max(calc.totalWeight || calc.mtow * 0.55, calc.mtow * 0.4) } : null;
  return <>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi label="Peso de referência" value={`${fmt(calc.totalWeight, 1)} kg`} sub={calc.mtow ? `MTOW ${fmt(calc.mtow, 0)} kg` : undefined} />
      <Kpi label="CG de referência" value={`${fmt(calc.cg, 3)} m`} sub={calc.cgFwd ? `Limites ${fmt(calc.cgFwd, 3)} – ${fmt(calc.cgAft, 3)}` : undefined} />
      <Kpi label="Momento" value={fmt(calc.totalMoment, 1)} sub="kg·m" />
      <Kpi label="Estações" value={String(stations.length)} sub="estrutura cadastrada" />
      <Kpi label="Envelope" value={envelope ? 'Configurado' : 'Pendente'} sub="limites certificados" />
    </div>
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_1fr]">
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-200">Estrutura da ficha técnica</h3><p className="text-xs text-slate-500">Pesos e braços de referência mantidos pela oficina.</p></div><button onClick={() => setShowStationForm((value: boolean) => !value)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#45d1b5] bg-transparent px-4 py-1.5 text-sm font-medium text-[#45d1b5] transition-colors hover:bg-[#45d1b5]/10 print:hidden"><Plus className="h-3.5 w-3.5" /> Nova estação</button></div>
        {showStationForm && <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 print:hidden"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-slate-300">Nova estação</p><button onClick={() => setShowStationForm(false)}><X className="h-4 w-4 text-slate-400" /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input className="ctm-input" placeholder="Descrição (ex.: PILOTO)" value={stationForm.descricao} onChange={(e) => setStationForm((form: any) => ({ ...form, descricao: e.target.value }))} /><select className="ctm-input" value={stationForm.categoria} onChange={(e) => setStationForm((form: any) => ({ ...form, categoria: e.target.value }))}>{CATEGORIAS.map((category) => <option key={category} value={category}>{category}</option>)}</select><input className="ctm-input" placeholder="Peso de referência (kg)" inputMode="decimal" value={stationForm.peso} onChange={(e) => setStationForm((form: any) => ({ ...form, peso: e.target.value }))} /><input className="ctm-input" placeholder="Braço (m)" inputMode="decimal" value={stationForm.braco} onChange={(e) => setStationForm((form: any) => ({ ...form, braco: e.target.value }))} /></div><div className="mt-3 flex justify-end"><button onClick={saveStation} className="inline-flex items-center gap-1.5 rounded-lg bg-ctm-teal px-3 py-1.5 text-xs font-semibold text-[hsl(var(--ctm-navy))]"><Save className="h-3.5 w-3.5" /> Salvar estação</button></div></div>}
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500"><th className="px-2 py-2 text-left">Estação</th><th className="px-2 py-2 text-right">Peso (kg)</th><th className="px-2 py-2 text-right">Braço (m)</th><th className="px-2 py-2 text-right">Momento</th><th className="px-2 py-2 print:hidden" /></tr></thead><tbody>{stations.map((station: any) => <tr key={station.id} className="border-b border-slate-900/70 odd:bg-slate-900/20"><td className="px-2 py-2"><p className="font-medium text-slate-200">{station.descricao}</p><p className="text-[10px] uppercase text-slate-500">{station.categoria || 'OUTRO'}</p></td><td className="px-2 py-1.5 text-right"><input className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-slate-200 outline-none hover:border-slate-700 focus:border-ctm-teal" defaultValue={station.peso_sem_combustivel ?? 0} onBlur={(e) => updateStation(station, { peso_sem_combustivel: n(e.target.value) })} /></td><td className="px-2 py-1.5 text-right"><input className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-slate-200 outline-none hover:border-slate-700 focus:border-ctm-teal" defaultValue={station['braço_posicao'] ?? 0} onBlur={(e) => updateStation(station, { 'braço_posicao': n(e.target.value) })} /></td><td className="px-2 py-2 text-right text-slate-300">{fmt(n(station.peso_sem_combustivel) * n(station['braço_posicao']), 1)}</td><td className="px-2 py-2 text-right print:hidden"><button onClick={() => deleteStation(station.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button></td></tr>)}{stations.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-500">Nenhuma estação cadastrada.</td></tr>}</tbody></table></div>
      </div>
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Gauge className="h-4 w-4 text-cyan-400" /> Envelope de Centro de Gravidade</h3>{envelope ? <ResponsiveContainer width="100%" height={280}><ComposedChart margin={{ top: 10, right: 16, bottom: 16, left: 0 }}><CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.25} /><XAxis type="number" dataKey="cg" domain={[envelope.cgFwd - 0.15, envelope.cgAft + 0.15]} tickFormatter={(value) => Number(value).toFixed(2)} stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis type="number" dataKey="peso" domain={[Math.round(envelope.pesoMin * 0.9), Math.round(envelope.mtow * 1.05)]} stroke="hsl(var(--muted-foreground))" fontSize={11} /><ReferenceArea x1={envelope.cgFwd} x2={envelope.cgAft} y1={envelope.pesoMin} y2={envelope.mtow} fill="#06b6d4" fillOpacity={0.12} stroke="#06b6d4" strokeOpacity={0.5} /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }} /><Scatter name="Referência" data={[{ cg: calc.cg, peso: calc.totalWeight }]} fill="#10b981" shape="circle" /></ComposedChart></ResponsiveContainer> : <p className="py-12 text-center text-xs text-slate-500">Informe MTOW e os limites de CG para desenhar o envelope.</p>}<p className="mt-2 text-center text-[11px] text-slate-500">Ponto de referência: CG {fmt(calc.cg, 3)} m · {fmt(calc.totalWeight, 1)} kg</p></div>

        <AircraftCGIndicator calc={calc} />

        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5"><div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-200">Limites certificados</h3><p className="text-xs text-slate-500">Usados como base dos carregamentos dos pilotos.</p></div><button onClick={saveLimits} disabled={savingLimits} className="inline-flex items-center gap-1.5 rounded-lg bg-ctm-teal px-3 py-1.5 text-xs font-semibold text-[hsl(var(--ctm-navy))] disabled:opacity-50 print:hidden">{savingLimits ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar</button></div><div className="grid grid-cols-2 gap-3">{LIMITES.map((limit) => <label key={limit.key} className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{limit.label}</span><input className="ctm-input w-full" inputMode="decimal" value={limits[limit.key] ?? ''} onChange={(e) => setLimits((current) => ({ ...current, [limit.key]: e.target.value }))} /></label>)}</div></div>
      </div>
    </div>
  </>;
}

function LoadingsView({ loadings, showNewLoading, openNewLoading, setShowNewLoading, loadingForm, setLoadingForm, loadingItems, updateLoadingItem, loadingCalc, justification, setJustification, finalizeLoading, savingLoading }: any) {
  return <div className="space-y-5"><div className="flex flex-col gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-bold text-slate-100">Carregamentos dos voos</h3><p className="text-xs text-slate-500">A ficha técnica é copiada como snapshot. O piloto informa somente os pesos do voo.</p></div><button onClick={openNewLoading} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#45d1b5] bg-transparent px-4 py-1.5 text-sm font-medium text-[#45d1b5] transition-colors hover:bg-[#45d1b5]/10"><Plus className="h-3.5 w-3.5" /> Novo Carregamento</button></div>
    {showNewLoading && <LoadingForm setShowNewLoading={setShowNewLoading} loadingForm={loadingForm} setLoadingForm={setLoadingForm} loadingItems={loadingItems} updateLoadingItem={updateLoadingItem} loadingCalc={loadingCalc} justification={justification} setJustification={setJustification} finalizeLoading={finalizeLoading} savingLoading={savingLoading} />}
    <div className="overflow-x-auto rounded-2xl border border-slate-800/70 bg-slate-950/60"><table className="w-full text-sm"><thead><tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Data</th><th className="px-4 py-3">Voo</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3 text-right">Peso</th><th className="px-4 py-3 text-right">CG</th><th className="px-4 py-3 text-right">Situação</th></tr></thead><tbody>{loadings.map((loading: any) => <tr key={loading.id} className="border-b border-slate-900/70"><td className="px-4 py-3 text-slate-300">{dateBR(loading.data_voo)}</td><td className="px-4 py-3 text-slate-200">{loading.numero_voo || 'Sem número'}</td><td className="px-4 py-3 text-slate-400">{loading.piloto_responsavel}</td><td className="px-4 py-3 text-right text-slate-300">{fmt(n(loading.peso_total_kg), 1)} kg</td><td className="px-4 py-3 text-right text-slate-300">{fmt(n(loading.cg_calculado), 3)} m</td><td className="px-4 py-3 text-right"><span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs', loading.dentro_dos_limites ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>{loading.dentro_dos_limites ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {loading.dentro_dos_limites ? 'Dentro do envelope' : 'Com justificativa'}</span></td></tr>)}{loadings.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-500">Nenhum carregamento finalizado.</td></tr>}</tbody></table></div>
  </div>;
}

function LoadingForm({ setShowNewLoading, loadingForm, setLoadingForm, loadingItems, updateLoadingItem, loadingCalc, justification, setJustification, finalizeLoading, savingLoading }: any) {
  return <div className="rounded-2xl border border-cyan-500/20 bg-slate-950/80 p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-base font-bold text-slate-100">Novo carregamento</h3><p className="text-xs text-slate-500">Braços e limites vieram da ficha técnica e não podem ser alterados aqui.</p></div><button onClick={() => setShowNewLoading(false)}><X className="h-5 w-5 text-slate-400" /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><label><span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Data do voo</span><input type="date" className="ctm-input w-full" value={loadingForm.data_voo} onChange={(e) => setLoadingForm((form: any) => ({ ...form, data_voo: e.target.value }))} /></label><label><span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Número do voo</span><input className="ctm-input w-full" placeholder="Ex.: 1234" value={loadingForm.numero_voo} onChange={(e) => setLoadingForm((form: any) => ({ ...form, numero_voo: e.target.value }))} /></label><label><span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">Combustível (litros)</span><input type="number" min="0" className="ctm-input w-full" placeholder="0" value={loadingForm.fuel_litros} onChange={(e) => setLoadingForm((form: any) => ({ ...form, fuel_litros: e.target.value }))} /></label></div><div className="mt-5 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500"><th className="px-2 py-2 text-left">Estação</th><th className="px-2 py-2 text-right">Peso informado (kg)</th><th className="px-2 py-2 text-right">Braço travado (m)</th><th className="px-2 py-2 text-right">Momento</th></tr></thead><tbody>{loadingItems.map((item: any) => <tr key={item.estacao_id} className="border-b border-slate-900/70"><td className="px-2 py-2 text-slate-200">{item.descricao}<span className="ml-2 text-[10px] uppercase text-slate-500">{item.categoria}</span></td><td className="px-2 py-1.5 text-right"><input type="number" min="0" className="w-28 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right text-slate-100 outline-none focus:border-cyan-500" placeholder="0" value={item.peso_kg} onChange={(e) => updateLoadingItem(item.estacao_id, e.target.value)} /></td><td className="px-2 py-2 text-right text-slate-400">{fmt(item.braco_posicao, 3)}</td><td className="px-2 py-2 text-right text-slate-300">{fmt(n(item.peso_kg) * n(item.braco_posicao), 1)}</td></tr>)}</tbody></table></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5"><Kpi label="Peso total" value={`${fmt(loadingCalc.totalWeight, 1)} kg`} /><Kpi label="ZFW" value={`${fmt(loadingCalc.zfw, 1)} kg`} /><Kpi label="CG" value={`${fmt(loadingCalc.cg, 3)} m`} /><Kpi label="MTOW" value={`${fmt(loadingCalc.mtow, 1)} kg`} /><Kpi label="Resultado" value={loadingCalc.dentroLimites ? 'Aprovado' : 'Verificar'} /></div>

    <div className="mt-5">
      <AircraftCGIndicator calc={loadingCalc} />
    </div>

    {loadingCalc.alerts.length > 0 && <div className="mt-4 space-y-2">{loadingCalc.alerts.map((alert: any, index: number) => <div key={index} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs', alert.level === 'error' ? 'border-red-500/25 bg-red-500/10 text-red-400' : 'border-amber-500/25 bg-amber-500/10 text-amber-400')}><AlertTriangle className="h-4 w-4 shrink-0" /> {alert.msg}</div>)}</div>}{loadingCalc.alerts.length > 0 && <label className="mt-4 block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-amber-400">Justificativa operacional obrigatória</span><textarea className="ctm-input min-h-20 w-full" value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Descreva a autorização e a ação operacional prevista." /></label>}<div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowNewLoading(false)} className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200">Cancelar</button><button onClick={finalizeLoading} disabled={savingLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-ctm-teal px-4 py-2 text-xs font-semibold text-[hsl(var(--ctm-navy))] disabled:opacity-50">{savingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Finalizar carregamento</button></div></div>;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-bold tracking-tight text-slate-100">{value}</p>{sub && <p className="text-[10px] text-slate-500">{sub}</p>}</div>;
}