import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DespesaUnificada {
  id: string;
  origem: "conciliacao" | "direto";
  data: string | null;
  descricao: string;
  categoria: string | null;
  valor_total: number;
  pago_por: string;
  status: string | null;
  aeronave_id: string | null;
  cliente_id: string | null;
}

export interface BalancoCotista {
  cotista_id: string;
  cotista_nome: string;
  percentual: number;
  total_pago: number;
  total_devido: number;
  saldo: number;
}

export interface AbastecimentoItem {
  id: string;
  data: string | null;
  trecho: string | null;
  local: string | null;
  litros: number;
  valor_unitario: number;
  valor_total: number;
  status_pagamento: string | null;
  abastecedor: string | null;
  aeronave_id: string | null;
}

export interface RelatorioViagemItem {
  id: string;
  numero_relatorio: string | null;
  rota: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  dias_count: number | null;
  total_valor: number;
  total_clientes: number;
  status: string | null;
  aeronave_id: string | null;
  matricula_aeronave: string | null;
}

/**
 * Lista clientes ATIVOS que são cotistas (em cotistas_aeronave).
 */
export function useClientesCotistas() {
  return useQuery({
    queryKey: ["clientes-cotistas-ativos"],
    queryFn: async () => {
      const { data: vinculos, error } = await supabase
        .from("cotistas_aeronave")
        .select(
          "id_clientes, id_aeronave, percentual_sociedade, aeronave:aeronave(id, matricula, modelo)"
        );
      if (error) throw error;

      const clienteIds = Array.from(
        new Set((vinculos || []).map((v: any) => v.id_clientes).filter(Boolean))
      );
      if (clienteIds.length === 0) return [];

      const { data: clientes, error: clientesError } = await supabase
        .from("clientes")
        .select(
          "id, razao_social, proprietario, cnpj, telefone, email, cidade, uf, url_logo, status, documentos"
        )
        .in("id", clienteIds)
        .eq("status", "ativo");
      if (clientesError) throw clientesError;

      return (clientes || []).map((c: any) => ({
        ...c,
        aeronaves: (vinculos || [])
          .filter((v: any) => v.id_clientes === c.id)
          .map((v: any) => ({
            id_aeronave: v.id_aeronave,
            percentual_sociedade: Number(v.percentual_sociedade) || 0,
            aeronave: v.aeronave,
          })),
      }));
    },
  });
}

/**
 * Detalhe completo de um cliente cotista, incluindo abastecimentos e relatórios.
 */
