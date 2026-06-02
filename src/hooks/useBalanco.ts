import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Socio {
  id: string;
  clienteId: string;
  nome: string;
  cpf: string | null;
  percentual: number;
  indice: number;
}

export interface Abastecimento {
  id: string;
  data: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  status: 'pendente' | 'pago';
  fornecedor?: string;
}

export interface SocioBalanco extends Socio {
  valorTotal: number;
  despesasPagas: number;
  despesasPendentes: number;
  aguardandoReembolso: number;
  saldoDevedor: number;
  quantidadeDespesas: number;
  abastecimentosPendentes: number;
  abastecimentosPagos: number;
  valorAbastecimentosPendentes: number;
  valorAbastecimentosPagos: number;
}

export interface ClienteComSocios {
  id: string;
  razao_social: string | null;
  proprietario: string | null;
  cnpj: string | null;
  socios: Socio[];
  temMultiplosSocios: boolean;
}

export function calcularAbastecimentos(
  abastecimentos: any[],
  fator: number = 1,
  socioIndice?: number
) {
  let pendentesCount = 0;
  let pagosCount = 0;
  let totalPendentes = 0;
  let totalPagos = 0;

  for (const a of abastecimentos) {
    const status = a.status || a.status_pagamento || 'pendente';
    const valor = Number(a.valor_total || 0);
    const partnerIdx = a.partner_index || a.partner || a.socio_indice || null;

    if (partnerIdx != null) {
      if (socioIndice != null && Number(partnerIdx) === Number(socioIndice)) {
        if (status === 'pendente') {
          pendentesCount += 1;
          totalPendentes += valor;
        } else if (status === 'pago') {
          pagosCount += 1;
          totalPagos += valor;
        }
      }
    } else {
      if (status === 'pendente') {
        pendentesCount += 1;
        totalPendentes += valor * fator;
      } else if (status === 'pago') {
        pagosCount += 1;
        totalPagos += valor * fator;
      }
    }
  }

  return {
    abastecimentosPendentes: pendentesCount,
    abastecimentosPagos: pagosCount,
    valorAbastecimentosPendentes: totalPendentes,
    valorAbastecimentosPagos: totalPagos,
  };
}

export function calcularBalancoSocio(
  socio: Socio,
  despesas: any[],
  abastecimentos: any[] = []
): SocioBalanco {
  const fator = socio.percentual / 100;

  const pendentes = despesas.filter((d) => d.status === "pendente");
  const pagos = despesas.filter((d) => ["pago", "conciliado"].includes(d.status));
  const aguardando = despesas.filter((d) => d.status === "aguardando_reembolso");
  const reembolsados = despesas.filter((d) => d.status === "reembolsado");

  const totalPendentes = pendentes.reduce((sum, d) => sum + (d.valor || 0), 0);
  const totalPagos = pagos.reduce((sum, d) => sum + (d.valor || 0), 0);
  const totalAguardando = aguardando.reduce(
    (sum, d) => sum + ((d.saldo_pendente || d.valor) || 0),
    0
  );
  const totalReembolsados = reembolsados.reduce(
    (sum, d) => sum + (d.valor_reembolsado || d.valor || 0),
    0
  );
  const totalGeral = despesas.reduce((sum, d) => sum + (d.valor || 0), 0);

  const abastecimentosCalculo = calcularAbastecimentos(abastecimentos, fator, socio.indice);

  return {
    ...socio,
    valorTotal: totalGeral * fator,
    despesasPagas: totalPagos * fator,
    despesasPendentes: totalPendentes * fator,
    aguardandoReembolso: totalAguardando * fator,
    saldoDevedor: (totalPendentes + totalAguardando) * fator,
    quantidadeDespesas: despesas.length,
    ...abastecimentosCalculo,
  };
}

