import { supabase } from "@/integrations/supabase/client";

/**
 * Re-processa um recibo para criar os registros de rateio_despesas
 * Útil quando o rateio não foi criado automaticamente
 *
 * Uso no console:
 * import { processReceiptRateio } from '@/services/processReceiptRateio'
 * processReceiptRateio('630b3799-71ae-410a-b3f4-1072b3f4ca68')
 */
export async function processReceiptRateio(receiptId: string) {
  try {
    console.log(`🔄 Processando rateio para recibo ${receiptId}...`);

    // 1. Buscar o recibo
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      throw new Error(`Recibo não encontrado: ${receiptError?.message}`);
    }

    console.log("Receipt found:", receipt);

    // Verificar se é rateado
    if (!receipt.is_shared || !receipt.aircraft_id) {
      throw new Error("Recibo não é rateado ou não tem aeronave associada");
    }

    // 2. Buscar todos os clients que compartilham esta aeronave
    const { data: aircraftClients, error: acError } = await supabase
      .from("client_aircraft")
      .select("client_id, share_percentage, clients(id, company_name)")
      .eq("aircraft_id", receipt.aircraft_id);

    if (acError) {
      throw new Error(`Erro ao buscar clients da aeronave: ${acError.message}`);
    }

    if (!aircraftClients || aircraftClients.length === 0) {
      throw new Error("Nenhum client encontrado para a aeronave");
    }

    console.log(`Found ${aircraftClients.length} clients for aircraft`);

    // 3. Buscar a conta_apagar ou usar o receipt como referência
    // @ts-ignore - deep type instantiation
    const { data: conta, error: contaError } = await supabase
      .from("contas_apagar")
      .select("id")
      .eq("created_at", receipt.created_at as string)
      .eq("client_id", receipt.client_id as string)
      .single();

    const despesa_id = conta?.id || receipt.id;
    const valorTotalDespesa = receipt.total_amount || receipt.amount;
    const percentualVoo = receipt.percentage || 100;

    console.log(`Using despesa_id: ${despesa_id}, valor: ${valorTotalDespesa}`);

    // 4. Criar registro em rateio_despesas para CADA client
    // Registra quanto DEVERIA PAGAR cada um (valor_rateado é por propriedade, valor_por_voo é por uso)
    let successCount = 0;
    for (const ac of aircraftClients) {
      const clientData = ac.clients as any;
      const sharePercentage = parseFloat(String(ac.share_percentage || 0));

      // Quanto este client DEVERIA pagar
      const valorPorPropriedade = (valorTotalDespesa * sharePercentage) / 100;
      const valorPorUso = (valorTotalDespesa * percentualVoo) / 100;

      const rateioPayload = {
        despesa_id,
        client_id: ac.client_id,
        client_name: clientData?.company_name || "Unknown",
        aeronave_id: receipt.aircraft_id,
        aeronave_registro: receipt.doc_number || null,
        percentual: sharePercentage, // % de propriedade
        percentual_voo: percentualVoo, // % de uso/voo
        valor_rateado: valorPorPropriedade, // O que deveria pagar por propriedade
        valor_por_voo: valorPorUso, // O que deveria pagar por uso
        valor: valorTotalDespesa, // Valor total da despesa
        status: "pendente",
        data_vencimento: receipt.max_payment_date || receipt.issue_date,
        categoria_id: null,
        boleto: receipt.boleto_url,
        nota_fiscal: receipt.nf_url,
        observacoes: `Rateio reprocessado - ${sharePercentage}% propriedade / ${percentualVoo}% uso. Valor total R$ ${valorTotalDespesa.toFixed(2)}`,
      };

      const { error: rateioErr } = await supabase
        .from("rateio_despesas")
        .insert(rateioPayload);

      if (rateioErr) {
        console.error(
          `❌ Erro ao criar rateio para ${clientData?.company_name}:`,
          rateioErr
        );
      } else {
        console.log(
          `✅ Rateio criado para ${clientData?.company_name} (${sharePercentage}% / ${percentualVoo}%)`
        );
        successCount++;
      }
    }

    console.log(
      `✅ Processamento concluído: ${successCount}/${aircraftClients.length} registros criados`
    );
    return {
      success: true,
      message: `Rateio reprocessado com sucesso: ${successCount} registros criados`,
      count: successCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Erro ao processar rateio:", errorMessage);
    return {
      success: false,
      message: `Erro: ${errorMessage}`,
      count: 0,
    };
  }
}
