// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { Check, FileText, HandCoins, Loader2, Upload, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { quitarReembolsoLegs } from "@/lib/reembolsoSync";

const norm = (v: any) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const num = (v: any) => Number(v) || 0;

const inputCls =
  "w-full rounded-lg border border-border bg-card-secondary/60 px-3 py-2 text-sm text-foreground placeholder-slate-500 outline-none transition focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20";

type Mode = "gerar" | "baixar";

type Pendencia = {
  id: string;
  rateio_id: string;
  mov_id?: string;
  cliente_id: string | null;
  cliente_nome: string;
  socio_nome: string | null;
  valor_rateado: number;
  valor_cobranca: number;
  selected: boolean;
};

export default function ReembolsoModal({
  mov,
  onClose,
  onSuccess,
}: {
  mov: any;
  onClose: () => void;
  onSuccess: (patch?: any) => void;
}) {
  const [mode, setMode] = useState<Mode>("gerar");
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [pagadores, setPagadores] = useState<string[]>([]);
  const [pagador, setPagador] = useState("");
  const [pagadorPrevisto, setPagadorPrevisto] = useState("");
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().slice(0, 10));
  const [valorRecebido, setValorRecebido] = useState("");
  const [banco, setBanco] = useState("");
  const [bancoId, setBancoId] = useState("");
  const [bancos, setBancos] = useState<{ id: string; label: string }[]>([]);
  const [comprovante, setComprovante] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: rateioRows, error: rateioError }, { data: gerados, error: geradosError }, { data: bancosData }] = await Promise.all([
        supabase
          .from("rateio_despesas")
          .select("id, cliente_id, clientes_nome, socio_id, socios_nome, valor_rateado, valor_pago_real, status")
          .eq("despesa_id", mov.id)
          .order("id"),
        supabase
          .from("movimentacoes")
          .select("id, clientes_id, descricao, valor_rateado, valor_total, contas_areceber_id, reembolso_quitado, status, reference_type, reference_id, data_vencimento")
          .eq("tipo_caixa", "share")
          .eq("reference_type", "reembolso_share")
          .eq("reference_id", mov.id)
          .order("data_vencimento", { ascending: true }),
        supabase.from("contas_bancarias").select("id, banco, numero_conta").order("banco"),
      ]);

      if (rateioError) throw rateioError;
      if (geradosError) throw geradosError;

      const rateio = (rateioRows || []) as any[];
      const entries = (gerados || []) as any[];
      const nomes = Array.from(new Set(rateio.flatMap((r: any) => [r.clientes_nome, r.socios_nome]).filter(Boolean))).sort();
      setPagadores(nomes);
      if (!pagador && nomes.length === 1) setPagador(nomes[0]);

      setBancos((bancosData || []).map((b: any) => ({
        id: b.id,
        label: `${b.banco || "Banco"}${b.numero_conta ? ` — ${b.numero_conta}` : ""}`,
      })));

      if (entries.length > 0) {
        setMode("baixar");
        const mapped = entries.map((entry: any) => {
          const matching = rateio.find((r: any) => r.cliente_id === entry.clientes_id && !rateio.find((other: any) => other.id === r.id && other.cliente_id === entry.clientes_id && other.socio_id));
          const fallback = rateio.find((r: any) => r.cliente_id === entry.clientes_id) || rateio[entries.indexOf(entry)];
          const r = matching || fallback;
          return {
            id: entry.id,
            rateio_id: r?.id,
            mov_id: entry.id,
            cliente_id: entry.clientes_id ?? r?.cliente_id ?? null,
            cliente_nome: r?.clientes_nome || "Cliente",
            socio_nome: r?.socios_nome || null,
            valor_rateado: num(entry.valor_rateado ?? entry.valor_total),
            valor_cobranca: num(entry.valor_rateado ?? entry.valor_total),
            selected: !entry.reembolso_quitado,
          } as Pendencia;
        });
        setPendencias(mapped);
      } else {
        setMode("gerar");
        setPendencias(rateio.map((r: any) => ({
          id: r.id,
          rateio_id: r.id,
          cliente_id: r.cliente_id ?? null,
          cliente_nome: r.clientes_nome || "Cliente",
          socio_nome: r.socios_nome || null,
          valor_rateado: num(r.valor_rateado),
          valor_cobranca: num(r.valor_rateado),
          selected: num(r.valor_rateado) > 0,
        })));
      }
    } catch (e: any) {
      setError(e.message || "Não foi possível carregar o reembolso.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, [mov.id]);

  const selecionadas = useMemo(() => pendencias.filter((p) => p.selected && p.valor_cobranca > 0), [pendencias]);
  const totalSelecionado = useMemo(() => selecionadas.reduce((sum, p) => sum + p.valor_cobranca, 0), [selecionadas]);
  const valorRecebidoNum = num(String(valorRecebido).replace(",", "."));

  const toggle = (id: string) => {
    setPendencias((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

  const marcarTodos = (value: boolean) => {
    setPendencias((prev) => prev.map((p) => ({ ...p, selected: value })));
  };

  const alterarValor = (id: string, value: string) => {
    setPendencias((prev) => prev.map((p) => (p.id === id ? { ...p, valor_cobranca: num(value) } : p)));
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `reembolsos/${mov.id}/${Date.now()}-${safe}`;
      const { error: uploadError } = await supabase.storage.from("n.f-boletos-clients").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("n.f-boletos-clients").getPublicUrl(path);
      setComprovante(data.publicUrl);
    } catch (e: any) {
      setError(e.message || "Erro ao enviar comprovante.");
    } finally {
      setUploading(false);
    }
  };

  const gerar = async () => {
    setError(null);
    if (!mov.data_pagamento) throw new Error("A despesa ainda não foi baixada pela Share.");
    if (!selecionadas.length) throw new Error("Selecione pelo menos uma pendência de rateio.");
    if (totalSelecionado <= 0) throw new Error("O valor do reembolso precisa ser maior que zero.");

    const { data: authData } = await supabase.auth.getUser();
    const criadoPor = authData.user?.id || null;

    for (let i = 0; i < selecionadas.length; i++) {
      const p = selecionadas[i];
      const numero = `REEM-${mov.id.slice(0, 8).toUpperCase()}-${i + 1}`;
      const descricao = `${mov.descricao || "Despesa reembolsável"} — ${p.cliente_nome}`;

      const { data: conta, error: contaError } = await (supabase as any)
        .from("contas_areceber")
        .insert({
          numero,
          cliente_id: p.cliente_id,
          cliente_nome: p.cliente_nome,
          data_criacao: new Date().toISOString().slice(0, 10),
          data_vencimento: vencimento,
          valor: p.valor_cobranca,
          categoria: "REEMBOLSOS ENTRADAS",
          descricao,
          status: "pendente",
          aeronave: mov.aeronave_registro || null,
          reference_type: "reembolso_share",
          reference_id: mov.id,
          criado_por: criadoPor,
        })
        .select("id")
        .single();
      if (contaError) throw contaError;

      const { data: entrada, error: entradaError } = await (supabase as any)
        .from("movimentacoes")
        .insert({
          descricao,
          fluxo: "entrada",
          tipo_caixa: "share",
          categoria_nome: "REEMBOLSOS ENTRADAS",
          grupo_categoria: "REEMBOLSOS ENTRADAS",
          valor_rateado: p.valor_cobranca,
          valor_total: p.valor_cobranca,
          data_emissao: new Date().toISOString().slice(0, 10),
          data_vencimento: vencimento,
          status: "aguardando_reembolso",
          aeronave_id: mov.aeronave_id || null,
          clientes_id: p.cliente_id,
          reembolsavel: true,
          reembolso_quitado: false,
          contas_areceber_id: conta.id,
          reference_type: "reembolso_share",
          reference_id: mov.id,
          observacoes: [
            pagadorPrevisto ? `Pagador previsto: ${pagadorPrevisto}` : null,
            observacoes || null,
          ].filter(Boolean).join("\n") || null,
          criado_por: criadoPor,
        })
        .select("id")
        .single();
      if (entradaError) throw entradaError;

      const { error: linkError } = await (supabase as any)
        .from("contas_areceber")
        .update({ movimentacao_id: entrada.id })
        .eq("id", conta.id);
      if (linkError) throw linkError;
    }

    onSuccess?.();
    onClose();
  };

  const baixar = async () => {
    setError(null);
    const escolhidas = pendencias.filter((p) => p.selected);
    if (!escolhidas.length) throw new Error("Selecione pelo menos uma pendência de reembolso.");
    if (!pagador.trim()) throw new Error("Selecione quem pagou de fato.");

    const esperado = escolhidas.reduce((sum, p) => sum + p.valor_cobranca, 0);
    const recebido = valorRecebidoNum || esperado;
    if (Math.abs(recebido - esperado) > 0.01) {
      throw new Error(`O valor recebido precisa ser ${formatBRL(esperado)}.`);
    }

    await quitarReembolsoLegs({
      sourceMovId: mov.id,
      movIds: escolhidas.map((p) => p.mov_id || p.id),
      rateioIds: escolhidas.map((p) => p.rateio_id).filter(Boolean),
      valorRecebido: recebido,
      valorEsperado: esperado,
      data: dataRecebimento,
      pagador,
      banco: bancoId || banco || null,
      comprovante: comprovante || null,
      observacoes: observacoes || null,
    });

    onSuccess?.({ reembolso_quitado: true });
    onClose();
  };

  const salvar = async () => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "gerar") await gerar();
      else await baixar();
    } catch (e: any) {
      setError(e.message || "Não foi possível concluir o reembolso.");
    } finally {
      setSaving(false);
    }
  };

  const todosMarcados = pendencias.length > 0 && pendencias.every((p) => p.selected);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.68)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${mode === "gerar" ? "bg-amber-500/10 text-amber-300" : "bg-emerald-500/10 text-emerald-300"}`}>
              {mode === "gerar" ? <Wallet className="h-5 w-5" /> : <HandCoins className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {mode === "gerar" ? "Depois da baixa Share" : "Recebimento do cliente"}
              </div>
              <h3 className="text-base font-black text-foreground">
                {mode === "gerar" ? "Gerar reembolso dessa despesa para o cliente" : "Baixa consolidada de reembolso"}
              </h3>
              <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{mov.descricao || "Despesa reembolsável"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando fluxo do reembolso...
            </div>
          ) : (
            <>
              <div className={`rounded-xl border p-4 ${mode === "gerar" ? "border-amber-500/20 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5"}`}>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Despesa Share</div>
                    <div className="mt-1 text-sm font-bold text-foreground">{formatBRL(num(mov.valor_total))}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Etapa</div>
                    <div className="mt-1 text-sm font-bold text-foreground">{mode === "gerar" ? "Gerar cobrança de reembolso" : "Receber e dar baixa"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Selecionado</div>
                    <div className="mt-1 text-sm font-bold text-foreground">{formatBRL(totalSelecionado)}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 rounded-xl border border-border bg-card-secondary/30 p-1">
                <button
                  type="button"
                  disabled={mode === "baixar"}
                  onClick={() => setMode("gerar")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition ${mode === "gerar" ? "bg-amber-500/15 text-amber-300" : "text-muted-foreground"}`}
                >
                  Gerar reembolso
                </button>
                <button
                  type="button"
                  disabled={mode === "gerar" && pendencias.some((p) => p.mov_id)}
                  onClick={() => setMode("baixar")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-black transition ${mode === "baixar" ? "bg-emerald-500/15 text-emerald-300" : "text-muted-foreground"}`}
                >
                  Baixar recebimento
                </button>
              </div>

              {mode === "gerar" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-foreground">Rateio que deve ser cobrado</div>
                      <p className="mt-1 text-xs text-muted-foreground">O rateio já existe. Nesta etapa nasce o contas a receber; nenhuma cobrança é criada na solicitação.</p>
                    </div>
                    <button type="button" onClick={() => marcarTodos(!todosMarcados)} className="text-xs font-bold text-amber-300 hover:text-amber-200">
                      {todosMarcados ? "Desmarcar tudo" : "Marcar tudo"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {pendencias.map((p) => (
                      <div key={p.id} className="grid gap-3 rounded-xl border border-border bg-card-secondary/30 p-3 md:grid-cols-[auto_1fr_140px_160px] md:items-center">
                        <input type="checkbox" checked={p.selected} onChange={() => toggle(p.id)} className="h-4 w-4 accent-amber-500" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-foreground">{p.cliente_nome}</div>
                          <div className="text-[11px] text-muted-foreground">{p.socio_nome || "Cliente / cotista"}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Devido no rateio</div>
                          <div className="mt-1 text-sm font-semibold text-foreground">{formatBRL(p.valor_rateado)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor a cobrar</div>
                          <input className={inputCls + " text-right"} type="number" step="0.01" min="0" value={p.valor_cobranca} onChange={(e) => alterarValor(p.id, e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vencimento do reembolso</label>
                      <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pagador previsto</label>
                      <select value={pagadorPrevisto} onChange={(e) => setPagadorPrevisto(e.target.value)} className={inputCls}>
                        <option value="">Não informado</option>
                        {pagadores.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Observações</label>
                      <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={inputCls} placeholder="Ex.: um cotista assumirá a despesa inteira" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-foreground">Pendências de reembolso</div>
                      <p className="mt-1 text-xs text-muted-foreground">Selecione uma ou várias pendências que serão quitadas pela mesma transferência.</p>
                    </div>
                    <button type="button" onClick={() => marcarTodos(!todosMarcados)} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">
                      {todosMarcados ? "Desmarcar tudo" : "Marcar tudo"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {pendencias.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card-secondary/30 p-3">
                        <input type="checkbox" checked={p.selected} onChange={() => toggle(p.id)} className="h-4 w-4 accent-emerald-500" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-foreground">{p.cliente_nome}</span>
                          <span className="block text-[11px] text-muted-foreground">{p.socio_nome || "Cliente / cotista"}</span>
                        </span>
                        <span className="text-sm font-black text-foreground">{formatBRL(p.valor_cobranca)}</span>
                      </label>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quem pagou de fato</label>
                      <select value={pagador} onChange={(e) => setPagador(e.target.value)} className={inputCls}>
                        <option value="">Selecione...</option>
                        {pagadores.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data do recebimento</label>
                      <input type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valor recebido</label>
                      <input type="number" step="0.01" value={valorRecebido || totalSelecionado || ""} onChange={(e) => setValorRecebido(e.target.value)} className={inputCls + " text-right"} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Banco</label>
                      <select value={bancoId} onChange={(e) => { setBancoId(e.target.value); setBanco(bancos.find((b) => b.id === e.target.value)?.label || ""); }} className={inputCls}>
                        <option value="">Selecione...</option>
                        {bancos.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Comprovante</label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card-secondary/50 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {comprovante ? "Trocar comprovante" : "Anexar comprovante"}
                      <input type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
                    </label>
                    {comprovante && <a href={comprovante} target="_blank" rel="noreferrer" className="ml-3 inline-flex items-center gap-1 text-xs text-emerald-300"><FileText className="h-3.5 w-3.5" /> Abrir comprovante</a>}
                  </div>
                </div>
              )}

              {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">{error}</div>}
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-3.5">
          <button onClick={onClose} className="rounded-lg border border-border bg-card-secondary/60 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Cancelar</button>
          {!loading && (
            <button onClick={() => void salvar()} disabled={saving || uploading} className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-black ${mode === "gerar" ? "bg-amber-400 text-slate-950 hover:bg-amber-300" : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"}`}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {mode === "gerar" ? "Gerar reembolsos" : "Dar baixa no recebimento"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
