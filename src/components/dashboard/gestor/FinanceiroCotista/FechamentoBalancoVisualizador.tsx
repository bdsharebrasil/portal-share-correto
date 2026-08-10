// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Printer,
  Plane,
  TrendingUp,
  TrendingDown,
  WalletCards,
  BarChart3,
  ClipboardList,
  BookOpen,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const BRL = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v ?? 0);

const NUM = (v: number | null | undefined, dec = 2) =>
  Number(v ?? 0).toFixed(dec).replace(".", ",");

/** Decimal → "HH:MM" */
function hhMM(h: number) {
  const horas = Math.floor(h);
  const mins = Math.round((h - horas) * 60);
  return `${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try {
    return format(new Date(s.substring(0, 10) + "T12:00:00"), "dd/MM/yyyy");
  } catch {
    return s;
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface CotistaInfo {
  id: string;
  nome: string;
}

interface RateioRow {
  id: string;
  despesa_id: string;
  data_pagamento: string | null;
  data_vencimento: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  fornecedor_nome: string | null;
  descricao_despesa: string | null;
  categoria_custo: string | null;
  periodicidade: string | null;
  tipo_rateio: string | null;
  pago_por: string | null;
  valor_total_despesa: number;
  valor_rateado: number;
  percentual_uso: number | null;
  percentual_sociedade: number | null;
  socio_id: string | null;
  socios_nome: string | null;
  cliente_id: string | null;
  clientes_nome: string | null;
}

interface VooRow {
  id: string;
  data_registro: string;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  trecho: string | null;
  tempo_voo: number | null;
  tempo_total: number | null;
  pousos_total: number | null;
  combustivel_adicionado: number | null;
  natureza_voo: string | null;
  socios_id: string | null;
  socios_nome: string | null;
  relatorio_numero?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL DE DADOS
// ─────────────────────────────────────────────────────────────────────────────

function useDadosRelatorio(
  aeronaveId: string,
  inicio: string,
  fim: string,
  mesesSet: Set<number>
) {
  return useQuery({
    queryKey: ["relatorio-pdf-completo", aeronaveId, inicio, fim, Array.from(mesesSet).sort().join(",")],
    enabled: !!aeronaveId,
    staleTime: 120_000,
    queryFn: async () => {
      const [ratRes, vooRes, aerRes, catRes] = await Promise.all([
        (supabase as any)
          .from("rateio_despesas")
          .select([
            "id", "despesa_id", "data_pagamento", "data_vencimento",
            "numero_doc", "numero_nf", "fornecedor_nome", "descricao_despesa",
            "categoria_custo", "periodicidade", "tipo_rateio", "pago_por",
            "valor_total_despesa", "valor_rateado",
            "percentual_uso", "percentual_sociedade",
            "socio_id", "socios_nome", "cliente_id", "clientes_nome",
          ].join(", "))
          .eq("aeronave_id", aeronaveId)
          .eq("conferido", true)
          .or(
            `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),` +
            `and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`
          )
          .order("data_pagamento", { ascending: true, nullsFirst: false }),

        supabase
          .from("lancamentos_diario_bordo")
          .select(
            "id, data_registro, aerodromo_partida, aerodromo_chegada, trecho, " +
            "tempo_voo, tempo_total, pousos_total, combustivel_adicionado, " +
            "natureza_voo, socios_id, socios_nome"
          )
          .eq("aeronave_id", aeronaveId)
          .gte("data_registro", inicio)
          .lte("data_registro", fim)
          .order("data_registro"),

        supabase
          .from("aeronave")
          .select("matricula, modelo, fabricante")
          .eq("id", aeronaveId)
          .maybeSingle(),

        (supabase as any).from("expense_configu").select("id, expense_type"),
      ]);

      const catMap = new Map<string, string>();
      ((catRes as any)?.data ?? []).forEach((c: any) => {
        if (c?.id) catMap.set(String(c.id), String(c.expense_type || ""));
      });

      const mesDe = (s?: string | null) =>
        s ? new Date(String(s).substring(0, 10) + "T12:00:00").getMonth() + 1 : null;
      const dentro = (s?: string | null) => {
        const m = mesDe(s);
        return m != null && mesesSet.has(m);
      };

      return {
        rateios: ((ratRes.data ?? []) as RateioRow[]).filter((r) =>
          dentro(r.data_pagamento || r.data_vencimento)
        ),
        voos: ((vooRes.data ?? []) as VooRow[]).filter((v) => dentro(v.data_registro)),
        aeronave: aerRes.data,
        catMap,
      };
    },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nomeCategoria(raw: string | null | undefined, map?: Map<string, string>): string {
  const v = (raw || "").trim();
  if (!v) return "OUTROS";
  if (UUID_RE.test(v)) return (map?.get(v) || "OUTROS").toUpperCase();
  return v.toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  aeronaveId: string;
  ano?: number;
  meses?: number[];
  onClose?: () => void;
}

export function FechamentoBalancoVisualizador({ aeronaveId, ano: anoProp, meses, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"lancamentos" | "resumos" | "graficos" | "diario">("lancamentos");

  const hoje = new Date();
  const ano = anoProp ?? hoje.getFullYear();
  const mesesSelecionados = useMemo(() => {
    const list = (meses && meses.length ? meses : [hoje.getMonth() + 1])
      .filter((m) => m >= 1 && m <= 12)
      .sort((a, b) => a - b);
    return list;
  }, [meses]);
  const mesesSet = useMemo(() => new Set(mesesSelecionados), [mesesSelecionados]);

  const primeiroMes = mesesSelecionados[0] - 1;
  const ultimoMes = mesesSelecionados[mesesSelecionados.length - 1] - 1;

  const inicio = format(new Date(ano, primeiroMes, 1), "yyyy-MM-dd");
  const fim = format(endOfMonth(new Date(ano, ultimoMes, 1)), "yyyy-MM-dd");
  const mesLabel =
    mesesSelecionados.length === 1
      ? capitalize(format(new Date(ano, primeiroMes, 1), "MMMM 'de' yyyy", { locale: ptBR }))
      : `${mesesSelecionados
          .map((m) => capitalize(format(new Date(ano, m - 1, 1), "MMM", { locale: ptBR })))
          .join(" + ")} de ${ano}`;

  const { data, isLoading } = useDadosRelatorio(aeronaveId, inicio, fim, mesesSet);

  const catNome = React.useCallback(
    (raw: string | null | undefined) => nomeCategoria(raw, (data as any)?.catMap),
    [data]
  );

  // ── Extração e Cálculos de Dados ───────────────────────────────────────────
  const cotistas = useMemo<CotistaInfo[]>(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    data.rateios.forEach((r) => {
      const id = r.socio_id || r.cliente_id;
      const nome = r.socios_nome || r.clientes_nome;
      if (id && nome && !map.has(id)) map.set(id, nome);
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [data]);

  const despesasAgrupadas = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { ref: RateioRow; rateios: RateioRow[] }>();
    data.rateios.forEach((r) => {
      const key = r.despesa_id || r.id;
      if (!map.has(key)) map.set(key, { ref: r, rateios: [] });
      map.get(key)!.rateios.push(r);
    });
    return Array.from(map.values()).sort((a, b) => {
      const da = a.ref.data_pagamento || a.ref.data_vencimento || "";
      const db = b.ref.data_pagamento || b.ref.data_vencimento || "";
      return da.localeCompare(db);
    });
  }, [data]);

  const pivot = useMemo(() => {
    const cats = new Map<string, Map<string, number>>(); 
    const cotTot = new Map<string, number>();
    let grand = 0;

    despesasAgrupadas.forEach(({ rateios }) => {
      rateios.forEach((r) => {
        const cat = catNome(r.categoria_custo);
        const cid = r.socio_id || r.cliente_id;
        const val = Number(r.valor_rateado ?? 0);
        if (!cid || val <= 0) return;
        if (!cats.has(cat)) cats.set(cat, new Map());
        cats.get(cat)!.set(cid, (cats.get(cat)!.get(cid) ?? 0) + val);
        cotTot.set(cid, (cotTot.get(cid) ?? 0) + val);
        grand += val;
      });
    });

    const ORDER = ["COMBUSTÍVEIS", "HANGARAG./TAXAS", "MANUTENÇÃO", "TRIPULAÇÃO & ADM"];
    const sortedCats = Array.from(cats.keys()).sort((a, b) => {
      const ia = ORDER.findIndex((o) => a.includes(o.split("/")[0]));
      const ib = ORDER.findIndex((o) => b.includes(o.split("/")[0]));
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    return { cats, cotTot, grand, sortedCats };
  }, [despesasAgrupadas, catNome]);

  const resumoCotistas = useMemo(() => {
    if (!data) return [];
    return cotistas.map((c) => {
      const rows = data.rateios.filter((r) => r.socio_id === c.id || r.cliente_id === c.id);
      const fixo = rows.filter((r) => (r.tipo_rateio || r.periodicidade || "").toUpperCase().includes("FIXO")).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
      const variavel = rows.filter((r) => !(r.tipo_rateio || r.periodicidade || "").toUpperCase().includes("FIXO")).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
      const voosCot = data.voos.filter((v) => v.socios_id === c.id);
      const horas = voosCot.reduce((s, v) => s + Number(v.tempo_voo ?? 0), 0);
      const pousos = voosCot.reduce((s, v) => s + Number(v.pousos_total ?? 0), 0);
      const litros = voosCot.reduce((s, v) => s + Number(v.combustivel_adicionado ?? 0), 0);

      return {
        ...c, fixo, variavel, total: fixo + variavel,
        horas, pousos, litros, custoHora: horas > 0 ? (fixo + variavel) / horas : 0,
      };
    });
  }, [data, cotistas]);

  const saldos = useMemo(() => {
    const pagou = new Map<string, number>();
    const deve = new Map<string, number>();

    despesasAgrupadas.forEach(({ ref, rateios }) => {
      const pagadorNome = (ref.pago_por || "").toLowerCase();
      const pagador = cotistas.find((c) => c.nome.toLowerCase().includes(pagadorNome) || pagadorNome.includes(c.nome.toLowerCase().split(" ")[0]));
      if (pagador) {
        pagou.set(pagador.id, (pagou.get(pagador.id) ?? 0) + Number(ref.valor_total_despesa ?? 0));
      }
      rateios.forEach((r) => {
        const cid = r.socio_id || r.cliente_id;
        if (!cid) return;
        deve.set(cid, (deve.get(cid) ?? 0) + Number(r.valor_rateado ?? 0));
      });
    });

    return cotistas.map((c) => ({
      ...c,
      pagou: pagou.get(c.id) ?? 0,
      deve: deve.get(c.id) ?? 0,
      saldo: (pagou.get(c.id) ?? 0) - (deve.get(c.id) ?? 0),
    }));
  }, [despesasAgrupadas, cotistas]);

  const totalGeral = despesasAgrupadas.reduce((s, d) => s + Number(d.ref.valor_total_despesa ?? 0), 0);
  const totalHorasAeronave = (data?.voos ?? []).reduce((s, v) => s + Number(v.tempo_voo ?? 0), 0);
  const totalPousos = (data?.voos ?? []).reduce((s, v) => s + Number(v.pousos_total ?? 0), 0);
  const totalLitros = (data?.voos ?? []).reduce((s, v) => s + Number(v.combustivel_adicionado ?? 0), 0);
  const qtdMeses = Math.max(1, mesesSelecionados.length);

  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    (data?.rateios ?? []).forEach((r) => {
      const cat = catNome(r.categoria_custo);
      map.set(cat, (map.get(cat) ?? 0) + Number(r.valor_rateado ?? 0));
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
  }, [data, catNome]);

  const baseCustos = useMemo(() => {
    const rows = data?.rateios ?? [];
    const isFixo = (r: RateioRow) => (r.tipo_rateio || r.periodicidade || "").toUpperCase().includes("FIXO");
    const fixo = rows.filter(isFixo).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
    const variavel = rows.filter((r) => !isFixo(r)).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
    const combustivel = rows.filter((r) => catNome(r.categoria_custo).includes("COMBUST")).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
    const total = fixo + variavel;
    return {
      fixo, variavel, combustivel, total,
      fixoMes: fixo / qtdMeses,
      variavelHora: totalHorasAeronave > 0 ? variavel / totalHorasAeronave : 0,
      combustivelHora: totalHorasAeronave > 0 ? combustivel / totalHorasAeronave : 0,
    };
  }, [data, qtdMeses, totalHorasAeronave, catNome]);

  const medias = useMemo(() => {
    const h = totalHorasAeronave;
    const totalVoos = (data?.voos ?? []).length;
    return {
      custoMes: baseCustos.total / qtdMeses,
      horasMes: h / qtdMeses,
      voosMes: totalVoos / qtdMeses,
      custoHora: h > 0 ? baseCustos.total / h : 0,
      custoPouso: totalPousos > 0 ? baseCustos.total / totalPousos : 0,
      litrosHora: h > 0 ? totalLitros / h : 0,
      valorLitro: totalLitros > 0 ? baseCustos.combustivel / totalLitros : 0,
      horasVoo: h > 0 && totalVoos > 0 ? h / totalVoos : 0,
      pousosMes: totalPousos / qtdMeses,
      litrosMes: totalLitros / qtdMeses,
    };
  }, [baseCustos, data, qtdMeses, totalHorasAeronave, totalPousos, totalLitros]);

  const projecao = useMemo(() => {
    const fixoMes = baseCustos.fixoMes;
    const varHora = baseCustos.variavelHora;
    const linhas: any[] = [];
    if (fixoMes <= 0 && varHora <= 0) return { linhas, taxaProjecao: 0, pontoOtimo: null as any };
    for (let hrs = 1; hrs <= 45; hrs++) {
      const custoFixoHora = fixoMes / hrs;
      const custoHora = custoFixoHora + varHora;
      const custoTotal = fixoMes + varHora * hrs;
      linhas.push({ horas: hrs, custoVariavel: varHora, custoFixoHora, custoHora, custoTotal, indice: varHora > 0 ? custoHora / varHora : 0 });
    }
    const pontoOtimo = linhas.find((l, i) => {
      const prev = linhas[i - 1];
      return prev && (prev.custoHora - l.custoHora) / prev.custoHora < 0.02;
    }) ?? null;
    const taxaProjecao = medias.custoHora || (linhas[0]?.custoHora ?? 0);
    return { linhas, taxaProjecao, pontoOtimo };
  }, [baseCustos, medias]);

  const maxProjCusto = Math.max(1, ...projecao.linhas.map((l) => l.custoHora));

  const aeronaveLabel = data?.aeronave
    ? `${data.aeronave.matricula}${data.aeronave.modelo ? ` — ${data.aeronave.modelo}` : ""}`
    : aeronaveId;

  const rateioDeC = (rateios: RateioRow[], cid: string) => rateios.find((r) => r.socio_id === cid || r.cliente_id === cid);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 antialiased print:bg-white print:text-black">
      
      {/* HEADER FIXO */}
      <div className="sticky top-0 z-30 border-b border-slate-700 bg-slate-800/90 backdrop-blur-xl shadow-sm print:static print:border-none print:shadow-none print:bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Plane className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                Fechamento Financeiro
              </p>
              <p className="truncate text-base font-bold text-slate-100">
                {aeronaveLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/50 px-3.5 py-1.5">
              <span className="hidden text-[10px] uppercase font-bold tracking-widest text-slate-500 sm:inline">
                {mesesSelecionados.length > 1 ? "Período" : "Competência"}
              </span>
              <span className="text-sm font-semibold text-primary">{mesLabel}</span>
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.97] print:hidden"
            >
              <Printer className="h-4 w-4"/>
              Imprimir PDF
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-600 bg-card/80 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800/50 active:scale-[0.97] print:hidden"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
        
        {/* TAB BAR */}
        {!isLoading && (
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 print:hidden">
            <nav className="flex space-x-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabButton active={activeTab === "lancamentos"} onClick={() => setActiveTab("lancamentos")} icon={WalletCards} label="Lançamentos e Acertos" />
              <TabButton active={activeTab === "resumos"} onClick={() => setActiveTab("resumos")} icon={ClipboardList} label="Resumo e Médias" />
              <TabButton active={activeTab === "graficos"} onClick={() => setActiveTab("graficos")} icon={BarChart3} label="Gráficos e Projeções" />
              <TabButton active={activeTab === "diario"} onClick={() => setActiveTab("diario")} icon={BookOpen} label="Diário de Bordo" />
            </nav>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700/60 border-t-blue-600" />
            <p className="text-sm font-medium">Carregando relatório...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6 print:p-0">
          
          {/* ════════════════════════════════════════════════════════════════
              ABA 1: LANÇAMENTOS E ACERTOS DE CONTAS
              ════════════════════════════════════════════════════════════════ */}
          <div className={`space-y-8 animate-fade-in print:block print:space-y-8 ${activeTab === "lancamentos" ? "block" : "hidden"}`}>
            
            {/* Acerto de Contas (A Receber De) */}
            <section>
              <TituloSecao titulo="Acerto de Contas (Quem deve pra quem)"/>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-card/80 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border-b border-r border-slate-700/60 bg-slate-800/50 p-2" />
                        <th colSpan={cotistas.length} className="border-b border-slate-700/60 bg-amber-500/15 py-2 text-center text-xs font-bold uppercase tracking-widest text-amber-400">
                          Devem pagar para (A Receber De)
                        </th>
                      </tr>
                      <tr className="bg-slate-800/50 text-xs font-semibold uppercase text-slate-500">
                        <th className="border-b border-r border-slate-700/60 py-3 px-4 text-left">
                          Quem Pagou ↓
                        </th>
                        {cotistas.map((c) => (
                          <th key={c.id} className="border-b border-slate-700/60 py-3 px-4 text-center">
                            {c.nome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {saldos.map((row) => {
                        const credoresTotal = saldos.filter((s) => s.saldo > 0).reduce((t, s) => t + s.saldo, 0);
                        return (
                          <tr key={row.id} className="hover:bg-slate-800/50">
                            <td className="border-b border-r border-slate-700/60 bg-slate-800/50 py-3 px-4 font-semibold text-slate-200">
                              {row.nome}
                            </td>
                            {saldos.map((col) => {
                              if (row.id === col.id) {
                                return <td key={col.id} className="border-b border-slate-700/60 py-3 px-4 text-center text-slate-500">—</td>;
                              }
                              let val = 0;
                              if (row.saldo > 0.01 && col.saldo < -0.01 && credoresTotal > 0.01) {
                                val = Math.abs(col.saldo) * (row.saldo / credoresTotal);
                              }
                              return (
                                <td key={col.id} className={`border-b border-slate-700/60 py-3 px-4 text-right font-mono text-sm ${val > 0.01 ? "text-emerald-400 font-bold bg-emerald-500/15" : "text-slate-500"}`}>
                                  {val > 0.01 ? BRL(val) : "R$ —"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {saldos.map((s) => (
                    <div key={s.id} className={`rounded-xl border p-5 shadow-sm ${s.saldo >= 0 ? "border-emerald-500/30 bg-emerald-500/15" : "border-red-500/30 bg-red-500/15"}`}>
                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
                        {s.nome}
                      </p>
                      <div className="flex items-center gap-2 mb-2">
                        {s.saldo >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-400"/> : <TrendingDown className="h-5 w-5 text-red-400"/>}
                        <p className={`text-2xl font-bold ${s.saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {BRL(Math.abs(s.saldo))}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-slate-300 mb-4">
                        {s.saldo >= 0 ? "Tem a receber" : "Tem a pagar"}
                      </p>
                      <div className="space-y-1.5 border-t border-slate-700/60/60 pt-3 text-xs">
                        <div className="flex justify-between text-slate-300"><span>Pagou:</span><span className="font-mono font-medium">{BRL(s.pagou)}</span></div>
                        <div className="flex justify-between text-slate-300"><span>Deve:</span><span className="font-mono font-medium">{BRL(s.deve)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Tabela de Lançamentos */}
            <section>
              <TituloSecao titulo="Todos os Lançamentos e Rateios" />
              {despesasAgrupadas.length === 0 ? (
                <Vazio texto="Nenhum lançamento encontrado para este período."/>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-card/80 shadow-sm">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-800/50 text-[10px] uppercase tracking-widest text-slate-500">
                        <th colSpan={9} className="border-b border-r border-slate-700/60 py-3 px-4 text-left font-bold">
                          Qualificação da Despesa
                        </th>
                        {cotistas.map((c) => (
                          <th key={`g-pct-${c.id}`} className="border-b border-slate-700/60 py-3 px-2 text-center font-bold text-slate-500">%</th>
                        ))}
                        {cotistas.map((c) => (
                          <th key={`g-rat-${c.id}`} className="border-b border-l border-slate-700/60 py-3 px-2 text-center font-bold text-primary">
                            {c.nome.split(" ")[0]}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-slate-800/60 text-[10px] font-bold uppercase text-slate-300">
                        <Th>Data</Th>
                        <Th>Doc</Th>
                        <Th>Fornecedor</Th>
                        <Th>Descrição</Th>
                        <Th>Categoria</Th>
                        <Th>Tipo</Th>
                        <Th>Prazo</Th>
                        <Th>Pago Por</Th>
                        <Th className="border-r border-slate-700/60 text-slate-100" right>Total</Th>
                        {cotistas.map((c) => <Th key={`h-pct-${c.id}`} right>{abrev(c.nome)} %</Th>)}
                        {cotistas.map((c) => <Th key={`h-rat-${c.id}`} className="border-l border-slate-700/60 text-primary" right>R$</Th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {despesasAgrupadas.map(({ ref, rateios }, i) => {
                        const dataRef = ref.data_pagamento || ref.data_vencimento;
                        const doc = ref.numero_nf || ref.numero_doc || "—";
                        const prazo = inferirPrazo(catNome(ref.categoria_custo), ref.tipo_rateio);

                        return (
                          <tr key={ref.despesa_id || ref.id} className="hover:bg-slate-800/50 transition-colors">
                            <Td mono>{fmtDate(dataRef)}</Td>
                            <Td mono dim={doc === "—"}>{doc}</Td>
                            <Td fontSemibold>{ref.fornecedor_nome || "—"}</Td>
                            <Td max="180px">{ref.descricao_despesa || "—"}</Td>
                            <Td upper>{catNome(ref.categoria_custo)}</Td>
                            <Td dim upper>{tipoRateioLabel(ref.tipo_rateio || ref.periodicidade)}</Td>
                            <Td dim upper>{prazo}</Td>
                            <Td upper>{ref.pago_por || "—"}</Td>
                            <Td className="border-r border-slate-700/60 font-bold text-slate-100" mono right>
                              {BRL(ref.valor_total_despesa)}
                            </Td>
                            {cotistas.map((c) => {
                              const r = rateioDeC(rateios, c.id);
                              const pct = Number(r?.percentual_uso ?? r?.percentual_sociedade ?? 0);
                              return <Td key={`pct-${c.id}`} dim={pct === 0} mono right>{pct > 0 ? `${NUM(pct, 4)}%` : "0%"}</Td>;
                            })}
                            {cotistas.map((c) => {
                              const r = rateioDeC(rateios, c.id);
                              const val = Number(r?.valor_rateado ?? 0);
                              return (
                                <Td key={`rat-${c.id}`} className="border-l border-slate-700/60" dim={val === 0} fontSemibold={val > 0} mono right>
                                  {val > 0 ? BRL(val) : "—"}
                                </Td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-800 text-xs font-bold text-white">
                        <td colSpan={8} className="py-3 px-4 text-right">Total Geral</td>
                        <td className="py-3 px-4 text-right font-mono border-r border-slate-600">{BRL(totalGeral)}</td>
                        {cotistas.map((c) => <td key={`ft-pct-${c.id}`} className="py-3 px-4 text-right text-slate-500">—</td>)}
                        {cotistas.map((c) => (
                          <td key={`ft-rat-${c.id}`} className="py-3 px-4 text-right font-mono text-blue-300 border-l border-slate-600">
                            {BRL(pivot.cotTot.get(c.id) ?? 0)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              ABA 2: RESUMO GERAL E MÉDIAS
              ════════════════════════════════════════════════════════════════ */}
          <div className={`space-y-8 animate-fade-in print:block print:space-y-8 ${activeTab === "resumos" ? "block" : "hidden"}`}>
            
            <section>
              <TituloSecao titulo="Resumo Geral por Cotista" />
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiCard label="Custo Total" value={BRL(totalGeral)} />
                <KpiCard label="Horas Voadas" value={hhMM(totalHorasAeronave)} />
                <KpiCard label="Qtd Pousos" value={String(totalPousos)} />
                <KpiCard label="Combustível" value={`${NUM(totalLitros, 0)} L`} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {resumoCotistas.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-700/60 bg-card/80 shadow-sm overflow-hidden">
                    <div className="bg-primary/15 px-5 py-4 border-b border-slate-700/60">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Cotista</p>
                      <p className="text-lg font-bold text-slate-100">{c.nome}</p>
                    </div>
                    <div className="p-5 space-y-4 text-sm">
                      <div className="space-y-2">
                        <LinhaResumo label="Custos Fixos" value={c.fixo} bold />
                        <LinhaResumo label="Custos Variáveis" value={c.variavel} bold />
                      </div>
                      <div className="border-t border-slate-700/40 pt-3 flex justify-between items-center bg-slate-800/50 p-2 rounded-lg">
                        <span className="text-slate-300 font-bold uppercase text-xs">Custo Total</span>
                        <span className="font-mono text-base font-bold text-primary">{BRL(c.total)}</span>
                      </div>
                      {(c.horas > 0 || c.litros > 0) && (
                        <div className="border-t border-slate-700/40 pt-4 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Indicadores Operacionais</p>
                          {c.horas > 0 && <LinhaResumo isText label="Horas Voadas" value={hhMM(c.horas)} />}
                          {c.pousos > 0 && <LinhaResumo isText label="Qtd Pousos" value={String(c.pousos)} />}
                          {c.litros > 0 && <LinhaResumo isText label="Abastecimento" value={`${NUM(c.litros, 0)} L`} />}
                          {c.custoHora > 0 && <LinhaResumo isText label="Custo / Hora" value={BRL(c.custoHora)} />}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <TituloSecao titulo="Análise de Médias e Composição de Custos" />
              <p className="mb-5 -mt-3 text-sm text-slate-500">
                Considerando <strong>{qtdMeses} {qtdMeses > 1 ? "meses fechados" : "mês fechado"}</strong>, com um total de <strong>{hhMM(totalHorasAeronave)} horas</strong> e <strong>{totalPousos} pousos</strong>.
              </p>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5 mb-6">
                <KpiCard label="Custo Mês (Médio)" value={BRL(medias.custoMes)} />
                <KpiCard label="Custo Hora (Médio)" value={BRL(medias.custoHora)} />
                <KpiCard label="Custo Pouso (Médio)" value={BRL(medias.custoPouso)} />
                <KpiCard label="Valor Médio Litro" value={BRL(medias.valorLitro)} />
                <KpiCard label="Consumo Litros/Hora" value={`${NUM(medias.litrosHora, 1)} L`} />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-700/60 bg-card/80 p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Composição Global de Custo</p>
                  <div className="flex h-6 overflow-hidden rounded-full bg-slate-800/60 mb-4">
                    <div className="h-full bg-blue-500" style={{ width: `${baseCustos.total > 0 ? (baseCustos.fixo / baseCustos.total) * 100 : 0}%` }} title="Fixos" />
                    <div className="h-full bg-amber-400" style={{ width: `${baseCustos.total > 0 ? (baseCustos.variavel / baseCustos.total) * 100 : 0}%` }} title="Variáveis" />
                  </div>
                  <div className="space-y-3">
                    <LinhaResumo label="Custos Fixos (Azul)" value={baseCustos.fixo} bold />
                    <LinhaResumo label="Custos Variáveis (Amarelo)" value={baseCustos.variavel} bold />
                    <div className="border-t border-slate-700/40 pt-2 mt-2">
                      <LinhaResumo label="Gasto com Combustível (Dentro do Variável)" value={baseCustos.combustivel} />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700/60 bg-card/80 p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Bases Para Rateio</p>
                  <div className="space-y-3">
                    <LinhaResumo label="Custo Fixo Mensal" value={baseCustos.fixoMes} bold />
                    <LinhaResumo label="Custo Variável por Hora Voada" value={baseCustos.variavelHora} bold />
                    <LinhaResumo label="Combustível por Hora Voada" value={baseCustos.combustivelHora} bold />
                  </div>
                  <div className="mt-5 rounded-lg bg-slate-800/50 p-4 border border-slate-700/40 text-xs text-slate-300 leading-relaxed">
                    <strong>Como funciona:</strong> O custo fixo mensal se mantém independente de voar (Hangaragem, Tripulação). O custo variável (Combustível, Manutenção Hora) é acionado exclusivamente quando a aeronave voa.
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              ABA 3: GRÁFICOS E ANÁLISES DE CUSTO
              ════════════════════════════════════════════════════════════════ */}
          <div className={`space-y-8 animate-fade-in print:block print:space-y-8 ${activeTab === "graficos" ? "block" : "hidden"}`}>
            
            <section>
              <TituloSecao titulo="Distribuição por Categoria de Gasto" />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-slate-700/60 bg-card/80 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-800/50 text-xs font-bold uppercase text-slate-500">
                        <Th className="text-left py-3 px-4">Categoria</Th>
                        {cotistas.map((c) => <Th key={c.id} right>{c.nome}</Th>)}
                        <Th className="text-slate-100" right>Total Geral</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {pivot.sortedCats.map((cat) => {
                        const byC = pivot.cats.get(cat)!;
                        const rowTotal = Array.from(byC.values()).reduce((s, v) => s + v, 0);
                        return (
                          <tr key={cat} className="hover:bg-slate-800/50">
                            <Td className="font-bold text-slate-200 py-3 px-4" upper>{cat}</Td>
                            {cotistas.map((c) => (
                              <Td key={c.id} dim={!byC.get(c.id)} mono right>
                                {byC.get(c.id) ? BRL(byC.get(c.id)!) : "—"}
                              </Td>
                            ))}
                            <Td className="font-bold text-slate-100" mono right>{BRL(rowTotal)}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/15 text-xs font-bold text-primary border-t-2 border-primary/30">
                        <td className="py-3 px-4 uppercase">Total Geral</td>
                        {cotistas.map((c) => (
                          <td key={c.id} className="py-3 px-4 text-right font-mono text-primary">{BRL(pivot.cotTot.get(c.id) ?? 0)}</td>
                        ))}
                        <td className="py-3 px-4 text-right font-mono">{BRL(pivot.grand)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="rounded-xl border border-slate-700/60 bg-card/80 p-5 shadow-sm flex flex-col gap-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Participação Gráfica</p>
                  {pivot.sortedCats.map((cat) => {
                    const byC = pivot.cats.get(cat)!;
                    const rowTotal = Array.from(byC.values()).reduce((s, v) => s + v, 0);
                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-slate-200 uppercase">{cat}</span>
                          <span className="font-mono font-semibold text-slate-300">{BRL(rowTotal)}</span>
                        </div>
                        <div className="flex h-5 overflow-hidden rounded-full bg-slate-800/60">
                          {cotistas.map((c, ci) => {
                            const val = byC.get(c.id) ?? 0;
                            const pct = pivot.grand > 0 ? (val / pivot.grand) * 100 : 0;
                            return (
                              <div
                                key={c.id}
                                title={`${c.nome}: ${BRL(val)}`}
                                style={{ width: `${pct}%` }}
                                className={`h-full ${BAR_COLORS[ci % BAR_COLORS.length]}`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-4 pt-4 border-t border-slate-700/40 flex flex-wrap gap-3">
                    {cotistas.map((c, ci) => (
                      <div key={c.id} className="flex items-center gap-2 text-xs font-medium text-slate-300">
                        <span className={`h-3 w-3 rounded-full ${BAR_COLORS[ci % BAR_COLORS.length]}`} />
                        {c.nome}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <TituloSecao titulo="Ranking dos Maiores Gastos" />
              {ranking.length === 0 ? (
                <Vazio texto="Sem gastos registrados." />
              ) : (
                <div className="rounded-xl border border-slate-700/60 bg-card/80 shadow-sm divide-y divide-slate-700/40">
                  {ranking.map((r, i) => (
                    <div key={r.nome} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-800/50">
                      <span className="w-8 text-center text-sm font-bold text-slate-500">{i + 1}º</span>
                      <span className="flex-1 truncate text-sm font-bold uppercase text-slate-200">{r.nome}</span>
                      <span className="w-32 text-right font-mono text-sm font-semibold text-slate-100">{BRL(r.valor)}</span>
                      <span className="w-16 shrink-0 rounded-lg bg-primary/15 px-2 py-1 text-center text-xs font-bold text-primary">
                        {NUM(r.pct, 0)}%
                      </span>
                      <div className="hidden h-2 w-48 shrink-0 overflow-hidden rounded-full bg-slate-800/60 sm:block">
                        <div className="h-full bg-blue-500" style={{ width: `${Math.max(2, r.pct)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <TituloSecao titulo="Projeção de Custos por Hora Voada" />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2 space-y-5">
                  <div className="rounded-xl bg-blue-600 p-6 text-white shadow-md">
                    <p className="text-xs uppercase font-bold tracking-widest text-blue-200/80 mb-2">
                      Taxa Atual de Projeção
                    </p>
                    <p className="font-mono text-3xl font-bold">
                      {BRL(projecao.taxaProjecao)} <span className="text-lg font-normal text-blue-200/80">/ hora</span>
                    </p>
                    <p className="mt-3 text-sm text-blue-100/80">
                      Este é o custo/hora baseado na utilização atual. A tabela ao lado projeta diferentes cenários de uso.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-700/60 bg-card/80 p-5 text-sm text-slate-300 space-y-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-100">Como analisar:</p>
                    <p>O <strong>Custo Variável</strong> ({BRL(baseCustos.variavelHora)}) ocorre a cada hora de voo.</p>
                    <p>O <strong>Custo Fixo</strong> ({BRL(baseCustos.fixoMes)}) é diluído nas horas voadas. Voar mais, reduz drasticamente o peso fixo da aeronave.</p>
                    {projecao.pontoOtimo && (
                      <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/15 p-3 text-emerald-400 font-medium">
                        O Ponto Ideal de uso é a partir de <strong>{projecao.pontoOtimo.horas}h/mês</strong>, onde a diluição de custos se estabiliza.
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-3 max-h-[500px] overflow-auto rounded-xl border border-slate-700/60 shadow-sm bg-card/80">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-800/60 text-[10px] font-bold uppercase text-slate-300 shadow-sm">
                        <Th className="py-3 px-3" right>H. Voadas</Th>
                        <Th right>Variável (Fixo)</Th>
                        <Th right>Fixo / Hora</Th>
                        <Th right>Custo Hora</Th>
                        <Th right>Índice</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {projecao.linhas.map((l) => {
                        const destaque = projecao.pontoOtimo && l.horas === projecao.pontoOtimo.horas;
                        return (
                          <tr key={l.horas} className={destaque ? "bg-emerald-500/15" : "hover:bg-slate-800/50"}>
                            <Td className={`font-bold py-2 ${destaque ? 'text-emerald-400' : 'text-slate-100'}`} mono right>{l.horas}h</Td>
                            <Td dim mono right>{BRL(l.custoVariavel)}</Td>
                            <Td dim mono right>{BRL(l.custoFixoHora)}</Td>
                            <Td className={`font-bold ${destaque ? 'text-emerald-400' : 'text-primary'}`} mono right>{BRL(l.custoHora)}</Td>
                            <Td className="text-slate-500 font-medium" mono right>{NUM(l.indice, 2)}x</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              ABA 4: DIÁRIO DE BORDO
              ════════════════════════════════════════════════════════════════ */}
          <div className={`space-y-8 animate-fade-in print:block print:space-y-8 ${activeTab === "diario" ? "block" : "hidden"}`}>
            <section>
              <TituloSecao titulo="Registros do Diário de Bordo" />
              {!data?.voos || data.voos.length === 0 ? (
                <Vazio texto="Nenhum voo registrado neste período." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-card/80 shadow-sm">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-800/50 text-xs font-bold uppercase text-slate-500">
                        <Th className="py-3 px-4">Data</Th>
                        <Th>Partida</Th>
                        <Th>Chegada</Th>
                        <Th>Trecho / Info</Th>
                        <Th right>Horas</Th>
                        <Th right>Pousos</Th>
                        <Th right>Abast.</Th>
                        <Th>Natureza</Th>
                        <Th>Responsável</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      {data.voos.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-800/50">
                          <Td className="py-3 px-4" mono>{fmtDate(v.data_registro)}</Td>
                          <Td fontSemibold>{v.aerodromo_partida || "—"}</Td>
                          <Td fontSemibold>{v.aerodromo_chegada || "—"}</Td>
                          <Td max="160px" dim>{v.trecho || "—"}</Td>
                          <Td className="font-bold text-slate-200" mono right>{v.tempo_voo ? hhMM(v.tempo_voo) : v.tempo_total ? hhMM(v.tempo_total) : "—"}</Td>
                          <Td mono right dim>{v.pousos_total ?? "—"}</Td>
                          <Td mono right className="text-amber-400 font-medium">{v.combustivel_adicionado ? `${NUM(v.combustivel_adicionado, 0)} L` : "—"}</Td>
                          <Td dim upper>{v.natureza_voo || "—"}</Td>
                          <Td>
                            <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary border border-primary/20">
                              {v.socios_nome || "—"}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-800 text-xs font-bold text-white">
                        <td colSpan={4} className="py-3 px-4 text-right uppercase">Total do Período</td>
                        <td className="py-3 px-4 text-right font-mono text-blue-300">{hhMM(totalHorasAeronave)}</td>
                        <td className="py-3 px-4 text-right font-mono">{totalPousos}</td>
                        <td className="py-3 px-4 text-right font-mono text-amber-300">{NUM(totalLitros, 0)} L</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </div>

          <footer className="mt-12 border-t border-slate-700 pt-6 text-center text-xs text-slate-500 font-medium">
            Gerado pelo Sistema Share Brasil • {aeronaveLabel} • {mesLabel} • Impresso em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </footer>

        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES E UI
// ─────────────────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  "bg-blue-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
];

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-4 text-sm font-bold transition-colors ${
        active 
          ? "border-blue-600 text-primary" 
          : "border-transparent text-slate-500 hover:border-slate-600 hover:text-slate-200"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function TituloSecao({ titulo }: { titulo: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 print:mb-4">
      <h2 className="text-lg font-bold tracking-tight text-slate-100">
        {titulo}
      </h2>
      <div className="h-px flex-1 bg-slate-700/50" />
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-600 bg-slate-800/50 py-16 text-center text-sm font-medium text-slate-500">
      {texto}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-card/80 p-5 shadow-sm transition-all hover:shadow-md">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="font-mono text-2xl font-bold tracking-tight text-primary">
        {value}
      </p>
    </div>
  );
}

function LinhaResumo({ label, value, isText, bold }: { label: string; value: number | string; isText?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-3 text-sm">
      <span className={bold ? "font-semibold text-slate-200" : "text-slate-500"}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-slate-100" : "text-slate-300"}`}>
        {isText ? String(value) : BRL(value as number)}
      </span>
    </div>
  );
}

// ── Células de Tabela ─────────────────────────────────────────────────────────

function Th({ children, right, className = "" }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <th className={["py-3 px-3 border-b border-slate-700/60 whitespace-nowrap align-middle", right ? "text-right" : "text-left", className].join(" ")}>
      {children}
    </th>
  );
}

function Td({ children, right, mono, upper, dim, fontSemibold, max, className = "" }: { children?: React.ReactNode; right?: boolean; mono?: boolean; upper?: boolean; dim?: boolean; fontSemibold?: boolean; max?: string; className?: string }) {
  return (
    <td
      style={max ? { maxWidth: max, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined}
      className={[
        "py-2 px-3 align-middle",
        right ? "text-right" : "text-left",
        mono ? "font-mono" : "",
        upper ? "uppercase" : "",
        dim ? "text-slate-500" : "text-slate-200",
        fontSemibold ? "font-semibold" : "",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

function abrev(nome: string) {
  return nome.split(" ")[0];
}

function tipoRateioLabel(val: string | null) {
  if (!val) return "—";
  return val.toUpperCase();
}

function inferirPrazo(cat: string | null, tipo: string | null): string {
  const t = ((tipo || "") + (cat || "")).toUpperCase();
  if (t.includes("LONGO")) return "LONGO PRAZO";
  if (t.includes("CURTO") || t.includes("VOO") || t.includes("COMBUSTIVEL") || t.includes("COMBUSTÍVEL")) return "CURTO PRAZO";
  return "MÉDIO PRAZO";
}
