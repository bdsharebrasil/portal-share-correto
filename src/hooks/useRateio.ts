import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface RateioDespesa {
  id: string;
  despesa_id: string;
  client_id: string | null;
  client_name: string;
  aeronave_id: string | null;
  aeronave_registro: string | null;
  percentual: number | null;
  valor_rateado: number;
  valor_pago: number | null;
  status: string | null;
  data_pagamento: string | null;
  recebimento_id: string | null;
  observacoes: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
}

export interface RateioComDespesa extends RateioDespesa {
  despesa: {
    id: string;
    data: string;
    descricao: string;
    valor: number;
    categoria_id: string;
    categoria_nome?: string;
    grupo_categoria?: string;
    aeronave_registro: string | null;
  };
}

// Fetch all rateios with despesa details
export function useRateios(filters?: {
  clientId?: string;
  aeronaveId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ["rateios", filters],
    queryFn: async () => {
      let query = supabase
        .from("rateio_despesas")
        .select(`
          *,
          controle_bancario!inner (
            id,
            data,
            descricao,
            valor,
            categoria_id,
            aeronave_registro,
            categorias_movimentacao (
              nome,
              grupo_categoria
            )
          )
        `)
        .order("criado_em", { ascending: false });

      if (filters?.clientId) {
        query = query.eq("client_id", filters.clientId);
      }
      if (filters?.aeronaveId) {
        query = query.eq("aeronave_id", filters.aeronaveId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.startDate) {
        query = query.gte("controle_bancario.data", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("controle_bancario.data", filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map((item: any) => ({
        ...item,
        despesa: {
          id: item.controle_bancario.id,
          data: item.controle_bancario.data,
          descricao: item.controle_bancario.descricao,
          valor: item.controle_bancario.valor,
          categoria_id: item.controle_bancario.categoria_id,
          categoria_nome: item.controle_bancario.categorias_movimentacao?.nome,
          grupo_categoria: item.controle_bancario.categorias_movimentacao?.grupo_categoria,
          aeronave_registro: item.controle_bancario.aeronave_registro,
        },
      })) as RateioComDespesa[];
    },
  });
}

// Fetch pending reimbursements summary
export function useReembolsosPendentes() {
  return useQuery({
    queryKey: ["reembolsos-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rateio_despesas")
        .select(`
          id,
          client_id,
          client_name,
          aeronave_id,
          aeronave_registro,
          valor_rateado,
          status
        `)
        .neq("status", "pago");

      if (error) throw error;

      type RateioItem = {
        id: string;
        client_id: string | null;
        client_name: string;
        aeronave_id: string | null;
        aeronave_registro: string | null;
        valor_rateado: number;
        status: string;
      };
      const typedData = data as unknown as RateioItem[];

      // Group by client
      const byClient = new Map<string, {
        clientId: string | null;
        clientName: string;
        totalDevido: number;
        totalPago: number;
        pendente: number;
        count: number;
      }>();

      typedData.forEach(item => {
        const key = item.client_name;
        if (!byClient.has(key)) {
          byClient.set(key, {
            clientId: item.client_id,
            clientName: item.client_name,
            totalDevido: 0,
            totalPago: 0,
            pendente: 0,
            count: 0,
          });
        }
        const entry = byClient.get(key)!;
        entry.totalDevido += Number(item.valor_rateado) || 0;
        entry.pendente = entry.totalDevido - entry.totalPago;
        entry.count += 1;
      });

      return Array.from(byClient.values()).sort((a, b) => b.pendente - a.pendente);
    },
  });
}

// Create rateio entries for a despesa
export function useCreateRateio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (rateios: Omit<RateioDespesa, "id" | "criado_em" | "atualizado_em">[]) => {
      const { data, error } = await supabase
        .from("rateio_despesas")
        .insert(rateios)
        .select();

      if (error) throw error;

      // Update the original despesa to mark it has rateio
      if (rateios.length > 0) {
        await supabase
          .from("controle_bancario")
          .update({ tem_rateio: true })
          .eq("id", rateios[0].despesa_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateios"] });
      queryClient.invalidateQueries({ queryKey: ["reembolsos-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["controle-bancario"] });
      toast({
        title: "Rateio criado",
        description: "O rateio foi registrado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar rateio",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Update rateio payment status
export function useUpdateRateioPagamento() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      valorPago,
      dataPagamento,
      comprovanteUrl,
    }: {
      id: string;
      valorPago: number;
      dataPagamento: string;
      comprovanteUrl?: string;
    }) => {
      // Get current rateio to check valor_rateado
      const { data: currentRateio } = await supabase
        .from("rateio_despesas")
        .select("valor_rateado")
        .eq("id", id)
        .single();

      const typedRateio = currentRateio as unknown as { valor_rateado: number } | null;
      const valorRateado = Number(typedRateio?.valor_rateado) || 0;
      const novoValorPago = valorPago;
      
      const novoStatus = novoValorPago >= valorRateado ? "pago" : "parcial";

      const { data, error } = await supabase
        .from("rateio_despesas")
        .update({
          valor_pago: novoValorPago,
          status: novoStatus,
          data_pagamento: dataPagamento,
        })
        .eq("id", id)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rateios"] });
      queryClient.invalidateQueries({ queryKey: ["reembolsos-pendentes"] });
      toast({
        title: "Pagamento registrado",
        description: "O pagamento foi registrado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao registrar pagamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
