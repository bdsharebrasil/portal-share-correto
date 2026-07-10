import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CategoriaGrupo =
  | "CUSTOS FIXOS"
  | "PESSOAL & TRIPULAÇÃO"
  | "MANUTENÇÃO"
  | "CUSTOS VARIÁVEIS";

export interface MatrizLancamento {
  id: string;
  data: string;
  descricao: string;
  categoria: string | null;
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
  totaisMes: number[]; // length 12
  totaisGrupoMes: Record<CategoriaGrupo, number[]>;
  totalGeralYTD: number;
  horasPorCotista: Record<string, number>;
  horasTotais: number;
  horasMesPorCotista: Record<string, number[]>;
  horasMesTotais: number[];
}

const GRUPOS: CategoriaGrupo[] = [
  "CUSTOS FIXOS",
  "PESSOAL & TRIPULAÇÃO",
  "MANUTENÇÃO",
  "CUSTOS VARIÁVEIS",
];

// Normaliza acentos e caixa para comparação
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

// Formata em "Title Case" simples para exibição da subcategoria
const toTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|\s|\/)([a-zà-ú])/g, (_m, p1, p2) => p1 + p2.toUpperCase());

/**
 * Mapa explícito de categoria_custo -> grupo.
 * A subcategoria exibida é sempre o próprio categoria_custo (formatado).
 * Assim cada linha do banco aparece na sua categoria correta, sem
 * fallback para "Hangaragem".
 */
const CATEGORIA_GRUPO: Array<{ match: (n: string) => boolean; grupo: CategoriaGrupo }> = [
  // PESSOAL & TRIPULAÇÃO
  { match: (n) => n.includes("TRIPULA") || n.includes("ADM") || n.includes("PILOTAGEM") || n.includes("DIARIA"), grupo: "PESSOAL & TRIPULAÇÃO" },
  { match: (n) => n.includes("RELATORIO") || n.includes("DESPESAS DE VIAGEM") || n.includes("DIARIAS"), grupo: "PESSOAL & TRIPULAÇÃO" },

  // MANUTENÇÃO
  { match: (n) => n.includes("MANUTEN") || n.includes("REVISAO") || n.includes("OFICINA") || n.includes("LUBRIF") || n.includes("PECA"), grupo: "MANUTENÇÃO" },

  // CUSTOS FIXOS
  { match: (n) => n.includes("HANGAR") && !n.includes("RAMPA") && !n.includes("DIARIA HANGAR"), grupo: "CUSTOS FIXOS" },
  { match: (n) => n.includes("SEGURO") || n.includes("FISTEL") || n.includes("SOFT") || n.includes("ATUALIZ"), grupo: "CUSTOS FIXOS" },
  { match: (n) => n.includes("DESPESAS BANCARIAS") || n.includes("BANCARIA") || n.includes("ANUIDADE"), grupo: "CUSTOS FIXOS" },
  { match: (n) => n === "DESPESAS AERONAVE" || n.includes("ASSESSORIA") || n.includes("DOCUMENTAC"), grupo: "CUSTOS FIXOS" },

  // CUSTOS VARIÁVEIS
  { match: (n) => n.includes("COMBUST") || n.includes("ABASTEC"), grupo: "CUSTOS VARIÁVEIS" },
  { match: (n) => n.includes("TAXA") || n.includes("DECEA") || n.includes("INFRAERO") || n.includes("POUSO"), grupo: "CUSTOS VARIÁVEIS" },
  { match: (n) => n.includes("RAMPA") || n.includes("DIARIA HANGAR") || n.includes("ATENDIMENTO"), grupo: "CUSTOS VARIÁVEIS" },
];

