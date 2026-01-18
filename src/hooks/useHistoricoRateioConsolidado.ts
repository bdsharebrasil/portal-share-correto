import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HistoricoRateio {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  aeronave_id: string;
  aeronave_registro: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_grupo: string;
  data_competencia: string;
  data_pagamento: string;
  data_conciliacao: string;
  horas_voadas: number;
  horas_totais_aeronave: number;
  percentual_uso: number;
  percentual_participacao: number;
  descricao: string;
  documento_fiscal: string | null;
  observacao: string | null;
  valor_total_lancamento: number;
  valor_rateado: number;
  valor_pago: number;
  tipo_rateio: string;
  foi_reembolso: boolean;
  status: string;
  consolidado_por: string | null;
  consolidado_em: string | null;
}

interface UseHistoricoRateioOptions {
  clienteId?: string;
  socioId?: string;
  aeronaveId?: string;
  dataInicio?: string;
  dataFim?: string;
  enabled?: boolean;
}

/**
 * Hook para buscar histórico de rateio consolidado do cliente
 */
export function useHistoricoRateioConsolidado({
  clienteId,
  socioId,
  aeronaveId,
  dataInicio,
  dataFim,
  enabled = true,
}: UseHistoricoRateioOptions = {}) {
  return useQuery({
    queryKey: ['historico-rateio', clienteId, socioId, aeronaveId, dataInicio, dataFim],
    queryFn: async () => {
      if (!clienteId) return [];

      let query = supabase
        .from('historico_rateio_consolidado')
        .select('*', { count: 'exact' })
        .eq('cliente_id', clienteId)
        .eq('status', 'consolidado')
        .order('data_competencia', { ascending: false });

      // Filtrar por sócio (percentual_participacao)
      if (socioId) {
        // Nota: Sócio não é uma coluna direta. Se precisar filtrar por sócio específico,
        // você pode usar percentual_participacao ou adicionar coluna socio_id na tabela
        // Por enquanto, vamos deixar genérico
      }

      // Filtrar por aeronave
      if (aeronaveId) {
        query = query.eq('aeronave_id', aeronaveId);
      }

      // Filtrar por data
      if (dataInicio) {
        query = query.gte('data_competencia', dataInicio);
      }
      if (dataFim) {
        query = query.lte('data_competencia', dataFim);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Erro ao buscar histórico consolidado:', error);
        throw error;
      }

      return (data || []) as HistoricoRateio[];
    },
    enabled: enabled && !!clienteId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Hook para buscar resumo mensal do histórico consolidado
 */
export function useResumoMensalHistorico({
  clienteId,
  socioId,
  ano,
  mes,
  enabled = true,
}: {
  clienteId?: string;
  socioId?: string;
  ano?: number;
  mes?: number;
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ['resumo-mensal-historico', clienteId, socioId, ano, mes],
    queryFn: async () => {
      if (!clienteId || !ano || !mes) return [];

      // Construir intervalo de data baseado em ano/mes
      const start = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const endDate = new Date(Number(ano), Number(mes), 0); // último dia do mês
      const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('historico_rateio_consolidado')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('status', 'consolidado')
        .gte('data_competencia', start)
        .lte('data_competencia', end);

      if (error) {
        console.error('Erro ao buscar resumo mensal:', error);
        throw error;
      }

      // Agrupar por categoria_grupo
      const resumo = (data || []).reduce((acc: any, item: any) => {
        const grupo = item.categoria_grupo || 'Outros';
        
        if (!acc[grupo]) {
          acc[grupo] = {
            categoria_grupo: grupo,
            total_valor: 0,
            total_horas: 0,
            total_registros: 0,
            foi_reembolso_count: 0,
          };
        }

        acc[grupo].total_valor += item.valor_rateado || 0;
        acc[grupo].total_horas += item.horas_voadas || 0;
        acc[grupo].total_registros += 1;
        if (item.foi_reembolso) acc[grupo].foi_reembolso_count += 1;

        return acc;
      }, {});

      return Object.values(resumo);
    },
    enabled: enabled && !!clienteId && !!ano && !!mes,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook para buscar estatísticas gerais do histórico
 */
export function useEstatisticasHistorico({
  clienteId,
  dataInicio,
  dataFim,
  enabled = true,
}: {
  clienteId?: string;
  dataInicio?: string;
  dataFim?: string;
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ['estatisticas-historico', clienteId, dataInicio, dataFim],
    queryFn: async () => {
      if (!clienteId) return null;

      let query = supabase
        .from('historico_rateio_consolidado')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('status', 'consolidado');

      if (dataInicio) {
        query = query.gte('data_competencia', dataInicio);
      }
      if (dataFim) {
        query = query.lte('data_competencia', dataFim);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return {
          total_registros: 0,
          total_valor_rateado: 0,
          total_horas_voadas: 0,
          total_reembolsos: 0,
          valor_reembolsos: 0,
          categorias_unicas: 0,
          aeronaves_unicas: 0,
        };
      }

      return {
        total_registros: data.length,
        total_valor_rateado: data.reduce((sum: number, item: any) => sum + (item.valor_rateado || 0), 0),
        total_horas_voadas: data.reduce((sum: number, item: any) => sum + (item.horas_voadas || 0), 0),
        total_reembolsos: data.filter((item: any) => item.foi_reembolso).length,
        valor_reembolsos: data
          .filter((item: any) => item.foi_reembolso)
          .reduce((sum: number, item: any) => sum + (item.valor_rateado || 0), 0),
        categorias_unicas: new Set(data.map((item: any) => item.categoria_grupo)).size,
        aeronaves_unicas: new Set(data.map((item: any) => item.aeronave_id)).size,
      };
    },
    enabled: enabled && !!clienteId,
    staleTime: 1000 * 60 * 5,
  });
}
