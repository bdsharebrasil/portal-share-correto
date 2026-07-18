import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Agora o "grupo" vem de expense_configu.expense_type (texto livre no banco),
// então não é mais um union type fixo — é string, com uma ordem de exibição
// preferencial para os grupos conhecidos.
export type CategoriaGrupo = string;

const ORDEM_PREFERENCIAL = [
  "CUSTOS FIXOS",
  "ADM & TRIPULAÇÃO",
  "PESSOAL & TRIPULAÇÃO",
  "MANUTENÇÃO",
  "CUSTOS VARIÁVEIS",
];

const SEM_CATEGORIA = "SEM CATEGORIA";

export interface MatrizLancamento {
  id: string;
  data: string;
  descricao: string;
  categoria: string | null; // expense_type resolvido, para exibição
  fornecedor: string | null;
  documento: string | null;
  valor: number;
  mes: number;
}

export interface MatrizLinha {
  grupo: CategoriaGrupo;
  subcategoria: string;
  meses: number[]; // length 12
  totalYTD: number;
  lancamentos: MatrizLancamento[];
}

export interface MatrizFinanceiraData {
  linhas: MatrizLinha[];
  grupos: CategoriaGrupo[]; // ordem de exibição dos grupos presentes nos dados
  totaisMes: number[]; // length 12
  totaisGrupoMes: Record<CategoriaGrupo, number[]>;
  totalGeralYTD: number;
  horasPorCotista: Record<string, number>;
  horasTotais: number;
  horasMesPorCotista: Record<string, number[]>;
  horasMesTotais: number[];
}

const toTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|\s|\/)([a-zà-ú])/g, (_m, p1, p2) => p1 + p2.toUpperCase());

// Monta grupo + subcategoria a partir do registro embutido de expense_configu.
// subcategoria_1 é o nível principal; subcategoria_2, se existir, é anexado
// como refinamento (ex: "Combustível / Jet A1").
function classificar(expenseConfig: {
  expense_type: string | null;
  subcategoria_1: string | null;
  subcategoria_2: string | null;
} | null): { grupo: CategoriaGrupo; sub: string; expenseType: string | null } {
  if (!expenseConfig || !expenseConfig.expense_type) {
    return { grupo: SEM_CATEGORIA, sub: "Sem Categoria", expenseType: null };
  }

  const grupo = expenseConfig.expense_type.trim().toUpperCase();

  let sub: string;
  if (expenseConfig.subcategoria_1 && expenseConfig.subcategoria_2) {
    sub = `${toTitle(expenseConfig.subcategoria_1)} / ${toTitle(expenseConfig.subcategoria_2)}`;
  } else if (expenseConfig.subcategoria_1) {
    sub = toTitle(expenseConfig.subcategoria_1);
  } else if (expenseConfig.subcategoria_2) {
    sub = toTitle(expenseConfig.subcategoria_2);
  } else {
    sub = toTitle(expenseConfig.expense_type);
  }

  return { grupo, sub, expenseType: expenseConfig.expense_type };
}

function ordenarGrupos(gruposPresentes: Set<string>): string[] {
  const ordenados: string[] = [];
  for (const g of ORDEM_PREFERENCIAL) {
    if (gruposPresentes.has(g)) ordenados.push(g);
  }
  const restantes = Array.from(gruposPresentes)
    .filter((g) => !ordenados.includes(g) && g !== SEM_CATEGORIA)
    .sort((a, b) => a.localeCompare(b));
  ordenados.push(...restantes);
  if (gruposPresentes.has(SEM_CATEGORIA)) ordenados.push(SEM_CATEGORIA);
  return ordenados;
}

