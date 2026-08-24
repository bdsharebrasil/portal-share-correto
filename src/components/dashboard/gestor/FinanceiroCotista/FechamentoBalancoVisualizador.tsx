// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Printer,
  Plane,
  TrendingUp,
  TrendingDown,
  WalletCards,
  BarChart3,
  ClipboardList,
  BookOpen,
  LayoutDashboard,
  Scale,
  Timer,
  Calculator,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  Wallet,
  Clock,
  Fuel,
  PlaneTakeoff,
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

const BRLCompacto = (v: number) => {
  const n = Number(v ?? 0);
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
};

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

const mesKey = (s?: string | null) => (s ? String(s).substring(0, 7) : "");
const expenseGroupKey = (row: RateioRow): string => {
  const date = row.data_pagamento || row.data_vencimento || "";
  const total = Number(row.valor_total ?? row.valor_total_despesa ?? row.valor_rateado ?? 0);
  const parts = [
    date,
    String(row.fornecedor_nome ?? "").toLowerCase().trim(),
    String(row.descricao_despesa ?? "").toLowerCase().trim(),
    String(row.numero_nf ?? row.numero_doc ?? "").toLowerCase().trim(),
    String(row.categoria_custo ?? "").toLowerCase().trim(),
    String(row.pago_por ?? "").toLowerCase().trim(),
    total.toFixed(2),
  ];
  return parts.some(Boolean) ? `semantic|${parts.join("|")}` : `id:${row.despesa_id || row.id}`;
};

const labelMes = (key: string) => {
  if (!key) return "—";
  const [y, m] = key.split("-");
  return capitalize(format(new Date(Number(y), Number(m) - 1, 1), "MMM/yy", { locale: ptBR }));
};

const CORES_COTISTA = ["#38bdf8", "#fbbf24", "#34d399", "#a78bfa", "#f472b6", "#f87171"];
const CORES_CATEGORIA = ["#38bdf8", "#fbbf24", "#34d399", "#a78bfa", "#f472b6", "#f87171", "#22d3ee", "#facc15"];

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface CotistaInfo {
  id: string;
  nome: string;
  percentualSociedade: number;
  corHex: string;
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
  valor_total: number;
  valor_total_despesa?: number;
  valor_rateado: number;
  percentual_uso: number | null;
  percentual_sociedade: number | null;
  socio_id: string | null;
  socios_nome: string | null;
  cliente_id: string | null;
  clientes_nome: string | null;
  abastecimento_id?: string | null;
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
  clientes_id?: string | null;
  emprestimo?: boolean | null;
  cliente_tomador_emprestimo_id?: string | null;
  socio_tomador_emprestimo_id?: string | null;
}

