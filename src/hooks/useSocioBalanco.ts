import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Socio {
  id: string; // cliente_id + index (e.g., "uuid-1", "uuid-2", "uuid-3")
  clienteId: string;
  nome: string;
  cpf: string | null;
  percentual: number;
  indice: number; // 1, 2, ou 3
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

/**
 * Hook para buscar clientes com seus sócios individuais
 */
export function useClientesComSocios() {
  return useQuery({
    queryKey: ["clientes-com-socios"],
    queryFn: async () => {
      // Buscar todos os clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("id, razao_social, proprietario, cnpj")
        .order("razao_social");

      if (clientesError) throw clientesError;

      // Buscar todos os parceiros
      const { data: parceirosData, error: parceirosError } = await supabase
        .from("socios")
        .select("id, cliente_id, nome, cpf, percentual_participacao");

      if (parceirosError) throw parceirosError;

      // Agrupar parceiros por cliente
      const parceiroPorCliente = new Map<string, typeof parceirosData>();
      (parceirosData || []).forEach((parceiro) => {
        if (!parceiroPorCliente.has(parceiro.cliente_id)) {
          parceiroPorCliente.set(parceiro.cliente_id, []);
        }
        parceiroPorCliente.get(parceiro.cliente_id)!.push(parceiro);
      });

      // Transformar clientes em estrutura com sócios
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
                Math.round(10000 / (parceiros.length || 1)) / 100, // Dividir igualmente se não especificado
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

/**
 * Calcula abastecimentos por status
 */
export function calcularAbastecimentos(
  abastecimentos: any[],
  fator: number = 1,
  socioIndice?: number
) {
  // Quando fornecido um socioIndice, atribuímos abastecimentos que têm partner_index
  // diretamente ao sócio correspondente. Abastecimentos sem partner_index são
  // tratados como compartilhados e divididos pelo fator.

  let pendentesCount = 0;
  let pagosCount = 0;
  let totalPendentes = 0;
  let totalPagos = 0;

  for (const a of abastecimentos) {
    const status = a.status || a.status_pagamento || 'pendente';
    const valor = Number(a.valor_total || 0);
    const partnerIdx = a.partner_index || a.partner || a.socio_indice || null;

    if (partnerIdx != null) {
      // Abastecimento atribuído a um sócio específico
      if (socioIndice != null && Number(partnerIdx) === Number(socioIndice)) {
        if (status === 'pendente') {
          pendentesCount += 1;
          totalPendentes += valor;
        } else if (status === 'pago') {
          pagosCount += 1;
          totalPagos += valor;
        }
      }
      // se não é do sócio atual, ignora
    } else {
      // Abastecimento compartilhado: distribuir proporcionalmente
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

/**
 * Calcula o balanço proporcional de um sócio baseado no percentual de participação
 */
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

  // Calcular abastecimentos (agora atribuindo registros por partner_index ao sócio quando aplicável)
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

/**
 * Hook para buscar o balanço de um cliente ou sócio específico
 */
export function useSocioBalanco(
  clienteId: string | undefined,
  socioId: string | undefined, // formato: "clienteId-indice" ou undefined para todos
  aeronaveId: string | undefined,
  periodo: { inicio: string; fim: string }
) {
  // Buscar dados do cliente
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

  // Buscar parceiros do cliente
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

  // Buscar despesas
  const { data: despesas = [], isLoading: loadingDespesas } = useQuery({
    queryKey: ["despesas-socio", clienteId, aeronaveId, periodo],
    queryFn: async () => {
      if (!clienteId) return [];

      let query = supabase
        .from("conciliacoes_bancarias")
        .select("id, valor, status, saldo_pendente, valor_reembolsado, data")
        .eq("clientes_id", clienteId)
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

  // Buscar abastecimentos diretamente do Supabase
  const { data: abastecimentos = [], isLoading: loadingAbastecimentos } = useQuery({
    queryKey: ["abastecimentos-socio", clienteId, aeronaveId, periodo],
    queryFn: async () => {
      if (!clienteId) return [];

      // Buscar diretamente do Supabase
      let query = supabase
        .from("abastecimentos")
        .select("*")
        .eq("id_clientes", clienteId)
        .gte("data", periodo.inicio)
        .lte("data", periodo.fim);

      if (aeronaveId) {
        query = query.eq("aeronave_id", aeronaveId);
      }

      const { data, error } = await query;
      
      if (error) {
        throw new Error(`Failed to fetch abastecimentos: ${error.message}`);
      }

      return data || [];
    },
    enabled: !!clienteId,
  });

  // Extrair sócios do cliente usando dados dos parceiros
  const socios: Socio[] = (parceirosData || []).map((parceiro, indice) => ({
    id: parceiro.id,
    clienteId: parceiro.cliente_id,
    nome: parceiro.nome,
    cpf: parceiro.cpf,
    percentual:
      parceiro.percentual_participacao ||
      Math.round(10000 / ((parceirosData?.length || 1))) / 100, // Dividir igualmente se não especificado
    indice: indice + 1,
  }));

  // Se um sócio específico foi selecionado, calcular apenas para ele
  // Se não, calcular para todos os sócios
  const sociosBalanco: SocioBalanco[] = socios.map((socio) =>
    calcularBalancoSocio(socio, despesas, abastecimentos)
  );

  // Filtrar para sócio específico se selecionado
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

/**
 * Formata o valor proporcional com indicação de percentual
 */
export function formatarValorProporcional(
  valor: number,
  percentual: number
): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
  })} (${percentual.toFixed(1)}%)`;
}
