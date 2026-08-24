import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FinancePayorType } from "@/lib/financeConstants";

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
  status: string | null;
  abastecedor: string | null;
  abastecedor_id?: string | null;
  aeronave_id: string | null;
  id_clientes?: string | null;
  clientes_nome?: string | null;
  socio_nome?: string | null;
  comanda?: string | null;
  nota_url?: string | null;
  boleto_url?: string | null;
  comprovante_pagamento?: string | null;
  data_pagamento?: string | null;
  nf?: string | null;
  forma_pagamento?: string | null;
  prazo?: string | null;
  banco?: string | null;
  tipo_combustivel?: string | null;
  descricao?: string | null;
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
  socios_id?: string | null;
  nome_tripulante?: string | null;
  observacoes?: string | null;
}

/** Traduz o código bruto de pago_por para um rótulo amigável de gestor. */
function rotularPagador(r: any): { rotulo: string; tipo: string | null } {
  // Usar campo pago_por para determinar o tipo
  const raw = (r.pago_por || "").toString().trim().toUpperCase();
  if (!raw) {
    if (r.pago_diretamente && r.clientes_nome) return { rotulo: r.clientes_nome, tipo: FinancePayorType.CLIENT };
    return { rotulo: "—", tipo: null };
  }
  if (raw === "EMPRESA" || raw === "SHARE" || raw === "SHARE BRASIL")
    return { rotulo: "Share Brasil", tipo: FinancePayorType.COMPANY };
  if (raw === "CLIENTE")
    return { rotulo: "CLIENTE", tipo: FinancePayorType.CLIENT };
  if (raw === "SOCIO" || raw === "SÓCIO")
    return { rotulo: r.socios_nome || "Sócio", tipo: FinancePayorType.PARTNER };
  if (raw.includes("TERCEIRO") || raw.includes("THIRD"))
    return { rotulo: r.pago_por || "Terceiro Custo", tipo: FinancePayorType.THIRD_PARTY };
  // valor já vem como nome próprio do pagador
  return { rotulo: r.pago_por, tipo: FinancePayorType.UNKNOWN };
}

/**
 * Gera chave composta para agrupar despesas que representam o mesmo gasto
 * rateado entre cotistas (que podem ter despesa_ids diferentes).
 */
function chaveAgrupamentoDespesa(r: any): string {
  return [
    r.aeronave_id || "",
    r.data_vencimento || "",
    (r.descricao_despesa || "").trim().toUpperCase(),
    String(Number(r.valor_total_despesa) || 0),
    (r.categoria_custo || "").trim().toUpperCase(),
    (r.fornecedor_nome || "").trim().toUpperCase(),
  ].join("||");
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
          "id, razao_social, proprietario, cnpj, telefone, email, cidade, uf, url_logo, status, documentos, tem_socio"
        )
        .in("id", clienteIds)
        .eq("status", "ativo");
      if (clientesError) throw clientesError;

      return (clientes || []).map((c: any) => {
        const vinculosCliente = (vinculos || []).filter((v: any) => v.id_clientes === c.id);
        // Deduplicate aeronaves by id_aeronave (same aircraft may have multiple partners)
        const aeronavesMap = new Map<string, any>();
        vinculosCliente.forEach((v: any) => {
          if (!aeronavesMap.has(v.id_aeronave)) {
            aeronavesMap.set(v.id_aeronave, {
              id_aeronave: v.id_aeronave,
              percentual_sociedade: Number(v.percentual_sociedade) || 0,
              aeronave: v.aeronave,
            });
          }
        });
        return {
          ...c,
          aeronaves: Array.from(aeronavesMap.values()),
        };
      });
    },
  });
}

/**
 * Detalhe completo de um cliente cotista. Lê diretamente de rateio_despesas
 * e agrupa despesas compartilhadas por chave composta (para exibir uma única
 * linha por despesa com colunas para cada cotista).
 */