// Mapeia uma despesa para grupo + subcategoria (subcategoria = categoria_custo real).
function classificar(
  categoria: string | null,
  periodicidade: string | null,
  descricao: string | null,
): { grupo: CategoriaGrupo; sub: string } | null {
  const catRaw = (categoria || "").trim();
  const cat = norm(catRaw);
  const per = norm(periodicidade || "");
  const desc = norm(descricao || "");

  // Subcategoria = a própria categoria_custo (sem inventar "Hangaragem")
  let sub = catRaw ? toTitle(catRaw) : "Sem Categoria";

  // 1) Match explícito pela categoria_custo
  if (cat) {
    for (const rule of CATEGORIA_GRUPO) {
      if (rule.match(cat)) return { grupo: rule.grupo, sub };
    }
  }

  // 2) Sem categoria: usar descrição para tentar classificar
  if (desc) {
    for (const rule of CATEGORIA_GRUPO) {
      if (rule.match(desc)) {
        return { grupo: rule.grupo, sub: catRaw ? toTitle(catRaw) : "Diversos" };
      }
    }
  }

  // 3) Último recurso: usar periodicidade
  if (per === "FIXO" || per === "MENSAL") {
    return { grupo: "CUSTOS FIXOS", sub };
  }
  if (per.includes("VARIAVEL") || per === "EXTRA") {
    return { grupo: "CUSTOS VARIÁVEIS", sub };
  }

  return { grupo: "CUSTOS VARIÁVEIS", sub };
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
            "id, despesa_id, categoria_custo, periodicidade, valor_total_despesa, data_pagamento, data_vencimento, descricao_despesa, aeronave_id, cliente_id, socio_id, fluxo, fornecedor_nome, numero_doc, numero_nf",
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

      for (const d of despesas) {
        // Despreza linhas duplicadas por rateio (mesma despesa em vários cotistas)
        const chaveDespesa = `${d.data_vencimento || ""}|${d.descricao_despesa || ""}|${d.valor_total_despesa || 0}|${d.categoria_custo || ""}`;
        if (vistos.has(chaveDespesa)) continue;
        vistos.add(chaveDespesa);

        const dataRef = d.data_pagamento || d.data_vencimento;
        if (!dataRef) continue;
        const dt = new Date(dataRef);
        if (dt.getFullYear() !== ano) continue;
        if ((d.fluxo || "").toUpperCase() === "ENTRADA") continue;

        const cls = classificar(
          d.categoria_custo,
          d.periodicidade,
          d.descricao_despesa,
        );
        if (!cls) continue;

        // Apply category filter if provided
        if (categoriaFiltro) {
          const normalizedFilter = categoriaFiltro.trim().toUpperCase();
          const categoriaMatch = (d.categoria_custo || "").trim().toUpperCase().includes(normalizedFilter);
          const descricaoMatch = (d.descricao_despesa || "").trim().toUpperCase().includes(normalizedFilter);
          const periodicidadeMatch = (d.periodicidade || "").trim().toUpperCase() === normalizedFilter;

          if (!categoriaMatch && !descricaoMatch && !periodicidadeMatch) continue;
        }

        const key = `${cls.grupo}||${cls.sub}`;
        let linha = linhasMap.get(key);
        if (!linha) {
          linha = {
            grupo: cls.grupo,
            subcategoria: cls.sub,
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
          categoria: d.categoria_custo,
          fornecedor: d.fornecedor_nome || null,
          documento: d.numero_nf || d.numero_doc || null,
          valor: v,
          mes: dt.getMonth(),
        });
      }

      const linhas = Array.from(linhasMap.values()).sort((a, b) => {
        const ga = GRUPOS.indexOf(a.grupo);
        const gb = GRUPOS.indexOf(b.grupo);
        if (ga !== gb) return ga - gb;
        return a.subcategoria.localeCompare(b.subcategoria);
      });

      const totaisMes = Array(12).fill(0);
      const totaisGrupoMes: Record<CategoriaGrupo, number[]> = {
        "CUSTOS FIXOS": Array(12).fill(0),
        "PESSOAL & TRIPULAÇÃO": Array(12).fill(0),
        "MANUTENÇÃO": Array(12).fill(0),
        "CUSTOS VARIÁVEIS": Array(12).fill(0),
      };
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
  // formato HH:MM ou HH:MM:SS
  if (s.includes(":")) {
    const [h, m, sec] = s.split(":").map(Number);
    return (h || 0) + (m || 0) / 60 + (sec || 0) / 3600;
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}
