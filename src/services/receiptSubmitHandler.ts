import { supabase } from "@/integrations/supabase/client";

interface ReceiptSubmissionData {
  // Dados básicos
  type: "cliente" | "colaborador";
  date: string;
  description: string;
  amount: number;
  status?: string;

  // IDs relacionados
  client_id?: string;
  aeronave_id?: string;
  categoria_movimentacao_id?: string;

  // Dados específicos de documento
  tipo_documento: "rateio" | "recibo";
  doc?: string | null;
  prazo_pagamento?: string | null;

  // Dados de rateio
  percentual?: string | number | null;

  // Forma de pagamento
  forma_pagamento?: string;
  afeta_caixa_empresa?: boolean;

  // Dados do fornecedor
  fornecedor_nome?: string | null;
  fornecedor_dados?: {
    nome: string;
    documento?: string;
    endereco?: string;
    cidade?: string;
    uf?: string;
  } | null;

  // URLs dos arquivos (após upload)
  boleto_url?: string | null;
  nf_url?: string | null;

  // Dados adicionais de rateio
  rateio_data?: {
    valor_total: number;
    percentual: number;
    valor_cliente: number;
  };

  // Arquivos para upload
  files?: {
    boleto?: File;
    notaFiscal?: File;
  };

  // Campos opcionais
  criado_por?: string;
  reference_id?: string;
  reference_type?: string;

  // Dados originais (para compatibilidade)
  originalFormData?: any;
}

interface ReceiptSubmissionResult {
  success: boolean;
  bankReconciliationId?: string;
  receiptId?: string;
  rateioIds?: string[];
  message?: string;
  error?: string;
  details?: any;
}

/**
 * Faz upload de um arquivo para o storage do Supabase
 */
async function uploadFile(
  file: File,
  prefix: string,
  storageBucket: string = "n.f-boletos-clients"
): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9.\-_]/g, "_")
      .substring(0, 100);
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${prefix}_${timestamp}_${randomSuffix}_${sanitizedFileName}`;

    const { error } = await supabase.storage
      .from(storageBucket)
      .upload(fileName, file, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error(`❌ Erro ao fazer upload do arquivo ${prefix}:`, error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(storageBucket)
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) {
      console.error(`❌ Falha ao obter URL pública para ${prefix}`);
      return null;
    }

    console.log(`✅ Arquivo ${prefix} enviado:`, publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error) {
    console.error(`❌ Exceção ao fazer upload do arquivo ${prefix}:`, error);
    return null;
  }
}

/**
 * Busca informações da aeronave
 */
async function fetchAircraftData(
  aircraftId: string
): Promise<{ registration: string } | null> {
  try {
    const { data, error } = await supabase
      .from('aeronave')
      .select('matricula')
      .eq("id", aircraftId)
      .single();

    if (error) {
      console.warn(`⚠️ Aeronave não encontrada: ${aircraftId}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error("❌ Erro ao buscar dados da aeronave:", error);
    return null;
  }
}

/**
 * Busca informações do cliente
 */
