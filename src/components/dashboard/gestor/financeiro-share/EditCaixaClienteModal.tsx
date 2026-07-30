import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import AnexosDinamicosField, {
  type AnexoLinha,
  type AnexoTipoId,
} from "@/components/dashboard/gestor/FinanceiroCotista/AnexosDinamicosField";
import FornecedorPickerCombo from "./FornecedorPickerCombo";
import {
  X, Save, Loader2, Wallet, CalendarRange, ClipboardList,
  Info, CreditCard, Layers, Paperclip,
} from "lucide-react";

interface Props {
  movId: string;
  mov: any;
  onClose: () => void;
  onSaved: (movPatch: any) => void;
}

const inputCls =
  "w-full rounded-lg bg-slate-950/60 border border-slate-700/70 px-3 py-2 text-[13px] text-slate-100 outline-none transition focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-500/60 placeholder:text-slate-600";
const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5";

const TIPOS_RATEIO = [
  { id: "FIXO", label: "Fixo" },
  { id: "MENSAL", label: "Mensal" },
  { id: "EXTRA", label: "Extra" },
  { id: "VARIAVEL_POR_VOO", label: "Variável por Voo" },
  { id: "VARIAVEL_POR_HORA", label: "Variável por Hora" },
];
const FORMAS_PGTO = [
  { id: "PIX", label: "Pix" }, { id: "TED", label: "TED" },
  { id: "BOLETO", label: "Boleto" }, { id: "DINHEIRO", label: "Dinheiro" },
  { id: "CARTAO", label: "Cartão" }, { id: "TRANSFERENCIA", label: "Transferência" },
  { id: "DEBITO_AUTOMATICO", label: "Débito Automático" },
];

const numOrNull = (v: any) => (v === "" || v == null ? null : Number(v));

