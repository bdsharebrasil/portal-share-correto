/**
 * Sincroniza um Relatório de Viagem finalizado com o financeiro:
 *  - contas_areceber: 1 linha por cliente (total que a Share precisa cobrar do cliente)
 *  - contas_apagar:   1 linha por tripulante que pagou do bolso (Share deve ao colaborador)
 *  - movimentacoes:   1 linha de despesa reembolsável por tripulante que pagou do bolso
 *
 * Idempotente: usa `reference_type='travel_report'` + `reference_id=<reportId>` em
 * contas_areceber e procura por descrição única em contas_apagar/movimentacoes.
 */
import { supabase } from "@/integrations/supabase/client";

interface SyncParams {
  reportId: string;
  numeroRelatorio: string;
  clientesId: string;
  clienteNome: string;
  clienteCnpj?: string | null;
  aeronaveId?: string | null;
  matriculaAeronave?: string | null;
  tripulacaoId?: string | null;
  nomeTripulante?: string | null;
  tripulanteId2?: string | null;
  nomeTripulante2?: string | null;
  totalCrew1: number; // pago do bolso pelo tripulante 1
  totalCrew2: number; // pago do bolso pelo tripulante 2
  totalSharebrasil: number; // pago pela empresa (cartão/conta Share)
  dataReferencia: string; // YYYY-MM-DD
  prazoVencimentoDias?: number; // default 30
  userId?: string | null;
}

