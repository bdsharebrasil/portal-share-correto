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

// Mapeia uma despesa para grupo + subcategoria normalizada.
function classificar(
  categoria: string | null,
  periodicidade: string | null,
  descricao: string | null,
): { grupo: CategoriaGrupo; sub: string } | null {
  const cat = (categoria || "").trim().toUpperCase();
  const per = (periodicidade || "").trim().toUpperCase();
  const desc = (descricao || "").trim().toUpperCase();

  // 2) Pessoal & Tripulação
  if (cat.includes("TRIPULA") || cat.includes("ADM")) {
    let sub = "ADM e Pilotagem";
    if (desc.includes("DIÁRIA") || desc.includes("DIARIA")) sub = "Diárias";
    else if (desc.includes("RELAT")) sub = "Relatórios de Viagem";
    return { grupo: "PESSOAL & TRIPULAÇÃO", sub };
  }

  // 3) Manutenção
  if (cat.includes("MANUTEN")) {
    let sub = "M.O Itens Corretivos";
    if (desc.includes("REVIS") || desc.includes("50H") || desc.includes("100H"))
      sub = "Revisão 50h/100h";
    else if (desc.includes("LUBRIF") || desc.includes("ÓLEO") || desc.includes("OLEO"))
      sub = "Lubrificante";
    else if (desc.includes("SOFT") || desc.includes("ATUALIZ"))
      sub = "Softer & Atualizações";
    return { grupo: "MANUTENÇÃO", sub };
  }

  // 1) Custos fixos
  if (per === "FIXO" || per === "MENSAL") {
    let sub = "Hangaragem";
    if (cat.includes("SEGURO") || desc.includes("SEGURO")) sub = "Seguro Casco";
    else if (desc.includes("SOFT") || desc.includes("ATUALIZ"))
      sub = "Softer & Atualizações";
    else if (desc.includes("FISTEL") || cat.includes("FISTEL"))
      sub = "Taxa Fistel";
    else if (cat.includes("HANGAR") || desc.includes("HANGAR"))
      sub = "Hangaragem";
    return { grupo: "CUSTOS FIXOS", sub };
  }

  // 4) Variáveis
  let sub = "Atendimento Hangar";
  if (cat.includes("COMBUST") || desc.includes("ABASTEC")) sub = "Combustíveis";
  else if (desc.includes("DECEA") || desc.includes("INFRAERO"))
    sub = "Taxas DECEA/INFRAERO";
  else if (desc.includes("POUSO") || desc.includes("TARIFA"))
    sub = "Tarifas de Pouso";
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
            "client_id, socios_id, total_time, entry_date, aeronave_id",
          )
          .eq("aeronave_id", aeronaveId as string)
          .gte("entry_date", inicio)
          .lte("entry_date", fim),
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
        const id = v.socios_id || v.client_id;
        if (!id) continue;
        const t = parseTempo(v.total_time);
        if (!t) continue;
        horasPorCotista[id] = (horasPorCotista[id] || 0) + t;
        horasTotais += t;
        if (!horasMesPorCotista[id]) horasMesPorCotista[id] = Array(12).fill(0);
        if (v.entry_date) {
          const m = new Date(v.entry_date).getMonth();
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
