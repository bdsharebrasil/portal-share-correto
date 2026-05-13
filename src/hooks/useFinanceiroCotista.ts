import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DespesaUnificada {
  id: string;
  origem: "conciliacao" | "direto";
  data: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  descricao: string;
  categoria: string | null;
  valor_total: number;
  valor_rateado: number;
  /** Rótulo amigável de quem efetivamente pagou (ex: "Share Brasil", nome do sócio, nome do cliente). */
  pago_por: string;
  /** Código bruto do banco: 'EMPRESA' | 'CLIENTE' | 'SOCIO' | etc. */
  pago_por_tipo: string | null;
  pago_diretamente: boolean;
  forma_pagamento: string | null;
  fornecedor: string | null;
  numero_doc: string | null;
  numero_nf: string | null;
  numero_boleto: string | null;
  numero_recibo: string | null;
  status: string | null;
  observacoes: string | null;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  socio_id: string | null;
  socio_nome: string | null;
  comprovante_url: string | null;
  recibo_url: string | null;
  nf_url: string | null;
  boleto_url: string | null;
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

/** Traduz o código bruto de pago_por para um rótulo amigável de gestor. */
function rotularPagador(r: any): { rotulo: string; tipo: string | null } {
  const raw = (r.pago_por || "").toString().trim().toUpperCase();
  if (!raw) {
    if (r.pago_diretamente && r.clientes_nome) return { rotulo: r.clientes_nome, tipo: "CLIENTE" };
    return { rotulo: "—", tipo: null };
  }
  if (raw === "EMPRESA" || raw === "SHARE" || raw === "SHARE BRASIL")
    return { rotulo: "Share Brasil", tipo: "EMPRESA" };
  if (raw === "CLIENTE")
    return { rotulo: r.clientes_nome || "Cliente", tipo: "CLIENTE" };
  if (raw === "SOCIO" || raw === "SÓCIO")
    return { rotulo: r.socios_nome || "Sócio", tipo: "SOCIO" };
  // valor já vem como nome próprio do pagador
  return { rotulo: r.pago_por, tipo: "OUTRO" };
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
 * Detalhe completo de um cliente cotista. Agora lê DIRETAMENTE de rateio_despesas
 * (fonte única e rica) em vez de mesclar conciliacoes_bancarias + despesas_cliente_direto.
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
      let rateios: any[] = [];
      let rateioDespesasComTodosCotistas: any[] = [];
      let abastecimentos: AbastecimentoItem[] = [];
      let relatorios: RelatorioViagemItem[] = [];

      if (aeronaveIds.length > 0) {
        const [
          { data: cotistasData },
          { data: rats },
          { data: ratsAllClientes },
          { data: abast },
          { data: rels },
        ] = await Promise.all([
          supabase
            .from("cotistas_aeronave")
            .select(
              "id_aeronave, id_clientes, percentual_sociedade, cliente:clientes(id, razao_social, proprietario)"
            )
            .in("id_aeronave", aeronaveIds),
          (supabase as any)
            .from("rateio_despesas")
            .select("*")
            .in("aeronave_id", aeronaveIds)
            .eq("cliente_id", clienteId!)
            .order("data_vencimento", { ascending: false }),
          (supabase as any)
            .from("rateio_despesas")
            .select("*")
            .in("aeronave_id", aeronaveIds)
            .order("data_vencimento", { ascending: false }),
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
        rateios = rats || [];
        rateioDespesasComTodosCotistas = ratsAllClientes || [];
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

      const despesas: DespesaUnificada[] = rateios.map((r: any) => {
        const { rotulo, tipo } = rotularPagador(r);
        // Origem: pago direto pelo cliente/sócio = "direto", senão Share pagou = "conciliacao"
        const origem: "conciliacao" | "direto" =
          r.pago_diretamente || tipo === "CLIENTE" || tipo === "SOCIO"
            ? "direto"
            : "conciliacao";
        return {
          id: r.id,
          origem,
          data: r.data_pagamento || r.data_vencimento,
          data_vencimento: r.data_vencimento,
          data_pagamento: r.data_pagamento,
          descricao: r.descricao_despesa || r.fornecedor_nome || "Lançamento",
          categoria: r.categoria_custo,
          valor_total: Number(r.valor_total_despesa) || 0,
          valor_rateado: Number(r.valor_rateado) || 0,
          pago_por: rotulo,
          pago_por_tipo: tipo,
          pago_diretamente: !!r.pago_diretamente,
          forma_pagamento: r.forma_pagamento,
          fornecedor: r.fornecedor_nome,
          numero_doc: r.numero_doc,
          numero_nf: r.numero_nf,
          numero_boleto: r.numero_boleto,
          numero_recibo: r.numero_recibo,
          status: r.status,
          observacoes: r.observacoes,
          aeronave_id: r.aeronave_id,
          aeronave_registro: r.aeronave_registro,
          cliente_id: r.cliente_id,
          cliente_nome: r.clientes_nome,
          socio_id: r.socio_id,
          socio_nome: r.socios_nome,
          comprovante_url: r.comprovante_url,
          recibo_url: r.recibo_url,
          nf_url: r.nf_url,
          boleto_url: r.boleto_url,
        };
      });

      // Agregar rateios por despesa (mostra todos os cotistas para cada despesa)
      const rateioPorDespesaMap = new Map<string, any[]>();
      rateios.forEach((r: any) => {
        const chave = r.despesa_id || r.id;
        if (!rateioPorDespesaMap.has(chave)) {
          rateioPorDespesaMap.set(chave, []);
        }
        rateioPorDespesaMap.get(chave)!.push(r);
      });

      const rateioDespesasDetalhado = Array.from(rateioPorDespesaMap.entries())
        .map(([despesaId, rateiosArray]) => {
          const primeiro = rateiosArray[0];
          return {
            despesa_id: despesaId,
            data_vencimento: primeiro.data_vencimento,
            data_pagamento: primeiro.data_pagamento,
            numero_nf: primeiro.numero_nf,
            numero_doc: primeiro.numero_doc,
            fornecedor_nome: primeiro.fornecedor_nome,
            descricao_despesa: primeiro.descricao_despesa,
            categoria_custo: primeiro.categoria_custo,
            valor_total_despesa: Number(primeiro.valor_total_despesa) || 0,
            pago_por: primeiro.pago_por,
            status: primeiro.status,
            rateios: rateiosArray.map((r: any) => ({
              cliente_id: r.cliente_id,
              clientes_nome: r.clientes_nome,
              percentual_sociedade: Number(r.percentual_sociedade) || 0,
              valor_rateado: Number(r.valor_rateado) || 0,
              valor_pago_real: Number(r.valor_pago_real) || 0,
              pago_diretamente: !!r.pago_diretamente,
              status: r.status,
            })),
          };
        })
        .sort((a, b) => new Date(b.data_vencimento || 0).getTime() - new Date(a.data_vencimento || 0).getTime());

      // Agregar rateios por despesa para TODOS os cotistas (para aba Balanço)
      const rateioPorDespesaMapTodos = new Map<string, any[]>();
      rateioDespesasComTodosCotistas.forEach((r: any) => {
        const chave = r.despesa_id || r.id;
        if (!rateioPorDespesaMapTodos.has(chave)) {
          rateioPorDespesaMapTodos.set(chave, []);
        }
        rateioPorDespesaMapTodos.get(chave)!.push(r);
      });

      const rateioDespesasComTodosCotistasDetalhado = Array.from(rateioPorDespesaMapTodos.entries())
        .map(([despesaId, rateiosArray]) => {
          const primeiro = rateiosArray[0];
          return {
            despesa_id: despesaId,
            data_vencimento: primeiro.data_vencimento,
            data_pagamento: primeiro.data_pagamento,
            numero_nf: primeiro.numero_nf,
            numero_doc: primeiro.numero_doc,
            fornecedor_nome: primeiro.fornecedor_nome,
            descricao_despesa: primeiro.descricao_despesa,
            categoria_custo: primeiro.categoria_custo,
            valor_total_despesa: Number(primeiro.valor_total_despesa) || 0,
            pago_por: primeiro.pago_por,
            status: primeiro.status,
            rateios: rateiosArray.map((r: any) => ({
              cliente_id: r.cliente_id,
              clientes_nome: r.clientes_nome,
              percentual_sociedade: Number(r.percentual_sociedade) || 0,
              valor_rateado: Number(r.valor_rateado) || 0,
              valor_pago_real: Number(r.valor_pago_real) || 0,
              pago_diretamente: !!r.pago_diretamente,
              status: r.status,
            })),
          };
        })
        .sort((a, b) => new Date(b.data_vencimento || 0).getTime() - new Date(a.data_vencimento || 0).getTime());

      return {
        cliente,
        aeronaves: minhasAeronaves || [],
        cotistasPorAeronave: todosCotistas,
        despesas,
        abastecimentos,
        relatorios,
        rateioDespesasDetalhado,
        rateioDespesasComTodosCotistasDetalhado,
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
      // Crédito = pagou diretamente do bolso (CLIENTE ou SOCIO desse cotista)
      const pagouEsteCotista =
        (d.pago_por_tipo === "CLIENTE" && d.cliente_id === c.id) ||
        (d.pago_por_tipo === "SOCIO" && d.socio_id === c.id);
      if (pagouEsteCotista) {
        item.total_pago += d.valor_total;
      }
    });
  });

  return Array.from(map.values()).map((b) => ({
    ...b,
    saldo: b.total_pago - b.total_devido,
  }));
}