interface AbastecimentoEmprestimoRow {
  id: string;
  data: string | null;
  trecho: string | null;
  litros: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  voo_emprestado: boolean | null;
  logbook_entry_id: string | null;
  id_clientes: string | null;
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
      const [ratRes, vooRes, aerRes, catRes, cotRes, abastEmpRes] = await Promise.all([
        (supabase as any)
          .from("rateio_despesas")
          .select([
            "id", "despesa_id", "data_pagamento", "data_vencimento",
            "numero_doc", "numero_nf", "fornecedor_nome", "descricao_despesa",
            "categoria_custo", "periodicidade", "tipo_rateio", "pago_por",
            "valor_total", "valor_rateado",
            "percentual_uso", "percentual_sociedade",
            "socio_id", "socios_nome", "cliente_id", "clientes_nome",
            "abastecimento_id",
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
            "natureza_voo, socios_id, socios_nome, clientes_id, " +
            "emprestimo, cliente_tomador_emprestimo_id, socio_tomador_emprestimo_id"
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

        (supabase as any)
          .from("cotistas_aeronave")
          .select("id, id_clientes, socios_id, percentual_sociedade")
          .eq("id_aeronave", aeronaveId),


        // Abastecimentos de voos emprestados (não entram na conta do cliente/cotista,
        // só ficam registrados como desgaste da aeronave)
        (supabase as any)
          .from("abastecimentos")
          .select("id, data, trecho, litros, valor_unitario, valor_total, voo_emprestado, logbook_entry_id, id_clientes")
          .eq("aeronave_id", aeronaveId)
          .eq("voo_emprestado", true)
          .gte("data", inicio)
          .lte("data", fim),
      ]);

      const catMap = new Map<string, string>();
      ((catRes as any)?.data ?? []).forEach((c: any) => {
        if (c?.id) catMap.set(String(c.id), String(c.expense_type || ""));
      });

      const cotistasAeronave = ((cotRes as any)?.data ?? []) as any[];

      const pctMap = new Map<string, number>();
      cotistasAeronave.forEach((c: any) => {
        const id = c.socios_id || c.id_clientes;
        if (id) pctMap.set(String(id), Number(c.percentual_sociedade ?? 0));
      });

      // ── Regra 1: sociedade é definida por clientes.tem_socio ────────────────
      const idsClientesCota = Array.from(
        new Set(cotistasAeronave.map((c: any) => c.id_clientes).filter(Boolean).map(String))
      );

      let temSocio = false;
      const clientesCota: { id: string; nome: string; tem_socio: boolean }[] = [];
      if (idsClientesCota.length > 0) {
        const { data: cliData } = await (supabase as any)
          .from("clientes")
          .select("id, razao_social, tem_socio")
          .in("id", idsClientesCota);
        (cliData ?? []).forEach((c: any) => {
          clientesCota.push({ id: String(c.id), nome: c.razao_social ?? "—", tem_socio: !!c.tem_socio });
          if (c.tem_socio) temSocio = true;
        });
      }

      // Sócios dos clientes cotistas (entram no balanço mesmo sem despesa no período)
      const sociosCliente: { id: string; nome: string; clienteId: string; percentual: number }[] = [];
      if (idsClientesCota.length > 0) {
        const { data: socData } = await (supabase as any)
          .from("socios")
          .select("id, nome, clientes_id, percentual_participacao")
          .in("clientes_id", idsClientesCota);
        (socData ?? []).forEach((s: any) => {
          sociosCliente.push({
            id: String(s.id),
            nome: s.nome ?? "—",
            clienteId: String(s.clientes_id),
            percentual: Number(s.percentual_participacao ?? 0),
          });
          if (!pctMap.has(String(s.id))) pctMap.set(String(s.id), Number(s.percentual_participacao ?? 0));
        });
      }

      // ── Depósitos/aportes dos sócios na conta comum (entradas do caixa cliente) ──
      const depositos: { id: string; socioId: string | null; clienteId: string | null; data: string | null; descricao: string | null; valor: number }[] = [];
      {
        const { data: movData } = await (supabase as any)
          .from("movimentacoes")
          .select("id, fluxo, tipo_caixa, socio_id, clientes_id, descricao, valor_total, valor_pago_real, valor_rateado, data_emissao, data_pagamento, data_vencimento, reference_type")
          .in("clientes_id", idsClientesCota)
          .not("socio_id", "is", null)
          .in("fluxo", ["entrada", "receita", "ENTRADA", "RECEITA"]);
        (movData ?? []).forEach((m: any) => {
          const dataRef = m.data_pagamento || m.data_emissao || m.data_vencimento;
          if (!dataRef) return;
          const iso = String(dataRef).substring(0, 10);
          if (iso < inicio || iso > fim) return;
          const valor = Number(m.valor_pago_real ?? m.valor_rateado ?? m.valor_total ?? 0);
          if (!valor) return;
          depositos.push({
            id: String(m.id),
            socioId: m.socio_id ? String(m.socio_id) : null,
            clienteId: m.clientes_id ? String(m.clientes_id) : null,
            data: iso,
            descricao: m.descricao ?? null,
            valor,
          });
        });
      }


      const mesDe = (s?: string | null) =>
        s ? new Date(String(s).substring(0, 10) + "T12:00:00").getMonth() + 1 : null;
      const dentro = (s?: string | null) => {
        const m = mesDe(s);
        return m != null && mesesSet.has(m);
      };

      const voos = ((vooRes.data ?? []) as VooRow[]).filter((v) => dentro(v.data_registro));
      const abastecimentosEmprestados = (((abastEmpRes as any)?.data ?? []) as AbastecimentoEmprestimoRow[]).filter(
        (a) => dentro(a.data)
      );

      // Resolve nomes de clientes envolvidos em empréstimo: o cotista "dono" (registrado
      // como cliente em voos.clientes_id) e o cliente/tomador que efetivamente usou o voo.
      const idsClientesEmprestimo = new Set<string>();
      voos.forEach((v) => {
        if (v.emprestimo) {
          if (v.clientes_id) idsClientesEmprestimo.add(v.clientes_id);
          if (v.cliente_tomador_emprestimo_id) idsClientesEmprestimo.add(v.cliente_tomador_emprestimo_id);
        }
      });
      const nomesClientesEmprestimo = new Map<string, string>();
      if (idsClientesEmprestimo.size > 0) {
        const { data: clientesData } = await (supabase as any)
          .from("clientes")
          .select("id, razao_social")
          .in("id", Array.from(idsClientesEmprestimo));
        (clientesData ?? []).forEach((c: any) => nomesClientesEmprestimo.set(c.id, c.razao_social));
      }

      const idsSociosEmprestimo = new Set<string>();
      voos.forEach((v) => {
        if (v.emprestimo && v.socio_tomador_emprestimo_id) idsSociosEmprestimo.add(v.socio_tomador_emprestimo_id);
      });
      const nomesSociosEmprestimo = new Map<string, string>();
      if (idsSociosEmprestimo.size > 0) {
        const { data: sociosData } = await (supabase as any)
          .from("socios")
          .select("id, nome")
          .in("id", Array.from(idsSociosEmprestimo));
        (sociosData ?? []).forEach((s: any) => nomesSociosEmprestimo.set(s.id, s.nome));
      }

      return {
        rateios: ((ratRes.data ?? []) as RateioRow[]).filter((r) =>
          dentro(r.data_pagamento || r.data_vencimento)
        ),
        voos,
        aeronave: aerRes.data,
        catMap,
        pctMap,
        temSocio,
        clientesCota,
        sociosCliente,
        depositos: depositos.filter((d) => dentro(d.data)),
        abastecimentosEmprestados,
        nomesClientesEmprestimo,
        nomesSociosEmprestimo,
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

const ehFixo = (r: RateioRow) =>
  (r.tipo_rateio || r.periodicidade || "").toUpperCase().includes("FIXO");

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  aeronaveId: string;
  ano?: number;
  meses?: number[];
  onClose?: () => void;
}

type TabKey = "visao" | "acerto" | "lancamentos" | "graficos" | "diario" | "emprestimos" | "metodologia";

export function FechamentoBalancoVisualizador({ aeronaveId, ano: anoProp, meses, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("visao");
  const [cotistaFiltro, setCotistaFiltro] = useState<string>("todos");

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

  // IDs de abastecimentos ligados a voos emprestados — o combustível deles é excluído
  // das contas do cliente/cotista e só entra na aba "Voos Emprestados".
  const abastecimentosEmprestadosIds = useMemo(
    () => new Set(((data as any)?.abastecimentosEmprestados ?? []).map((a: any) => a.id)),
    [data]
  );

  // Rateios que de fato entram nas contas (visão geral, acerto, lançamentos).
  const rateiosValidos = useMemo(() => {
    const rows = data?.rateios ?? [];
    if (abastecimentosEmprestadosIds.size === 0) return rows;
    return rows.filter((r) => !(r.abastecimento_id && abastecimentosEmprestadosIds.has(r.abastecimento_id)));
  }, [data, abastecimentosEmprestadosIds]);

  // ── Sociedade (Regra 1: clientes.tem_socio) ────────────────────────────────
  const isSociedade = Boolean((data as any)?.temSocio);

  // ── Cotistas ───────────────────────────────────────────────────────────────
  const cotistas = useMemo<CotistaInfo[]>(() => {
    if (!data) return [];
    const map = new Map<string, string>();

    // Regra: todos os sócios/cotistas cadastrados aparecem no balanço,
    // mesmo sem lançamentos no período.
    if (isSociedade) {
      ((data as any).sociosCliente ?? []).forEach((s: any) => {
        if (s.id && !map.has(s.id)) map.set(s.id, s.nome);
      });
    } else {
      ((data as any).clientesCota ?? []).forEach((c: any) => {
        if (c.id && !map.has(c.id)) map.set(c.id, c.nome);
      });
    }

    rateiosValidos.forEach((r) => {
      const id = r.socio_id || r.cliente_id;
      const nome = r.socios_nome || r.clientes_nome;
      if (id && nome && !map.has(id)) map.set(id, nome);
    });
    data.voos.forEach((v) => {
      const id = v.socios_id || v.clientes_id;
      if (id && v.socios_nome && !map.has(id)) map.set(id, v.socios_nome);
    });
    return Array.from(map.entries()).map(([id, nome], i) => {
      const pctBanco = data.pctMap?.get(id);
      const pctSocio = (data as any).sociosCliente?.find((s: any) => s.id === id)?.percentual;
      const pctRateio = rateiosValidos.find(
        (r) => (r.socio_id === id || r.cliente_id === id) && Number(r.percentual_sociedade ?? 0) > 0
      )?.percentual_sociedade;
      return {
        id,
        nome,
        percentualSociedade: Number(pctBanco || pctSocio || pctRateio || 0),
        corHex: CORES_COTISTA[i % CORES_COTISTA.length],
      };
    });
  }, [data, rateiosValidos, isSociedade]);


  const cotistaPorId = React.useCallback(
    (id: string) =>
      cotistas.find((c) => c.id === id) ?? { id, nome: "—", percentualSociedade: 0, corHex: "#64748b" },
    [cotistas]
  );

  const despesasAgrupadas = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { ref: RateioRow; rateios: RateioRow[] }>();
    rateiosValidos.forEach((r) => {
      const key = expenseGroupKey(r);
      if (!map.has(key)) map.set(key, { ref: r, rateios: [] });
      map.get(key)!.rateios.push(r);
    });
    return Array.from(map.values()).sort((a, b) => {
      const da = a.ref.data_pagamento || a.ref.data_vencimento || "";
      const db = b.ref.data_pagamento || b.ref.data_vencimento || "";
      return da.localeCompare(db);
    });
  }, [data, rateiosValidos]);

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

  const totalGeral = despesasAgrupadas.reduce((s, d) => {
    const total = d.rateios.map((r) => Number(r.valor_total ?? r.valor_total_despesa ?? 0)).find((value) => value > 0) ?? d.rateios.reduce((sum, r) => sum + Number(r.valor_rateado ?? 0), 0);
    return s + total;
  }, 0);
  const totalHorasAeronave = (data?.voos ?? []).reduce((s, v) => s + Number(v.tempo_voo ?? v.tempo_total ?? 0), 0);
  const totalPousos = (data?.voos ?? []).reduce((s, v) => s + Number(v.pousos_total ?? 0), 0);
  const totalLitros = (data?.voos ?? []).reduce((s, v) => s + Number(v.combustivel_adicionado ?? 0), 0);
  const qtdMeses = Math.max(1, mesesSelecionados.length);

  const resumoCotistas = useMemo(() => {
    if (!data) return [];
    const totalCusto = pivot.grand;
    return cotistas
      .map((c) => {
        const rows = rateiosValidos.filter((r) => r.socio_id === c.id || r.cliente_id === c.id);
        const fixo = rows.filter(ehFixo).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
        const variavel = rows.filter((r) => !ehFixo(r)).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
        const voosCot = data.voos.filter((v) => v.socios_id === c.id || v.clientes_id === c.id);
        const horas = voosCot.reduce((s, v) => s + Number(v.tempo_voo ?? v.tempo_total ?? 0), 0);
        const pousos = voosCot.reduce((s, v) => s + Number(v.pousos_total ?? 0), 0);
        const litros = voosCot.reduce((s, v) => s + Number(v.combustivel_adicionado ?? 0), 0);
        const total = fixo + variavel;
        return {
          ...c,
          cotistaId: c.id,
          fixo,
          variavel,
          total,
          horas,
          pousos,
          litros,
          custoHora: horas > 0 ? total / horas : 0,
          participacaoHoras: totalHorasAeronave > 0 ? (horas / totalHorasAeronave) * 100 : 0,
          participacaoCusto: totalCusto > 0 ? (total / totalCusto) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [data, cotistas, rateiosValidos, pivot.grand, totalHorasAeronave]);

  const saldos = useMemo(() => {
    const pagouDireto = new Map<string, number>();
    const depositado = new Map<string, number>();
    const deve = new Map<string, number>();

    (data?.depositos ?? []).forEach((deposito) => {
      if (!deposito.socioId) return;
      depositado.set(deposito.socioId, (depositado.get(deposito.socioId) ?? 0) + deposito.valor);
    });

    despesasAgrupadas.forEach(({ ref, rateios }) => {
      const pagadorNome = (ref.pago_por || "").toLowerCase();
      const pagador = cotistas.find(
        (c) =>
          pagadorNome &&
          (c.nome.toLowerCase().includes(pagadorNome) ||
            pagadorNome.includes(c.nome.toLowerCase().split(" ")[0]))
      );
      if (pagador) {
        const totalDespesa = rateios.map((r) => Number(r.valor_total ?? r.valor_total_despesa ?? 0)).find((value) => value > 0) ?? rateios.reduce((sum, r) => sum + Number(r.valor_rateado ?? 0), 0);
        pagouDireto.set(pagador.id, (pagouDireto.get(pagador.id) ?? 0) + totalDespesa);
      }
      rateios.forEach((r) => {
        const cid = r.socio_id || r.cliente_id;
        if (!cid) return;
        deve.set(cid, (deve.get(cid) ?? 0) + Number(r.valor_rateado ?? 0));
      });
    });

    return cotistas.map((c) => ({
      ...c,
      cotistaId: c.id,
      depositado: depositado.get(c.id) ?? 0,
      pagouDireto: pagouDireto.get(c.id) ?? 0,
      pagou: pagouDireto.get(c.id) ?? 0,
      deve: deve.get(c.id) ?? 0,
      saldo: isSociedade
        ? (depositado.get(c.id) ?? 0) + (pagouDireto.get(c.id) ?? 0) - (deve.get(c.id) ?? 0)
        : (pagouDireto.get(c.id) ?? 0) - (deve.get(c.id) ?? 0),
    }));
  }, [data?.depositos, despesasAgrupadas, cotistas, isSociedade]);

  /** Algoritmo de menor número de transferências */
  const transferencias = useMemo(() => {
    if (isSociedade) return [];

    const devedores = saldos
      .filter((s) => s.saldo < -0.01)
      .map((s) => ({ id: s.cotistaId, v: -s.saldo }))
      .sort((a, b) => b.v - a.v);
    const credores = saldos
      .filter((s) => s.saldo > 0.01)
      .map((s) => ({ id: s.cotistaId, v: s.saldo }))
      .sort((a, b) => b.v - a.v);

    const out: { de: string; para: string; valor: number }[] = [];
    let i = 0;
    let j = 0;
    while (i < devedores.length && j < credores.length) {
      const valor = Math.min(devedores[i].v, credores[j].v);
      if (valor > 0.01) out.push({ de: devedores[i].id, para: credores[j].id, valor });
      devedores[i].v -= valor;
      credores[j].v -= valor;
      if (devedores[i].v <= 0.01) i++;
      if (credores[j].v <= 0.01) j++;
    }
    return out;
  }, [saldos, isSociedade]);

  const baseCustos = useMemo(() => {
    const rows = rateiosValidos;
    const fixo = rows.filter(ehFixo).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
    const variavel = rows.filter((r) => !ehFixo(r)).reduce((s, r) => s + Number(r.valor_rateado ?? 0), 0);
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
  }, [rateiosValidos, qtdMeses, totalHorasAeronave, catNome]);

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
      fixoMes: baseCustos.fixoMes,
      variavelHora: baseCustos.variavelHora,
      combustivelHora: baseCustos.combustivelHora,
      // taxa de desgaste (peças/manutenção) por hora, sem o combustível
      manutencaoHora: Math.max(0, baseCustos.variavelHora - baseCustos.combustivelHora),
    };
  }, [baseCustos, data, qtdMeses, totalHorasAeronave, totalPousos, totalLitros]);

  /** Série mensal fixo x variável x horas */
  const serie = useMemo(() => {
    const map = new Map<string, { mes: string; fixo: number; variavel: number; horas: number }>();
    const get = (k: string) => {
      if (!map.has(k)) map.set(k, { mes: k, fixo: 0, variavel: 0, horas: 0 });
      return map.get(k)!;
    };
    rateiosValidos.forEach((r) => {
      const k = mesKey(r.data_pagamento || r.data_vencimento);
      if (!k) return;
      const row = get(k);
      const v = Number(r.valor_rateado ?? 0);
      if (ehFixo(r)) row.fixo += v;
      else row.variavel += v;
    });
    (data?.voos ?? []).forEach((v) => {
      const k = mesKey(v.data_registro);
      if (!k) return;
      get(k).horas += Number(v.tempo_voo ?? v.tempo_total ?? 0);
    });
    return Array.from(map.values())
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((m) => {
        const total = m.fixo + m.variavel;
        return { ...m, label: labelMes(m.mes), total, custoHora: m.horas > 0 ? total / m.horas : 0 };
      });
  }, [data, rateiosValidos]);

  /** Categorias com tipo e distribuição por cotista */
  const categorias = useMemo(() => {
    const map = new Map<string, { total: number; fixo: number; porCotista: Map<string, number> }>();
    rateiosValidos.forEach((r) => {
      const cat = catNome(r.categoria_custo);
      const v = Number(r.valor_rateado ?? 0);
      if (!map.has(cat)) map.set(cat, { total: 0, fixo: 0, porCotista: new Map() });
      const row = map.get(cat)!;
      row.total += v;
      if (ehFixo(r)) row.fixo += v;
      const cid = r.socio_id || r.cliente_id;
      if (cid) row.porCotista.set(cid, (row.porCotista.get(cid) ?? 0) + v);
    });
    const total = Array.from(map.values()).reduce((s, r) => s + r.total, 0);
    return Array.from(map.entries())
      .map(([categoria, r]) => ({
        categoria,
        total: r.total,
        tipo: r.fixo >= r.total / 2 ? "FIXO" : "VARIAVEL",
        pct: total > 0 ? (r.total / total) * 100 : 0,
        porCotista: r.porCotista,
      }))
      .sort((a, b) => b.total - a.total);
  }, [rateiosValidos, catNome]);

  const projecao = useMemo(() => {
    const fixoMes = baseCustos.fixoMes;
    const varHora = baseCustos.variavelHora;
    const linhas: any[] = [];
    if (fixoMes <= 0 && varHora <= 0) return { linhas, taxaProjecao: 0, pontoOtimo: null as any };
    for (let hrs = 1; hrs <= 45; hrs++) {
      const custoFixoHora = fixoMes / hrs;
      const custoHora = custoFixoHora + varHora;
      linhas.push({
        horas: hrs,
        custoVariavel: varHora,
        custoVariavelHora: varHora,
        custoFixoHora,
        custoHora,
        custoTotal: fixoMes + varHora * hrs,
        indice: varHora > 0 ? custoHora / varHora : 0,
      });
    }
    const pontoOtimo =
      linhas.find((l, i) => {
        const prev = linhas[i - 1];
        return prev && (prev.custoHora - l.custoHora) / prev.custoHora < 0.02;
      }) ?? null;
    const taxaProjecao = medias.custoHora || (linhas[0]?.custoHora ?? 0);
    return { linhas, taxaProjecao, pontoOtimo };
  }, [baseCustos, medias]);

  const ranking = categorias.map((c) => ({ nome: c.categoria, valor: c.total, pct: c.pct }));

  const aeronaveLabel = data?.aeronave
    ? `${data.aeronave.matricula}${data.aeronave.modelo ? ` — ${data.aeronave.modelo}` : ""}`
    : aeronaveId;

  const rateioDeC = (rateios: RateioRow[], cid: string) =>
    rateios.find((r) => r.socio_id === cid || r.cliente_id === cid);

  const voosFiltrados = useMemo(() => {
    const list = (data?.voos ?? []).filter(
      (v) => cotistaFiltro === "todos" || v.socios_id === cotistaFiltro || v.clientes_id === cotistaFiltro
    );
    return list.slice().sort((a, b) => String(a.data_registro).localeCompare(String(b.data_registro)));
  }, [data, cotistaFiltro]);

  const horasFiltro = voosFiltrados.reduce((s, v) => s + Number(v.tempo_voo ?? v.tempo_total ?? 0), 0);
  const pousosFiltro = voosFiltrados.reduce((s, v) => s + Number(v.pousos_total ?? 0), 0);
  const litrosFiltro = voosFiltrados.reduce((s, v) => s + Number(v.combustivel_adicionado ?? 0), 0);

  const dadosComposicao = [
    { name: "Custos fixos", value: baseCustos.fixo, cor: "#38bdf8" },
    { name: "Custos variáveis", value: baseCustos.variavel, cor: "#fbbf24" },
  ];

  const maiorCategoria = categorias[0];
  const maiorUsuario = [...resumoCotistas].sort((a, b) => b.horas - a.horas)[0];

  const dadosRadar = cotistas.map((c) => {
    const r = resumoCotistas.find((x) => x.cotistaId === c.id);
    return {
      cotista: c.nome.split(" ")[0],
      Cota: Number(c.percentualSociedade ?? 0),
      Horas: Number(r?.participacaoHoras ?? 0),
      Custo: Number(r?.participacaoCusto ?? 0),
    };
  });

  const dadosCategoriaPie = categorias.map((c, i) => ({
    name: c.categoria,
    value: c.total,
    cor: CORES_CATEGORIA[i % CORES_CATEGORIA.length],
  }));

  // ── Voos emprestados (não entram na conta do cliente, só registro de desgaste) ──
  const voosEmprestados = useMemo(() => {
    if (!data) return [];
    const abastPorLogbook = new Map<string, AbastecimentoEmprestimoRow>();
    ((data as any).abastecimentosEmprestados ?? []).forEach((a: AbastecimentoEmprestimoRow) => {
      if (a.logbook_entry_id) abastPorLogbook.set(a.logbook_entry_id, a);
    });
    return (data.voos as VooRow[])
      .filter((v) => !!v.emprestimo)
      .map((v) => {
        const abast = abastPorLogbook.get(v.id);
        const cotistaDonoId = v.clientes_id || null;
        const cotistaDonoNome =
          (cotistaDonoId && (data as any).nomesClientesEmprestimo?.get(cotistaDonoId)) ||
          cotistas.find((c) => c.id === cotistaDonoId)?.nome ||
          "—";
        const tomadorClienteNome =
          (v.cliente_tomador_emprestimo_id &&
            (data as any).nomesClientesEmprestimo?.get(v.cliente_tomador_emprestimo_id)) ||
          null;
        const tomadorSocioNome =
          (v.socio_tomador_emprestimo_id && (data as any).nomesSociosEmprestimo?.get(v.socio_tomador_emprestimo_id)) ||
          null;
        const horas = Number(v.tempo_voo ?? v.tempo_total ?? 0);
        const combustivelValor = abast ? Number(abast.valor_total ?? 0) : 0;
        return {
          id: v.id,
          data: v.data_registro,
          trecho: v.trecho || `${v.aerodromo_partida ?? "—"} → ${v.aerodromo_chegada ?? "—"}`,
          cotistaDonoNome,
          tomadorNome: tomadorClienteNome || tomadorSocioNome || "—",
          horas,
          combustivelValor,
          custoDesgaste: horas * medias.manutencaoHora,
        };
      })
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }, [data, cotistas, medias]);

  const resumoEmprestimos = useMemo(() => {
    const map = new Map<string, { nome: string; horas: number; combustivel: number; desgaste: number; voos: number }>();
    voosEmprestados.forEach((v) => {
      const key = v.cotistaDonoNome;
      if (!map.has(key)) map.set(key, { nome: key, horas: 0, combustivel: 0, desgaste: 0, voos: 0 });
      const row = map.get(key)!;
      row.horas += v.horas;
      row.combustivel += v.combustivelValor;
      row.desgaste += v.custoDesgaste;
      row.voos += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.desgaste - a.desgaste);
  }, [voosEmprestados]);

  const totaisEmprestimos = useMemo(
    () => ({
      horas: voosEmprestados.reduce((s, v) => s + v.horas, 0),
      combustivel: voosEmprestados.reduce((s, v) => s + v.combustivelValor, 0),
      desgaste: voosEmprestados.reduce((s, v) => s + v.custoDesgaste, 0),
    }),
    [voosEmprestados]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-card text-foreground antialiased print:bg-white print:text-black">

      {/* HEADER FIXO */}
      <div className="sticky top-0 z-30 border-b border-border bg-card-secondary/90 backdrop-blur-xl shadow-sm print:static print:border-none print:shadow-none print:bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">

          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Plane className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Fechamento Financeiro
              </p>
              <p className="truncate text-base font-bold text-foreground">{aeronaveLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card-secondary/50 px-3.5 py-1.5">
              <span className="hidden text-[10px] uppercase font-bold tracking-widest text-muted-foreground sm:inline">
                {mesesSelecionados.length > 1 ? "Período" : "Competência"}
              </span>
              <span className="text-sm font-semibold text-primary">{mesLabel}</span>
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 active:scale-[0.97] print:hidden"
            >
              <Printer className="h-4 w-4" />
              Imprimir PDF
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg border border-border bg-card/80 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-card-secondary/50 active:scale-[0.97] print:hidden"
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
              <TabButton active={activeTab === "visao"} onClick={() => setActiveTab("visao")} icon={LayoutDashboard} label="Visão Geral" />
              <TabButton active={activeTab === "acerto"} onClick={() => setActiveTab("acerto")} icon={WalletCards} label="Acerto de Contas" />
              <TabButton active={activeTab === "lancamentos"} onClick={() => setActiveTab("lancamentos")} icon={ClipboardList} label="Lançamentos" />
              <TabButton active={activeTab === "graficos"} onClick={() => setActiveTab("graficos")} icon={BarChart3} label="Gráficos e Análises" />
              <TabButton active={activeTab === "diario"} onClick={() => setActiveTab("diario")} icon={BookOpen} label="Diário de Bordo" />
              {voosEmprestados.length > 0 && (
                <TabButton
                  active={activeTab === "emprestimos"}
                  onClick={() => setActiveTab("emprestimos")}
                  icon={ArrowLeftRight}
                  label="Voos Emprestados"
                />
              )}
              <TabButton active={activeTab === "metodologia"} onClick={() => setActiveTab("metodologia")} icon={Scale} label="Explicando o Balanço" />
            </nav>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border/60 border-t-blue-600" />
            <p className="text-sm font-medium">Carregando relatório...</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="mx-auto max-w-[1400px] p-4 sm:p-6 print:p-0">

          {/* ══════════════ ABA 1 — VISÃO GERAL ══════════════ */}
          <div className={`space-y-6 animate-fade-in print:block ${activeTab === "visao" ? "block" : "hidden"}`}>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard
                label="Custo total do período"
                valor={BRL(baseCustos.total)}
                detalhe={`${despesasAgrupadas.length} lançamentos em ${qtdMeses} ${qtdMeses > 1 ? "meses" : "mês"}`}
                icone={<Wallet className="h-4 w-4" />}
                destaque
              />
              <KpiCard
                label="Horas voadas"
                valor={hhMM(totalHorasAeronave)}
                detalhe={`${(data?.voos ?? []).length} etapas • ${totalPousos} pousos`}
                icone={<Clock className="h-4 w-4" />}
              />
              <KpiCard
                label="Custo por hora"
                valor={BRL(medias.custoHora)}
                detalhe={`Fixo ${BRL(medias.fixoMes)}/mês diluído`}
                icone={<PlaneTakeoff className="h-4 w-4" />}
              />
              <KpiCard
                label="Combustível"
                valor={`${NUM(totalLitros, 0)} L`}
                detalhe={`${BRL(medias.valorLitro)}/L • ${NUM(medias.litrosHora, 1)} L/h`}
                icone={<Fuel className="h-4 w-4" />}
              />
            </div>

            {voosEmprestados.length > 0 && (
              <Nota titulo="Voos emprestados no período" tom="atencao">
                <p>
                  {voosEmprestados.length} voo(s) marcado(s) como empréstimo neste período ({hhMM(totaisEmprestimos.horas)}
                  ). O combustível deles ({BRL(totaisEmprestimos.combustivel)}) não entra nas contas acima — veja a aba{" "}
                  <strong>Voos Emprestados</strong> para o detalhamento e o desgaste atribuído ao cotista dono.
                </p>
              </Nota>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Painel
                className="xl:col-span-2"
                titulo="Evolução mensal do custo"
                descricao="Separação entre o que a aeronave custa parada (fixo) e o que custa por voar (variável)."
              >
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                      <defs>
                        <linearGradient id="gradFixo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradVar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1C2A3F" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => BRLCompacto(Number(v))} />
                      <Tooltip content={<TooltipGrafico />} cursor={{ stroke: "#2A3B54" }} />
                      <Area type="monotone" dataKey="fixo" name="Fixos" stackId="1" stroke="#38bdf8" strokeWidth={2} fill="url(#gradFixo)" />
                      <Area type="monotone" dataKey="variavel" name="Variáveis" stackId="1" stroke="#fbbf24" strokeWidth={2} fill="url(#gradVar)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {serie.map((m) => (
                    <div key={m.mes} className="rounded-xl border border-border/60 bg-card/60 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.label}</p>
                      <p className="mt-1 font-mono text-sm font-bold text-foreground">{BRL(m.total)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {hhMM(m.horas)} • {BRL(m.custoHora)}/h
                      </p>
                    </div>
                  ))}
                </div>
              </Painel>

              <Painel titulo="Composição do custo" descricao="Fixo x variável em todo o período.">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosComposicao} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={3} stroke="none">
                        {dadosComposicao.map((d) => (
                          <Cell key={d.name} fill={d.cor} />
                        ))}
                      </Pie>
                      <Tooltip content={<TooltipGrafico />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-2 space-y-2">
                  {dadosComposicao.map((d) => (
                    <li key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.cor }} aria-hidden="true" />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-mono font-semibold text-foreground">{BRL(d.value)}</span>
                      <span className="w-12 text-right font-mono text-muted-foreground">
                        {NUM(baseCustos.total > 0 ? (d.value / baseCustos.total) * 100 : 0, 0)}%
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Nota titulo="Leitura rápida">
                    <p>
                      {NUM(baseCustos.total > 0 ? (baseCustos.fixo / baseCustos.total) * 100 : 0, 0)}% do custo acontece
                      mesmo com a aeronave parada — por isso ele é dividido pela cota societária, e não por quem voou.
                    </p>
                  </Nota>
                </div>
              </Painel>
            </div>

            <Painel
              titulo="Posição de cada cotista"
              descricao="Quanto cada um consumiu, quanto adiantou do próprio bolso e o saldo resultante."
              semPadding
            >
              {resumoCotistas.length === 0 ? (
                <Vazio texto="Nenhum cotista com lançamentos no período." />
              ) : (
                <ul className="divide-y divide-border">
                  {resumoCotistas.map((r) => {
                    const saldo = saldos.find((s) => s.cotistaId === r.cotistaId);
                    const positivo = (saldo?.saldo ?? 0) >= 0;
                    return (
                      <li key={r.cotistaId} className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-6 lg:items-center">
                        <div className="col-span-2 flex items-center gap-3 lg:col-span-2">
                          <AvatarCotista cotista={r} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{r.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              Cota {NUM(r.percentualSociedade, 0)}% • {NUM(r.participacaoHoras, 0)}% das horas
                            </p>
                          </div>
                        </div>

                        <Metrica titulo="Custo" valor={BRL(r.total)} sub={`${NUM(r.participacaoCusto, 0)}% do total`} />
                        <Metrica titulo="Horas" valor={hhMM(r.horas)} sub={r.custoHora > 0 ? `${BRL(r.custoHora)}/h` : "sem voo"} />
                        <Metrica titulo="Adiantou" valor={BRL(saldo?.pagou ?? 0)} sub="pago a fornecedores" />

                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saldo</p>
                          <p className={`font-mono text-sm font-bold ${positivo ? "text-emerald-400" : "text-rose-400"}`}>
                            {positivo ? "+" : "−"}
                            {BRL(Math.abs(saldo?.saldo ?? 0))}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{positivo ? "a receber" : "a pagar"}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {maiorCategoria && (
                <Nota titulo="Maior categoria de gasto" tom="atencao">
                  <p>
                    <strong>{maiorCategoria.categoria}</strong> concentra {NUM(maiorCategoria.pct, 0)}% do período (
                    {BRL(maiorCategoria.total)}). Vale acompanhar cotação de fornecedor a cada fechamento.
                  </p>
                </Nota>
              )}
              {maiorUsuario && (
                <Nota titulo="Quem mais usou a aeronave">
                  <p>
                    <strong>{maiorUsuario.nome}</strong> voou {hhMM(maiorUsuario.horas)} (
                    {NUM(maiorUsuario.participacaoHoras, 0)}% das horas) e absorveu {NUM(maiorUsuario.participacaoCusto, 0)}% do
                    custo total.
                  </p>
                </Nota>
              )}
              <Nota titulo="Eficiência atual" tom="positivo">
                <p>
                  Com {hhMM(medias.horasMes)} por mês, o custo hora está em {BRL(medias.custoHora)}. Cada hora adicional entra a
                  apenas {BRL(medias.variavelHora)}.
                </p>
              </Nota>
            </div>
          </div>

          {/* ══════════════ ABA 2 — ACERTO DE CONTAS ══════════════ */}
          <div className={`space-y-6 animate-fade-in print:block ${activeTab === "acerto" ? "block" : "hidden"}`}>
            <Nota titulo={isSociedade ? "Posição frente à conta comum" : "O que é o acerto de contas"}>
              <p>
                {isSociedade ? (
                  <>O <strong>saldo</strong> compara o que cada sócio depositou na conta comum, o que pagou diretamente e o que lhe cabe pelo rateio. Saldo positivo = crédito na conta comum; saldo negativo = valor a aportar.</>
                ) : (
                  <>Durante o período cada cotista pagou fornecedores diretamente. O <strong>saldo</strong> é a diferença entre o que a pessoa adiantou e o que de fato lhe cabe pelo rateio. Saldo positivo = tem a receber; saldo negativo = precisa transferir.</>
                )}
              </p>
            </Nota>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {saldos.map((s) => {
                const positivo = s.saldo >= 0;
                return (
                  <article
                    key={s.cotistaId}
                    className={`rounded-2xl border p-5 ${
                      positivo ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-rose-500/30 bg-rose-500/[0.07]"
                    }`}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <AvatarCotista cotista={s} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{s.nome}</p>
                        <p className="text-[11px] text-muted-foreground">Cota {NUM(s.percentualSociedade, 0)}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {positivo ? (
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-rose-400" />
                      )}
                      <p className={`font-mono text-2xl font-bold ${positivo ? "text-emerald-400" : "text-rose-400"}`}>
                        {BRL(Math.abs(s.saldo))}
                      </p>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {isSociedade ? (positivo ? "Crédito na conta comum" : "Valor a aportar") : (positivo ? "Tem a receber" : "Tem a pagar")}
                    </p>

                    <dl className="mt-4 space-y-1.5 border-t border-border/60 pt-3 text-xs">
                      {isSociedade && (
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Depositou</dt>
                          <dd className="font-mono text-foreground">{BRL(s.depositado)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">{isSociedade ? "Pagou direto" : "Adiantou"}</dt>
                        <dd className="font-mono text-foreground">{BRL(s.pagouDireto)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">{isSociedade ? "Uso / deve" : "Cabe a ele(a)"}</dt>
                        <dd className="font-mono text-foreground">{BRL(s.deve)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            {!isSociedade && (
              <Painel titulo="Transferências sugeridas" descricao="Menor número possível de pagamentos para zerar todos os saldos do período.">
              {transferencias.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Todos os saldos já estão equilibrados.
                </p>
              ) : (
                <ul className="space-y-3">
                  {transferencias.map((t, i) => {
                    const de = cotistaPorId(t.de);
                    const para = cotistaPorId(t.para);
                    return (
                      <li
                        key={`${t.de}-${t.para}-${i}`}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-4"
                      >
                        <span className="flex items-center gap-2">
                          <AvatarCotista cotista={de} tamanho="sm" />
                          <span className="text-sm font-semibold text-foreground">{de.nome}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="flex items-center gap-2">
                          <AvatarCotista cotista={para} tamanho="sm" />
                          <span className="text-sm font-semibold text-foreground">{para.nome}</span>
                        </span>
                        <span className="ml-auto font-mono text-base font-bold text-emerald-400">{BRL(t.valor)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              </Painel>
            )}

            {!isSociedade && (
              <Painel titulo="Matriz de acerto" descricao="Linha = quem transfere. Coluna = quem recebe." semPadding>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">Matriz de transferências entre cotistas</caption>
                  <thead>
                    <tr className="bg-card/80 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <th scope="col" className="border-r border-border/60 px-4 py-3 text-left font-bold">
                        Paga ↓ / Recebe →
                      </th>
                      {cotistas.map((c) => (
                        <th key={c.id} scope="col" className="px-4 py-3 text-right font-bold">
                          {c.nome.split(" ")[0]}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-3 text-right font-bold text-muted-foreground">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cotistas.map((linha) => {
                      const totalLinha = transferencias.filter((t) => t.de === linha.id).reduce((s, t) => s + t.valor, 0);
                      return (
                        <tr key={linha.id} className="hover:bg-card-secondary/40">
                          <th
                            scope="row"
                            className="border-r border-border/60 bg-card/40 px-4 py-3 text-left text-xs font-semibold text-foreground"
                          >
                            {linha.nome}
                          </th>
                          {cotistas.map((col) => {
                            const t = transferencias.find((x) => x.de === linha.id && x.para === col.id);
                            return (
                              <td
                                key={col.id}
                                className={`px-4 py-3 text-right font-mono text-xs ${
                                  t ? "bg-emerald-500/10 font-bold text-emerald-300" : "text-muted-foreground"
                                }`}
                              >
                                {t ? BRL(t.valor) : linha.id === col.id ? "—" : "R$ —"}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right font-mono text-xs font-bold text-foreground">
                            {totalLinha > 0 ? BRL(totalLinha) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </Painel>
            )}

            <Painel titulo="Conferência do fechamento">
              <ul className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                <li className="rounded-xl border border-border/60 bg-card/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {isSociedade ? "Total depositado" : "Total pago a fornecedores"}
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">
                    {BRL(saldos.reduce((s, x) => s + (isSociedade ? x.depositado : x.pagouDireto), 0))}
                  </p>
                </li>
                <li className="rounded-xl border border-border/60 bg-card/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {isSociedade ? "Total pago diretamente" : "Total rateado"}
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-foreground">
                    {BRL(saldos.reduce((s, x) => s + (isSociedade ? x.pagouDireto : x.deve), 0))}
                  </p>
                </li>
                <li className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">
                    {isSociedade ? "Posição líquida" : "Diferença"}
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-emerald-300">
                    {BRL(saldos.reduce((s, x) => s + x.saldo, 0))}
                  </p>
                </li>
              </ul>
            </Painel>
          </div>

          {/* ══════════════ ABA 3 — LANÇAMENTOS ══════════════ */}
          <div className={`space-y-8 animate-fade-in print:block ${activeTab === "lancamentos" ? "block" : "hidden"}`}>
            <section>
              <TituloSecao titulo="Todos os Lançamentos e Rateios" />
              {despesasAgrupadas.length === 0 ? (
                <Vazio texto="Nenhum lançamento encontrado para este período." />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/80 shadow-sm">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-card-secondary/50 text-[10px] uppercase tracking-widest text-muted-foreground">
                        <th colSpan={9} className="border-b border-r border-border/60 py-3 px-4 text-left font-bold">
                          Qualificação da Despesa
                        </th>
                        {cotistas.map((c) => (
                          <th key={`g-pct-${c.id}`} className="border-b border-border/60 py-3 px-2 text-center font-bold text-muted-foreground">%</th>
                        ))}
                        {cotistas.map((c) => (
                          <th key={`g-rat-${c.id}`} className="border-b border-l border-border/60 py-3 px-2 text-center font-bold text-primary">
                            {c.nome.split(" ")[0]}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-card-secondary/60 text-[10px] font-bold uppercase text-muted-foreground">
                        <Th>Data</Th>
                        <Th>Doc</Th>
                        <Th>Fornecedor</Th>
                        <Th>Descrição</Th>
                        <Th>Categoria</Th>
                        <Th>Tipo</Th>
                        <Th>Prazo</Th>
                        <Th>Pago Por</Th>
                        <Th className="border-r border-border/60 text-foreground" right>Total</Th>
                        {cotistas.map((c) => <Th key={`h-pct-${c.id}`} right>{abrev(c.nome)} %</Th>)}
                        {cotistas.map((c) => <Th key={`h-rat-${c.id}`} className="border-l border-border/60 text-primary" right>R$</Th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {despesasAgrupadas.map(({ ref, rateios }) => {
                        const dataRef = ref.data_pagamento || ref.data_vencimento;
                        const doc = ref.numero_nf || ref.numero_doc || "—";
                        const prazo = inferirPrazo(catNome(ref.categoria_custo), ref.tipo_rateio);

                        return (
                          <tr key={ref.despesa_id || ref.id} className="hover:bg-card-secondary/50 transition-colors">
                            <Td mono>{fmtDate(dataRef)}</Td>
                            <Td mono dim={doc === "—"}>{doc}</Td>
                            <Td fontSemibold>{ref.fornecedor_nome || "—"}</Td>
                            <Td max="180px">{ref.descricao_despesa || "—"}</Td>
                            <Td upper>{catNome(ref.categoria_custo)}</Td>
                            <Td dim upper>{tipoRateioLabel(ref.tipo_rateio || ref.periodicidade)}</Td>
                            <Td dim upper>{prazo}</Td>
                            <Td upper>{ref.pago_por || "—"}</Td>
                            <Td className="border-r border-border/60 font-bold text-foreground" mono right>
                              {BRL(Number(ref.valor_total ?? ref.valor_total_despesa ?? 0) || rateios.reduce((sum, item) => sum + Number(item.valor_rateado ?? 0), 0))}
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
                                <Td key={`rat-${c.id}`} className="border-l border-border/60" dim={val === 0} fontSemibold={val > 0} mono right>
                                  {val > 0 ? BRL(val) : "—"}
                                </Td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-card-secondary text-xs font-bold text-white">
                        <td colSpan={8} className="py-3 px-4 text-right">Total Geral</td>
                        <td className="py-3 px-4 text-right font-mono border-r border-border">{BRL(totalGeral)}</td>
                        {cotistas.map((c) => <td key={`ft-pct-${c.id}`} className="py-3 px-4 text-right text-muted-foreground">—</td>)}
                        {cotistas.map((c) => (
                          <td key={`ft-rat-${c.id}`} className="py-3 px-4 text-right font-mono text-blue-300 border-l border-border">
                            {BRL(pivot.cotTot.get(c.id) ?? 0)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <section>
              <TituloSecao titulo="Resumo Geral por Cotista" />
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <KpiCard label="Custo Mês (Médio)" valor={BRL(medias.custoMes)} />
                <KpiCard label="Custo Hora (Médio)" valor={BRL(medias.custoHora)} />
                <KpiCard label="Custo Pouso (Médio)" valor={BRL(medias.custoPouso)} />
                <KpiCard label="Valor Médio Litro" valor={BRL(medias.valorLitro)} />
                <KpiCard label="Consumo Litros/Hora" valor={`${NUM(medias.litrosHora, 1)} L`} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {resumoCotistas.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
                    <div className="bg-primary/15 px-5 py-4 border-b border-border/60">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Cotista</p>
                      <p className="text-lg font-bold text-foreground">{c.nome}</p>
                    </div>
                    <div className="p-5 space-y-4 text-sm">
                      <LinhaResumo label="Custos Fixos" value={c.fixo} bold />
                      <LinhaResumo label="Custos Variáveis" value={c.variavel} bold />
                      <div className="border-t border-border/40 pt-3 flex justify-between items-center bg-card-secondary/50 p-2 rounded-lg">
                        <span className="text-muted-foreground font-bold uppercase text-xs">Custo Total</span>
                        <span className="font-mono text-base font-bold text-primary">{BRL(c.total)}</span>
                      </div>
                      {(c.horas > 0 || c.litros > 0) && (
                        <div className="border-t border-border/40 pt-4 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Indicadores Operacionais</p>
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
          </div>

          {/* ══════════════ ABA 4 — GRÁFICOS E ANÁLISES ══════════════ */}
          <div className={`space-y-6 animate-fade-in print:block ${activeTab === "graficos" ? "block" : "hidden"}`}>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
              <Painel
                className="xl:col-span-3"
                titulo="Custo por mês e categoria de custo"
                descricao="Barras empilhadas por tipo de custo em cada competência."
              >
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                      <CartesianGrid stroke="#1C2A3F" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => BRLCompacto(Number(v))} />
                      <Tooltip content={<TooltipGrafico />} cursor={{ fill: "#131E2F" }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }} iconType="circle" iconSize={8} />
                      <Bar dataKey="fixo" name="Fixos" stackId="a" fill="#38bdf8" />
                      <Bar dataKey="variavel" name="Variáveis" stackId="a" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Painel>

              <Painel className="xl:col-span-2" titulo="Participação por categoria">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={dadosCategoriaPie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="none">
                        {dadosCategoriaPie.map((d) => (
                          <Cell key={d.name} fill={d.cor} />
                        ))}
                      </Pie>
                      <Tooltip content={<TooltipGrafico />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {dadosCategoriaPie.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-2 text-[11px]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.cor }} />
                      <span className="truncate text-muted-foreground">{d.name}</span>
                      <span className="ml-auto font-mono text-foreground">{BRL(d.value)}</span>
                      <span className="w-10 text-right font-mono text-muted-foreground">{NUM(categorias[i]?.pct ?? 0, 0)}%</span>
                    </li>
                  ))}
                </ul>
              </Painel>
            </div>

            <Painel
              titulo="Ranking de gastos e divisão entre cotistas"
              descricao="Cada barra mostra como o valor da categoria foi distribuído entre os sócios."
            >
              {categorias.length === 0 ? (
                <Vazio texto="Sem gastos registrados." />
              ) : (
                <>
                  <ul className="space-y-5">
                    {categorias.map((c, i) => (
                      <li key={c.categoria}>
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="w-6 font-mono text-xs font-bold text-muted-foreground">{i + 1}º</span>
                          <span className="text-sm font-bold uppercase tracking-wide text-foreground">{c.categoria}</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              c.tipo === "FIXO" ? "bg-sky-500/15 text-sky-300" : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {c.tipo === "FIXO" ? "Fixo" : "Variável"}
                          </span>
                          <span className="ml-auto font-mono text-sm font-bold text-foreground">{BRL(c.total)}</span>
                          <span className="w-12 text-right font-mono text-xs text-muted-foreground">{NUM(c.pct, 1)}%</span>
                        </div>
                        <BarraCotistas cotistas={cotistas} valores={c.porCotista} total={c.total} />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4">
                    {cotistas.map((c) => (
                      <span key={c.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.corHex }} />
                        {c.nome}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </Painel>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
              <Painel
                className="xl:col-span-3"
                titulo="Projeção do custo por hora voada"
                descricao="Quanto mais horas no mês, mais o custo fixo se dilui. O custo variável permanece constante."
              >
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={projecao.linhas} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                      <CartesianGrid stroke="#1C2A3F" vertical={false} />
                      <XAxis dataKey="horas" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => BRLCompacto(Number(v))} />
                      <Tooltip content={<TooltipGrafico />} cursor={{ stroke: "#2A3B54" }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }} iconType="circle" iconSize={8} />
                      <Line type="monotone" dataKey="custoHora" name="Custo total / hora" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="custoFixoHora" name="Parcela fixa / hora" stroke="#a78bfa" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                      <Line type="monotone" dataKey="custoVariavelHora" name="Parcela variável / hora" stroke="#fbbf24" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[5, 10, 20, 30].map((h) => {
                    const custo = medias.fixoMes / h + medias.variavelHora;
                    return (
                      <div key={h} className="rounded-xl border border-border/60 bg-card/60 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}h / mês</p>
                        <p className="mt-1 font-mono text-sm font-bold text-sky-300">{BRL(custo)}</p>
                        <p className="text-[11px] text-muted-foreground">por hora voada</p>
                      </div>
                    );
                  })}
                </div>
              </Painel>

              <div className="space-y-6 xl:col-span-2">
                <Painel titulo="Cota x uso x custo" descricao="Desvios grandes indicam desequilíbrio no rateio.">
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={dadosRadar} outerRadius="72%">
                        <PolarGrid stroke="#1C2A3F" />
                        <PolarAngleAxis dataKey="cotista" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <Tooltip content={<TooltipGrafico moeda={false} sufixo="%" />} />
                        <Radar name="Cota %" dataKey="Cota" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.18} />
                        <Radar name="Horas %" dataKey="Horas" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.14} />
                        <Radar name="Custo %" dataKey="Custo" stroke="#34d399" fill="#34d399" fillOpacity={0.1} />
                        <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconType="circle" iconSize={8} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </Painel>

                {projecao.pontoOtimo && (
                  <Nota titulo="Ponto de equilíbrio de utilização" tom="positivo">
                    <p>
                      A partir de <strong>{projecao.pontoOtimo.horas}h por mês</strong> o custo hora se estabiliza em torno de{" "}
                      <strong>{BRL(projecao.pontoOtimo.custoHora)}</strong>. Voar menos que isso encarece cada hora rapidamente,
                      porque o custo fixo de {BRL(medias.fixoMes)}/mês é dividido por poucas horas.
                    </p>
                  </Nota>
                )}

                <Nota titulo="Base de cálculo">
                  <p>
                    Custo fixo médio: <strong>{BRL(medias.fixoMes)}/mês</strong>.
                  </p>
                  <p>
                    Custo variável médio: <strong>{BRL(medias.variavelHora)}/hora</strong>, dos quais{" "}
                    {BRL(medias.combustivelHora)} são de combustível.
                  </p>
                </Nota>
              </div>
            </div>

            <Painel titulo="Distribuição por categoria e cotista" semPadding>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-card-secondary/50 text-xs font-bold uppercase text-muted-foreground">
                      <Th className="text-left py-3 px-4">Categoria</Th>
                      {cotistas.map((c) => <Th key={c.id} right>{c.nome}</Th>)}
                      <Th className="text-foreground" right>Total Geral</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {pivot.sortedCats.map((cat) => {
                      const byC = pivot.cats.get(cat)!;
                      const rowTotal = Array.from(byC.values()).reduce((s, v) => s + v, 0);
                      return (
                        <tr key={cat} className="hover:bg-card-secondary/50">
                          <Td className="font-bold text-foreground py-3 px-4" upper>{cat}</Td>
                          {cotistas.map((c) => (
                            <Td key={c.id} dim={!byC.get(c.id)} mono right>
                              {byC.get(c.id) ? BRL(byC.get(c.id)!) : "—"}
                            </Td>
                          ))}
                          <Td className="font-bold text-foreground" mono right>{BRL(rowTotal)}</Td>
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
            </Painel>
          </div>

          {/* ══════════════ ABA 5 — DIÁRIO DE BORDO ══════════════ */}
          <div className={`space-y-6 animate-fade-in print:block ${activeTab === "diario" ? "block" : "hidden"}`}>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard label="Horas no filtro" valor={hhMM(horasFiltro)} detalhe={`${voosFiltrados.length} etapas`} destaque />
              <KpiCard label="Pousos" valor={String(pousosFiltro)} detalhe={`${BRL(medias.custoPouso)} por pouso`} />
              <KpiCard label="Abastecido" valor={`${NUM(litrosFiltro, 0)} L`} detalhe={`${NUM(medias.litrosHora, 1)} L/h médios`} />
              <KpiCard
                label="Etapa média"
                valor={hhMM(voosFiltrados.length ? horasFiltro / voosFiltrados.length : 0)}
                detalhe="tempo por trecho"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Painel className="xl:col-span-2" titulo="Horas voadas por cotista" descricao="Base do rateio das despesas variáveis.">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={resumoCotistas.map((r) => ({ nome: r.nome.split(" ")[0], horas: r.horas, cor: r.corHex }))}
                      margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
                    >
                      <CartesianGrid stroke="#1C2A3F" vertical={false} />
                      <XAxis dataKey="nome" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
                      <Tooltip content={<TooltipGrafico moeda={false} sufixo="h" />} cursor={{ fill: "#131E2F" }} />
                      <Bar dataKey="horas" name="Horas" radius={[6, 6, 0, 0]}>
                        {resumoCotistas.map((r) => (
                          <Cell key={r.id} fill={r.corHex} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Painel>

              <Painel titulo="Utilização mensal">
                <ul className="space-y-3">
                  {serie.map((m) => {
                    const maxH = Math.max(...serie.map((x) => x.horas), 1);
                    return (
                      <li key={m.mes}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{m.label}</span>
                          <span className="font-mono font-semibold text-foreground">{hhMM(m.horas)}</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-card-secondary">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${(m.horas / maxH) * 100}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Painel>
            </div>

            <Painel
              titulo="Registros do diário de bordo"
              acao={
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Cotista
                  <select
                    value={cotistaFiltro}
                    onChange={(e) => setCotistaFiltro(e.target.value)}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:border-sky-500"
                  >
                    <option value="todos">Todos</option>
                    {cotistas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
              }
              semPadding
            >
              {voosFiltrados.length === 0 ? (
                <Vazio texto="Nenhum voo registrado neste período." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-card/80 text-[10px] uppercase tracking-widest text-muted-foreground">
                        <Th className="py-3 px-4">Data</Th>
                        <Th>Competência</Th>
                        <Th>Trecho</Th>
                        <Th>Natureza</Th>
                        <Th right>Horas</Th>
                        <Th right>Pousos</Th>
                        <Th right>Abastec.</Th>
                        <Th>Responsável</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {voosFiltrados.map((v) => (
                        <tr key={v.id} className="hover:bg-card-secondary/50">
                          <Td className="py-3 px-4" mono>{fmtDate(v.data_registro)}</Td>
                          <Td dim>{labelMes(mesKey(v.data_registro))}</Td>
                          <Td mono fontSemibold>
                            {(v.aerodromo_partida || "—")} → {(v.aerodromo_chegada || "—")}
                            {v.emprestimo && (
                              <span className="ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/20">
                                Emprestado
                              </span>
                            )}
                          </Td>
                          <Td dim upper>{v.natureza_voo || "—"}</Td>
                          <Td className="font-bold text-foreground" mono right>
                            {hhMM(Number(v.tempo_voo ?? v.tempo_total ?? 0))}
                          </Td>
                          <Td mono right dim>{v.pousos_total ?? "—"}</Td>
                          <Td mono right className="text-amber-300 font-medium">
                            {v.combustivel_adicionado ? `${NUM(v.combustivel_adicionado, 0)} L` : "—"}
                          </Td>
                          <Td>
                            <span className="flex items-center gap-2 text-foreground">
                              <AvatarCotista cotista={cotistaPorId(v.socios_id || v.clientes_id || "")} tamanho="sm" />
                              {v.socios_nome || "—"}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-card-secondary text-xs font-bold text-foreground">
                        <td colSpan={4} className="px-4 py-3 text-right uppercase tracking-widest text-muted-foreground">Total</td>
                        <td className="px-3 py-3 text-right font-mono text-sky-300">{hhMM(horasFiltro)}</td>
                        <td className="px-3 py-3 text-right font-mono">{pousosFiltro}</td>
                        <td className="px-3 py-3 text-right font-mono text-amber-300">{NUM(litrosFiltro, 0)} L</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Painel>
          </div>

          {/* ══════════════ ABA 6 — VOOS EMPRESTADOS ══════════════ */}
          <div className={`space-y-6 animate-fade-in print:block ${activeTab === "emprestimos" ? "block" : "hidden"}`}>
            <Nota titulo="O que é esta aba" tom="atencao">
              <p>
                Voos marcados como <strong>empréstimo</strong> no diário de bordo não geram cobrança para o cliente que
                usou a aeronave, nem entram nas contas normais do cotista. O combustível desses voos fica registrado
                aqui apenas como histórico de uso — não é somado ao total pago por ninguém. Já o desgaste de peças e
                manutenção referente a essas horas continua sendo atribuído ao <strong>cotista dono</strong> da
                aeronave, já que ela rodou de qualquer forma.
              </p>
            </Nota>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard
                label="Voos emprestados"
                valor={String(voosEmprestados.length)}
                detalhe={`${qtdMeses} ${qtdMeses > 1 ? "meses" : "mês"}`}
                icone={<ArrowLeftRight className="h-4 w-4" />}
                destaque
              />
              <KpiCard label="Horas emprestadas" valor={hhMM(totaisEmprestimos.horas)} icone={<Clock className="h-4 w-4" />} />
              <KpiCard
                label="Combustível não cobrado"
                valor={BRL(totaisEmprestimos.combustivel)}
                detalhe="registrado, não faturado"
                icone={<Fuel className="h-4 w-4" />}
              />
              <KpiCard
                label="Desgaste atribuído aos cotistas"
                valor={BRL(totaisEmprestimos.desgaste)}
                detalhe="peças e manutenção"
                icone={<PlaneTakeoff className="h-4 w-4" />}
              />
            </div>

            <Painel
              titulo="Resumo por cotista dono"
              descricao="Quanto de desgaste cada cotista absorveu por ter cedido horas em empréstimo."
              semPadding
            >
              {resumoEmprestimos.length === 0 ? (
                <Vazio texto="Nenhum voo emprestado no período." />
              ) : (
                <ul className="divide-y divide-border">
                  {resumoEmprestimos.map((r) => (
                    <li key={r.nome} className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 sm:items-center">
                      <p className="col-span-2 truncate text-sm font-semibold text-foreground sm:col-span-1">{r.nome}</p>
                      <Metrica titulo="Voos" valor={String(r.voos)} />
                      <Metrica titulo="Horas" valor={hhMM(r.horas)} />
                      <Metrica titulo="Desgaste atribuído" valor={BRL(r.desgaste)} />
                    </li>
                  ))}
                </ul>
              )}
            </Painel>

            <Painel
              titulo="Voos emprestados no período"
              descricao="Combustível é apenas informativo. O custo de desgaste (peças/manutenção) é atribuído ao cotista dono."
              semPadding
            >
              {voosEmprestados.length === 0 ? (
                <Vazio texto="Nenhum voo emprestado no período." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-card/80 text-[10px] uppercase tracking-widest text-muted-foreground">
                        <Th className="py-3 px-4">Data</Th>
                        <Th>Trecho</Th>
                        <Th>Cotista dono</Th>
                        <Th>Cliente / tomador do empréstimo</Th>
                        <Th right>Horas</Th>
                        <Th right>Combustível (não cobrado)</Th>
                        <Th right className="px-4">Desgaste atribuído</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {voosEmprestados.map((v) => (
                        <tr key={v.id} className="hover:bg-card-secondary/50">
                          <Td className="py-3 px-4" mono>{fmtDate(v.data)}</Td>
                          <Td mono fontSemibold>{v.trecho}</Td>
                          <Td>{v.cotistaDonoNome}</Td>
                          <Td dim>{v.tomadorNome}</Td>
                          <Td mono right>{hhMM(v.horas)}</Td>
                          <Td mono right className="text-amber-300/80">{v.combustivelValor > 0 ? BRL(v.combustivelValor) : "—"}</Td>
                          <Td className="px-4 font-semibold text-foreground" mono right>{BRL(v.custoDesgaste)}</Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-card-secondary text-xs font-bold text-foreground">
                        <td colSpan={4} className="px-4 py-3 text-right uppercase tracking-widest text-muted-foreground">Total</td>
                        <td className="px-3 py-3 text-right font-mono">{hhMM(totaisEmprestimos.horas)}</td>
                        <td className="px-3 py-3 text-right font-mono text-amber-300">{BRL(totaisEmprestimos.combustivel)}</td>
                        <td className="px-4 py-3 text-right font-mono">{BRL(totaisEmprestimos.desgaste)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Painel>
          </div>

          {/* ══════════════ ABA 7 — EXPLICANDO O BALANÇO ══════════════ */}
          <div className={`space-y-6 animate-fade-in print:block ${activeTab === "metodologia" ? "block" : "hidden"}`}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.07] p-5">
                <Scale className="mb-3 h-5 w-5 text-sky-300" />
                <h2 className="text-sm font-bold text-foreground">1. Custos fixos → cota societária</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Hangaragem, seguro, tripulação e administração existem mesmo que a aeronave não decole. São divididos pelo
                  percentual de propriedade de cada cotista.
                </p>
                <p className="mt-3 rounded-lg bg-card/70 p-3 font-mono text-[11px] text-sky-200">
                  valor_cotista = valor_total × cota%
                </p>
              </article>

              <article className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-5">
                <Timer className="mb-3 h-5 w-5 text-amber-300" />
                <h2 className="text-sm font-bold text-foreground">2. Custos variáveis → horas voadas</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Combustível, manutenção por hora e tarifas aeroportuárias só ocorrem quando se voa. São divididos pela
                  proporção de horas de cada cotista <strong>no mês da despesa</strong>.
                </p>
                <p className="mt-3 rounded-lg bg-card/70 p-3 font-mono text-[11px] text-amber-200">
                  valor_cotista = valor_total × (horas_cotista ÷ horas_mês)
                </p>
              </article>

              <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] p-5">
                <Calculator className="mb-3 h-5 w-5 text-emerald-300" />
                <h2 className="text-sm font-bold text-foreground">3. Saldo e acerto</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {isSociedade
                    ? "Para clientes com sócios, cada posição é apurada diante da conta comum, sem transferências sugeridas entre os sócios."
                    : "Confronta-se o que cada um adiantou a fornecedores com o que lhe cabe pelo rateio. A diferença vira transferências entre os cotistas."}
                </p>
                <p className="mt-3 rounded-lg bg-card/70 p-3 font-mono text-[11px] text-emerald-200">
                  {isSociedade ? "saldo = depositado + pago_direto − total_rateado" : "saldo = total_pago − total_rateado"}
                </p>
              </article>
            </div>

            <Painel titulo="Classificação das categorias do período" semPadding>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-card/80 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <Th className="py-3 px-4">Categoria</Th>
                      <Th>Tipo</Th>
                      <Th>Critério de rateio</Th>
                      <Th right>Participação</Th>
                      <Th right className="px-4">Total no período</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categorias.map((c) => (
                      <tr key={c.categoria} className="hover:bg-card-secondary/40">
                        <Td className="py-3 px-4 font-bold text-foreground" upper>{c.categoria}</Td>
                        <Td>
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              c.tipo === "FIXO" ? "bg-sky-500/15 text-sky-300" : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {c.tipo === "FIXO" ? "Fixo" : "Variável"}
                          </span>
                        </Td>
                        <Td dim>{c.tipo === "FIXO" ? "Cota societária" : "Horas voadas no mês"}</Td>
                        <Td mono right dim>{NUM(c.pct, 1)}%</Td>
                        <Td className="px-4 font-semibold text-foreground" mono right>{BRL(c.total)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Painel>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Nota titulo="Regras de conferência" tom="atencao">
                <p>
                  Só entram no fechamento lançamentos <strong>conferidos</strong>, com data de pagamento dentro do período (ou
                  vencimento, quando ainda não pago).
                </p>
                <p>
                  A soma dos rateios sempre precisa ser igual ao total pago aos fornecedores — a diferença exibida na tela de
                  acerto deve ser zero.
                </p>
              </Nota>
              <Nota titulo="Voos emprestados">
                <p>
                  Combustível de voos marcados como empréstimo no diário de bordo é excluído das contas do cliente e do
                  cotista — ele só aparece na aba <strong>Voos Emprestados</strong>. As horas continuam contando para o
                  cotista dono no rateio de manutenção, já que a aeronave rodou de qualquer forma.
                </p>
              </Nota>
              <Nota titulo="Quando não há horas no mês">
                <p>
                  Se em um mês nenhum cotista voar, as despesas variáveis daquele mês passam a ser divididas pela cota
                  societária, evitando divisão por zero e mantendo o fechamento consistente.
                </p>
              </Nota>
            </div>
          </div>

          <footer className="mt-12 border-t border-border pt-6 text-center text-xs text-muted-foreground font-medium">
            Gerado pelo Sistema Share Brasil • {aeronaveLabel} • {mesLabel} • Impresso em{" "}
            {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </footer>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTES E UI
// ─────────────────────────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-4 text-sm font-bold transition-colors ${
        active ? "border-blue-600 text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Painel({
  titulo,
  descricao,
  children,
  className = "",
  semPadding,
  acao,
}: {
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
  className?: string;
  semPadding?: boolean;
  acao?: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-border/60 bg-card/80 shadow-sm ${className}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
        </div>
        {acao && <div className="ml-auto">{acao}</div>}
      </header>
      <div className={semPadding ? "" : "p-5"}>{children}</div>
    </section>
  );
}

function Nota({ titulo, children, tom }: { titulo: string; children: React.ReactNode; tom?: "positivo" | "atencao" }) {
  const cls =
    tom === "positivo"
      ? "border-emerald-500/30 bg-emerald-500/[0.07]"
      : tom === "atencao"
      ? "border-amber-500/30 bg-amber-500/[0.07]"
      : "border-border/60 bg-card/60";
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{titulo}</p>
      <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}

function AvatarCotista({ cotista, tamanho }: { cotista: { nome: string; corHex?: string }; tamanho?: "sm" }) {
  const iniciais = (cotista?.nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const size = tamanho === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-slate-900 ${size}`}
      style={{ background: cotista?.corHex || "#64748b" }}
    >
      {iniciais}
    </span>
  );
}

function Metrica({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{titulo}</p>
      <p className="font-mono text-sm font-bold text-foreground">{valor}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BarraCotistas({
  cotistas,
  valores,
  total,
}: {
  cotistas: CotistaInfo[];
  valores: Map<string, number>;
  total: number;
}) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-card-secondary">
      {cotistas.map((c) => {
        const val = valores.get(c.id) ?? 0;
        const pct = total > 0 ? (val / total) * 100 : 0;
        if (pct <= 0) return null;
        return <div key={c.id} title={`${c.nome}: ${BRL(val)}`} style={{ width: `${pct}%`, background: c.corHex }} className="h-full" />;
      })}
    </div>
  );
}

function TooltipGrafico({
  active,
  payload,
  label,
  sufixo,
  moeda = true,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  sufixo?: string;
  moeda?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur">
      {label && <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>}
      <ul className="space-y-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-mono font-semibold text-foreground">
              {moeda ? BRL(p.value ?? 0) : `${Number(p.value ?? 0).toFixed(1).replace(".", ",")}${sufixo ?? ""}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TituloSecao({ titulo }: { titulo: string }) {
  return (
    <div className="mb-6 flex items-center gap-3 print:mb-4">
      <h2 className="text-lg font-bold tracking-tight text-foreground">{titulo}</h2>
      <div className="h-px flex-1 bg-secondary/50" />
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card-secondary/50 py-16 text-center text-sm font-medium text-muted-foreground">
      {texto}
    </div>
  );
}

function KpiCard({
  label,
  valor,
  detalhe,
  icone,
  destaque,
}: {
  label: string;
  valor: string;
  detalhe?: string;
  icone?: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
        destaque ? "border-primary/40 bg-primary/10" : "border-border/60 bg-card/80"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icone}
        <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
      </div>
      <p className="font-mono text-2xl font-bold tracking-tight text-primary">{valor}</p>
      {detalhe && <p className="mt-1 text-[11px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

function LinhaResumo({ label, value, isText, bold }: { label: string; value: number | string; isText?: boolean; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-3 text-sm">
      <span className={bold ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>
        {isText ? String(value) : BRL(value as number)}
      </span>
    </div>
  );
}

// ── Células de Tabela ─────────────────────────────────────────────────────────

function Th({ children, right, className = "" }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <th className={["py-3 px-3 border-b border-border/60 whitespace-nowrap align-middle", right ? "text-right" : "text-left", className].join(" ")}>
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
  fontSemibold,
  max,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  mono?: boolean;
  upper?: boolean;
  dim?: boolean;
  fontSemibold?: boolean;
  max?: string;
  className?: string;
}) {
  return (
    <td
      style={max ? { maxWidth: max, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined}
      className={[
        "py-2 px-3 align-middle",
        right ? "text-right" : "text-left",
        mono ? "font-mono" : "",
        upper ? "uppercase" : "",
        dim ? "text-muted-foreground" : "text-foreground",
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
