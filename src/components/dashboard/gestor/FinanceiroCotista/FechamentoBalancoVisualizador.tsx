import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

type RateioRow = {
  id: string;
  despesa_id: string | null;
  fluxo: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  data_emissao: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  numero_recibo: string | null;
  fornecedor_nome: string | null;
  descricao_despesa: string | null;
  categoria_custo: string | null;
  tipo_rateio: string | null;
  periodicidade: string | null;
  pago_por: string | null;
  pago_diretamente: boolean | null;
  valor_total: number | null;
  valor_total_despesa?: number | null;
  valor_rateado: number | null;
  valor_pago_real: number | null;
  percentual_uso: number | null;
  percentual_sociedade: number | null;
  socio_id: string | null;
  socios_nome: string | null;
  cliente_id: string | null;
  clientes_nome: string | null;
  status: string | null;
  conferido: boolean;
  conferido_em: string | null;
  abastecimento_id?: string | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  comprovante_url?: string | null;
  nf_url?: string | null;
  recibo_url?: string | null;
};

type VooRow = {
  id: string;
  data_registro: string;
  aerodromo_partida: string | null;
  aerodromo_chegada: string | null;
  trecho: string | null;
  tempo_voo: number | null;
  tempo_total: number | null;
  pousos_total: number | null;
  natureza_voo: string | null;
  socios_id: string | null;
  socios_nome: string | null;
  clientes_id: string | null;
  emprestimo: boolean | null;
};

type Cotista = {
  id: string;
  nome: string;
  percentual: number;
  socio_id: string | null;
  cliente_id: string | null;
};

type Props = {
  aeronaveId: string;
  ano?: number;
  meses?: number[];
  onClose?: () => void;
};

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const isEntrada = (r: RateioRow) => {
  const f = norm(r.fluxo);
  return ["entrada", "receita", "credito", "deposito", "recebido"].includes(f);
};

const isDevolucao = (r: RateioRow) => {
  const text = [r.tipo_rateio, r.categoria_custo, r.descricao_despesa, r.status]
    .map(norm)
    .join(" ");
  return text.includes("devolu");
};

const totalDespesa = (r: RateioRow) =>
  num(r.valor_total ?? r.valor_total_despesa) || num(r.valor_rateado);

const valorRateado = (r: RateioRow) => num(r.valor_rateado);

const dataRef = (r: RateioRow) => r.data_pagamento || r.data_vencimento || r.data_emissao;

const mesDaData = (d?: string | null) => {
  if (!d) return null;
  const dt = new Date(String(d).slice(0, 10) + "T12:00:00");
  return Number.isNaN(dt.getTime()) ? null : dt.getMonth() + 1;
};

const horaMinutos = (h: number) => {
  const inteiro = Math.floor(Number(h || 0));
  const minutos = Math.round((Number(h || 0) - inteiro) * 60);
  return `${inteiro}h${String(minutos).padStart(2, "0")}`;
};

const categoria = (r: RateioRow) =>
  String(r.categoria_custo || r.tipo_rateio || "OUTROS").replace(/_/g, " ").toUpperCase();

const expenseKey = (r: RateioRow) => {
  if (r.despesa_id) return `id:${r.despesa_id}`;
  return [
    r.data_pagamento || r.data_vencimento || r.data_emissao || "",
    norm(r.fornecedor_nome),
    norm(r.descricao_despesa),
    norm(r.numero_nf || r.numero_doc || r.numero_recibo),
    totalDespesa(r).toFixed(2),
  ].join("|");
};

const matchName = (payer: string | null | undefined, name: string) => {
  const a = norm(payer);
  const b = norm(name);
  if (!a || !b) return false;
  if (a === b) return true;
  const first = b.split(" ")[0];
  return a.includes(first) || first.includes(a);
};