export function useFinanceiroCotistaDetalhe(clienteId?: string) {
  const normalizedClienteId = clienteId?.trim();
  return useQuery({
    enabled: !!normalizedClienteId,
    queryKey: ["financeiro-cotista-detalhe", normalizedClienteId],
    queryFn: async () => {
      if (!normalizedClienteId) throw new Error("ID do cliente inválido");
      const { data: cliente, error: cErr } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", normalizedClienteId)
        .maybeSingle();
      if (cErr) throw cErr;

      const { data: minhasAeronavesRaw, error: aErr } = await supabase
        .from("cotistas_aeronave")
        .select(
          "id_aeronave, percentual_sociedade, aeronave:aeronave(id, matricula, modelo, fabricante, ano)"
        )
        .eq("id_clientes", clienteId!);
      if (aErr) throw aErr;
      // Missing error handling was here

      // Deduplicate por id_aeronave (pode haver múltiplos sócios para a mesma aeronave)
      const minhasAeronaves = Array.from(
        new Map(
          (minhasAeronavesRaw || []).map((a: any) => [a.id_aeronave, a])
        ).values()
      );

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
              "id_aeronave, id_clientes, socios_id, percentual_sociedade, cliente:clientes(id, razao_social, proprietario), socio:socios(id, nome)"
            )
            .in("id_aeronave", aeronaveIds),
          (supabase as any)
            .from("rateio_despesas")
            .select(
              "*, cliente:clientes(id, razao_social, proprietario), socio:socios(id, nome)"
            )
            .in("aeronave_id", aeronaveIds)
            .eq("cliente_id", normalizedClienteId)
            .order("data_vencimento", { ascending: false }),
          (supabase as any)
            .from("rateio_despesas")
            .select(
              "*, cliente:clientes(id, razao_social, proprietario), socio:socios(id, nome)"
            )
            .in("aeronave_id", aeronaveIds)
            .order("data_vencimento", { ascending: false }),
          supabase
            .from("abastecimentos")
            .select(
              "id, data, trecho, local, litros, valor_unitario, valor_total, status, abastecedor, abastecedor_id, aeronave_id, id_clientes, socio_nome, comanda, nota_url, boleto_url, comprovante_pagamento, data_pagamento, nf, forma_pagamento, prazo, banco, tipo_combustivel, descricao"
            )
            .in("aeronave_id", aeronaveIds)
            .order("data", { ascending: false }),
          supabase
            .from("travel_expense_reports")
            .select(
              "id, numero_relatorio, rota, data_inicio, data_fim, dias_count, total_valor, total_clientes, status, aeronave_id, matricula_aeronave, socios_id, nome_tripulante, observacoes"
            )
            .in("aeronave_id", aeronaveIds)
            .eq("clientes_id", normalizedClienteId)
            .order("data_inicio", { ascending: false }),
        ]);

        todosCotistas = cotistasData || [];
        // Preencher nomes de cliente/socio vindos das relações, quando disponíveis
        rateios = (rats || []).map((r: any) => ({
          ...r,
          clientes_nome: r.cliente?.razao_social || r.cliente?.proprietario || r.clientes_nome || null,
          socios_nome: r.socio?.nome || r.socios_nome || null,
        }));
        rateioDespesasComTodosCotistas = (ratsAllClientes || []).map((r: any) => ({
          ...r,
          clientes_nome: r.cliente?.razao_social || r.cliente?.proprietario || r.clientes_nome || null,
          socios_nome: r.socio?.nome || r.socios_nome || null,
        }));
        abastecimentos = (abast || []).map((a: any) => {
          // Tentar encontrar o nome do cliente entre os cotistas da aeronave
          let clientes_nome: string | null = null;
          if (a.id_clientes) {
            const cotista = todosCotistas.find((c: any) => c.id_clientes === a.id_clientes);
            if (cotista && cotista.cliente) {
              clientes_nome = cotista.cliente.razao_social || cotista.cliente.proprietario;
            }
          }

          return {
            ...a,
            clientes_nome,
            litros: Number(a.litros) || 0,
            valor_unitario: Number(a.valor_unitario) || 0,
            valor_total: Number(a.valor_total) || 0,
          };
        });
        relatorios = (rels || []).map((r: any) => ({
          ...r,
          total_valor: Number(r.total_valor) || 0,
          total_clientes: Number(r.total_clientes) || 0,
        }));

        // ─── Buscar número de documento das movimentações vinculadas ──────────────
        // O rateio_despesas não armazena numero_nf/numero_doc diretamente;
        // esses campos ficam na tabela movimentacoes referenciada pelo despesa_id.
        const allDespesaIds = [
          ...new Set([
            ...(rats || []).map((r: any) => r.despesa_id).filter(Boolean),
            ...(ratsAllClientes || []).map((r: any) => r.despesa_id).filter(Boolean),
          ]),
        ];

        const movDocMap = new Map<string, any>();
        if (allDespesaIds.length > 0) {
          const { data: movDocs, error: movError } = await supabase
            .from("movimentacoes")
            .select("id, numero_nf, numero_doc, numero_boleto, numero_recibo")
            .in("id", allDespesaIds);
          if (movError) console.warn("Erro ao buscar documentos de movimentações:", movError);
          (movDocs || []).forEach((m: any) => movDocMap.set(m.id, m));
        }
        // ─────────────────────────────────────────────────────────────────────────

        // Enriquecer rateios com dados do movDocMap
        rateios = rateios.map((r: any) => ({
          ...r,
          numero_nf: r.numero_nf || movDocMap.get(r.despesa_id)?.numero_nf || null,
          numero_doc: r.numero_doc || movDocMap.get(r.despesa_id)?.numero_doc || null,
          numero_boleto: r.numero_boleto || movDocMap.get(r.despesa_id)?.numero_boleto || null,
          numero_recibo: r.numero_recibo || movDocMap.get(r.despesa_id)?.numero_recibo || null,
        }));

        rateioDespesasComTodosCotistas = rateioDespesasComTodosCotistas.map((r: any) => ({
          ...r,
          numero_nf: r.numero_nf || movDocMap.get(r.despesa_id)?.numero_nf || null,
          numero_doc: r.numero_doc || movDocMap.get(r.despesa_id)?.numero_doc || null,
          numero_boleto: r.numero_boleto || movDocMap.get(r.despesa_id)?.numero_boleto || null,
          numero_recibo: r.numero_recibo || movDocMap.get(r.despesa_id)?.numero_recibo || null,
        }));
      }

      const despesas: DespesaUnificada[] = rateios.map((r: any) => {
        const { rotulo, tipo } = rotularPagador(r);
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

      // ─── Agregar rateios do cliente (para aba Financeiro) ────────────────────
      const rateioPorDespesaMap = new Map<string, any[]>();
      rateios.forEach((r: any) => {
        const chave = r.despesa_id || r.id;
        if (!rateioPorDespesaMap.has(chave)) rateioPorDespesaMap.set(chave, []);
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
              socio_id: r.socio_id,
              socios_nome: r.socios_nome,
              percentual_sociedade: Number(r.percentual_sociedade) || 0,
              valor_rateado: Number(r.valor_rateado) || 0,
              valor_pago_real: Number(r.valor_pago_real) || 0,
              pago_diretamente: !!r.pago_diretamente,
              status: r.status,
            })),
          };
        })
        .sort(
          (a, b) =>
            new Date(b.data_vencimento || 0).getTime() -
            new Date(a.data_vencimento || 0).getTime()
        );

      // ─── Agregar rateios de TODOS os cotistas (aba Balanço) ─────────────────
      // Agrupa por chave composta para consolidar despesas que têm despesa_ids
      // diferentes mas representam o mesmo gasto rateado entre cotistas.
      const rateioPorDespesaMapTodos = new Map<string, any[]>();
      rateioDespesasComTodosCotistas.forEach((r: any) => {
        const chave = chaveAgrupamentoDespesa(r);
        if (!rateioPorDespesaMapTodos.has(chave)) {
          rateioPorDespesaMapTodos.set(chave, []);
        }
        rateioPorDespesaMapTodos.get(chave)!.push(r);
      });

      const rateioDespesasComTodosCotistasDetalhado = Array.from(
        rateioPorDespesaMapTodos.entries()
      )
        .map(([, rateiosArray]) => {
          const primeiro = rateiosArray[0];

          // Pegar numero_nf/numero_doc de qualquer rateio do grupo que tenha valor
          const numero_nf =
            rateiosArray.map((r: any) => r.numero_nf).find(Boolean) || null;
          const numero_doc =
            rateiosArray.map((r: any) => r.numero_doc).find(Boolean) || null;
          const numero_boleto =
            rateiosArray.map((r: any) => r.numero_boleto).find(Boolean) || null;
          const numero_recibo =
            rateiosArray.map((r: any) => r.numero_recibo).find(Boolean) || null;

          // Deduplica por cliente_id + socio_id (pode haver entradas para o mesmo cotista)
          const rateioPorClienteMap = new Map<string, any>();
          rateiosArray.forEach((r: any) => {
            const key = `${r.cliente_id || ""}|${r.socio_id || ""}`;
            if (!rateioPorClienteMap.has(key)) {
              rateioPorClienteMap.set(key, r);
            } else {
              // Se já existe, somar valores rateados (caso de múltiplas linhas para o mesmo cotista)
              const existing = rateioPorClienteMap.get(key);
              existing.valor_rateado =
                Number(existing.valor_rateado) + Number(r.valor_rateado);
              existing.valor_pago_real =
                Number(existing.valor_pago_real) + Number(r.valor_pago_real);
              // Manter percentual (usar o primeiro que tenha valor ou o último)
              if (!existing.percentual_sociedade && r.percentual_sociedade) {
                existing.percentual_sociedade = r.percentual_sociedade;
              }
            }
          });

          return {
            despesa_id: primeiro.despesa_id || primeiro.id,
            data_vencimento: primeiro.data_vencimento,
            data_pagamento: primeiro.data_pagamento,
            numero_nf,
            numero_doc,
            numero_boleto,
            numero_recibo,
            fornecedor_nome: primeiro.fornecedor_nome,
            descricao_despesa: primeiro.descricao_despesa,
            categoria_custo: primeiro.categoria_custo,
            valor_total_despesa: Number(primeiro.valor_total_despesa) || 0,
            pago_por: primeiro.pago_por,
            status: primeiro.status,
            rateios: Array.from(rateioPorClienteMap.values()).map((r: any) => ({
              cliente_id: r.cliente_id,
              clientes_nome: r.clientes_nome,
              socio_id: r.socio_id,
              socios_nome: r.socios_nome,
              percentual_sociedade: Number(r.percentual_sociedade) || 0,
              valor_rateado: Number(r.valor_rateado) || 0,
              valor_pago_real: Number(r.valor_pago_real) || 0,
              pago_diretamente: !!r.pago_diretamente,
              status: r.status,
            })),
          };
        })
        .sort(
          (a, b) =>
            new Date(b.data_vencimento || 0).getTime() -
            new Date(a.data_vencimento || 0).getTime()
        );

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

      // Usar IDs para determinar quem pagou (mais confiável que nome)
      let pagouEsteCotista = false;
      if (d.pago_por_tipo === FinancePayorType.CLIENT && d.cliente_id === c.id) {
        pagouEsteCotista = true;
      } else if (d.pago_por_tipo === FinancePayorType.PARTNER && d.socio_id === c.id) {
        pagouEsteCotista = true;
      } else if (d.pago_por_tipo === FinancePayorType.COMPANY) {
        // Se empresa pagou, ninguém é creditado (todos devem)
        pagouEsteCotista = false;
      }

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
