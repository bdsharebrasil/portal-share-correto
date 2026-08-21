// @ts-nocheck — colunas legadas fora dos types gerados
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, TrendingUp, TrendingDown, Building2, Users, PieChart as PieIcon, Target,
  LineChart as LineIcon, Download, Loader2, FileBarChart, AlertTriangle, Undo2, Layers,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";
import {
  GlassCard, PageHeader, SectionCard, StatTile, MiniBar, EmptyState, brl, brlFull, compact,
  tabsListClass, tabTriggerClass,
} from "./ui/Premium";
import DetalhamentoCategoriasGrid from "./DetalhamentoCategoriasGrid";
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const val = (m: any) => Number(m.valor_rateado ?? m.valor_total ?? 0);
const isEntrada = (m: any) => ["entrada", "receita"].includes(String(m.fluxo || "").toLowerCase());
const isPago = (m: any) => m.status === "pago" || m.status === "recebido" || m.status === "reembolsado" || Boolean(m.data_pagamento);
const isRecebivelPendente = (m: any) => !['pago', 'recebido', 'quitado', 'reembolsado', 'cancelado'].includes(String(m.status || '').toLowerCase());
const isShareExpense = (m: any) => !isEntrada(m) && (isPago(m) || Boolean(m.reembolsavel));
const isReembolso = (m: any) =>
  `${m.descricao ?? ""} ${m.categoria_nome ?? ""}`.toLowerCase().includes("reembols");

/**
 * Muitos lançamentos são salvos só com data_pagamento (ou data_vencimento),
 * sem data_emissao preenchida. Sempre que formos "bucketizar" por mês/ano,
 * usamos essa cascata em vez de m.data_emissao direto — senão a linha some
 * do relatório (String(null).slice(5,7) não vira um mês válido).
 */
const dataRef = (m: any) => m.data_emissao || m.data_pagamento || m.data_vencimento || null;
const mesDe = (m: any) => {
  const ref = dataRef(m);
  if (!ref) return -1;
  return Number(String(ref).slice(5, 7)) - 1;
};

/* Mapa de categoria_id -> { grupo_categoria, tipo_despesa } construído a partir da tabela categorias_movimentacao */
let _categoriaMap = new Map<string, { grupo: string; tipoDespesa: string | null }>();
export function setCategoriaMap(map: Map<string, { grupo: string; tipoDespesa: string | null }>) {
  _categoriaMap = map;
}
export function getCategoriaMap() {
  return _categoriaMap;
}

/**
 * Classifica uma movimentação com base no grupo_categoria + tipo_despesa da tabela categorias_movimentacao.
 * Grupos DESPESAS EMPRESA / DESPESAS EMPRESA - BANCO são separados em Fixo/Variável pelo tipo_despesa.
 * Demais grupos (REEMBOLSÁVEIS, FOLHA, IMPOSTOS, RECEITAS OPERACIONAIS, REEMBOLSOS ENTRADAS) usam o próprio nome do grupo.
 * DESPESAS PARTICULARES são separadas em Fixo/Variável e tratadas como gastos não-empresariais.
 */
const naturezaDe = (m: any) => {
  // Prioridade: se a movimentação está marcada como reembolsável,
  // ela é sempre "Despesas Reembolsáveis", independente da categoria
  // que ela está apontando (evita cair em Fixo/Variável por
  // categoria mal cadastrada ou categoria legada reaproveitada).
  if (m.reembolsavel === true) return "Despesas Reembolsáveis";

  const catInfo = m.categoria_id ? _categoriaMap.get(m.categoria_id) : undefined;
  const grupo = (catInfo?.grupo || String(m.grupo_categoria || "")).toUpperCase().trim();
  const tipoDespesa = (catInfo?.tipoDespesa || String(m.tipo_despesa || "")).toLowerCase().trim();

  if (grupo === "DESPESAS PARTICULARES") {
    return tipoDespesa === "variavel" ? "Particulares Variável" : "Particulares Fixo";
  }
  if (grupo === "DESPESAS EMPRESA" || grupo === "DESPESAS EMPRESA - BANCO") {
    return tipoDespesa === "variavel" ? "Despesas Empresa Variável" : "Despesas Empresa Fixo";
  }
  if (grupo === "FOLHA DE PAGAMENTO") return "Folha de Pagamento";
  if (grupo === "DESPESAS REEMBOLSÁVEIS") return "Despesas Reembolsáveis";
  if (grupo === "IMPOSTOS") return "Impostos";
  if (grupo === "RECEITAS OPERACIONAIS") return "Receitas Operacionais";
  if (grupo === "REEMBOLSOS ENTRADAS") return "Reembolsos Entradas";

  /* Fallback para movimentações sem categoria_id ou com grupo_custo legado */
  if (grupo.includes("PARTICULAR")) return "Particulares Fixo";
  if (grupo.startsWith("FIXO")) return "Despesas Empresa Fixo";
  if (grupo.startsWith("VARIAVEL") || grupo.startsWith("VARIÁVEL")) return "Despesas Empresa Variável";
  return "Outros";
};

const NAT_TONE: Record<string, string> = {
  "Despesas Empresa Fixo": "hsl(217 91% 65%)",
  "Despesas Empresa Variável": "hsl(38 95% 60%)",
  "Folha de Pagamento": "hsl(199 89% 60%)",
  "Despesas Reembolsáveis": "hsl(280 75% 68%)",
  "Impostos": "hsl(0 72% 60%)",
  "Receitas Operacionais": "hsl(152 70% 50%)",
  "Reembolsos Entradas": "hsl(142 72% 45%)",
  "Particulares Fixo": "hsl(330 80% 65%)",
  "Particulares Variável": "hsl(330 70% 55%)",
  "Outros": "hsl(215 25% 70%)",
};

