import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  Info, CreditCard, Layers, Paperclip, Trash2, Plus, Fuel,
} from "lucide-react";

export const SHARE_BRASIL = "SHARE BRASIL";

const PERIODICIDADES = [
  { id: "MENSAL", label: "Mensal" },
  { id: "BIMESTRAL", label: "Bimestral" },
  { id: "TRIMESTRAL", label: "Trimestral" },
  { id: "SEMESTRAL", label: "Semestral" },
  { id: "ANUAL", label: "Anual" },
  { id: "EVENTUAL", label: "Eventual" },
];

const STATUS_RATEIO = [
  { id: "pendente", label: "Pendente" },
  { id: "pago", label: "Pago" },
  { id: "recebido", label: "Recebido" },
  { id: "reembolsado", label: "Reembolsado" },
  { id: "aguardando_reembolso", label: "Aguardando reembolso" },
];



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

interface RateioLinha {
  id?: string;
  cliente_id: string | null;
  clientes_nome: string | null;
  socio_id: string | null;
  socios_nome: string | null;
  percentual_uso: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  pago_por: string | null;
  pago_diretamente: boolean;
  status: string | null;
  _new?: boolean;
}

const novaLinha = (): RateioLinha => ({
  cliente_id: null, clientes_nome: null, socio_id: null, socios_nome: null,
  percentual_uso: null, valor_rateado: null, valor_pago_real: null,
  pago_por: null, pago_diretamente: false, status: "pendente", _new: true,
});

