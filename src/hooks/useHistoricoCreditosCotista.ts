import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CreditoMovimento {
  id: string;
  data: string;
  tipo: "credito" | "debito" | "pagamento";
  descricao: string;
  valor: number;
  saldo_anterior: number;
  saldo_posterior: number;
  origem: "direto" | "conciliacao";
  pago_por: string;
  pago_por_tipo: "CLIENTE" | "SOCIO" | "EMPRESA" | "TERCEIRO" | null;
  referencia_id: string | null;
  documento: string | null;
  status: string | null;
}

export interface HistoricoCreditoCotista {
  cotista_id: string;
  cotista_nome: string;
  movimentos: CreditoMovimento[];
  total_creditos: number;
  total_debitos: number;
  saldo_final: number;
}

interface UseHistoricoCreditosOptions {
  clienteId?: string;
  aeronaveId?: string;
  socioId?: string;
  dataInicio?: string;
  dataFim?: string;
  enabled?: boolean;
}

/**
 * Hook para rastrear histórico completo de créditos e débitos de um cotista
 * Consolidando dados de rateio_despesas com movimentações financeiras
 */
export function useHistoricoCreditosCotista({
  clienteId,
  aeronaveId,
  socioId,
  dataInicio,
  dataFim,
  enabled = true,
}: UseHistoricoCreditosOptions = {}) {
  return useQuery({
    enabled: enabled && !!(clienteId || socioId),
    queryKey: [
      "historico-creditos-cotista",
      clienteId,
      aeronaveId,
      socioId,
      dataInicio,
      dataFim,
    ],
    queryFn: async () => {
      const isCliente = !!clienteId;

      // Buscar rateio_despesas para este cotista
      let rateioQuery = supabase
        .from("rateio_despesas")
        .select(
          "id, despesa_id, data_vencimento, data_pagamento, valor_rateado, valor_pago_real, pago_por, pago_por_tipo, cliente_id, clientes_nome, socio_id, socios_nome, numero_nf, numero_doc, numero_boleto, numero_recibo, status"
        );

      if (isCliente && clienteId) {
        rateioQuery = rateioQuery.eq("cliente_id", clienteId);
      } else if (socioId) {
        rateioQuery = rateioQuery.eq("socio_id", socioId);
      }

      if (aeronaveId) {
        rateioQuery = rateioQuery.eq("aeronave_id", aeronaveId);
      }

      if (dataInicio) {
        rateioQuery = rateioQuery.or(
          `data_pagamento.gte.${dataInicio},and(data_pagamento.is.null,data_vencimento.gte.${dataInicio})`
        );
      }

      if (dataFim) {
        rateioQuery = rateioQuery.or(
          `data_pagamento.lte.${dataFim},and(data_pagamento.is.null,data_vencimento.lte.${dataFim})`
        );
      }

      const { data: rateios, error } = await rateioQuery.order(
        "data_pagamento",
        { ascending: false, nullsFirst: false }
      );

      if (error) throw error;

      if (!rateios || rateios.length === 0) {
        return {
          cotista_id: clienteId || socioId || "",
          cotista_nome: "",
          movimentos: [],
          total_creditos: 0,
          total_debitos: 0,
          saldo_final: 0,
        };
      }

      // Normalizar função helper
      const norm = (s?: string | null) =>
        (s || "")
          .toString()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();

      // Extrair nome do cotista
      const primeiro = rateios[0];
      const cotista_nome = isCliente
        ? primeiro.clientes_nome || ""
        : primeiro.socios_nome || "";

      // Construir movimentos de crédito/débito
      const movimentos: CreditoMovimento[] = rateios.map((r: any, idx: number) => {
        const dataMov = r.data_pagamento || r.data_vencimento;
        const docNum =
          r.numero_nf || r.numero_doc || r.numero_boleto || r.numero_recibo || null;

        // Determinar tipo de movimento
        const pagoNorm = norm(r.pago_por);
        const isCotistaPagou =
          (isCliente && r.cliente_id === clienteId) ||
          (!isCliente && r.socio_id === socioId);

        const isPagamentoEmpresa =
          pagoNorm === "empresa" ||
          pagoNorm === "share" ||
          pagoNorm === "share brasil" ||
          r.pago_por_tipo === "EMPRESA";

        let tipo: "credito" | "debito" | "pagamento" = "debito";
        if (isCotistaPagou) {
          tipo = "credito"; // cotista pagou = gera crédito
        } else if (isPagamentoEmpresa) {
          tipo = "debito"; // empresa pagou = cotista deve
        } else {
          tipo = "pagamento"; // terceiro pagou
        }

        const valor_movimento =
          tipo === "credito"
            ? r.valor_pago_real || r.valor_rateado || 0
            : r.valor_rateado || 0;

        return {
          id: r.id,
          data: dataMov || new Date().toISOString().split("T")[0],
          tipo,
          descricao: `Rateio de despesa ${r.numero_nf ? `(NF: ${r.numero_nf})` : ""}`.trim(),
          valor: valor_movimento,
          saldo_anterior: 0, // será calculado abaixo
          saldo_posterior: 0, // será calculado abaixo
          origem: r.data_pagamento ? ("direto" as const) : ("conciliacao" as const),
          pago_por: r.pago_por || "—",
          pago_por_tipo: r.pago_por_tipo || null,
          referencia_id: r.despesa_id || r.id,
          documento: docNum,
          status: r.status,
        };
      });

      // Calcular saldos acumulativos
      let saldoAcum = 0;
      for (let i = movimentos.length - 1; i >= 0; i--) {
        const mov = movimentos[i];
        mov.saldo_anterior = saldoAcum;

        if (mov.tipo === "credito") {
          saldoAcum += mov.valor;
        } else {
          saldoAcum -= mov.valor;
        }

        mov.saldo_posterior = saldoAcum;
      }

      // Calcular totais
      const total_creditos = movimentos
        .filter((m) => m.tipo === "credito")
        .reduce((sum, m) => sum + m.valor, 0);

      const total_debitos = movimentos
        .filter((m) => m.tipo === "debito")
        .reduce((sum, m) => sum + m.valor, 0);

      const saldo_final = total_creditos - total_debitos;

      return {
        cotista_id: clienteId || socioId || "",
        cotista_nome,
        movimentos,
        total_creditos,
        total_debitos,
        saldo_final,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

/**
 * Hook para resumo simplificado de créditos (sem movimento detalhado)
 */
export function useResumoCreditosCotista({
  clienteId,
  aeronaveId,
  socioId,
  enabled = true,
}: Omit<UseHistoricoCreditosOptions, "dataInicio" | "dataFim"> = {}) {
  return useQuery({
    enabled: enabled && !!(clienteId || socioId),
    queryKey: ["resumo-creditos-cotista", clienteId, aeronaveId, socioId],
    queryFn: async () => {
      const isCliente = !!clienteId;

      let query = supabase
        .from("rateio_despesas")
        .select("valor_rateado, valor_pago_real, pago_por_tipo, cliente_id, socio_id");

      if (isCliente && clienteId) {
        query = query.eq("cliente_id", clienteId);
      } else if (socioId) {
        query = query.eq("socio_id", socioId);
      }

      if (aeronaveId) {
        query = query.eq("aeronave_id", aeronaveId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          total_creditos: 0,
          total_debitos: 0,
          saldo: 0,
        };
      }

      let creditos = 0;
      let debitos = 0;

      data.forEach((r: any) => {
        // Se o cotista pagou diretamente, é crédito
        if (
          (isCliente && r.cliente_id === clienteId && r.pago_por_tipo === "CLIENTE") ||
          (!isCliente && r.socio_id === socioId && r.pago_por_tipo === "SOCIO")
        ) {
          creditos += r.valor_pago_real || 0;
        } else if (r.pago_por_tipo !== "EMPRESA") {
          // Terceiros pagando
          creditos += r.valor_pago_real || 0;
        } else {
          // Empresa pagou = cotista deve
          debitos += r.valor_rateado || 0;
        }
      });

      return {
        total_creditos: creditos,
        total_debitos: debitos,
        saldo: creditos - debitos,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
}
