import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface TransacaoCompleta {
  id: string;
  data: string;
  tipo_movimento: string;
  valor: number;
  descricao: string;
  categoria_id: string;
  grupo_categoria: string | null;
  client_id: string | null;
  client_name: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  status: string | null;
}

export interface CategoriaResumo {
  nome: string;
  total: number;
  quantidade: number;
  percentual: number;
}

export interface ClienteResumo {
  id: string;
  nome: string;
  receitas: number;
  despesas: number;
  saldo: number;
  quantidade: number;
}

export interface ComparacaoMensal {
  mes: string;
  mesLabel: string;
  receitas: number;
  despesas: number;
  resultado: number;
}

export function useRelatorioFinanceiro() {
  const [mesInicio, setMesInicio] = useState(() => format(subMonths(new Date(), 5), "yyyy-MM"));
  const [mesFim, setMesFim] = useState(() => format(new Date(), "yyyy-MM"));
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "entrada" | "saida">("todos");

  const { data: categorias } = useQuery({
    queryKey: ["categorias-completas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_movimentacao")
        .select("id, nome, tipo, grupo_categoria")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["relatorio-financeiro-transacoes", mesInicio, mesFim],
    queryFn: async () => {
      const [yI, mI] = mesInicio.split("-");
      const [yF, mF] = mesFim.split("-");
      const startDate = startOfMonth(new Date(parseInt(yI), parseInt(mI) - 1));
      const endDate = endOfMonth(new Date(parseInt(yF), parseInt(mF) - 1));

      const { data, error } = await supabase
        .from("controle_bancario")
        .select("id, data, tipo_movimento, valor, descricao, categoria_id, grupo_categoria, client_id, client_name, aeronave_id, aeronave_registro, status")
        .gte("data", format(startDate, "yyyy-MM-dd"))
        .lte("data", format(endDate, "yyyy-MM-dd"))
        .order("data", { ascending: false });

      if (error) throw error;
      return (data || []) as TransacaoCompleta[];
    },
  });

  const getCategoriaName = (id: string | null) => {
    if (!id || !categorias) return "Sem Categoria";
    return categorias.find((c) => c.id === id)?.nome || "Sem Categoria";
  };

  const getCategoriaTipo = (id: string | null) => {
    if (!id || !categorias) return null;
    return categorias.find((c) => c.id === id)?.tipo || null;
  };

  const transacoesFiltradas = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t) => {
      if (tipoFiltro !== "todos" && t.tipo_movimento !== tipoFiltro) return false;
      if (categoriasFiltro.length > 0 && !categoriasFiltro.includes(t.categoria_id)) return false;
      return true;
    });
  }, [transacoes, tipoFiltro, categoriasFiltro]);

  // Resumo geral
  const resumoGeral = useMemo(() => {
    const receitas = transacoesFiltradas.filter((t) => t.tipo_movimento === "entrada").reduce((s, t) => s + t.valor, 0);
    const despesas = transacoesFiltradas.filter((t) => t.tipo_movimento === "saida").reduce((s, t) => s + t.valor, 0);
    return { receitas, despesas, resultado: receitas - despesas, totalTransacoes: transacoesFiltradas.length };
  }, [transacoesFiltradas]);

  // Por categoria
  const receitasPorCategoria = useMemo((): CategoriaResumo[] => {
    const map: Record<string, { total: number; quantidade: number }> = {};
    transacoesFiltradas.filter((t) => t.tipo_movimento === "entrada").forEach((t) => {
      const nome = getCategoriaName(t.categoria_id);
      if (!map[nome]) map[nome] = { total: 0, quantidade: 0 };
      map[nome].total += t.valor;
      map[nome].quantidade++;
    });
    const total = Object.values(map).reduce((s, v) => s + v.total, 0);
    return Object.entries(map)
      .map(([nome, v]) => ({ nome, ...v, percentual: total > 0 ? (v.total / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [transacoesFiltradas, categorias]);

  const despesasPorCategoria = useMemo((): CategoriaResumo[] => {
    const map: Record<string, { total: number; quantidade: number }> = {};
    transacoesFiltradas.filter((t) => t.tipo_movimento === "saida").forEach((t) => {
      const nome = getCategoriaName(t.categoria_id);
      if (!map[nome]) map[nome] = { total: 0, quantidade: 0 };
      map[nome].total += t.valor;
      map[nome].quantidade++;
    });
    const total = Object.values(map).reduce((s, v) => s + v.total, 0);
    return Object.entries(map)
      .map(([nome, v]) => ({ nome, ...v, percentual: total > 0 ? (v.total / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [transacoesFiltradas, categorias]);

  // Por grupo de categoria
  const despesasPorGrupo = useMemo(() => {
    const map: Record<string, number> = {};
    transacoesFiltradas.filter((t) => t.tipo_movimento === "saida").forEach((t) => {
      const grupo = t.grupo_categoria || "Outros";
      map[grupo] = (map[grupo] || 0) + t.valor;
    });
    return Object.entries(map).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [transacoesFiltradas]);

  // Por cliente
  const porCliente = useMemo((): ClienteResumo[] => {
    const map: Record<string, ClienteResumo> = {};
    transacoesFiltradas.forEach((t) => {
      const id = t.client_id || "sem-cliente";
      const nome = t.client_name || "Sem Cliente";
      if (!map[id]) map[id] = { id, nome, receitas: 0, despesas: 0, saldo: 0, quantidade: 0 };
      if (t.tipo_movimento === "entrada") map[id].receitas += t.valor;
      else map[id].despesas += t.valor;
      map[id].saldo = map[id].receitas - map[id].despesas;
      map[id].quantidade++;
    });
    return Object.values(map).sort((a, b) => b.saldo - a.saldo);
  }, [transacoesFiltradas]);

  // Comparação mensal
  const comparacaoMensal = useMemo((): ComparacaoMensal[] => {
    if (!transacoes) return [];
    const map: Record<string, { receitas: number; despesas: number }> = {};
    transacoes.forEach((t) => {
      const d = new Date(t.data);
      const key = format(d, "yyyy-MM");
      if (!map[key]) map[key] = { receitas: 0, despesas: 0 };
      if (t.tipo_movimento === "entrada") map[key].receitas += t.valor;
      else map[key].despesas += t.valor;
    });
    return Object.entries(map)
      .map(([mes, v]) => ({
        mes,
        mesLabel: format(new Date(mes + "-01"), "MMM/yy", { locale: ptBR }),
        ...v,
        resultado: v.receitas - v.despesas,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
  }, [transacoes]);

  // Meses disponíveis
  const mesesDisponiveis = useMemo(() => {
    const result = [];
    for (let i = 0; i < 24; i++) {
      const date = subMonths(new Date(), i);
      result.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return result;
  }, []);

  // Categorias únicas presentes nos dados
  const categoriasDisponiveis = useMemo(() => {
    if (!categorias) return [];
    const idsPresentes = new Set(transacoes?.map((t) => t.categoria_id) || []);
    return categorias.filter((c) => idsPresentes.has(c.id));
  }, [categorias, transacoes]);

  return {
    transacoesFiltradas,
    resumoGeral,
    receitasPorCategoria,
    despesasPorCategoria,
    despesasPorGrupo,
    porCliente,
    comparacaoMensal,
    isLoading,
    // Filtros
    mesInicio,
    setMesInicio,
    mesFim,
    setMesFim,
    categoriasFiltro,
    setCategoriasFiltro,
    tipoFiltro,
    setTipoFiltro,
    mesesDisponiveis,
    categoriasDisponiveis,
    getCategoriaName,
  };
}