export default function EditCaixaClienteModal({ movId, mov: movInit, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mov, setMov] = useState<any>(movInit || {});
  const [rateio, setRateio] = useState<any>(null);
  const [linhas, setLinhas] = useState<RateioLinha[]>([]);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [anexos, setAnexos] = useState<AnexoLinha[]>(anexosFromMov(movInit || {}));
  const [categoriaCustoId, setCategoriaCustoId] = useState<string>("");
  const [subcategoria, setSubcategoria] = useState<string>("");
  const [tipoRateio, setTipoRateio] = useState<string>("");
  const [periodicidade, setPeriodicidade] = useState<string>("");
  const [abastecimentoId, setAbastecimentoId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: rows } = await (supabase as any)
        .from("rateio_despesas")
        .select("*")
        .eq("despesa_id", movId)
        .order("criado_em");
      const list = (rows ?? []) as any[];
      const first = list[0] || null;
      setRateio(first);
      if (first?.subcategoria_1) setSubcategoria(first.subcategoria_1 as string);
      if (first?.tipo_rateio) setTipoRateio(first.tipo_rateio as string);
      if (first?.periodicidade) setPeriodicidade(first.periodicidade as string);
      if (first?.abastecimento_id) setAbastecimentoId(first.abastecimento_id as string);
      setLinhas(
        list.map((r) => ({
          id: r.id,
          cliente_id: r.cliente_id ?? null,
          clientes_nome: r.clientes_nome ?? null,
          socio_id: r.socio_id ?? null,
          socios_nome: r.socios_nome ?? null,
          percentual_uso: r.percentual_uso ?? null,
          valor_rateado: r.valor_rateado ?? null,
          valor_pago_real: r.valor_pago_real ?? null,
          pago_por: r.pago_por ?? null,
          pago_diretamente: !!r.pago_diretamente,
          status: r.status ?? null,
        }))
      );
    })();
  }, [movId]);


  // Cotistas/sócios possíveis para a aeronave do lançamento
  const { data: cotistas = [] } = useQuery({
    queryKey: ["cotistas-rateio-edit", movInit?.aeronave_id],
    queryFn: async () => {
      let q = (supabase as any)
        .from("cotistas_aeronave")
        .select("id_clientes, socios_id, percentual_sociedade, clientes:clientes(id, razao_social, proprietario), socios:socios(id, nome)");
      if (movInit?.aeronave_id) q = q.eq("id_aeronave", movInit.aeronave_id);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });

  const cotistaOptions = cotistas.map((c) => ({
    id: `${c.id_clientes || ""}|${c.socios_id || ""}`,
    label:
      c.socios?.nome ||
      c.clientes?.razao_social ||
      c.clientes?.proprietario ||
      "Sem nome",
  }));

  // Quem pagou: nomes reais dos cotistas/clientes/sócios + a própria Share Brasil
  const pagadorOptions = useMemo(() => {
    const nomes = new Set<string>([SHARE_BRASIL]);
    cotistas.forEach((c) => {
      const n = c.socios?.nome || c.clientes?.razao_social || c.clientes?.proprietario;
      if (n) nomes.add(String(n));
    });
    linhas.forEach((l) => {
      if (l.socios_nome) nomes.add(l.socios_nome);
      if (l.clientes_nome) nomes.add(l.clientes_nome);
      if (l.pago_por) nomes.add(l.pago_por);
    });
    return Array.from(nomes).map((n) => ({ id: n, label: n === SHARE_BRASIL ? "SHARE BRASIL (caixa da empresa)" : n }));
  }, [cotistas, linhas]);

  // Abastecimentos da aeronave para vincular ao rateio
  const { data: abastecimentos = [] } = useQuery({
    queryKey: ["abastecimentos-rateio-edit", movInit?.aeronave_id],
    queryFn: async () => {
      let q = (supabase as any)
        .from("abastecimentos")
        .select("id, data, local, litros, valor_total, comanda")
        .order("data", { ascending: false })
        .limit(200);
      if (movInit?.aeronave_id) q = q.eq("aeronave_id", movInit.aeronave_id);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });

  const abastecimentoOptions = abastecimentos.map((a) => ({
    id: a.id,
    label: `${a.data ? new Date(`${a.data}T00:00:00`).toLocaleDateString("pt-BR") : "s/ data"} — ${a.local || "s/ local"} — ${Number(a.litros || 0).toLocaleString("pt-BR")} L — ${Number(a.valor_total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
  }));





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

  const isAbastecimento = /abastec|combust/i.test(
    `${selected?.expense_type || ""} ${mov.categoria_nome || ""} ${mov.descricao || ""} ${tipoRateio}`
  );



  const setM = (k: string, v: any) => setMov((s: any) => ({ ...s, [k]: v }));
  const setR = (k: string, v: any) => setRateio((s: any) => (s ? { ...s, [k]: v } : s));

  const setLinha = (idx: number, patch: Partial<RateioLinha>) =>
    setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const setLinhaStatus = (idx: number, status: string) =>
    setLinhas((ls) => {
      const next = ls.map((l, i) => (i === idx ? { ...l, status } : l));
      const allPending = next.length > 0 && next.every((l) => String(l.status || "").trim().toLowerCase() === "pendente");
      if (allPending) {
        setMov((s: any) => ({ ...s, data_pagamento: "" }));
      }
      return next;
    });
  const addLinha = () => setLinhas((ls) => [...ls, novaLinha()]);
  const removeLinha = (idx: number) =>
    setLinhas((ls) => {
      const l = ls[idx];
      if (l?.id) setRemovidos((r) => [...r, l.id!]);
      return ls.filter((_, i) => i !== idx);
    });

  const valorTotal = Number(mov.valor ?? mov.valor_total_despesa ?? 0) || 0;
  const totalRateado = linhas.reduce((a, l) => a + (Number(l.valor_rateado) || 0), 0);
  const totalPercentual = linhas.reduce((a, l) => a + (Number(l.percentual_uso) || 0), 0);

  const aplicarPercentual = (idx: number, pct: number | null) => {
    const valor = pct != null && valorTotal ? Number(((valorTotal * pct) / 100).toFixed(2)) : null;
    setLinha(idx, { percentual_uso: pct, valor_rateado: valor ?? linhas[idx]?.valor_rateado ?? null });
  };

  const handleSave = async () => {
    setSaving(true); setErr(null);
    try {
      const allRateiosPending = linhas.length > 0 && linhas.every((l) => String(l.status || "").trim().toLowerCase() === "pendente");
      const patch: any = {
        descricao: mov.descricao,
        fornecedor_nome: mov.fornecedor_nome,
        data_competencia: mov.data_competencia || null,
        data_vencimento: mov.data_vencimento || null,
        data_pagamento: allRateiosPending ? null : mov.data_pagamento || null,
        forma_pagamento: mov.forma_pagamento,
        valor_rateado: numOrNull(mov.valor_rateado),
        observacoes: mov.observacoes || null,
        categoria_nome: selected?.expense_type ?? mov.categoria_nome ?? null,
        ...anexosToPatch(anexos),
      };
      const { error: e1 } = await supabase.from("movimentacoes").update(patch as any).eq("id", movId);
      if (e1) throw e1;

      const comuns = {
        despesa_id: movId,
        descricao_despesa: mov.descricao,
        tipo_rateio: tipoRateio || rateio?.tipo_rateio || null,
        periodicidade: periodicidade || rateio?.periodicidade || null,
        abastecimento_id: abastecimentoId || null,
        forma_pagamento: mov.forma_pagamento,
        fornecedor_nome: mov.fornecedor_nome,
        data_vencimento: mov.data_vencimento || null,
        data_pagamento: mov.data_pagamento || null,
        aeronave_id: mov.aeronave_id ?? null,
        aeronave_registro: mov.aeronave_registro ?? rateio?.aeronave_registro ?? null,
        valor_total_despesa: valorTotal || null,
        categoria_custo: categoriaCustoId || rateio?.categoria_custo || null,
        subcategoria_1: subcategoria || rateio?.subcategoria_1 || null,
        ...anexosToPatch(anexos),
      };

      if (removidos.length > 0) {
        await (supabase as any).from("rateio_despesas").delete().in("id", removidos);
      }

      for (const l of linhas) {
        const payload: any = {
          ...comuns,
          cliente_id: l.cliente_id,
          clientes_nome: l.clientes_nome,
          socio_id: l.socio_id,
          socios_nome: l.socios_nome,
          percentual_uso: numOrNull(l.percentual_uso),
          valor_rateado: numOrNull(l.valor_rateado),
          valor_pago_real: numOrNull(l.valor_pago_real),
          pago_por: l.pago_por || null,
          pago_diretamente: !!l.pago_diretamente,
          status: l.status || "pendente",
          atualizado_em: new Date().toISOString(),
        };
        if (l.id) {
          await (supabase as any).from("rateio_despesas").update(payload).eq("id", l.id);
        } else {
          await (supabase as any).from("rateio_despesas").insert(payload);
        }
      }

      onSaved(patch); onClose();
    } catch (e: any) {
      setErr(e.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };


  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-3 sm:p-6 backdrop-blur-sm" style={{ background: "rgba(2,6,23,0.85)" }} onClick={onClose}>
      <div className="relative m-auto flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-cyan-950/40" onClick={(e) => e.stopPropagation()}>
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
              <div>
                <label className={labelCls}>Tipo de Rateio</label>
                <SearchableCombobox items={TIPOS_RATEIO} value={tipoRateio} onChange={setTipoRateio} placeholder="Selecione" allowFreeText />
              </div>
              <div>
                <label className={labelCls}>Periodicidade</label>
                <SearchableCombobox items={PERIODICIDADES} value={periodicidade} onChange={setPeriodicidade} placeholder="Selecione" allowFreeText />
              </div>
              {(isAbastecimento || abastecimentoId) && (
                <div className="md:col-span-3">
                  <label className={labelCls}>Abastecimento vinculado</label>
                  <div className="flex items-center gap-2">
                    <Fuel className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                    <div className="flex-1">
                      <SearchableCombobox items={abastecimentoOptions} value={abastecimentoId} onChange={setAbastecimentoId} placeholder="Selecione o abastecimento" searchPlaceholder="Buscar abastecimento..." />
                    </div>
                    {abastecimentoId && (
                      <button type="button" onClick={() => setAbastecimentoId("")} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800">Limpar</button>
                    )}
                  </div>
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

          <Section icon={<Layers className="h-4 w-4" />} title="Rateio da Despesa" accent="#34d399">
            <div className="space-y-3">
              {linhas.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-700/70 px-3 py-4 text-center text-[11.5px] text-slate-500">
                  Nenhum rateio cadastrado para esta despesa.
                </div>
              )}

              {linhas.map((l, idx) => (
                <div key={l.id || `new-${idx}`} className="rounded-xl border border-white/[0.07] bg-slate-950/50 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Cotista / Cliente</label>
                      <SearchableCombobox
                        items={cotistaOptions}
                        value={`${l.cliente_id || ""}|${l.socio_id || ""}`}
                        onChange={(v) => {
                          const [cid, sid] = String(v).split("|");
                          const opt = cotistas.find(
                            (c) => (c.id_clientes || "") === cid && (c.socios_id || "") === (sid || null || "")
                          );
                          setLinha(idx, {
                            cliente_id: cid || null,
                            socio_id: sid || null,
                            clientes_nome:
                              opt?.clientes?.razao_social || opt?.clientes?.proprietario || l.clientes_nome,
                            socios_nome: opt?.socios?.nome || (sid ? l.socios_nome : null),
                          });
                        }}
                        placeholder={l.socios_nome || l.clientes_nome || "Selecione o cotista"}
                        searchPlaceholder="Buscar cotista..."
                      />
                    </div>
                    <div>
                      <label className={labelCls}>% Uso</label>
                      <input
                        type="number" step="0.01" className={inputCls}
                        value={l.percentual_uso ?? ""}
                        onChange={(e) => aplicarPercentual(idx, e.target.value === "" ? null : Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Valor rateado</label>
                      <input
                        type="number" step="0.01" className={inputCls}
                        value={l.valor_rateado ?? ""}
                        onChange={(e) => setLinha(idx, { valor_rateado: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Quem pagou</label>
                      <SearchableCombobox
                        items={pagadorOptions}
                        value={l.pago_por || ""}
                        onChange={(v) => setLinha(idx, { pago_por: v })}
                        placeholder="Pagador"
                        allowFreeText
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Status</label>
                      <SearchableCombobox
                        items={STATUS_RATEIO}
                        value={l.status || ""}
                        onChange={(v) => setLinhaStatus(idx, v)}
                        placeholder="Status"
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-[11px] text-slate-400">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-emerald-500"
                        checked={!!l.pago_diretamente}
                        onChange={(e) => setLinha(idx, { pago_diretamente: e.target.checked })}
                      />
                      Pago diretamente pelo cotista
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pago real</span>
                        <input
                          type="number" step="0.01"
                          className="w-28 rounded-lg bg-slate-950/60 border border-slate-700/70 px-2 py-1 text-[12px] text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400/50"
                          value={l.valor_pago_real ?? ""}
                          onChange={(e) => setLinha(idx, { valor_pago_real: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLinha(idx)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-400/25 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-bold text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={addLinha}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar rateio
                </button>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="text-slate-400">
                    Total rateado:{" "}
                    <strong className={Math.abs(totalRateado - valorTotal) > 0.02 ? "text-amber-300" : "text-emerald-300"}>
                      {totalRateado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </strong>
                    {valorTotal ? <span className="text-slate-600"> / {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span> : null}
                  </span>
                  <span className="text-slate-400">
                    Total %: <strong className={Math.abs(totalPercentual - 100) > 0.01 ? "text-amber-300" : "text-emerald-300"}>{totalPercentual.toFixed(2)}%</strong>
                  </span>
                </div>
              </div>
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
    </div>,
    document.body
  );
}