export function useClientesComSocios() {
  return useQuery({
    queryKey: ["clientes-com-socios"],
    queryFn: async () => {
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("id, razao_social, proprietario, cnpj")
        .order("razao_social");

      if (clientesError) throw clientesError;

      const { data: parceirosData, error: parceirosError } = await supabase
        .from("socios")
        .select("id, cliente_id, nome, cpf, percentual_participacao");

      if (parceirosError) throw parceirosError;

      const parceiroPorCliente = new Map<string, typeof parceirosData>();
      (parceirosData || []).forEach((parceiro) => {
        if (!parceiroPorCliente.has(parceiro.cliente_id)) {
          parceiroPorCliente.set(parceiro.cliente_id, []);
        }
        parceiroPorCliente.get(parceiro.cliente_id)!.push(parceiro);
      });

      const clientesComSocios: ClienteComSocios[] = (clientesData || []).map(
        (cliente) => {
          const parceiros = parceiroPorCliente.get(cliente.id) || [];
          const socios: Socio[] = parceiros
            .sort((a, b) => new Date(a.id).getTime() - new Date(b.id).getTime())
            .map((parceiro, indice) => ({
              id: parceiro.id,
              clienteId: cliente.id,
              nome: parceiro.nome,
              cpf: parceiro.cpf,
              percentual:
                parceiro.percentual_participacao ||
                Math.round(10000 / (parceiros.length || 1)) / 100,
              indice: indice + 1,
            }));

          return {
            id: cliente.id,
            razao_social: cliente.razao_social,
            proprietario: cliente.proprietario,
            cnpj: cliente.cnpj,
            socios,
            temMultiplosSocios: socios.length > 1,
          };
        }
      );

      return clientesComSocios;
    },
  });
}

