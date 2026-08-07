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
  id: string;           // socio_id ou cliente_id
  nome: string;         // socios_nome ou clientes_nome
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
        // 1. Rateios conferidos (meses fechados) do período
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

        // 2. Diário de bordo
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

        // 3. Info da aeronave
        supabase
          .from("aeronave")
          .select("matricula, modelo, fabricante")
          .eq("id", aeronaveId)
          .maybeSingle(),

        // 4. Categorias de despesa (expense_configu) para resolver UUIDs
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

/** Resolve o nome da categoria (aceita UUID de expense_configu ou texto livre) */
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
  /** Ano de referência do balanço */
  ano?: number;
  /** Meses selecionados (1-12). Somatória quando houver mais de um. */
  meses?: number[];
  /** Se quiser exibir dentro de um modal, passe onClose */
  onClose?: () => void;
}

export function FechamentoBalancoVisualizador({ aeronaveId, ano: anoProp, meses, onClose }: Props) {
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

  // ── Extrair cotistas únicos ────────────────────────────────────────────────
  const cotistas = useMemo<CotistaInfo[]>(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    data.rateios.forEach((r) => {
      const id = r.socio_id || r.cliente_id;
      const nome = r.socios_nome || r.clientes_nome;
      if (id && nome && !map.has(id)) map.set(id, nome);
    });
    // manter ordem de aparição
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [data]);

  // ── Agrupar rateios por despesa (uma linha por despesa) ───────────────────
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

  // ── Pivot análise de custo (Seção 2) ─────────────────────────────────────
  const pivot = useMemo(() => {
    const cats = new Map<string, Map<string, number>>(); // cat → cotistaid → valor
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

    // categorias na mesma ordem do PDF
    const ORDER = [
      "COMBUSTÍVEIS", "HANGARAG./TAXAS", "MANUTENÇÃO", "TRIPULAÇÃO & ADM",
    ];
    const sortedCats = Array.from(cats.keys()).sort((a, b) => {
      const ia = ORDER.findIndex((o) => a.includes(o.split("/")[0]));
      const ib = ORDER.findIndex((o) => b.includes(o.split("/")[0]));
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    return { cats, cotTot, grand, sortedCats };
  }, [despesasAgrupadas]);

  // ── Resumo por cotista (Seção 4) ─────────────────────────────────────────
  const resumoCotistas = useMemo(() => {
    if (!data) return [];
    return cotistas.map((c) => {
      const rows = data.rateios.filter(
        (r) => r.socio_id === c.id || r.cliente_id === c.id
      );
      const fixo = rows
        .filter((r) => (r.tipo_rateio || r.periodicidade || "").toUpperCase().includes("FIXO"))
        .reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
      const variavel = rows
        .filter((r) => !(r.tipo_rateio || r.periodicidade || "").toUpperCase().includes("FIXO"))
        .reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);

      const voosCot = data.voos.filter((v) => v.socios_id === c.id);
      const horas = voosCot.reduce((s, v) => s + Number(v.tempo_voo ?? 0), 0);
      const pousos = voosCot.reduce((s, v) => s + Number(v.pousos_total ?? 0), 0);
      const litros = voosCot.reduce((s, v) => s + Number(v.combustivel_adicionado ?? 0), 0);

      return {
        ...c, fixo, variavel, total: fixo + variavel,
        horas, pousos, litros,
        custoHora: horas > 0 ? (fixo + variavel) / horas : 0,
      };
    });
  }, [data, cotistas]);

  // ── Saldos para balanço (Seção 3) ────────────────────────────────────────
  const saldos = useMemo(() => {
    const pagou = new Map<string, number>();  // quanto cada cotista pagou de saída
    const deve = new Map<string, number>();   // quanto cada cotista deve (rateio)

    despesasAgrupadas.forEach(({ ref, rateios }) => {
      // quem pagou esta despesa?
      const pagadorNome = (ref.pago_por || "").toLowerCase();
      const pagador = cotistas.find((c) =>
        c.nome.toLowerCase().includes(pagadorNome) ||
        pagadorNome.includes(c.nome.toLowerCase().split(" ")[0])
      );
      if (pagador) {
        pagou.set(
          pagador.id,
          (pagou.get(pagador.id) ?? 0) + Number(ref.valor_total_despesa ?? 0)
        );
      }
      // o que cada um deve pagar
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

  // ── Totais globais ────────────────────────────────────────────────────────
  const totalGeral = despesasAgrupadas.reduce(
    (s, d) => s + Number(d.ref.valor_total_despesa ?? 0), 0
  );
  const totalHorasAeronave = (data?.voos ?? []).reduce(
    (s, v) => s + Number(v.tempo_voo ?? 0), 0
  );
  const totalPousos = (data?.voos ?? []).reduce(
    (s, v) => s + Number(v.pousos_total ?? 0), 0
  );
  const totalLitros = (data?.voos ?? []).reduce(
    (s, v) => s + Number(v.combustivel_adicionado ?? 0), 0
  );

  // ── Nº de meses do fechamento ─────────────────────────────────────────────
  const qtdMeses = Math.max(1, mesesSelecionados.length);

  // ── Ranking dos gastos por categoria ──────────────────────────────────────
  const ranking = useMemo(() => {
    const map = new Map<string, number>();
    (data?.rateios ?? []).forEach((r) => {
      const cat = catNome(r.categoria_custo);
      map.set(cat, (map.get(cat) ?? 0) + Number(r.valor_rateado ?? 0));
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .map(([nome, valor]) => ({
        nome,
        valor,
        pct: total > 0 ? (valor / total) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [data]);

  // ── Separação fixo × variável (base para médias e projeção) ───────────────
  const baseCustos = useMemo(() => {
    const rows = data?.rateios ?? [];
    const isFixo = (r: RateioRow) =>
      (r.tipo_rateio || r.periodicidade || "").toUpperCase().includes("FIXO");
    const fixo = rows.filter(isFixo).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
    const variavel = rows.filter((r) => !isFixo(r)).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
    const combustivel = rows
      .filter((r) => catNome(r.categoria_custo).includes("COMBUST"))
      .reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
    const total = fixo + variavel;
    return {
      fixo,
      variavel,
      combustivel,
      total,
      fixoMes: fixo / qtdMeses,
      variavelHora: totalHorasAeronave > 0 ? variavel / totalHorasAeronave : 0,
      combustivelHora: totalHorasAeronave > 0 ? combustivel / totalHorasAeronave : 0,
    };
  }, [data, qtdMeses, totalHorasAeronave]);

  // ── Resumo das médias ─────────────────────────────────────────────────────
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

  // ── Tabela de projeção / índice de custo ──────────────────────────────────
  const projecao = useMemo(() => {
    const fixoMes = baseCustos.fixoMes;
    const varHora = baseCustos.variavelHora;
    const linhas: {
      horas: number;
      custoVariavel: number;
      custoFixoHora: number;
      custoHora: number;
      custoTotal: number;
      indice: number;
    }[] = [];
    if (fixoMes <= 0 && varHora <= 0) return { linhas, taxaProjecao: 0, pontoOtimo: null as any };
    for (let hrs = 1; hrs <= 45; hrs++) {
      const custoFixoHora = fixoMes / hrs;
      const custoHora = custoFixoHora + varHora;
      const custoTotal = fixoMes + varHora * hrs;
      linhas.push({
        horas: hrs,
        custoVariavel: varHora,
        custoFixoHora,
        custoHora,
        custoTotal,
        indice: varHora > 0 ? custoHora / varHora : 0,
      });
    }
    // ponto ótimo = onde o ganho marginal de custo/hora cai abaixo de 2%
    const pontoOtimo =
      linhas.find((l, i) => {
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

  // ── helper: rateio de um cotista em uma despesa ───────────────────────────
  const rateioDeC = (rateios: RateioRow[], cid: string) =>
    rateios.find((r) => r.socio_id === cid || r.cliente_id === cid);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-[#0b0d12] text-slate-100 antialiased print:bg-white print:text-black">
      {/* brilho ambiente muito sutil (tom teal) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-teal-500/[0.06] to-transparent print:hidden" />

      {/* ══════════════════════════════════════════════════════════════════════
          CABEÇALHO DO RELATÓRIO
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 border-b border-teal-500/10 bg-[#0b0d12]/70 backdrop-blur-2xl print:static print:border-none print:bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">

          {/* logo / identificação */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-teal-500/20 bg-teal-500/[0.08]">
              <Plane className="h-4 w-4 text-teal-300"/>
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] uppercase leading-none tracking-[0.22em] text-slate-500">
                Share Brasil
              </p>
              <p className="truncate text-sm font-medium leading-none text-slate-100">
                {aeronaveLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* período fechado */}
            <div className="flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/[0.06] px-3.5 py-1.5 backdrop-blur-xl">
              <span className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-500 sm:inline">
                {mesesSelecionados.length > 1 ? "Meses fechados" : "Mês fechado"}
              </span>
              <span className="text-xs font-medium text-teal-200 sm:text-sm">{mesLabel}</span>
            </div>

            {/* ações */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-medium text-slate-300 transition-all duration-300 hover:border-teal-500/40 hover:bg-teal-500/[0.09] hover:text-teal-200 active:scale-[0.97] print:hidden"
            >
              <Printer className="h-3.5 w-3.5"/>
              Exportar PDF
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-slate-400 transition-all duration-300 hover:bg-white/[0.06] hover:text-slate-200 active:scale-[0.97] print:hidden"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>


      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-teal-400" />
            <p className="text-sm">Carregando relatório...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="mx-auto max-w-[1400px] space-y-8 px-4 pb-28 pt-6 sm:space-y-12 sm:px-6 sm:py-10 print:space-y-6 print:px-0 print:py-4 print:pb-4">

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 1 — CENTRO DE LANÇAMENTO DE CUSTOS
              ════════════════════════════════════════════════════════════════ */}
          <section id="sec-1" className="scroll-mt-24 animate-fade-in">
            <TituloSecao numero={1} titulo="Centro de Lançamento de Custos"/>

            {despesasAgrupadas.length === 0 ? (
              <Vazio texto="Nenhum lançamento encontrado para este período."/>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-teal-500/15">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    {/* Linha de grupos */}
                    <tr className="bg-teal-500/[0.06] text-[9px] uppercase tracking-[0.15em] text-slate-500">
                      <th colSpan={9} className="border-b border-r border-teal-500/15 py-2 px-3 text-left">
                        Qualificação de Custo · Pagamento
                      </th>
                      {cotistas.map((c) => (
                        <th key={`g-pct-${c.id}`} className="border-b border-teal-500/15 py-2 px-2 text-center">
                          %
                        </th>
                      ))}
                      {cotistas.map((c) => (
                        <th key={`g-rat-${c.id}`} className="border-b border-teal-500/15 py-2 px-2 text-center border-l border-white/[0.07]">
                          {c.nome.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                    {/* Cabeçalhos */}
                    <tr className="bg-white/[0.045] backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Th>Data</Th>
                      <Th>Doc</Th>
                      <Th>Fornecedor</Th>
                      <Th>Descrição</Th>
                      <Th>Categoria</Th>
                      <Th>Tipo</Th>
                      <Th>Prazo</Th>
                      <Th>Pago Por</Th>
                      <Th className="border-r border-white/10" right>Valor Pago</Th>
                      {cotistas.map((c) => (
                        <Th key={`h-pct-${c.id}`} className="text-teal-300/60" right>
                          {abrev(c.nome)} %
                        </Th>
                      ))}
                      {cotistas.map((c) => (
                        <Th key={`h-rat-${c.id}`} className="text-emerald-600/80 border-l border-white/[0.07]" right>
                          {abrev(c.nome)} R$
                        </Th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {despesasAgrupadas.map(({ ref, rateios }, i) => {
                      const dataRef = ref.data_pagamento || ref.data_vencimento;
                      const doc = ref.numero_nf || ref.numero_doc || "—";
                      const prazo = inferirPrazo(catNome(ref.categoria_custo), ref.tipo_rateio);

                      return (
                        <tr
                          key={ref.despesa_id || ref.id}
                          className={
                            i % 2 === 0
                              ? "bg-transparent hover:bg-teal-500/[0.04]"
                              : "bg-teal-500/[0.02] hover:bg-teal-500/[0.05] backdrop-blur-xl"
                          }
                        >
                          <Td mono>{fmtDate(dataRef)}</Td>
                          <Td mono dim={doc === "—"}>{doc}</Td>
                          <Td>{ref.fornecedor_nome || "—"}</Td>
                          <Td max="180px">{ref.descricao_despesa || "—"}</Td>
                          <Td upper>{catNome(ref.categoria_custo)}</Td>
                          <Td dim upper>{tipoRateioLabel(ref.tipo_rateio || ref.periodicidade)}</Td>
                          <Td dim upper>{prazo}</Td>
                          <Td upper>{ref.pago_por || "—"}</Td>
                          <Td className="border-r border-white/[0.07] font-medium text-slate-200" mono right>
                            {BRL(ref.valor_total_despesa)}
                          </Td>
                          {cotistas.map((c) => {
                            const r = rateioDeC(rateios, c.id);
                            const pct = Number(r?.percentual_uso ?? r?.percentual_sociedade ?? 0);
                            return (
                              <Td key={`pct-${c.id}`} dim={pct === 0} mono right>
                                {pct > 0 ? `${NUM(pct, 4)}%` : "0,0000%"}
                              </Td>
                            );
                          })}
                          {cotistas.map((c) => {
                            const r = rateioDeC(rateios, c.id);
                            const val = Number(r?.valor_rateado ?? 0);
                            return (
                              <Td key={`rat-${c.id}`} className="border-l border-white/[0.06]" dim={val === 0} mono right>
                                {val > 0 ? BRL(val) : "R$ —"}
                              </Td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="bg-teal-500/[0.08] text-[10px] font-bold uppercase tracking-wider text-slate-300">
                      <td colSpan={8} className="py-2 px-3 text-right text-slate-400">
                        Total
                      </td>
                      <td className="py-2 px-3 text-right font-mono border-r border-teal-500/15 text-slate-200">
                        {BRL(totalGeral)}
                      </td>
                      {cotistas.map((c) => (
                        <td key={`ft-pct-${c.id}`} className="py-2 px-3 text-right text-slate-500">—</td>
                      ))}
                      {cotistas.map((c) => (
                        <td key={`ft-rat-${c.id}`} className="py-2 px-3 text-right font-mono text-emerald-400 border-l border-white/[0.07]">
                          {BRL(pivot.cotTot.get(c.id) ?? 0)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 2 — ANÁLISE DE CUSTO (pivot + barras)
              ════════════════════════════════════════════════════════════════ */}
          <section id="sec-2" className="scroll-mt-24 animate-fade-in">
            <TituloSecao numero={2} titulo="Análise de Custo"/>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Tabela pivot */}
              <div className="lg:col-span-2 overflow-x-auto rounded-2xl border border-teal-500/15">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.045] backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Th className="text-left">Categoria</Th>
                      {cotistas.map((c) => (
                        <Th key={c.id} right>{c.nome}</Th>
                      ))}
                      <Th className="text-slate-200" right>Total Geral</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivot.sortedCats.map((cat, i) => {
                      const byC = pivot.cats.get(cat)!;
                      const rowTotal = Array.from(byC.values()).reduce((s, v) => s + v, 0);
                      return (
                        <tr
                          key={cat}
                          className={i % 2 === 0 ? "bg-transparent" : "bg-teal-500/[0.03]"}
                        >
                          <Td className="font-medium text-slate-300" upper>{cat}</Td>
                          {cotistas.map((c) => (
                            <Td key={c.id} dim={!byC.get(c.id)} mono right>
                              {byC.get(c.id) ? BRL(byC.get(c.id)!) : "—"}
                            </Td>
                          ))}
                          <Td className="font-semibold text-slate-200" mono right>
                            {BRL(rowTotal)}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-teal-500/[0.08] font-bold text-xs">
                      <td className="py-2 px-3 text-slate-300 uppercase tracking-wider">
                        Total Geral
                      </td>
                      {cotistas.map((c) => (
                        <td key={c.id} className="py-2 px-3 text-right font-mono text-teal-300">
                          {BRL(pivot.cotTot.get(c.id) ?? 0)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-mono text-white">
                        {BRL(pivot.grand)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Barras por categoria × cotista */}
              <div className="rounded-2xl border border-teal-500/15 bg-teal-500/[0.03] backdrop-blur-xl p-4 flex flex-col gap-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                  Distribuição por Categoria
                </p>
                {pivot.sortedCats.map((cat) => {
                  const byC = pivot.cats.get(cat)!;
                  const rowTotal = Array.from(byC.values()).reduce((s, v) => s + v, 0);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400 uppercase">{cat}</span>
                        <span className="text-slate-300 font-mono">{BRL(rowTotal)}</span>
                      </div>
                      <div className="flex h-4 overflow-hidden rounded-full bg-white/[0.05]">
                        {cotistas.map((c, ci) => {
                          const val = byC.get(c.id) ?? 0;
                          const pct = pivot.grand > 0 ? (val / pivot.grand) * 100 : 0;
                          return (
                            <div
                              key={c.id}
                              title={`${c.nome}: ${BRL(val)}`}
                              style={{ width: `${pct}%` }}
                              className={`h-full transition-all ${BAR_COLORS[ci % BAR_COLORS.length]}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Legenda cotistas */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {cotistas.map((c, ci) => (
                    <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span className={`h-2.5 w-2.5 rounded-full ${BAR_COLORS[ci % BAR_COLORS.length]}`} />
                      {c.nome}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 3 — BALANÇO DE CUSTOS (matriz "a receber de")
              ════════════════════════════════════════════════════════════════ */}
          <section id="sec-3" className="scroll-mt-24 animate-fade-in">
            <TituloSecao numero={3} titulo="Balanço de Custos — A Receber De"/>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Matriz */}
              <div className="overflow-x-auto rounded-2xl border border-teal-500/15">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border border-white/[0.07] bg-white/[0.035] backdrop-blur-xl p-2" />
                      <th
                        colSpan={cotistas.length}
                        className="border border-white/[0.07] bg-yellow-900/20 py-2 px-3 text-center text-[10px] uppercase tracking-widest text-yellow-500/80 font-semibold"
                      >
                        A Receber De
                      </th>
                    </tr>
                    <tr className="bg-white/[0.045] backdrop-blur text-[10px] text-slate-400 font-semibold uppercase">
                      <th className="border border-white/[0.07] py-2 px-3 text-left">
                        Pago Por ↓
                      </th>
                      {cotistas.map((c) => (
                        <th key={c.id} className="border border-white/[0.07] py-2 px-3 text-center">
                          {c.nome}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {saldos.map((row) => {
                      const credoresTotal = saldos.filter((s) => s.saldo > 0).reduce((t, s) => t + s.saldo, 0);
                      return (
                        <tr key={row.id} className="hover:bg-teal-500/[0.04] backdrop-blur-xl">
                          <td className="border border-white/[0.06] py-2 px-3 font-medium text-slate-300 bg-white/[0.02]">
                            {row.nome}
                          </td>
                          {saldos.map((col) => {
                            if (row.id === col.id) {
                              return (
                                <td key={col.id} className="border border-white/[0.06] py-2 px-3 text-center text-slate-600">
                                  —
                                </td>
                              );
                            }
                            // Quanto col deve pagar para row
                            let val = 0;
                            if (row.saldo > 0.01 && col.saldo < -0.01 && credoresTotal > 0.01) {
                              val = Math.abs(col.saldo) * (row.saldo / credoresTotal);
                            }
                            return (
                              <td
                                key={col.id}
                                className={`border border-white/[0.06] py-2 px-3 text-right font-mono ${
                                  val > 0.01
                                    ? "text-teal-400 font-semibold bg-teal-500/5"
                                    : "text-slate-600"
                                }`}
                              >
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

              {/* Cards de saldo */}
              <div className="grid grid-cols-2 gap-3">
                {saldos.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-2xl border p-4 ${
                      s.saldo >= 0
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-red-500/20 bg-red-500/5"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                      {s.nome}
                    </p>
                    <div className="flex items-center gap-1.5 mb-1">
                      {s.saldo >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-400"/>
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-red-400"/>
                      )}
                      <p className={`text-lg font-bold ${s.saldo >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {BRL(Math.abs(s.saldo))}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {s.saldo >= 0 ? "a receber" : "a pagar"}
                    </p>
                    <div className="mt-2 border-t border-white/[0.07] pt-2 space-y-0.5 text-[10px] text-slate-500">
                      <div className="flex justify-between">
                        <span>Pagou:</span>
                        <span className="font-mono text-slate-400">{BRL(s.pagou)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Deve:</span>
                        <span className="font-mono text-slate-400">{BRL(s.deve)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 4 — RESUMO GERAL POR COTISTA
              ════════════════════════════════════════════════════════════════ */}
          <section id="sec-4" className="scroll-mt-24 animate-fade-in">
            <TituloSecao numero={4} titulo="Resumo Geral por Cotista"/>

            {/* KPIs globais da aeronave */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard accent="teal" label="Total Geral" value={BRL(totalGeral)}/>
              <KpiCard accent="teal" label="Horas Voadas" value={hhMM(totalHorasAeronave)}/>
              <KpiCard accent="indigo" label="Pousos" value={String(totalPousos)}/>
              <KpiCard accent="amber" label="Abastecimento" value={`${NUM(totalLitros, 0)} L`}/>
            </div>

            {/* Um card por cotista */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {resumoCotistas.map((c) => (
                <div key={c.id} className="rounded-2xl border border-teal-500/15 overflow-hidden">
                  <div className="bg-teal-500/[0.06] px-4 py-3 border-b border-teal-500/15">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-0.5">Cotista</p>
                    <p className="font-semibold text-slate-100">{c.nome}</p>
                  </div>

                  <div className="bg-white/[0.035] backdrop-blur-xl p-4 space-y-2 text-xs">
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">
                        Custos Fixos
                      </p>
                      <LinhaResumo label="ADM e Pilotagem" value={c.fixo}/>
                    </div>

                    <div className="space-y-1.5 border-t border-white/[0.06] pt-2">
                      <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">
                        Custos Variáveis
                      </p>
                      <LinhaResumo label="Variáveis" value={c.variavel}/>
                    </div>

                    <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Total</span>
                      <span className="font-mono font-bold text-slate-100">{BRL(c.total)}</span>
                    </div>

                    {(c.horas > 0 || c.litros > 0) && (
                      <div className="border-t border-white/[0.06] pt-2 space-y-1.5">
                        <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">
                          Operacional
                        </p>
                        {c.horas > 0 && (
                          <LinhaResumo isText label="Horas voadas" value={hhMM(c.horas)}/>
                        )}
                        {c.pousos > 0 && (
                          <LinhaResumo isText label="Pousos" value={String(c.pousos)}/>
                        )}
                        {c.litros > 0 && (
                          <LinhaResumo isText label="Abastecimento" value={`${NUM(c.litros, 0)} L`}/>
                        )}
                        {c.custoHora > 0 && (
                          <LinhaResumo isText label="Custo/Hora" value={BRL(c.custoHora)}/>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 5 — RESUMO DAS MÉDIAS
              ════════════════════════════════════════════════════════════════ */}
          <section id="sec-5" className="scroll-mt-24 animate-fade-in">
            <TituloSecao numero={5} titulo="Resumo das Médias"/>
            <p className="mb-4 -mt-2 text-[11px] text-slate-500">
              Médias calculadas sobre {qtdMeses} {qtdMeses > 1 ? "meses fechados" : "mês fechado"},
              {" "}{hhMM(totalHorasAeronave)} de voo, {totalPousos} pousos e {NUM(totalLitros, 0)} litros abastecidos.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <KpiCard accent="teal" label="Custo médio / mês" value={BRL(medias.custoMes)}/>
              <KpiCard accent="teal" label="Custo médio / hora" value={BRL(medias.custoHora)}/>
              <KpiCard accent="indigo" label="Custo médio / pouso" value={BRL(medias.custoPouso)}/>
              <KpiCard accent="amber" label="Valor médio do litro" value={BRL(medias.valorLitro)}/>
              <KpiCard accent="teal" label="Litros / hora" value={`${NUM(medias.litrosHora, 1)} L`}/>
              <KpiCard accent="teal" label="Horas / mês" value={hhMM(medias.horasMes)}/>
              <KpiCard accent="indigo" label="Voos / mês" value={NUM(medias.voosMes, 1)}/>
              <KpiCard accent="amber" label="Horas por voo" value={hhMM(medias.horasVoo)}/>
              <KpiCard accent="teal" label="Pousos / mês" value={NUM(medias.pousosMes, 1)}/>
              <KpiCard accent="teal" label="Litros / mês" value={`${NUM(medias.litrosMes, 0)} L`}/>
            </div>

            {/* Composição fixo × variável */}
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-teal-500/15 bg-white/[0.035] backdrop-blur-xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                  Composição do Custo
                </p>
                <div className="flex h-4 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full bg-teal-500/70"
                    style={{ width: `${baseCustos.total > 0 ? (baseCustos.fixo / baseCustos.total) * 100 : 0}%` }}
                    title={`Fixos: ${BRL(baseCustos.fixo)}`}
                  />
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${baseCustos.total > 0 ? (baseCustos.variavel / baseCustos.total) * 100 : 0}%` }}
                    title={`Variáveis: ${BRL(baseCustos.variavel)}`}
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  <LinhaResumo label="Custos fixos (total)" value={baseCustos.fixo}/>
                  <LinhaResumo label="Custos variáveis (total)" value={baseCustos.variavel}/>
                  <LinhaResumo label="Combustível (total)" value={baseCustos.combustivel}/>
                </div>
              </div>

              <div className="rounded-2xl border border-teal-500/15 bg-white/[0.035] backdrop-blur-xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                  Bases de Cálculo
                </p>
                <div className="space-y-1.5">
                  <LinhaResumo label="Custo fixo mensal" value={baseCustos.fixoMes}/>
                  <LinhaResumo label="Custo variável por hora" value={baseCustos.variavelHora}/>
                  <LinhaResumo label="Combustível por hora" value={baseCustos.combustivelHora}/>
                  <LinhaResumo isText label="Meses no fechamento" value={String(qtdMeses)}/>
                </div>
                <p className="mt-3 border-t border-white/[0.06] pt-2 text-[10px] leading-relaxed text-slate-500">
                  O custo fixo mensal não depende de quanto se voa (hangaragem, tripulação, seguros).
                  O custo variável só ocorre quando a aeronave voa (combustível, taxas, manutenção por hora).
                </p>
              </div>

              {/* Médias por cotista */}
              <div className="overflow-x-auto rounded-2xl border border-teal-500/15">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.045] backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Th className="text-left">Cotista</Th>
                      <Th right>Horas</Th>
                      <Th right>Custo</Th>
                      <Th right>Custo/Hora</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoCotistas.map((c, i) => (
                      <tr key={c.id} className={i % 2 === 0 ? "bg-transparent" : "bg-teal-500/[0.03]"}>
                        <Td className="font-medium text-slate-300">{c.nome}</Td>
                        <Td mono right>{hhMM(c.horas)}</Td>
                        <Td mono right>{BRL(c.total)}</Td>
                        <Td className="text-teal-300" mono right>{BRL(c.custoHora)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 6 — RANKING DOS GASTOS
              ════════════════════════════════════════════════════════════════ */}
          <section id="sec-6" className="scroll-mt-24 animate-fade-in">
            <TituloSecao numero={6} titulo="Ranking dos Gastos"/>
            {ranking.length === 0 ? (
              <Vazio texto="Sem gastos registrados no período."/>
            ) : (
              <div className="rounded-2xl border border-teal-500/15 bg-white/[0.035] backdrop-blur-xl divide-y divide-white/[0.06]">
                {ranking.map((r, i) => (
                  <div key={r.nome} className="flex items-center gap-4 px-4 py-3">
                    <span className="w-8 shrink-0 text-[11px] font-bold text-slate-500">{i + 1}º</span>
                    <span className="flex-1 truncate text-xs font-medium uppercase text-slate-300">
                      {r.nome}
                    </span>
                    <span className="w-28 text-right font-mono text-xs text-slate-100">
                      {BRL(r.valor)}
                    </span>
                    <span className="w-14 shrink-0 rounded-full bg-teal-500/[0.1] px-2 py-0.5 text-center text-[10px] font-semibold text-teal-300">
                      {NUM(r.pct, 0)}%
                    </span>
                    <div className="hidden h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-white/[0.07] sm:block">
                      <div
                        className={`h-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                        style={{ width: `${Math.max(2, r.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 7 — ÍNDICE DE CUSTO E PROJEÇÃO
              ════════════════════════════════════════════════════════════════ */}
          <section id="sec-7" className="scroll-mt-24 animate-fade-in">
            <TituloSecao numero={7} titulo="Índice de Custo e Projeção de Gasto por Hora"/>
            {projecao.linhas.length === 0 ? (
              <Vazio texto="Dados insuficientes para gerar a projeção de custos."/>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {/* Explicação + taxa de projeção */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-2xl border border-teal-400/20 bg-teal-400/[0.06] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-teal-300/70 mb-1">
                      Taxa de projeção
                    </p>
                    <p className="font-mono text-2xl font-bold text-teal-200">
                      {BRL(projecao.taxaProjecao)}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                      É a taxa usada para gerar a projeção de gasto por hora, com base no cenário atual
                      da aeronave neste fechamento.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-teal-500/15 bg-white/[0.035] backdrop-blur-xl p-4 text-[11px] leading-relaxed text-slate-400 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500">Como ler a tabela</p>
                    <p>
                      <strong className="text-slate-300">Custo comb./variável:</strong> valor que se repete
                      a cada hora voada — {BRL(baseCustos.variavelHora)} por hora.
                    </p>
                    <p>
                      <strong className="text-slate-300">Custo hora:</strong> o custo fixo mensal
                      ({BRL(baseCustos.fixoMes)}) diluído nas horas voadas, somado ao custo variável.
                      Quanto mais se voa, menor fica.
                    </p>
                    <p>
                      <strong className="text-slate-300">Índice:</strong> quantas vezes o custo por hora
                      é maior que o custo variável puro. Índice próximo de 1,00 significa aeronave
                      bem utilizada.
                    </p>
                    {projecao.pontoOtimo && (
                      <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-emerald-300">
                        Ponto de equilíbrio: a partir de <strong>{projecao.pontoOtimo.horas}h/mês</strong> o
                        ganho de diluição fica abaixo de 2% por hora adicional —
                        custo/hora de {BRL(projecao.pontoOtimo.custoHora)}.
                      </p>
                    )}
                  </div>

                  {/* Curva do índice */}
                  <div className="rounded-2xl border border-teal-500/15 bg-white/[0.035] backdrop-blur-xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                      Curva do custo por hora
                    </p>
                    <div className="flex h-28 items-end gap-[2px]">
                      {projecao.linhas.map((l) => (
                        <div
                          key={l.horas}
                          title={`${l.horas}h · ${BRL(l.custoHora)}`}
                          style={{ height: `${Math.max(3, (l.custoHora / maxProjCusto) * 100)}%` }}
                          className={`flex-1 rounded-t-sm ${
                            projecao.pontoOtimo && l.horas === projecao.pontoOtimo.horas
                              ? "bg-emerald-400"
                              : "bg-teal-500/60"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-slate-600">
                      <span>1h</span><span>23h</span><span>45h</span>
                    </div>
                  </div>
                </div>

                {/* Tabela de projeção */}
                <div className="lg:col-span-3 max-h-[520px] overflow-auto rounded-2xl border border-teal-500/15">
                  <table className="w-full border-collapse text-[11px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-white/[0.045] backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <Th right>H. Voadas</Th>
                        <Th right>Custo Variável</Th>
                        <Th right>Fixo / Hora</Th>
                        <Th right>Custo Hora</Th>
                        <Th right>Custo Total</Th>
                        <Th right>Índice</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {projecao.linhas.map((l, i) => {
                        const destaque =
                          projecao.pontoOtimo && l.horas === projecao.pontoOtimo.horas;
                        return (
                          <tr
                            key={l.horas}
                            className={
                              destaque
                                ? "bg-emerald-500/10"
                                : i % 2 === 0
                                ? "bg-transparent"
                                : "bg-teal-500/[0.03]"
                            }
                          >
                            <Td className="font-semibold text-slate-300" mono right>{l.horas}</Td>
                            <Td dim mono right>{BRL(l.custoVariavel)}</Td>
                            <Td dim mono right>{BRL(l.custoFixoHora)}</Td>
                            <Td className="text-teal-300 font-medium" mono right>{BRL(l.custoHora)}</Td>
                            <Td mono right>{BRL(l.custoTotal)}</Td>
                            <Td className="text-amber-400" mono right>{NUM(l.indice, 2)}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 8 — DIÁRIO ESPELHO
              ════════════════════════════════════════════════════════════════ */}
          <section id="sec-8" className="scroll-mt-24 animate-fade-in">
            <TituloSecao numero={8} titulo="Diário Espelho"/>


            {!data?.voos || data.voos.length === 0 ? (
              <Vazio texto="Nenhum voo registrado neste período."/>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-teal-500/15">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.045] backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Th>Data</Th>
                      <Th>De</Th>
                      <Th>Para</Th>
                      <Th>Trecho</Th>
                      <Th right>Total</Th>
                      <Th right>Pousos</Th>
                      <Th right>Abast. L</Th>
                      <Th>Natureza</Th>
                      <Th>Sócio / Cliente</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.voos.map((v, i) => (
                      <tr
                        key={v.id}
                        className={
                          i % 2 === 0
                            ? "bg-transparent hover:bg-teal-500/[0.04]"
                            : "bg-teal-500/[0.02] hover:bg-teal-500/[0.03]"
                        }
                      >
                        <Td mono>{fmtDate(v.data_registro)}</Td>
                        <Td mono>{v.aerodromo_partida || "—"}</Td>
                        <Td mono>{v.aerodromo_chegada || "—"}</Td>
                        <Td max="160px">{v.trecho || "—"}</Td>
                        <Td mono right>
                          {v.tempo_voo ? hhMM(v.tempo_voo) : v.tempo_total ? hhMM(v.tempo_total) : "—"}
                        </Td>
                        <Td mono right>{v.pousos_total ?? "—"}</Td>
                        <Td mono right>
                          {v.combustivel_adicionado
                            ? `${NUM(v.combustivel_adicionado, 0)} L`
                            : "—"}
                        </Td>
                        <Td dim upper>{v.natureza_voo || "—"}</Td>
                        <Td>
                          <span className="rounded-full border border-teal-500/20 bg-teal-500/[0.06] px-2 py-0.5 text-[10px] text-slate-300">
                            {v.socios_nome || "—"}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-teal-500/[0.08] text-[10px] font-bold text-slate-300">
                      <td colSpan={4} className="py-2 px-3 text-right uppercase tracking-wider text-slate-500">
                        Total
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-teal-300">
                        {hhMM(totalHorasAeronave)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-200">
                        {totalPousos}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-amber-400">
                        {NUM(totalLitros, 0)} L
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Rodapé */}
          <footer className="border-t border-white/[0.06] pt-6 text-center text-[10px] text-slate-600 print:mt-4">
            Share Brasil · {aeronaveLabel} · {mesLabel} ·{" "}
            Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </footer>

        </div>
      )}

      {/* Barra de navegação inferior — glassmorphism */}
      {!isLoading && <BottomNav />}
    </div>

  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  "bg-teal-500/70",
  "bg-amber-500/70",
  "bg-emerald-500/70",
  "bg-violet-500/70",
  "bg-rose-500/70",
];

const SECOES = [
  "Lançamentos",
  "Análise",
  "Balanço",
  "Cotistas",
  "Médias",
  "Ranking",
  "Projeção",
  "Diário",
];

function BottomNav() {
  const [ativo, setAtivo] = useState(1);

  const irPara = (n: number) => {
    setAtivo(n);
    document.getElementById(`sec-${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden">
      <nav className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-teal-500/15 bg-white/[0.07] px-1.5 py-1.5 shadow-[0_8px_28px_-14px_rgba(0,0,0,0.6)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECOES.map((s, i) => {
          const n = i + 1;
          const on = ativo === n;
          return (
            <button
              key={s}
              onClick={() => irPara(n)}
              className={[
                "shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-300 active:scale-[0.96]",
                on
                  ? "bg-teal-500/[0.18] text-teal-100 shadow-sm"
                  : "text-slate-400 hover:bg-white/[0.07] hover:text-slate-200",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function TituloSecao({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 print:mb-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-teal-500/20 bg-teal-500/[0.08] text-[11px] font-semibold text-teal-300">
        {numero}
      </div>
      <h2 className="text-[13px] font-semibold tracking-tight text-slate-100 sm:text-[15px]">
        {titulo}
      </h2>
      <div className="h-px flex-1 bg-gradient-to-r from-teal-500/20 to-transparent" />
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-12 text-center text-sm text-slate-500">
      {texto}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const colors: Record<string, string> = {
    teal: "text-teal-200",
    indigo: "text-indigo-200",
    amber: "text-amber-200",
  };
  return (
    <div className="rounded-2xl border border-teal-500/15 bg-white/[0.04] p-4 backdrop-blur-xl transition-all duration-300 hover:bg-teal-500/[0.06]">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`font-mono text-lg font-semibold tracking-tight sm:text-xl ${colors[accent] ?? "text-slate-100"}`}>
        {value}
      </p>
    </div>
  );

}

function LinhaResumo({
  label, value, isText,
}: {
  label: string; value: number | string; isText?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-2 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${isText ? "text-slate-400" : "text-slate-200"}`}>
        {isText ? String(value) : BRL(value as number)}
      </span>
    </div>
  );
}

// ── Células de tabela ─────────────────────────────────────────────────────────

function Th({
  children,
  right,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <th
      className={[
        "py-2 px-3 border-b border-white/[0.07] whitespace-nowrap",
        right ? "text-right" : "text-left",
        className,
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  mono,
  upper,
  dim,
  max,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  mono?: boolean;
  upper?: boolean;
  dim?: boolean;
  max?: string;
  className?: string;
}) {
  return (
    <td
      style={max ? { maxWidth: max, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined}
      className={[
        "py-1.5 px-3",
        right ? "text-right" : "text-left",
        mono ? "font-mono" : "",
        upper ? "uppercase" : "",
        dim ? "text-slate-600" : "text-slate-300",
        className,
      ].join(" ")}
    >
      {children}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

/** Primeiro nome do cotista para cabeçalhos curtos */
function abrev(nome: string) {
  return nome.split(" ")[0];
}

/** Formata o label do tipo de rateio para evitar undefined/null e padronizar o visual */
function tipoRateioLabel(val: string | null) {
  if (!val) return "—";
  return val.toUpperCase();
}

/** Infere prazo a partir da categoria/tipo do rateio */
function inferirPrazo(cat: string | null, tipo: string | null): string {
  const t = ((tipo || "") + (cat || "")).toUpperCase();
  if (t.includes("LONGO")) return "LONGO PRAZO";
  if (t.includes("CURTO") || t.includes("VOO") || t.includes("COMBUSTIVEL") || t.includes("COMBUSTÍVEL"))
    return "CURTO PRAZO";

  return "MÉDIO PRAZO";
}