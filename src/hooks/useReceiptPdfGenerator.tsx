import { pdf } from "@react-pdf/renderer";
import { ReciboDocument } from "@/lib/reciboGenerator";
import { supabase } from "@/integrations/supabase/client";
import React from "react";

interface GeneratePdfOptions {
  receiptData: any;
  userId: string;
  onSuccess?: (pdfUrl: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Normaliza um registro da tabela `recibos` (colunas em PT) para o formato
 * esperado pelo componente de PDF (chaves em EN) e carrega os dados do emissor.
 */
export const normalizeReceiptForPdf = async (receiptData: any) => {
  let emissor = receiptData?.emissor || null;
  if (!emissor) {
    const { data: empresa } = await (supabase as any)
      .from("configuracao_empresa")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (empresa) {
      emissor = {
        razao_social: empresa.razao_social,
        cnpj: empresa.cnpj,
        telefone: empresa.telefone,
        endereco: empresa.endereco,
        cidade: empresa.cidade,
        cep: empresa.cep,
      };
    }
  }

  let bankSnapshot = {
    bank_name: receiptData?.bank_name || receiptData?.banco || null,
    bank_agency: receiptData?.bank_agency || receiptData?.agencia || null,
    bank_account: receiptData?.bank_account || receiptData?.conta || null,
    bank_pix: receiptData?.bank_pix || receiptData?.pix || null,
  };

  const beneficiarioTipo = receiptData?.beneficiario_tipo || (receiptData?.colaborador_id ? "colaborador" : "cliente");
  if (beneficiarioTipo === "colaborador" && receiptData?.colaborador_id) {
    const { data: perfil } = await (supabase as any)
      .from("user_profiles")
      .select("full_name, cpf, endereco, cidade, uf, bank_name, bank_agency, bank_account, bank_pix")
      .eq("id", receiptData.colaborador_id)
      .maybeSingle();

    if (perfil) {
      bankSnapshot = {
        bank_name: perfil.bank_name || bankSnapshot.bank_name,
        bank_agency: perfil.bank_agency || bankSnapshot.bank_agency,
        bank_account: perfil.bank_account || bankSnapshot.bank_account,
        bank_pix: perfil.bank_pix || bankSnapshot.bank_pix,
      };
    }
  }

  const { data: anexos } = await (supabase as any)
    .from("recibos_anexos")
    .select("id, tipo, arquivo_url, numero_documento")
    .eq("recibo_id", receiptData?.id)
    .order("criado_em", { ascending: true });

  return {
    ...receiptData,
    beneficiario_tipo: beneficiarioTipo,
    receipt_number: receiptData.receipt_number || receiptData.numero_recibo || "",
    payer_name: receiptData.payer_name || receiptData.nome_pagador || "",
    payer_document: receiptData.payer_document || receiptData.documento_pagador || "",
    payer_address: receiptData.payer_address || receiptData.endereco_pagador || null,
    payer_city: receiptData.payer_city || receiptData.cidade_pagador || null,
    payer_uf: receiptData.payer_uf || receiptData.uf_pagador || null,
    service_description: receiptData.service_description || receiptData.descricao_servico || "",
    receipt_type: receiptData.receipt_type || receiptData.tipo_recibo || "pagamento",
    issue_date: receiptData.issue_date || receiptData.data_emissao || null,
    max_payment_date: receiptData.max_payment_date || receiptData.data_max_pagamento || null,
    payment_method: receiptData.payment_method || receiptData.forma_pagamento || null,
    documento_number: receiptData.documento_number || receiptData.numero_documento || null,
    nome_categoria: receiptData.nome_categoria || null,
    valor: Number(receiptData.valor ?? receiptData.amount ?? 0),
    emissor,
    attachments: anexos || [],
    ...bankSnapshot,
  };
};

/**
 * Hook para gerar e fazer upload de PDF de recibos
 * Usa @react-pdf/renderer para a geração
 */
export const useReceiptPdfGenerator = () => {
  const generateAndUploadPdf = async (
    options: GeneratePdfOptions
  ): Promise<string | null> => {
    try {
      const { receiptData, userId, onSuccess, onError } = options;

      console.log("📄 Iniciando geração de PDF...");

      // Validar dados obrigatórios
      if (!receiptData?.id) {
        throw new Error("ID do recibo não encontrado");
      }

      if (!receiptData?.numero_recibo && !receiptData?.receipt_number) {
        throw new Error("Número do recibo não encontrado");
      }

      // Normalizar para o formato do documento PDF
      const pdfData = await normalizeReceiptForPdf(receiptData);

      // Gerar PDF usando @react-pdf/renderer
      const pdfBlob = await pdf(
        <ReciboDocument data={pdfData} />
      ).toBlob();


      if (!pdfBlob) {
        throw new Error("Falha ao gerar PDF");
      }

      console.log(`✅ PDF gerado com sucesso (${(pdfBlob.size / 1024).toFixed(2)} KB)`);

      // Preparar nome do arquivo
      const pdfFileName = `recibos/${receiptData.id}_${Date.now()}.pdf`;

      // Upload para Storage
      console.log("📤 Fazendo upload do PDF...");
      const { error: uploadError } = await supabase.storage
        .from("recibos")
        .upload(pdfFileName, pdfBlob, {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from("recibos")
        .getPublicUrl(pdfFileName);

      if (!urlData?.publicUrl) {
        throw new Error("Falha ao obter URL pública do PDF");
      }

      console.log("✅ URL pública obtida:", urlData.publicUrl);

      // Atualizar registro no banco de dados
      console.log("💾 Atualizando banco de dados...");
      const { error: updateError } = await supabase
        .from("recibos")
        .update({ pdf_url: urlData.publicUrl })
        .eq("id", receiptData.id)
        .eq("usuario_id", userId);

      if (updateError) {
        throw new Error(`Erro ao atualizar banco: ${updateError.message}`);
      }

      console.log("✅ PDF gerado e salvo com sucesso!");

      // Chamar callback de sucesso
      if (onSuccess) {
        onSuccess(urlData.publicUrl);
      }

      return urlData.publicUrl;
    } catch (error) {
      console.error("❌ Erro ao gerar PDF:", error);

      // Chamar callback de erro
      if (options.onError && error instanceof Error) {
        options.onError(error);
      }

      throw error;
    }
  };

  const downloadPdf = async (pdfUrl: string, fileName: string) => {
    try {
      console.log("📥 Iniciando download do PDF...");

      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log("✅ Download concluído!");
    } catch (error) {
      console.error("❌ Erro ao fazer download:", error);
      throw error;
    }
  };

  return {
    generateAndUploadPdf,
    downloadPdf,
  };
};