export function useSocioBalanco(
  clienteId: string | undefined,
  socioId: string | undefined,
  aeronaveId: string | undefined,
  periodo: { inicio: string; fim: string }
) {
  const { data: clienteData } = useQuery({
    queryKey: ["cliente-socios-info", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, proprietario, cnpj")
        .eq("id", clienteId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  const { data: parceirosData } = useQuery({
    queryKey: ["cliente-parceiros", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from("socios")
        .select("id, cliente_id, nome, cpf, percentual_participacao")
        .eq("id_clientes", clienteId)
        .order("criado_em");
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  const { data: despesas = [], isLoading: loadingDespesas } = useQuery({
    queryKey: ["despesas-socio", clienteId, aeronaveId, periodo],
    queryFn: async () => {
      if (!clienteId) return [];

      let query = supabase
        .from("conciliacoes_bancarias")
        .select("id, valor, status, saldo_pendente, valor_reembolsado, data")
        .eq("id_clientes", clienteId)
        .gte("data", periodo.inicio)
        .lte("data", periodo.fim);

      if (aeronaveId) {
        query = query.eq("aeronave_id", aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  const { data: abastecimentos = [], isLoading: loadingAbastecimentos } = useQuery({
    queryKey: ["abastecimentos-socio", clienteId, aeronaveId, periodo],
    queryFn: async () => {
      if (!clienteId) return [];
      let query = supabase
        .from("abastecimentos")
        .select("*")
        .eq("id_clientes", clienteId)
        .gte("data", periodo.inicio)
        .lte("data", periodo.fim);

      if (aeronaveId) query = query.eq("aeronave_id", aeronaveId);

      const { data, error } = await query;
      if (error) throw new Error(`Failed to fetch abastecimentos: ${error.message}`);
      return data || [];
    },
    enabled: !!clienteId,
  });

  const socios: Socio[] = (parceirosData || []).map((parceiro, indice) => ({
    id: parceiro.id,
    clienteId: parceiro.cliente_id,
    nome: parceiro.nome,
    cpf: parceiro.cpf,
    percentual:
      parceiro.percentual_participacao ||
      Math.round(10000 / ((parceirosData?.length || 1))) / 100,
    indice: indice + 1,
  }));

  const sociosBalanco: SocioBalanco[] = socios.map((socio) =>
    calcularBalancoSocio(socio, despesas, abastecimentos)
  );

  const socioSelecionado = socioId
    ? sociosBalanco.find((s) => s.id === socioId)
    : undefined;

  return {
    cliente: clienteData,
    socios,
    sociosBalanco,
    socioSelecionado,
    temMultiplosSocios: socios.length > 1,
    despesas,
    abastecimentos,
    isLoading: loadingDespesas || loadingAbastecimentos,
  };
}

// === Cotistas / FinanceiroCotista compatibility helpers =================
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
  pago_por: string;
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

      let pagouEsteCotista = false;
      if (d.pago_por_tipo === "CLIENTE" && d.cliente_id === c.id) {
        pagouEsteCotista = true;
      } else if (d.pago_por_tipo === "PARTNER" && d.socio_id === c.id) {
        pagouEsteCotista = true;
      } else if (d.pago_por_tipo === "COMPANY") {
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
              "id_aeronave, id_clientes, socios_id, percentual_sociedade, cliente:clientes(id, razao_social, proprietario), socio:socios_cliente(id, nome)"
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

        const allDespesaIds = [
          ...new Set([
            ...(rats || []).map((r: any) => r.despesa_id).filter(Boolean),
            ...(ratsAllClientes || []).map((r: any) => r.despesa_id).filter(Boolean),
          ]),
        ];

        const movDocMap = new Map<string, any>();
        if (allDespesaIds.length > 0) {
          const { data: movDocs } = await supabase
            .from("movimentacoes")
            .select("id, numero_nf, numero_doc, numero_boleto, numero_recibo")
            .in("id", allDespesaIds);
          (movDocs || []).forEach((m: any) => movDocMap.set(m.id, m));
        }

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

      const despesas: DespesaUnificada[] = (rateios || []).map((r: any) => ({
        id: r.id,
        origem: r.pago_diretamente || r.pago_diretamente ? "direto" : "conciliacao",
        data: r.data_pagamento || r.data_vencimento,
        data_vencimento: r.data_vencimento,
        data_pagamento: r.data_pagamento,
        descricao: r.descricao_despesa || r.fornecedor_nome || "Lançamento",
        categoria: r.categoria_custo,
        valor_total: Number(r.valor_total_despesa) || 0,
        valor_rateado: Number(r.valor_rateado) || 0,
        pago_por: r.pago_por,
        pago_por_tipo: r.pago_por_tipo,
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
      }));

      const rateioPorDespesaMap = new Map<string, any[]>();
      (rateios || []).forEach((r: any) => {
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
              percentual_sociedade: Number(r.percentual_sociedade) || 0,
              valor_rateado: Number(r.valor_rateado) || 0,
              valor_pago_real: Number(r.valor_pago_real) || 0,
              pago_diretamente: !!r.pago_diretamente,
              status: r.status,
            })),
          };
        })
        .sort((a, b) => new Date(b.data_vencimento || 0).getTime() - new Date(a.data_vencimento || 0).getTime());

      const rateioPorDespesaMapTodos = new Map<string, any[]>();
      (rateioDespesasComTodosCotistas || []).forEach((r: any) => {
        const chave = [r.aeronave_id || "", r.data_vencimento || "", (r.descricao_despesa || "").trim().toUpperCase(), String(Number(r.valor_total_despesa) || 0), (r.categoria_custo || "").trim().toUpperCase(), (r.fornecedor_nome || "").trim().toUpperCase()].join("||");
        if (!rateioPorDespesaMapTodos.has(chave)) rateioPorDespesaMapTodos.set(chave, []);
        rateioPorDespesaMapTodos.get(chave)!.push(r);
      });

      const rateioDespesasComTodosCotistasDetalhado = Array.from(rateioPorDespesaMapTodos.entries())
        .map(([, rateiosArray]) => {
          const primeiro = rateiosArray[0];
          const numero_nf = rateiosArray.map((r: any) => r.numero_nf).find(Boolean) || null;
          const numero_doc = rateiosArray.map((r: any) => r.numero_doc).find(Boolean) || null;
          const numero_boleto = rateiosArray.map((r: any) => r.numero_boleto).find(Boolean) || null;
          const numero_recibo = rateiosArray.map((r: any) => r.numero_recibo).find(Boolean) || null;

          const rateioPorClienteMap = new Map<string, any>();
          rateiosArray.forEach((r: any) => {
            const key = r.cliente_id || r.socio_id || r.id;
            if (!rateioPorClienteMap.has(key)) {
              rateioPorClienteMap.set(key, r);
            } else {
              const existing = rateioPorClienteMap.get(key);
              existing.valor_rateado = Number(existing.valor_rateado) + Number(r.valor_rateado);
              existing.valor_pago_real = Number(existing.valor_pago_real) + Number(r.valor_pago_real);
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