const fixedExpense = (r: RateioRow) => {
  const t = `${r.tipo_rateio || ""} ${r.periodicidade || ""}`.toUpperCase();
  return t.includes("FIXO") || t.includes("MENSAL");
};

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm">
      <header className="border-b border-border/60 px-5 py-4">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Kpi({ label, value, detail, positive }: { label: string; value: string; detail?: string; positive?: boolean }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <Wallet className="h-4 w-4 text-primary" /> {label}
      </div>
      <div className={`mt-2 font-mono text-2xl font-bold ${positive == null ? "text-primary" : positive ? "text-emerald-400" : "text-rose-400"}`}>
        {value}
      </div>
      {detail && <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>}
    </div>
  );
}

export function FechamentoBalancoVisualizador({ aeronaveId, ano: anoProp, meses, onClose }: Props) {
  const hoje = new Date();
  const ano = anoProp ?? hoje.getFullYear();
  const mesesSelecionados = useMemo(() => {
    const base = meses?.length ? meses : [hoje.getMonth() + 1];
    return [...new Set(base)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  }, [meses]);
  const mesesSet = useMemo(() => new Set(mesesSelecionados), [mesesSelecionados]);
  const [aba, setAba] = useState<"visao" | "acerto" | "lancamentos" | "metodologia">("visao");

  const inicio = format(new Date(ano, mesesSelecionados[0] - 1, 1), "yyyy-MM-dd");
  const fim = format(endOfMonth(new Date(ano, mesesSelecionados[mesesSelecionados.length - 1] - 1, 1)), "yyyy-MM-dd");

  const { data, isLoading, error } = useQuery({
    queryKey: ["fechamento-balanco-oficial", aeronaveId, ano, mesesSelecionados.join(",")],
    enabled: !!aeronaveId,
    staleTime: 60_000,
    queryFn: async () => {
      const [rateioRes, vooRes, aeronaveRes, cotistaRes] = await Promise.all([
        supabase
          .from("rateio_despesas")
          .select("*")
          .eq("aeronave_id", aeronaveId)
          .eq("conferido", true)
          .or(
            `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`,
          )
          .order("data_pagamento", { ascending: true, nullsFirst: false }),
        supabase
          .from("lancamentos_diario_bordo")
          .select("id,data_registro,aerodromo_partida,aerodromo_chegada,trecho,tempo_voo,tempo_total,pousos_total,natureza_voo,socios_id,socios_nome,clientes_id,emprestimo")
          .eq("aeronave_id", aeronaveId)
          .gte("data_registro", inicio)
          .lte("data_registro", fim)
          .order("data_registro", { ascending: true }),
        supabase.from("aeronave").select("matricula,modelo,fabricante").eq("id", aeronaveId).maybeSingle(),
        supabase.from("cotistas_aeronave").select("id,id_clientes,socios_id,percentual_sociedade").eq("id_aeronave", aeronaveId),
      ]);

      if (rateioRes.error) throw rateioRes.error;
      if (vooRes.error) throw vooRes.error;
      if (cotistaRes.error) throw cotistaRes.error;

      const cotRows = (cotistaRes.data || []) as any[];
      const clienteIds = [...new Set(cotRows.map((r) => r.id_clientes).filter(Boolean))] as string[];

      const [clienteRes, socioRes] = await Promise.all([
        clienteIds.length
          ? supabase.from("clientes").select("id,razao_social,tem_socio").in("id", clienteIds)
          : Promise.resolve({ data: [], error: null } as any),
        clienteIds.length
          ? supabase.from("socios").select("id,nome,clientes_id,percentual_participacao").in("clientes_id", clienteIds).order("nome")
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (clienteRes.error) throw clienteRes.error;
      if (socioRes.error) throw socioRes.error;

      const clientes = (clienteRes.data || []) as any[];
      const socios = (socioRes.data || []) as any[];
      const temSocio = clientes.some((c) => !!c.tem_socio);

      const cotistas: Cotista[] = temSocio
        ? socios.map((s) => ({ id: String(s.id), nome: s.nome || "—", percentual: num(s.percentual_participacao), socio_id: String(s.id), cliente_id: s.clientes_id ? String(s.clientes_id) : null }))
        : clientes.map((c) => {
            const row = cotRows.find((r) => r.id_clientes === c.id && !r.socios_id);
            return { id: String(c.id), nome: c.razao_social || "—", percentual: num(row?.percentual_sociedade), socio_id: null, cliente_id: String(c.id) };
          });

      const rateios = ((rateioRes.data || []) as RateioRow[]).filter((r) => mesesSet.has(mesDaData(dataRef(r)) || 0));
      const voos = ((vooRes.data || []) as VooRow[]).filter((v) => mesesSet.has(mesDaData(v.data_registro) || 0));

      return { rateios, voos, aeronave: aeronaveRes.data, cotistas, temSocio };
    },
  });

  const rateios = data?.rateios || [];
  const cotistas = data?.cotistas || [];

  const gruposDespesa = useMemo(() => {
    const map = new Map<string, RateioRow[]>();
    rateios.forEach((r) => {
      if (isEntrada(r) || isDevolucao(r)) return;
      const key = expenseKey(r);
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    });
    return [...map.values()];
  }, [rateios]);

  const entradasPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    rateios.filter(isEntrada).forEach((r) => {
      const key = r.socio_id || r.cliente_id;
      const valor = num(r.valor_pago_real ?? r.valor_rateado ?? r.valor_total);
      if (!key || !valor) return;
      if (!map.has(key)) {
        const payer = r.pago_por || "";
        const fallback = cotistas.find((c) => matchName(payer, c.nome));
        if (fallback) map.set(fallback.id, (map.get(fallback.id) || 0) + valor);
      } else {
        map.set(key, (map.get(key) || 0) + valor);
      }
    });
    return map;
  }, [rateios, cotistas]);

  const devolucoesPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    rateios.filter(isDevolucao).forEach((r) => {
      const key = r.socio_id || r.cliente_id;
      const valor = valorRateado(r) || num(r.valor_pago_real);
      if (key && map.has(key)) map.set(key, (map.get(key) || 0) + valor);
    });
    return map;
  }, [rateios, cotistas]);

  const usoPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    rateios.forEach((r) => {
      if (isEntrada(r) || isDevolucao(r)) return;
      const key = r.socio_id || r.cliente_id;
      if (!key || !map.has(key)) return;
      map.set(key, (map.get(key) || 0) + valorRateado(r));
    });
    return map;
  }, [rateios, cotistas]);

  const pagouDiretoPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    cotistas.forEach((c) => map.set(c.id, 0));
    gruposDespesa.forEach((rows) => {
      const payerNames = [...new Set(rows.map((r) => r.pago_por).filter(Boolean))] as string[];
      const total = rows.map(totalDespesa).find((v) => v > 0) || rows.reduce((s, r) => s + valorRateado(r), 0);
      payerNames.forEach((payer) => {
        const cotista = cotistas.find((c) => matchName(payer, c.nome));
        if (!cotista || !total) return;
        map.set(cotista.id, (map.get(cotista.id) || 0) + total);
      });
    });
    return map;
  }, [gruposDespesa, cotistas]);

  const saldos = useMemo(() => {
    return cotistas.map((c) => {
      const entrada = entradasPorCotista.get(c.id) || 0;
      const devolucao = devolucoesPorCotista.get(c.id) || 0;
      const direto = pagouDiretoPorCotista.get(c.id) || 0;
      const uso = usoPorCotista.get(c.id) || 0;
      const saldo = entrada - devolucao + direto - uso;
      return {
        ...c,
        entrada,
        devolucao,
        direto,
        uso,
        saldo,
      };
    });
  }, [cotistas, entradasPorCotista, devolucoesPorCotista, pagouDiretoPorCotista, usoPorCotista]);

  const custos = useMemo(() => {
    let total = 0;
    let rateado = 0;
    let fixo = 0;
    let variavel = 0;
    let devolucoes = 0;
    const categorias = new Map<string, number>();

    gruposDespesa.forEach((rows) => {
      const totalGrupo = rows.map(totalDespesa).find((v) => v > 0) || 0;
      total += totalGrupo;
      rows.forEach((r) => {
        rateado += valorRateado(r);
        if (fixedExpense(r)) fixo += valorRateado(r);
        else variavel += valorRateado(r);
        const cat = categoria(r);
        categorias.set(cat, (categorias.get(cat) || 0) + valorRateado(r));
      });
    });

    rateios.filter(isDevolucao).forEach((r) => {
      devolucoes += valorRateado(r) || num(r.valor_pago_real);
    });

    return {
      total,
      rateado,
      naoRateado: Math.max(0, total - rateado),
      fixo,
      variavel,
      devolucoes,
      categorias: [...categorias.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [gruposDespesa, rateios]);

  const resumo = useMemo(() => {
    const horas = (data?.voos || []).reduce((s, v) => s + num(v.tempo_total ?? v.tempo_voo), 0);
    const pousos = (data?.voos || []).reduce((s, v) => s + num(v.pousos_total), 0);
    return {
      horas,
      pousos,
      voos: (data?.voos || []).length,
      custoHora: horas > 0 ? custos.rateado / horas : 0,
      custoVoo: (data?.voos || []).length > 0 ? custos.rateado / (data?.voos || []).length : 0,
    };
  }, [data?.voos, custos.rateado]);

  const matrizTransferencias = useMemo(() => {
    const devedores = saldos.filter((s) => !data?.temSocio && s.saldo < -0.01).map((s) => ({ id: s.id, v: -s.saldo })).sort((a, b) => b.v - a.v);
    const credores = saldos.filter((s) => !data?.temSocio && s.saldo > 0.01).map((s) => ({ id: s.id, v: s.saldo })).sort((a, b) => b.v - a.v);
    const out: { de: string; para: string; valor: number }[] = [];
    let i = 0;
    let j = 0;
    while (i < devedores.length && j < credores.length) {
      const v = Math.min(devedores[i].v, credores[j].v);
      if (v > 0.01) out.push({ de: devedores[i].id, para: credores[j].id, valor: v });
      devedores[i].v -= v;
      credores[j].v -= v;
      if (devedores[i].v <= 0.01) i++;
      if (credores[j].v <= 0.01) j++;
    }
    return out;
  }, [saldos, data?.temSocio]);

  const imprimir = () => window.print();

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando fechamento conferido…</div>;
  }

  if (error) {
    return <div className="p-8 text-sm text-rose-400">Erro ao carregar o fechamento: {(error as Error).message}</div>;
  }

  const tituloPeriodo = mesesSelecionados.length === 1
    ? format(new Date(ano, mesesSelecionados[0] - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })
    : `${mesesSelecionados.map((m) => format(new Date(ano, m - 1, 1), "MMM", { locale: ptBR })).join(" + ")} de ${ano}`;

  const cotistaMap = new Map(cotistas.map((c) => [c.id, c]));

  return (
    <div className="min-h-full bg-background p-4 sm:p-6 print:p-0">
      <div className="mx-auto max-w-7xl space-y-5 print:max-w-none">
        <header className="flex flex-wrap items-start gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 print:border-0 print:bg-white print:text-black">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Fechamento de Balanço</h1>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 print:text-emerald-700">
                Somente conferido
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{data?.aeronave?.matricula || "Aeronave"} {data?.aeronave?.modelo ? `— ${data.aeronave.modelo}` : ""}</p>
            <p className="text-xs capitalize text-muted-foreground">{tituloPeriodo}</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {onClose && <button onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">Fechar</button>}
            <button onClick={imprimir} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Printer className="h-4 w-4" /> Imprimir / PDF</button>
          </div>
        </header>

        <nav className="flex overflow-x-auto rounded-xl border border-border/60 bg-card/80 print:hidden">
          {[
            ["visao", "Visão Geral"],
            ["acerto", "Acerto de Contas"],
            ["lancamentos", "Lançamentos Conferidos"],
            ["metodologia", "Metodologia"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setAba(id as any)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-bold ${aba === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{label}</button>
          ))}
        </nav>

        {aba === "visao" && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi label="Custo rateado" value={brl(custos.rateado)} detail={`${brl(custos.naoRateado)} não atribuídos`} />
              <Kpi label="Custo por hora" value={brl(resumo.custoHora)} detail={`${horaMinutos(resumo.horas)} voadas`} />
              <Kpi label="Custo por voo" value={brl(resumo.custoVoo)} detail={`${resumo.voos} etapas`} />
              <Kpi label="Pousos" value={String(resumo.pousos)} detail="Diário de bordo" />
              <Kpi label="Conferência" value={custos.naoRateado < 0.01 ? "OK" : "PENDENTE"} detail={custos.naoRateado < 0.01 ? "Rateio fecha" : "Existe valor não atribuído"} positive={custos.naoRateado < 0.01} />
            </div>

            <Section title="Conferência financeira" subtitle="O fechamento oficial usa somente rateio_despesas com conferido = true.">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl bg-card-secondary/40 p-4"><p className="text-xs text-muted-foreground">Total das despesas</p><p className="mt-1 font-mono text-lg font-bold">{brl(custos.total)}</p></div>
                <div className="rounded-xl bg-card-secondary/40 p-4"><p className="text-xs text-muted-foreground">Total rateado</p><p className="mt-1 font-mono text-lg font-bold text-primary">{brl(custos.rateado)}</p></div>
                <div className={`rounded-xl p-4 ${custos.naoRateado < 0.01 ? "bg-emerald-500/10" : "bg-amber-500/10"}`}><p className="text-xs text-muted-foreground">Diferença não atribuída</p><p className={`mt-1 font-mono text-lg font-bold ${custos.naoRateado < 0.01 ? "text-emerald-400" : "text-amber-400"}`}>{brl(custos.naoRateado)}</p></div>
              </div>
            </Section>

            <Section title="Posição dos cotistas" subtitle={data?.temSocio ? "Conta comum: aporte/entrada + pagamento direto − uso − devolução." : "Clientes simples: pagamento direto − uso."}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {saldos.map((s) => {
                  const positivo = s.saldo >= 0;
                  return (
                    <article key={s.id} className={`rounded-2xl border p-5 ${positivo ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-rose-500/30 bg-rose-500/[0.06]"}`}>
                      <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">{s.nome}</p><p className="text-[11px] text-muted-foreground">Cota {s.percentual.toFixed(2)}%</p></div>{positivo ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-rose-400" />}</div>
                      <p className={`mt-4 font-mono text-2xl font-bold ${positivo ? "text-emerald-400" : "text-rose-400"}`}>{brl(Math.abs(s.saldo))}</p>
                      <p className="text-xs font-semibold text-muted-foreground">{data?.temSocio ? (positivo ? "Crédito" : "Valor a aportar") : (positivo ? "A receber" : "A pagar")}</p>
                      <dl className="mt-4 space-y-2 border-t border-border/50 pt-3 text-xs">
                        {data?.temSocio && <><Row label="Aportes / entradas" value={s.entrada} /><Row label="Devoluções" value={s.devolucao} /></>}
                        <Row label="Pagou direto" value={s.direto} />
                        <Row label="Uso / deve" value={s.uso} />
                      </dl>
                    </article>
                  );
                })}
              </div>
            </Section>

            <Section title="Distribuição por categoria">
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border/60 text-[10px] uppercase tracking-widest text-muted-foreground"><th className="px-3 py-3 text-left">Categoria</th>{cotistas.map((c) => <th key={c.id} className="px-3 py-3 text-right">{c.nome}</th>)}<th className="px-3 py-3 text-right">Total</th></tr></thead><tbody>
                {custos.categorias.map(([cat, valor]) => {
                  const porCotista = new Map<string, number>();
                  rateios.forEach((r) => { if (!isEntrada(r) && !isDevolucao(r) && categoria(r) === cat) { const key = r.socio_id || r.cliente_id; if (key) porCotista.set(key, (porCotista.get(key) || 0) + valorRateado(r)); } });
                  return <tr key={cat} className="border-b border-border/40"><td className="px-3 py-3 font-semibold">{cat}</td>{cotistas.map((c) => <td key={c.id} className="px-3 py-3 text-right font-mono">{brl(porCotista.get(c.id) || 0)}</td>)}<td className="px-3 py-3 text-right font-mono font-bold">{brl(valor)}</td></tr>;
                })}
              </tbody></table></div>
            </Section>
          </div>
        )}

        {aba === "acerto" && (
          <div className="space-y-5">
            <Section title={data?.temSocio ? "Posição frente à conta comum" : "Acerto entre cotistas"} subtitle={data?.temSocio ? "Aporte/entrada e pagamento direto são créditos do sócio; uso é responsabilidade do sócio." : "O acerto é formado exclusivamente pelos lançamentos conferidos de rateio_despesas."}>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {saldos.map((s) => {
                  const positivo = s.saldo >= 0;
                  return <article key={s.id} className={`rounded-2xl border p-5 ${positivo ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border-rose-500/30 bg-rose-500/[0.07]"}`}>
                    <p className="text-sm font-semibold">{s.nome}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Cota {s.percentual.toFixed(2)}%</p>
                    <div className="mt-4 flex items-center gap-2">{positivo ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-rose-400" />}<p className={`font-mono text-2xl font-bold ${positivo ? "text-emerald-400" : "text-rose-400"}`}>{brl(Math.abs(s.saldo))}</p></div>
                    <dl className="mt-4 space-y-2 border-t border-border/50 pt-3 text-xs">
                      {data?.temSocio && <Row label="Depositou" value={s.entrada} />}
                      {data?.temSocio && s.devolucao > 0 && <Row label="Recebeu devolução" value={s.devolucao} />}
                      <Row label="Pagou direto" value={s.direto} />
                      <Row label="Uso / deve" value={s.uso} />
                    </dl>
                  </article>;
                })}
              </div>
            </Section>

            {data?.temSocio ? (
              <Section title="Leitura do acerto DGA" subtitle="Não confunde depósito com pagamento direto do próprio bolso.">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-border/60 bg-card-secondary/30 p-4"><p className="text-xs font-semibold">Dinheiro que entrou na conta comum</p><p className="mt-1 font-mono text-lg font-bold text-emerald-400">{brl(saldos.reduce((s, x) => s + x.entrada, 0))}</p></div>
                  <div className="rounded-xl border border-border/60 bg-card-secondary/30 p-4"><p className="text-xs font-semibold">Pagamentos feitos pelos cotistas</p><p className="mt-1 font-mono text-lg font-bold">{brl(saldos.reduce((s, x) => s + x.direto, 0))}</p></div>
                  <div className="rounded-xl border border-border/60 bg-card-secondary/30 p-4"><p className="text-xs font-semibold">Uso atribuído</p><p className="mt-1 font-mono text-lg font-bold">{brl(saldos.reduce((s, x) => s + x.uso, 0))}</p></div>
                </div>
              </Section>
            ) : (
              <Section title="Transferências sugeridas" subtitle="Menor número de transferências para zerar os saldos.">
                {matrizTransferencias.length === 0 ? <p className="flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Saldos equilibrados.</p> : <div className="space-y-2">{matrizTransferencias.map((t) => <div key={`${t.de}-${t.para}`} className="flex items-center gap-2 rounded-xl border border-border/60 bg-card-secondary/30 p-4"><span className="font-semibold">{cotistaMap.get(t.de)?.nome}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /><span className="font-semibold">{cotistaMap.get(t.para)?.nome}</span><span className="ml-auto font-mono font-bold text-emerald-400">{brl(t.valor)}</span></div>)}</div>}
              </Section>
            )}
          </div>
        )}

        {aba === "lancamentos" && (
          <Section title="Lançamentos conferidos" subtitle="Somente registros com conferido = true podem aparecer no fechamento oficial.">
            {rateios.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lançamento conferido no período.</p> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border/60 text-[10px] uppercase tracking-widest text-muted-foreground"><th className="px-3 py-3 text-left">Data</th><th className="px-3 py-3 text-left">Fluxo</th><th className="px-3 py-3 text-left">Fornecedor</th><th className="px-3 py-3 text-left">Descrição</th><th className="px-3 py-3 text-left">Pago por</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-right">Rateado</th><th className="px-3 py-3 text-right">Conf.</th></tr></thead><tbody>{rateios.map((r) => <tr key={r.id} className="border-b border-border/40"><td className="px-3 py-3 font-mono">{dataRef(r) ? format(new Date(String(dataRef(r)).slice(0,10)+"T12:00:00"), "dd/MM/yyyy") : "—"}</td><td className="px-3 py-3 uppercase">{r.fluxo || "—"}</td><td className="px-3 py-3">{r.fornecedor_nome || "—"}</td><td className="px-3 py-3">{r.descricao_despesa || "—"}</td><td className="px-3 py-3">{r.pago_por || "—"}</td><td className="px-3 py-3 text-right font-mono">{brl(totalDespesa(r))}</td><td className="px-3 py-3 text-right font-mono">{brl(valorRateado(r))}</td><td className="px-3 py-3 text-right text-emerald-400"><CheckCircle2 className="ml-auto h-4 w-4" /></td></tr>)}</tbody></table></div>}
          </Section>
        )}

        {aba === "metodologia" && (
          <div className="space-y-5">
            <Section title="Fonte oficial do fechamento">
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p><strong className="text-foreground">rateio_despesas</strong> é a fonte financeira do balanço dos cotistas e do fechamento oficial.</p>
                <p>Somente linhas com <strong className="text-foreground">conferido = true</strong> são carregadas neste visualizador.</p>
                <p><strong className="text-foreground">movimentacoes não é consultada</strong> para apurar aporte, pagamento direto ou saldo dos cotistas.</p>
                <p>Em clientes com sócios, entradas vinculadas ao sócio representam dinheiro que entrou na conta comum; despesas são atribuídas pelo valor_rateado; pagamento direto é identificado pelo pago_por.</p>
                <p>Devoluções são separadas do uso e não são tratadas como despesa do cotista.</p>
                <p>Se o total das despesas conferidas não fechar com a soma dos rateios, o fechamento exibe a diferença como <strong className="text-foreground">não atribuída</strong> em vez de inventar rateio.</p>
              </div>
            </Section>
            <Section title="Regra de segurança">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300"><CheckCircle2 className="mr-2 inline h-4 w-4" /> O PDF deve ser gerado a partir desta visão, com os mesmos registros conferidos apresentados na tela.</div>
            </Section>
          </div>
        )}

        <footer className="border-t border-border/60 pt-4 text-center text-[11px] text-muted-foreground print:mt-8">Share Brasil • Fechamento oficial • {data?.aeronave?.matricula || "Aeronave"} • {tituloPeriodo} • {format(new Date(), "dd/MM/yyyy HH:mm")}</footer>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="font-mono text-foreground">{brl(value)}</span></div>;
}

export default FechamentoBalancoVisualizador;