async function fetchClientData(
  clientId: string
): Promise<{ razao_social: string; cnpj?: string } | null> {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("razao_social, cnpj")
      .eq("id", clientId)
      .single();

    if (error) {
      console.warn(`⚠️ Cliente não encontrado: ${clientId}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error("❌ Erro ao buscar dados do cliente:", error);
    return null;
  }
}

/**
 * Insere um registro em bank_reconciliations
 */
async function insertBankReconciliation(
  data: any
): Promise<{ id: string; [key: string]: any } | null> {
  try {
    const { data: result, error } = await supabase
      .from("conciliacoes_bancarias")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("❌ Erro ao inserir em bank_reconciliations:", error);
      return null;
    }

    console.log("✅ bank_reconciliations criado:", result.id);
    return result;
  } catch (error) {
    console.error("❌ Exceção ao inserir bank_reconciliations:", error);
    return null;
  }
}

/**
 * Insere um registro em rateio_despesas
 */
async function insertRateio(data: any): Promise<{ id: string } | null> {
  try {
    const { data: result, error } = await supabase
      .from("rateio_despesas")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("❌ Erro ao inserir em rateio_despesas:", error);
      return null;
    }

    console.log("✅ rateio_despesas criado:", result.id);
    return result;
  } catch (error) {
    console.error("❌ Exceção ao inserir rateio_despesas:", error);
    return null;
  }
}

/**
 * Deleta um registro de bank_reconciliations (para rollback)
 */
async function deleteBankReconciliation(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("conciliacoes_bancarias")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("❌ Erro ao deletar bank_reconciliations:", error);
      return false;
    }

    console.log("✅ bank_reconciliations deletado (rollback)");
    return true;
  } catch (error) {
    console.error("❌ Exceção ao deletar bank_reconciliations:", error);
    return false;
  }
}

/**
 * Processa a submissão de um recibo com suporte a rateio
 * 
 * @param submissionData - Dados do formulário de recibo
 * @param userId - ID do usuário que está criando o recibo
 * @returns Resultado da operação
 */
export async function handleReceiptSubmit(
  submissionData: ReceiptSubmissionData,
  userId: string
): Promise<ReceiptSubmissionResult> {
  console.log("🔄 Iniciando processamento de recibo...", submissionData);

  try {
    // Validações básicas
    if (!submissionData.data) {
      throw new Error("Data é obrigatória");
    }
    if (!submissionData.descricao?.trim()) {
      throw new Error("Descrição é obrigatória");
    }
    if (!submissionData.valor || submissionData.valor <= 0) {
      throw new Error("Valor deve ser maior que zero");
    }

    // Normalizar o formato da data para YYYY-MM-DD (type: date)
    let normalizedDate = submissionData.data;
    if (normalizedDate.includes("T")) {
      // Se for ISO string (2024-03-01T12:00:00), extrai apenas a data
      normalizedDate = normalizedDate.split("T")[0];
    }
    // Validar que está no formato correto YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new Error(`Formato de data inválido: ${submissionData.data}. Use YYYY-MM-DD`);
    }

    // ===================== 1. UPLOAD DE ARQUIVOS =====================
    console.log("📤 Iniciando upload de arquivos...");
    let boleto_url: string | null = null;
    let nf_url: string | null = null;

    if (submissionData.files?.boleto instanceof File) {
      boleto_url = await uploadFile(submissionData.files.boleto, "boleto");
    }

    if (submissionData.files?.notaFiscal instanceof File) {
      nf_url = await uploadFile(submissionData.files.notaFiscal, "nf");
    }

    // ===================== 2. BUSCAR DADOS RELACIONADOS =====================
    console.log("🔍 Buscando dados relacionados...");
    let aircraftData: { registration: string } | null = null;
    let clientData: { razao_social: string; cnpj?: string } | null = null;

    if (submissionData.aeronave_id) {
      aircraftData = await fetchAircraftData(submissionData.aeronave_id);
    }

    if (submissionData.cliente_id) {
      clientData = await fetchClientData(submissionData.cliente_id);
    }

    // ===================== 3. PREPARAR DADOS PARA bank_reconciliations =====================
    console.log("📋 Preparando dados para bank_reconciliations...");

    // Normalizar data de vencimento também
    let normalizedPrazoData = submissionData.prazo_pagamento;
    if (normalizedPrazoData) {
      if (normalizedPrazoData.includes("T")) {
        normalizedPrazoData = normalizedPrazoData.split("T")[0];
      }
    }

    const bankReconciliationPayload = {
      type: submissionData.tipo || "cliente",
      date: normalizedDate,
      description: submissionData.descricao,
      amount: submissionData.valor,
      status: submissionData.status || "pendente",
      client_id: submissionData.cliente_id || null,
      aeronave_id: submissionData.aeronave_id || null,
      categoria_movimentacao_id: submissionData.categoria_movimentacao_id || null,
      tipo_documento: submissionData.tipo_documento,
      doc: submissionData.documento || null,
      prazo_pagamento: normalizedPrazoData || null,
      percentual: submissionData.percentual || null,
      forma_pagamento: submissionData.forma_pagamento || null,
      afeta_caixa_empresa: submissionData.afeta_caixa_empresa ?? true,
      fornecedor_nome: submissionData.fornecedor_nome || null,
      fornecedor_dados: submissionData.fornecedor_dados || null,
      boleto_url: boleto_url,
      nf_url: nf_url,
      criado_por: userId,
      reference_id: submissionData.referencia_id || null,
      reference_type: submissionData.tipo_referencia || null,
    };

    // ===================== 4. INSERIR EM bank_reconciliations =====================
    console.log("💾 Inserindo em bank_reconciliations...");
    const bankReconciliation = await insertBankReconciliation(
      bankReconciliationPayload
    );

    if (!bankReconciliation) {
      throw new Error("Falha ao inserir em bank_reconciliations");
    }

    // ===================== 5. INSERIR EM rateio_despesas (se rateio) =====================
    const rateioIds: string[] = [];

    if (submissionData.tipo_documento === "rateio" && submissionData.rateio_data) {
      console.log("📊 Processando rateio de despesas...");

      try {
        const rateioPayload = {
          despesa_id: bankReconciliation.id,
          client_id: submissionData.cliente_id || null,
          client_name: clientData?.razao_social || "",
          aeronave_id: submissionData.aeronave_id || null,
          aeronave_registro: aircraftData?.registration || "",
          percentual: parseFloat(String(submissionData.percentual || submissionData.rateio_data.percentual)),
          valor_rateado: submissionData.valor,
          valor: submissionData.rateio_data.valor_total,
          status: submissionData.status || "pendente",
          data_vencimento: normalizedPrazoData || normalizedDate,
          categoria_id: submissionData.categoria_movimentacao_id || null,
          boleto: boleto_url,
          nota_fiscal: nf_url,
          observacoes: `Rateio de ${submissionData.percentual || submissionData.rateio_data.percentual}% do valor total de R$ ${submissionData.rateio_data.valor_total.toFixed(2)}`,
          recebimento_id: submissionData.referencia_id || null,
        };

        console.log("📝 Payload para rateio_despesas:", rateioPayload);

        const rateioResult = await insertRateio(rateioPayload);

        if (!rateioResult) {
          // Se falhar ao inserir no rateio, deletar o registro do bank_reconciliations
          console.error("❌ Falha ao inserir rateio_despesas, fazendo rollback...");
          await deleteBankReconciliation(bankReconciliation.id);
          throw new Error("Falha ao inserir em rateio_despesas");
        }

        rateioIds.push(rateioResult.id);
        console.log("✅ Rateio inserido com sucesso");
      } catch (rateioError) {
        console.error("❌ Erro ao processar rateio:", rateioError);
        // Deletar o bank_reconciliation se o rateio falhar
        await deleteBankReconciliation(bankReconciliation.id);
        throw rateioError;
      }
    }

    // ===================== SUCESSO =====================
    console.log("✅ Recibo processado com sucesso!");
    return {
      success: true,
      bankReconciliationId: bankReconciliation.id,
      rateioIds: rateioIds,
      message:
        submissionData.tipo_documento === "rateio"
          ? "Recibo e rateio criados com sucesso!"
          : "Recibo criado com sucesso!",
      details: {
        bankReconciliation: bankReconciliation,
        filesUploaded: {
          boleto: !!boleto_url,
          notaFiscal: !!nf_url,
        },
      },
    };
  } catch (error: any) {
    console.error("❌ Erro ao processar recibo:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido ao processar recibo",
      details: error,
    };
  }
}

/**
 * Insere um recibo de saída (nota fiscal ou recibo) em bank_reconciliations
 * Função auxiliar para sincronizar dados de controle_bancario com bank_reconciliations
 *
 * @param data - Dados do recibo de saída
 * @param userId - ID do usuário que está criando o registro
 * @returns Resultado da operação
 */
export async function insertReceiptToBankReconciliations(
  data: {
    descricao: string;
    valor: number;
    data: string;
    data_vencimento?: string;
    numero_documento: string;
    status?: string;
    client_id?: string;
    client_name?: string;
    aeronave_id?: string;
    aeronave_registro?: string;
    categoria_id?: string;
    recibo_url?: string;
    nf_url?: string;
    tipo?: "recibo" | "nf"; // recibo ou nota fiscal
  },
  userId: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    console.log("🔄 Inserindo recibo de saída em bank_reconciliations...", data);

    // Validações básicas
    if (!data.descricao?.trim()) {
      throw new Error("Descrição é obrigatória");
    }
    if (!data.valor || data.valor <= 0) {
      throw new Error("Valor deve ser maior que zero");
    }
    if (!data.data) {
      throw new Error("Data é obrigatória");
    }

    // Normalizar formato de data para YYYY-MM-DD
    let normalizedDataData = data.data;
    if (normalizedDataData.includes("T")) {
      normalizedDataData = normalizedDataData.split("T")[0];
    }

    let normalizedDataVencimento = data.data_vencimento;
    if (normalizedDataVencimento && normalizedDataVencimento.includes("T")) {
      normalizedDataVencimento = normalizedDataVencimento.split("T")[0];
    }

    // Buscar categoria se foi fornecido categoria_id
    let categoria_movimentacao_id = null;
    if (data.categoria_id) {
      const { data: categoryData } = await supabase
        .from("categorias_movimentacao")
        .select("id")
        .eq("id", data.categoria_id)
        .single();

      if (categoryData) {
        categoria_movimentacao_id = categoryData.id;
      }
    }

    // Preparar dados para bank_reconciliations
    const bankReconciliationPayload = {
      type: "cliente" as const,
      date: normalizedDataData,
      description: data.descricao,
      amount: data.valor,
      status: data.status || "pendente",
      client_id: data.cliente_id || null,
      aeronave_id: data.aeronave_id || null,
      categoria_movimentacao_id: categoria_movimentacao_id,
      tipo_documento: data.tipo === "recibo" ? "recibo" : "recibo",
      doc: data.numero_documento || null,
      prazo_pagamento: normalizedDataVencimento || null,
      forma_pagamento: "empresa_paga" as const,
      afeta_caixa_empresa: true,
      criado_por: userId,
      comprovante_url: data.recibo_url || null,
      nf_url: data.nf_url || null,
      partner_name: data.client_name || null,
      reference_type: "movimentacoes",
      reference_id: data.numero_documento || null,
    };

    // Inserir em bank_reconciliations
    const { data: result, error } = await supabase
      .from("conciliacoes_bancarias")
      .insert(bankReconciliationPayload)
      .select()
      .single();

    if (error) {
      console.error("❌ Erro ao inserir em bank_reconciliations:", error);
      return {
        success: false,
        error: `Erro ao inserir em bank_reconciliations: ${error.message}`,
      };
    }

    console.log("✅ Recibo inserido em bank_reconciliations:", result.id);
    return {
      success: true,
      id: result.id,
    };
  } catch (error: any) {
    console.error("❌ Erro ao processar recibo de saída:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido",
    };
  }
}

export default handleReceiptSubmit;
