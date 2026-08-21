import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { agruparCategoriasPorGrupo } from "./categoryFilters";
import AnexosDinamicosField, {
  type AnexoLinha,
  type AnexoTipoId,
} from "@/components/dashboard/gestor/FinanceiroCotista/AnexosDinamicosField";
import FornecedorPickerCombo from "./FornecedorPickerCombo";
import {
  X, Save, Loader2, Wallet, CalendarRange, ClipboardList,
  Info, CreditCard, Paperclip, RefreshCcw, Building2,
} from "lucide-react";

interface Props {
  movId: string;
  mov: any;
  onClose: () => void;
  onSaved: (movPatch: any) => void;
}

const inputCls =
  "w-full rounded-lg bg-background/60 border border-border/70 px-3 py-2 text-[13px] text-foreground outline-none transition focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-500/60 placeholder:text-muted-foreground";
const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5";

const FORMAS_PGTO = [
  { id: "PIX", label: "Pix" }, { id: "TED", label: "TED" },
  { id: "BOLETO", label: "Boleto" }, { id: "DINHEIRO", label: "Dinheiro" },
  { id: "CARTAO", label: "Cartão" }, { id: "TRANSFERENCIA", label: "Transferência" },
  { id: "DEBITO_AUTOMATICO", label: "Débito Automático" },
];

const STATUS_SHARE = [
  { id: "pendente", label: "Pendente" },
  { id: "pago", label: "Pago" },
  { id: "aguardando_reembolso", label: "Aguardando Reembolso" },
  { id: "reembolsado", label: "Reembolsado" },
  { id: "parcial", label: "Parcial" },
  { id: "atrasado", label: "Atrasado" },
  { id: "vencido", label: "Vencido" },
  { id: "cancelado", label: "Cancelado" },
];

const numOrNull = (v: any) => (v === "" || v == null ? null : Number(v));

