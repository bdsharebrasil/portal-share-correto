import { useCallback, useEffect, useState } from "react";
import {
  X,
  Upload,
  Plus,
  Trash2,
  FileText,
  Paperclip,
  Receipt,
  FileCheck,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { SearchableCombobox as UISearchableCombobox } from "@/components/ui/SearchableCombobox";

interface SocioOption {
  id: string;
  nome: string;
  percentual_participacao: number | null;
}

interface RateioRow {
  id: string;
  socio_id: string | null;
  socios_nome: string | null;
  percentual_uso: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  pago_por: string | null;
  status: string | null;
}

interface Movimentacao {
  id: string;
  descricao: string | null;
  tipo: string | null;
  tipo_caixa: string | null;
  valor?: string | number | null;
  valor_original?: string | number | null;
  valor_rateado?: string | number | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  aeronave_id?: string | null;
  data_competencia: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  clientes_id: string | null;
  socio_id: string | null;
  status: string | null;
  forma_pagamento: string | null;
  fornecedor_nome: string | null;
  reembolsavel: boolean | null;
  reembolso_quitado: boolean | null;
  contas_apagar_id: string | null;
  contas_areceber_id: string | null;
  reference_type: string | null;
  pago_diretamente: boolean | null;
}

interface AnexoRow {
  id?: string;
  tipo_anexo: string;
  numero_doc: string;
  file_url: string;
  fileName?: string;
}

const ANEXO_TYPES = [
  { value: "comprovante", label: "Comprovante", icon: Paperclip },
  { value: "recibo", label: "Recibo", icon: Receipt },
  { value: "boleto", label: "Boleto", icon: FileText },
  { value: "nota_fiscal", label: "Nota Fiscal", icon: FileCheck },
] as const;

const norm = (s?: string | null) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const num = (v: string | number | null | undefined) => Number(v) || 0;

const isEntrada = (m: Movimentacao) => {
  const t = norm(m.tipo);
  return t === "receita" || t === "entrada" || t === "credito" || t === "deposito";
};

function SearchableCombobox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon: React.FC<any> }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const Icon = selected?.icon || FileText;

  const filtered = options.filter((o) =>
    norm(o.label).includes(norm(query)),
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none transition hover:border-slate-600"
      >
        <Icon className="h-4 w-4 text-cyan-400" />
        <span className="flex-1 text-left">{selected?.label || "Selecione..."}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
            <div className="p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500"
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filtered.map((o) => {
                const OptIcon = o.icon;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
                  >
                    <OptIcon className="h-4 w-4 text-slate-400" />
                    <span className="flex-1 text-left">{o.label}</span>
                    {value === o.value && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-slate-500">Nenhum resultado.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function BaixaPagamentoModal({
  mov,
  onClose,
  onSuccess,
}: {
  mov: Movimentacao;
  onClose: () => void;
  onSuccess: (updated: Partial<Movimentacao>) => void;
}) {
  const entrada = isEntrada(mov);
  // `movimentacoes` não possui coluna `valor`: usamos o rateado / original.
  const valorRateadoBase = num(mov.valor_rateado) || num(mov.valor);
  const valorTotal = num(mov.valor_original) || valorRateadoBase;
  const valorOriginal = valorTotal;

  const [dataPagamento, setDataPagamento] = useState(
    new Date().toISOString().slice(0, 10),
  );
  // true = "Pago Diretamente" (cliente pagou, sem reembolso da Share)
  // false = "Com Reembolso" (a Share adiantou/pagou o fornecedor; vira conta a
  //          receber do cliente, aguardando reembolso)
  const [pagoDiretamente, setPagoDiretamente] = useState<boolean>(mov.pago_diretamente ?? true);
  const comReembolso = !pagoDiretamente;
  const [bancoNome, setBancoNome] = useState<string>("");
  const [anexos, setAnexos] = useState<AnexoRow[]>([
    { tipo_anexo: "comprovante", numero_doc: "", file_url: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [previewAnexo, setPreviewAnexo] = useState<AnexoRow | null>(null);
  const [socios, setSocios] = useState<SocioOption[]>([]);
  const [rateioRows, setRateioRows] = useState<RateioRow[]>([]);

  // Load socios (cotistas) da aeronave / cliente
  useEffect(() => {
    if (!mov.clientes_id) return;
    (async () => {
      const { data } = await supabase
        .from("socios")
        .select("id, nome, percentual_participacao")
        .eq("clientes_id", mov.clientes_id)
        .order("nome");
      setSocios((data as SocioOption[]) || []);
    })();
  }, [mov.clientes_id]);

  // Load rateio rows vinculados a essa movimentação
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rateio_despesas")
        .select("id, socio_id, socios_nome, percentual_uso, valor_rateado, valor_pago_real, pago_por, status")
        .eq("despesa_id", mov.id);
      setRateioRows((data as RateioRow[]) || []);
    })();
  }, [mov.id]);

  const updateRateioRow = (id: string, patch: Partial<RateioRow>) =>
    setRateioRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Load existing anexos
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("payment_anexos")
        .select("*")
        .eq("movimentacao_id", mov.id);
      if (data && data.length > 0) {
        setAnexos(
          data.map((a: any) => ({
            id: a.id,
            tipo_anexo: a.tipo_anexo,
            numero_doc: a.numero_doc || "",
            file_url: a.file_url,
          })),
        );
      }
    })();
  }, [mov.id]);

  const handleUpload = useCallback(
    async (file: File, idx: number) => {
      setUploadingIdx(idx);
      try {
        const ext = file.name.split(".").pop();
        const fileName = `payment-anexos/${mov.id}/${Date.now()}-${idx}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documentos")
          .upload(fileName, file, { upsert: true });
        if (upErr) {
          // If bucket doesn't exist, use a data URL fallback
          const reader = new FileReader();
          reader.onload = () => {
            setAnexos((prev) =>
              prev.map((a, i) =>
                i === idx
                  ? { ...a, file_url: reader.result as string, fileName: file.name }
                  : a,
              ),
            );
            setUploadingIdx(null);
          };
          reader.readAsDataURL(file);
          return;
        }
        const { data: urlData } = supabase.storage
          .from("documentos")
          .getPublicUrl(fileName);
        setAnexos((prev) =>
          prev.map((a, i) =>
            i === idx
              ? { ...a, file_url: urlData.publicUrl, fileName: file.name }
              : a,
          ),
        );
      } catch (e: any) {
        setError("Erro ao enviar arquivo: " + (e.message || ""));
      } finally {
        setUploadingIdx(null);
      }
    },
    [mov.id],
  );

  const addAnexoRow = () => {
    setAnexos((prev) => [...prev, { tipo_anexo: "comprovante", numero_doc: "", file_url: "" }]);
  };

  const removeAnexoRow = (idx: number) => {
    setAnexos((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAnexo = (idx: number, field: keyof AnexoRow, value: string) => {
    setAnexos((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)),
    );
  };

  const salvar = async () => {
    setError(null);
    if (!dataPagamento) {
      setError("Informe a data de pagamento.");
      return;
    }
    setSaving(true);
    try {
      const validAnexos = anexos.filter((a) => a.file_url);
      const comprovante = validAnexos.find((a) => a.tipo_anexo === "comprovante");
      const recibo = validAnexos.find((a) => a.tipo_anexo === "recibo");
      const boleto = validAnexos.find((a) => a.tipo_anexo === "boleto");
      const nf = validAnexos.find((a) => a.tipo_anexo === "nota_fiscal");

      const updatePayload: Record<string, any> = {
        data_pagamento: dataPagamento,
        pago_diretamente: pagoDiretamente,
        status: comReembolso ? "aguardando_reembolso" : entrada ? "recebido" : "pago",
        atualizado_em: new Date().toISOString(),
      };

      if (comReembolso) {
        // A despesa deixa de ser paga direto pelo caixa do cliente: a Share
        // pagou o fornecedor e agora existe um valor a receber do cliente.
        updatePayload.reembolsavel = true;
        updatePayload.reembolso_quitado = false;
        updatePayload.pago_por = "share";
        updatePayload.banco_nome = bancoNome || null;
      } else {
        updatePayload.reembolsavel = false;
        updatePayload.reembolso_quitado = false;
      }

      // 1. Update movimentacoes
      const { error: movErr } = await supabase
        .from("movimentacoes")
        .update(updatePayload as any)
        .eq("id", mov.id);
      if (movErr) throw movErr;

      // 2. Update contas_apagar if linked
      if (mov.contas_apagar_id) {
        const valorPagoFornecedor = comReembolso
          ? valorTotal
          : rateioRows.length > 0
          ? rateioRows.reduce((s, r) => s + (Number(r.valor_pago_real) || 0), 0)
          : valorTotal;
        await supabase
          .from("contas_apagar")
          .update({
            status: "paga",
            data_pagamento: dataPagamento,
            comprovante_pagamento_url: comprovante?.file_url || null,
            banco_pagamento: comReembolso ? bancoNome || null : null,
            valor_pago: String(valorPagoFornecedor),
          })
          .eq("id", mov.contas_apagar_id);
      }

      // 3. Update contas_areceber if linked (baixa de um recebimento já existente,
      // por ex. o cliente pagando de volta um reembolso pendente)
      if (mov.contas_areceber_id) {
        await supabase
          .from("contas_areceber")
          .update({ status: "recebido", data_pagamento: dataPagamento })
          .eq("id", mov.contas_areceber_id);
      }

      // 3b. Despesa passou a ser "Com Reembolso" nesta baixa: a Share adiantou o
      // pagamento ao fornecedor → gera conta a receber do cliente, aguardando reembolso.
      if (comReembolso && !mov.contas_areceber_id && mov.clientes_id) {
        const { data: cli } = await supabase
          .from("clientes")
          .select("id, razao_social, proprietario, cnpj")
          .eq("id", mov.clientes_id)
          .maybeSingle();
        const valorReembolso = valorRateadoBase || valorTotal;
        const { data: novaConta } = await supabase
          .from("contas_areceber")
          .insert({
            cliente_id: mov.clientes_id,
            cliente_nome: (cli as any)?.razao_social || (cli as any)?.proprietario || "Cliente",
            cliente_cnpj: (cli as any)?.cnpj || "—",
            data_criacao: dataPagamento,
            data_vencimento: dataPagamento,
            valor: valorReembolso,
            categoria: mov.categoria_nome || "REEMBOLSO",
            categoria_id: mov.categoria_id || null,
            descricao: `Reembolso — ${mov.descricao || ""}`.trim(),
            status: "aguardando_reembolso",
            comprovante_url: comprovante?.file_url || null,
            movimentacao_id: mov.id,
            reference_type: "reembolso_share",
            reference_id: mov.id,
          } as any)
          .select("id")
          .maybeSingle();
        if (novaConta?.id) {
          updatePayload.contas_areceber_id = novaConta.id;
          await supabase
            .from("movimentacoes")
            .update({ contas_areceber_id: novaConta.id })
            .eq("id", mov.id);
        }
      }

      // 4. Update rateio_despesas if this movimentacao has a linked despesa
      // Check by reference_type or via despesas_manutencao
      if (norm(mov.reference_type) === "despesa_manutencao" || norm(mov.reference_type) === "manutencao") {
        // Update despesas_manutencao_rateio status
        const { data: despesa } = await supabase
          .from("despesas_manutencao")
          .select("id")
          .eq("id", mov.reference_type === "despesa_manutencao" ? mov.id : null)
          .maybeSingle();
        if (despesa) {
          await supabase
            .from("despesas_manutencao_rateio")
            .update({ status_pagamento: "pago" })
            .eq("despesa_manutencao_id", despesa.id);
        }
      }

      // 5. Update rateio_despesas para esta movimentação
      if (comReembolso) {
        // O rateio real por cotista só é conhecido quando o cliente quitar o
        // reembolso — por ora fica "parcial", sem pagador definido, e sem
        // marcar como pago diretamente (o fornecedor foi pago pela Share).
        await supabase
          .from("rateio_despesas")
          .update({ pago_por: null, status: "parcial", pago_diretamente: false })
          .eq("despesa_id", mov.id);
      } else if (rateioRows.length > 0) {
        // Persistir ajustes individuais por cotista (uso, valor rateado, quem pagou)
        await Promise.all(
          rateioRows.map((r) =>
            supabase
              .from("rateio_despesas")
              .update({
                percentual_uso: r.percentual_uso,
                valor_rateado: r.valor_rateado,
                valor_pago_real: r.valor_pago_real,
                pago_por: r.pago_por,
                status: "pago",
                data_pagamento: dataPagamento,
                pago_diretamente: true,
                comprovante_url: comprovante?.file_url || null,
              })
              .eq("id", r.id),
          ),
        );
      } else {
        await supabase
          .from("rateio_despesas")
          .update({
            status: "pago",
            data_pagamento: dataPagamento,
            valor_pago_real: valorTotal,
            pago_diretamente: true,
            comprovante_url: comprovante?.file_url || null,
          })
          .eq("despesa_id", mov.id);
      }

      // 6. Save anexos
      // Delete existing anexos first
      await supabase.from("payment_anexos").delete().eq("movimentacao_id", mov.id);
      // Insert new ones
      if (validAnexos.length > 0) {
        const inserts = validAnexos.map((a) => ({
          movimentacao_id: mov.id,
          tipo_anexo: a.tipo_anexo,
          numero_doc: a.numero_doc || null,
          file_url: a.file_url,
        }));
        const { error: anexoErr } = await supabase
          .from("payment_anexos")
          .insert(inserts);
        if (anexoErr) throw anexoErr;
      }

      // Also update the URL fields on movimentacoes for backward compat
      const urlUpdate: Record<string, any> = {};
      if (comprovante) urlUpdate.comprovante_url = comprovante.file_url;
      if (recibo) urlUpdate.recibo_url = recibo.file_url;
      if (boleto) urlUpdate.boleto_url = boleto.file_url;
      if (nf) urlUpdate.nf_url = nf.file_url;
      if (Object.keys(urlUpdate).length > 0) {
        await supabase.from("movimentacoes").update(urlUpdate as any).eq("id", mov.id);
      }

      onSuccess(updatePayload);
    } catch (e: any) {
      setError(e.message || "Erro ao salvar baixa.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3.5">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Dar Baixa — {entrada ? "Receita" : "Despesa"}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{mov.descricao || "—"}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          {/* Valor info */}
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Valor Original</div>
              <div className="text-lg font-bold text-slate-100">{formatBRL(valorOriginal)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Vencimento</div>
              <div className="text-sm text-slate-300">
                {mov.data_vencimento
                  ? new Date(mov.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—"}
              </div>
            </div>
          </div>

          {/* Data + Tipo de Pagamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Data de Pagamento
              </label>
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Tipo de Pagamento
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPagoDiretamente(true)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    pagoDiretamente
                      ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300"
                      : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Pago Diretamente
                </button>
                <button
                  type="button"
                  onClick={() => setPagoDiretamente(false)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    comReembolso
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                      : "border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Com Reembolso
                </button>
              </div>
            </div>
          </div>

          {/* Banco usado pela Share, apenas quando vira reembolso */}
          {comReembolso && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Banco (pagamento pela Share)
              </label>
              <input
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                placeholder="Ex: Itaú, Nubank..."
                className={inputCls}
              />
            </div>
          )}

          {/* Info about pagoDiretamente / comReembolso */}
          <div
            className="rounded-lg border p-3 text-xs"
            style={{
              borderColor: pagoDiretamente
                ? "rgba(6,182,212,0.2)"
                : "rgba(245,158,11,0.2)",
              background: pagoDiretamente
                ? "rgba(6,182,212,0.05)"
                : "rgba(245,158,11,0.05)",
              color: pagoDiretamente ? "#67e8f9" : "#fbbf24",
            }}
          >
            {pagoDiretamente
              ? "Despesa paga diretamente — não passa pelo caixa share. Sem necessidade de reembolso."
              : "Com Reembolso — a Share pagou o fornecedor. Esta despesa passa para o caixa share e gera uma conta a receber do cliente (aguardando reembolso). O rateio entre cotistas só será definido quando o cliente quitar o reembolso."}
          </div>

          {/* Rateio entre cotistas — só se aplica quando o pagamento é direto,
              já que no fluxo "Com Reembolso" o rateio real só é definido depois */}
          {pagoDiretamente && rateioRows.length > 0 && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                    Rateio entre cotistas
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Ajuste o percentual de uso, valor rateado, valor pago e quem pagou por cotista.
                  </p>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <div>Total rateado</div>
                  <div className="text-sm font-bold text-slate-100">
                    {formatBRL(
                      rateioRows.reduce((s, r) => s + (Number(r.valor_rateado) || 0), 0),
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <div className="col-span-3">Cotista</div>
                  <div className="col-span-2 text-right">Uso %</div>
                  <div className="col-span-2 text-right">Valor rateado</div>
                  <div className="col-span-2 text-right">Valor pago</div>
                  <div className="col-span-3">Pago por</div>
                </div>
                {rateioRows.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-800 bg-slate-800/40 px-2 py-2"
                  >
                    <div className="col-span-12 md:col-span-3 text-sm text-slate-100 truncate">
                      {r.socios_nome || "—"}
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={r.percentual_uso ?? ""}
                        onChange={(e) =>
                          updateRateioRow(r.id, {
                            percentual_uso: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={inputCls + " text-right"}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={r.valor_rateado ?? ""}
                        onChange={(e) =>
                          updateRateioRow(r.id, {
                            valor_rateado: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={inputCls + " text-right"}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={r.valor_pago_real ?? ""}
                        onChange={(e) =>
                          updateRateioRow(r.id, {
                            valor_pago_real: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className={inputCls + " text-right"}
                      />
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <UISearchableCombobox
                        items={socios.map((s) => ({ id: s.nome, label: s.nome }))}
                        value={r.pago_por || ""}
                        onChange={(_id, label) =>
                          updateRateioRow(r.id, { pago_por: label })
                        }
                        placeholder="Cotista..."
                        searchPlaceholder="Buscar cotista..."
                        allowFreeText
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Anexos
              </label>
              <button
                type="button"
                onClick={addAnexoRow}
                className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar Anexo
              </button>
            </div>
            <div className="space-y-2.5">
              {anexos.map((anexo, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-start rounded-lg border border-slate-800 bg-slate-800/30 p-3"
                >
                  {/* Type combobox */}
                  <div className="col-span-12 md:col-span-4">
                    <SearchableCombobox
                      value={anexo.tipo_anexo}
                      onChange={(v) => updateAnexo(idx, "tipo_anexo", v)}
                      options={ANEXO_TYPES as any}
                    />
                  </div>
                  {/* Doc number */}
                  <div className="col-span-7 md:col-span-3">
                    <input
                      value={anexo.numero_doc}
                      onChange={(e) => updateAnexo(idx, "numero_doc", e.target.value)}
                      placeholder="Nº documento"
                      className={inputCls}
                    />
                  </div>
                  {/* Upload + URL */}
                  <div className="col-span-4 md:col-span-4 flex items-center gap-2">
                    <label className="cursor-pointer flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 hover:text-slate-100">
                      {uploadingIdx === idx ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">
                        {anexo.file_url ? "Trocar" : "Enviar"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(file, idx);
                        }}
                      />
                    </label>
                    {anexo.file_url && (
                      <button
                        type="button"
                        onClick={() => setPreviewAnexo(anexo)}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:underline truncate"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          {anexo.fileName || "Arquivo"}
                        </span>
                      </button>
                    )}
                  </div>
                  {/* Remove */}
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeAnexoRow(idx)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-400 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
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
            className="flex items-center gap-2 rounded-lg bg-cyan-500/90 px-5 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan-400 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {saving ? "Salvando..." : "Dar Baixa"}
          </button>
        </div>

        {/* In-modal attachment preview */}
        {previewAnexo && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={() => setPreviewAnexo(null)}>
            <div className="max-w-3xl w-full max-h-full overflow-auto rounded-xl bg-slate-800 p-4 border border-slate-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const T = ANEXO_TYPES.find((t) => t.value === previewAnexo.tipo_anexo);
                    const PreviewIcon = T?.icon || FileText;
                    return <PreviewIcon className="h-4 w-4 text-cyan-400" />;
                  })()}
                  <span className="text-sm font-bold text-slate-100">
                    {ANEXO_TYPES.find((t) => t.value === previewAnexo.tipo_anexo)?.label || "Anexo"}
                  </span>
                  {previewAnexo.numero_doc && <span className="text-xs text-slate-500">— {previewAnexo.numero_doc}</span>}
                </div>
                <button onClick={() => setPreviewAnexo(null)} className="text-slate-400 hover:text-slate-100 transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {previewAnexo.file_url.match(/\.(png|jpg|jpeg|gif|webp)$/i) || previewAnexo.file_url.startsWith("data:image") ? (
                <img src={previewAnexo.file_url} alt="Pré-visualização" className="max-w-full max-h-[60vh] mx-auto rounded-lg" />
              ) : previewAnexo.file_url.match(/\.pdf$/i) || previewAnexo.file_url.startsWith("data:application/pdf") ? (
                <iframe src={previewAnexo.file_url} title="Pré-visualização" className="w-full h-[60vh] rounded-lg bg-white" />
              ) : (
                <div className="flex flex-col items-center gap-3 py-8">
                  <FileText className="h-12 w-12 text-slate-600" />
                  <a href={previewAnexo.file_url} download className="text-cyan-400 hover:underline text-sm">Baixar arquivo</a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