/* Categorias que representam gastos da empresa (caixa share), excluindo particulares */
const isDespesaEmpresa = (nat: string) =>
  ["Despesas Empresa Fixo", "Despesas Empresa Variável", "Folha de Pagamento", "Despesas Reembolsáveis", "Impostos"].includes(nat);

/* Categorias que representam gastos particulares (não são da empresa) */
const isParticular = (nat: string) => nat.startsWith("Particulares");


const chartTooltip = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
  },
};

export default function MasterRelatorios() {
  const hoje = new Date();
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [periodo, setPeriodo] = useState("ano");
  const [busca, setBusca] = useState("");
  const [metaInput, setMetaInput] = useState("");
  const queryClient = useQueryClient();

  const metaKey = `meta_financeira_share_${ano}`;
  const { data: metaSalva = 0 } = useQuery({
    queryKey: ["master-meta", metaKey],
    queryFn: async () => {
      const { data } = await supabase.from("app_config").select("value").eq("key", metaKey).maybeSingle();
      return Number((data as any)?.value ?? 0) || 0;
    },
  });

  useEffect(() => {
    setMetaInput(metaSalva ? String(metaSalva) : "");
  }, [metaSalva]);

  const salvarMeta = useMutation({
    mutationFn: async (valor: number) => {
      const { error } = await supabase
        .from("app_config")
        .upsert({ key: metaKey, value: String(valor) }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["master-meta", metaKey] });
      toast.success("Meta financeira salva.");
    },
    onError: () => toast.error("Não foi possível salvar a meta."),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["master-relatorios", ano],
    queryFn: async () => {
      /*
       * IMPORTANTE: muitos lançamentos de despesa são gravados só com
       * data_pagamento (data_emissao fica null). Um filtro simples
       * .gte/.lte em data_emissao descarta essas linhas na própria
       * query (NULL nunca satisfaz uma comparação >=/<=), então elas
       * nunca chegavam ao front-end. Aqui buscamos por data_emissao
       * OU, quando ela for nula, por data_pagamento dentro do ano.
       */
      const inicioAno = `${ano}-01-01`;
      const fimAno = `${ano}-12-31`;

      const [movRes, clientesRes, salariosRes, catRes, receberRes] = await Promise.all([
        supabase
          .from("movimentacoes")
          .select(
            `id, contas_areceber_id, descricao, fluxo, valor_rateado, valor_total, data_emissao, data_vencimento, data_pagamento, clientes_id, status, tipo_caixa, fornecedor_nome, categoria_nome, grupo_categoria, categoria_id, conta_bancaria, reembolsavel`
          )
          .or(
            `and(data_emissao.gte.${inicioAno},data_emissao.lte.${fimAno}),` +
              `and(data_emissao.is.null,data_pagamento.gte.${inicioAno},data_pagamento.lte.${fimAno}),` +
              `and(data_emissao.is.null,data_pagamento.is.null,data_vencimento.gte.${inicioAno},data_vencimento.lte.${fimAno})`
          )
          .neq("status", "cancelado")
          .order("data_emissao", { ascending: false })
          .limit(5000),
        supabase.from("clientes").select("id, razao_social, proprietario"),
        supabase.from("salarios").select("salario_bruto, beneficios"),
        supabase.from("categorias_movimentacao").select("id, grupo_categoria, tipo_despesa"),
        supabase.from("contas_areceber").select("id, movimentacao_id, descricao, categoria, valor, status, data_criacao, data_vencimento, data_pagamento, cliente_nome, aeronave, reference_type").or(`and(data_criacao.gte.${inicioAno},data_criacao.lte.${fimAno}),and(data_criacao.is.null,data_vencimento.gte.${inicioAno},data_vencimento.lte.${fimAno}),and(data_criacao.is.null,data_vencimento.is.null,data_pagamento.gte.${inicioAno},data_pagamento.lte.${fimAno})`).limit(5000),
      ]);
      if (movRes.error) throw movRes.error;
      if (receberRes.error) throw receberRes.error;

      /* Constrói mapa de categoria_id -> { grupo, tipoDespesa } */
      const catMap = new Map<string, { grupo: string; tipoDespesa: string | null }>();
      (catRes.data || []).forEach((c: any) => {
        catMap.set(c.id, { grupo: c.grupo_categoria || "", tipoDespesa: c.tipo_despesa || null });
      });
      setCategoriaMap(catMap);

      return {
        movimentacoes: movRes.data || [],
        clientes: clientesRes.data || [],
        contasAReceber: receberRes.data || [],
        folha: (salariosRes.data || []).reduce(
          (t: number, s: any) => t + Number(s.salario_bruto || 0) + Number(s.beneficios || 0),
          0
        ),
      };
    },
  });

  const clientNames = useMemo(() => {
    const map = new Map<string, string>();
    (data?.clientes || []).forEach((c: any) => map.set(c.id, c.razao_social || c.proprietario || "Cliente sem nome"));
    return map;
  }, [data?.clientes]);

  const mesesFiltro = periodo === "mes" ? 1 : periodo === "trimestre" ? 3 : periodo === "semestre" ? 6 : 12;
  const mesLimite = ano === String(hoje.getFullYear()) ? hoje.getMonth() : 11;
  const mesInicio = Math.max(0, mesLimite - (mesesFiltro - 1));

  const movs = useMemo(() => {
    const all = data?.movimentacoes || [];
    return all.filter((m: any) => {
      const mes = mesDe(m);
      if (mes < 0) return false;
      return mes >= mesInicio && mes <= mesLimite;
    });
  }, [data?.movimentacoes, mesInicio, mesLimite]);

  const share = useMemo(() => movs.filter((m: any) => m.tipo_caixa === "share" || !m.tipo_caixa), [movs]);
  const cliente = useMemo(() => movs.filter((m: any) => m.tipo_caixa === "cliente"), [movs]);

  /* ---------- resumo ---------- */
  const resumo = useMemo(() => {
    const soma = (arr: any[], f: (m: any) => boolean) => arr.filter(f).reduce((t, m) => t + val(m), 0);
    const receitaShare = soma(share, (m) => isEntrada(m) && isPago(m));
    const despesaShare = soma(share, (m) => isShareExpense(m));
    const idsMovimentacoes = new Set(share.map((m: any) => m.id));
    const aReceberMovimentacoes = soma(share, (m) => isEntrada(m) && !isPago(m));
    const aReceberLancamentos = (data?.contasAReceber || [])
      .filter((r: any) => isRecebivelPendente(r) && (!r.movimentacao_id || !idsMovimentacoes.has(r.movimentacao_id)))
      .reduce((total: number, r: any) => total + Math.abs(Number(r.valor || 0)), 0);
    const aReceber = aReceberMovimentacoes + aReceberLancamentos;
    const despesaCliente = soma(cliente, (m) => !isEntrada(m) && isPago(m));
    const reembolsos = soma(movs, (m) => !isEntrada(m) && isPago(m) && isReembolso(m));
    return {
      receitaShare,
      despesaShare,
      saldoShare: receitaShare - despesaShare,
      aReceber,
      despesaCliente,
      reembolsos,
      margem: receitaShare > 0 ? ((receitaShare - despesaShare) / receitaShare) * 100 : 0,
    };
  }, [share, cliente, movs, data?.contasAReceber]);

  /* ---------- séries mensais ---------- */
  const serieMensal = useMemo(() => {
    const base = MESES.map((m, i) => ({
      mes: m,
      idx: i,
      receitaShare: 0,
      despesaShare: 0,
      receitaCliente: 0,
      despesaCliente: 0,
    }));
    (data?.movimentacoes || []).forEach((m: any) => {
      if (!isPago(m) && !Boolean(m.reembolsavel)) return;
      const i = mesDe(m);
      if (i < 0 || i > 11) return;
      const caixa = m.tipo_caixa === "cliente" ? "Cliente" : "Share";
      const key = `${isEntrada(m) ? "receita" : "despesa"}${caixa}`;
      base[i][key] += val(m);
    });
    return base.map((r) => ({ ...r, resultado: r.receitaShare - r.despesaShare }));
  }, [data?.movimentacoes]);

  const serieVisivel = useMemo(
    () => serieMensal.filter((r) => r.idx >= mesInicio && r.idx <= mesLimite),
    [serieMensal, mesInicio, mesLimite]
  );

  /* ---------- categorias / natureza ---------- */
  const categorias = useMemo(() => {
    const build = (arr: any[]) => {
      const map = new Map<string, { nome: string; total: number; qtd: number; natureza: string }>();
      arr
        .filter((m) => isShareExpense(m))
        .forEach((m) => {
          const nome = (m.categoria_nome || "Sem categoria").trim();
          const row = map.get(nome) || { nome, total: 0, qtd: 0, natureza: naturezaDe(m) };
          row.total += val(m);
          row.qtd += 1;
          map.set(nome, row);
        });
      return Array.from(map.values()).sort((a, b) => b.total - a.total);
    };
    return { share: build(share), cliente: build(cliente) };
  }, [share, cliente]);

  const porNatureza = useMemo(() => {
    const map = new Map<string, number>();
    share
      .filter((m) => isShareExpense(m))
      .forEach((m) => {
        const n = naturezaDe(m);
        map.set(n, (map.get(n) || 0) + val(m));
      });
    return Array.from(map.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }, [share]);

  /* ---------- clientes ---------- */
  const porCliente = useMemo(() => {
    const map = new Map<string, any>();
    movs.forEach((m: any) => {
      if (!m.clientes_id) return;
      const row = map.get(m.clientes_id) || {
        id: m.clientes_id,
        nome: clientNames.get(m.clientes_id) || "Cliente sem nome",
        receita: 0,
        custo: 0,
        pendente: 0,
        reembolso: 0,
        lancamentos: 0,
      };
      row.lancamentos += 1;
      if (isEntrada(m)) (isPago(m) ? (row.receita += val(m)) : (row.pendente += val(m)));
      else if (isPago(m)) {
        row.custo += val(m);
        if (isReembolso(m)) row.reembolso += val(m);
      }
      map.set(m.clientes_id, row);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, lucro: r.receita - r.custo }))
      .sort((a, b) => b.lucro - a.lucro);
  }, [movs, clientNames]);

  const clientesFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? porCliente.filter((c) => c.nome.toLowerCase().includes(t)) : porCliente;
  }, [porCliente, busca]);

  /* ---------- ponto de equilíbrio (caixa Share) ---------- */
  const equilibrio = useMemo(() => {
    const mesesNoPeriodo = Math.max(1, mesLimite - mesInicio + 1);
    const desp = share.filter((m: any) => isShareExpense(m));
    const somaNat = (nats: string[]) =>
      desp.filter((m) => nats.includes(naturezaDe(m))).reduce((t, m) => t + val(m), 0);

    const pessoal = somaNat(["Folha de Pagamento"]);
    const fixosNoPeriodo = desp.filter((m) => naturezaDe(m) === "Despesas Empresa Fixo");
    const contasFixas = fixosNoPeriodo.reduce((total, m) => total + val(m), 0);
    const mesesComFixo = new Set(fixosNoPeriodo.map((m) => dataRef(m)?.slice(0, 7)).filter(Boolean)).size;
    const contasVariaveis = somaNat(["Despesas Empresa Variável", "Despesas Reembolsáveis", "Impostos", "Outros"]);
    const particulares = somaNat(["Particulares Fixo", "Particulares Variável"]);
    const receitasOperacionais = somaNat(["Receitas Operacionais"]);
    const reembolsosEntradas = somaNat(["Reembolsos Entradas"]);

    const fixoTotal = pessoal + contasFixas;
    const fixoMensal = fixoTotal / Math.max(1, mesesComFixo);
    const variavelMensal = contasVariaveis / mesesNoPeriodo;
    const receitaMensal = resumo.receitaShare / mesesNoPeriodo;
    const margemContribuicao = receitaMensal > 0 ? (receitaMensal - variavelMensal) / receitaMensal : 0;
    const breakevenMes = margemContribuicao > 0 ? fixoMensal / margemContribuicao : fixoMensal + variavelMensal;

    const detalhe = (nats: string[]) => {
      const map = new Map<string, number>();
      desp
        .filter((m) => nats.includes(naturezaDe(m)))
        .forEach((m) => {
          const nome = (m.categoria_nome || "Sem categoria").trim();
          map.set(nome, (map.get(nome) || 0) + val(m));
        });
      return Array.from(map.entries())
        .map(([nome, total]) => ({ nome, total, mensal: total / mesesNoPeriodo }))
        .sort((a, b) => b.total - a.total);
    };

    return {
      mesesNoPeriodo,
      mesesComFixo,
      pessoal,
      contasFixas,
      contasVariaveis,
      particulares,
      receitasOperacionais,
      reembolsosEntradas,
      fixoTotal,
      fixoMensal,
      variavelMensal,
      receitaMensal,
      folha: data?.folha || 0,
      margemContribuicao: margemContribuicao * 100,
      breakevenMes,
      breakevenDia: breakevenMes / 30,
      breakevenDiaUtil: breakevenMes / 22,
      cobertura: breakevenMes > 0 ? (receitaMensal / breakevenMes) * 100 : 0,
      folgaMensal: receitaMensal - breakevenMes,
      listaFixos: detalhe(["Despesas Empresa Fixo", "Folha de Pagamento"]),
      listaVariaveis: detalhe(["Despesas Empresa Variável", "Despesas Reembolsáveis", "Impostos", "Outros"]),
    };
  }, [share, resumo.receitaShare, mesInicio, mesLimite, data?.folha]);

  /* ---------- projeção ---------- */
  const projecao = useMemo(() => {
    const realizados = serieMensal.filter((r) => r.idx <= mesLimite);
    const comDados = realizados.filter((r) => r.receitaShare > 0 || r.despesaShare > 0);
    const n = Math.max(1, comDados.length);
    const mediaReceita = comDados.reduce((t, r) => t + r.receitaShare, 0) / n;
    const mediaDespesa = comDados.reduce((t, r) => t + r.despesaShare, 0) / n;

    let acumReceita = 0;
    let acumDespesa = 0;
    let resultadoRealizado = 0;
    const linhaBase = serieMensal.map((r) => {
      const projetado = r.idx > mesLimite;
      const rec = projetado ? mediaReceita : r.receitaShare;
      const des = projetado ? mediaDespesa : r.despesaShare;
      acumReceita += rec;
      acumDespesa += des;
      if (!projetado) resultadoRealizado = acumReceita - acumDespesa;
      return {
        mes: r.mes,
        idx: r.idx,
        realizado: projetado ? null : acumReceita - acumDespesa,
        projetado: r.idx >= mesLimite ? acumReceita - acumDespesa : null,
        receita: rec,
        despesa: des,
      };
    });

    const resultadoAnual = acumReceita - acumDespesa;
    const mesesRestantes = Math.max(0, 11 - mesLimite);
    const meta = Number(metaSalva) || 0;
    const faltaParaMeta = meta - resultadoRealizado;
    const necessarioPorMes = mesesRestantes > 0 ? faltaParaMeta / mesesRestantes : faltaParaMeta;
    const gapProjecao = resultadoAnual - meta;

    /* linha da meta: evolução linear do zero até a meta ao longo do ano */
    const linha = linhaBase.map((r) => ({
      ...r,
      meta: meta > 0 ? (meta / 12) * (r.idx + 1) : null,
    }));

    return {
      linha,
      mediaReceita,
      mediaDespesa,
      mesesRestantes,
      resultadoAnual,
      resultadoRealizado,
      receitaAnual: acumReceita,
      despesaAnual: acumDespesa,
      meta,
      faltaParaMeta,
      necessarioPorMes,
      gapProjecao,
      progressoMeta: meta > 0 ? (resultadoRealizado / meta) * 100 : 0,
    };
  }, [serieMensal, mesLimite, metaSalva]);

  const exportCsv = () => {
    const header = ["Data", "Caixa", "Tipo", "Categoria", "Natureza", "Descrição", "Cliente", "Status", "Valor"];
    const linhas = movs.map((m: any) =>
      [
        dataRef(m) || "-", m.tipo_caixa || "-", m.tipo, m.categoria_nome || "-", naturezaDe(m),
        m.descricao, clientNames.get(m.clientes_id || "") || m.fornecedor_nome || "-", m.status, val(m).toFixed(2),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_share_${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado.");
  };

  const anos = Array.from({ length: 4 }, (_, i) => String(hoje.getFullYear() - i));

  return (
    <Layout>
      <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden pb-10">
        <PageHeader
          back
          icon={FileBarChart}
          title="Relatórios Financeiros"
          subtitle="Caixa da empresa, custos dos clientes e saúde financeira da Share"
          actions={
            <>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="h-9 w-[140px] rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes">Mês atual</SelectItem>
                  <SelectItem value="trimestre">Últimos 3 meses</SelectItem>
                  <SelectItem value="semestre">Últimos 6 meses</SelectItem>
                  <SelectItem value="ano">Ano inteiro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger className="h-9 w-[100px] rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 rounded-lg" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </>
          }
        />

        {error && (
          <GlassCard className="border-destructive/40 p-4 text-sm text-destructive">
            Não foi possível carregar as movimentações.
          </GlassCard>
        )}

        {isLoading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="visao" className="w-full min-w-0 space-y-4">
            <TabsList className={tabsListClass}>
              <TabsTrigger value="visao" className={tabTriggerClass}><Wallet className="h-4 w-4" /> Visão geral</TabsTrigger>
              <TabsTrigger value="empresa" className={tabTriggerClass}><Building2 className="h-4 w-4" /> Caixa da empresa</TabsTrigger>
              <TabsTrigger value="clientes" className={tabTriggerClass}><Users className="h-4 w-4" /> Clientes</TabsTrigger>
              <TabsTrigger value="categorias" className={tabTriggerClass}><PieIcon className="h-4 w-4" /> Categorias</TabsTrigger>
              <TabsTrigger value="equilibrio" className={tabTriggerClass}><Target className="h-4 w-4" /> Equilíbrio</TabsTrigger>
              <TabsTrigger value="projecao" className={tabTriggerClass}><LineIcon className="h-4 w-4" /> Projeção</TabsTrigger>
            </TabsList>

            {/* ---------------- VISÃO GERAL ---------------- */}
            <TabsContent value="visao" className="space-y-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Receita da empresa" value={brl(resumo.receitaShare)} hint="Recebido no período" icon={TrendingUp} tone="success" delay={0} />
                <StatTile label="Gastos da empresa" value={brl(resumo.despesaShare)} hint="Pago no período" icon={TrendingDown} tone="danger" delay={60} />
                <StatTile label="Caixa da Share" value={brl(resumo.saldoShare)} hint={`Margem ${resumo.margem.toFixed(1)}%`} icon={Wallet} tone={resumo.saldoShare >= 0 ? "primary" : "danger"} delay={120} />
                <StatTile label="A receber" value={brl(resumo.aReceber)} hint="Ainda não pago" icon={AlertTriangle} tone="warning" delay={180} />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <SectionCard className="xl:col-span-2" title="Receitas x Gastos da empresa" subtitle="Somente caixa Share, mês a mês" icon={TrendingUp}>
                  {serieVisivel.length === 0 ? <EmptyState message="Sem dados no período." /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={serieVisivel}>
                        <defs>
                          <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(152 70% 50%)" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="hsl(152 70% 50%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gDes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
                        <Tooltip {...chartTooltip} formatter={(v: number) => brlFull(v)} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Area name="Receita" type="monotone" dataKey="receitaShare" stroke="hsl(152 70% 50%)" strokeWidth={2} fill="url(#gRec)" animationDuration={900} />
                        <Area name="Gastos" type="monotone" dataKey="despesaShare" stroke="hsl(var(--destructive))" strokeWidth={2} fill="url(#gDes)" animationDuration={900} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                <SectionCard title="Onde vai o dinheiro" subtitle="Natureza dos gastos da empresa" icon={Layers}>
                  {porNatureza.length === 0 ? <EmptyState message="Sem gastos no período." /> : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={porNatureza} dataKey="total" nameKey="nome" innerRadius={55} outerRadius={85} paddingAngle={3} animationDuration={900}>
                            {porNatureza.map((n) => <Cell key={n.nome} fill={NAT_TONE[n.nome] || NAT_TONE.Outros} />)}
                          </Pie>
                          <Tooltip {...chartTooltip} formatter={(v: number) => brlFull(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-3 space-y-2">
                        {porNatureza.map((n) => {
                          const totalNat = porNatureza.reduce((t, x) => t + x.total, 0) || 1;
                          return (
                            <div key={n.nome} className="flex items-center justify-between gap-3 text-xs">
                              <span className="flex items-center gap-2 font-medium text-foreground/90">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: NAT_TONE[n.nome] || NAT_TONE.Outros }} />
                                {n.nome}
                                <span className="text-[10px] text-muted-foreground">
                                  {((n.total / totalNat) * 100).toFixed(0)}%
                                </span>
                              </span>
                              <span className="font-semibold text-foreground">{brl(n.total)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatTile label="Custos dos clientes" value={brl(resumo.despesaCliente)} hint="Rateios e despesas" icon={TrendingDown} tone="neutral" />
                <StatTile label="Reembolsos pagos" value={brl(resumo.reembolsos)} hint="Devolvidos pela Share" icon={Undo2} tone="warning" />
              </div>
            </TabsContent>

            {/* ---------------- EMPRESA ---------------- */}
            <TabsContent value="empresa" className="space-y-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Pessoal / salários" value={brl(equilibrio.pessoal)} hint="Folha, benefícios, 13º" icon={Users} tone="primary" />
                  <StatTile label="Contas fixas" value={brl(equilibrio.contasFixas)} hint={`${brl(equilibrio.contasFixas / Math.max(1, equilibrio.mesesComFixo))} / mês lançado`} icon={Building2} tone="neutral" delay={60} />
                <StatTile label="Contas variáveis" value={brl(equilibrio.contasVariaveis)} hint={`${brl(equilibrio.variavelMensal)} / mês`} icon={TrendingDown} tone="warning" delay={120} />
                <StatTile label="Resultado do caixa" value={brl(resumo.saldoShare)} hint={resumo.saldoShare >= 0 ? "Caixa positivo" : "Caixa negativo"} icon={Wallet} tone={resumo.saldoShare >= 0 ? "success" : "danger"} delay={180} />
              </div>

              {equilibrio.particulares > 0 && (
                <GlassCard className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Despesas particulares pagas pelo caixa da Share (não entram no cálculo de custo da empresa)
                  </p>
                  <p className="text-lg font-bold" style={{ color: NAT_TONE["Particulares Fixo"] }}>{brl(equilibrio.particulares)}</p>
                </GlassCard>
              )}


              <SectionCard title="Gastos internos por categoria" subtitle="Somente despesas do caixa da empresa" icon={Building2}>
                {categorias.share.length === 0 ? <EmptyState message="Nenhum gasto interno no período." /> : (
                  <div className="space-y-3">
                    {categorias.share.slice(0, 12).map((c) => (
                      <div key={c.nome} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-muted-foreground">{c.nome} <span className="text-[10px] opacity-70">({c.qtd})</span></span>
                          <span className="shrink-0 font-semibold text-foreground">{brl(c.total)}</span>
                        </div>
                        <MiniBar value={c.total} max={categorias.share[0].total} tone={c.natureza === "Folha de Pagamento" ? "primary" : c.natureza === "Despesas Empresa Fixo" ? "neutral" : "warning"} />
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Resultado mensal do caixa" subtitle="Receita menos gastos, mês a mês" icon={Wallet}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={serieVisivel}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
                    <Tooltip {...chartTooltip} formatter={(v: number) => brlFull(v)} />
                    <Bar dataKey="resultado" name="Resultado" radius={[6, 6, 0, 0]} animationDuration={800}>
                      {serieVisivel.map((r) => (
                        <Cell key={r.mes} fill={r.resultado >= 0 ? "hsl(152 70% 50%)" : "hsl(var(--destructive))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>
            </TabsContent>

            {/* ---------------- CLIENTES ---------------- */}
            <TabsContent value="clientes" className="space-y-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile label="Clientes ativos no período" value={String(porCliente.length)} icon={Users} tone="primary" />
                <StatTile label="Total pendente" value={brl(porCliente.reduce((t, c) => t + c.pendente, 0))} icon={AlertTriangle} tone="warning" delay={60} />
                <StatTile label="Reembolsos a clientes" value={brl(porCliente.reduce((t, c) => t + c.reembolso, 0))} icon={Undo2} tone="neutral" delay={120} />
              </div>

              <SectionCard
                title="Lucro por cliente"
                subtitle="Receita recebida menos custos pagos"
                icon={TrendingUp}
                action={
                  <Input
                    placeholder="Buscar cliente..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="h-9 w-full max-w-[220px] rounded-lg"
                  />
                }
              >
                {clientesFiltrados.length === 0 ? <EmptyState message="Nenhum cliente encontrado." /> : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={clientesFiltrados.slice(0, 10).map((c) => ({ nome: c.nome.slice(0, 12), lucro: c.lucro }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact} width={48} />
                        <Tooltip {...chartTooltip} formatter={(v: number) => brlFull(v)} />
                        <Bar dataKey="lucro" name="Lucro" radius={[6, 6, 0, 0]} animationDuration={800}>
                          {clientesFiltrados.slice(0, 10).map((c) => (
                            <Cell key={c.id} fill={c.lucro >= 0 ? "hsl(152 70% 50%)" : "hsl(var(--destructive))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="mt-4 -mx-4 overflow-x-auto sm:-mx-5">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-y border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                            <th className="px-4 py-2.5">Cliente</th>
                            <th className="px-4 py-2.5 text-right">Receita</th>
                            <th className="px-4 py-2.5 text-right">Custo</th>
                            <th className="px-4 py-2.5 text-right">Pendente</th>
                            <th className="px-4 py-2.5 text-right">Lucro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientesFiltrados.map((c) => (
                            <tr key={c.id} className="border-b border-border/40 transition-colors hover:bg-primary/5">
                              <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-foreground">{c.nome}</td>
                              <td className="px-4 py-2.5 text-right text-emerald-400">{brl(c.receita)}</td>
                              <td className="px-4 py-2.5 text-right text-destructive">{brl(c.custo)}</td>
                              <td className="px-4 py-2.5 text-right text-amber-400">{brl(c.pendente)}</td>
                              <td className={`px-4 py-2.5 text-right font-semibold ${c.lucro >= 0 ? "text-emerald-400" : "text-destructive"}`}>{brl(c.lucro)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </SectionCard>
            </TabsContent>

            {/* ---------------- CATEGORIAS ---------------- */}
            <TabsContent value="categorias" className="space-y-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard title="Custos da empresa (Share)" subtitle="Gastos internos por categoria" icon={Building2}>
                  {categorias.share.length === 0 ? <EmptyState message="Sem dados." /> : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart layout="vertical" data={categorias.share.slice(0, 10)} margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={compact} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="nome" width={130} stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip {...chartTooltip} formatter={(v: number) => brlFull(v)} />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} animationDuration={800} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                <SectionCard title="Custos dos clientes" subtitle="Gastos rateados no caixa cliente" icon={Users}>
                  {categorias.cliente.length === 0 ? <EmptyState message="Sem dados." /> : (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart layout="vertical" data={categorias.cliente.slice(0, 10)} margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={compact} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="nome" width={130} stroke="hsl(var(--muted-foreground))" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip {...chartTooltip} formatter={(v: number) => brlFull(v)} />
                        <Bar dataKey="total" fill="hsl(38 92% 58%)" radius={[0, 6, 6, 0]} animationDuration={800} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>
              </div>

              <DetalhamentoCategoriasGrid movimentacoes={share} />
            </TabsContent>

            {/* ---------------- EQUILÍBRIO ---------------- */}
            <TabsContent value="equilibrio" className="space-y-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Custos fixos / mês" value={brl(equilibrio.fixoMensal)} hint="Fixos + pessoal" icon={Building2} tone="neutral" />
                <StatTile label="Custos variáveis / mês" value={brl(equilibrio.variavelMensal)} hint="Voo, combustível, extras" icon={TrendingDown} tone="warning" delay={60} />
                <StatTile label="Margem de contribuição" value={`${equilibrio.margemContribuicao.toFixed(1)}%`} hint="Sobra após custos variáveis" icon={PieIcon} tone="primary" delay={120} />
                <StatTile label="Receita média / mês" value={brl(equilibrio.receitaMensal)} hint={`${equilibrio.mesesNoPeriodo} mês(es) analisados`} icon={TrendingUp} tone="success" delay={180} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <GlassCard className="animate-fade-in p-5 lg:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ponto de equilíbrio dinâmico</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quanto a Share precisa faturar apenas para pagar todos os custos — nem lucro, nem prejuízo.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                      <p className="text-[11px] uppercase text-muted-foreground">Por mês</p>
                      <p className="mt-1 text-2xl font-bold text-primary">{brl(equilibrio.breakevenMes)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                      <p className="text-[11px] uppercase text-muted-foreground">Por dia corrido</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{brl(equilibrio.breakevenDia)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                      <p className="text-[11px] uppercase text-muted-foreground">Por dia útil</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{brl(equilibrio.breakevenDiaUtil)}</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Cobertura atual do ponto de equilíbrio</span>
                      <span className={`font-semibold ${equilibrio.cobertura >= 100 ? "text-emerald-400" : "text-amber-400"}`}>
                        {equilibrio.cobertura.toFixed(0)}%
                      </span>
                    </div>
                    <MiniBar value={Math.min(equilibrio.cobertura, 100)} max={100} tone={equilibrio.cobertura >= 100 ? "success" : "warning"} />
                    <p className="text-xs text-muted-foreground">
                      {equilibrio.folgaMensal >= 0
                        ? `A empresa está faturando ${brl(equilibrio.folgaMensal)} acima do necessário por mês.`
                        : `Faltam ${brl(Math.abs(equilibrio.folgaMensal))} por mês para cobrir os custos.`}
                    </p>
                  </div>
                </GlassCard>

                <SectionCard title="Composição do custo fixo" subtitle="Base do cálculo" icon={Layers}>
                  <div className="space-y-3 text-sm">
                    <Linha label="Pessoal e salários" value={equilibrio.pessoal} />
                    <Linha label="Contas fixas" value={equilibrio.contasFixas} />
                    <Linha label="Folha cadastrada (referência)" value={equilibrio.folha} muted />
                    <div className="border-t border-border/50 pt-3">
                      <Linha label="Custo fixo mensal usado" value={equilibrio.fixoMensal} strong />
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <SectionCard
                  title="Contas fixas do caixa Share"
                  subtitle={`Recorrentes — média de ${brl(equilibrio.fixoMensal)} por mês`}
                  icon={Building2}
                >
                  {equilibrio.listaFixos.length === 0 ? (
                    <EmptyState message="Nenhuma conta fixa no período." />
                  ) : (
                    <div className="space-y-3">
                      {equilibrio.listaFixos.slice(0, 12).map((c) => (
                        <div key={c.nome} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate text-muted-foreground">{c.nome}</span>
                            <span className="shrink-0 font-semibold text-foreground">
                              {brl(c.total)} <span className="text-[10px] text-muted-foreground">({brl(c.mensal)}/mês)</span>
                            </span>
                          </div>
                          <MiniBar value={c.total} max={equilibrio.listaFixos[0].total} tone="primary" />
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Contas variáveis do caixa Share"
                  subtitle={`Oscilam com a operação — média de ${brl(equilibrio.variavelMensal)} por mês`}
                  icon={TrendingDown}
                >
                  {equilibrio.listaVariaveis.length === 0 ? (
                    <EmptyState message="Nenhuma conta variável no período." />
                  ) : (
                    <div className="space-y-3">
                      {equilibrio.listaVariaveis.slice(0, 12).map((c) => (
                        <div key={c.nome} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="truncate text-muted-foreground">{c.nome}</span>
                            <span className="shrink-0 font-semibold text-foreground">
                              {brl(c.total)} <span className="text-[10px] text-muted-foreground">({brl(c.mensal)}/mês)</span>
                            </span>
                          </div>
                          <MiniBar value={c.total} max={equilibrio.listaVariaveis[0].total} tone="warning" />
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            </TabsContent>


            {/* ---------------- PROJEÇÃO ---------------- */}
            <TabsContent value="projecao" className="space-y-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Receita média mensal" value={brl(projecao.mediaReceita)} icon={TrendingUp} tone="success" />
                <StatTile label="Gasto médio mensal" value={brl(projecao.mediaDespesa)} icon={TrendingDown} tone="danger" delay={60} />
                <StatTile label="Meses restantes" value={String(projecao.mesesRestantes)} hint={`Até dez/${ano}`} icon={LineIcon} tone="neutral" delay={120} />
                <StatTile
                  label={`Resultado projetado ${ano}`}
                  value={brl(projecao.resultadoAnual)}
                  hint={projecao.resultadoAnual >= 0 ? "Fecha no azul" : "Fecha no vermelho"}
                  icon={Target}
                  tone={projecao.resultadoAnual >= 0 ? "success" : "danger"}
                  delay={180}
                />
              </div>

              <SectionCard
                title="Meta financeira do caixa Share"
                subtitle={`Resultado que a Share quer fechar em ${ano}`}
                icon={Target}
                action={
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="Ex: 250000"
                      value={metaInput}
                      onChange={(e) => setMetaInput(e.target.value)}
                      className="h-9 w-[160px] rounded-lg"
                    />
                    <Button
                      size="sm"
                      className="h-9 rounded-lg"
                      disabled={salvarMeta.isPending}
                      onClick={() => salvarMeta.mutate(Number(metaInput) || 0)}
                    >
                      {salvarMeta.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar meta"}
                    </Button>
                  </div>
                }
              >
                {projecao.meta <= 0 ? (
                  <EmptyState message="Defina uma meta de resultado para acompanhar o fechamento do ano." />
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                        <p className="text-[11px] uppercase text-muted-foreground">Meta {ano}</p>
                        <p className="mt-1 text-xl font-bold text-primary">{brl(projecao.meta)}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                        <p className="text-[11px] uppercase text-muted-foreground">Realizado até agora</p>
                        <p className={`mt-1 text-xl font-bold ${projecao.resultadoRealizado >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                          {brl(projecao.resultadoRealizado)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
                        <p className="text-[11px] uppercase text-muted-foreground">Falta para a meta</p>
                        <p className="mt-1 text-xl font-bold text-foreground">{brl(Math.max(0, projecao.faltaParaMeta))}</p>
                      </div>
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                        <p className="text-[11px] uppercase text-muted-foreground">Resultado necessário / mês</p>
                        <p className="mt-1 text-xl font-bold text-amber-400">{brl(Math.max(0, projecao.necessarioPorMes))}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {projecao.mesesRestantes > 0 ? `${projecao.mesesRestantes} mês(es) restantes` : "Ano encerrado"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progresso da meta</span>
                        <span className={`font-semibold ${projecao.progressoMeta >= 100 ? "text-emerald-400" : "text-amber-400"}`}>
                          {projecao.progressoMeta.toFixed(0)}%
                        </span>
                      </div>
                      <MiniBar
                        value={Math.min(Math.max(projecao.progressoMeta, 0), 100)}
                        max={100}
                        tone={projecao.progressoMeta >= 100 ? "success" : "warning"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {projecao.gapProjecao >= 0
                          ? `No ritmo atual a meta é superada em ${brl(projecao.gapProjecao)}.`
                          : `No ritmo atual faltarão ${brl(Math.abs(projecao.gapProjecao))} para bater a meta — é preciso aumentar o resultado em ${brl(
                              projecao.mesesRestantes > 0 ? Math.abs(projecao.gapProjecao) / projecao.mesesRestantes : Math.abs(projecao.gapProjecao)
                            )} por mês.`}
                      </p>
                    </div>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Perspectiva até o fim do ano" subtitle="Saldo acumulado — realizado, projetado e meta" icon={LineIcon}>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={projecao.linha}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact} width={52} />
                    <Tooltip {...chartTooltip} formatter={(v: number) => brlFull(v)} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "hsl(var(--foreground))" }} />
                    <Line name="Realizado" type="monotone" dataKey="realizado" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} animationDuration={900} />
                    <Line name="Projetado" type="monotone" dataKey="projetado" stroke="hsl(38 95% 60%)" strokeWidth={2} strokeDasharray="6 5" dot={false} animationDuration={900} />
                    {projecao.meta > 0 && (
                      <Line name="Meta" type="monotone" dataKey="meta" stroke="hsl(152 70% 50%)" strokeWidth={2} strokeDasharray="3 4" dot={false} animationDuration={900} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
                <p className="mt-3 text-xs text-muted-foreground">
                  Mantendo a média atual, a Share deve encerrar {ano} com receita de {brl(projecao.receitaAnual)}, gastos de{" "}
                  {brl(projecao.despesaAnual)} e resultado de {brl(projecao.resultadoAnual)}.
                </p>
              </SectionCard>
            </TabsContent>

          </Tabs>
        )}
      </div>
    </Layout>
  );
}

function Linha({ label, value, strong, muted }: { label: string; value: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={muted ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground"}>{label}</span>
      <span className={strong ? "text-base font-bold text-primary" : "text-sm font-semibold text-foreground"}>{brl(value)}</span>
    </div>
  );
}