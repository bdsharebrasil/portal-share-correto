// @ts-nocheck — erros de tipagem pré-existentes (colunas legadas fora dos types gerados)
import { useEffect, useState } from "react";
import { X, Loader2, Check, Upload, HandCoins, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";

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

const num = (v: any) => Number(v) || 0;

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30";
const labelCls = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500";

/**
 * Baixa do reembolso do cliente para o caixa Share.
 * Permite informar quem efetivamente pagou e o valor recebido.
 */
export default function ReembolsoModal({
  mov,
  onClose,
  onSuccess,
}: {
  mov: MovLike;
  onClose: () => void;
  onSuccess: (patch: Record<string, any>) => void;
}) {
  const valorEsperado = num(mov.valor_rateado) || num(mov.valor_original);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [valor, setValor] = useState(valorEsperado.toFixed(2));
  const [pagador, setPagador] = useState("");
  const [banco, setBanco] = useState("");
  const [obs, setObs] = useState("");
  const [comprovante, setComprovante] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagadores, setPagadores] = useState<{ id: string; label: string }[]>([]);

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
    })();
  }, [mov.clientes_id, mov.aeronave_id]);

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
    if (!pagador.trim()) {
      setError("Informe quem pagou o reembolso.");
      return;
    }
    const valorRecebido = parseFloat(valor) || 0;
    if (valorRecebido <= 0) {
      setError("Informe o valor recebido.");
      return;
    }
    setSaving(true);
    try {
      const quitado = valorRecebido + 0.01 >= valorEsperado;
      const patch: Record<string, any> = {
        reembolso_quitado: quitado,
        status: quitado ? "reembolsado" : "reembolso parcial",
        pago_por: pagador,
        valor_pago_real: valorRecebido,
        atualizado_em: new Date().toISOString(),
      };
      if (comprovante) patch.comprovante_url = comprovante;
      if (obs) patch.observacoes = obs;

      const { error: e1 } = await supabase.from("movimentacoes").update(patch).eq("id", mov.id);
      if (e1) throw e1;

      if (mov.contas_areceber_id) {
        await supabase
          .from("contas_areceber")
          .update({
            status: quitado ? "recebido" : "parcial",
            data_pagamento: data,
            data_recebimento: data,
            banco_recebimento: banco || null,
            comprovante_url: comprovante || null,
          } as any)
          .eq("id", mov.contas_areceber_id);
      }

      await supabase
        .from("rateio_despesas")
        .update({
          pago_por: pagador,
          valor_pago_real: valorRecebido,
          data_pagamento: data,
          status: quitado ? "reembolsado" : "parcial",
        } as any)
        .eq("despesa_id", mov.id);

      onSuccess(patch);
      onClose();
    } catch (e: any) {
      setError(e.message || "Erro ao registrar reembolso.");
    } finally {
      setSaving(false);
    }
  };

  const diferenca = valorEsperado - (parseFloat(valor) || 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
              <HandCoins className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Baixa de Reembolso do Cliente</h3>
              <p className="mt-0.5 text-xs text-slate-500">{mov.descricao || "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Valor a receber</div>
              <div className="text-lg font-bold text-slate-100">{formatBRL(valorEsperado)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Saldo após baixa</div>
              <div className={`text-sm font-bold ${diferenca > 0.009 ? "text-amber-300" : "text-emerald-300"}`}>
                {formatBRL(Math.max(0, diferenca))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Quem pagou</label>
              <SearchableCombobox
                items={pagadores}
                value={pagador}
                onChange={(_id, label) => setPagador(label)}
                placeholder="Cliente / cotista..."
                searchPlaceholder="Buscar..."
                allowFreeText
              />
            </div>
            <div>
              <label className={labelCls}>Valor recebido (R$)</label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Data do recebimento</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Banco / conta</label>
              <input
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                placeholder="Ex: Itaú 1234"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Comprovante</label>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-slate-100">
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {comprovante ? "Trocar arquivo" : "Enviar arquivo"}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
              </label>
              {comprovante && (
                <a
                  href={comprovante}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" /> Ver comprovante
                </a>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Observações</label>
            <textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} className={inputCls} />
          </div>

          {diferenca > 0.009 && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-300">
              Recebimento parcial: restará {formatBRL(diferenca)} em aberto para os demais cotistas.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-900 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-500/90 px-5 py-2 text-xs font-bold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {saving ? "Salvando..." : "Registrar Reembolso"}
          </button>
        </div>
      </div>
    </div>
  );
}