function Section({ icon, title, accent, children }: any) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-slate-900/50 to-slate-900/20 p-4 md:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}1A`, color: accent }}>{icon}</div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-200">{title}</h3>
        <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
      </div>
      {children}
    </section>
  );
}

function anexosFromMov(m: any): AnexoLinha[] {
  const list: AnexoLinha[] = [];
  const push = (tipo: AnexoTipoId, numero: string | null, url: string | null) => {
    if (url) list.push({ id: crypto.randomUUID(), tipo, numero: numero || "", url, file: null });
  };
  push("comprovante", m.numero_doc, m.comprovante_url);
  push("recibo", m.numero_recibo, m.recibo_url);
  push("nf", m.numero_nf, m.nf_url);
  push("boleto", m.numero_boleto, m.boleto_url);
  return list;
}

// Só grava os campos dos tipos de anexo presentes na tela — assim editar o
// lançamento nunca apaga NF/boleto/recibo que não foram tocados.
function anexosToPatch(anexos: AnexoLinha[]) {
  const patch: Record<string, string | null> = {};
  const apply = (t: AnexoTipoId, urlField: string, numeroField: string) => {
    const linhas = anexos.filter((a) => a.tipo === t);
    if (linhas.length === 0) return;
    const comUrl = linhas.find((a) => a.url) || linhas[0];
    patch[urlField] = comUrl?.url ?? null;
    patch[numeroField] = comUrl?.numero?.trim() || null;
  };
  apply("comprovante", "comprovante_url", "numero_doc");
  apply("recibo", "recibo_url", "numero_recibo");
  apply("nf", "nf_url", "numero_nf");
  apply("boleto", "boleto_url", "numero_boleto");
  return patch;
}

export default function EditCaixaClienteModal({ movId, mov: movInit, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mov, setMov] = useState<any>(movInit || {});
  const [rateio, setRateio] = useState<any>(null);
  const [anexos, setAnexos] = useState<AnexoLinha[]>(anexosFromMov(movInit || {}));
  const [categoriaCustoId, setCategoriaCustoId] = useState<string>("");
  const [subcategoria, setSubcategoria] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("rateio_despesas").select("*").eq("despesa_id", movId).maybeSingle();
      setRateio(r || null);
      if (r?.subcategoria_1) setSubcategoria(r.subcategoria_1 as string);
    })();
  }, [movId]);

  const { data: expenseConfigs = [] } = useQuery({
    queryKey: ["expense-configu-edit"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("expense_configu")
        .select("id, expense_type, subcategoria_1, subcategoria_2, subcategoria_3, subcategoria_4")
        .order("expense_type");
      return (data ?? []) as any[];
    },
  });

  const expenseOptions = expenseConfigs.map((c) => ({ id: c.id, label: c.expense_type }));
  useEffect(() => {
    if (categoriaCustoId || expenseConfigs.length === 0) return;
    const nome = String(movInit?.categoria_nome || "").trim().toLowerCase();
    if (!nome) return;
    const match = expenseConfigs.find((c) => String(c.expense_type || "").trim().toLowerCase() === nome);
    if (match) setCategoriaCustoId(match.id);
  }, [expenseConfigs, categoriaCustoId, movInit?.categoria_nome]);
  const selected = expenseConfigs.find((c) => c.id === categoriaCustoId);
  const subcatOptions = selected
    ? [selected.subcategoria_1, selected.subcategoria_2, selected.subcategoria_3, selected.subcategoria_4]
        .filter((s: string | null) => !!s && s.trim().length > 0)
        .map((s: string) => ({ id: s, label: s }))
    : [];

  const setM = (k: string, v: any) => setMov((s: any) => ({ ...s, [k]: v }));
  const setR = (k: string, v: any) => setRateio((s: any) => (s ? { ...s, [k]: v } : s));

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      const patch: any = {
        descricao: mov.descricao,
        fornecedor_nome: mov.fornecedor_nome,
        data_competencia: mov.data_competencia || null,
        data_vencimento: mov.data_vencimento || null,
        data_pagamento: mov.data_pagamento || null,
        forma_pagamento: mov.forma_pagamento,
        valor_rateado: numOrNull(mov.valor_rateado),
        observacoes: mov.observacoes || null,
        categoria_nome: selected?.expense_type ?? mov.categoria_nome ?? null,
        ...anexosToPatch(anexos),
      };
      const { error: e1 } = await supabase.from("movimentacoes").update(patch).eq("id", movId);
      if (e1) throw e1;
      if (rateio?.id) {
        await supabase.from("rateio_despesas").update({
          descricao_despesa: mov.descricao,
          tipo_rateio: rateio.tipo_rateio,
          forma_pagamento: mov.forma_pagamento,
          fornecedor_nome: mov.fornecedor_nome,
          data_vencimento: mov.data_vencimento || null,
          data_pagamento: mov.data_pagamento || null,
          categoria_custo: selected?.expense_type ?? rateio.categoria_custo ?? null,
          subcategoria_1: subcategoria || rateio.subcategoria_1 || null,
          ...anexosToPatch(anexos),
        }).eq("id", rateio.id);
      }
      onSaved(patch); onClose();
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: "rgba(2,6,23,0.85)" }} onClick={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-cyan-950/40" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><ClipboardList className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-bold text-slate-100">Editar Lançamento — Caixa Cliente</div>
              <div className="text-[10.5px] text-slate-500">Despesa do rateio (cliente/aeronave)</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-300"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5 md:p-6">
          {err && <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"><Info className="h-3.5 w-3.5" /> {err}</div>}

          <Section icon={<ClipboardList className="h-4 w-4" />} title="Identificação" accent="#22d3ee">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className={labelCls}>Descrição</label>
                <input className={inputCls} value={mov.descricao || ""} onChange={(e) => setM("descricao", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fornecedor</label>
                <FornecedorPickerCombo value={mov.fornecedor_nome || ""} onChange={(v) => setM("fornecedor_nome", v)} />
              </div>
              <div>
                <label className={labelCls}>Categoria de custo</label>
                <SearchableCombobox items={expenseOptions} value={categoriaCustoId} onChange={(v) => { setCategoriaCustoId(v); setSubcategoria(""); }} placeholder="Selecione a categoria" searchPlaceholder="Buscar categoria..." />
              </div>
              {subcatOptions.length > 0 && (
                <div>
                  <label className={labelCls}>Subcategoria</label>
                  <SearchableCombobox items={subcatOptions} value={subcategoria} onChange={(v) => setSubcategoria(v)} placeholder="Selecione a subcategoria" allowFreeText />
                </div>
              )}
              {rateio && (
                <div>
                  <label className={labelCls}>Tipo de Rateio</label>
                  <SearchableCombobox items={TIPOS_RATEIO} value={rateio.tipo_rateio || ""} onChange={(v) => setR("tipo_rateio", v)} placeholder="Selecione" />
                </div>
              )}
            </div>
          </Section>

          <Section icon={<CalendarRange className="h-4 w-4" />} title="Datas e Pagamento" accent="#38bdf8">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div><label className={labelCls}>Competência</label><input type="date" className={inputCls} value={mov.data_competencia || ""} onChange={(e) => setM("data_competencia", e.target.value)} /></div>
              <div><label className={labelCls}>Vencimento</label><input type="date" className={inputCls} value={mov.data_vencimento || ""} onChange={(e) => setM("data_vencimento", e.target.value)} /></div>
              <div><label className={labelCls}>Pagamento</label><input type="date" className={inputCls} value={mov.data_pagamento || ""} onChange={(e) => setM("data_pagamento", e.target.value)} /></div>
              <div>
                <label className={labelCls}>Forma</label>
                <SearchableCombobox items={FORMAS_PGTO} value={mov.forma_pagamento || ""} onChange={(v) => setM("forma_pagamento", v)} placeholder="Forma" icon={<CreditCard className="h-3.5 w-3.5" />} />
              </div>
              <div><label className={labelCls}>Valor</label><input type="number" step="0.01" className={inputCls} value={mov.valor ?? ""} onChange={(e) => setM("valor", e.target.value)} /></div>
            </div>
          </Section>

          <Section icon={<Paperclip className="h-4 w-4" />} title="Documentos e Anexos" accent="#fbbf24">
            <AnexosDinamicosField anexos={anexos} onChange={setAnexos} storagePrefix={`edit-mov/${movId}`} />
          </Section>

          <Section icon={<Info className="h-4 w-4" />} title="Observações" accent="#a78bfa">
            <textarea className={inputCls} rows={3} value={mov.observacoes || ""} onChange={(e) => setM("observacoes", e.target.value)} />
          </Section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900/60 px-6 py-3.5">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
