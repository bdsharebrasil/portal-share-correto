// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useEffect, useMemo, useState } from "react";
import { X, Loader2, HandCoins, FileText, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { quitarReembolsoLegs } from "@/lib/reembolsoSync";

interface MovLike {
  id: string;
  descricao?: string | null;
  clientes_id?: string | null;
  aeronave_id?: string | null;
  valor_rateado?: string | number | null;
  valor_original?: string | number | null;
  contas_areceber_id?: string | null;
  categoria_nome?: string | null;
}

interface ReembolsoPendencia {
  id: string;
  clientes_id: string | null;
  cliente_nome: string | null;
  descricao: string | null;
  valor_rateado: number;
  valor_total: number;
  contas_areceber_id: string | null;
  selected: boolean;
}

const num = (v: any) => Number(v) || 0;

const inputCls =
  "w-full rounded-lg border border-border bg-card-secondary/60 px-3 py-2 text-sm text-foreground placeholder-slate-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30";
const labelCls = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

export default function ReembolsoModal({
  mov,
  onClose,
  onSuccess,
}: {
  mov: MovLike;
  onClose: () => void;
  onSuccess: (patch: Record<string, any>) => void;
}) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [pagador, setPagador] = useState("");
  const [banco, setBanco] = useState("");
  const [bancoId, setBancoId] = useState("");
  const [bancos, setBancos] = useState<{ id: string; label: string }[]>([]);
  const [obs, setObs] = useState("");
  const [comprovante, setComprovante] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagadores, setPagadores] = useState<{ id: string; label: string }[]>([]);
  const [pendencias, setPendencias] = useState<ReembolsoPendencia[]>([]);
  const [loadingPendencias, setLoadingPendencias] = useState(true);

  const carregarPendencias = async () => {
    setLoadingPendencias(true);
    try {
      let query = supabase
        .from("movimentacoes")
        .select("id, clientes_id, descricao, valor_rateado, valor_total, contas_areceber_id, reembolso_quitado, reference_type, reference_id")
        .eq("tipo_caixa", "share")
        .or("reembolso_quitado.is.null,reembolso_quitado.eq.false")
        .order("data_vencimento", { ascending: true });

      const byRef = await query
        .eq("reference_type", "reembolso_share")
        .eq("reference_id", mov.id);

      let rows = byRef.data ?? [];

      if ((!rows || rows.length === 0) && mov.contas_areceber_id) {
        const fallback = await supabase
          .from("movimentacoes")
          .select("id, clientes_id, descricao, valor_rateado, valor_total, contas_areceber_id, reembolso_quitado, reference_type, reference_id")
          .eq("tipo_caixa", "share")
          .eq("contas_areceber_id", mov.contas_areceber_id)
          .or("reembolso_quitado.is.null,reembolso_quitado.eq.false")
          .order("data_vencimento", { ascending: true });
        rows = fallback.data ?? [];
      }

      const clienteIds = Array.from(new Set((rows || []).map((r: any) => r.clientes_id).filter(Boolean)));
      let clientesMap = new Map<string, string>();
      if (clienteIds.length > 0) {
        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, razao_social, proprietario")
          .in("id", clienteIds);
        (clientes || []).forEach((c: any) => {
          const nome = c.razao_social || c.proprietario;
          if (nome) clientesMap.set(c.id, nome);
        });
      }

      const list = (rows || []).map((row: any) => ({
        id: row.id,
        clientes_id: row.clientes_id ?? null,
        cliente_nome: clientesMap.get(row.clientes_id) ?? null,
        descricao: row.descricao ?? "Reembolso",
        valor_rateado: Number(row.valor_rateado ?? row.valor_total ?? 0),
        valor_total: Number(row.valor_total ?? row.valor_rateado ?? 0),
        contas_areceber_id: row.contas_areceber_id ?? null,
        selected: true,
      })) as ReembolsoPendencia[];

      setPendencias(list);
    } finally {
      setLoadingPendencias(false);
    }
  };

  useEffect(() => {
    void carregarPendencias();
  }, [mov.id, mov.contas_areceber_id]);

  useEffect(() => {
    (async () => {
      const opts: { id: string; label: string }[] = [];
      if (mov.clientes_id) {
        const [{ data: cli }, { data: socios }] = await Promise.all([
          supabase
            .from("clientes")
            .select("id, razao_social, proprietario")
            .eq("id", mov.clientes_id)
            .maybeSingle(),
          supabase.from("socios").select("id, nome").eq("cliente_id", mov.clientes_id).order("nome"),
        ]);
        const cliNome = (cli as any)?.razao_social || (cli as any)?.proprietario;
        if (cliNome) opts.push({ id: cliNome, label: cliNome });
        (socios ?? []).forEach((s: any) => s.nome && opts.push({ id: s.nome, label: s.nome }));
      }
      if (mov.aeronave_id) {
        const { data: cotistas } = await supabase
          .from("cotistas_aeronave")
          .select("id_clientes")
          .eq("id_aeronave", mov.aeronave_id);
        const ids = (cotistas ?? []).map((c: any) => c.id_clientes).filter(Boolean);
        if (ids.length) {
          const { data: clis } = await supabase
            .from("clientes")
            .select("id, razao_social, proprietario")
            .in("id", ids);
          (clis ?? []).forEach((c: any) => {
            const n = c.razao_social || c.proprietario;
            if (n && !opts.some((o) => o.id === n)) opts.push({ id: n, label: n });
          });
        }
      }
      setPagadores(opts);

      const { data: contas } = await supabase
        .from("contas_bancarias")
        .select("id, banco")
        .order("banco");
      setBancos((contas ?? []).map((c: any) => ({ id: c.id, label: c.banco || c.id })));
    })();
  }, [mov.clientes_id, mov.aeronave_id]);

  const selecionadas = useMemo(() => pendencias.filter((p) => p.selected), [pendencias]);

  const valorSelecionado = useMemo(
    () => selecionadas.reduce((sum, p) => sum + p.valor_rateado, 0),
    [selecionadas],
  );

  const totalEsperado = useMemo(
    () => selecionadas.reduce((sum, p) => sum + (p.valor_total || p.valor_rateado), 0),
    [selecionadas],
  );

  const totalRateio = useMemo(() => pendencias.reduce((sum, p) => sum + p.valor_rateado, 0), [pendencias]);
  const pendenciasMarcadas = useMemo(() => pendencias.filter((p) => p.selected).length, [pendencias]);

  const togglePendencia = (id: string, checked: boolean) => {
    setPendencias((prev) => prev.map((p) => (p.id === id ? { ...p, selected: checked } : p)));
  };

  const toggleTodos = (checked: boolean) => {
    setPendencias((prev) => prev.map((p) => ({ ...p, selected: checked })));
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const path = `reembolsos/${mov.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("n.f-boletos-clients")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("n.f-boletos-clients").getPublicUrl(path);
      setComprovante(pub.publicUrl);
    } catch (e: any) {
      setError("Erro no upload: " + (e.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const salvar = async () => {
    setError(null);
    const selecionadasAtuais = pendencias.filter((p) => p.selected);
    if (!selecionadasAtuais.length) {
      setError("Selecione pelo menos uma pendência de reembolso.");
      return;
    }
    if (!pagador.trim()) {
      setError("Informe quem pagou o reembolso.");
      return;
    }
    if (valorSelecionado <= 0) {
      setError("Informe o valor recebido.");
      return;
    }

    setSaving(true);
    try {
      const patch = await quitarReembolsoLegs({
        movId: mov.id,
        movIds: selecionadasAtuais.map((p) => p.id),
        valorRecebido: valorSelecionado,
        valorEsperado: totalEsperado,
        data,
        pagador,
        banco: bancoId || banco || null,
        comprovante: comprovante || null,
        observacoes: obs || null,
      });

      onSuccess(patch.patch || {});
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro ao registrar reembolso.");
    } finally {
      setSaving(false);
    }
  };

  const diferenca = totalEsperado - valorSelecionado;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
              <HandCoins className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Baixa consolidada de reembolso</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{mov.descricao || "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-card-secondary/30 to-card-secondary/20 px-4 py-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/80">Baixa consolidada</div>
              <div className="mt-1 text-sm text-muted-foreground">{pendencias.length} pendências vinculadas a esta despesa</div>
            </div>
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              {pendenciasMarcadas} selecionadas
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card-secondary/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Valor selecionado</div>
              <div className="mt-2 text-xl font-bold text-foreground">{formatBRL(valorSelecionado)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card-secondary/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Total do rateio</div>
              <div className="mt-2 text-xl font-bold text-foreground">{formatBRL(totalRateio)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card-secondary/30 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Remanescente</div>
              <div className={`mt-2 text-xl font-bold ${diferenca > 0.009 ? "text-amber-300" : "text-emerald-300"}`}>
                {formatBRL(Math.max(0, diferenca))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card-secondary/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pendências do rateio</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Marque o que está sendo quitado nesta baixa.</div>
              </div>
              <button
                type="button"
                className="text-[11px] font-medium text-emerald-300 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => toggleTodos(!pendencias.every((p) => p.selected))}
                disabled={pendencias.length === 0}
              >
                {pendencias.length > 0 && pendencias.every((p) => p.selected) ? "Desmarcar tudo" : "Marcar tudo"}
              </button>
            </div>

            {loadingPendencias ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando pendências...
              </div>
            ) : pendencias.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                Nenhuma pendência de reembolso encontrada para esta despesa.
              </div>
            ) : (
              <div className="space-y-2">
                {pendencias.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2 transition hover:border-emerald-500/40"
                  >
                    <input
                      type="checkbox"
                      checked={!!p.selected}
                      onChange={(e) => togglePendencia(p.id, e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-emerald-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${p.selected ? "bg-emerald-400" : "bg-slate-500"}`} />
                          <span className="truncate text-sm font-medium text-foreground">
                            {p.cliente_nome || p.descricao || "Cotista"}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{formatBRL(p.valor_rateado)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                        <span>{p.descricao || "Reembolso"}</span>
                        <span className={p.contas_areceber_id ? "text-emerald-300" : "text-amber-300"}>
                          {p.contas_areceber_id ? "Conta a receber" : "Sem vínculo"}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Quem pagou</label>
              <SearchableCombobox
                items={pagadores}
                value={pagador}
                onChange={(_id, label) => setPagador(label)}
                placeholder="Nome do pagador"
                searchPlaceholder="Buscar pagador..."
                allowFreeText
              />
            </div>
            <div>
              <label className={labelCls}>Data da baixa</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Banco / conta</label>
              <select value={bancoId || banco} onChange={(e) => { setBancoId(e.target.value); setBanco(e.target.value); }} className={inputCls}>
                <option value="">Selecione o banco</option>
                {bancos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Valor total da baixa</label>
              <div className={`${inputCls} flex items-center`}>{formatBRL(valorSelecionado)}</div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Observações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className={inputCls} placeholder="Detalhes da baixa, referência do pagamento ou informações do rateio..." />
          </div>

          <div>
            <label className={labelCls}>Comprovante</label>
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-card-secondary/20 p-3">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
                className="hidden"
                id="reembolso-comprovante"
              />
              <label htmlFor="reembolso-comprovante" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-emerald-500/40">
                <FileText className="h-4 w-4" />
                {uploading ? "Enviando..." : "Anexar comprovante"}
              </label>
              {comprovante && (
                <a href={comprovante} target="_blank" rel="noreferrer" className="text-xs text-emerald-300 hover:text-emerald-200">
                  Visualizar
                </a>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-card-secondary">
              Fechar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={saving || loadingPendencias || pendencias.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Registrando..." : "Registrar baixa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
