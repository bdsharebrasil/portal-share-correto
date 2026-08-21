import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type Fluxo = "caixa" | "reembolsaveis" | "cliente" | "dga";

type PossivelPar = {
  chave: string;
  a: any;
  b: any;
  motivos: string[];
};

const norm = (v: any) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const valor = (m: any) => Math.abs(Number(m?.valor_rateado ?? m?.valor_total ?? m?.valor ?? 0));
const data = (m: any) => String(m?.data_emissao || m?.data_vencimento || m?.data_pagamento || "").slice(0, 10);
const descricao = (m: any) => String(m?.descricao || m?.descricao_despesa || "").trim();
const documento = (m: any) => m?.numero_doc || m?.numero_nf || m?.nf_numero || m?.numero_recibo || null;
const fornecedor = (m: any) => m?.fornecedor_nome || m?.fornecedor || null;
const contexto = (m: any) => String(m?.clientes_id || m?.cliente_id || m?.aeronave_id || m?.aeronave || m?.tipo_caixa || "");

function diasEntre(a: string, b: string) {
  if (!a || !b) return Infinity;
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Number.isFinite(da) && Number.isFinite(db) ? Math.abs(da - db) / 86400000 : Infinity;
}

function tokens(texto: string) {
  return new Set(norm(texto).match(/[a-z0-9]{4,}/g) || []);
}

function criarChave(fluxo: Fluxo, a: any, b: any) {
  return `${fluxo}:${[String(a.id), String(b.id)].sort().join(":")}`;
}

function encontrarPares(items: any[], fluxo: Fluxo, revisados: Set<string>): PossivelPar[] {
  const pares: PossivelPar[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (!a?.id || !b?.id || valor(a) <= 0 || Math.abs(valor(a) - valor(b)) > 0.01) continue;
      const chave = criarChave(fluxo, a, b);
      if (revisados.has(chave)) continue;

      const motivos = ["Mesmo valor"];
      const docA = norm(documento(a));
      const docB = norm(documento(b));
      const fornA = norm(fornecedor(a));
      const fornB = norm(fornecedor(b));
      const dias = diasEntre(data(a), data(b));
      const tokA = tokens(descricao(a));
      const tokB = tokens(descricao(b));
      const comuns = [...tokA].filter((t) => tokB.has(t)).length;

      if (docA && docB && docA === docB) motivos.push("Mesmo documento/NF");
      if (dias === 0) motivos.push("Mesma data");
      else if (dias <= 2) motivos.push("Datas próximas");
      if (fornA && fornB && (fornA === fornB || fornA.includes(fornB) || fornB.includes(fornA))) motivos.push("Mesmo fornecedor");
      if (comuns >= 2) motivos.push("Descrição semelhante");
      if (contexto(a) && contexto(a) === contexto(b)) motivos.push("Mesmo contexto");

      if (motivos.length < 2) continue;
      pares.push({ chave, a, b, motivos });
    }
  }
  return pares.slice(0, 12);
}

function resumo(m: any) {
  const desc = descricao(m) || "Sem descrição";
  const dataTexto = data(m) ? new Date(`${data(m)}T00:00:00`).toLocaleDateString("pt-BR") : "Sem data";
  return `${desc} · ${dataTexto}`;
}

export default function DuplicidadeAlertasPanel({ fluxo, items }: { fluxo: Fluxo; items: any[] }) {
  const [revisados, setRevisados] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data: rows } = await (supabase as any)
        .from("financeiro_duplicidade_revisoes")
        .select("chave_par")
        .eq("fluxo", fluxo)
        .limit(5000);
      if (ativo) setRevisados(new Set((rows || []).map((r: any) => String(r.chave_par))));
    })();
    return () => { ativo = false; };
  }, [fluxo]);

  const pares = useMemo(() => encontrarPares(items, fluxo, revisados), [items, fluxo, revisados]);
  if (pares.length === 0) return null;

  const verificar = async (par: PossivelPar) => {
    setSalvando(par.chave);
    const { error } = await (supabase as any).from("financeiro_duplicidade_revisoes").upsert({
      chave_par: par.chave,
      fluxo,
      lancamento_id: par.a.id,
      lancamento_relacionado_id: par.b.id,
      observacao: "Verificado e correto pelo usuário",
    }, { onConflict: "chave_par" });
    if (!error) setRevisados((prev) => new Set(prev).add(par.chave));
    setSalvando(null);
  };

  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] shadow-sm">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left">
        <span className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="min-w-0"><strong className="text-sm text-amber-200">Revisar lançamentos repetidos</strong><span className="ml-2 text-xs text-amber-300/70">{pares.length} possível(is)</span></span>
        </span>
        {aberto ? <ChevronUp className="h-4 w-4 text-amber-300" /> : <ChevronDown className="h-4 w-4 text-amber-300" />}
      </button>
      {aberto && <div className="space-y-2 border-t border-amber-500/20 p-3">
        {pares.map((par) => (
          <div key={par.chave} className="rounded-lg border border-amber-500/20 bg-background/40 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
              <div className="min-w-0"><div className="truncate text-xs font-semibold text-foreground">{resumo(par.a)}</div><div className="mt-0.5 text-xs text-amber-200">{formatBRL(valor(par.a))}</div></div>
              <span className="text-center text-xs font-bold text-amber-300">ou</span>
              <div className="min-w-0"><div className="truncate text-xs font-semibold text-foreground">{resumo(par.b)}</div><div className="mt-0.5 text-xs text-amber-200">{formatBRL(valor(par.b))}</div></div>
              <button type="button" onClick={() => void verificar(par)} disabled={salvando === par.chave} className="inline-flex items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50" title="Manter os dois lançamentos e ocultar este alerta">
                {salvando === par.chave ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Verificado e correto
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">{par.motivos.map((motivo) => <span key={motivo} className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">{motivo}</span>)}</div>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground">O alerta é preventivo. Nenhum lançamento é excluído automaticamente.</p>
      </div>}
    </section>
  );
}
