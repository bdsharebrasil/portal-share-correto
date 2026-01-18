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
  company_name: string | null;
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
      const { data, error } = await supabase
        .from("clients")
        .select(`
          id,
          company_name,
          proprietario,
          cnpj,
          partner_name,
          partner_cpf,
          partner_percentage1,
          partner_name2,
          partner_cpf2,
          partner_percentage2,
          partner_name3,
          partner_cpf3,
          partner_percentage3
        `)
        .order("company_name");

      if (error) throw error;

      // Transformar clientes em estrutura com sócios
      const clientesComSocios: ClienteComSocios[] = (data || []).map((cliente) => {
        const socios: Socio[] = [];

        // Sócio 1
        if (cliente.partner_name) {
          socios.push({
            id: `${cliente.id}-1`,
            clienteId: cliente.id,
            nome: cliente.partner_name,
            cpf: cliente.partner_cpf,
            percentual: cliente.partner_percentage1 || 33.33,
            indice: 1,
          });
        }

        // Sócio 2
        if (cliente.partner_name2) {
          socios.push({
            id: `${cliente.id}-2`,
            clienteId: cliente.id,
            nome: cliente.partner_name2,
            cpf: cliente.partner_cpf2,
            percentual: cliente.partner_percentage2 || 33.33,
            indice: 2,
          });
        }

        // Sócio 3
        if (cliente.partner_name3) {
          socios.push({
            id: `${cliente.id}-3`,
            clienteId: cliente.id,
            nome: cliente.partner_name3,
            cpf: cliente.partner_cpf3,
            percentual: cliente.partner_percentage3 || 33.34,
            indice: 3,
          });
        }

        return {
          id: cliente.id,
          company_name: cliente.company_name,
          proprietario: cliente.proprietario,
          cnpj: cliente.cnpj,
          socios,
          temMultiplosSocios: socios.length > 1,
        };
      });

      return clientesComSocios;
    },
  });
}

/**
 * Calcula abastecimentos por status
 */
export function calcularAbastecimentos(
  abastecimentos: any[],
  fator: number = 1
) {
  const pendentes = abastecimentos.filter((a) => a.status === "pendente");
  const pagos = abastecimentos.filter((a) => a.status === "pago");

  const totalPendentes = pendentes.reduce((sum, a) => sum + (a.valor_total || 0), 0);
  const totalPagos = pagos.reduce((sum, a) => sum + (a.valor_total || 0), 0);

  return {
    abastecimentosPendentes: pendentes.length,
    abastecimentosPagos: pagos.length,
    valorAbastecimentosPendentes: totalPendentes * fator,
    valorAbastecimentosPagos: totalPagos * fator,
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

  const totalPendentes = pendentes.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalPagos = pagos.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalAguardando = aguardando.reduce(
    (sum, d) => sum + ((d.saldo_pendente || d.amount) || 0),
    0
  );
  const totalReembolsados = reembolsados.reduce(
    (sum, d) => sum + (d.valor_reembolsado || d.amount || 0),
    0
  );
  const totalGeral = despesas.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Calcular abastecimentos
  const abastecimentosCalculo = calcularAbastecimentos(abastecimentos, fator);

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
  // Buscar dados do cliente com sócios
  const { data: clienteData } = useQuery({
    queryKey: ["cliente-socios-info", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from("clients")
        .select(`
          id,
          company_name,
          proprietario,
          cnpj,
          partner_name,
          partner_cpf,
          partner_percentage1,
          partner_name2,
          partner_cpf2,
          partner_percentage2,
          partner_name3,
          partner_cpf3,
          partner_percentage3
        `)
        .eq("id", clienteId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  // Buscar despesas
  const { data: despesas = [], isLoading: loadingDespesas } = useQuery({
    queryKey: ["despesas-socio", clienteId, aeronaveId, periodo],
    queryFn: async () => {
      if (!clienteId) return [];

      let query = supabase
        .from("bank_reconciliations")
        .select("id, amount, status, saldo_pendente, valor_reembolsado, date")
        .eq("client_id", clienteId)
        .gte("date", periodo.inicio)
        .lte("date", periodo.fim);

      if (aeronaveId) {
        query = query.eq("aircraft_id", aeronaveId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!clienteId,
  });

  // Buscar abastecimentos via backend to avoid Supabase 400 errors with date ranges
  const { data: abastecimentos = [], isLoading: loadingAbastecimentos } = useQuery({
    queryKey: ["abastecimentos-socio", clienteId, aeronaveId, periodo],
    queryFn: async () => {
      if (!clienteId) return [];

      // Use backend proxy endpoint to avoid Supabase PostgREST 400 errors
      let fuelUrl = `/api/fuel?client_id=${clienteId}&date_start=${periodo.inicio}&date_end=${periodo.fim}`;
      if (aeronaveId) {
        fuelUrl += `&aircraft_id=${aeronaveId}`;
      }

      const response = await fetch(fuelUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch fuel data: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];
    },
    enabled: !!clienteId,
  });

  // Extrair sócios do cliente
  const socios: Socio[] = [];
  if (clienteData) {
    if (clienteData.partner_name) {
      socios.push({
        id: `${clienteData.id}-1`,
        clienteId: clienteData.id,
        nome: clienteData.partner_name,
        cpf: clienteData.partner_cpf,
        percentual: clienteData.partner_percentage1 || 33.33,
        indice: 1,
      });
    }
    if (clienteData.partner_name2) {
      socios.push({
        id: `${clienteData.id}-2`,
        clienteId: clienteData.id,
        nome: clienteData.partner_name2,
        cpf: clienteData.partner_cpf2,
        percentual: clienteData.partner_percentage2 || 33.33,
        indice: 2,
      });
    }
    if (clienteData.partner_name3) {
      socios.push({
        id: `${clienteData.id}-3`,
        clienteId: clienteData.id,
        nome: clienteData.partner_name3,
        cpf: clienteData.partner_cpf3,
        percentual: clienteData.partner_percentage3 || 33.34,
        indice: 3,
      });
    }
  }

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