async function ensureCategoriaMovimentacao(
  nome: string,
  grupo: "FIXO" | "VARIAVEL" | "EXTRA",
  userId?: string | null
): Promise<string | null> {
  try {
    const { data: existing } = await (supabase as any)
      .from("categorias_movimentacao")
      .select("id")
      .eq("nome", nome)
      .maybeSingle();
    if (existing?.id) return existing.id;

    const { data: created, error } = await (supabase as any)
      .from("categorias_movimentacao")
      .insert({
        nome,
        tipo: "despesa",
        grupo_categoria: grupo,
        ativo: true,
        criado_por: userId ?? "00000000-0000-0000-0000-000000000000",
      })
      .select("id")
      .single();
    if (error) throw error;
    return created?.id ?? null;
  } catch (e) {
    console.error("ensureCategoriaMovimentacao falhou:", e);
    return null;
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function syncTravelReportToFinance(params: SyncParams): Promise<{
  contasAreceberCriado: boolean;
  contasApagarCriadas: number;
  movimentacoesCriadas: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let contasAreceberCriado = false;
  let contasApagarCriadas = 0;
  let movimentacoesCriadas = 0;

  const prazoDias = params.prazoVencimentoDias ?? 30;
  const dataVenc = addDays(params.dataReferencia, prazoDias);
  const totalClienteDeve =
    (params.totalSharebrasil || 0) +
    (params.totalCrew1 || 0) +
    (params.totalCrew2 || 0);

  // --- 1) contas_areceber (cliente) ---
  if (totalClienteDeve > 0 && params.clientesId) {
    try {
      const { data: existing } = await (supabase as any)
        .from("contas_areceber")
        .select("id")
        .eq("reference_type", "travel_report")
        .eq("reference_id", params.reportId)
        .maybeSingle();

      if (!existing) {
        // Ensure categoria_id exists
        const categoriaId = await ensureCategoriaMovimentacao(
          "Relatório de Viagem",
          "VARIAVEL",
          params.userId
        );

        const payload: any = {
          numero: `RV-${params.numeroRelatorio}`,
          cliente_id: params.clientesId,
          cliente_nome: params.clienteNome || "—",
          cliente_cnpj: params.clienteCnpj || "—",
          data_criacao: params.dataReferencia,
          data_vencimento: dataVenc,
          valor: totalClienteDeve,
          categoria: "Relatório de Viagem",
          categoria_id: categoriaId,
          descricao: `Reembolso Relatório de Viagem ${params.numeroRelatorio}${
            params.matriculaAeronave ? ` — ${params.matriculaAeronave}` : ""
          }`,
          status: "pendente",
          aeronave: params.matriculaAeronave || null,
          reference_type: "travel_report",
          reference_id: params.reportId,
          criado_por: params.userId || null,
        };
        const { error } = await (supabase as any)
          .from("contas_areceber")
          .insert(payload);
        if (error) throw error;
        contasAreceberCriado = true;
      }
    } catch (e: any) {
      errors.push(`contas_areceber: ${e.message ?? e}`);
    }
  }

  // --- 2) contas_apagar + movimentacoes por tripulante que pagou do bolso ---
  const categoriaMovId = await ensureCategoriaMovimentacao(
    "Reembolso Relatório de Viagem",
    "VARIAVEL",
    params.userId
  );

  const tripulantesParaReembolsar: Array<{
    nome: string;
    tripulacaoId: string | null;
    valor: number;
    label: string;
  }> = [];
  if ((params.totalCrew1 || 0) > 0 && params.nomeTripulante) {
    tripulantesParaReembolsar.push({
      nome: params.nomeTripulante,
      tripulacaoId: params.tripulacaoId || null,
      valor: params.totalCrew1,
      label: "TRIPULANTE 1",
    });
  }
  if ((params.totalCrew2 || 0) > 0 && params.nomeTripulante2) {
    tripulantesParaReembolsar.push({
      nome: params.nomeTripulante2,
      tripulacaoId: params.tripulanteId2 || null,
      valor: params.totalCrew2,
      label: "TRIPULANTE 2",
    });
  }

  const { data: reportData, error: reportError } = await (supabase as any)
    .from("travel_expense_reports")
    .select("pdf_url")
    .eq("id", params.reportId)
    .single();
  const reportPdfUrl: string | null = reportData?.pdf_url || null;
  if (reportError) {
    console.warn("Não foi possível buscar pdf_url do relatório de viagem:", reportError);
  }

  for (const t of tripulantesParaReembolsar) {
    const descricaoBase = `Reembolso RV ${params.numeroRelatorio} — ${t.label} (${t.nome})`;
    // Chave de origem (idempotência): mesma para contas_apagar e movimentacoes
    // — diferenciamos os 2 tripulantes por sub-namespace no reference_type.
    const cpReferenceType = `travel_report_crew_${t.label === "TRIPULANTE 1" ? 1 : 2}`;
    const movReferenceType = `travel_report_reembolso_${t.label === "TRIPULANTE 1" ? 1 : 2}`;

    // 2a) contas_apagar (Share Brasil deve ao tripulante)
    try {
      const { data: existingCp } = await (supabase as any)
        .from("contas_apagar")
        .select("id, arquivo_pdf_url")
        .eq("reference_type", cpReferenceType)
        .eq("reference_id", params.reportId)
        .maybeSingle();

      let contasApagarId: string | null = existingCp?.id ?? null;

      if (existingCp?.id && reportPdfUrl && !existingCp.arquivo_pdf_url) {
        await supabase
          .from("contas_apagar")
          .update({ arquivo_pdf_url: reportPdfUrl })
          .eq("id", existingCp.id);
      }

      if (!contasApagarId) {
        const cpPayload: any = {
          descricao: descricaoBase,
          valor: t.valor,
          data_vencimento: dataVenc,
          status: "pendente",
          categoria: "Reembolso Tripulação",
          categoria_id: categoriaMovId,
          cliente_id: params.clientesId || null,
          socios_id: null, // Será preenchido conforme necessário
          aeronave_registro: params.matriculaAeronave || null,
          aeronave_id: params.aeronaveId || null,
          observacoes: `Gerado automaticamente pelo Relatório de Viagem ${params.numeroRelatorio}`,
          arquivo_pdf_url: reportPdfUrl,
          reference_type: cpReferenceType,
          reference_id: params.reportId,
          criado_por: params.userId || null,
        };
        const { data: cpInserted, error: cpErr } = await (supabase as any)
          .from("contas_apagar")
          .insert(cpPayload)
          .select("id")
          .single();
        if (cpErr) throw cpErr;
        contasApagarId = cpInserted?.id ?? null;
        contasApagarCriadas += 1;
      }

      // 2b) movimentacoes (despesa reembolsável vinculada à conta a pagar)
      try {
        const { data: existingMov } = await (supabase as any)
          .from("movimentacoes")
          .select("id")
          .eq("reference_type", movReferenceType)
          .eq("reference_id", params.reportId)
          .maybeSingle();

        if (!existingMov) {
          const movPayload: any = {
            descricao: descricaoBase,
            fluxo: "saida",
            tipo_caixa: "cliente",
            valor_rateado: t.valor,
            valor_total: t.valor,
            data_emissao: params.dataReferencia,
            data_pagamento: null, // ainda não pago pela Share
            aeronave_id: params.aeronaveId || null,
            clientes_id: params.clientesId || null,
            fornecedor_nome: t.nome,
            status: "pendente",
            observacoes: `Despesa reembolsável — paga do bolso pelo tripulante. RV ${params.numeroRelatorio}`,
            reembolsavel: true,
            reembolso_quitado: false,
            categoria_id: categoriaMovId,
            contas_apagar_id: contasApagarId,
            reference_type: movReferenceType,
            reference_id: params.reportId,
            criado_por: params.userId || null,
          };
          const { error: movErr } = await (supabase as any)
            .from("movimentacoes")
            .insert(movPayload);
          if (movErr) throw movErr;
          movimentacoesCriadas += 1;
        }
      } catch (e: any) {
        errors.push(`movimentacoes (${t.label}): ${e.message ?? e}`);
      }
    } catch (e: any) {
      errors.push(`contas_apagar (${t.label}): ${e.message ?? e}`);
    }
  }

  return {
    contasAreceberCriado,
    contasApagarCriadas,
    movimentacoesCriadas,
    errors,
  };
}
