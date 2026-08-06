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
      const [ratRes, vooRes, aerRes] = await Promise.all([
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
      ]);

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
      };
    },
  });
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
        const cat = (r.categoria_custo || "OUTROS").toUpperCase();
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
      const cat = (r.categoria_custo || "OUTROS").toUpperCase();
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
      .filter((r) => (r.categoria_custo || "").toUpperCase().includes("COMBUST"))
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
    <div className="min-h-screen bg-slate-950 text-slate-100 print:bg-white print:text-black">

      {/* ══════════════════════════════════════════════════════════════════════
          CABEÇALHO DO RELATÓRIO
          ══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur print:static print:border-none print:bg-white">
        <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center justify-between gap-4">

          {/* logo / identificação */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30">
              <Plane className="h-4 w-4 text-cyan-400"/>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 leading-none mb-0.5">
                Share Brasil
              </p>
              <p className="text-sm font-medium text-slate-200 leading-none">
                {aeronaveLabel}
              </p>
            </div>
          </div>

          {/* período fechado */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {mesesSelecionados.length > 1 ? "Meses fechados" : "Mês fechado"}
            </span>
            <span className="text-sm font-medium text-slate-200">{mesLabel}</span>
          </div>


          {/* ações */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
            >
              <Printer className="h-3.5 w-3.5"/>
              Exportar PDF
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-500" />
            <p className="text-sm">Carregando relatório...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="mx-auto max-w-[1400px] space-y-10 px-6 py-8 print:space-y-6 print:px-0 print:py-4">

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 1 — CENTRO DE LANÇAMENTO DE CUSTOS
              ════════════════════════════════════════════════════════════════ */}
          <section>
            <TituloSecao numero={1} titulo="Centro de Lançamento de Custos"/>

            {despesasAgrupadas.length === 0 ? (
              <Vazio texto="Nenhum lançamento encontrado para este período."/>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    {/* Linha de grupos */}
                    <tr className="bg-[#0f172a] text-[9px] uppercase tracking-[0.15em] text-slate-500">
                      <th colSpan={9} className="border-b border-r border-slate-700/50 py-2 px-3 text-left">
                        Qualificação de Custo · Pagamento
                      </th>
                      {cotistas.map((c) => (
                        <th key={`g-pct-${c.id}`} className="border-b border-slate-700/50 py-2 px-2 text-center">
                          %
                        </th>
                      ))}
                      {cotistas.map((c) => (
                        <th key={`g-rat-${c.id}`} className="border-b border-slate-700/50 py-2 px-2 text-center border-l border-slate-700/30">
                          {c.nome.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                    {/* Cabeçalhos */}
                    <tr className="bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Th>Data</Th>
                      <Th>Doc</Th>
                      <Th>Fornecedor</Th>
                      <Th>Descrição</Th>
                      <Th>Categoria</Th>
                      <Th>Tipo</Th>
                      <Th>Prazo</Th>
                      <Th>Pago Por</Th>
                      <Th className="border-r border-slate-700/50" right>Valor Pago</Th>
                      {cotistas.map((c) => (
                        <Th key={`h-pct-${c.id}`} className="text-cyan-600/80" right>
                          {abrev(c.nome)} %
                        </Th>
                      ))}
                      {cotistas.map((c) => (
                        <Th key={`h-rat-${c.id}`} className="text-emerald-600/80 border-l border-slate-700/30" right>
                          {abrev(c.nome)} R$
                        </Th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {despesasAgrupadas.map(({ ref, rateios }, i) => {
                      const dataRef = ref.data_pagamento || ref.data_vencimento;
                      const doc = ref.numero_nf || ref.numero_doc || "—";
                      const prazo = inferirPrazo(ref.categoria_custo, ref.tipo_rateio);

                      return (
                        <tr
                          key={ref.despesa_id || ref.id}
                          className={
                            i % 2 === 0
                              ? "bg-slate-950 hover:bg-slate-900/40"
                              : "bg-slate-900/20 hover:bg-slate-900/40"
                          }
                        >
                          <Td mono>{fmtDate(dataRef)}</Td>
                          <Td mono dim={doc === "—"}>{doc}</Td>
                          <Td>{ref.fornecedor_nome || "—"}</Td>
                          <Td max="180px">{ref.descricao_despesa || "—"}</Td>
                          <Td upper>{ref.categoria_custo || "—"}</Td>
                          <Td dim upper>{tipoRateioLabel(ref.tipo_rateio || ref.periodicidade)}</Td>
                          <Td dim upper>{prazo}</Td>
                          <Td upper>{ref.pago_por || "—"}</Td>
                          <Td className="border-r border-slate-700/30 font-medium text-slate-200" mono right>
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
                              <Td key={`rat-${c.id}`} className="border-l border-slate-700/20" dim={val === 0} mono right>
                                {val > 0 ? BRL(val) : "R$ —"}
                              </Td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                      <td colSpan={8} className="py-2 px-3 text-right text-slate-400">
                        Total
                      </td>
                      <td className="py-2 px-3 text-right font-mono border-r border-slate-700/50 text-slate-200">
                        {BRL(totalGeral)}
                      </td>
                      {cotistas.map((c) => (
                        <td key={`ft-pct-${c.id}`} className="py-2 px-3 text-right text-slate-500">—</td>
                      ))}
                      {cotistas.map((c) => (
                        <td key={`ft-rat-${c.id}`} className="py-2 px-3 text-right font-mono text-emerald-400 border-l border-slate-700/30">
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
          <section>
            <TituloSecao numero={2} titulo="Análise de Custo"/>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Tabela pivot */}
              <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                          className={i % 2 === 0 ? "bg-slate-950" : "bg-slate-900/30"}
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
                    <tr className="bg-slate-800/80 font-bold text-xs">
                      <td className="py-2 px-3 text-slate-300 uppercase tracking-wider">
                        Total Geral
                      </td>
                      {cotistas.map((c) => (
                        <td key={c.id} className="py-2 px-3 text-right font-mono text-cyan-400">
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
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 flex flex-col gap-3">
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
                      <div className="flex h-4 overflow-hidden rounded-full bg-slate-800/50">
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
          <section>
            <TituloSecao numero={3} titulo="Balanço de Custos — A Receber De"/>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Matriz */}
              <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      <th className="border border-slate-700/30 bg-slate-900/40 p-2" />
                      <th
                        colSpan={cotistas.length}
                        className="border border-slate-700/30 bg-yellow-900/20 py-2 px-3 text-center text-[10px] uppercase tracking-widest text-yellow-500/80 font-semibold"
                      >
                        A Receber De
                      </th>
                    </tr>
                    <tr className="bg-slate-900 text-[10px] text-slate-400 font-semibold uppercase">
                      <th className="border border-slate-700/30 py-2 px-3 text-left">
                        Pago Por ↓
                      </th>
                      {cotistas.map((c) => (
                        <th key={c.id} className="border border-slate-700/30 py-2 px-3 text-center">
                          {c.nome}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {saldos.map((row) => {
                      const credoresTotal = saldos.filter((s) => s.saldo > 0).reduce((t, s) => t + s.saldo, 0);
                      return (
                        <tr key={row.id} className="hover:bg-slate-900/40">
                          <td className="border border-slate-700/20 py-2 px-3 font-medium text-slate-300 bg-slate-900/20">
                            {row.nome}
                          </td>
                          {saldos.map((col) => {
                            if (row.id === col.id) {
                              return (
                                <td key={col.id} className="border border-slate-700/20 py-2 px-3 text-center text-slate-600">
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
                                className={`border border-slate-700/20 py-2 px-3 text-right font-mono ${
                                  val > 0.01
                                    ? "text-blue-400 font-semibold bg-blue-500/5"
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
                    className={`rounded-xl border p-4 ${
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
                    <div className="mt-2 border-t border-slate-700/30 pt-2 space-y-0.5 text-[10px] text-slate-500">
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
          <section>
            <TituloSecao numero={4} titulo="Resumo Geral por Cotista"/>

            {/* KPIs globais da aeronave */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard accent="cyan" label="Total Geral" value={BRL(totalGeral)}/>
              <KpiCard accent="sky" label="Horas Voadas" value={hhMM(totalHorasAeronave)}/>
              <KpiCard accent="indigo" label="Pousos" value={String(totalPousos)}/>
              <KpiCard accent="amber" label="Abastecimento" value={`${NUM(totalLitros, 0)} L`}/>
            </div>

            {/* Um card por cotista */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {resumoCotistas.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 px-4 py-3 border-b border-slate-700/50">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 mb-0.5">Cotista</p>
                    <p className="font-semibold text-slate-100">{c.nome}</p>
                  </div>

                  <div className="bg-slate-900/40 p-4 space-y-2 text-xs">
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">
                        Custos Fixos
                      </p>
                      <LinhaResumo label="ADM e Pilotagem" value={c.fixo}/>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-800 pt-2">
                      <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">
                        Custos Variáveis
                      </p>
                      <LinhaResumo label="Variáveis" value={c.variavel}/>
                    </div>

                    <div className="border-t border-slate-700/50 pt-2 flex justify-between items-center">
                      <span className="text-slate-400 font-medium">Total</span>
                      <span className="font-mono font-bold text-slate-100">{BRL(c.total)}</span>
                    </div>

                    {(c.horas > 0 || c.litros > 0) && (
                      <div className="border-t border-slate-800 pt-2 space-y-1.5">
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
          <section>
            <TituloSecao numero={5} titulo="Resumo das Médias"/>
            <p className="mb-4 -mt-2 text-[11px] text-slate-500">
              Médias calculadas sobre {qtdMeses} {qtdMeses > 1 ? "meses fechados" : "mês fechado"},
              {" "}{hhMM(totalHorasAeronave)} de voo, {totalPousos} pousos e {NUM(totalLitros, 0)} litros abastecidos.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <KpiCard accent="cyan" label="Custo médio / mês" value={BRL(medias.custoMes)}/>
              <KpiCard accent="sky" label="Custo médio / hora" value={BRL(medias.custoHora)}/>
              <KpiCard accent="indigo" label="Custo médio / pouso" value={BRL(medias.custoPouso)}/>
              <KpiCard accent="amber" label="Valor médio do litro" value={BRL(medias.valorLitro)}/>
              <KpiCard accent="cyan" label="Litros / hora" value={`${NUM(medias.litrosHora, 1)} L`}/>
              <KpiCard accent="sky" label="Horas / mês" value={hhMM(medias.horasMes)}/>
              <KpiCard accent="indigo" label="Voos / mês" value={NUM(medias.voosMes, 1)}/>
              <KpiCard accent="amber" label="Horas por voo" value={hhMM(medias.horasVoo)}/>
              <KpiCard accent="cyan" label="Pousos / mês" value={NUM(medias.pousosMes, 1)}/>
              <KpiCard accent="sky" label="Litros / mês" value={`${NUM(medias.litrosMes, 0)} L`}/>
            </div>

            {/* Composição fixo × variável */}
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                  Composição do Custo
                </p>
                <div className="flex h-4 overflow-hidden rounded-full bg-slate-800/50">
                  <div
                    className="h-full bg-cyan-500"
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

              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                  Bases de Cálculo
                </p>
                <div className="space-y-1.5">
                  <LinhaResumo label="Custo fixo mensal" value={baseCustos.fixoMes}/>
                  <LinhaResumo label="Custo variável por hora" value={baseCustos.variavelHora}/>
                  <LinhaResumo label="Combustível por hora" value={baseCustos.combustivelHora}/>
                  <LinhaResumo isText label="Meses no fechamento" value={String(qtdMeses)}/>
                </div>
                <p className="mt-3 border-t border-slate-800 pt-2 text-[10px] leading-relaxed text-slate-500">
                  O custo fixo mensal não depende de quanto se voa (hangaragem, tripulação, seguros).
                  O custo variável só ocorre quando a aeronave voa (combustível, taxas, manutenção por hora).
                </p>
              </div>

              {/* Médias por cotista */}
              <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Th className="text-left">Cotista</Th>
                      <Th right>Horas</Th>
                      <Th right>Custo</Th>
                      <Th right>Custo/Hora</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoCotistas.map((c, i) => (
                      <tr key={c.id} className={i % 2 === 0 ? "bg-slate-950" : "bg-slate-900/30"}>
                        <Td className="font-medium text-slate-300">{c.nome}</Td>
                        <Td mono right>{hhMM(c.horas)}</Td>
                        <Td mono right>{BRL(c.total)}</Td>
                        <Td className="text-cyan-400" mono right>{BRL(c.custoHora)}</Td>
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
          <section>
            <TituloSecao numero={6} titulo="Ranking dos Gastos"/>
            {ranking.length === 0 ? (
              <Vazio texto="Sem gastos registrados no período."/>
            ) : (
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 divide-y divide-slate-800/60">
                {ranking.map((r, i) => (
                  <div key={r.nome} className="flex items-center gap-4 px-4 py-3">
                    <span className="w-8 shrink-0 text-[11px] font-bold text-slate-500">{i + 1}º</span>
                    <span className="flex-1 truncate text-xs font-medium uppercase text-slate-300">
                      {r.nome}
                    </span>
                    <span className="w-28 text-right font-mono text-xs text-slate-100">
                      {BRL(r.valor)}
                    </span>
                    <span className="w-14 shrink-0 rounded-full bg-slate-800/70 px-2 py-0.5 text-center text-[10px] font-semibold text-cyan-400">
                      {NUM(r.pct, 0)}%
                    </span>
                    <div className="hidden h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-slate-800 sm:block">
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
          <section>
            <TituloSecao numero={7} titulo="Índice de Custo e Projeção de Gasto por Hora"/>
            {projecao.linhas.length === 0 ? (
              <Vazio texto="Dados insuficientes para gerar a projeção de custos."/>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {/* Explicação + taxa de projeção */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-cyan-500/80 mb-1">
                      Taxa de projeção
                    </p>
                    <p className="font-mono text-2xl font-bold text-cyan-300">
                      {BRL(projecao.taxaProjecao)}
                    </p>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                      É a taxa usada para gerar a projeção de gasto por hora, com base no cenário atual
                      da aeronave neste fechamento.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 text-[11px] leading-relaxed text-slate-400 space-y-2">
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
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
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
                              : "bg-cyan-500/60"
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
                <div className="lg:col-span-3 max-h-[520px] overflow-auto rounded-xl border border-slate-700/50">
                  <table className="w-full border-collapse text-[11px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                                ? "bg-slate-950"
                                : "bg-slate-900/30"
                            }
                          >
                            <Td className="font-semibold text-slate-300" mono right>{l.horas}</Td>
                            <Td dim mono right>{BRL(l.custoVariavel)}</Td>
                            <Td dim mono right>{BRL(l.custoFixoHora)}</Td>
                            <Td className="text-cyan-400 font-medium" mono right>{BRL(l.custoHora)}</Td>
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
          <section>
            <TituloSecao numero={8} titulo="Diário Espelho"/>


            {!data?.voos || data.voos.length === 0 ? (
              <Vazio texto="Nenhum voo registrado neste período."/>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                            ? "bg-slate-950 hover:bg-slate-900/30"
                            : "bg-slate-900/20 hover:bg-slate-900/30"
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
                          <span className="rounded-full border border-slate-700/50 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-300">
                            {v.socios_nome || "—"}
                          </span>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/60 text-[10px] font-bold text-slate-300">
                      <td colSpan={4} className="py-2 px-3 text-right uppercase tracking-wider text-slate-500">
                        Total
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-cyan-400">
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
          <footer className="border-t border-slate-800/50 pt-6 text-center text-[10px] text-slate-600 print:mt-4">
            Share Brasil · {aeronaveLabel} · {mesLabel} ·{" "}
            Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </footer>

        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

const BAR_COLORS = [
  "bg-cyan-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
];

function TituloSecao({ numero, titulo }: { numero: number; titulo: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 print:mb-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-bold text-cyan-400">
        {numero}
      </div>
      <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">
        {titulo}
      </h2>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700/50 py-10 text-center text-sm text-slate-600">
      {texto}
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  const colors: Record<string, string> = {
    cyan: "text-cyan-400",
    sky: "text-sky-400",
    indigo: "text-indigo-400",
    amber: "text-amber-400",
  };
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
      <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${colors[accent] ?? "text-slate-200"}`}>
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
        "py-2 px-3 border-b border-slate-700/30 whitespace-nowrap",
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