export function useMatrizFinanceira(
  aeronaveId: string | undefined,
  ano: number,
  categoriaFiltro?: string,
) {
  return useQuery<MatrizFinanceiraData>({
    queryKey: ["matriz-financeira", aeronaveId, ano, categoriaFiltro],
    enabled: !!aeronaveId,
    queryFn: async () => {
      const inicio = `${ano}-01-01`;
      const fim = `${ano}-12-31`;

      const [despesasRes, voosRes] = await Promise.all([
        supabase
          .from("rateio_despesas")
          .select(
            `id, despesa_id, categoria_custo, tipo_rateio, valor_total_despesa,
             data_pagamento, data_vencimento, descricao_despesa, aeronave_id,
             cliente_id, socio_id, fluxo, fornecedor_nome, numero_doc, numero_nf,
             expense_configu:categoria_custo ( expense_type, subcategoria_1, subcategoria_2 )`,
          )
          .eq("aeronave_id", aeronaveId as string),
        supabase
          .from("lancamentos_diario_bordo")
          .select(
            "clientes_id, socios_id, tempo_total, data_registro, aeronave_id",
          )
          .eq("aeronave_id", aeronaveId as string)
          .gte("data_registro", inicio)
          .lte("data_registro", fim),
      ]);

      const despesas = (despesasRes.data as any[]) || [];
      const voos = (voosRes.data as any[]) || [];

      // Agrupar despesas únicas (uma linha = 1 despesa real, não rateios)
      const vistos = new Set<string>();
      const linhasMap = new Map<string, MatrizLinha>();
      const gruposPresentes = new Set<string>();

      for (const d of despesas) {
        // Descarta linhas duplicadas por rateio (mesma despesa em vários cotistas)
        const chaveDespesa = `${d.data_vencimento || ""}|${d.descricao_despesa || ""}|${d.valor_total_despesa || 0}|${d.categoria_custo || ""}`;
        if (vistos.has(chaveDespesa)) continue;
        vistos.add(chaveDespesa);

        const dataRef = d.data_pagamento || d.data_vencimento;
        if (!dataRef) continue;
        const dt = new Date(dataRef);
        if (dt.getFullYear() !== ano) continue;
        if ((d.fluxo || "").toUpperCase() === "ENTRADA") continue;

        const expenseConfig = d.expense_configu || null;
        const { grupo, sub, expenseType } = classificar(expenseConfig);

        // Filtro por categoria: compara contra o expense_type/subcategorias resolvidos,
        // já que categoria_custo agora é um uuid e não pode ser comparado como texto.
        if (categoriaFiltro) {
          const normalizedFilter = categoriaFiltro.trim().toUpperCase();
          const tipoMatch = (expenseType || "").toUpperCase().includes(normalizedFilter);
          const subMatch = sub.toUpperCase().includes(normalizedFilter);
          const descricaoMatch = (d.descricao_despesa || "").trim().toUpperCase().includes(normalizedFilter);
          const tipoRateioMatch = (d.tipo_rateio || "").trim().toUpperCase() === normalizedFilter;

          if (!tipoMatch && !subMatch && !descricaoMatch && !tipoRateioMatch) continue;
        }

        gruposPresentes.add(grupo);

        const key = `${grupo}||${sub}`;
        let linha = linhasMap.get(key);
        if (!linha) {
          linha = {
            grupo,
            subcategoria: sub,
            meses: Array(12).fill(0),
            totalYTD: 0,
            lancamentos: [],
          };
          linhasMap.set(key, linha);
        }
        const v = Number(d.valor_total_despesa) || 0;
        linha.meses[dt.getMonth()] += v;
        linha.totalYTD += v;
        linha.lancamentos.push({
          id: d.id,
          data: dataRef,
          descricao: d.descricao_despesa || "—",
          categoria: expenseType,
          fornecedor: d.fornecedor_nome || null,
          documento: d.numero_nf || d.numero_doc || null,
          valor: v,
          mes: dt.getMonth(),
        });
      }

      const grupos = ordenarGrupos(gruposPresentes);

      const linhas = Array.from(linhasMap.values()).sort((a, b) => {
        const ga = grupos.indexOf(a.grupo);
        const gb = grupos.indexOf(b.grupo);
        if (ga !== gb) return ga - gb;
        return a.subcategoria.localeCompare(b.subcategoria);
      });

      const totaisMes = Array(12).fill(0);
      const totaisGrupoMes: Record<string, number[]> = {};
      for (const g of grupos) totaisGrupoMes[g] = Array(12).fill(0);

      for (const l of linhas) {
        for (let m = 0; m < 12; m++) {
          totaisMes[m] += l.meses[m];
          totaisGrupoMes[l.grupo][m] += l.meses[m];
        }
      }
      const totalGeralYTD = totaisMes.reduce((a, b) => a + b, 0);

      // Horas voadas por cotista
      const horasPorCotista: Record<string, number> = {};
      const horasMesPorCotista: Record<string, number[]> = {};
      const horasMesTotais = Array(12).fill(0);
      let horasTotais = 0;
      for (const v of voos) {
        const id = v.socios_id || v.clientes_id;
        if (!id) continue;
        const t = parseTempo(v.tempo_total);
        if (!t) continue;
        horasPorCotista[id] = (horasPorCotista[id] || 0) + t;
        horasTotais += t;
        if (!horasMesPorCotista[id]) horasMesPorCotista[id] = Array(12).fill(0);
        if (v.data_registro) {
          const m = new Date(v.data_registro).getMonth();
          horasMesPorCotista[id][m] += t;
          horasMesTotais[m] += t;
        }
      }

      return {
        linhas,
        grupos,
        totaisMes,
        totaisGrupoMes,
        totalGeralYTD,
        horasPorCotista,
        horasTotais,
        horasMesPorCotista,
        horasMesTotais,
      };
    },
  });
}

function parseTempo(t: any): number {
  if (t == null) return 0;
  if (typeof t === "number") return t;
  const s = String(t);
  if (s.includes(":")) {
    const [h, m, sec] = s.split(":").map(Number);
    return (h || 0) + (m || 0) / 60 + (sec || 0) / 3600;
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