function Section({ icon, title, accent, children }: any) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-card/50 to-card/20 p-4 md:p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${accent}1A`, color: accent }}>{icon}</div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground">{title}</h3>
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

function anexosToPatch(anexos: AnexoLinha[]) {
  const first = (t: AnexoTipoId) => anexos.find((a) => a.tipo === t && a.url);
  const c = first("comprovante"), r = first("recibo"), n = first("nf"), b = first("boleto");
  return {
    comprovante_url: c?.url ?? null,
    recibo_url: r?.url ?? null,
    nf_url: n?.url ?? null,
    boleto_url: b?.url ?? null,
    numero_doc: c?.numero || null,
    numero_recibo: r?.numero || null,
    numero_nf: n?.numero || null,
    numero_boleto: b?.numero || null,
  };
}

export default function EditCaixaShareModal({ movId, mov: movInit, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mov, setMov] = useState<any>(movInit || {});
  const [anexos, setAnexos] = useState<AnexoLinha[]>(anexosFromMov(movInit || {}));

  const setM = (k: string, v: any) => setMov((s: any) => ({ ...s, [k]: v }));
  const setStatus = (status: string) => setMov((s: any) => ({
    ...s,
    status,
    data_pagamento: String(status || "").trim().toLowerCase() === "pendente" ? "" : s.data_pagamento,
  }));

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-mov-edit-share"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("categorias_movimentacao")
        .select("id, nome, tipo, grupo_categoria, reembolsavel")
        .eq("ativo", true)
        .order("grupo_categoria")
        .order("nome");
      return (data ?? []) as any[];
    },
  });

  const { data: bancos = [] } = useQuery({
    queryKey: ["contas-bancarias-edit"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("contas_bancarias")
        .select("id, banco, numero_conta")
        .eq("ativo", true)
        .order("banco");
      return (data ?? []) as any[];
    },
  });

  const [grupoCategoriaSelecionado, setGrupoCategoriaSelecionado] = useState("");

  const gruposCategoria = useMemo(() => agruparCategoriasPorGrupo(categorias), [categorias]);
  const categoriasDoGrupo = useMemo(
    () => gruposCategoria.find((g) => g.grupo === grupoCategoriaSelecionado)?.categorias ?? [],
    [gruposCategoria, grupoCategoriaSelecionado],
  );
  const categoriaSelecionada = useMemo(
    () => categorias.find((categoria: any) => categoria.id === mov.categoria_id) ?? null,
    [categorias, mov.categoria_id],
  );

  const bancoOptions = bancos.map((b) => ({
    id: b.banco,
    label: `${b.banco}${b.numero_conta ? ` — ${b.numero_conta}` : ""}`,
  }));
  const contaOptions = bancos.map((b) => ({ id: b.numero_conta || b.banco, label: b.numero_conta || b.banco }));

  useEffect(() => {
    const categoria = categorias.find((x) => x.id === mov.categoria_id);
    if (categoria) {
      setGrupoCategoriaSelecionado(categoria.grupo_categoria || "SEM GRUPO");
      return;
    }

    if (!mov.categoria_id) {
      setGrupoCategoriaSelecionado("");
    }
  }, [categorias, mov.categoria_id]);

  // Auto-marcar "reembolsavel" quando a categoria escolhida for reembolsável
  useEffect(() => {
    const c = categorias.find((x) => x.id === mov.categoria_id);
    if (c && typeof c.reembolsavel === "boolean" && mov.reembolsavel == null) {
      setM("reembolsavel", c.reembolsavel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mov.categoria_id, categorias.length]);

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      const patch: any = {
        descricao: mov.descricao,
        fornecedor_nome: mov.fornecedor_nome,
        categoria_id: mov.categoria_id || null,
        categoria_nome: categoriaSelecionada?.nome || null,
        grupo_categoria: categoriaSelecionada?.grupo_categoria || null,
        data_emissao: mov.data_emissao || null,
        data_vencimento: mov.data_vencimento || null,
        valor_rateado: numOrNull(mov.valor_rateado ?? mov.valor_total ?? mov.valor),
        valor_pago_real: numOrNull(mov.valor_pago_real ?? mov.valor_rateado ?? mov.valor_total ?? mov.valor),
        status: mov.status,
        forma_pagamento: mov.forma_pagamento,
        conta_bancaria: mov.conta_bancaria,
        data_pagamento: String(mov.status || "").trim().toLowerCase() === "pendente" ? null : mov.data_pagamento || null,
        reembolsavel: !!mov.reembolsavel,
        reembolso_quitado: !!mov.reembolso_quitado,
        observacoes: mov.observacoes,
        ...anexosToPatch(anexos),
      };
      const { error } = await supabase.from("movimentacoes").update(patch).eq("id", movId);
      if (error) throw error;
      onSaved(patch); onClose();
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-3 sm:p-6 backdrop-blur-sm" style={{ background: "rgba(2,6,23,0.85)" }} onClick={onClose}>
      <div className="relative m-auto flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-background shadow-2xl shadow-emerald-950/40" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-card via-card to-emerald-950/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300"><Wallet className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-bold text-foreground">Editar Lançamento — Caixa Share</div>
              <div className="text-[10.5px] text-muted-foreground">Movimentação da Share Brasil</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/15 hover:text-red-300"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5 md:p-6">
          {err && <div className="flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"><Info className="h-3.5 w-3.5" /> {err}</div>}

          <Section icon={<ClipboardList className="h-4 w-4" />} title="Identificação" accent="#34d399">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className={labelCls}>Descrição</label>
                <input className={inputCls} value={mov.descricao || ""} onChange={(e) => setM("descricao", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fornecedor</label>
                <FornecedorPickerCombo value={mov.fornecedor_nome || ""} onChange={(v) => setM("fornecedor_nome", v)} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Categoria (categorias_movimentacao)</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <SearchableCombobox
                    items={gruposCategoria.map((g) => ({ id: g.grupo, label: g.grupo }))}
                    value={grupoCategoriaSelecionado}
                    onChange={(v) => {
                      setGrupoCategoriaSelecionado(v);
                      setM("categoria_id", "");
                    }}
                    placeholder="Selecione o grupo"
                    searchPlaceholder="Buscar grupo..."
                  />
                  <SearchableCombobox
                    items={categoriasDoGrupo.map((c: any) => ({ id: c.id, label: c.nome }))}
                    value={mov.categoria_id || ""}
                      onChange={(v) => setM("categoria_id", v)}
                    placeholder={grupoCategoriaSelecionado ? "Selecione a subcategoria" : "Escolha o grupo primeiro"}
                    searchPlaceholder="Buscar subcategoria..."
                    disabled={!grupoCategoriaSelecionado}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <SearchableCombobox items={STATUS_SHARE} value={mov.status || ""} onChange={(v) => setStatus(v)} placeholder="Status" />
              </div>
            </div>
          </Section>

          <Section icon={<RefreshCcw className="h-4 w-4" />} title="Reembolso" accent="#fbbf24">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2.5 rounded-lg border border-border bg-background/50 px-3 py-2.5 cursor-pointer hover:bg-card/50">
                <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={!!mov.reembolsavel} onChange={(e) => setM("reembolsavel", e.target.checked)} />
                <div>
                  <div className="text-xs font-semibold text-foreground">Despesa reembolsável</div>
                  <div className="text-[10.5px] text-muted-foreground">A Share pagou e vai receber do cliente</div>
                </div>
              </label>
              <label className="flex items-center gap-2.5 rounded-lg border border-border bg-background/50 px-3 py-2.5 cursor-pointer hover:bg-card/50">
                <input type="checkbox" className="h-4 w-4 accent-emerald-500" checked={!!mov.reembolso_quitado} onChange={(e) => setM("reembolso_quitado", e.target.checked)} />
                <div>
                  <div className="text-xs font-semibold text-foreground">Reembolso quitado</div>
                  <div className="text-[10.5px] text-muted-foreground">Cliente já pagou a Share</div>
                </div>
              </label>
            </div>
          </Section>

          <Section icon={<CalendarRange className="h-4 w-4" />} title="Datas" accent="#38bdf8">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div><label className={labelCls}>Emissão</label><input type="date" className={inputCls} value={mov.data_emissao || ""} onChange={(e) => setM("data_emissao", e.target.value)} /></div>
              <div><label className={labelCls}>Vencimento</label><input type="date" className={inputCls} value={mov.data_vencimento || ""} onChange={(e) => setM("data_vencimento", e.target.value)} /></div>
              <div><label className={labelCls}>Pagamento</label><input type="date" className={inputCls} value={mov.data_pagamento || ""} onChange={(e) => setM("data_pagamento", e.target.value)} /></div>
            </div>
          </Section>

          <Section icon={<Wallet className="h-4 w-4" />} title="Pagamento" accent="#a78bfa">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div><label className={labelCls}>Valor pago</label><input type="number" step="0.01" className={inputCls} value={mov.valor_pago_real ?? mov.valor_rateado ?? mov.valor_total ?? mov.valor ?? ""} onChange={(e) => setM("valor_pago_real", e.target.value)} /></div>
              <div>
                <label className={labelCls}>Forma</label>
                <SearchableCombobox items={FORMAS_PGTO} value={mov.forma_pagamento || ""} onChange={(v) => setM("forma_pagamento", v)} placeholder="Forma" icon={<CreditCard className="h-3.5 w-3.5" />} />
              </div>
             
              <div>
                <label className={labelCls}>Conta</label>
                <SearchableCombobox items={contaOptions} value={mov.conta_bancaria || ""} onChange={(v) => setM("conta_bancaria", v)} placeholder="Conta" allowFreeText />
              </div>
            </div>
          </Section>

          <Section icon={<Paperclip className="h-4 w-4" />} title="Documentos e Anexos" accent="#fbbf24">
            <AnexosDinamicosField anexos={anexos} onChange={setAnexos} storagePrefix={`edit-mov-share/${movId}`} />
          </Section>

          <Section icon={<Info className="h-4 w-4" />} title="Observações" accent="#94a3b8">
            <textarea className={inputCls} rows={3} value={mov.observacoes || ""} onChange={(e) => setM("observacoes", e.target.value)} />
          </Section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-card/60 px-6 py-3.5">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-card-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2 text-xs font-bold text-white shadow-lg hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
