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

function useDadosRelatorio(aeronaveId: string, inicio: string, fim: string) {
  return useQuery({
    queryKey: ["relatorio-pdf-completo", aeronaveId, inicio, fim],
    enabled: !!aeronaveId,
    staleTime: 120_000,
    queryFn: async () => {
      const [ratRes, vooRes, aerRes] = await Promise.all([
        // 1. Todos os rateios do período
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

      return {
        rateios: (ratRes.data ?? []) as RateioRow[],
        voos: (vooRes.data ?? []) as VooRow[],
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
  /** Se quiser exibir dentro de um modal, passe onClose */
  onClose?: () => void;
}

export function RelatorioPDFCompleto({ aeronaveId, onClose }: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const inicio = format(new Date(ano, mes, 1), "yyyy-MM-dd");
  const fim = format(endOfMonth(new Date(ano, mes, 1)), "yyyy-MM-dd");
  const mesLabel = capitalize(
    format(new Date(ano, mes, 1), "MMMM 'de' yyyy", { locale: ptBR })
  );

  const { data, isLoading } = useDadosRelatorio(aeronaveId, inicio, fim);

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

  const navMes = (delta: number) => {
    const d = new Date(ano, mes + delta, 1);
    setMes(d.getMonth());
    setAno(d.getFullYear());
  };

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

          {/* navegação de mês */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-700/50 bg-slate-900/60 px-1 py-1">
            <button
              onClick={() => navMes(-1)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4"/>
            </button>
            <span className="min-w-[160px] text-center text-sm font-medium text-slate-200 capitalize">
              {mesLabel}
            </span>
            <button
              onClick={() => navMes(1)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              <ChevronRight className="h-4 w-4"/>
            </button>
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
            <TituloSecao numero="{1}" titulo="Centro de Lançamento de Custos"/>

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
                        <Th className="text-cyan-600/80" key="{`h-pct-${c.id}`}" right>
                          {abrev(c.nome)} %
                        </Th>
                      ))}
                      {cotistas.map((c) => (
                        <Th className="text-emerald-600/80 border-l border-slate-700/30" key="{`h-rat-${c.id}`}" right>
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
                          <Td "—"} dim="{doc" mono>{doc}</Td>
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
                              <Td 0} dim="{pct" key="{`pct-${c.id}`}" mono right>
                                {pct > 0 ? `${NUM(pct, 4)}%` : "0,0000%"}
                              </Td>
                            );
                          })}
                          {cotistas.map((c) => {
                            const r = rateioDeC(rateios, c.id);
                            const val = Number(r?.valor_rateado ?? 0);
                            return (
                              <Td 0} className="border-l border-slate-700/20" dim="{val" key="{`rat-${c.id}`}" mono right>
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
            <TituloSecao numero="{2}" titulo="Análise de Custo"/>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Tabela pivot */}
              <div className="lg:col-span-2 overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Th className="text-left">Categoria</Th>
                      {cotistas.map((c) => (
                        <Th key="{c.id}" right>{c.nome}</Th>
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
                            <Td dim="{!byC.get(c.id)}" key="{c.id}" mono right>
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
            <TituloSecao numero="{3}" titulo="Balanço de Custos — A Receber De"/>

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
            <TituloSecao numero="{4}" titulo="Resumo Geral por Cotista"/>

            {/* KPIs globais da aeronave */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard accent="cyan" label="Total Geral" value="{BRL(totalGeral)}"/>
              <KpiCard accent="sky" label="Horas Voadas" value="{hhMM(totalHorasAeronave)}"/>
              <KpiCard accent="indigo" label="Pousos" value="{String(totalPousos)}"/>
              <KpiCard 0)} L`} accent="amber" label="Abastecimento" value="{`${NUM(totalLitros,"/>
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
                      <LinhaResumo label="ADM e Pilotagem" value="{c.fixo}"/>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-800 pt-2">
                      <p className="text-[9px] uppercase tracking-widest text-slate-600 mb-1">
                        Custos Variáveis
                      </p>
                      <LinhaResumo label="Variáveis" value="{c.variavel}"/>
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
                          <LinhaResumo isText label="Horas voadas" value="{hhMM(c.horas)}"/>
                        )}
                        {c.pousos > 0 && (
                          <LinhaResumo isText label="Pousos" value="{String(c.pousos)}"/>
                        )}
                        {c.litros > 0 && (
                          <LinhaResumo 0)} L`} isText label="Abastecimento" value="{`${NUM(c.litros,"/>
                        )}
                        {c.custoHora > 0 && (
                          <LinhaResumo isText label="Custo/Hora" value="{BRL(c.custoHora)}"/>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              SEÇÃO 5 — DIÁRIO ESPELHO
              ════════════════════════════════════════════════════════════════ */}
          <section>
            <TituloSecao numero="{5}" titulo="Diário Espelho"/>

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