export function useFinanceiroCotistaDetalhe(clienteId?: string) {
  return useQuery({
    enabled: !!clienteId,
    queryKey: ["financeiro-cotista-detalhe", clienteId],
    queryFn: async () => {
      const { data: cliente, error: cErr } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", clienteId!)
        .maybeSingle();
      if (cErr) throw cErr;

      const { data: minhasAeronaves, error: aErr } = await supabase
        .from("cotistas_aeronave")
        .select(
          "id_aeronave, percentual_sociedade, aeronave:aeronave(id, matricula, modelo, fabricante, ano)"
        )
        .eq("id_clientes", clienteId!);
      if (aErr) throw aErr;

      const aeronaveIds = (minhasAeronaves || [])
        .map((a: any) => a.id_aeronave)
        .filter(Boolean);

      let todosCotistas: any[] = [];
      let conciliacoes: any[] = [];
      let despesasDiretas: any[] = [];
      let abastecimentos: AbastecimentoItem[] = [];
      let relatorios: RelatorioViagemItem[] = [];

      if (aeronaveIds.length > 0) {
        const [
          { data: cotistasData },
          { data: conc },
          { data: diretas },
          { data: abast },
          { data: rels },
        ] = await Promise.all([
          supabase
            .from("cotistas_aeronave")
            .select(
              "id_aeronave, id_clientes, percentual_sociedade, cliente:clientes(id, razao_social, proprietario)"
            )
            .in("id_aeronave", aeronaveIds),
          supabase
            .from("conciliacoes_bancarias")
            .select("*")
            .in("aeronave_id", aeronaveIds)
            .eq("clientes_id", clienteId!),
          supabase
            .from("despesas_cliente_direto")
            .select("*")
            .in("aeronave_id", aeronaveIds)
            .eq("clientes_id", clienteId!),
          supabase
            .from("abastecimentos")
            .select(
              "id, data, trecho, local, litros, valor_unitario, valor_total, status_pagamento, abastecedor, aeronave_id"
            )
            .in("aeronave_id", aeronaveIds)
            .eq("id_clientes", clienteId!)
            .order("data", { ascending: false }),
          supabase
            .from("travel_expense_reports")
            .select(
              "id, numero_relatorio, rota, data_inicio, data_fim, dias_count, total_valor, total_clientes, status, aeronave_id, matricula_aeronave"
            )
            .in("aeronave_id", aeronaveIds)
            .eq("clientes_id", clienteId!)
            .order("data_inicio", { ascending: false }),
        ]);

        todosCotistas = cotistasData || [];
        conciliacoes = conc || [];
        despesasDiretas = diretas || [];
        abastecimentos = (abast || []).map((a: any) => ({
          ...a,
          litros: Number(a.litros) || 0,
          valor_unitario: Number(a.valor_unitario) || 0,
          valor_total: Number(a.valor_total) || 0,
        }));
        relatorios = (rels || []).map((r: any) => ({
          ...r,
          total_valor: Number(r.total_valor) || 0,
          total_clientes: Number(r.total_clientes) || 0,
        }));
      }

      const despesas: DespesaUnificada[] = [
        ...conciliacoes.map((c: any) => ({
          id: `conc-${c.id}`,
          origem: "conciliacao" as const,
          data: c.data,
          descricao: c.descricao || c.fornecedor_nome || "Lançamento",
          categoria: c.categoria || c.tipo,
          valor_total: Number(c.valor) || 0,
          pago_por: "Share Brasil",
          status: c.status,
          aeronave_id: c.aeronave_id,
          cliente_id: c.clientes_id,
        })),
        ...despesasDiretas.map((d: any) => ({
          id: `dir-${d.id}`,
          origem: "direto" as const,
          data: d.data_envio || d.data_vencimento,
          descricao: d.descricao || d.fornecedor_nome || "Despesa direta",
          categoria: d.categoria_nome,
          valor_total: Number(d.valor) || 0,
          pago_por: d.fornecedor_nome || "Fornecedor",
          status: d.status,
          aeronave_id: d.aeronave_id,
          cliente_id: d.clientes_id,
        })),
      ];

      return {
        cliente,
        aeronaves: minhasAeronaves || [],
        cotistasPorAeronave: todosCotistas,
        despesas,
        abastecimentos,
        relatorios,
      };
    },
  });
}

export function calcularBalanco(
  despesasDaAeronave: DespesaUnificada[],
  cotistas: { id: string; nome: string; percentual: number }[]
): BalancoCotista[] {
  const map = new Map<string, BalancoCotista>();
  cotistas.forEach((c) => {
    map.set(c.id, {
      cotista_id: c.id,
      cotista_nome: c.nome,
      percentual: c.percentual,
      total_pago: 0,
      total_devido: 0,
      saldo: 0,
    });
  });

  despesasDaAeronave.forEach((d) => {
    cotistas.forEach((c) => {
      const item = map.get(c.id)!;
      item.total_devido += d.valor_total * (c.percentual / 100);
      if (
        d.origem === "direto" &&
        d.pago_por &&
        c.nome &&
        d.pago_por.toUpperCase().includes(c.nome.toUpperCase().split(" ")[0])
      ) {
        item.total_pago += d.valor_total;
      }
    });
  });

  return Array.from(map.values()).map((b) => ({
    ...b,
    saldo: b.total_pago - b.total_devido,
  }));
}
