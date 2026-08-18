import { useEffect, useMemo, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLIENTE_DGA_ID } from "@/utils/financeiroRules";

const CONTA_DGA_LABEL = "DGA - BRADESCO";

type Tipo = "entrada" | "saida" | "reembolso";

export default function NovaMovimentacaoDgaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<Tipo>("saida");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoriaId, setCategoriaId] = useState("");
  const [contaId, setContaId] = useState("");
  const [socioId, setSocioId] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [categorias, setCategorias] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [socios, setSocios] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [cat, cb, so] = await Promise.all([
        supabase.from("categorias_movimentacao").select("id,nome,grupo_categoria,tipo").eq("ativo", true).order("nome"),
        supabase.from("contas_bancarias").select("id,banco,numero_conta").eq("ativo", true).order("banco"),
        supabase.from("socios").select("id,nome").order("nome"),
      ]);
      setCategorias(cat.data ?? []);
      setContas(cb.data ?? []);
      setSocios(so.data ?? []);
      const dga = (cb.data ?? []).find((c: any) => String(c.banco || "").toUpperCase().includes("DGA"));
      if (dga) setContaId(dga.id);
    })();
  }, []);

  const contaSelecionada = useMemo(() => contas.find((c) => c.id === contaId), [contas, contaId]);
  const contaLabel = contaSelecionada ? `${contaSelecionada.banco}${contaSelecionada.numero_conta ? ` - ${contaSelecionada.numero_conta}` : ""}` : "";
  const isContaDga = String(contaSelecionada?.banco || "").toUpperCase().includes("DGA");
  const pagoDireto = !isContaDga && tipo !== "entrada";

  const salvar = async () => {
    setErro(null);
    const v = Number(String(valor).replace(/\./g, "").replace(",", "."));
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!Number.isFinite(v) || v <= 0) return setErro("Informe um valor válido.");
    setSaving(true);
    try {
      const categoria = categorias.find((c) => c.id === categoriaId);
      const { error } = await supabase.from("movimentacoes").insert({
        descricao: descricao.trim(),
        fluxo: tipo === "saida" ? "saida" : tipo === "entrada" ? "entrada" : "estorno",
        valor_rateado: v,
        valor_total: v,
        valor_pago_real: v,
        data_emissao: data,
        data_pagamento: data,
        tipo_caixa: "dga",
        clientes_id: CLIENTE_DGA_ID,
        categoria_id: categoriaId || null,
        categoria_nome: categoria?.nome || null,
        conta_bancaria: contaLabel || CONTA_DGA_LABEL,
        pago_diretamente: pagoDireto,
        pago_por: pagoDireto ? "cotista" : "dga",
        socio_id: pagoDireto ? socioId || null : null,
        socios_nome: pagoDireto ? socios.find((s) => s.id === socioId)?.nome || null : null,
        reembolsavel: tipo === "reembolso",
        fornecedor_nome: fornecedor || null,
        observacoes: observacoes || null,
        status: "pago",
      } as any);
      if (error) throw error;
      onSaved();
    } catch (e: any) {
      setErro(e.message || "Erro ao salvar movimentação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-violet-300/70">DGA</div>
            <h3 className="text-lg font-bold">Nova movimentação DGA</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {erro && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{erro}</div>}

          <div className="flex gap-2">
            {(["entrada", "saida", "reembolso"] as Tipo[]).map((t) => (
              <button key={t} onClick={() => setTipo(t)} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${tipo === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{t}</button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Descrição" className="md:col-span-2">
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Valor (R$)">
              <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Data">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Categoria">
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Selecione</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.grupo_categoria ? `${c.grupo_categoria} · ` : ""}{c.nome}</option>)}
              </select>
            </Field>
            <Field label="Conta bancária">
              <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">Selecione</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.banco}{c.numero_conta ? ` - ${c.numero_conta}` : ""}</option>)}
              </select>
            </Field>
            {pagoDireto && (
              <Field label="Cotista que pagou">
                <select value={socioId} onChange={(e) => setSocioId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Selecione</option>
                  {socios.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </Field>
            )}
            <Field label="Fornecedor">
              <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
            <Field label="Observações" className="md:col-span-2">
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </Field>
          </div>

          <div className={`rounded-xl border p-3 text-xs ${pagoDireto ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-violet-500/25 bg-violet-500/[0.06] text-violet-200"}`}>
            {pagoDireto
              ? "Conta diferente de DGA - BRADESCO: este lançamento será registrado como pago diretamente do bolso do cotista/cliente e entra em 'A acertar com cotistas'."
              : "Pago pela conta DGA - BRADESCO: entra em 'Despesas banco DGA' e não gera dívida com a Share."}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}